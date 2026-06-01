import crypto from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { ConnectorWebhookHandler, WebhookHandleResult } from '../../routes/connector-webhooks.js';
import type { ConnectorRouter } from './ConnectorRouter.js';

export interface ImWebInboundHandlerOptions {
  readonly connectorSecret?: string;
  readonly router: ConnectorRouter;
  readonly now?: () => number;
  readonly signatureToleranceMs?: number;
  readonly log: FastifyBaseLogger;
}

interface ImWebInboundPayload {
  readonly connectorId: 'im-web';
  readonly externalChatId: string;
  readonly channelId: string;
  readonly channelType: number;
  readonly chatType?: 'direct' | 'group';
  readonly chatName?: string;
  readonly messageId?: string;
  readonly clientMsgNo?: string;
  readonly text?: string;
  readonly timestamp?: number;
  readonly sender?: {
    readonly id: string;
    readonly name?: string;
  };
  readonly sourceRoleSnapshot?: Record<string, unknown>;
  readonly attachments?: Array<{
    readonly type: 'image' | 'file' | 'audio';
    readonly url?: string;
    readonly fileName?: string;
    readonly size?: number;
  }>;
}

function signBody(rawBody: Buffer, secret: string, timestamp: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export class ImWebInboundHandler implements ConnectorWebhookHandler {
  readonly connectorId = 'im-web';
  private readonly now: () => number;
  private readonly signatureToleranceMs: number;

  constructor(private readonly options: ImWebInboundHandlerOptions) {
    this.now = options.now ?? Date.now;
    this.signatureToleranceMs = options.signatureToleranceMs ?? 300_000;
  }

  async handleWebhook(
    body: unknown,
    headers: Record<string, string>,
    rawBodyOrQuery?: Buffer | Record<string, string>,
  ): Promise<WebhookHandleResult> {
    const rawBody = Buffer.isBuffer(rawBodyOrQuery) ? rawBodyOrQuery : Buffer.from(JSON.stringify(body ?? {}));
    if (!this.verifySignature(rawBody, headers)) {
      return { kind: 'error', status: 401, message: 'invalid_signature' };
    }

    const payload = body as Partial<ImWebInboundPayload>;
    if (payload.connectorId !== 'im-web' || !payload.externalChatId) {
      return { kind: 'error', status: 400, message: 'invalid_payload' };
    }

    const messageId = payload.messageId ?? payload.clientMsgNo;
    if (!messageId) {
      return { kind: 'error', status: 400, message: 'missing_message_id' };
    }

    const result = await this.options.router.route(
      'im-web',
      payload.externalChatId,
      payload.text ?? '',
      messageId,
      payload.attachments?.map((attachment) => ({
        type: attachment.type,
        platformKey: attachment.url ?? '',
        ...(attachment.fileName ? { fileName: attachment.fileName } : {}),
      })),
      payload.sender?.id
        ? {
            id: payload.sender.id,
            ...(payload.sender.name ? { name: payload.sender.name } : {}),
            ...(payload.sourceRoleSnapshot ? { role: payload.sourceRoleSnapshot } : {}),
          }
        : undefined,
      payload.chatType === 'group' ? 'group' : 'p2p',
      payload.chatName,
    );

    if (result.kind === 'routed') return result;
    if (result.kind === 'skipped') return result;
    return { kind: 'processed', messageId: result.messageId };
  }

  private verifySignature(rawBody: Buffer, headers: Record<string, string>): boolean {
    const secret = this.options.connectorSecret;
    const signature = headers['x-im-web-signature'];
    const timestamp = headers['x-im-web-timestamp'];
    if (!secret || !signature || !timestamp) return false;

    const millis = Number(timestamp);
    if (!Number.isFinite(millis)) return false;
    if (Math.abs(this.now() - millis) > this.signatureToleranceMs) return false;

    const expected = signBody(rawBody, secret, timestamp);
    return timingSafeEqualHex(expected, signature);
  }
}
