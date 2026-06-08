import { generateSortableId } from './MessageStore.js';

export type ManualContextPinStatus = 'active' | 'removed' | 'source_deleted' | 'permission_denied';

export interface ManualContextPin {
  id: string;
  threadId: string;
  userId: string;
  channelId: string;
  channelType: number;
  messageId: string;
  messageSeq?: number;
  clientMsgNo?: string;
  contentExcerpt: string;
  senderName?: string;
  pinnedBy: string;
  pinnedAt: string;
  updatedAt: string;
  status: ManualContextPinStatus;
  removedAt?: string;
  removedBy?: string;
  sourceStatusUpdatedAt?: string;
  sourceStatusUpdatedBy?: string;
}

export type ManualContextPinInput = Omit<ManualContextPin, 'id' | 'pinnedAt' | 'updatedAt'> & {
  id?: string;
  pinnedAt?: string;
  updatedAt?: string;
};

export type ManualContextPinSummary = Pick<
  ManualContextPin,
  'id' | 'messageId' | 'contentExcerpt' | 'senderName' | 'pinnedBy' | 'pinnedAt' | 'status'
>;

export interface ManualContextPinListOptions {
  userId?: string;
  limit?: number;
  includeInactive?: boolean;
}

export interface IManualContextPinStore {
  upsert(pin: ManualContextPinInput): ManualContextPin | Promise<ManualContextPin>;
  list(threadId: string, options?: ManualContextPinListOptions): ManualContextPin[] | Promise<ManualContextPin[]>;
  listActive(threadId: string, options?: Omit<ManualContextPinListOptions, 'includeInactive'>): ManualContextPin[] | Promise<ManualContextPin[]>;
  markRemoved(threadId: string, pinId: string, removedBy: string, userId?: string): ManualContextPin | null | Promise<ManualContextPin | null>;
  markSourceStatus(
    threadId: string,
    messageId: string,
    status: ManualContextPinStatus,
    userId?: string,
  ): ManualContextPin[] | Promise<ManualContextPin[]>;
}

const DEFAULT_ACTIVE_LIMIT = 5;

export function isActiveManualContextPinStatus(status: ManualContextPinStatus): boolean {
  return status === 'active';
}

export function normalizeManualContextPinLimit(limit: unknown, fallback = DEFAULT_ACTIVE_LIMIT): number {
  const parsed = typeof limit === 'number' ? limit : Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.min(50, Math.trunc(parsed)));
}

export class ManualContextPinStore implements IManualContextPinStore {
  private readonly pinsById = new Map<string, ManualContextPin>();
  private readonly pinIdBySubject = new Map<string, string>();

  upsert(input: ManualContextPinInput): ManualContextPin {
    const now = new Date().toISOString();
    const subject = this.subjectKey(input.threadId, input.userId, input.messageId);
    const existingId = this.pinIdBySubject.get(subject);
    const existing = existingId ? this.pinsById.get(existingId) : null;
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

    this.pinsById.set(id, pin);
    this.pinIdBySubject.set(subject, id);
    return pin;
  }

  list(threadId: string, options: ManualContextPinListOptions = {}): ManualContextPin[] {
    const limit = options.limit ? normalizeManualContextPinLimit(options.limit, Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
    const pins = [...this.pinsById.values()]
      .filter((pin) => pin.threadId === threadId)
      .filter((pin) => !options.userId || pin.userId === options.userId)
      .filter((pin) => options.includeInactive || isActiveManualContextPinStatus(pin.status))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return pins.slice(0, limit);
  }

  listActive(threadId: string, options: Omit<ManualContextPinListOptions, 'includeInactive'> = {}): ManualContextPin[] {
    return this.list(threadId, {
      ...options,
      includeInactive: false,
      limit: normalizeManualContextPinLimit(options.limit, DEFAULT_ACTIVE_LIMIT),
    });
  }

  markRemoved(threadId: string, pinId: string, removedBy: string, userId?: string): ManualContextPin | null {
    const existing = this.pinsById.get(pinId);
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
    this.pinsById.set(pinId, updated);
    return updated;
  }

  markSourceStatus(
    threadId: string,
    messageId: string,
    status: ManualContextPinStatus,
    userId?: string,
  ): ManualContextPin[] {
    const now = new Date().toISOString();
    const updated: ManualContextPin[] = [];
    for (const pin of this.pinsById.values()) {
      if (pin.threadId !== threadId || pin.messageId !== messageId) continue;
      if (userId && pin.userId !== userId) continue;
      const next: ManualContextPin = {
        ...pin,
        status,
        updatedAt: now,
        sourceStatusUpdatedAt: now,
        ...(userId ? { sourceStatusUpdatedBy: userId } : {}),
      };
      this.pinsById.set(pin.id, next);
      updated.push(next);
    }
    return updated;
  }

  private subjectKey(threadId: string, userId: string, messageId: string): string {
    return `${threadId}\u0000${userId}\u0000${messageId}`;
  }
}
