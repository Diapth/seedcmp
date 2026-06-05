import { randomUUID } from 'node:crypto';

export type CoordinationStatus =
  | 'planning'
  | 'dispatching'
  | 'running'
  | 'aggregating'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type CoordinationDispatchMode = 'parallel' | 'serial' | 'mixed';
export type CoordinationSubtaskStatus = 'todo' | 'doing' | 'blocked' | 'done' | 'failed' | 'cancelled';

export interface CoordinationSubtask {
  id: string;
  title: string;
  description?: string;
  targetCatId?: string;
  status: CoordinationSubtaskStatus;
  artifactRefs: string[];
  dependsOn: string[];
  result?: string;
  failureReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CoordinationRecord {
  coordinationId: string;
  threadId: string;
  sourceMessageId?: string;
  createdBy: string;
  status: CoordinationStatus;
  goal: string;
  assumptions: string[];
  subtasks: CoordinationSubtask[];
  targetCatIds: string[];
  dispatchMode: CoordinationDispatchMode;
  aggregateSummary?: string;
  failureReason?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface CreateCoordinationInput {
  coordinationId?: string;
  threadId: string;
  sourceMessageId?: string;
  createdBy: string;
  goal: string;
  assumptions?: string[];
  subtasks?: Array<Partial<CoordinationSubtask> & { title: string }>;
  targetCatIds?: string[];
  dispatchMode?: CoordinationDispatchMode;
  status?: CoordinationStatus;
  idempotencyKey?: string;
}

export interface UpdateCoordinationInput {
  status?: CoordinationStatus;
  assumptions?: string[];
  subtasks?: Array<Partial<CoordinationSubtask> & { title: string }>;
  targetCatIds?: string[];
  dispatchMode?: CoordinationDispatchMode;
  aggregateSummary?: string;
  failureReason?: string;
}

export interface ICoordinatorStore {
  create(input: CreateCoordinationInput): Promise<{ coordination: CoordinationRecord; created: boolean }>;
  get(coordinationId: string): Promise<CoordinationRecord | null>;
  listByThread(threadId: string): Promise<CoordinationRecord[]>;
  update(coordinationId: string, input: UpdateCoordinationInput): Promise<CoordinationRecord | null>;
  transition(coordinationId: string, status: CoordinationStatus, input?: UpdateCoordinationInput): Promise<CoordinationRecord | null>;
  cancel(coordinationId: string, reason?: string): Promise<CoordinationRecord | null>;
}

const TERMINAL_STATUSES = new Set<CoordinationStatus>(['succeeded', 'failed', 'cancelled']);

const ALLOWED_TRANSITIONS: Record<CoordinationStatus, CoordinationStatus[]> = {
  planning: ['dispatching', 'running', 'failed', 'cancelled'],
  dispatching: ['running', 'aggregating', 'failed', 'cancelled'],
  running: ['aggregating', 'succeeded', 'failed', 'cancelled'],
  aggregating: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function isCoordinationTerminal(status: CoordinationStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isValidCoordinationTransition(from: CoordinationStatus, to: CoordinationStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertCoordinationTransition(from: CoordinationStatus, to: CoordinationStatus): void {
  if (!isValidCoordinationTransition(from, to)) {
    throw new Error(`Invalid coordination transition: ${from} -> ${to}`);
  }
}

export function failCoordination(record: CoordinationRecord, reason: string): CoordinationRecord {
  const now = Date.now();
  assertCoordinationTransition(record.status, 'failed');
  return {
    ...record,
    status: 'failed',
    failureReason: reason,
    updatedAt: now,
    completedAt: now,
  };
}

export function normalizeCoordinationInput(input: CreateCoordinationInput, now = Date.now()): CoordinationRecord {
  const status = input.status ?? 'planning';
  const coordination: CoordinationRecord = {
    coordinationId: input.coordinationId?.trim() || `coord_${randomUUID()}`,
    threadId: input.threadId.trim(),
    ...(input.sourceMessageId?.trim() ? { sourceMessageId: input.sourceMessageId.trim() } : {}),
    createdBy: input.createdBy.trim(),
    status,
    goal: input.goal.trim(),
    assumptions: uniqueStrings(input.assumptions),
    subtasks: normalizeSubtasks(input.subtasks, now),
    targetCatIds: uniqueStrings(input.targetCatIds),
    dispatchMode: input.dispatchMode ?? 'parallel',
    createdAt: now,
    updatedAt: now,
    ...(isCoordinationTerminal(status) ? { completedAt: now } : {}),
  };
  return coordination;
}

export function mergeCoordinationUpdate(
  existing: CoordinationRecord,
  input: UpdateCoordinationInput,
  now = Date.now(),
): CoordinationRecord {
  const status = input.status ?? existing.status;
  if (status !== existing.status) {
    assertCoordinationTransition(existing.status, status);
  }
  return {
    ...existing,
    status,
    assumptions: input.assumptions ? uniqueStrings(input.assumptions) : existing.assumptions,
    subtasks: input.subtasks ? normalizeSubtasks(input.subtasks, now, existing.subtasks) : existing.subtasks,
    targetCatIds: input.targetCatIds ? uniqueStrings(input.targetCatIds) : existing.targetCatIds,
    dispatchMode: input.dispatchMode ?? existing.dispatchMode,
    ...(input.aggregateSummary !== undefined ? { aggregateSummary: input.aggregateSummary } : {}),
    ...(input.failureReason !== undefined ? { failureReason: input.failureReason } : {}),
    updatedAt: now,
    ...(isCoordinationTerminal(status) ? { completedAt: existing.completedAt ?? now } : {}),
  };
}

export function coordinationIdempotencyKey(input: CreateCoordinationInput): string | null {
  const explicit = input.idempotencyKey?.trim();
  if (explicit) return `${input.threadId.trim()}:idem:${explicit}`;
  const sourceMessageId = input.sourceMessageId?.trim();
  if (sourceMessageId) return `${input.threadId.trim()}:source:${sourceMessageId}`;
  return null;
}

export class InMemoryCoordinatorStore implements ICoordinatorStore {
  protected readonly byId = new Map<string, CoordinationRecord>();
  protected readonly idempotencyIndex = new Map<string, string>();

  async create(input: CreateCoordinationInput): Promise<{ coordination: CoordinationRecord; created: boolean }> {
    const requestedId = input.coordinationId?.trim();
    if (requestedId) {
      const existingById = await this.get(requestedId);
      if (existingById) return { coordination: existingById, created: false };
    }

    const idempotencyKey = coordinationIdempotencyKey(input);
    if (idempotencyKey) {
      const existingId = this.idempotencyIndex.get(idempotencyKey);
      const existing = existingId ? await this.get(existingId) : null;
      if (existing) return { coordination: existing, created: false };
    }

    const coordination = normalizeCoordinationInput(input);
    await this.put(coordination, idempotencyKey);
    return { coordination, created: true };
  }

  async get(coordinationId: string): Promise<CoordinationRecord | null> {
    return this.byId.get(coordinationId) ?? null;
  }

  async listByThread(threadId: string): Promise<CoordinationRecord[]> {
    return [...this.byId.values()]
      .filter((coordination) => coordination.threadId === threadId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async update(coordinationId: string, input: UpdateCoordinationInput): Promise<CoordinationRecord | null> {
    const existing = await this.get(coordinationId);
    if (!existing) return null;
    const updated = mergeCoordinationUpdate(existing, input);
    await this.put(updated);
    return updated;
  }

  async transition(
    coordinationId: string,
    status: CoordinationStatus,
    input: UpdateCoordinationInput = {},
  ): Promise<CoordinationRecord | null> {
    return this.update(coordinationId, { ...input, status });
  }

  async cancel(coordinationId: string, reason = 'cancelled_by_user'): Promise<CoordinationRecord | null> {
    const existing = await this.get(coordinationId);
    if (!existing) return null;
    if (isCoordinationTerminal(existing.status)) return existing;
    return this.transition(coordinationId, 'cancelled', { failureReason: reason });
  }

  protected async put(coordination: CoordinationRecord, idempotencyKey?: string | null): Promise<void> {
    this.byId.set(coordination.coordinationId, coordination);
    if (idempotencyKey) {
      this.idempotencyIndex.set(idempotencyKey, coordination.coordinationId);
    }
  }
}

function uniqueStrings(values: readonly unknown[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values ?? []) {
    const text = String(value ?? '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function normalizeSubtasks(
  input: Array<Partial<CoordinationSubtask> & { title: string }> | undefined,
  now: number,
  existing: readonly CoordinationSubtask[] = [],
): CoordinationSubtask[] {
  const existingById = new Map(existing.map((subtask) => [subtask.id, subtask]));
  const seen = new Set<string>();
  const out: CoordinationSubtask[] = [];
  for (const raw of input ?? []) {
    const title = String(raw.title ?? '').trim();
    if (!title) continue;
    const id = String(raw.id || `subtask_${randomUUID()}`).trim();
    const dedupeKey = id || `${title}:${String(raw.targetCatId || '')}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const previous = existingById.get(id);
    out.push({
      id,
      title,
      ...(raw.description ? { description: String(raw.description).trim() } : previous?.description ? { description: previous.description } : {}),
      ...(raw.targetCatId ? { targetCatId: String(raw.targetCatId).trim() } : previous?.targetCatId ? { targetCatId: previous.targetCatId } : {}),
      status: raw.status ?? previous?.status ?? 'todo',
      artifactRefs: uniqueStrings(raw.artifactRefs ?? previous?.artifactRefs),
      dependsOn: uniqueStrings(raw.dependsOn ?? previous?.dependsOn),
      ...(raw.result ? { result: String(raw.result).trim() } : previous?.result ? { result: previous.result } : {}),
      ...(raw.failureReason ? { failureReason: String(raw.failureReason).trim() } : previous?.failureReason ? { failureReason: previous.failureReason } : {}),
      createdAt: previous?.createdAt ?? raw.createdAt ?? now,
      updatedAt: now,
    });
  }
  return out;
}
