import type { RedisClient } from '@cat-cafe/shared/utils';
import type { IManualContextPinStore } from '../ports/ManualContextPinStore.js';
import { ManualContextPinStore } from '../ports/ManualContextPinStore.js';
import { RedisManualContextPinStore } from '../redis/RedisManualContextPinStore.js';

export function createManualContextPinStore(redis?: RedisClient): IManualContextPinStore {
  if (redis) return new RedisManualContextPinStore(redis);
  return new ManualContextPinStore();
}
