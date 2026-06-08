import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type {
  IManualContextPinStore,
  ManualContextPinInput,
  ManualContextPinListOptions,
  ManualContextPinStatus,
} from '../domains/cats/services/stores/ports/ManualContextPinStore.js';
import { normalizeManualContextPinLimit } from '../domains/cats/services/stores/ports/ManualContextPinStore.js';
import { resolveUserId } from '../utils/request-identity.js';

export interface ManualContextPinsRoutesOptions {
  manualContextPinStore: IManualContextPinStore;
  defaultUserId?: string;
}

interface RouteParams {
  threadId?: string;
  pinId?: string;
}

interface ManualContextPinBody {
  channelId?: string;
  channel_id?: string;
  channelType?: number;
  channel_type?: number;
  messageId?: string;
  message_id?: string;
  messageSeq?: number;
  message_seq?: number;
  clientMsgNo?: string;
  client_msg_no?: string;
  contentExcerpt?: string;
  content_excerpt?: string;
  senderName?: string;
  sender_name?: string;
  pinnedBy?: string;
  pinned_by?: string;
  status?: string;
  userId?: string;
  user_id?: string;
}

function threadIdFromParams(request: FastifyRequest): string {
  return String((request.params as RouteParams | undefined)?.threadId ?? '').trim();
}

function pinIdFromParams(request: FastifyRequest): string {
  return String((request.params as RouteParams | undefined)?.pinId ?? '').trim();
}

function nonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function includeInactiveFromQuery(value: unknown): boolean {
  return value === true || value === '1' || value === 'true' || value === 'yes';
}

function sourceStatusFromBody(value: unknown): Extract<ManualContextPinStatus, 'source_deleted' | 'permission_denied'> | '' {
  if (value === 'source_deleted' || value === 'permission_denied') return value;
  return '';
}

function buildPinInput(threadId: string, userId: string, body: ManualContextPinBody): ManualContextPinInput | null {
  const channelId = nonEmptyString(body.channelId ?? body.channel_id);
  const channelType = optionalNumber(body.channelType ?? body.channel_type) ?? 0;
  const messageId = nonEmptyString(body.messageId ?? body.message_id);
  const contentExcerpt = nonEmptyString(body.contentExcerpt ?? body.content_excerpt);
  if (!threadId || !messageId || !contentExcerpt) return null;

  const senderName = nonEmptyString(body.senderName ?? body.sender_name);
  const pinnedBy = nonEmptyString(body.pinnedBy ?? body.pinned_by) || userId;
  const messageSeq = optionalNumber(body.messageSeq ?? body.message_seq);
  const clientMsgNo = nonEmptyString(body.clientMsgNo ?? body.client_msg_no);

  return {
    threadId,
    userId,
    channelId,
    channelType,
    messageId,
    ...(messageSeq !== undefined ? { messageSeq } : {}),
    ...(clientMsgNo ? { clientMsgNo } : {}),
    contentExcerpt,
    ...(senderName ? { senderName } : {}),
    pinnedBy,
    status: 'active',
  };
}

export const manualContextPinsRoutes: FastifyPluginAsync<ManualContextPinsRoutesOptions> = async (app, opts) => {
  app.post<{ Params: RouteParams; Body: ManualContextPinBody }>('/api/threads/:threadId/manual-context-pins', async (request, reply) => {
    const threadId = threadIdFromParams(request);
    if (!threadId) return reply.status(400).send({ error: 'threadId is required' });
    const body = request.body ?? {};
    const userId = resolveUserId(request, {
      fallbackUserId: body.userId ?? body.user_id ?? body.pinnedBy ?? body.pinned_by,
      ...(opts.defaultUserId ? { defaultUserId: opts.defaultUserId } : {}),
    });
    if (!userId) return reply.status(401).send({ error: 'user identity is required' });

    const input = buildPinInput(threadId, userId, body);
    if (!input) {
      return reply.status(400).send({ error: 'threadId, messageId, and contentExcerpt are required' });
    }

    const existing = await Promise.resolve(opts.manualContextPinStore.list(threadId, {
      userId,
      includeInactive: true,
    }));
    const existed = existing.some((pin) => pin.messageId === input.messageId);
    const pin = await Promise.resolve(opts.manualContextPinStore.upsert(input));
    return reply.status(existed ? 200 : 201).send({ pin });
  });

  app.get<{ Params: RouteParams }>('/api/threads/:threadId/manual-context-pins', async (request, reply) => {
    const threadId = threadIdFromParams(request);
    if (!threadId) return reply.status(400).send({ error: 'threadId is required' });
    const userId = resolveUserId(request, opts.defaultUserId ? { defaultUserId: opts.defaultUserId } : undefined);
    if (!userId) return reply.status(401).send({ error: 'user identity is required' });

    const query = request.query as { limit?: unknown; includeInactive?: unknown } | undefined;
    const includeInactive = includeInactiveFromQuery(query?.includeInactive);
    const options: ManualContextPinListOptions = {
      userId,
      includeInactive,
      limit: normalizeManualContextPinLimit(query?.limit, 5),
    };
    const pins = includeInactive
      ? await Promise.resolve(opts.manualContextPinStore.list(threadId, options))
      : await Promise.resolve(opts.manualContextPinStore.listActive(threadId, options));
    return reply.send({ threadId, pins });
  });

  app.patch<{ Params: RouteParams; Body: ManualContextPinBody }>(
    '/api/threads/:threadId/manual-context-pins/source-status',
    async (request, reply) => {
      const threadId = threadIdFromParams(request);
      if (!threadId) return reply.status(400).send({ error: 'threadId is required' });
      const body = request.body ?? {};
      const userId = resolveUserId(request, {
        fallbackUserId: body.userId ?? body.user_id,
        ...(opts.defaultUserId ? { defaultUserId: opts.defaultUserId } : {}),
      });
      if (!userId) return reply.status(401).send({ error: 'user identity is required' });

      const messageId = nonEmptyString(body.messageId ?? body.message_id);
      const status = sourceStatusFromBody(body.status);
      if (!messageId || !status) {
        return reply.status(400).send({ error: 'messageId and source status are required' });
      }

      const pins = await Promise.resolve(opts.manualContextPinStore.markSourceStatus(threadId, messageId, status, userId));
      return reply.send({ threadId, pins });
    },
  );

  app.delete<{ Params: RouteParams }>('/api/threads/:threadId/manual-context-pins/:pinId', async (request, reply) => {
    const threadId = threadIdFromParams(request);
    const pinId = pinIdFromParams(request);
    if (!threadId || !pinId) return reply.status(400).send({ error: 'threadId and pinId are required' });
    const userId = resolveUserId(request, opts.defaultUserId ? { defaultUserId: opts.defaultUserId } : undefined);
    if (!userId) return reply.status(401).send({ error: 'user identity is required' });
    await Promise.resolve(opts.manualContextPinStore.markRemoved(threadId, pinId, userId, userId));
    return reply.status(204).send();
  });
};
