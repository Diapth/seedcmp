import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createNativeImService,
  selectWsAddressForBrowser
} from '../services/native-im/service.js';
import {
  applyDraftToConversationList,
  mergeRemoteDrafts,
  normalizeNativeGroup,
  shouldPersistConversationDraft,
  upsertGroupConversation
} from '../services/native-im/conversation-state.js';
import { normalizeConversation } from '../services/native-im/normalizers.js';
import * as messageState from '../services/native-im/message-state.js';
import {
  formatChatTime,
  shouldShowMessageTime
} from '../utils/formatMessage.js';

function makeRequestStub(responses = {}) {
  const calls = [];
  const request = async (options) => {
    calls.push(options);
    const path = String(options.url).replace(/^https?:\/\/[^/]+\//, '').replace(/^\/v1\//, '');
    const key = `${options.method} ${path}`;
    const data = responses[key] ?? {};
    return { statusCode: 200, data };
  };
  request.calls = calls;
  return request;
}

test('native service updates remote conversation draft extra', async () => {
  const request = makeRequestStub();
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  await service.updateConversationExtra({
    channelId: 'group-a',
    channelType: 2,
    draft: '跨端草稿'
  });

  assert.equal(request.calls[0].method, 'POST');
  assert.equal(request.calls[0].url, '/v1/conversations/group-a/2/extra');
  assert.deepEqual(request.calls[0].data, {
    channel_id: 'group-a',
    channel_type: 2,
    draft: '跨端草稿'
  });
});

test('native service exposes group creation and member sync APIs', async () => {
  const request = makeRequestStub({
    'POST group/create': { group_no: 'g100', name: '研发群' },
    'GET group/my': { groups: [{ group_no: 'g100', name: '研发群', member_count: 3 }] },
    'GET groups/g100/membersync?version=0&limit=1000': {
      members: [{ uid: 'u1', name: '张伟', role: 1 }]
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const created = await service.createGroup({ name: '研发群', members: ['u1', 'u2'] });
  const groups = await service.syncMyGroups();
  const members = await service.syncGroupMembers('g100');

  assert.equal(created.id, 'g100');
  assert.equal(groups[0].id, 'g100');
  assert.equal(groups[0].memberCount, 3);
  assert.equal(members[0].id, 'u1');
  assert.equal(members[0].nickname, '张伟');
  assert.equal(members[0].role, 'admin');
});

test('native service uploads files before returning a public media url', async () => {
  const uploaded = [];
  const request = makeRequestStub({
    'GET file/upload?path=chat%2Fg1%2F2%2Fexample.txt&type=chat': {
      url: 'https://upload.example.test',
      path: '/files/example.txt'
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    uploadRequest: async ({ url, file }) => {
      uploaded.push({ url, file });
      return { path: '/files/example.txt' };
    },
    getToken: () => 'token'
  });

  const result = await service.uploadChatFile({
    channelId: 'g1',
    channelType: 2,
    file: { name: 'example.txt', size: 42, type: 'text/plain' }
  });

  assert.equal(request.calls[0].url, '/v1/file/upload?path=chat%2Fg1%2F2%2Fexample.txt&type=chat');
  assert.equal(uploaded[0].url, 'https://upload.example.test');
  assert.equal(result.url, '/files/example.txt');
  assert.equal(result.name, 'example.txt');
});

test('conversation helpers merge local and remote drafts predictably', () => {
  const conversations = [{ id: 'g1', channelId: 'g1', channelType: 2, draft: '' }];
  const withLocal = applyDraftToConversationList(conversations, 'g1', 2, '本机草稿');
  const merged = mergeRemoteDrafts(withLocal, [{ channelId: 'g1', channelType: 2, draft: '远端草稿' }], {
    dirtyKeys: new Set(['g1-2'])
  });
  const cleanMerged = mergeRemoteDrafts(withLocal, [{ channelId: 'g1', channelType: 2, draft: '远端草稿' }]);

  assert.equal(withLocal[0].draft, '本机草稿');
  assert.equal(merged[0].draft, '本机草稿');
  assert.equal(cleanMerged[0].draft, '远端草稿');
});

test('conversation draft persistence skips local robot and mock conversations', () => {
  assert.equal(
    shouldPersistConversationDraft({ id: 'clowder_ai', channelId: 'clowder_ai', channelType: 1, type: 'robot', isAgent: true }),
    false
  );
  assert.equal(
    shouldPersistConversationDraft({ id: '2', channelId: '2', channelType: 2, type: 'group', source: 'mock' }),
    false
  );
  assert.equal(
    shouldPersistConversationDraft({ id: 'group-a', channelId: 'group-a', channelType: 2, type: 'group' }),
    true
  );
});

test('websocket address selection prefers ws for local http h5 sessions', () => {
  assert.equal(
    selectWsAddressForBrowser({
      wss_addr: 'wss://100.79.157.76:5210/',
      ws_addr: '100.79.157.76:5210'
    }, {
      protocol: 'http:',
      locationHostname: '100.79.157.76'
    }),
    'ws://100.79.157.76:5210/'
  );
  assert.equal(
    selectWsAddressForBrowser({
      wss_addr: 'wss://im.example.com/ws',
      ws_addr: 'im.example.com/ws'
    }, {
      protocol: 'https:',
      locationHostname: 'app.example.com'
    }),
    'wss://im.example.com/ws'
  );
});

test('conversation helpers normalize groups and upsert channelType 2 conversations', () => {
  const group = normalizeNativeGroup({ group_no: 'g2', name: '项目群', member_count: 5, notice: 'hello' });
  const conversations = upsertGroupConversation([], group);

  assert.equal(group.id, 'g2');
  assert.equal(group.memberCount, 5);
  assert.equal(conversations[0].id, 'g2');
  assert.equal(conversations[0].channelType, 2);
  assert.equal(conversations[0].type, 'group');
  assert.equal(conversations[0].name, '项目群');
  assert.equal(conversations[0].memberCount, 5);
});

test('conversation normalizer uses last message timestamp instead of sync time fallback', () => {
  const conversation = normalizeConversation({
    channel_id: 'g-last',
    channel_type: 2,
    recents: [
      {
        timestamp: 1780490300,
        payload: JSON.stringify({ type: 1, content: '最后一条群消息' })
      }
    ]
  }, {
    name: '最后消息群'
  });

  assert.equal(conversation.lastMessage, '最后一条群消息');
  assert.equal(conversation.lastTime, 1780490300000);
});

test('group upsert uses group last message time and does not invent current time', () => {
  const withLastMessage = upsertGroupConversation([], {
    group_no: 'g-last',
    name: '最后消息群',
    last_msg_time: 1780490300,
    last_message: {
      payload: JSON.stringify({ type: 1, content: '群里真实最后消息' })
    }
  });
  const withoutAnyMessageTime = upsertGroupConversation([], {
    group_no: 'g-empty',
    name: '空时间群'
  });

  assert.equal(withLastMessage[0].lastMessage, '群里真实最后消息');
  assert.equal(withLastMessage[0].lastTime, 1780490300000);
  assert.equal(withoutAnyMessageTime[0].lastTime, 0);
});

test('time helpers accept second and millisecond timestamps with five minute message dividers', () => {
  const now = new Date(2026, 5, 8, 12, 0, 0).getTime();
  const tenFiveMs = new Date(2026, 5, 8, 10, 5, 0).getTime();
  const tenFiveSeconds = Math.floor(tenFiveMs / 1000);

  assert.equal(formatChatTime(tenFiveSeconds, now), '10:05');
  assert.equal(formatChatTime(tenFiveMs, now), '10:05');
  assert.equal(
    shouldShowMessageTime({ time: now }, { time: now - 4 * 60 * 1000 }),
    false
  );
  assert.equal(
    shouldShowMessageTime({ time: now }, { time: now - 6 * 60 * 1000 }),
    true
  );
});

test('clowder stream events merge placeholder chunks final markdown and generated files', () => {
  assert.equal(typeof messageState.mergeAgentReplyEventIntoList, 'function');

  let list = messageState.mergeAgentReplyEventIntoList([], {
    streamKey: 'stream-1',
    phase: 'placeholder',
    senderId: 'clowder',
    senderName: 'Clowder 协同猫',
    content: '正在思考...'
  });

  list = messageState.mergeAgentReplyEventIntoList(list, {
    streamKey: 'stream-1',
    phase: 'chunk',
    delta: '| 名称 | 状态 |\\n| --- | --- |\\n'
  });

  list = messageState.mergeAgentReplyEventIntoList(list, {
    streamKey: 'stream-1',
    phase: 'final',
    content: '| 名称 | 状态 |\\n| --- | --- |\\n| Codex | 完成 |',
    files: [{ id: 'report', name: '验收报告.md', url: '/files/report.md', size: 1024 }]
  });

  assert.equal(list.length, 2);
  assert.equal(list[0].id, 'stream-1');
  assert.equal(list[0].status, 'success');
  assert.equal(list[0].streaming, false);
  assert.equal(list[0].renderMode, 'markdown');
  assert.match(list[0].content, /Codex/);
  assert.equal(list[1].type, 'file');
  assert.equal(list[1].fileName, '验收报告.md');
  assert.equal(list[1].generatedByAgent, true);
});

test('conversation summary turns long clowder markdown into one line preview', () => {
  const summary = messageState.conversationSummaryForMessage({
    senderId: 'clowder',
    senderName: 'Clowder AI',
    type: 'text',
    content: [
      '## 当前在线猫猫',
      '',
      '| 猫猫 | 状态 | 任务 |',
      '| --- | --- | --- |',
      '| Codex | 在线 | 修复消息发送 |',
      '| Claude Code | 忙碌 | 复核 Markdown 渲染 |',
      '',
      '> 以上信息会继续同步更新。'
    ].join('\n')
  }, {}, { type: 'robot' });

  assert.equal(summary.includes('\n'), false);
  assert.equal(summary.includes('|'), false);
  assert.equal(summary.includes('---'), false);
  assert.match(summary, /^当前在线猫猫/);
  assert.ok(summary.length <= 80);
});

test('sdk unavailable send errors keep local h5 demo messages successful', () => {
  assert.equal(typeof messageState.shouldKeepLocalSendSuccess, 'function');
  assert.equal(
    messageState.shouldKeepLocalSendSuccess(
      { msg: 'WKSDK.shared 不可用', sdkUnavailable: true },
      { id: 'clowder', type: 'robot', source: 'mock' }
    ),
    true
  );
  assert.equal(
    messageState.shouldKeepLocalSendSuccess(
      { message: 'server rejected message' },
      { id: '2', type: 'group' }
    ),
    false
  );
});

test('mock h5 native send results do not leave local messages sending forever', () => {
  assert.equal(typeof messageState.resolveLocalSendStatus, 'function');
  assert.equal(
    messageState.resolveLocalSendStatus({ status: 'sending' }, { id: '3', type: 'robot', source: 'mock' }),
    'success'
  );
  assert.equal(
    messageState.resolveLocalSendStatus({ status: 'failed' }, { id: '3', type: 'robot', source: 'mock' }),
    'failed'
  );
  assert.equal(
    messageState.resolveLocalSendStatus({ status: 'sending' }, { id: 'g1', type: 'group' }),
    'sending'
  );
});

test('message sender helpers tolerate empty current user during anonymous visual smoke', () => {
  assert.equal(messageState.isSelfSender('me', null), true);
  assert.equal(messageState.resolveSelfId(null), 'me');
  assert.equal(messageState.resolveSelfName(null), '我');
  assert.equal(messageState.resolveSelfAvatar(null), '');
});

test('agent helpers create direct conversations and group mention members', async () => {
  const {
    createAgentConversation,
    createAgentMember
  } = await import('../services/native-im/agent-state.js');

  const agent = {
    id: 'codex',
    name: 'Codex',
    alias: '@codex',
    desc: '代码生成专家',
    status: 'active'
  };

  const conversation = createAgentConversation(agent);
  const member = createAgentMember(agent);

  assert.equal(conversation.id, 'codex');
  assert.equal(conversation.type, 'robot');
  assert.equal(conversation.lastMessage, '代码生成专家');
  assert.equal(member.id, 'codex');
  assert.equal(member.nickname, 'Codex');
  assert.equal(member.isAgent, true);
  assert.equal(member.alias, '@codex');
});
