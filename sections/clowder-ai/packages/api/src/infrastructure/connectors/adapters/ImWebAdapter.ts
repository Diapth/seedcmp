import crypto from 'node:crypto';
import { catRegistry, type RichBlock } from '@cat-cafe/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { MessageEnvelope } from '../ConnectorMessageFormatter.js';
import type { IStreamableOutboundAdapter } from '../OutboundDeliveryHook.js';

export interface ImWebAdapterOptions {
  readonly outboundCallbackUrl?: string;
  readonly connectorSecret?: string;
  readonly requestTimeoutMs?: number;
  readonly now?: () => number;
}

export interface ImWebOutboundPayload {
  readonly connectorId: 'im-web';
  readonly externalChatId: string;
  readonly threadId?: string;
  readonly invocationId?: string;
  readonly catId?: string;
  readonly catDisplayName?: string;
  readonly content: string;
  readonly format: 'text' | 'markdown';
  readonly richBlocks?: RichBlock[];
  readonly media?: {
    readonly type: 'image' | 'file' | 'audio';
    readonly url?: string;
    readonly absPath?: string;
    readonly fileName?: string;
    readonly size?: number;
    readonly alt?: string;
    readonly text?: string;
  };
  readonly origin?: Record<string, unknown>;
  readonly stream?: {
    readonly state: 'placeholder' | 'chunk' | 'final' | 'cleanup';
    readonly platformMessageId?: string;
  };
  readonly reaction?: {
    readonly platformMessageId: string;
    readonly emoji: string;
    readonly emojiType?: string;
  };
  readonly metadata?: Record<string, unknown>;
}

export class ImWebAdapter implements IStreamableOutboundAdapter {
  readonly connectorId = 'im-web';
  private readonly now: () => number;
  private readonly inlinePlaceholders = new Map<string, string[]>();

  constructor(
    private readonly log: FastifyBaseLogger,
    private readonly options: ImWebAdapterOptions = {},
  ) {
    this.now = options.now ?? Date.now;
  }

  isConfigured(): boolean {
    return Boolean(this.options.outboundCallbackUrl && this.options.connectorSecret);
  }

  async sendReply(externalChatId: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
    const inlinePlatformMessageId = this.consumeInlinePlaceholder(externalChatId);
    const identity = resolveCatIdentity(metadata);
    await this.deliver({
      connectorId: this.connectorId,
      externalChatId,
      ...identity,
      content,
      format: 'markdown',
      ...(inlinePlatformMessageId
        ? { stream: { state: 'final' as const, platformMessageId: inlinePlatformMessageId } }
        : {}),
      metadata,
    });
  }

  async sendRichMessage(
    externalChatId: string,
    textContent: string,
    blocks: RichBlock[],
    catDisplayName: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const inlinePlatformMessageId = this.consumeInlinePlaceholder(externalChatId);
    const identity = resolveCatIdentity(metadata, { catDisplayName });
    await this.deliver({
      connectorId: this.connectorId,
      externalChatId,
      ...identity,
      content: textContent,
      format: 'markdown',
      richBlocks: blocks,
      ...(inlinePlatformMessageId
        ? { stream: { state: 'final' as const, platformMessageId: inlinePlatformMessageId } }
        : {}),
      metadata,
    });
  }

  async sendFormattedReply(
    externalChatId: string,
    envelope: MessageEnvelope,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const inlinePlatformMessageId = this.consumeInlinePlaceholder(externalChatId);
    const identity = resolveCatIdentity(metadata);
    await this.deliver({
      connectorId: this.connectorId,
      externalChatId,
      ...identity,
      content: envelope.body,
      format: 'markdown',
      ...(inlinePlatformMessageId
        ? { stream: { state: 'final' as const, platformMessageId: inlinePlatformMessageId } }
        : {}),
      metadata,
    });
  }

