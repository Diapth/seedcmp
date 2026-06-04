import { randomUUID } from 'node:crypto';
import type { RedisClient } from '@cat-cafe/shared/utils';

export type DeploymentEnvironment = 'local' | 'preview' | 'testing' | 'staging' | 'production' | 'development';
export type DeploymentRequestStatus =
  | 'needs_fields'
  | 'pending_confirmation'
  | 'confirmed'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';
export type DeploymentMissingField = 'target' | 'environment';

export interface DeploymentTargetCandidate {
  id: string;
  label: string;
  value: string;
  source: 'active_workspace' | 'recent_workspace' | 'artifact' | 'preview' | 'task' | 'text';
  workspaceId?: string;
  path?: string;
}

export interface DeploymentEnvironmentCandidate {
  id: DeploymentEnvironment;
  label: string;
  value: DeploymentEnvironment;
}

export interface DeploymentRequest {
  id: string;
  userId: string;
  connectorId: 'im-web';
  channelId: string;
  channelType: 1 | 2;
  threadId?: string;
  externalChatId?: string;
  sourceMessageId?: string;
  cardMessageId?: string;
  originalText: string;
  target: string | null;
  environment: DeploymentEnvironment | null;
  missingFields: DeploymentMissingField[];
  status: DeploymentRequestStatus;
  targetCandidates: DeploymentTargetCandidate[];
  environmentCandidates: DeploymentEnvironmentCandidate[];
  workspaceId?: string;
  workspacePath?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateDeploymentRequestInput {
  userId: string;
  channelId: string;
  channelType: 1 | 2;
  threadId?: string;
  externalChatId?: string;
  sourceMessageId?: string;
  cardMessageId?: string;
  originalText: string;
  target?: string | null;
  environment?: DeploymentEnvironment | string | null;
  targetCandidates?: DeploymentTargetCandidate[];
  environmentCandidates?: DeploymentEnvironmentCandidate[];
  workspaceId?: string;
  workspacePath?: string;
}

export interface UpdateDeploymentRequestInput {
  target?: string | null;
  environment?: DeploymentEnvironment | string | null;
  sourceMessageId?: string;
  cardMessageId?: string;
  targetCandidates?: DeploymentTargetCandidate[];
  workspaceId?: string;
  workspacePath?: string;
  status?: DeploymentRequestStatus;
}

export interface IDeploymentRequestStore {
  create(input: CreateDeploymentRequestInput): Promise<DeploymentRequest>;
  get(id: string): Promise<DeploymentRequest | null>;
  updateFields(id: string, input: UpdateDeploymentRequestInput): Promise<DeploymentRequest | null>;
  listByConversation(input: {
    userId?: string;
    channelId: string;
    channelType: 1 | 2;
  }): Promise<DeploymentRequest[]>;
  listActiveByConversation(input: {
    userId?: string;
    channelId: string;
    channelType: 1 | 2;
  }): Promise<DeploymentRequest[]>;
  confirm(id: string): Promise<DeploymentRequest | null>;
  cancel(id: string): Promise<DeploymentRequest | null>;
}

export const DEFAULT_ENVIRONMENT_CANDIDATES: DeploymentEnvironmentCandidate[] = [
  { id: 'local', label: '本地', value: 'local' },
  { id: 'preview', label: '预览', value: 'preview' },
  { id: 'testing', label: '测试', value: 'testing' },
  { id: 'staging', label: '预发', value: 'staging' },
  { id: 'production', label: '生产', value: 'production' },
];

function normalizeNullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text || text === '待确认目标' || text === '待确认环境') return null;
  return text;
}

function normalizeEnvironment(value: unknown): DeploymentEnvironment | null {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text || text === '待确认环境') return null;
  if (['local', 'localhost', '本地'].includes(text)) return 'local';
  if (['preview', '预览'].includes(text)) return 'preview';
  if (['testing', 'test', '测试'].includes(text)) return 'testing';
  if (['staging', 'stage', 'uat', '预发'].includes(text)) return 'staging';
  if (['production', 'prod', '生产', '线上'].includes(text)) return 'production';
  if (['development', 'dev', '开发'].includes(text)) return 'development';
  return null;
}

function computeMissingFields(target: string | null, environment: DeploymentEnvironment | null): DeploymentMissingField[] {
  const missing: DeploymentMissingField[] = [];
  if (!target) missing.push('target');
  if (!environment) missing.push('environment');
  return missing;
}

function statusForFields(target: string | null, environment: DeploymentEnvironment | null): DeploymentRequestStatus {
  return computeMissingFields(target, environment).length > 0 ? 'needs_fields' : 'pending_confirmation';
}

function normalizeCandidates(candidates: DeploymentTargetCandidate[] | undefined): DeploymentTargetCandidate[] {
  const out: DeploymentTargetCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates ?? []) {
    const value = normalizeNullableText(candidate.value);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({
      id: candidate.id || value,
      label: candidate.label || value,
      value,
      source: candidate.source || 'text',
      ...(candidate.workspaceId ? { workspaceId: candidate.workspaceId } : {}),
      ...(candidate.path ? { path: candidate.path } : {}),
    });
  }
  return out;
}

function mergeTargetCandidates(
  existing: readonly DeploymentTargetCandidate[],
  next: readonly DeploymentTargetCandidate[],
): DeploymentTargetCandidate[] {
  return normalizeCandidates([...existing, ...next]);
}

function isActiveStatus(status: DeploymentRequestStatus): boolean {
  return status === 'needs_fields' || status === 'pending_confirmation';
}

