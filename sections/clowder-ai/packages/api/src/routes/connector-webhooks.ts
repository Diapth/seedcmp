/**
 * Connector Webhook Routes
 * POST /api/connectors/:connectorId/webhook — Generic webhook entry point
 *
 * Receives platform webhooks (Feishu event callbacks, etc.),
 * delegates to registered platform adapters for parsing and routing.
 *
 * F088 Multi-Platform Chat Gateway
 */

import { getConnectorDefinition } from '@cat-cafe/shared';
import type { FastifyPluginAsync } from 'fastify';

export interface ConnectorWebhookHandler {
  readonly connectorId: string;
  handleWebhook(
    body: unknown,
    headers: Record<string, string>,
    rawBodyOrQuery?: Buffer | Record<string, string>,
    query?: Record<string, string>,
  ): Promise<WebhookHandleResult>;
}

export type WebhookHandleResult =
  | { kind: 'challenge'; response: Record<string, unknown> | string }
  | { kind: 'routed'; threadId: string; messageId: string }
  | { kind: 'processed'; messageId?: string }
  | { kind: 'skipped'; reason: string }
  | { kind: 'error'; status: number; message: string };

export interface ConnectorWebhookRoutesOptions {
  readonly handlers: Map<string, ConnectorWebhookHandler>;
}

function mapImWebSkippedResponse(reason: string): {
  readonly status: number;
  readonly body: { kind: 'skipped'; reason: string; userMessage?: string };
} {
  switch (reason) {
    case 'group_not_allowed':
      return {
        status: 403,
        body: {
          kind: 'skipped',
          reason,
          userMessage: '此群未授权使用 Clowder。请联系管理员授权。',
        },
      };
    case 'command_admin_only':
      return {
        status: 403,
        body: {
          kind: 'skipped',
          reason,
          userMessage: '此命令仅 Clowder 管理员可用。',
        },
      };
    case 'permission_denied':
      return {
        status: 403,
        body: {
          kind: 'skipped',
          reason,
          userMessage: '当前用户无权执行此 Clowder 操作。',
        },
      };
    default:
      return { status: 200, body: { kind: 'skipped', reason } };
  }
}

export const connectorWebhookRoutes: FastifyPluginAsync<ConnectorWebhookRoutesOptions> = async (app, opts) => {
  const { handlers } = opts;

  // Capture raw body for HMAC verification (KD-11, F141).
  // Scoped to this plugin — does not affect other routes.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req: unknown, body: Buffer, done: (err: Error | null, body?: unknown) => void) => {
      (_req as { rawBody: Buffer }).rawBody = body;
      try {
        done(null, JSON.parse(body.toString()));
      } catch (err) {
        done(err as Error);
      }
    },
  );

  // WeCom Agent sends XML bodies
  app.addContentTypeParser(
    'text/xml',
    { parseAs: 'buffer' },
    (_req: unknown, body: Buffer, done: (err: Error | null, body?: unknown) => void) => {
      (_req as { rawBody: Buffer }).rawBody = body;
      done(null, body.toString('utf-8'));
    },
  );
  app.addContentTypeParser(
    'application/xml',
    { parseAs: 'buffer' },
    (_req: unknown, body: Buffer, done: (err: Error | null, body?: unknown) => void) => {
      (_req as { rawBody: Buffer }).rawBody = body;
      done(null, body.toString('utf-8'));
    },
  );

  app.post<{ Params: { connectorId: string } }>('/api/connectors/:connectorId/webhook', async (request, reply) => {
    const { connectorId } = request.params;

    const def = getConnectorDefinition(connectorId);
    if (!def) {
      return reply.status(404).send({ error: `Unknown connector: ${connectorId}` });
    }

    const handler = handlers.get(connectorId);
    if (!handler) {
      return reply.status(501).send({ error: `No handler for connector: ${connectorId}` });
    }

    const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody;
    const queryParams = request.query as Record<string, string>;
    const result = await handler.handleWebhook(
      request.body,
      request.headers as Record<string, string>,
      rawBody,
      queryParams,
    );

    switch (result.kind) {
      case 'challenge':
        if (typeof result.response === 'string') {
          return reply.status(200).type('text/plain').send(result.response);
        }
        return reply.status(200).send(result.response);
      case 'processed':
        return reply.status(200).send({ ok: true, messageId: result.messageId });
      case 'skipped':
        return reply.status(200).send({ ok: true, skipped: result.reason });
      case 'error':
        return reply.status(result.status).send({ error: result.message });
    }
  });

  app.post('/api/connectors/im-web/inbound', async (request, reply) => {
    const handler = handlers.get('im-web');
    if (!handler) {
      return reply.status(501).send({ error: 'No handler for connector: im-web' });
    }

    const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody;
    const result = await handler.handleWebhook(
      request.body,
      request.headers as Record<string, string>,
      rawBody,
      request.query as Record<string, string>,
    );

    switch (result.kind) {
      case 'routed':
        return reply.status(200).send({ kind: 'routed', threadId: result.threadId, messageId: result.messageId });
      case 'processed':
        return reply.status(200).send({ kind: 'routed', messageId: result.messageId });
      case 'skipped':
        {
          const mapped = mapImWebSkippedResponse(result.reason);
          return reply.status(mapped.status).send(mapped.body);
        }
      case 'error':
        return reply.status(result.status).send({ error: result.message });
      case 'challenge':
        return reply.status(200).send(result.response);
    }
  });

  app.get('/api/connectors/im-web/status', async (_request, reply) => {
    const registered = handlers.has('im-web');
    return reply.status(200).send({
      connectorId: 'im-web',
      enabled: registered,
      configured: registered,
      reachable: registered,
      version: '3.0',
      featureFlags: {
        imWebConnector: registered,
      },
      registered,
      state: registered ? 'ready' : 'unconfigured',
    });
  });

  // GET webhook route for platforms that use GET for URL verification (e.g. WeCom Agent echostr)
  app.get<{ Params: { connectorId: string } }>('/api/connectors/:connectorId/webhook', async (request, reply) => {
    const { connectorId } = request.params;

    const def = getConnectorDefinition(connectorId);
    if (!def) {
      return reply.status(404).send({ error: `Unknown connector: ${connectorId}` });
    }

    const handler = handlers.get(connectorId);
    if (!handler) {
      return reply.status(501).send({ error: `No handler for connector: ${connectorId}` });
    }

    const queryParams = request.query as Record<string, string>;
    const result = await handler.handleWebhook(
      null,
      request.headers as Record<string, string>,
      queryParams,
      queryParams,
    );

    switch (result.kind) {
      case 'challenge':
        if (typeof result.response === 'string') {
          return reply.status(200).type('text/plain').send(result.response);
        }
        return reply.status(200).send(result.response);
      case 'error':
        return reply.status(result.status).send({ error: result.message });
      default:
        return reply.status(200).send({ ok: true });
    }
  });
};
