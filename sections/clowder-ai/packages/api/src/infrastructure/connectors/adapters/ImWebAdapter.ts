import crypto from 'node:crypto';
import type { RichBlock } from '@cat-cafe/shared';
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
  readonly metadata?: Record<string, unknown>;
}

export class ImWebAdapter implements IStreamableOutboundAdapter {
  readonly connectorId = 'im-web';
  private readonly now: () => number;

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
    await this.deliver({
      connectorId: this.connectorId,
      externalChatId,
      content,
      format: 'markdown',
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
    await this.deliver({
      connectorId: this.connectorId,
      externalChatId,
      content: textContent,
      format: 'markdown',
      richBlocks: blocks,
      catDisplayName,
      metadata,
    });
  }

  async sendFormattedReply(
    externalChatId: string,
    envelope: MessageEnvelope,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.deliver({
      connectorId: this.connectorId,
      externalChatId,
      content: envelope.body,
      format: 'markdown',
      metadata,
    });
  }

  async sendPlaceholder(externalChatId: string, text: string): Promise<string> {
    const platformMessageId = `im-web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.deliver({
      connectorId: this.connectorId,
      externalChatId,
      content: text,
      format: 'markdown',
      stream: { state: 'placeholder', platformMessageId },
    });
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
}
