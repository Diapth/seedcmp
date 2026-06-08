import type { RedisClient } from '@cat-cafe/shared/utils';
import {
  isActiveManualContextPinStatus,
  type IManualContextPinStore,
  type ManualContextPin,
  type ManualContextPinInput,
  type ManualContextPinListOptions,
  type ManualContextPinStatus,
  normalizeManualContextPinLimit,
} from '../ports/ManualContextPinStore.js';
import { generateSortableId } from '../ports/MessageStore.js';
import { ManualContextPinKeys } from '../redis-keys/manual-context-pin-keys.js';

const DEFAULT_ACTIVE_LIMIT = 5;

export class RedisManualContextPinStore implements IManualContextPinStore {
  constructor(private readonly redis: RedisClient) {}

  async upsert(input: ManualContextPinInput): Promise<ManualContextPin> {
    const now = new Date().toISOString();
    const subjectKey = ManualContextPinKeys.subject(input.threadId, input.userId, input.messageId);
    const existingId = await this.redis.get(subjectKey);
    const existing = existingId ? await this.get(existingId) : null;
    const id = existing?.id ?? input.id ?? generateSortableId(Date.now());
    const pin: ManualContextPin = {
      ...existing,
      ...input,
      id,
      pinnedAt: existing?.pinnedAt ?? input.pinnedAt ?? now,
      updatedAt: now,
      status: input.status ?? 'active',
      removedAt: input.status === 'removed' ? input.removedAt ?? existing?.removedAt ?? now : undefined,
      removedBy: input.status === 'removed' ? input.removedBy ?? existing?.removedBy : undefined,
    };

    const pipeline = this.redis.multi();
    pipeline.hset(ManualContextPinKeys.detail(id), this.serialize(pin));
    pipeline.set(subjectKey, id);
    pipeline.zadd(ManualContextPinKeys.threadUser(pin.threadId, pin.userId), String(Date.parse(pin.updatedAt)), id);
    await pipeline.exec();
    return pin;
  }

