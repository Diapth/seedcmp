import type { RedisClient } from '@cat-cafe/shared/utils';
import { InMemoryCoordinatorStore, type ICoordinatorStore } from '../ports/CoordinatorStore.js';
import { RedisCoordinatorStore } from '../redis/RedisCoordinatorStore.js';

export function createCoordinatorStore(redis: RedisClient | null | undefined): ICoordinatorStore {
  if (redis) return new RedisCoordinatorStore(redis);
  return new InMemoryCoordinatorStore();
}
