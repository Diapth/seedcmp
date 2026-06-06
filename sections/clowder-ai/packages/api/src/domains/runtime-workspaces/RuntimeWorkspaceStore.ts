import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import type { CatId } from '@cat-cafe/shared';

export type RuntimeWorkspaceType =
  | 'cache'
  | 'verification_checkout'
  | 'agent_workspace'
  | 'qa_workspace'
  | 'patch_staging'
  | 'artifact_staging';

export type RuntimeWorkspaceDirtyStatus = 'clean' | 'dirty' | 'unknown';
export type RuntimeWorkspaceCleanupPolicy = 'ttl_auto' | 'on_task_close' | 'manual_required' | 'archive_required';

export interface RuntimeWorkspaceRecord {
  id: string;
  type: RuntimeWorkspaceType;
  projectRoot: string;
  runtimeRoot: string;
  path: string;
  threadId?: string;
  taskId?: string;
  invocationId?: string;
  ownerCatId?: CatId | string;
  branch?: string;
  gitHead?: string;
  dirtyStatus: RuntimeWorkspaceDirtyStatus;
  changedFiles: string[];
  sizeBytes?: number;
  createdAt: number;
  lastActivityAt: number;
  cleanupPolicy: RuntimeWorkspaceCleanupPolicy;
  artifactRefs: string[];
}

export interface RegisterRuntimeWorkspaceInput {
  type: RuntimeWorkspaceType;
  projectRoot: string;
  runtimeRoot: string;
  path: string;
  threadId?: string;
  taskId?: string;
  invocationId?: string;
  ownerCatId?: CatId | string;
  cleanupPolicy?: RuntimeWorkspaceCleanupPolicy;
  dirtyStatus?: RuntimeWorkspaceDirtyStatus;
  changedFiles?: readonly string[];
  artifactRefs?: readonly string[];
}

export interface IRuntimeWorkspaceStore {
  register(input: RegisterRuntimeWorkspaceInput): Promise<RuntimeWorkspaceRecord>;
  get(id: string): Promise<RuntimeWorkspaceRecord | null>;
  listByThread(threadId: string): Promise<RuntimeWorkspaceRecord[]>;
  listByProject(projectRoot: string): Promise<RuntimeWorkspaceRecord[]>;
}

function cleanupPolicyForType(type: RuntimeWorkspaceType): RuntimeWorkspaceCleanupPolicy {
  if (type === 'cache') return 'ttl_auto';
  if (type === 'verification_checkout' || type === 'qa_workspace') return 'on_task_close';
  if (type === 'patch_staging' || type === 'artifact_staging') return 'archive_required';
  return 'manual_required';
}

async function directorySizeBytes(root: string): Promise<number | undefined> {
  try {
    const info = await stat(root);
    if (!info.isDirectory()) return info.size;
  } catch {
    return undefined;
  }
  return undefined;
}

export class RuntimeWorkspaceStore implements IRuntimeWorkspaceStore {
  private readonly records = new Map<string, RuntimeWorkspaceRecord>();

  async register(input: RegisterRuntimeWorkspaceInput): Promise<RuntimeWorkspaceRecord> {
    const now = Date.now();
    const path = resolve(input.path);
    await mkdir(path, { recursive: true });
    const existing = [...this.records.values()].find((record) => record.path === path);
    const record: RuntimeWorkspaceRecord = {
      ...(existing ?? { id: randomUUID(), createdAt: now }),
      type: input.type,
      projectRoot: resolve(input.projectRoot),
      runtimeRoot: resolve(input.runtimeRoot),
      path,
      ...(input.threadId ? { threadId: input.threadId } : {}),
      ...(input.taskId ? { taskId: input.taskId } : {}),
      ...(input.invocationId ? { invocationId: input.invocationId } : {}),
      ...(input.ownerCatId ? { ownerCatId: input.ownerCatId } : {}),
      dirtyStatus: input.dirtyStatus ?? existing?.dirtyStatus ?? 'unknown',
      changedFiles: [...(input.changedFiles ?? existing?.changedFiles ?? [])],
      sizeBytes: await directorySizeBytes(path),
      lastActivityAt: now,
      cleanupPolicy: input.cleanupPolicy ?? existing?.cleanupPolicy ?? cleanupPolicyForType(input.type),
      artifactRefs: [...(input.artifactRefs ?? existing?.artifactRefs ?? [])],
    };

    this.records.set(record.id, record);
    await this.writeSidecar(record);
    return record;
  }

  async get(id: string): Promise<RuntimeWorkspaceRecord | null> {
    return this.records.get(id) ?? null;
  }

  async listByThread(threadId: string): Promise<RuntimeWorkspaceRecord[]> {
    return this.sorted([...this.records.values()].filter((record) => record.threadId === threadId));
  }

  async listByProject(projectRoot: string): Promise<RuntimeWorkspaceRecord[]> {
    const resolved = resolve(projectRoot);
    return this.sorted([...this.records.values()].filter((record) => record.projectRoot === resolved));
  }

  private sorted(records: RuntimeWorkspaceRecord[]): RuntimeWorkspaceRecord[] {
    return records.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }

  private async writeSidecar(record: RuntimeWorkspaceRecord): Promise<void> {
    if (!existsSync(record.path)) return;
    const sidecar = join(record.path, '.clowder-workspace.json');
    const payload = {
      ...record,
      displayName: basename(record.path),
      relativeToRuntimeRoot: relative(record.runtimeRoot, record.path),
    };
    await writeFile(sidecar, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  }
}
