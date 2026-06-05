import type { CatId } from '@cat-cafe/shared';
import type {
  CoordinationRecord,
  CoordinationSubtask,
  ICoordinatorStore,
} from '../../stores/ports/CoordinatorStore.js';
import { isCoordinationTerminal } from '../../stores/ports/CoordinatorStore.js';
import { buildDeterministicCoordinatorPlan } from './CoordinatorPlanner.js';

export interface PrepareCoordinatorDispatchInput {
  threadId: string;
  coordinationId?: string | undefined;
  requestId: string;
  question: string;
  context?: string | undefined;
  targetCatIds: readonly CatId[];
  dispatchMode?: 'parallel' | 'serial' | 'mixed' | undefined;
  triggerType?: string | undefined;
}

export async function resolveActiveCoordination(
  store: ICoordinatorStore | undefined,
  threadId: string,
  explicitCoordinationId?: string,
): Promise<CoordinationRecord | null> {
  if (!store) return null;
  if (explicitCoordinationId) {
    const explicit = await store.get(explicitCoordinationId).catch(() => null);
    if (explicit) return explicit;
  }
  const records = await store.listByThread(threadId).catch(() => []);
  return records.find((record) => !isCoordinationTerminal(record.status)) ?? records[0] ?? null;
}

export async function prepareCoordinatorDispatch(
  store: ICoordinatorStore | undefined,
  input: PrepareCoordinatorDispatchInput,
): Promise<CoordinationRecord | null> {
  const coordination = await resolveActiveCoordination(store, input.threadId, input.coordinationId);
  if (!store || !coordination || isCoordinationTerminal(coordination.status)) return coordination;

  const targetCatIds = uniqueStrings([...coordination.targetCatIds, ...input.targetCatIds]);
  const plan = buildDeterministicCoordinatorPlan({
    goal: coordination.goal || input.question,
    requestedCatIds: targetCatIds as CatId[],
  });
  const subtasks = mergeDispatchSubtasks(coordination, {
    requestId: input.requestId,
    question: input.question,
    context: input.context,
    targetCatIds: input.targetCatIds,
  });
  const assumptions = uniqueStrings([
    ...coordination.assumptions,
    ...plan.assumptions,
    `multiMentionRequest:${input.requestId}`,
    ...(input.triggerType ? [`triggerType:${input.triggerType}`] : []),
  ]);

  await transitionToward(store, coordination.coordinationId, 'dispatching');
  return store.update(coordination.coordinationId, {
    status: 'running',
    targetCatIds,
    dispatchMode: input.dispatchMode ?? plan.dispatchMode,
    assumptions,
    subtasks,
  });
}

export async function markCoordinatorDispatchResponse(
  store: ICoordinatorStore | undefined,
  input: {
    threadId: string;
    coordinationId?: string | undefined;
    requestId: string;
    catId: CatId;
    status: 'received' | 'failed' | 'timeout';
    content?: string | undefined;
  },
): Promise<CoordinationRecord | null> {
  const coordination = await resolveActiveCoordination(store, input.threadId, input.coordinationId);
  if (!store || !coordination || isCoordinationTerminal(coordination.status)) return coordination;
  const subtasks = coordination.subtasks.map((subtask) => {
    if (subtask.id !== subtaskId(input.requestId, input.catId)) return subtask;
    return {
      ...subtask,
      status: input.status === 'received' ? 'done' : 'failed',
      ...(input.content ? { result: input.content.slice(0, 1000) } : {}),
      ...(input.status !== 'received' ? { failureReason: input.status } : {}),
    } satisfies CoordinationSubtask;
  });
  return store.update(coordination.coordinationId, {
    status: coordination.status === 'planning' || coordination.status === 'dispatching' ? 'running' : coordination.status,
    subtasks,
  });
}

function mergeDispatchSubtasks(
  coordination: CoordinationRecord,
  input: {
    requestId: string;
    question: string;
    context?: string | undefined;
    targetCatIds: readonly CatId[];
  },
): Array<Partial<CoordinationSubtask> & { title: string }> {
  const existingById = new Map(coordination.subtasks.map((subtask) => [subtask.id, subtask]));
  const next: Array<Partial<CoordinationSubtask> & { title: string }> = [...coordination.subtasks];
  for (const catId of input.targetCatIds) {
    const id = subtaskId(input.requestId, catId);
    if (existingById.has(id)) continue;
    next.push({
      id,
      title: `执行子任务：${input.question.slice(0, 80)}`,
      ...(input.context ? { description: input.context.slice(0, 500) } : {}),
      targetCatId: catId as string,
      status: 'doing',
    });
  }
  return next;
}

export function subtaskId(requestId: string, catId: CatId): string {
  return `mm_${requestId}_${catId as string}`;
}

export async function transitionToward(
  store: ICoordinatorStore,
  coordinationId: string,
  target: 'dispatching' | 'running' | 'aggregating',
): Promise<void> {
  let current = await store.get(coordinationId);
  if (!current || isCoordinationTerminal(current.status)) return;

  const steps =
    target === 'dispatching'
      ? ['dispatching']
      : target === 'running'
        ? ['dispatching', 'running']
        : ['dispatching', 'running', 'aggregating'];

  for (const step of steps) {
    current = await store.get(coordinationId);
    if (!current || isCoordinationTerminal(current.status) || current.status === step) continue;
    try {
      await store.transition(coordinationId, step as 'dispatching' | 'running' | 'aggregating');
    } catch {
      // Another path may already have moved the state forward; callers will retry with fresh data.
    }
  }
}

function uniqueStrings(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}
