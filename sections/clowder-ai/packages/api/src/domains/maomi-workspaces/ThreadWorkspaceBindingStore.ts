import type { RedisClient } from '@cat-cafe/shared/utils';

export interface ThreadWorkspaceBinding {
  threadId: string;
  userId: string;
  activeWorkspaceId: string | null;
  recentWorkspaceIds: string[];
  updatedAt: number;
}

export interface IThreadWorkspaceBindingStore {
  get(threadId: string): Promise<ThreadWorkspaceBinding | null>;
  bind(threadId: string, userId: string, workspaceId: string | null): Promise<ThreadWorkspaceBinding>;
  clear(threadId: string, userId: string): Promise<ThreadWorkspaceBinding>;
}

function normalizeRecent(existing: readonly string[], activeWorkspaceId: string | null): string[] {
  if (!activeWorkspaceId) return [...existing];
  return [activeWorkspaceId, ...existing.filter((id) => id !== activeWorkspaceId)].slice(0, 10);
}

export class ThreadWorkspaceBindingStore implements IThreadWorkspaceBindingStore {
  private readonly byThread = new Map<string, ThreadWorkspaceBinding>();

  async get(threadId: string): Promise<ThreadWorkspaceBinding | null> {
    return this.byThread.get(threadId) ?? null;
  }

  async bind(threadId: string, userId: string, workspaceId: string | null): Promise<ThreadWorkspaceBinding> {
    const existing = await this.get(threadId);
    const binding: ThreadWorkspaceBinding = {
      threadId,
      userId,
      activeWorkspaceId: workspaceId,
      recentWorkspaceIds: normalizeRecent(existing?.recentWorkspaceIds ?? [], workspaceId),
      updatedAt: Date.now(),
    };
    await this.put(binding);
    return binding;
  }

  async clear(threadId: string, userId: string): Promise<ThreadWorkspaceBinding> {
    return this.bind(threadId, userId, null);
  }

  protected async put(binding: ThreadWorkspaceBinding): Promise<void> {
    this.byThread.set(binding.threadId, binding);
  }
}

export class RedisThreadWorkspaceBindingStore extends ThreadWorkspaceBindingStore {
  constructor(private readonly redis: RedisClient) {
    super();
  }

  override async get(threadId: string): Promise<ThreadWorkspaceBinding | null> {
    const raw = await this.redis.get(this.key(threadId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ThreadWorkspaceBinding;
    } catch {
      return null;
    }
  }

  protected override async put(binding: ThreadWorkspaceBinding): Promise<void> {
    await super.put(binding);
    await this.redis.set(this.key(binding.threadId), JSON.stringify(binding));
  }

  private key(threadId: string): string {
    return `thread-workspace-binding:${threadId}`;
  }
}