export class DeploymentRequestStore implements IDeploymentRequestStore {
  protected readonly byId = new Map<string, DeploymentRequest>();

  async create(input: CreateDeploymentRequestInput): Promise<DeploymentRequest> {
    const now = Date.now();
    const target = normalizeNullableText(input.target);
    const environment = normalizeEnvironment(input.environment);
    const request: DeploymentRequest = {
      id: `deploy_${randomUUID()}`,
      userId: input.userId,
      connectorId: 'im-web',
      channelId: input.channelId,
      channelType: input.channelType,
      ...(input.threadId ? { threadId: input.threadId } : {}),
      ...(input.externalChatId ? { externalChatId: input.externalChatId } : {}),
      ...(input.sourceMessageId ? { sourceMessageId: input.sourceMessageId } : {}),
      ...(input.cardMessageId ? { cardMessageId: input.cardMessageId } : {}),
      originalText: input.originalText,
      target,
      environment,
      missingFields: computeMissingFields(target, environment),
      status: statusForFields(target, environment),
      targetCandidates: normalizeCandidates(input.targetCandidates),
      environmentCandidates: input.environmentCandidates ?? DEFAULT_ENVIRONMENT_CANDIDATES,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      ...(input.workspacePath ? { workspacePath: input.workspacePath } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await this.put(request);
    return request;
  }

  async get(id: string): Promise<DeploymentRequest | null> {
    return this.byId.get(id) ?? null;
  }

  async updateFields(id: string, input: UpdateDeploymentRequestInput): Promise<DeploymentRequest | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const target = input.target === undefined ? existing.target : normalizeNullableText(input.target);
    const environment = input.environment === undefined ? existing.environment : normalizeEnvironment(input.environment);
    const status = input.status ?? (isActiveStatus(existing.status) ? statusForFields(target, environment) : existing.status);
    const updated: DeploymentRequest = {
      ...existing,
      target,
      environment,
      missingFields: computeMissingFields(target, environment),
      status,
      targetCandidates: input.targetCandidates
        ? mergeTargetCandidates(existing.targetCandidates, input.targetCandidates)
        : existing.targetCandidates,
      ...(input.sourceMessageId ? { sourceMessageId: input.sourceMessageId } : {}),
      ...(input.cardMessageId ? { cardMessageId: input.cardMessageId } : {}),
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      ...(input.workspacePath ? { workspacePath: input.workspacePath } : {}),
      updatedAt: Date.now(),
    };
    await this.put(updated);
    return updated;
  }

  async listByConversation(input: {
    userId?: string;
    channelId: string;
    channelType: 1 | 2;
  }): Promise<DeploymentRequest[]> {
    return [...this.byId.values()]
      .filter((request) => request.channelId === input.channelId && request.channelType === input.channelType)
      .filter((request) => !input.userId || request.userId === input.userId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async listActiveByConversation(input: {
    userId?: string;
    channelId: string;
    channelType: 1 | 2;
  }): Promise<DeploymentRequest[]> {
    return (await this.listByConversation(input))
      .filter((request) => isActiveStatus(request.status))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async confirm(id: string): Promise<DeploymentRequest | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const status: DeploymentRequestStatus = existing.missingFields.length > 0 ? 'needs_fields' : 'confirmed';
    const updated = { ...existing, status, updatedAt: Date.now() };
    await this.put(updated);
    return updated;
  }

  async cancel(id: string): Promise<DeploymentRequest | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const updated = { ...existing, status: 'cancelled' as DeploymentRequestStatus, updatedAt: Date.now() };
    await this.put(updated);
    return updated;
  }

  protected async put(request: DeploymentRequest): Promise<void> {
    this.byId.set(request.id, request);
  }
}

export class RedisDeploymentRequestStore extends DeploymentRequestStore {
  constructor(private readonly redis: RedisClient) {
    super();
  }

  override async get(id: string): Promise<DeploymentRequest | null> {
    const raw = await this.redis.get(this.detailKey(id));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DeploymentRequest;
    } catch {
      return null;
    }
  }

  override async listActiveByConversation(input: {
    userId?: string;
    channelId: string;
    channelType: 1 | 2;
  }): Promise<DeploymentRequest[]> {
    const requests = await this.listByConversation(input);
    return requests
      .filter((request) => isActiveStatus(request.status))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  override async listByConversation(input: {
    userId?: string;
    channelId: string;
    channelType: 1 | 2;
  }): Promise<DeploymentRequest[]> {
    const ids = await this.redis.smembers(this.conversationKey(input.channelId, input.channelType));
    const requests: DeploymentRequest[] = [];
    for (const id of ids) {
      const request = await this.get(id);
      if (request) requests.push(request);
    }
    return requests
      .filter((request) => !input.userId || request.userId === input.userId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  protected override async put(request: DeploymentRequest): Promise<void> {
    await super.put(request);
    const pipeline = this.redis.multi();
    pipeline.set(this.detailKey(request.id), JSON.stringify(request));
    pipeline.sadd(this.conversationKey(request.channelId, request.channelType), request.id);
    await pipeline.exec();
  }

  private detailKey(id: string): string {
    return `deployment-request:${id}`;
  }

  private conversationKey(channelId: string, channelType: 1 | 2): string {
    return `deployment-requests:conversation:${channelType}:${channelId}`;
  }
}

export function createDeploymentRequestStore(redis?: RedisClient | null): IDeploymentRequestStore {
  if (redis) return new RedisDeploymentRequestStore(redis);
  return new DeploymentRequestStore();
}
