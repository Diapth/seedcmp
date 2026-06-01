import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import Fastify from 'fastify';
import { connectorWebhookRoutes } from '../dist/routes/connector-webhooks.js';
import { createImWebInboundPayload, signImWebBody } from './im-web-connector-test-helpers.js';

function handlerReturning(result) {
  return {
    connectorId: 'im-web',
    async handleWebhook() {
      return result;
    },
  };
}

function signedInjectPayload(overrides = {}) {
  const payload = createImWebInboundPayload(overrides);
  const signed = signImWebBody(payload);
  return {
    payload,
    headers: {
      'content-type': 'application/json',
      'x-im-web-signature': signed.signature,
      'x-im-web-timestamp': signed.timestamp,
    },
  };
}

describe('im-web webhook response mapping', () => {
  let app;

  afterEach(async () => {
    if (app) await app.close();
  });

  async function setup(result) {
    app = Fastify();
    await app.register(connectorWebhookRoutes, {
      handlers: new Map([['im-web', handlerReturning(result)]]),
    });
    await app.ready();
  }

  it('maps group_not_allowed skipped results to a 403 authorization response', async () => {
    await setup({ kind: 'skipped', reason: 'group_not_allowed' });
    const req = signedInjectPayload();

    const res = await app.inject({
      method: 'POST',
      url: '/api/connectors/im-web/inbound',
      headers: req.headers,
      payload: req.payload,
    });

    assert.equal(res.statusCode, 403);
    assert.deepEqual(JSON.parse(res.body), {
      kind: 'skipped',
      reason: 'group_not_allowed',
      userMessage: '此群未授权使用 Clowder。请联系管理员授权。',
    });
  });

  it('maps command_admin_only skipped results to a 403 admin-only response', async () => {
    await setup({ kind: 'skipped', reason: 'command_admin_only' });
    const req = signedInjectPayload({ text: '/focus codex' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/connectors/im-web/inbound',
      headers: req.headers,
      payload: req.payload,
    });

    assert.equal(res.statusCode, 403);
    assert.deepEqual(JSON.parse(res.body), {
      kind: 'skipped',
      reason: 'command_admin_only',
      userMessage: '此命令仅 Clowder 管理员可用。',
    });
  });
});
