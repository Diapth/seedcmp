import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createServer } from 'node:http';
import { ImWebAdapter } from '../dist/infrastructure/connectors/adapters/ImWebAdapter.js';

function noopLog() {
  const noop = () => {};
  return { info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop, child: () => noopLog() };
}

async function captureServer() {
  const requests = [];
  const server = createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      requests.push({ headers: req.headers, body: JSON.parse(body) });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    requests,
    url: `http://127.0.0.1:${server.address().port}/outbound`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

describe('im-web streaming adapter', () => {
  let server;

  afterEach(async () => {
    if (server) await server.close();
  });

  it('sends placeholder, chunk, and cleanup callbacks with one stable platform message id', async () => {
    server = await captureServer();
    const adapter = new ImWebAdapter(noopLog(), {
      outboundCallbackUrl: server.url,
      connectorSecret: 'shared-secret',
      now: () => 1780000000000,
    });

    const platformMessageId = await adapter.sendPlaceholder('2:group-clowder', 'thinking');
    await adapter.editMessage('2:group-clowder', platformMessageId, 'partial');
    await adapter.finalizeStreamCard('2:group-clowder', platformMessageId, 'Codex');

    assert.equal(server.requests.length, 3);
    assert.deepEqual(server.requests.map((req) => req.body.stream), [
      { state: 'placeholder', platformMessageId },
      { state: 'chunk', platformMessageId },
      { state: 'cleanup', platformMessageId },
    ]);
    assert.ok(server.requests.every((req) => req.headers['x-clowder-signature']));
  });
});
