import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConnectorRouter } from '../dist/infrastructure/connectors/ConnectorRouter.js';
import { MemoryConnectorThreadBindingStore } from '../dist/infrastructure/connectors/ConnectorThreadBindingStore.js';
import { ImWebInboundHandler } from '../dist/infrastructure/connectors/ImWebInboundHandler.js';
import { InboundMessageDedup } from '../dist/infrastructure/connectors/InboundMessageDedup.js';
import {
  IM_WEB_TEST_SECRET,
  createImWebInboundPayload,
  signImWebBody,
} from './im-web-connector-test-helpers.js';

function noopLog() {
  const noop = () => {};
  return {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    child: () => noopLog(),
  };
}

function createHarness() {
  const bindingStore = new MemoryConnectorThreadBindingStore();
  const messages = [];
  const triggerCalls = [];
  const threads = new Map();
  let threadCounter = 0;
  const router = new ConnectorRouter({
    bindingStore,
    dedup: new InboundMessageDedup(),
    messageStore: {
      async append(input) {
        const msg = { id: `msg-${messages.length + 1}`, ...input };
        messages.push(msg);
        return msg;
      },
    },
    threadStore: {
      create(userId, title, projectPath) {
        threadCounter += 1;
        const thread = { id: `thread-${threadCounter}`, userId, title, projectPath };
        threads.set(thread.id, thread);
        return thread;
      },
      updateConnectorHubState() {},
    },
    invokeTrigger: {
      trigger(...args) {
        triggerCalls.push(args);
        return 'dispatched';
      },
    },
    defaultUserId: 'owner-1',
    defaultCatId: 'codex',
    log: noopLog(),
  });

  const handler = new ImWebInboundHandler({
    connectorSecret: IM_WEB_TEST_SECRET,
    router,
    now: () => 1780000001000,
    signatureToleranceMs: 300000,
    log: noopLog(),
  });

  return { handler, bindingStore, messages, triggerCalls };
}

function signedRequest(payload) {
  const signed = signImWebBody(payload);
  return {
    body: payload,
    rawBody: Buffer.from(signed.rawBody),
    headers: {
      'x-im-web-signature': signed.signature,
      'x-im-web-timestamp': signed.timestamp,
    },
  };
}

describe('im-web inbound bridge', () => {
  it('routes signed IM Web payloads into connector threads', async () => {
    const { handler, bindingStore, messages, triggerCalls } = createHarness();
    const req = signedRequest(createImWebInboundPayload());

    const result = await handler.handleWebhook(req.body, req.headers, req.rawBody);

    assert.equal(result.kind, 'routed');
    assert.equal(result.threadId, 'thread-1');
    assert.equal(result.messageId, 'msg-1');
    assert.equal(bindingStore.getByExternal('im-web', '2:group-clowder').threadId, 'thread-1');
    assert.equal(messages[0].source.connector, 'im-web');
    assert.deepEqual(messages[0].source.sender, { id: 'u_10001', name: 'Alice' });
    assert.equal(triggerCalls.length, 1);
  });

  it('preserves IM Web group role metadata for sender attribution', async () => {
    const { handler, messages } = createHarness();
    const req = signedRequest(
      createImWebInboundPayload({
        sourceRoleSnapshot: {
          group_no: 'group-clowder',
          uid: 'u_10001',
          role: 'manager',
          admin: true,
        },
      }),
    );

    const result = await handler.handleWebhook(req.body, req.headers, req.rawBody);

    assert.equal(result.kind, 'routed');
    assert.deepEqual(messages[0].source.sender, {
      id: 'u_10001',
      name: 'Alice',
      role: {
        group_no: 'group-clowder',
        uid: 'u_10001',
        role: 'manager',
        admin: true,
      },
    });
  });

  it('skips duplicate IM Web retries by message id', async () => {
    const { handler, messages, triggerCalls } = createHarness();
    const payload = createImWebInboundPayload({ messageId: 'retry-1', clientMsgNo: 'client-retry-1' });
    const req = signedRequest(payload);

    const first = await handler.handleWebhook(req.body, req.headers, req.rawBody);
    const second = await handler.handleWebhook(req.body, req.headers, req.rawBody);

    assert.equal(first.kind, 'routed');
    assert.equal(second.kind, 'skipped');
    assert.equal(second.reason, 'duplicate');
    assert.equal(messages.length, 1);
    assert.equal(triggerCalls.length, 1);
  });

  it('rejects unsigned IM Web payloads', async () => {
    const { handler } = createHarness();

    const result = await handler.handleWebhook(createImWebInboundPayload(), {}, Buffer.from('{}'));

    assert.equal(result.kind, 'error');
    assert.equal(result.status, 401);
    assert.equal(result.message, 'invalid_signature');
  });
});
