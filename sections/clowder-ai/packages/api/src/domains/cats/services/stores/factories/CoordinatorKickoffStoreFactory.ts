/**
 * Factory for CoordinatorKickoffStore.
 * Uses Redis when available, otherwise the in-memory fallback.
 */

import type { RedisClient } from '@cat-cafe/shared/utils';
import { RedisCoordinatorKickoffStore } from '../redis/RedisCoordinatorKickoffStore.js';
import { InMemoryCoordinatorKickoffStore, type ICoordinatorKickoffStore } from '../ports/CoordinatorKickoffStore.js';

export function createCoordinatorKickoffStore(redis: RedisClient | null | undefined): ICoordinatorKickoffStore {
  if (redis) return new RedisCoordinatorKickoffStore(redis);
  return new InMemoryCoordinatorKickoffStore();
}
