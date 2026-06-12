import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { after, describe, it } from 'node:test';
import { ImWebAdapter } from '../dist/infrastructure/connectors/adapters/ImWebAdapter.js';
import { IM_WEB_TEST_SECRET } from './im-web-connector-test-helpers.js';

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

function createCallbackServer() {
  const requests = [];
  const server = http.createServer((req, res) => {
    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      rawBody += chunk;
    });
    req.on('end', () => {
      requests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        rawBody,
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}/api/im-web/clowder/outbound`,
        requests,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function expectedSignature(rawBody, timestamp) {
  return crypto.createHmac('sha256', IM_WEB_TEST_SECRET).update(`${timestamp}.${rawBody}`).digest('hex');
}

describe('im-web outbound adapter', () => {
  const servers = [];

  after(async () => {
    await Promise.all(servers.map((server) => server.close()));
  });

  it('delivers markdown replies to TangSeng with Clowder signature headers', async () => {
    const server = await createCallbackServer();
    servers.push(server);
    const adapter = new ImWebAdapter(noopLog(), {
      outboundCallbackUrl: server.url,
      connectorSecret: IM_WEB_TEST_SECRET,
      requestTimeoutMs: 1000,
      now: () => 1780000002000,
    });

    await adapter.sendReply('2:group-clowder', 'Clowder **reply**', {
      threadId: 'thread-1',
      invocationId: 'invoke-1',
      catId: 'codex',
    });

    assert.equal(server.requests.length, 1);
    const request = server.requests[0];
    assert.equal(request.method, 'POST');
    assert.equal(request.url, '/api/im-web/clowder/outbound');
    assert.equal(request.headers['content-type'], 'application/json');
    assert.equal(request.headers['x-clowder-timestamp'], '1780000002000');
    assert.equal(
      request.headers['x-clowder-signature'],
      expectedSignature(request.rawBody, '1780000002000'),
    );
    assert.deepEqual(JSON.parse(request.rawBody), {
      connectorId: 'im-web',
      externalChatId: '2:group-clowder',
      catId: 'codex',
      catDisplayName: '缅因猫',
      content: 'Clowder **reply**',
      format: 'markdown',
      metadata: {
        threadId: 'thread-1',
        invocationId: 'invoke-1',
        catId: 'codex',
      },
    });
  });

  it('delivers formatted replies with Clowder cat identity at TangSeng payload top level', async () => {
    const server = await createCallbackServer();
    servers.push(server);
    const adapter = new ImWebAdapter(noopLog(), {
      outboundCallbackUrl: server.url,
      connectorSecret: IM_WEB_TEST_SECRET,
      requestTimeoutMs: 1000,
      now: () => 1780000002500,
    });

    await adapter.sendFormattedReply(
      '2:project-group',
      {
        header: 'Codex',
        body: 'worker result',
        cardActions: [],
      },
      {
        catId: 'codex',
        catDisplayName: 'Codex',
      },
    );

    assert.equal(server.requests.length, 1);
    assert.deepEqual(JSON.parse(server.requests[0].rawBody), {
      connectorId: 'im-web',
      externalChatId: '2:project-group',
      catId: 'codex',
      catDisplayName: 'Codex',
      content: 'worker result',
      format: 'markdown',
      metadata: {
        catId: 'codex',
        catDisplayName: 'Codex',
      },
    });
  });

  it('delivers image media payloads to TangSeng outbound callback', async () => {
    const server = await createCallbackServer();
    servers.push(server);
    const adapter = new ImWebAdapter(noopLog(), {
      outboundCallbackUrl: server.url,
      connectorSecret: IM_WEB_TEST_SECRET,
      requestTimeoutMs: 1000,
      now: () => 1780000003000,
    });

    await adapter.sendMedia('1:clowder_ai', {
      type: 'image',
      url: 'http://127.0.0.1:3003/api/connector-media/sinx.png',
      fileName: 'sinx.png',
      size: 4096,
      alt: 'y = sin(x) 函数图像',
    });

    assert.equal(server.requests.length, 1);
    const request = server.requests[0];
    assert.equal(request.method, 'POST');
    assert.equal(request.headers['x-clowder-timestamp'], '1780000003000');
    assert.equal(
      request.headers['x-clowder-signature'],
      expectedSignature(request.rawBody, '1780000003000'),
    );
    assert.deepEqual(JSON.parse(request.rawBody), {
      connectorId: 'im-web',
      externalChatId: '1:clowder_ai',
      content: 'y = sin(x) 函数图像',
      format: 'markdown',
      media: {
        type: 'image',
        url: 'http://127.0.0.1:3003/api/connector-media/sinx.png',
        fileName: 'sinx.png',
        size: 4096,
        alt: 'y = sin(x) 函数图像',
      },
    });
  });

  it('delivers file media payloads with Clowder cat identity to TangSeng outbound callback', async () => {
    const server = await createCallbackServer();
    servers.push(server);
    const adapter = new ImWebAdapter(noopLog(), {
      outboundCallbackUrl: server.url,
      connectorSecret: IM_WEB_TEST_SECRET,
      requestTimeoutMs: 1000,
      now: () => 1780000004000,
    });

    await adapter.sendMedia('2:group-clowder', {
      type: 'file',
      url: 'http://localhost:3003/uploads/ordering-demo.tar.gz',
      fileName: 'ordering-demo.tar.gz',
      size: 86660,
      catId: 'ragdoll-kn9a',
      catDisplayName: '布偶猫',
    });

    assert.equal(server.requests.length, 1);
    const request = server.requests[0];
    assert.equal(request.method, 'POST');
    assert.equal(request.headers['x-clowder-timestamp'], '1780000004000');
    assert.equal(
      request.headers['x-clowder-signature'],
      expectedSignature(request.rawBody, '1780000004000'),
    );
    assert.deepEqual(JSON.parse(request.rawBody), {
      connectorId: 'im-web',
      externalChatId: '2:group-clowder',
      catId: 'ragdoll-kn9a',
      catDisplayName: '布偶猫',
      content: 'ordering-demo.tar.gz',
      format: 'markdown',
      media: {
        type: 'file',
        url: 'http://localhost:3003/uploads/ordering-demo.tar.gz',
        fileName: 'ordering-demo.tar.gz',
        size: 86660,
      },
    });
  });

  it('surfaces non-2xx TangSeng callback failures', async () => {
    const server = http.createServer((_, res) => {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'unavailable' }));
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    servers.push({ close: () => new Promise((done) => server.close(done)) });
    const address = server.address();
    const adapter = new ImWebAdapter(noopLog(), {
      outboundCallbackUrl: `http://127.0.0.1:${address.port}/api/im-web/clowder/outbound`,
      connectorSecret: IM_WEB_TEST_SECRET,
      requestTimeoutMs: 1000,
      now: () => 1780000002000,
    });

    await assert.rejects(
      () => adapter.sendReply('2:group-clowder', 'reply'),
      /IM Web outbound callback failed: 503/,
    );
  });
});
