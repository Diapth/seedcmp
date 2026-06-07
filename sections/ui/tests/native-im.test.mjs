import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createNativeImService } from '../services/native-im/service.js';
import {
  applyDraftToConversationList,
  mergeRemoteDrafts,
  normalizeNativeGroup,
  upsertGroupConversation
} from '../services/native-im/conversation-state.js';

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
