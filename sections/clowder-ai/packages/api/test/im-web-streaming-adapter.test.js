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

  it('reserves a stream id without sending a thinking placeholder, then sends chunk and cleanup callbacks', async () => {
    server = await captureServer();
    const adapter = new ImWebAdapter(noopLog(), {
      outboundCallbackUrl: server.url,
      connectorSecret: 'shared-secret',
      now: () => 1780000000000,
    });

    const platformMessageId = await adapter.sendPlaceholder('2:group-clowder', 'thinking');
    await adapter.editMessage('2:group-clowder', platformMessageId, 'partial');
    await adapter.finalizeStreamCard('2:group-clowder', platformMessageId, 'Codex');

    assert.equal(server.requests.length, 2);
    assert.deepEqual(server.requests.map((req) => req.body.stream), [
      { state: 'chunk', platformMessageId },
      { state: 'cleanup', platformMessageId },
    ]);
    assert.ok(server.requests.every((req) => req.headers['x-clowder-signature']));
  });

  it('edits the pending stream message for inline final markdown delivery', async () => {
    server = await captureServer();
    const adapter = new ImWebAdapter(noopLog(), {
      outboundCallbackUrl: server.url,
      connectorSecret: 'shared-secret',
      now: () => 1780000000000,
    });

    adapter.registerInlinePlaceholder('2:group-clowder', 'im-web-stream-1');
    await adapter.sendFormattedReply('2:group-clowder', { body: '## 完成\n\n- 已流式输出', actions: [] });

    assert.equal(server.requests.length, 1);
    assert.deepEqual(server.requests[0].body.stream, {
      state: 'final',
      platformMessageId: 'im-web-stream-1',
    });
    assert.equal(server.requests[0].body.format, 'markdown');
    assert.equal(server.requests[0].body.content, '## 完成\n\n- 已流式输出');
  });

  it('delivers reaction callbacks for source message acknowledgements', async () => {
    server = await captureServer();
    const adapter = new ImWebAdapter(noopLog(), {
      outboundCallbackUrl: server.url,
      connectorSecret: 'shared-secret',
      now: () => 1780000000000,
    });

    await adapter.addReaction('user-message-1', 'HEART', '2:group-clowder');

    assert.equal(server.requests.length, 1);
    assert.equal(server.requests[0].body.externalChatId, '2:group-clowder');
    assert.deepEqual(server.requests[0].body.reaction, {
      platformMessageId: 'user-message-1',
      emoji: '❤️',
      emojiType: 'HEART',
    });
  });
});
