import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import Fastify from 'fastify';

const USER_HEADER = { 'x-cat-cafe-user': 'manual-pin-user' };

async function createApp() {
  const { manualContextPinsRoutes } = await import('../dist/routes/manual-context-pins.js');
  const { ManualContextPinStore } = await import('../dist/domains/cats/services/stores/ports/ManualContextPinStore.js');
  const app = Fastify();
  const manualContextPinStore = new ManualContextPinStore();
  await app.register(manualContextPinsRoutes, {
    manualContextPinStore,
    defaultUserId: 'default-user',
  });
  return { app, manualContextPinStore };
}

describe('Manual context pins routes', () => {
  test('upserts by messageId and lists active pins newest first with limit', async () => {
    const { app } = await createApp();

    const first = await app.inject({
      method: 'POST',
      url: '/api/threads/thread-1/manual-context-pins',
      headers: USER_HEADER,
      payload: {
        channelId: 'group-1',
        channelType: 2,
        messageId: 'm-1',
        contentExcerpt: '初始约束',
        senderName: 'PM',
        pinnedBy: 'manual-pin-user',
      },
    });
    assert.equal(first.statusCode, 201);
    const firstPin = first.json().pin;
    assert.equal(firstPin.messageId, 'm-1');
    assert.equal(firstPin.contentExcerpt, '初始约束');

    const updated = await app.inject({
      method: 'POST',
      url: '/api/threads/thread-1/manual-context-pins',
      headers: USER_HEADER,
      payload: {
        channelId: 'group-1',
        channelType: 2,
        messageId: 'm-1',
        contentExcerpt: '更新后的关键约束',
        senderName: 'PM',
        pinnedBy: 'manual-pin-user',
      },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().pin.id, firstPin.id);
    assert.equal(updated.json().pin.contentExcerpt, '更新后的关键约束');

    await app.inject({
      method: 'POST',
      url: '/api/threads/thread-1/manual-context-pins',
      headers: USER_HEADER,
      payload: {
        channelId: 'group-1',
        channelType: 2,
        messageId: 'm-2',
        contentExcerpt: '第二条长期上下文',
        senderName: 'Designer',
        pinnedBy: 'manual-pin-user',
      },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/threads/thread-1/manual-context-pins?limit=1',
      headers: USER_HEADER,
    });
    assert.equal(list.statusCode, 200);
    assert.equal(list.json().pins.length, 1);
    assert.equal(list.json().pins[0].messageId, 'm-2');
  });

  test('DELETE marks a pin removed and removes it from active listing', async () => {
    const { app } = await createApp();

    const created = await app.inject({
      method: 'POST',
      url: '/api/threads/thread-1/manual-context-pins',
      headers: USER_HEADER,
      payload: {
        channelId: 'group-1',
        channelType: 2,
        messageId: 'm-remove',
        contentExcerpt: '可撤销上下文',
        senderName: 'PM',
        pinnedBy: 'manual-pin-user',
      },
    });
    const pinId = created.json().pin.id;

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/threads/thread-1/manual-context-pins/${encodeURIComponent(pinId)}`,
      headers: USER_HEADER,
    });
    assert.equal(removed.statusCode, 204);

    const list = await app.inject({
      method: 'GET',
      url: '/api/threads/thread-1/manual-context-pins',
      headers: USER_HEADER,
    });
    assert.equal(list.statusCode, 200);
    assert.equal(list.json().pins.length, 0);
  });

  test('degraded source states are preserved and excluded from active context', async () => {
    const { app, manualContextPinStore } = await createApp();

    await app.inject({
      method: 'POST',
      url: '/api/threads/thread-1/manual-context-pins',
      headers: USER_HEADER,
      payload: {
        channelId: 'group-1',
        channelType: 2,
        messageId: 'm-deleted',
        contentExcerpt: '不应注入',
        senderName: 'PM',
        pinnedBy: 'manual-pin-user',
      },
    });
    await manualContextPinStore.markSourceStatus('thread-1', 'm-deleted', 'source_deleted', 'manual-pin-user');

    const active = await app.inject({
      method: 'GET',
      url: '/api/threads/thread-1/manual-context-pins',
      headers: USER_HEADER,
    });
    assert.equal(active.statusCode, 200);
    assert.equal(active.json().pins.length, 0);

    const all = await app.inject({
      method: 'GET',
      url: '/api/threads/thread-1/manual-context-pins?includeInactive=1',
      headers: USER_HEADER,
    });
    assert.equal(all.statusCode, 200);
    assert.equal(all.json().pins[0].status, 'source_deleted');
  });

  test('PATCH source status marks matching pins degraded for live verification', async () => {
    const { app } = await createApp();

    await app.inject({
      method: 'POST',
      url: '/api/threads/thread-1/manual-context-pins',
      headers: USER_HEADER,
      payload: {
        channelId: 'group-1',
        channelType: 2,
        messageId: 'm-deleted',
        contentExcerpt: '删除后不应注入',
        senderName: 'PM',
        pinnedBy: 'manual-pin-user',
      },
    });

    const patched = await app.inject({
      method: 'PATCH',
      url: '/api/threads/thread-1/manual-context-pins/source-status',
      headers: USER_HEADER,
      payload: {
        messageId: 'm-deleted',
        status: 'source_deleted',
      },
    });
    assert.equal(patched.statusCode, 200);
    assert.equal(patched.json().pins[0].status, 'source_deleted');

    const active = await app.inject({
      method: 'GET',
      url: '/api/threads/thread-1/manual-context-pins',
      headers: USER_HEADER,
    });
    assert.equal(active.statusCode, 200);
    assert.equal(active.json().pins.length, 0);
  });

  test('missing required payload fields fail closed', async () => {
    const { app } = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/threads/thread-1/manual-context-pins',
      headers: USER_HEADER,
      payload: {
        channelId: 'group-1',
        channelType: 2,
        messageId: '',
        contentExcerpt: '',
      },
    });

    assert.equal(response.statusCode, 400);
  });
});
