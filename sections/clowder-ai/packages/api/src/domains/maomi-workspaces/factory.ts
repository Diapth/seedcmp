import type { RedisClient } from '@cat-cafe/shared/utils';
import type { IThreadWorkspaceBindingStore } from './ThreadWorkspaceBindingStore.js';
import { RedisThreadWorkspaceBindingStore, ThreadWorkspaceBindingStore } from './ThreadWorkspaceBindingStore.js';
import type { IMaomiWorkspaceStore } from './MaomiWorkspaceStore.js';
import { MaomiWorkspaceStore, RedisMaomiWorkspaceStore } from './MaomiWorkspaceStore.js';

export function createMaomiWorkspaceStore(rootPath: string, redis?: RedisClient | null): IMaomiWorkspaceStore {
  if (redis) return new RedisMaomiWorkspaceStore(rootPath, redis);
  return new MaomiWorkspaceStore(rootPath);
}

export function createThreadWorkspaceBindingStore(redis?: RedisClient | null): IThreadWorkspaceBindingStore {
  if (redis) return new RedisThreadWorkspaceBindingStore(redis);
  return new ThreadWorkspaceBindingStore();
}
