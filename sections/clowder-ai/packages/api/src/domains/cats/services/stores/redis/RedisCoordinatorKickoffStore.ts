/**
 * Redis Coordinator Kickoff Store
 *
 * Persists CoordinatorKickoff in Redis as a single JSON blob per coordinationId.
 * The kickoff is short-lived (UI dismisses after accept/decline), so we keep the
 * schema simple — no set index, no TTL by default.
 *
 * Data structures:
 * - String kickoff:{coordinationId} — JSON-encoded CoordinatorKickoff
 */

import type { CoordinatorKickoff } from '@cat-cafe/shared';
import type { RedisClient } from '@cat-cafe/shared/utils';
import type {
  ICoordinatorKickoffStore,
} from '../ports/CoordinatorKickoffStore.js';

export const KickoffKeys = {
  detail: (coordinationId: string) => `kickoff:${coordinationId}`,
} as const;

export class RedisCoordinatorKickoffStore implements ICoordinatorKickoffStore {
  private readonly redis: RedisClient;

  constructor(redis: RedisClient) {
    this.redis = redis;
  }

  async put(kickoff: CoordinatorKickoff): Promise<void> {
    await this.redis.set(
      KickoffKeys.detail(kickoff.coordinationId),
      JSON.stringify(kickoff),
    );
  }

  async get(coordinationId: string): Promise<CoordinatorKickoff | null> {
    const raw = await this.redis.get(KickoffKeys.detail(coordinationId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CoordinatorKickoff;
    } catch {
      return null;
    }
  }

  async delete(coordinationId: string): Promise<boolean> {
    const removed = await this.redis.del(KickoffKeys.detail(coordinationId));
    return removed > 0;
  }

  async list(): Promise<CoordinatorKickoff[]> {
    // SCAN over kickoff:* — keep the set small in practice (one per active coordination).
    const keys = await this.scanAll();
    if (keys.length === 0) return [];
    const values = await this.redis.mget(keys);
    const result: CoordinatorKickoff[] = [];
    for (const raw of values) {
      if (!raw) continue;
      try {
        result.push(JSON.parse(raw) as CoordinatorKickoff);
      } catch {
        // skip malformed entry
      }
    }
    return result;
  }

  private async scanAll(): Promise<string[]> {
    const found: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        `${KickoffKeys.detail('*')}`,
        'COUNT',
        100,
      );
      found.push(...batch);
      cursor = next;
    } while (cursor !== '0');
    return found;
  }
}
