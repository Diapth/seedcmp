import type { RedisClient } from '@cat-cafe/shared/utils';
import {
  coordinationIdempotencyKey,
  InMemoryCoordinatorStore,
  type CoordinationRecord,
  type CreateCoordinationInput,
} from '../ports/CoordinatorStore.js';

export const CoordinationKeys = {
  detail: (coordinationId: string) => `coordination:${coordinationId}`,
  thread: (threadId: string) => `coordinations:thread:${threadId}`,
  idempotency: (key: string) => `coordination:idempotency:${key}`,
} as const;

export class RedisCoordinatorStore extends InMemoryCoordinatorStore {
  constructor(private readonly redis: RedisClient) {
    super();
  }

  override async create(input: CreateCoordinationInput): Promise<{ coordination: CoordinationRecord; created: boolean }> {
    const idempotencyKey = coordinationIdempotencyKey(input);
    if (idempotencyKey) {
      const existingId = await this.redis.get(CoordinationKeys.idempotency(idempotencyKey));
      const existing = existingId ? await this.get(existingId) : null;
      if (existing) return { coordination: existing, created: false };
    }
    return super.create(input);
  }

  override async get(coordinationId: string): Promise<CoordinationRecord | null> {
    const raw = await this.redis.get(CoordinationKeys.detail(coordinationId));
    if (!raw) return super.get(coordinationId);
    try {
      const parsed = JSON.parse(raw) as CoordinationRecord;
      await super.put(parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  override async listByThread(threadId: string): Promise<CoordinationRecord[]> {
    const ids = await this.redis.smembers(CoordinationKeys.thread(threadId));
    const records: CoordinationRecord[] = [];
    for (const id of ids) {
      const record = await this.get(id);
      if (record) records.push(record);
    }
    return records.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  protected override async put(coordination: CoordinationRecord, idempotencyKey?: string | null): Promise<void> {
    await super.put(coordination, idempotencyKey);
    const pipeline = this.redis.multi();
    pipeline.set(CoordinationKeys.detail(coordination.coordinationId), JSON.stringify(coordination));
    pipeline.sadd(CoordinationKeys.thread(coordination.threadId), coordination.coordinationId);
    if (idempotencyKey) {
      pipeline.set(CoordinationKeys.idempotency(idempotencyKey), coordination.coordinationId);
    }
    await pipeline.exec();
  }
}
