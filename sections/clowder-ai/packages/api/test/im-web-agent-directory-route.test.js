import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import Fastify from 'fastify';

function createApp() {
  const threads = new Map([
    ['thread-im-web', { id: 'thread-im-web', title: 'IM Web', preferredCats: ['codex'] }],
  ]);
  const participants = new Map([
    [
      'thread-im-web',
      [
        { catId: 'codex', lastMessageAt: 1780000000000, messageCount: 3 },
        { catId: 'opus', lastMessageAt: 1770000000000, messageCount: 1 },
      ],
    ],
  ]);
  const bindings = new Map([
    ['im-web:2:group-clowder', { connectorId: 'im-web', externalChatId: '2:group-clowder', threadId: 'thread-im-web', userId: 'owner-1' }],
  ]);
  return {
    threads,
    participants,
    bindings,
    threadStore: {
      async get(id) {
        return threads.get(id) ?? null;
      },
      async getParticipantsWithActivity(id) {
        return participants.get(id) ?? [];
      },
    },
    bindingStore: {
      async getByThread(threadId) {
        return [...bindings.values()].filter((binding) => binding.threadId === threadId);
      },
      async getByExternal(connectorId, externalChatId) {
        return bindings.get(`${connectorId}:${externalChatId}`) ?? null;
      },
    },
  };
}

describe('im-web agent directory route', () => {
  let app;

  afterEach(async () => {
    if (app) await app.close();
  });

  it('returns agents, preferred cats, and last-active cat for an im-web binding', async () => {
    const { threadStore, bindingStore } = createApp();
    const { threadCatsRoutes } = await import('../dist/routes/thread-cats.js');
    app = Fastify();
    await app.register(threadCatsRoutes, {
      threadStore,
      bindingStore,
      agentRegistry: { getAllEntries: () => new Map([['codex', {}], ['opus', {}]]) },
      getCatDisplayName: (catId) => (catId === 'codex' ? 'Codex' : 'Opus'),
      getAllCatIds: () => ['codex', 'opus'],
      isCatAvailable: (catId) => catId !== 'opus',
    });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/connectors/im-web/agents?externalChatId=2%3Agroup-clowder',
      headers: { 'x-cat-cafe-user': 'owner-1' },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.preferredCatIds[0], 'codex');
    assert.equal(body.lastActiveCatId, 'codex');
    assert.deepEqual(
      body.agents.map((agent) => ({
        catId: agent.catId,
        available: agent.available,
        preferred: agent.preferred,
        lastActiveAt: agent.lastActiveAt,
      })),
      [
        { catId: 'codex', available: true, preferred: true, lastActiveAt: 1780000000000 },
        { catId: 'opus', available: false, preferred: false, lastActiveAt: 1770000000000 },
      ],
    );
  });

  it('returns the routable agent directory for an unbound im-web external chat', async () => {
    const { threadStore, bindingStore } = createApp();
    const { threadCatsRoutes } = await import('../dist/routes/thread-cats.js');
    app = Fastify();
    await app.register(threadCatsRoutes, {
      threadStore,
      bindingStore,
      agentRegistry: { getAllEntries: () => new Map([['codex', {}], ['opus', {}]]) },
      getCatDisplayName: (catId) => (catId === 'codex' ? 'Codex' : 'Opus'),
      getAllCatIds: () => ['codex', 'opus'],
      isCatAvailable: (catId) => catId !== 'opus',
    });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/connectors/im-web/agents?externalChatId=1%3Aclowder_ai',
      headers: { 'x-cat-cafe-user': 'owner-1' },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.threadId, null);
    assert.equal(body.externalChatId, '1:clowder_ai');
    assert.equal(body.bindingRequired, true);
    assert.deepEqual(
      body.agents.map((agent) => ({
        catId: agent.catId,
        available: agent.available,
        preferred: agent.preferred,
      })),
      [
        { catId: 'codex', available: true, preferred: false },
        { catId: 'opus', available: false, preferred: false },
      ],
    );
  });

  it('falls back to the global candidate directory when the bound thread belongs to another user', async () => {
    const { threadStore, bindingStore } = createApp();
    const { threadCatsRoutes } = await import('../dist/routes/thread-cats.js');
    app = Fastify();
    await app.register(threadCatsRoutes, {
      threadStore,
      bindingStore,
      agentRegistry: { getAllEntries: () => new Map([['codex', {}]]) },
      getCatDisplayName: (catId) => (catId === 'codex' ? 'Codex' : 'Opus'),
      getAllCatIds: () => ['codex'],
      isCatAvailable: () => true,
      getDirectoryAgents: () => [
        {
          catId: 'codex',
          displayName: 'Codex',
          mentionPatterns: ['@codex'],
          source: 'existing',
        },
        {
          catId: 'opus',
          displayName: '布偶猫',
          mentionPatterns: ['@opus', '@布偶猫'],
          source: 'disconnected',
        },
      ],
    });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/connectors/im-web/agents?externalChatId=2%3Agroup-clowder',
      headers: { 'x-cat-cafe-user': 'other-user' },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.threadId, null);
    assert.equal(body.permissionDenied, true);
    assert.deepEqual(
      body.agents.map((agent) => ({
        catId: agent.catId,
        displayName: agent.displayName,
        available: agent.available,
        source: agent.source,
      })),
      [
        { catId: 'codex', displayName: 'Codex', available: true, source: 'existing' },
        { catId: 'opus', displayName: '布偶猫', available: false, source: 'disconnected' },
      ],
    );
  });

  it('returns template candidate families even when the runtime cat registry is empty', async () => {
    const { threadStore, bindingStore } = createApp();
    const { threadCatsRoutes } = await import('../dist/routes/thread-cats.js');
    app = Fastify();
    await app.register(threadCatsRoutes, {
      threadStore,
      bindingStore,
      agentRegistry: { getAllEntries: () => new Map() },
      getCatDisplayName: (catId) => catId,
      getAllCatIds: () => [],
      isCatAvailable: () => true,
      getDirectoryAgents: () => [
        {
          catId: 'opus',
          displayName: '布偶猫',
          mentionPatterns: ['@opus', '@布偶猫'],
          personalitySummary: '温柔但有主见',
          capabilitySummary: '架构设计',
          source: 'disconnected',
        },
        {
          catId: 'codex',
          displayName: 'Codex',
          mentionPatterns: ['@codex'],
          personalitySummary: '严谨认真',
          capabilitySummary: 'Review',
          source: 'disconnected',
        },
      ],
    });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/connectors/im-web/agents?externalChatId=1%3Aclowder_ai',
      headers: { 'x-cat-cafe-user': 'owner-1' },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.deepEqual(
      body.agents.map((agent) => ({
        catId: agent.catId,
        displayName: agent.displayName,
        available: agent.available,
        source: agent.source,
      })),
      [
        { catId: 'opus', displayName: '布偶猫', available: false, source: 'disconnected' },
        { catId: 'codex', displayName: 'Codex', available: false, source: 'disconnected' },
      ],
    );
  });
});
