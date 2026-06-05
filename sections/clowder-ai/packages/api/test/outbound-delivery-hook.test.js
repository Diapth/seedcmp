import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import './helpers/setup-cat-registry.js';
import { MemoryConnectorThreadBindingStore } from '../dist/infrastructure/connectors/ConnectorThreadBindingStore.js';
import { OutboundDeliveryHook } from '../dist/infrastructure/connectors/OutboundDeliveryHook.js';

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

function mockAdapter(connectorId) {
  const sent = [];
  return {
    sent,
    adapter: {
      connectorId,
      async sendReply(externalChatId, content, metadata) {
        sent.push({ externalChatId, content, metadata });
      },
    },
  };
}

describe('OutboundDeliveryHook', () => {
  let bindingStore;
  let feishuMock;
  let hook;

  beforeEach(() => {
    bindingStore = new MemoryConnectorThreadBindingStore();
    feishuMock = mockAdapter('feishu');
    const adapters = new Map([['feishu', feishuMock.adapter]]);
    hook = new OutboundDeliveryHook({
      bindingStore,
      adapters,
      log: noopLog(),
    });
  });

  it('delivers reply to bound external chat', async () => {
    bindingStore.bind('feishu', 'chat-123', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello from cat!');
    assert.equal(feishuMock.sent.length, 1);
    assert.equal(feishuMock.sent[0].externalChatId, 'chat-123');
    assert.equal(feishuMock.sent[0].content, 'Hello from cat!');
  });

  it('skips delivery when no binding exists', async () => {
    await hook.deliver('thread-no-binding', 'Hello');
    assert.equal(feishuMock.sent.length, 0);
  });

  it('delivers to multiple bindings for same thread', async () => {
    const telegramMock = mockAdapter('telegram');
    const adapters = new Map([
      ['feishu', feishuMock.adapter],
      ['telegram', telegramMock.adapter],
    ]);
    hook = new OutboundDeliveryHook({
      bindingStore,
      adapters,
      log: noopLog(),
    });

    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
    bindingStore.bind('telegram', 'chat-2', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello!');

    assert.equal(feishuMock.sent.length, 1);
    assert.equal(telegramMock.sent.length, 1);
  });

  it('does not throw when adapter.sendReply fails', async () => {
    const failAdapter = {
      connectorId: 'feishu',
      async sendReply() {
        throw new Error('network error');
      },
    };
    hook = new OutboundDeliveryHook({
      bindingStore,
      adapters: new Map([['feishu', failAdapter]]),
      log: noopLog(),
    });
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

    // Should not throw — fire-and-forget with error logging
    await hook.deliver('thread-abc', 'Hello');
  });

  it('skips binding when adapter not registered', async () => {
    bindingStore.bind('discord', 'chat-1', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello');
    assert.equal(feishuMock.sent.length, 0);
  });

  // Phase 2: cat identity prefix
  it('prepends cat display name prefix when catId is provided', async () => {
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello!', 'opus');
    assert.equal(feishuMock.sent.length, 1);
    assert.match(feishuMock.sent[0].content, /^【布偶猫🐱】\nHello!$/);
  });

  it('sends plain content when catId is omitted (backward compat)', async () => {
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello!');
    assert.equal(feishuMock.sent[0].content, 'Hello!');
  });

  it('sends plain content when catId is unknown', async () => {
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello!', 'nonexistent-cat');
    assert.equal(feishuMock.sent[0].content, 'Hello!');
  });

  // Phase 3: rich block delivery
  it('calls sendRichMessage when adapter supports it and blocks provided', async () => {
    const richSent = [];
    const richAdapter = {
      connectorId: 'feishu',
      async sendReply(externalChatId, content) {
        feishuMock.sent.push({ externalChatId, content });
      },
      async sendRichMessage(externalChatId, textContent, blocks, catDisplayName) {
        richSent.push({ externalChatId, textContent, blocks, catDisplayName });
      },
    };
    hook = new OutboundDeliveryHook({
      bindingStore,
      adapters: new Map([['feishu', richAdapter]]),
      log: noopLog(),
    });
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

    const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Review', bodyMarkdown: 'LGTM' }];
    await hook.deliver('thread-abc', 'Summary text', 'opus', blocks);

    assert.equal(richSent.length, 1);
    assert.equal(richSent[0].catDisplayName, '布偶猫');
    assert.equal(richSent[0].blocks.length, 1);
    assert.equal(feishuMock.sent.length, 0); // sendReply NOT called
  });

  it('falls back to sendReply with plaintext when adapter lacks sendRichMessage', async () => {
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

    const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Review', bodyMarkdown: 'LGTM' }];
    await hook.deliver('thread-abc', 'Summary', 'opus', blocks);

    assert.equal(feishuMock.sent.length, 1);
    // Should contain both text prefix and plaintext-rendered block
    assert.ok(feishuMock.sent[0].content.includes('【布偶猫🐱】'));
    assert.ok(feishuMock.sent[0].content.includes('Review'));
    assert.ok(feishuMock.sent[0].content.includes('LGTM'));
  });

  it('sends text via sendReply when no rich blocks (backward compat)', async () => {
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello!', 'opus', undefined);
    assert.equal(feishuMock.sent.length, 1);
    assert.match(feishuMock.sent[0].content, /^【布偶猫🐱】\nHello!$/);
  });

  it('sends text via sendReply when rich blocks is empty array', async () => {
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');
    await hook.deliver('thread-abc', 'Hello!', 'opus', []);
    assert.equal(feishuMock.sent.length, 1);
    assert.match(feishuMock.sent[0].content, /^【布偶猫🐱】\nHello!$/);
  });

  // P1-1: block-only responses (empty content) must still trigger delivery
  it('delivers rich blocks even when text content is empty', async () => {
    const richSent = [];
    const richAdapter = {
      connectorId: 'feishu',
      async sendReply(externalChatId, content) {
        feishuMock.sent.push({ externalChatId, content });
      },
      async sendRichMessage(externalChatId, textContent, blocks, catDisplayName) {
        richSent.push({ externalChatId, textContent, blocks, catDisplayName });
      },
    };
    hook = new OutboundDeliveryHook({
      bindingStore,
      adapters: new Map([['feishu', richAdapter]]),
      log: noopLog(),
    });
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

    const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Status', bodyMarkdown: 'Done' }];
    await hook.deliver('thread-abc', '', 'opus', blocks);

    assert.equal(richSent.length, 1);
    assert.equal(richSent[0].blocks.length, 1);
    assert.equal(feishuMock.sent.length, 0); // sendReply NOT called
  });

  it('falls back to plaintext for block-only when adapter lacks sendRichMessage', async () => {
    bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

    const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Status', bodyMarkdown: 'Done' }];
    await hook.deliver('thread-abc', '', 'opus', blocks);

    assert.equal(feishuMock.sent.length, 1);
    assert.ok(feishuMock.sent[0].content.includes('Status'));
    assert.ok(feishuMock.sent[0].content.includes('Done'));
  });

  // Phase A: MessageEnvelope formatted reply
  describe('sendFormattedReply (MessageEnvelope)', () => {
    it('calls sendFormattedReply when adapter supports it and threadMeta provided', async () => {
      const formattedCalls = [];
      const richAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendFormattedReply(chatId, envelope) {
          formattedCalls.push({ chatId, envelope });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', richAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'oc_chat_1', 'thread-1', 'user-1');

      await hook.deliver('thread-1', 'Hello from cat!', 'opus', undefined, {
        threadShortId: 'T42',
        threadTitle: '飞书登录bug排查',
        featId: 'F088',
      });

      assert.equal(formattedCalls.length, 1);
      assert.equal(feishuMock.sent.length, 0, 'sendReply should NOT be called');
      assert.equal(formattedCalls[0].chatId, 'oc_chat_1');
      const env = formattedCalls[0].envelope;
      assert.ok(env.header.includes('布偶猫'), 'header should contain cat display name');
      assert.ok(env.subtitle.includes('T42'), 'subtitle should have thread short ID');
      assert.ok(env.subtitle.includes('F088'), 'subtitle should have feat ID');
      assert.equal(env.body, 'Hello from cat!');
    });

    it('falls back to sendReply when adapter has no sendFormattedReply', async () => {
      bindingStore.bind('feishu', 'oc_chat_1', 'thread-1', 'user-1');

      await hook.deliver('thread-1', 'Hello!', 'opus', undefined, {
        threadShortId: 'T1',
      });

      assert.equal(feishuMock.sent.length, 1);
      assert.ok(feishuMock.sent[0].content.includes('Hello!'));
    });

    it('uses sendFormattedReply even without threadMeta (Phase E: card identity)', async () => {
      const formattedCalls = [];
      const richAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendFormattedReply(chatId, envelope) {
          formattedCalls.push({ chatId, envelope });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', richAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'oc_chat_1', 'thread-1', 'user-1');

      // No threadMeta → should STILL use card for visual identity separation
      await hook.deliver('thread-1', 'Old style message', 'opus');

      assert.equal(formattedCalls.length, 1, 'sendFormattedReply SHOULD be called even without threadMeta');
      assert.equal(feishuMock.sent.length, 0, 'sendReply should NOT be called');
      const env = formattedCalls[0].envelope;
      assert.ok(env.header.includes('布偶猫'), 'header should contain cat display name');
      assert.equal(env.body, 'Old style message');
    });
  });

  // Phase 6: Audio block → sendMedia delivery
  describe('audio block delivery via sendMedia', () => {
    it('calls sendMedia for audio blocks with url when adapter supports it', async () => {
      const mediaSent = [];
      const richSent = [];
      const mediaAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendRichMessage(chatId, text, blocks, catName) {
          richSent.push({ chatId, text, blocks, catName });
        },
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', mediaAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'a1', kind: 'audio', v: 1, url: '/api/tts/audio/abc123.wav', text: 'Hello voice' }];
      await hook.deliver('thread-abc', 'Text reply', 'opus', blocks);

      assert.equal(mediaSent.length, 1, 'sendMedia should be called for audio block with url');
      assert.equal(mediaSent[0].chatId, 'chat-1');
      assert.equal(mediaSent[0].payload.type, 'audio');
      assert.ok(mediaSent[0].payload.url.includes('abc123.wav'));
    });

    it('does not call sendMedia when adapter lacks sendMedia (graceful fallback)', async () => {
      const richSent = [];
      const noMediaAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendRichMessage(chatId, text, blocks, catName) {
          richSent.push({ chatId, text, blocks, catName });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', noMediaAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'a1', kind: 'audio', v: 1, url: '/api/tts/audio/abc123.wav', text: 'Hello voice' }];
      // Should not throw, falls back to rich message rendering
      await hook.deliver('thread-abc', 'Text', 'opus', blocks);
      assert.equal(richSent.length, 1, 'should fall back to sendRichMessage');
    });

    it('skips sendMedia for audio blocks without url (text-only = not yet synthesized)', async () => {
      const mediaSent = [];
      const richSent = [];
      const mediaAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendRichMessage(chatId, text, blocks, catName) {
          richSent.push({ chatId, text, blocks, catName });
        },
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', mediaAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'a1', kind: 'audio', v: 1, text: 'Hello voice' }];
      await hook.deliver('thread-abc', 'Text', 'opus', blocks);

      assert.equal(mediaSent.length, 0, 'sendMedia should NOT be called for audio without url');
      assert.equal(richSent.length, 1, 'should still send via sendRichMessage');
    });

    it('sends media for each audio block in mixed blocks', async () => {
      const mediaSent = [];
      const richSent = [];
      const mediaAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendRichMessage(chatId, text, blocks, catName) {
          richSent.push({ chatId, text, blocks, catName });
        },
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', mediaAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [
        { id: 'c1', kind: 'card', v: 1, title: 'Status', bodyMarkdown: 'Done' },
        { id: 'a1', kind: 'audio', v: 1, url: '/api/tts/audio/abc.wav', text: 'Voice 1' },
        { id: 'a2', kind: 'audio', v: 1, url: '/api/tts/audio/def.wav', text: 'Voice 2' },
      ];
      await hook.deliver('thread-abc', 'Mixed content', 'opus', blocks);

      assert.equal(mediaSent.length, 2, 'sendMedia called for each audio block with url');
      assert.equal(richSent.length, 1, 'sendRichMessage still called for all blocks');
    });
  });

  // Phase J: File block → sendMedia delivery
  describe('file block delivery via sendMedia', () => {
    it('calls sendMedia for file blocks with url', async () => {
      const mediaSent = [];
      const richSent = [];
      const mediaAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendRichMessage(chatId, text, blocks, catName) {
          richSent.push({ chatId, text, blocks, catName });
        },
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', mediaAdapter]]),
        log: noopLog(),
        mediaPathResolver: (url) => {
          if (url.startsWith('/uploads/')) return `/abs${url}`;
          return undefined;
        },
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'f1', kind: 'file', v: 1, url: '/uploads/report.pdf', fileName: '调研报告.pdf' }];
      await hook.deliver('thread-abc', 'Here is the report', 'opus', blocks);

      assert.equal(mediaSent.length, 1, 'sendMedia should be called for file block');
      assert.equal(mediaSent[0].chatId, 'chat-1');
      assert.equal(mediaSent[0].payload.type, 'file');
      assert.equal(mediaSent[0].payload.url, 'http://localhost:3004/uploads/report.pdf');
      assert.equal(mediaSent[0].payload.absPath, '/abs/uploads/report.pdf');
    });

    it('resolves absPath via mediaPathResolver for file blocks', async () => {
      const mediaSent = [];
      const mediaAdapter = {
        connectorId: 'feishu',
        async sendReply() {},
        async sendRichMessage() {},
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', mediaAdapter]]),
        log: noopLog(),
        mediaPathResolver: (url) => {
          if (url.startsWith('/uploads/')) return `/abs/path${url}`;
          return undefined;
        },
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'f1', kind: 'file', v: 1, url: '/uploads/doc.docx', fileName: 'doc.docx' }];
      await hook.deliver('thread-abc', 'Doc attached', 'opus', blocks);

      assert.equal(mediaSent.length, 1);
      assert.equal(mediaSent[0].payload.absPath, '/abs/path/uploads/doc.docx');
    });

    it('does not call sendMedia when adapter lacks sendMedia', async () => {
      const richSent = [];
      const noMediaAdapter = {
        connectorId: 'feishu',
        async sendReply(chatId, content) {
          feishuMock.sent.push({ chatId, content });
        },
        async sendRichMessage(chatId, text, blocks, catName) {
          richSent.push({ chatId, text, blocks, catName });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', noMediaAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'f1', kind: 'file', v: 1, url: '/uploads/report.pdf', fileName: 'report.pdf' }];
      // Should not throw
      await hook.deliver('thread-abc', 'Text', 'opus', blocks);
      assert.equal(richSent.length, 1, 'should fall back to sendRichMessage');
    });

    // P0 security: when resolver fails, do NOT pass raw url to adapter
    it('does not pass unresolved url to sendMedia (prevents file exfiltration)', async () => {
      const mediaSent = [];
      const mediaAdapter = {
        connectorId: 'feishu',
        async sendReply() {},
        async sendRichMessage() {},
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', mediaAdapter]]),
        log: noopLog(),
        mediaPathResolver: () => undefined, // resolver rejects all paths
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'f1', kind: 'file', v: 1, url: '/uploads/secret.pdf', fileName: 'secret.pdf' }];
      await hook.deliver('thread-abc', 'Text', 'opus', blocks);

      // File blocks should ONLY be sent when resolver succeeds (unlike images which have URL fallback)
      assert.equal(mediaSent.length, 0, 'file block must not be sent when resolver fails');
    });

    // P2: fileName should be passed through to adapter
    it('passes fileName to sendMedia for file blocks', async () => {
      const mediaSent = [];
      const mediaAdapter = {
        connectorId: 'feishu',
        async sendReply() {},
        async sendRichMessage() {},
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', mediaAdapter]]),
        log: noopLog(),
        mediaPathResolver: (url) => `/abs${url}`,
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'f1', kind: 'file', v: 1, url: '/uploads/report.pdf', fileName: '调研报告.pdf' }];
      await hook.deliver('thread-abc', 'Report', 'opus', blocks);

      assert.equal(mediaSent.length, 1);
      assert.equal(mediaSent[0].payload.fileName, '调研报告.pdf', 'fileName should be passed through');
    });

    it('passes cat identity to sendMedia for file blocks', async () => {
      const mediaSent = [];
      const mediaAdapter = {
        connectorId: 'im-web',
        async sendReply() {},
        async sendRichMessage() {},
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['im-web', mediaAdapter]]),
        log: noopLog(),
        mediaPathResolver: (url) => `/abs${url}`,
      });
      bindingStore.bind('im-web', '2:group-clowder', 'thread-abc', 'user-1');

      const blocks = [{ id: 'f1', kind: 'file', v: 1, url: '/uploads/report.pdf', fileName: '调研报告.pdf' }];
      await hook.deliver('thread-abc', 'Report', 'codex', blocks);

      assert.equal(mediaSent.length, 1);
      assert.equal(mediaSent[0].payload.catId, 'codex');
      assert.equal(mediaSent[0].payload.catDisplayName, '缅因猫');
    });

    it('adds the resolved local file size to file media payloads and rich file blocks', async () => {
      const mediaSent = [];
      const richSent = [];
      const mediaAdapter = {
        connectorId: 'im-web',
        async sendReply() {},
        async sendRichMessage(chatId, text, blocks, catName) {
          richSent.push({ chatId, text, blocks, catName });
        },
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };
      const tempDir = await mkdtemp(join(tmpdir(), 'clowder-file-size-'));
      const filePath = join(tempDir, 'report.pdf');
      await writeFile(filePath, Buffer.alloc(86660));
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['im-web', mediaAdapter]]),
        log: noopLog(),
        mediaPathResolver: (url) => url === '/uploads/report.pdf' ? filePath : undefined,
      });
      bindingStore.bind('im-web', '2:group-clowder', 'thread-abc', 'user-1');

      const blocks = [{ id: 'f1', kind: 'file', v: 1, url: '/uploads/report.pdf', fileName: 'report.pdf' }];
      await hook.deliver('thread-abc', 'Report', 'codex', blocks);

      assert.equal(richSent.length, 1);
      assert.equal(richSent[0].blocks[0].fileSize, 86660);
      assert.equal(mediaSent.length, 1);
      assert.equal(mediaSent[0].payload.size, 86660);
    });

    it('publishes local files to the uploads directory and rewrites the URLs', async () => {
      const mediaSent = [];
      const richSent = [];
      const mediaAdapter = {
        connectorId: 'im-web',
        async sendReply() {},
        async sendRichMessage(chatId, text, blocks, catName) {
          richSent.push({ chatId, text, blocks, catName });
        },
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };

      const tempDir = await mkdtemp(join(tmpdir(), 'clowder-local-publish-'));
      const localFilePath = join(tempDir, 'test_workspace.zip');
      const testContent = 'test zip content';
      await writeFile(localFilePath, testContent);

      const uploadDir = join(process.cwd(), 'uploads');
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['im-web', mediaAdapter]]),
        log: noopLog(),
        mediaPathResolver: (url) => {
          if (url.startsWith('/uploads/')) {
            return join(uploadDir, url.slice('/uploads/'.length));
          }
          return undefined;
        },
      });
      bindingStore.bind('im-web', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'f1', kind: 'file', v: 1, url: localFilePath, fileName: 'test_workspace.zip' }];
      await hook.deliver('thread-abc', 'Here is the packaged workspace', 'codex', blocks);

      assert.equal(mediaSent.length, 1);
      assert.equal(mediaSent[0].payload.type, 'file');
      assert.match(mediaSent[0].payload.url, /\/uploads\/f1-test_workspace-[a-f0-9]+\.zip/);
      assert.ok(mediaSent[0].payload.absPath.startsWith(uploadDir));
      assert.equal(mediaSent[0].payload.size, testContent.length);

      assert.equal(richSent.length, 1);
      assert.match(richSent[0].blocks[0].url, /\/uploads\/f1-test_workspace-[a-f0-9]+\.zip/);
      assert.equal(richSent[0].blocks[0].fileSize, testContent.length);
    });

    it('packages active Maomi workspace when final text references a missing local archive', async () => {
      const previousUploadDir = process.env.UPLOAD_DIR;
      const mediaSent = [];
      const replySent = [];
      const mediaAdapter = {
        connectorId: 'im-web',
        async sendReply(chatId, content) {
          replySent.push({ chatId, content });
        },
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };

      const tempDir = await mkdtemp(join(tmpdir(), 'clowder-maomi-archive-'));
      const workspaceRoot = join(tempDir, 'maomi_workspace');
      const uploadDir = join(tempDir, 'uploads');
      process.env.UPLOAD_DIR = uploadDir;
      await mkdir(workspaceRoot, { recursive: true });
      await writeFile(join(workspaceRoot, '.clowder-root.json'), '{"kind":"maomi_workspace_root"}\n');
      await writeFile(join(workspaceRoot, 'README.md'), '# Maomi Workspace\n');

      try {
        hook = new OutboundDeliveryHook({
          bindingStore,
          adapters: new Map([['im-web', mediaAdapter]]),
          log: noopLog(),
        });
        bindingStore.bind('im-web', 'chat-1', 'thread-abc', 'user-1');

        await hook.deliver(
          'thread-abc',
          '打包完成：/tmp/maomi_workspace.tar.gz',
          'codex',
          undefined,
          {
            threadShortId: 'thread-abc',
            artifactSearchRoots: [workspaceRoot],
          },
        );

        assert.equal(replySent.length, 0);
        assert.equal(mediaSent.length, 1);
        assert.equal(mediaSent[0].payload.type, 'file');
        assert.equal(mediaSent[0].payload.fileName, 'maomi_workspace.tar.gz');
        assert.match(mediaSent[0].payload.url, /\/uploads\/text-file-thread-abc-maomi_workspace-[a-f0-9]+\.tar\.gz/);
        assert.ok(mediaSent[0].payload.absPath.startsWith(uploadDir));
        const archiveInfo = await stat(mediaSent[0].payload.absPath);
        assert.ok(archiveInfo.size > 0);
        assert.equal(mediaSent[0].payload.size, archiveInfo.size);
      } finally {
        if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
        else process.env.UPLOAD_DIR = previousUploadDir;
      }
    });

    it('publishes tilde-prefixed local file references from final text', async () => {
      const previousUploadDir = process.env.UPLOAD_DIR;
      const mediaSent = [];
      const mediaAdapter = {
        connectorId: 'im-web',
        async sendReply() {},
        async sendMedia(chatId, payload) {
          mediaSent.push({ chatId, payload });
        },
      };

      const tempDir = await mkdtemp(join(homedir(), '.clowder-tilde-file-'));
      const uploadDir = join(tmpdir(), `clowder-tilde-uploads-${Date.now()}`);
      process.env.UPLOAD_DIR = uploadDir;
      const localFilePath = join(tempDir, 'maomi_workspace.tar.gz');
      await writeFile(localFilePath, 'archive bytes');
      const tildePath = `~/${relative(homedir(), localFilePath)}`;

      try {
        hook = new OutboundDeliveryHook({
          bindingStore,
          adapters: new Map([['im-web', mediaAdapter]]),
          log: noopLog(),
        });
        bindingStore.bind('im-web', 'chat-1', 'thread-abc', 'user-1');

        await hook.deliver('thread-abc', `文件在：${tildePath}`, 'codex');

        assert.equal(mediaSent.length, 1);
        assert.equal(mediaSent[0].payload.type, 'file');
        assert.equal(mediaSent[0].payload.fileName, 'maomi_workspace.tar.gz');
        assert.match(mediaSent[0].payload.url, /\/uploads\/text-file-thread-abc-maomi_workspace-[a-f0-9]+\.tar\.gz/);
      } finally {
        if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
        else process.env.UPLOAD_DIR = previousUploadDir;
      }
    });

    it('throws file_delivery_failed if publishing local file fails', async () => {
      const mediaAdapter = {
        connectorId: 'im-web',
        async sendReply() {},
        async sendRichMessage() {},
        async sendMedia() {},
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['im-web', mediaAdapter]]),
        log: noopLog(),
      });
      bindingStore.bind('im-web', 'chat-1', 'thread-abc', 'user-1');

      const blocks = [{ id: 'f1', kind: 'file', v: 1, url: '/nonexistent/file.zip', fileName: 'file.zip' }];
      await assert.rejects(
        () => hook.deliver('thread-abc', 'Failed file', 'codex', blocks),
        /file_delivery_failed/
      );
    });
  });

  describe('F134 replyToSender regression (P1 fixes)', () => {
    it('passes replyToSender metadata when messageLookup returns source.sender (AC-C1)', async () => {
      const messageLookup = async (_id) => ({
        source: { sender: { id: 'ou_abc123', name: 'Alice' } },
      });
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', feishuMock.adapter]]),
        log: noopLog(),
        messageLookup,
      });
      bindingStore.bind('feishu', 'group-chat-1', 'thread-grp', 'user-1');

      await hook.deliver('thread-grp', 'Reply', 'opus', undefined, undefined, undefined, 'msg-456');

      assert.equal(feishuMock.sent.length, 1);
      assert.deepEqual(feishuMock.sent[0].metadata, {
        replyToSender: { id: 'ou_abc123', name: 'Alice' },
      });
    });

    it('does NOT pass replyToSender when source has no sender — DM path (AC-C2)', async () => {
      const messageLookup = async (_id) => ({
        source: { connector: 'feishu', label: '飞书' },
      });
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', feishuMock.adapter]]),
        log: noopLog(),
        messageLookup,
      });
      bindingStore.bind('feishu', 'chat-dm', 'thread-dm', 'user-1');

      await hook.deliver('thread-dm', 'DM reply', 'opus', undefined, undefined, undefined, 'msg-dm-1');

      assert.equal(feishuMock.sent.length, 1);
      assert.equal(feishuMock.sent[0].metadata, undefined, 'DM replies must not include replyToSender');
    });

    it('does NOT call messageLookup when triggerMessageId is undefined', async () => {
      let lookupCalled = false;
      const messageLookup = async (_id) => {
        lookupCalled = true;
        return { source: { sender: { id: 'ou_xyz', name: 'Bob' } } };
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', feishuMock.adapter]]),
        log: noopLog(),
        messageLookup,
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-1', 'user-1');

      await hook.deliver('thread-1', 'Reply without trigger');

      assert.equal(lookupCalled, false, 'messageLookup must not be called when triggerMessageId is undefined');
      assert.equal(feishuMock.sent.length, 1);
      assert.equal(feishuMock.sent[0].metadata, undefined, 'no replyToSender without triggerMessageId');
    });

    it('does NOT pass replyToSender when messageLookup throws (graceful degradation)', async () => {
      const messageLookup = async (_id) => {
        throw new Error('Redis connection lost');
      };
      hook = new OutboundDeliveryHook({
        bindingStore,
        adapters: new Map([['feishu', feishuMock.adapter]]),
        log: noopLog(),
        messageLookup,
      });
      bindingStore.bind('feishu', 'chat-1', 'thread-1', 'user-1');

      await hook.deliver('thread-1', 'Reply', 'opus', undefined, undefined, undefined, 'msg-err');

      assert.equal(feishuMock.sent.length, 1);
      assert.equal(feishuMock.sent[0].metadata, undefined, 'failed lookup should not produce replyToSender');
    });
  });
});