  async list(threadId: string, options: ManualContextPinListOptions = {}): Promise<ManualContextPin[]> {
    if (!options.userId) return [];
    const limit = options.limit ? normalizeManualContextPinLimit(options.limit, Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
    const ids = await this.redis.zrevrange(ManualContextPinKeys.threadUser(threadId, options.userId), 0, -1);
    if (ids.length === 0) return [];
    const pipeline = this.redis.multi();
    for (const id of ids) {
      pipeline.hgetall(ManualContextPinKeys.detail(id));
    }
    const results = await pipeline.exec();
    if (!results) return [];

    const pins: ManualContextPin[] = [];
    for (const [err, data] of results) {
      if (err || !data || typeof data !== 'object') continue;
      const record = data as Record<string, string>;
      if (!record.id) continue;
      const pin = this.hydrate(record);
      if (!options.includeInactive && !isActiveManualContextPinStatus(pin.status)) continue;
      pins.push(pin);
      if (pins.length >= limit) break;
    }
    return pins;
  }

  async listActive(threadId: string, options: Omit<ManualContextPinListOptions, 'includeInactive'> = {}): Promise<ManualContextPin[]> {
    return this.list(threadId, {
      ...options,
      includeInactive: false,
      limit: normalizeManualContextPinLimit(options.limit, DEFAULT_ACTIVE_LIMIT),
    });
  }

  async markRemoved(threadId: string, pinId: string, removedBy: string, userId?: string): Promise<ManualContextPin | null> {
    const existing = await this.get(pinId);
    if (!existing || existing.threadId !== threadId) return null;
    if (userId && existing.userId !== userId) return null;
    const now = new Date().toISOString();
    const updated: ManualContextPin = {
      ...existing,
      status: 'removed',
      removedAt: now,
      removedBy,
      updatedAt: now,
    };
    await this.write(updated);
    return updated;
  }

  async markSourceStatus(
    threadId: string,
    messageId: string,
    status: ManualContextPinStatus,
    userId?: string,
  ): Promise<ManualContextPin[]> {
    if (!userId) return [];
    const pins = await this.list(threadId, { userId, includeInactive: true });
    const matches = pins.filter((pin) => pin.messageId === messageId);
    const now = new Date().toISOString();
    const updated: ManualContextPin[] = [];
    for (const pin of matches) {
      const next: ManualContextPin = {
        ...pin,
        status,
        updatedAt: now,
        sourceStatusUpdatedAt: now,
        sourceStatusUpdatedBy: userId,
      };
      await this.write(next);
      updated.push(next);
    }
    return updated;
  }

  private async get(id: string): Promise<ManualContextPin | null> {
    const data = await this.redis.hgetall(ManualContextPinKeys.detail(id));
    if (!data || !data.id) return null;
    return this.hydrate(data);
  }

  private async write(pin: ManualContextPin): Promise<void> {
    const pipeline = this.redis.multi();
    pipeline.hset(ManualContextPinKeys.detail(pin.id), this.serialize(pin));
    pipeline.zadd(ManualContextPinKeys.threadUser(pin.threadId, pin.userId), String(Date.parse(pin.updatedAt)), pin.id);
    await pipeline.exec();
  }

  private serialize(pin: ManualContextPin): Record<string, string> {
    const data: Record<string, string> = {
      id: pin.id,
      threadId: pin.threadId,
      userId: pin.userId,
      channelId: pin.channelId,
      channelType: String(pin.channelType),
      messageId: pin.messageId,
      contentExcerpt: pin.contentExcerpt,
      pinnedBy: pin.pinnedBy,
      pinnedAt: pin.pinnedAt,
      updatedAt: pin.updatedAt,
      status: pin.status,
    };
    if (pin.messageSeq !== undefined) data.messageSeq = String(pin.messageSeq);
    if (pin.clientMsgNo) data.clientMsgNo = pin.clientMsgNo;
    if (pin.senderName) data.senderName = pin.senderName;
    if (pin.removedAt) data.removedAt = pin.removedAt;
    if (pin.removedBy) data.removedBy = pin.removedBy;
    if (pin.sourceStatusUpdatedAt) data.sourceStatusUpdatedAt = pin.sourceStatusUpdatedAt;
    if (pin.sourceStatusUpdatedBy) data.sourceStatusUpdatedBy = pin.sourceStatusUpdatedBy;
    return data;
  }

  private hydrate(data: Record<string, string>): ManualContextPin {
    return {
      id: data.id ?? '',
      threadId: data.threadId ?? '',
      userId: data.userId ?? '',
      channelId: data.channelId ?? '',
      channelType: Number(data.channelType ?? 0),
      messageId: data.messageId ?? '',
      ...(data.messageSeq ? { messageSeq: Number(data.messageSeq) } : {}),
      ...(data.clientMsgNo ? { clientMsgNo: data.clientMsgNo } : {}),
      contentExcerpt: data.contentExcerpt ?? '',
      ...(data.senderName ? { senderName: data.senderName } : {}),
      pinnedBy: data.pinnedBy ?? data.userId ?? '',
      pinnedAt: data.pinnedAt ?? new Date(0).toISOString(),
      updatedAt: data.updatedAt ?? data.pinnedAt ?? new Date(0).toISOString(),
      status: (data.status ?? 'active') as ManualContextPinStatus,
      ...(data.removedAt ? { removedAt: data.removedAt } : {}),
      ...(data.removedBy ? { removedBy: data.removedBy } : {}),
      ...(data.sourceStatusUpdatedAt ? { sourceStatusUpdatedAt: data.sourceStatusUpdatedAt } : {}),
      ...(data.sourceStatusUpdatedBy ? { sourceStatusUpdatedBy: data.sourceStatusUpdatedBy } : {}),
    };
  }
}