  async sendPlaceholder(externalChatId: string, text: string): Promise<string> {
    const platformMessageId = `im-web-${this.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.log.info(
      { externalChatId, textLen: text.length, platformMessageId },
      '[ImWebAdapter] stream placeholder reserved without visible message',
    );
    return platformMessageId;
  }

  async editMessage(externalChatId: string, platformMessageId: string, text: string): Promise<void> {
    await this.deliver({
      connectorId: this.connectorId,
      externalChatId,
      content: text,
      format: 'markdown',
      stream: { state: 'chunk', platformMessageId },
    });
  }

  async finalizeStreamCard(externalChatId: string, platformMessageId: string, catDisplayName: string): Promise<void> {
    await this.deliver({
      connectorId: this.connectorId,
      externalChatId,
      content: '',
      format: 'markdown',
      catDisplayName,
      stream: { state: 'cleanup', platformMessageId },
    });
  }

  registerInlinePlaceholder(externalChatId: string, platformMessageId: string): void {
    if (!platformMessageId) return;
    const queue = this.inlinePlaceholders.get(externalChatId) ?? [];
    queue.push(platformMessageId);
    this.inlinePlaceholders.set(externalChatId, queue);
  }

  async clearInlinePlaceholder(chatId: string, platformMessageId?: string): Promise<void> {
    const queue = this.inlinePlaceholders.get(chatId);
    if (!queue) return;
    const next = platformMessageId ? queue.filter((id) => id !== platformMessageId) : [];
    if (next.length) {
      this.inlinePlaceholders.set(chatId, next);
    } else {
      this.inlinePlaceholders.delete(chatId);
    }
  }

  async addReaction(platformMessageId: string, emojiType: string, externalChatId?: string): Promise<void> {
    if (!platformMessageId) return;
    if (!externalChatId) {
      this.log.warn({ platformMessageId }, '[ImWebAdapter] addReaction skipped without externalChatId');
      return;
    }
    await this.deliver({
      connectorId: this.connectorId,
      externalChatId,
      content: '',
      format: 'markdown',
      reaction: {
        platformMessageId,
        emoji: emojiFromType(emojiType),
        emojiType,
      },
    });
  }

  async sendMedia(
    externalChatId: string,
    payload: { type: 'image' | 'file' | 'audio'; [key: string]: unknown },
  ): Promise<void> {
    const catId = typeof payload.catId === 'string' ? payload.catId : undefined;
    const catDisplayName = typeof payload.catDisplayName === 'string' ? payload.catDisplayName : undefined;
    const fileName = typeof payload.fileName === 'string' ? payload.fileName : undefined;
    const alt = typeof payload.alt === 'string' ? payload.alt : undefined;
    const text = typeof payload.text === 'string' ? payload.text : undefined;
    const url = typeof payload.url === 'string' ? payload.url : undefined;
    const absPath = typeof payload.absPath === 'string' ? payload.absPath : undefined;
    const size = typeof payload.size === 'number' ? payload.size : undefined;
    const metadata = payload.metadata && typeof payload.metadata === 'object'
      ? payload.metadata as Record<string, unknown>
      : undefined;
    await this.deliver({
      connectorId: this.connectorId,
      externalChatId,
      ...(catId ? { catId } : {}),
      ...(catDisplayName ? { catDisplayName } : {}),
      content: alt || text || fileName || (payload.type === 'image' ? '图片' : '文件'),
      format: 'markdown',
      media: {
        type: payload.type,
        ...(url ? { url } : {}),
        ...(absPath ? { absPath } : {}),
        ...(fileName ? { fileName } : {}),
        ...(size ? { size } : {}),
        ...(alt ? { alt } : {}),
        ...(text ? { text } : {}),
      },
      ...(metadata ? { metadata } : {}),
    });
  }

  private async deliver(payload: ImWebOutboundPayload): Promise<void> {
    if (!this.isConfigured()) {
      this.log.warn({ externalChatId: payload.externalChatId }, '[ImWebAdapter] outbound callback not configured');
      return;
    }

    const rawBody = JSON.stringify(payload);
    const timestamp = String(this.now());
    const signature = crypto
      .createHmac('sha256', this.options.connectorSecret!)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.requestTimeoutMs ?? 5000);

    try {
      const response = await fetch(this.options.outboundCallbackUrl!, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-clowder-signature': signature,
          'x-clowder-timestamp': timestamp,
        },
        body: rawBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => '');
        throw new Error(`IM Web outbound callback failed: ${response.status} ${response.statusText} ${responseText}`);
      }

      this.log.info(
        { externalChatId: payload.externalChatId, streamState: payload.stream?.state },
        '[ImWebAdapter] outbound delivery sent',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private consumeInlinePlaceholder(externalChatId: string): string | undefined {
    const queue = this.inlinePlaceholders.get(externalChatId);
    if (!queue || queue.length === 0) return undefined;
    const platformMessageId = queue.shift();
    if (queue.length === 0) {
      this.inlinePlaceholders.delete(externalChatId);
    } else {
      this.inlinePlaceholders.set(externalChatId, queue);
    }
    return platformMessageId;
  }
}

function emojiFromType(emojiType: string): string {
  const normalized = String(emojiType || '').trim().toUpperCase();
  const map: Record<string, string> = {
    HEART: '❤️',
    THUMBSUP: '👍',
    THUMBS_UP: '👍',
    EYES: '👀',
    CHECK: '✅',
    THINKING: '🤔',
  };
  return map[normalized] ?? emojiType;
}

function resolveCatIdentity(
  metadata?: Record<string, unknown>,
  fallback: { catId?: string; catDisplayName?: string } = {},
): { catId?: string; catDisplayName?: string } {
  const catId = firstString(metadata?.catId, metadata?.cat_id, fallback.catId);
  const catDisplayName = firstString(
    metadata?.catDisplayName,
    metadata?.cat_display_name,
    fallback.catDisplayName,
    catId ? catRegistry.tryGet(catId)?.config.displayName : undefined,
  );
  return {
    ...(catId ? { catId } : {}),
    ...(catDisplayName ? { catDisplayName } : {}),
  };
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}
