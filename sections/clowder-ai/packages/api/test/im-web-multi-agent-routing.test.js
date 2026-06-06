import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

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

function createBindingStore(binding) {
  let current = binding;
  return {
    async getByExternal() {
      return current ?? null;
    },
    async getByThread() {
      return current ? [current] : [];
    },
    async bind(connectorId, externalChatId, threadId, userId) {
      current = { connectorId, externalChatId, threadId, userId, createdAt: Date.now() };
      return current;
    },
    async remove() {
      current = null;
      return true;
    },
    async listByUser() {
      return current ? [current] : [];
    },
    async setHubThread(_connectorId, _externalChatId, hubThreadId) {
      if (!current) return null;
      current = { ...current, hubThreadId };
      return current;
    },
  };
}

function createThreadStore(initialThread, participants = []) {
  const threads = new Map(initialThread ? [[initialThread.id, { ...initialThread }]] : []);
  return {
    async create(userId, title) {
      const thread = { id: `thread-${threads.size + 1}`, userId, title, createdAt: Date.now() };
      threads.set(thread.id, thread);
      return thread;
    },
    async get(id) {
      return threads.get(id) ?? null;
    },
    async list() {
      return [...threads.values()];
    },
    async updateConnectorHubState() {},
    async updatePreferredCats(threadId, catIds) {
      const thread = threads.get(threadId);
      if (!thread) return;
      if (catIds.length) thread.preferredCats = [...catIds];
      else delete thread.preferredCats;
    },
    async getParticipantsWithActivity() {
      return participants;
    },
    threads,
  };
}

describe('im-web multi-agent routing', () => {
  let ConnectorCommandLayer;
  let ConnectorRouter;
  let InboundMessageDedup;

  before(async () => {
    const commandMod = await import('../dist/infrastructure/connectors/ConnectorCommandLayer.js');
    const routerMod = await import('../dist/infrastructure/connectors/ConnectorRouter.js');
    const dedupMod = await import('../dist/infrastructure/connectors/InboundMessageDedup.js');
    ConnectorCommandLayer = commandMod.ConnectorCommandLayer;
    ConnectorRouter = routerMod.ConnectorRouter;
    InboundMessageDedup = dedupMod.InboundMessageDedup;
  });

  function createHarness({ thread = { id: 'thread-im-web', title: 'IM Web' }, participants = [] } = {}) {
    const binding = {
      connectorId: 'im-web',
      externalChatId: '2:group-clowder',
      threadId: thread.id,
      userId: 'owner-1',
      createdAt: Date.now(),
    };
    const bindingStore = createBindingStore(binding);
    const threadStore = createThreadStore(thread, participants);
    const messages = [];
    const triggerCalls = [];
    const adapterReplies = [];
    const commandLayer = new ConnectorCommandLayer({
      bindingStore,
      threadStore,
      frontendBaseUrl: 'https://cafe.example.com',
    });
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
      threadStore,
      invokeTrigger: {
        trigger(...args) {
          triggerCalls.push(args);
          return 'dispatched';
        },
      },
      defaultUserId: 'owner-1',
      defaultCatId: 'opus',
      log: noopLog(),
      commandLayer,
      adapters: new Map([
        [
          'im-web',
          {
            connectorId: 'im-web',
            async sendReply(externalChatId, content) {
              adapterReplies.push({ externalChatId, content });
            },
          },
        ],
      ]),
    });
    return { router, threadStore, messages, triggerCalls, adapterReplies };
  }

  it('routes @mentions from IM Web through the Clowder mention parser', async () => {
    const { router, triggerCalls } = createHarness();

    await router.route('im-web', '2:group-clowder', '@codex summarize this', 'm-mention');

    assert.equal(triggerCalls.length, 1);
    assert.equal(triggerCalls[0][1], 'codex');
  });

  it('routes /ask to the requested cat and preserves the message body', async () => {
    const { router, messages, triggerCalls } = createHarness();

    await router.route('im-web', '2:group-clowder', '/ask codex review this patch', 'm-ask');

    assert.equal(triggerCalls.length, 1);
    assert.equal(triggerCalls[0][1], 'codex');
    assert.equal(triggerCalls[0][3], 'review this patch');
    assert.equal(messages.at(-1).content, 'review this patch');
  });

  it('persists /focus as preferred cats for the current IM Web thread', async () => {
    const { router, threadStore, adapterReplies } = createHarness();

    await router.route('im-web', '2:group-clowder', '/focus codex', 'm-focus');

    assert.deepEqual(threadStore.threads.get('thread-im-web').preferredCats, ['codex']);
    assert.ok(adapterReplies[0].content.includes('codex'));
  });

  it('routes no-mention IM Web messages to the coordinator instead of the last active participant', async () => {
    const { router, triggerCalls } = createHarness({
      participants: [
        { catId: 'opus', lastMessageAt: 100, messageCount: 1 },
        { catId: 'codex', lastMessageAt: 200, messageCount: 3 },
      ],
    });

    await router.route('im-web', '2:group-clowder', 'follow up without explicit mention', 'm-fallback');

    assert.equal(triggerCalls.length, 1);
    assert.equal(triggerCalls[0][1], 'coordinator');
  });
});
