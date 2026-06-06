import { randomUUID } from 'node:crypto';
import type { RedisClient } from '@cat-cafe/shared/utils';
import type { DeploymentEnvironment } from './DeploymentRequestStore.js';

export type DeploymentJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type DeploymentJobLogLevel = 'info' | 'warn' | 'error';

export interface DeploymentContainerPlan {
  dockerfilePath: string;
  imageName: string;
  executed: false;
  reason: string;
}

export interface DeploymentJobLogEntry {
  at: number;
  level: DeploymentJobLogLevel;
  message: string;
}

export interface DeploymentJob {
  id: string;
  deploymentRequestId: string;
  userId: string;
  connectorId: 'im-web';
  channelId: string;
  channelType: 1 | 2;
  target: string;
  environment: DeploymentEnvironment;
  workspaceId?: string;
  workspacePath?: string;
  status: DeploymentJobStatus;
  previewUrl?: string;
  downloadUrl?: string;
  previewRootPath?: string;
  downloadFilePath?: string;
  artifactPath?: string;
  sourcePackagePath?: string;
  containerPlan?: DeploymentContainerPlan;
  failureReason?: string;
  logs: DeploymentJobLogEntry[];
  createdAt: number;
  updatedAt: number;
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface CreateDeploymentJobInput {
  deploymentRequestId: string;
  userId: string;
  channelId: string;
  channelType: 1 | 2;
  target: string;
  environment: DeploymentEnvironment;
  workspaceId?: string;
  workspacePath?: string;
}

export interface UpdateDeploymentJobInput {
  status?: DeploymentJobStatus;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  previewRootPath?: string | null;
  downloadFilePath?: string | null;
  artifactPath?: string | null;
  sourcePackagePath?: string | null;
  containerPlan?: DeploymentContainerPlan | null;
  failureReason?: string | null;
  startedAt?: number;
  completedAt?: number;
}

export interface IDeploymentJobStore {
  createQueued(input: CreateDeploymentJobInput): Promise<DeploymentJob>;
  get(id: string): Promise<DeploymentJob | null>;
  update(id: string, input: UpdateDeploymentJobInput): Promise<DeploymentJob | null>;
  appendLog(id: string, level: DeploymentJobLogLevel, message: string): Promise<DeploymentJob | null>;
  getLogs(id: string): Promise<DeploymentJobLogEntry[]>;
}

function normalizeDeploymentJobId(input: string): string {
  const text = String(input || '').trim();
  return text || `deploy_${randomUUID()}`;
}

function applyNullableJobField(
  target: DeploymentJob,
  key: keyof DeploymentJob,
  value: unknown,
): void {
  if (value === undefined) return;
  const mutable = target as unknown as Record<string, unknown>;
  if (value === null) {
    delete mutable[key];
    return;
  }
  mutable[key] = value;
}

export class DeploymentJobStore implements IDeploymentJobStore {
  protected readonly byId = new Map<string, DeploymentJob>();

  async createQueued(input: CreateDeploymentJobInput): Promise<DeploymentJob> {
    const id = normalizeDeploymentJobId(input.deploymentRequestId);
    const existing = await this.get(id);
    if (existing) return existing;
    const now = Date.now();
    const job: DeploymentJob = {
      id,
      deploymentRequestId: input.deploymentRequestId,
      userId: input.userId,
      connectorId: 'im-web',
      channelId: input.channelId,
      channelType: input.channelType,
      target: input.target,
      environment: input.environment,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      ...(input.workspacePath ? { workspacePath: input.workspacePath } : {}),
      status: 'queued',
      logs: [{ at: now, level: 'info', message: 'Deployment job queued' }],
      createdAt: now,
      updatedAt: now,
      queuedAt: now,
    };
    await this.put(job);
    return job;
  }

  async get(id: string): Promise<DeploymentJob | null> {
    return this.byId.get(id) ?? null;
  }

  async update(id: string, input: UpdateDeploymentJobInput): Promise<DeploymentJob | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const updated: DeploymentJob = {
      ...existing,
      ...(input.status ? { status: input.status } : {}),
      ...(input.startedAt ? { startedAt: input.startedAt } : {}),
      ...(input.completedAt ? { completedAt: input.completedAt } : {}),
      updatedAt: Date.now(),
    };
    applyNullableJobField(updated, 'previewUrl', input.previewUrl);
    applyNullableJobField(updated, 'downloadUrl', input.downloadUrl);
    applyNullableJobField(updated, 'previewRootPath', input.previewRootPath);
    applyNullableJobField(updated, 'downloadFilePath', input.downloadFilePath);
    applyNullableJobField(updated, 'artifactPath', input.artifactPath);
    applyNullableJobField(updated, 'sourcePackagePath', input.sourcePackagePath);
    applyNullableJobField(updated, 'containerPlan', input.containerPlan);
    applyNullableJobField(updated, 'failureReason', input.failureReason);
    await this.put(updated);
    return updated;
  }

  async appendLog(id: string, level: DeploymentJobLogLevel, message: string): Promise<DeploymentJob | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const updated: DeploymentJob = {
      ...existing,
      logs: [...existing.logs, { at: Date.now(), level, message }],
      updatedAt: Date.now(),
    };
    await this.put(updated);
    return updated;
  }

  async getLogs(id: string): Promise<DeploymentJobLogEntry[]> {
    return (await this.get(id))?.logs ?? [];
  }

  protected async put(job: DeploymentJob): Promise<void> {
    this.byId.set(job.id, job);
  }
}

export class RedisDeploymentJobStore extends DeploymentJobStore {
  constructor(private readonly redis: RedisClient) {
    super();
  }

  override async get(id: string): Promise<DeploymentJob | null> {
    const raw = await this.redis.get(this.detailKey(id));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DeploymentJob;
    } catch {
      return null;
    }
  }

  protected override async put(job: DeploymentJob): Promise<void> {
    await super.put(job);
    await this.redis.set(this.detailKey(job.id), JSON.stringify(job));
  }

  private detailKey(id: string): string {
    return `deployment-job:${id}`;
  }
}

export function createDeploymentJobStore(redis?: RedisClient | null): IDeploymentJobStore {
  if (redis) return new RedisDeploymentJobStore(redis);
  return new DeploymentJobStore();
}
