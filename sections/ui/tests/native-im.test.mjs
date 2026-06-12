import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createNativeImService,
  selectWsAddressForBrowser,
  shouldPreferDirectClowderDirectory
} from '../services/native-im/service.js';
import {
  createLocalOAuthCapabilityLoader,
  resolveLocalOAuthStatus
} from '../services/native-im/oauth.js';
import {
  applyDraftToConversationList,
  buildGroupScopedRoute,
  createDeletedConversationRecord,
  conversationDeleteKey,
  conversationDisplayUnread,
  filterDeletedConversations,
  filterDeletedGroups,
  mergeRemoteDrafts,
  mergeNativeConversationTimeline,
  normalizeNativeGroup,
  shouldSuppressDeletedConversation,
  resolveGroupPageId,
  shouldPersistConversationDraft,
  totalDisplayUnread,
  upsertGroupConversation
} from '../services/native-im/conversation-state.js';
import {
  normalizeContent,
  normalizeConversation,
  normalizeMessage
} from '../services/native-im/normalizers.js';
import * as messageState from '../services/native-im/message-state.js';
import {
  createReplyTarget,
  replyTargetForConversation,
  shouldClearReplyTargetOnConversationChange
} from '../services/native-im/reply-state.js';
import {
  formatConversationPreview
} from '../utils/formatConversation.js';
import {
  formatChatTime,
  shouldShowMessageTime
} from '../utils/formatMessage.js';
import {
  collectProjectBoardDocuments,
  deriveProjectGroupInfoOverview,
  mergeSharedFilesWithBoardDocuments,
  normalizeClowderProjectBoard,
  resolveProjectBoardThreadIds,
  shouldSyncRemoteProjectBoard
} from '../services/native-im/project-board.js';
import {
  previewContentOrEmpty,
  resolvePreviewFileSource
} from '../services/native-im/file-preview.js';
import {
  cleanupAgentFromLocalState,
  filterDeletedAgents,
  markAgentDeleted,
  resolveAgentDeleteIdentity
} from '../services/native-im/agent-cleanup.js';
import {
  createAgentConversation,
  findAgentForConversation,
  mergeGroupMembersWithAgentMembers
} from '../services/native-im/agent-state.js';
import {
  buildSelectableGroupMembers,
  splitSelectedGroupMembers
} from '../services/native-im/group-member-candidates.js';
import {
  normalizeSkillCatalogPreview,
  normalizeUserSkillList
} from '../services/native-im/skill-state.js';
import {
  applyRoleTemplateToForm,
  buildRoleTemplateOptions
} from '../services/native-im/role-template-sync.js';
import {
  buildDeploymentCardMessage,
  isDeploymentCardMessage,
  shouldCreateDeploymentCard,
  updateDeploymentCardMessage,
  upsertDeploymentCardMessage
} from '../services/native-im/deployment.js';
import {
  buildPreviewFilePayload
} from '../services/native-im/file-preview.js';
import {
  applyManualContextPinsToMessages,
  buildManualContextPinPayload,
  resolveConversationThreadId
} from '../services/native-im/manual-context-pins.js';
import {
  resolveTextPreSendEffects,
  runTextPostSendEffects
} from '../services/native-im/send-flow.js';

function makeRequestStub(responses = {}) {
  const calls = [];
  const request = async (options) => {
    calls.push(options);
    const path = String(options.url).replace(/^https?:\/\/[^/]+\//, '').replace(/^\/v1\//, '');
    const key = `${options.method} ${path}`;
    const matched = Object.prototype.hasOwnProperty.call(responses, key) ? responses[key] : {};
    const explicitHttpStatus = matched && typeof matched === 'object'
      && (
        Object.prototype.hasOwnProperty.call(matched, 'statusCode')
        || (
          Object.prototype.hasOwnProperty.call(matched, 'data')
          && Object.prototype.hasOwnProperty.call(matched, 'status')
          && Number.isFinite(Number(matched.status))
        )
      );
    if (explicitHttpStatus) {
      return {
        statusCode: matched.statusCode ?? matched.status ?? 200,
        data: Object.prototype.hasOwnProperty.call(matched, 'data') ? matched.data : matched
      };
    }
    return { statusCode: 200, data: matched };
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

test('native service tolerates TangSeng conversation extra command notify failure', async () => {
  const request = makeRequestStub({
    'POST conversations/group-a/2/extra': {
      statusCode: 400,
      data: { msg: '发送同步扩展会话cmd失败！' }
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const result = await service.updateConversationExtra({
    channelId: 'group-a',
    channelType: 2,
    draft: '跨端草稿'
  });

  assert.equal(result.extraPersisted, true);
  assert.equal(result.commandNotifyFailed, true);
  assert.equal(request.calls[0].method, 'POST');
  assert.deepEqual(request.calls[0].data, {
    channel_id: 'group-a',
    channel_type: 2,
    draft: '跨端草稿'
  });
});

test('native service clears remote conversation unread count', async () => {
  const request = makeRequestStub();
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  await service.clearConversationUnread({
    channelId: 'clowder_cat:opus',
    channelType: 1
  });

  assert.equal(request.calls[0].method, 'PUT');
  assert.equal(request.calls[0].url, '/v1/coversation/clearUnread');
  assert.deepEqual(request.calls[0].data, {
    channel_id: 'clowder_cat:opus',
    channel_type: 1,
    unread: 0,
    message_seq: 0
  });
});

test('normalizes real outbound file preview metadata', () => {
  const normalized = normalizeMessage({
    id: 'm-file',
    from_uid: 'clowder:frontend',
    from_name: 'Frontend',
    payload: {
      type: 8,
      name: 'RiverWatch_展示首页.html',
      size: 18200,
      url: '/assets/RiverWatch_%E5%B1%95%E7%A4%BA%E9%A6%96%E9%A1%B5.html',
      fileType: 'html',
      mimeType: 'text/html',
      previewContent: '<h1>RiverWatch</h1>',
      sourceUrl: '/assets/RiverWatch_%E5%B1%95%E7%A4%BA%E9%A6%96%E9%A1%B5.html'
    }
  });

  assert.equal(normalized.type, 'file');
  assert.equal(normalized.fileName, 'RiverWatch_展示首页.html');
  assert.equal(normalized.fileType, 'html');
  assert.equal(normalized.mimeType, 'text/html');
  assert.equal(normalized.previewContent, '<h1>RiverWatch</h1>');
  assert.equal(normalized.sourceUrl, '/assets/RiverWatch_%E5%B1%95%E7%A4%BA%E9%A6%96%E9%A1%B5.html');
  assert.equal(normalized.fileSize, 18200);
});

test('normalizes file preview content by ignoring boolean preview flags', () => {
  const normalized = normalizeMessage({
    id: 'm-md-file',
    payload: {
      type: 8,
      name: 'RiverWatch_技术README.md',
      url: '/assets/riverwatch-readme.md',
      fileType: 'md',
      previewContent: true,
      metadata: {
        previewContent: '# RiverWatch Vue CDN 技术 README'
      }
    }
  });

  assert.equal(normalized.type, 'file');
  assert.equal(normalized.fileType, 'md');
  assert.equal(normalized.previewContent, '# RiverWatch Vue CDN 技术 README');
});

test('clowder group outbound messages keep cat display sender', () => {
  const normalized = normalizeMessage({
    id: 'm-cat-file',
    from_uid: 'u_owner',
    from_name: 'RiverWatch 演示用户',
    payload: {
      type: 8,
      name: 'RiverWatch_项目汇报.pptx',
      url: '/assets/RiverWatch_%E9%A1%B9%E7%9B%AE%E6%B1%87%E6%8A%A5.pptx',
      cat_id: 'deck-strategist',
      cat_display_name: 'Deck Strategist'
    }
  });
  const enriched = messageState.enrichNativeMessageSender(normalized, {
    id: 'group-riverwatch',
    type: 'group'
  }, {
    id: 'u_owner',
    nickname: 'RiverWatch 演示用户'
  });

  assert.equal(enriched.senderId, 'deck-strategist');
  assert.equal(enriched.senderName, 'Deck Strategist');
  assert.equal(enriched.fileName, 'RiverWatch_项目汇报.pptx');
});

test('native service deletes remote conversation through TangSeng recent conversation API', async () => {
  const request = makeRequestStub();
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  await service.deleteConversation({
    channelId: 'clowder_cat:architect',
    channelType: 1
  });

  assert.equal(request.calls[0].method, 'DELETE');
  assert.equal(request.calls[0].url, '/v1/conversations/clowder_cat%3Aarchitect/1');
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

test('native service updates group notice through real group profile API', async () => {
  const request = makeRequestStub();
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  await service.updateGroupProfile('g-notice', { notice: '置顶内容验收 20260609' });

  assert.equal(request.calls[0].method, 'PUT');
  assert.equal(request.calls[0].url, '/v1/groups/g-notice');
  assert.deepEqual(request.calls[0].data, { notice: '置顶内容验收 20260609' });
});

test('native service fetches and deletes real user devices', async () => {
  const request = makeRequestStub({
    'GET user/devices': {
      devices: [
        {
          device_id: 'web-current',
          device_name: 'Chrome Browser',
          device_model: 'Linux',
          device_flag: 1,
          last_login: 1780490300,
          login_addr: '北京'
        },
        {
          id: 'dev-web',
          device_name: 'MacBook Pro 16"',
          device_model: 'Safari',
          device_flag: 2,
          last_login: 1780480000000,
          login_addr: '上海'
        }
      ]
    },
    'DELETE user/devices/dev-web': {}
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token',
    deviceFactory: () => ({ device_id: 'web-current' })
  });

  const devices = await service.fetchDevices();
  await service.deleteDevice('dev-web');

  assert.equal(request.calls[0].method, 'GET');
  assert.equal(request.calls[0].url, '/v1/user/devices');
  assert.equal(request.calls[1].method, 'DELETE');
  assert.equal(request.calls[1].url, '/v1/user/devices/dev-web');
  assert.deepEqual(devices.map((device) => ({
    id: device.id,
    name: device.name,
    type: device.type,
    lastActive: device.lastActive,
    location: device.location,
    isCurrent: device.isCurrent
  })), [
    {
      id: 'web-current',
      name: 'Chrome Browser',
      type: 'web',
      lastActive: '2026-06-03 20:38',
      location: '北京',
      isCurrent: true
    },
    {
      id: 'dev-web',
      name: 'MacBook Pro 16"',
      type: 'desktop',
      lastActive: '2026-06-03 17:46',
      location: '上海',
      isCurrent: false
    }
  ]);
});

test('native service sends register code and creates a real account session', async () => {
  const request = makeRequestStub({
    'POST user/sms/registercode': {},
    'POST user/register': {
      uid: 'u-register-20260609',
      name: '注册验收用户',
      token: 'register-token'
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => '',
    deviceFactory: () => ({
      device_id: 'web-register',
      device_name: 'Chrome',
      device_model: 'Linux'
    })
  });

  await service.sendRegisterCode({ phone: '19608162821' });
  const session = await service.registerAccount({
    phone: '19608162821',
    code: '123456',
    name: '注册验收用户',
    password: '123456'
  });

  assert.equal(request.calls[0].method, 'POST');
  assert.equal(request.calls[0].url, '/v1/user/sms/registercode');
  assert.deepEqual(request.calls[0].data, { zone: '0086', phone: '19608162821' });
  assert.equal(request.calls[1].method, 'POST');
  assert.equal(request.calls[1].url, '/v1/user/register');
  assert.deepEqual(request.calls[1].data, {
    zone: '0086',
    phone: '19608162821',
    name: '注册验收用户',
    code: '123456',
    password: '123456',
    flag: 1,
    device: {
      device_id: 'web-register',
      device_name: 'Chrome',
      device_model: 'Linux'
    }
  });
  assert.equal(session.token, 'register-token');
  assert.equal(session.user.id, 'u-register-20260609');
  assert.equal(session.user.nickname, '注册验收用户');
});

test('native service updates the current user profile through real profile API', async () => {
  const request = makeRequestStub({
    'PUT user/current': {
      uid: 'u-profile',
      name: '资料验收昵称',
      phone: '13733632709',
      short_no: 'profile_20260609',
      sex: 1,
      token: 'profile-token'
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'profile-token'
  });

  const session = await service.updateCurrentUserProfile({
    name: '资料验收昵称',
    shortNo: 'profile_20260609',
    sex: 1,
    ignored: 'nope'
  });

  assert.equal(request.calls[0].method, 'PUT');
  assert.equal(request.calls[0].url, '/v1/user/current');
  assert.deepEqual(request.calls[0].data, {
    name: '资料验收昵称',
    short_no: 'profile_20260609',
    sex: 1
  });
  assert.equal(session.user.id, 'u-profile');
  assert.equal(session.user.nickname, '资料验收昵称');
  assert.equal(session.user.shortNo, 'profile_20260609');
});

test('native service fetches clowder cat directory as agent cards', async () => {
  const rawAgent = {
    catId: 'xtz',
    displayName: '协调者',
    mentionPatterns: ['@xtz', '@协调者'],
    personalitySummary: '稳健拆解任务',
    capabilitySummary: '需求澄清、多智能体编排',
    available: true,
    preferred: true
  };
  const request = makeRequestStub({
    'GET clowder/cats?includeUnavailable=true': {
      agents: [rawAgent],
      preferredCatIds: ['xtz']
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const directory = await service.fetchClowderCatDirectory({ includeUnavailable: true });

  assert.equal(request.calls[0].method, 'GET');
  assert.equal(request.calls[0].url, '/v1/clowder/cats?includeUnavailable=true');
  assert.equal(directory.agents.length, 1);
  assert.deepEqual(directory.agents[0], {
    id: 'xtz',
    uid: 'xtz',
    catId: 'xtz',
    directCatId: 'xtz',
    name: '协调者',
    nickname: '协调者',
    alias: '@xtz',
    desc: '需求澄清、多智能体编排',
    avatar: '',
    status: 'active',
    creator: 'System',
    platform: 'clowder',
    clientId: '',
    accessMode: 'backend',
    authType: '',
    model: '',
    accountRef: '',
    apiKey: '',
    apiUrl: '',
    customModel: '',
    systemPrompt: '稳健拆解任务',
    roleTemplate: 'general',
    templateId: 'general',
    capabilityTags: ['需求澄清', '多智能体编排'],
    isAgent: true,
    connected: true,
    source: 'clowder',
    preferred: true,
    raw: rawAgent
  });
});

test('native service preserves clowder cat provider metadata from directory', async () => {
  const request = makeRequestStub({
    'GET clowder/cats?includeUnavailable=true': {
      agents: [{
        catId: 'runtime-cat-source',
        displayName: '狸花猫（资料整理师）',
        clientId: 'openai',
        authType: 'oauth',
        accountRef: 'codex',
        source: 'runtime-created',
        available: true
      }]
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const directory = await service.fetchClowderCatDirectory({ includeUnavailable: true });
  assert.equal(directory.agents[0].platform, 'openai');
  assert.equal(directory.agents[0].clientId, 'openai');
  assert.equal(directory.agents[0].accessMode, 'oauth');
  assert.equal(directory.agents[0].authType, 'oauth');
  assert.equal(directory.agents[0].accountRef, 'codex');
});

test('clowder agent conversations preserve provider metadata for coordinator gates', async () => {
  const { createAgentConversation, createAgentMember } = await import('../services/native-im/agent-state.js');
  const agent = {
    id: 'riverpm',
    catId: 'riverpm',
    name: 'RiverWatch PM',
    source: 'clowder',
    platform: 'anthropic',
    clientId: 'anthropic',
    accessMode: 'oauth',
    authType: 'oauth',
    accountRef: 'claude'
  };

  const conversation = createAgentConversation(agent);
  assert.equal(conversation.platform, 'anthropic');
  assert.equal(conversation.clientId, 'anthropic');
  assert.equal(conversation.accessMode, 'oauth');
  assert.equal(conversation.authType, 'oauth');
  assert.equal(conversation.accountRef, 'claude');

  const member = createAgentMember(agent);
  assert.equal(member.platform, 'anthropic');
  assert.equal(member.clientId, 'anthropic');
  assert.equal(member.accessMode, 'oauth');
  assert.equal(member.authType, 'oauth');
  assert.equal(member.accountRef, 'claude');
});

test('native service uses TangSeng clowder directory unless direct mode is explicit', () => {
  assert.equal(shouldPreferDirectClowderDirectory(), false);
  assert.equal(shouldPreferDirectClowderDirectory({}), false);
  assert.equal(shouldPreferDirectClowderDirectory({ preferDirect: false }), false);
  assert.equal(shouldPreferDirectClowderDirectory({ preferDirect: true }), true);
});

test('native service marks user-scoped clowder contacts as custom agent cards', async () => {
  const rawRuntimeAgent = {
    catId: 'clowder_cat:issue-036-runtime',
    displayName: 'Issue 036 Runtime',
    source: 'runtime-created',
    capabilitySummary: '用户刚创建的智能体',
    available: true
  };
  const rawUserAgent = {
    catId: 'issue-036-user-created',
    displayName: 'Issue 036 User Created',
    source: 'user-created',
    capabilitySummary: '历史创建智能体',
    available: true
  };
  const rawContactAgent = {
    catId: 'issue-036-contact',
    displayName: 'Issue 036 Contact',
    sourceType: 'contact',
    capabilitySummary: '用户联系人智能体',
    available: true
  };
  const rawExistingAgent = {
    catId: 'issue-036-existing',
    displayName: 'Issue 036 Existing',
    source: 'existing',
    capabilitySummary: '用户已连接智能体',
    available: true
  };
  const rawTemplate = {
    roleTemplateId: 'official-reviewer',
    displayName: 'Official Reviewer',
    source: 'role-template',
    capabilitySummary: '官方审查模板'
  };
  const request = makeRequestStub({
    'GET clowder/cats?includeUnavailable=true': {
      agents: [rawRuntimeAgent, rawUserAgent, rawContactAgent, rawExistingAgent],
      templates: [rawTemplate]
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const directory = await service.fetchClowderCatDirectory({ includeUnavailable: true });
  const creatorById = Object.fromEntries(directory.agents.map((agent) => [agent.id, agent.creator]));

  assert.equal(request.calls[0].url, '/v1/clowder/cats?includeUnavailable=true');
  assert.equal(creatorById['clowder_cat:issue-036-runtime'], 'User');
  assert.equal(creatorById['issue-036-user-created'], 'User');
  assert.equal(creatorById['issue-036-contact'], 'User');
  assert.equal(creatorById['issue-036-existing'], 'User');
  assert.equal(creatorById['official-reviewer'], 'System');
});

test('native service keeps runtime-created cats distinct from their role templates', async () => {
  const request = makeRequestStub({
    'GET clowder/cats?includeUnavailable=true': {
      agents: [{
        id: 'custom-qa-cat',
        roleTemplateId: 'qa',
        displayName: '英短（QA工程师）',
        source: 'runtime-created',
        capabilitySummary: '自动化测试、回归验证',
        available: true
      }],
      templates: [{
        roleTemplateId: 'qa',
        displayName: '官方 QA 模板',
        source: 'role-template',
        capabilitySummary: '测试策略'
      }]
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const directory = await service.fetchClowderCatDirectory({ includeUnavailable: true });

  assert.deepEqual(directory.agents.map((agent) => agent.id), ['custom-qa-cat', 'qa']);
  assert.equal(directory.agents[0].catId, 'custom-qa-cat');
  assert.equal(directory.agents[0].creator, 'User');
  assert.equal(directory.agents[1].creator, 'System');
});

test('native service scans clowder templates as official agent cards', async () => {
  const rawTemplate = {
    roleTemplateId: 'coordinator',
    catId: 'coordinator',
    displayName: 'Clowder AI',
    mentionPatterns: ['@clowder', '@协调者'],
    personalitySummary: '官方协同调度',
    capabilitySummary: '多智能体编排、任务拆解',
    cloneable: true,
    source: 'role-template'
  };
  const request = makeRequestStub({
    'GET clowder/cats?includeUnavailable=true': {
      agents: [],
      templates: [rawTemplate]
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const directory = await service.fetchClowderCatDirectory({ includeUnavailable: true });

  assert.equal(directory.agents.length, 1);
  assert.equal(directory.agents[0].id, 'coordinator');
  assert.equal(directory.agents[0].name, 'Clowder AI');
  assert.equal(directory.agents[0].creator, 'System');
  assert.equal(directory.agents[0].source, 'clowder');
  assert.equal(directory.agents[0].raw.source, 'role-template');
  assert.deepEqual(directory.agents[0].capabilityTags, ['多智能体编排', '任务拆解']);
});

test('native service fetches user skills separately from marketplace skills', async () => {
  const request = makeRequestStub({
    'GET clowder/skills/summary': {
      skills: [{ id: 'user-skill-1', name: 'tdd', enabled: true, agentIds: ['codex'] }]
    },
    'GET clowder/skills': {
      skills: [{ id: 'user-skill-1', name: 'tdd', enabled: true, agentIds: ['codex'] }]
    },
    'GET clowder/skills/marketplace': {
      skills: [
        { id: 'codex:tdd', name: 'tdd', sourceType: 'official', provider: 'codex', added: true },
        { id: 'claude:review', name: 'review', sourceType: 'project', provider: 'claude', added: false }
      ]
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const summary = await service.fetchSkillSummary();
  const mine = await service.fetchUserSkills();
  const marketplace = await service.fetchSkillMarketplace();

  assert.equal(summary[0].id, 'user-skill-1');
  assert.equal(mine[0].assignedAgentCount, 1);
  assert.equal(marketplace[0].added, true);
  assert.equal(marketplace[1].sourceType, 'project');
  assert.deepEqual(request.calls.map((call) => `${call.method} ${call.url}`), [
    'GET /v1/clowder/skills/summary',
    'GET /v1/clowder/skills',
    'GET /v1/clowder/skills/marketplace'
  ]);
});

test('native service mutates user skill ownership and assignments by explicit ids', async () => {
  const request = makeRequestStub({
    'POST clowder/skills/codex%3Atdd/add': {
      skill: { id: 'user-skill-1', sourceId: 'codex:tdd', name: 'tdd', enabled: true, agentIds: [] }
    },
    'PATCH clowder/skills/user-skill-1': {
      skill: { id: 'user-skill-1', name: 'tdd', enabled: false, agentIds: [] }
    },
    'PUT clowder/skills/user-skill-1/assignments': {
      skill: { id: 'user-skill-1', name: 'tdd', enabled: false, agentIds: ['codex'] }
    },
    'DELETE clowder/skills/user-skill-1': { ok: true }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const added = await service.addMarketplaceSkill('codex:tdd');
  const updated = await service.updateUserSkill('user-skill-1', { enabled: false });
  const assigned = await service.updateSkillAssignments('user-skill-1', ['codex']);
  const deleted = await service.deleteUserSkill('user-skill-1');

  assert.equal(added.sourceId, 'codex:tdd');
  assert.equal(updated.enabled, false);
  assert.deepEqual(assigned.agentIds, ['codex']);
  assert.equal(deleted.ok, true);
  assert.deepEqual(request.calls.map((call) => [call.method, call.url, call.data]), [
    ['POST', '/v1/clowder/skills/codex%3Atdd/add', { sourceId: 'codex:tdd' }],
    ['PATCH', '/v1/clowder/skills/user-skill-1', { enabled: false }],
    ['PUT', '/v1/clowder/skills/user-skill-1/assignments', { agentIds: ['codex'] }],
    ['DELETE', '/v1/clowder/skills/user-skill-1', undefined]
  ]);
});

test('native service uploads skill packages through multipart upload runtime', async () => {
  const uploadCalls = [];
  const service = createNativeImService({
    baseUrl: '/v1/',
    request: makeRequestStub(),
    getToken: () => 'token',
    uploadRequest: async (options) => {
      uploadCalls.push(options);
      return {
        skill: {
          id: 'uploaded-skill-1',
          name: 'review-helper',
          enabled: true,
          sourceType: 'uploaded',
          agentIds: ['codex']
        }
      };
    }
  });

  const uploaded = await service.uploadSkillPackage({
    name: 'review-helper.skill.zip',
    file: {
      name: 'review-helper.skill.zip',
      tempFilePath: '/tmp/review-helper.skill.zip'
    }
  });

  assert.equal(uploaded.id, 'uploaded-skill-1');
  assert.equal(uploaded.sourceType, 'uploaded');
  assert.deepEqual(uploaded.agentIds, ['codex']);
  assert.deepEqual(uploadCalls, [{
    url: '/v1/clowder/skills/upload',
    file: {
      name: 'review-helper.skill.zip',
      tempFilePath: '/tmp/review-helper.skill.zip'
    },
    fieldName: 'file',
    headers: { token: 'token' }
  }]);
});

test('deployment helper detects deployment intent in clowder direct chats and project groups', () => {
  const clowderDirect = {
    id: 'clowder_cat:codex',
    channelId: 'clowder_cat:codex',
    channelType: 1,
    type: 'robot',
    source: 'clowder',
    directCatId: 'codex'
  };
  const normalDirect = {
    id: 'u-friend',
    channelId: 'u-friend',
    channelType: 1,
    type: 'single'
  };
  const projectGroup = {
    id: 'riverwatch-group',
    channelId: 'riverwatch-group',
    channelType: 2,
    type: 'group',
    source: 'clowder',
    isProjectGroup: true,
    projectThreadId: 'thread-riverwatch',
    projectCoordinatorCatId: 'riverwatch-pm'
  };
  const normalGroup = {
    id: 'team-group',
    channelId: 'team-group',
    channelType: 2,
    type: 'group'
  };

  assert.equal(shouldCreateDeploymentCard({ conversation: clowderDirect, text: '帮我把这个项目部署到 preview 环境' }), true);
  assert.equal(shouldCreateDeploymentCard({ conversation: projectGroup, text: '请部署当前最新的 RiverWatch_展示首页_v2.html 到 preview 环境。' }), true);
  assert.equal(shouldCreateDeploymentCard({
    conversation: clowderDirect,
    text: '我想做一个 RiverWatch 河流水质数据看板项目，请你作为 PM 创建项目群并组织多智能体分工执行。交付物需要包括 preview 部署链接。'
  }), false);
  assert.equal(shouldCreateDeploymentCard({
    conversation: projectGroup,
    text: '我想做一个 RiverWatch 河流水质数据看板项目，请你作为 PM 创建项目群并组织多智能体分工执行。交付物需要包括 preview 部署链接。'
  }), false);
  assert.equal(shouldCreateDeploymentCard({ conversation: clowderDirect, text: '先不部署，继续改文案' }), false);
  assert.equal(shouldCreateDeploymentCard({ conversation: normalDirect, text: '帮我部署到线上' }), false);
  assert.equal(shouldCreateDeploymentCard({ conversation: normalGroup, text: '帮我部署到 preview 环境' }), false);
});

test('native service uses conversation deployment request endpoints', async () => {
  const request = makeRequestStub({
    'POST clowder/conversation/deployment-request': {
      deploymentRequest: {
        id: 'deploy-req-1',
        channelId: 'clowder_cat:codex',
        channelType: 1,
        originalText: '部署这个项目',
        target: 'demo-app',
        environment: 'preview',
        missingFields: [],
        status: 'pending_confirmation',
        downloadUrl: 'http://localhost:3004/api/deployments/job-1/download'
      }
    },
    'PATCH clowder/conversation/deployment-request/deploy-req-1': {
      deploymentRequest: { id: 'deploy-req-1', target: 'demo-app', environment: 'preview', missingFields: [], status: 'pending_confirmation' }
    },
    'GET clowder/conversation/deployment-request/active?channelId=clowder_cat%3Acodex&channelType=1': {
      deploymentRequest: { id: 'deploy-req-1', target: 'demo-app', environment: 'preview', missingFields: [], status: 'pending_confirmation' }
    },
    'GET clowder/conversation/deployment-request/deploy-req-1': {
      deploymentRequest: {
        id: 'deploy-req-1',
        target: 'demo-app',
        environment: 'preview',
        missingFields: [],
        status: 'succeeded',
        previewUrl: 'http://localhost:3004/api/deployments/job-1/preview'
      }
    },
    'POST clowder/conversation/deployment-action': {
      ok: true,
      deploymentRequestId: 'deploy-req-1',
      action: 'confirm',
      actionId: 'action-1',
      status: 'queued',
      deploymentRequest: { id: 'deploy-req-1', target: 'demo-app', environment: 'preview', missingFields: [], status: 'queued' }
    },
    'GET clowder/deployments/job-1': {
      deployment: { id: 'job-1', status: 'succeeded', previewUrl: 'http://localhost:3004/api/deployments/job-1/preview' }
    },
    'GET clowder/deployments/job-1/logs': {
      logs: [{ level: 'info', message: 'deployed' }]
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const created = await service.createDeploymentRequest({
    channelId: 'clowder_cat:codex',
    channelType: 1,
    sourceMessageId: 'msg-1',
    originalText: '部署这个项目',
    target: 'demo-app',
    environment: 'preview'
  });
  const updated = await service.updateDeploymentRequest('deploy-req-1', { target: 'demo-app' });
  const active = await service.fetchActiveDeploymentRequest({ channelId: 'clowder_cat:codex', channelType: 1 });
  const detail = await service.fetchDeploymentRequest('deploy-req-1');
  const action = await service.sendDeploymentAction({
    deploymentRequestId: 'deploy-req-1',
    channelId: 'clowder_cat:codex',
    channelType: 1,
    action: 'confirm',
    actionId: 'action-1'
  });
  const deployment = await service.fetchDeployment('job-1');
  const logs = await service.fetchDeploymentLogs('job-1');

  assert.equal(created.id, 'deploy-req-1');
  assert.equal(updated.id, 'deploy-req-1');
  assert.equal(active.id, 'deploy-req-1');
  assert.equal(detail.status, 'succeeded');
  assert.equal(action.deploymentRequest.status, 'queued');
  assert.equal(deployment.id, 'job-1');
  assert.equal(logs[0].message, 'deployed');
  assert.deepEqual(request.calls.map((call) => [call.method, call.url, call.data]), [
    ['POST', '/v1/clowder/conversation/deployment-request', {
      channelId: 'clowder_cat:codex',
      channelType: 1,
      sourceMessageId: 'msg-1',
      originalText: '部署这个项目',
      target: 'demo-app',
      environment: 'preview'
    }],
    ['PATCH', '/v1/clowder/conversation/deployment-request/deploy-req-1', { target: 'demo-app' }],
    ['GET', '/v1/clowder/conversation/deployment-request/active?channelId=clowder_cat%3Acodex&channelType=1', undefined],
    ['GET', '/v1/clowder/conversation/deployment-request/deploy-req-1', undefined],
    ['POST', '/v1/clowder/conversation/deployment-action', {
      deploymentRequestId: 'deploy-req-1',
      channelId: 'clowder_cat:codex',
      channelType: 1,
      action: 'confirm',
      actionId: 'action-1'
    }],
    ['GET', '/v1/clowder/deployments/job-1', undefined],
    ['GET', '/v1/clowder/deployments/job-1/logs', undefined]
  ]);
});

test('deployment card helper upserts state and keeps preview urls', () => {
  const request = {
    id: 'deploy-req-1',
    channelId: 'clowder_cat:codex',
    channelType: 1,
    originalText: '部署这个项目',
    target: 'demo-app',
    environment: 'preview',
    missingFields: [],
    status: 'pending_confirmation',
    downloadUrl: 'http://localhost:3004/api/deployments/job-1/download',
    targetCandidates: [],
    environmentCandidates: []
  };
  const sourceMessage = { id: 'msg-1', clientMsgNo: 'client-msg-1', content: '部署这个项目' };

  let list = upsertDeploymentCardMessage([], {
    deploymentRequest: request,
    sourceMessage,
    conversation: { channelType: 1 },
    agent: { id: 'codex', name: 'Codex' }
  });
  list = upsertDeploymentCardMessage(list, {
    deploymentRequest: {
      ...request,
      status: 'succeeded',
      deploymentJobId: 'job-1',
      previewUrl: 'http://localhost:3004/api/deployments/job-1/preview'
    },
    sourceMessage,
    conversation: { channelType: 1 },
    agent: { id: 'codex', name: 'Codex' }
  });

  assert.equal(list.length, 1);
  assert.equal(isDeploymentCardMessage(list[0]), true);
  assert.equal(list[0].id, 'deployment-card-deploy-req-1');
  assert.equal(list[0].type, 'deployment_card');
  assert.equal(list[0].deploymentCard.status, 'succeeded');
  assert.equal(list[0].deploymentCard.statusLabel, '部署完成');
  assert.equal(list[0].deploymentCard.previewUrl, 'http://localhost:3004/api/deployments/job-1/preview');
  assert.equal(list[0].deploymentCard.downloadUrl, 'http://localhost:3004/api/deployments/job-1/download');
  assert.match(list[0].content, /部署完成/);

  const cardMessage = buildDeploymentCardMessage(request, {
    sourceMessage,
    conversation: { channelType: 1 },
    agent: { id: 'codex', name: 'Codex' }
  });
  assert.equal(cardMessage.metadata.deployment_card, true);
});

test('deployment card helper updates running and terminal states by card id', () => {
  const request = {
    id: 'deploy-req-update',
    target: 'demo-app',
    environment: 'preview',
    missingFields: [],
    status: 'pending_confirmation',
    downloadUrl: 'http://localhost:3004/api/deployments/job-update/download'
  };
  let list = upsertDeploymentCardMessage([], {
    deploymentRequest: request,
    sourceMessage: { id: 'msg-update', content: '部署 demo-app' },
    conversation: { channelType: 1 },
    agent: { id: 'codex', name: 'Codex' }
  });

  list = updateDeploymentCardMessage(list, 'deployment-card-deploy-req-update', { status: 'running' });
  assert.equal(list[0].deploymentCard.status, 'running');
  assert.equal(list[0].deploymentCard.statusLabel, '部署中');
  assert.equal(list[0].deploymentCard.downloadUrl, 'http://localhost:3004/api/deployments/job-update/download');

  list = updateDeploymentCardMessage(list, 'deployment-card-deploy-req-update', {
    status: 'succeeded',
    previewUrl: 'http://localhost:3004/api/deployments/job-update/preview'
  });
  assert.equal(list[0].deploymentCard.status, 'succeeded');
  assert.equal(list[0].deploymentCard.statusLabel, '部署完成');
  assert.equal(list[0].deploymentCard.previewUrl, 'http://localhost:3004/api/deployments/job-update/preview');
  assert.match(list[0].content, /部署完成/);
});

test('skill catalog preview does not assign every catalog skill to every agent', () => {
  const preview = normalizeSkillCatalogPreview({
    codex: [{ name: 'tdd', category: '工程', description: '测试驱动', mounted: true }],
    claude: [{ name: 'review', category: '质量', trigger: 'review', mounted: false }]
  });
  const userSkills = normalizeUserSkillList([
    { id: 'user-skill-1', name: 'tdd', enabled: true, agentIds: ['codex'] }
  ]);

  assert.equal(preview.length, 2);
  assert.deepEqual(preview[0].agentIds, []);
  assert.equal(preview[0].level, '市场可添加');
  assert.equal(preview[1].level, '未挂载');
  assert.equal(userSkills[0].assignedAgentCount, 1);
});

test('native service fetches active project group, thread tasks, and creates coordination', async () => {
  const request = makeRequestStub({
    'GET clowder/project-groups/active?projectGroupNo=g-project': {
      binding: {
        id: 'binding-1',
        projectGroupNo: 'g-project',
        projectName: 'UI项目群',
        projectThreadId: 'thread-project-1',
        catMemberIds: ['coordinator', 'codex']
      }
    },
    'GET clowder/thread/thread-project-1/tasks': {
      tasks: [
        {
          id: 'task-1',
          title: '修复注册链路',
          goal: '真实账号注册后进入聊天',
          status: 'doing',
          assigneeCatId: 'codex',
          progress: 45,
          artifacts: [{ id: 'doc-1', name: '注册验收.md', type: 'md' }],
          logs: [{ time: '10:00', title: '开始处理', detail: '已定位 register.vue' }]
        }
      ]
    },
    'GET clowder/thread/thread-project-1/artifacts': {
      artifacts: [
        {
          taskId: 'task-1',
          path: 'docs/注册验收.md',
          workspaceRelativePath: 'docs/注册验收.md',
          worktreeId: 'seedcmp',
          kind: 'doc',
          description: '注册链路验收文档',
          ownerCatId: 'codex',
          status: 'available'
        }
      ]
    },
    'POST clowder/coordinator/coordination': {
      coordinationId: 'coord-1',
      status: 'created'
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const binding = await service.fetchActiveProjectGroup({ projectGroupNo: 'g-project' });
  const tasks = await service.fetchThreadTasks('thread-project-1');
  const artifacts = await service.fetchThreadArtifacts('thread-project-1');
  const coordination = await service.createCoordination({
    threadId: 'thread-project-1',
    goal: '验收项目群看板'
  });

  assert.equal(request.calls[0].method, 'GET');
  assert.equal(request.calls[0].url, '/v1/clowder/project-groups/active?projectGroupNo=g-project');
  assert.equal(request.calls[1].method, 'GET');
  assert.equal(request.calls[1].url, '/v1/clowder/thread/thread-project-1/tasks');
  assert.equal(request.calls[2].method, 'GET');
  assert.equal(request.calls[2].url, '/v1/clowder/thread/thread-project-1/artifacts');
  assert.equal(request.calls[3].method, 'POST');
  assert.equal(request.calls[3].url, '/v1/clowder/coordinator/coordination');
  assert.equal(binding.id, 'binding-1');
  assert.equal(tasks[0].id, 'task-1');
  assert.equal(artifacts[0].fileName, '注册验收.md');
  assert.equal(artifacts[0].workspacePath, 'docs/注册验收.md');
  assert.equal(artifacts[0].worktreeId, 'seedcmp');
  assert.equal(artifacts[0].generatedByAgent, true);
  assert.equal(coordination.coordinationId, 'coord-1');
});

test('project group helper detects coordinator kickoff intent and resolves project names', async () => {
  const {
    isProjectStartRequest,
    resolveProjectGroupName,
    buildProjectGroupCardId
  } = await import('../services/native-im/project-group.js');

  assert.equal(isProjectStartRequest('为这个需求创建项目群，让 Codex 和 Claude 分工执行'), true);
  assert.equal(isProjectStartRequest('拉 Codex/Claude 拆解任务并分工执行'), true);
  assert.equal(isProjectStartRequest('今天下午天气怎么样'), false);
  assert.equal(resolveProjectGroupName('项目名叫 ISSUE-029项目群，请 PM 拉猫猫执行', '默认项目'), 'ISSUE-029项目群');
  assert.equal(resolveProjectGroupName('帮我创建项目群处理登录问题', '登录修复'), '登录修复 项目群');
  assert.equal(buildProjectGroupCardId({ id: 'msg-1' }), 'project-group-card:msg-1');
});

test('native service posts ensure project group and updates binding thread', async () => {
  const request = makeRequestStub({
    'POST clowder/project-groups/ensure': {
      binding: {
        id: 'binding-029',
        projectGroupNo: 'g-029',
        projectName: 'ISSUE-029项目群',
        projectThreadId: 'thread-029',
        catMemberIds: ['coordinator', 'codex'],
        status: 'active'
      },
      reused: false
    },
    'GET clowder/group/cats?groupId=g-029': {
      cats: [{ catId: 'codex', displayName: 'Codex', connected: true }]
    },
    'POST clowder/project-groups/binding-029/thread': {
      binding: {
        id: 'binding-029',
        projectThreadId: 'thread-updated'
      }
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const ensured = await service.ensureProjectGroup({
    projectName: 'ISSUE-029项目群',
    workspaceId: 'workspace-029',
    pmDirectChannelId: 'clowder_cat:coordinator',
    pmDirectChannelType: 1,
    pmMemberId: 'clowder_cat:coordinator',
    userMemberIds: ['u-owner'],
    catMemberIds: ['coordinator', 'codex'],
    createdBy: 'user'
  });
  const groupCats = await service.fetchGroupCats({ groupId: 'g-029' });
  const updated = await service.updateProjectGroupThread('binding-029', {
    projectThreadId: 'thread-updated'
  });

  assert.equal(request.calls[0].method, 'POST');
  assert.equal(request.calls[0].url, '/v1/clowder/project-groups/ensure');
  assert.deepEqual(request.calls[0].data, {
    projectName: 'ISSUE-029项目群',
    workspaceId: 'workspace-029',
    pmDirectChannelId: 'clowder_cat:coordinator',
    pmDirectChannelType: 1,
    pmMemberId: 'clowder_cat:coordinator',
    userMemberIds: ['u-owner'],
    catMemberIds: ['coordinator', 'codex'],
    createdBy: 'user'
  });
  assert.equal(request.calls[1].method, 'GET');
  assert.equal(request.calls[1].url, '/v1/clowder/group/cats?groupId=g-029');
  assert.equal(request.calls[2].method, 'POST');
  assert.equal(request.calls[2].url, '/v1/clowder/project-groups/binding-029/thread');
  assert.deepEqual(request.calls[2].data, { projectThreadId: 'thread-updated' });
  assert.equal(ensured.binding.id, 'binding-029');
  assert.equal(ensured.binding.projectGroupNo, 'g-029');
  assert.equal(ensured.reused, false);
  assert.equal(groupCats[0].id, 'codex');
  assert.equal(groupCats[0].name, 'Codex');
  assert.equal(updated.binding.projectThreadId, 'thread-updated');
});

test('native service restores clowder group cats from catIds when cat payloads are missing', async () => {
  const request = makeRequestStub({
    'GET clowder/group/cats?groupId=g-only-ids': {
      groupId: 'g-only-ids',
      catIds: ['coordinator', 'codex']
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const groupCats = await service.fetchGroupCats({ groupId: 'g-only-ids' });

  assert.deepEqual(groupCats.map((cat) => cat.id), ['coordinator', 'codex']);
  assert.equal(groupCats[0].isAgent, true);
  assert.equal(groupCats[0].alias, '@coordinator');
});

test('native service approves and rejects clowder thread proposals with user identity header', async () => {
  const request = makeRequestStub({
    'POST clowder/proposals/prop-1/approve': { proposalId: 'prop-1', status: 'approved', threadId: 'thread-new' },
    'POST clowder/proposals/prop-2/reject': { proposalId: 'prop-2', status: 'rejected' }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  await service.approveThreadProposal('prop-1', { userId: 'u-owner' });
  await service.rejectThreadProposal('prop-2', { userId: 'u-owner', reason: '暂不需要' });

  assert.equal(request.calls[0].method, 'POST');
  assert.equal(request.calls[0].url, '/v1/clowder/proposals/prop-1/approve');
  assert.equal(request.calls[0].header.token, 'token');
  assert.equal(request.calls[0].header['X-Cat-Cafe-User'], 'u-owner');
  assert.deepEqual(request.calls[0].data, {});
  assert.equal(request.calls[1].method, 'POST');
  assert.equal(request.calls[1].url, '/v1/clowder/proposals/prop-2/reject');
  assert.equal(request.calls[1].header.token, 'token');
  assert.equal(request.calls[1].header['X-Cat-Cafe-User'], 'u-owner');
  assert.deepEqual(request.calls[1].data, { rejectionReason: '暂不需要' });
});

test('native service approves clowder thread proposals through bridge without local app user', async () => {
  const request = makeRequestStub({
    'POST clowder/proposals/prop-card/approve': { proposalId: 'prop-card', status: 'approved', threadId: 'thread-new' }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  await service.approveThreadProposal('prop-card');

  assert.equal(request.calls[0].method, 'POST');
  assert.equal(request.calls[0].url, '/v1/clowder/proposals/prop-card/approve');
  assert.equal(request.calls[0].header.token, 'token');
  assert.equal(request.calls[0].header['X-Cat-Cafe-User'], undefined);
});


test('project group confirmation card upserts and updates idempotently', async () => {
  const {
    isProjectGroupConfirmationMessage,
    upsertProjectGroupConfirmationMessage,
    updateProjectGroupConfirmationMessage
  } = await import('../services/native-im/project-group.js');
  const sourceMessage = {
    id: 'prompt-029',
    clientMsgNo: 'client-029',
    content: '为 ISSUE-029 创建项目群，让 Codex 和 Claude 分工执行'
  };

  let list = upsertProjectGroupConfirmationMessage([], {
    sourceMessage,
    projectName: 'ISSUE-029项目群',
    coordinator: { id: 'coordinator', name: 'PM' },
    targetCatIds: ['codex'],
    workerCatIds: ['codex']
  });
  list = upsertProjectGroupConfirmationMessage(list, {
    sourceMessage,
    projectName: 'ISSUE-029项目群',
    coordinator: { id: 'coordinator', name: 'PM' },
    targetCatIds: ['codex', 'claude'],
    workerCatIds: ['codex', 'claude']
  });

  assert.equal(list.length, 1);
  assert.equal(isProjectGroupConfirmationMessage(list[0]), true);
  assert.equal(list[0].id, 'project-group-card:prompt-029');
  assert.equal(list[0].type, 'project_group_confirmation');
  assert.equal(list[0].projectGroupCard.status, 'pending_confirmation');
  assert.deepEqual(list[0].projectGroupCard.targetCatIds, ['codex', 'claude']);
  assert.equal(list[0].metadata.project_group_confirmation, true);

  list = updateProjectGroupConfirmationMessage(list, 'project-group-card:prompt-029', {
    status: 'created',
    projectGroupNo: 'g-029',
    projectGroupName: 'ISSUE-029项目群',
    projectBindingId: 'binding-029',
    reused: true
  });

  assert.equal(list.length, 1);
  assert.equal(list[0].projectGroupCard.status, 'created');
  assert.equal(list[0].projectGroupCard.projectGroupNo, 'g-029');
  assert.equal(list[0].projectGroupCard.reused, true);
  assert.match(list[0].content, /已复用项目群/);
});

test('project group confirmation card keeps one retryable failed state', async () => {
  const {
    upsertProjectGroupConfirmationMessage,
    updateProjectGroupConfirmationMessage
  } = await import('../services/native-im/project-group.js');
  const sourceMessage = { id: 'prompt-failed', content: '创建项目群并拉 Codex' };
  let list = upsertProjectGroupConfirmationMessage([], {
    sourceMessage,
    projectName: '失败项目群',
    targetCatIds: ['codex']
  });

  list = updateProjectGroupConfirmationMessage(list, 'project-group-card:prompt-failed', {
    status: 'failed',
    error: { msg: 'sync group cats failed' }
  });
  list = updateProjectGroupConfirmationMessage(list, 'project-group-card:prompt-failed', {
    status: 'failed',
    error: '再次同步失败'
  });

  assert.equal(list.length, 1);
  assert.equal(list[0].projectGroupCard.status, 'failed');
  assert.equal(list[0].projectGroupCard.error, '再次同步失败');
  assert.match(list[0].content, /创建失败/);
});

test('project group text confirmation resolves only with pending context', async () => {
  const {
    resolveProjectGroupTextConfirmation,
    upsertProjectGroupConfirmationMessage
  } = await import('../services/native-im/project-group.js');
  const sourceMessage = { id: 'prompt-text-confirm', content: '项目名叫 ISSUE-048项目群，拉 Codex 分工执行' };
  const messages = upsertProjectGroupConfirmationMessage([], {
    sourceMessage,
    projectName: 'ISSUE-048项目群',
    targetCatIds: ['codex']
  });

  const confirm = resolveProjectGroupTextConfirmation({
    text: '确认',
    messages
  });
  assert.equal(confirm.action, 'confirm');
  assert.equal(confirm.cardId, 'project-group-card:prompt-text-confirm');
  assert.equal(confirm.message.id, 'project-group-card:prompt-text-confirm');

  const buildIt = resolveProjectGroupTextConfirmation({
    text: '可以，建群吧',
    messages
  });
  assert.equal(buildIt.action, 'confirm');

  const resend = resolveProjectGroupTextConfirmation({
    text: '重新发我一下',
    messages
  });
  assert.equal(resend.action, 'confirm');
  assert.equal(resend.intent, 'recover');

  const cancel = resolveProjectGroupTextConfirmation({
    text: '先不要，取消',
    messages
  });
  assert.equal(cancel.action, 'cancel');
  assert.equal(cancel.cardId, 'project-group-card:prompt-text-confirm');

  assert.equal(resolveProjectGroupTextConfirmation({ text: '确认', messages: [] }), null);
  assert.equal(resolveProjectGroupTextConfirmation({
    text: '取消',
    messages: upsertProjectGroupConfirmationMessage([], {
      sourceMessage,
      projectName: 'ISSUE-048项目群',
      status: 'created'
    })
  }), null);
});

test('project group text confirmation can approve or reject pending project proposals', async () => {
  const {
    resolveProjectGroupTextConfirmation
  } = await import('../services/native-im/project-group.js');
  const projectProposal = {
    id: 'proposal-msg-project',
    type: 'proposal_card',
    proposalCard: {
      proposalId: 'proposal-project-1',
      title: '创建全员群项目 thread',
      bodyMarkdown: '建议批准并创建 ISSUE-048 项目群，并拉 Codex 分工执行。',
      fields: [{ label: '成员', value: 'Codex' }],
      status: 'pending'
    }
  };
  const plainThreadProposal = {
    id: 'proposal-msg-thread',
    type: 'proposal_card',
    proposalCard: {
      proposalId: 'proposal-thread-1',
      title: '提议新建 thread：登录排查',
      bodyMarkdown: '建议拆成独立 thread 跟进。',
      fields: [{ label: '建议成员', value: 'Codex' }],
      status: 'pending'
    }
  };

  const approved = resolveProjectGroupTextConfirmation({
    text: '批准',
    messages: [projectProposal]
  });
  assert.equal(approved.action, 'approve_proposal');
  assert.equal(approved.proposalId, 'proposal-project-1');
  assert.equal(approved.message.id, 'proposal-msg-project');

  const rejected = resolveProjectGroupTextConfirmation({
    text: '取消',
    messages: [projectProposal]
  });
  assert.equal(rejected.action, 'reject_proposal');
  assert.equal(rejected.proposalId, 'proposal-project-1');

  assert.equal(resolveProjectGroupTextConfirmation({
    text: '确认',
    messages: [plainThreadProposal]
  }), null);
});

test('project group text confirmation ignores formal execution prompts after project group opens', async () => {
  const {
    resolveProjectGroupTextConfirmation
  } = await import('../services/native-im/project-group.js');
  const pendingProposal = {
    id: 'proposal-msg-riverwatch',
    type: 'proposal_card',
    proposalCard: {
      proposalId: 'proposal-riverwatch-1',
      title: '创建 RiverWatch 项目群',
      bodyMarkdown: '建议批准并创建 RiverWatch 项目群，并拉 Codex 分工执行。',
      fields: [{ label: '成员', value: 'PM, Frontend, DevOps' }],
      status: 'pending'
    }
  };

  const executionPrompt = `@狸花猫（资料整理师）
@俄罗斯蓝猫（叙事策略师）
@波斯猫（前端工程师）

请在本项目群内真实分工完成 RiverWatch 第一版交付物。
阶段切换说明：此前 PM 直聊里的“只建群、不生成交付物”限制已经结束。
任何执行智能体不得用它拒绝生成文件。
不要检索旧 thread，不要复用旧线程，禁止使用 mock、模拟数据、预置 assets 或伪造文件。`;

  assert.equal(resolveProjectGroupTextConfirmation({
    text: executionPrompt,
    messages: [pendingProposal],
    conversation: { id: '2:riverwatch', type: 'group', channelType: 2, name: 'RiverWatch 项目群' }
  }), null);
});

test('project group proposal card status updates from text fallback', async () => {
  const {
    updateProjectGroupProposalMessage
  } = await import('../services/native-im/project-group.js');
  const list = [{
    id: 'proposal-msg-project',
    type: 'proposal_card',
    content: '创建全员群项目 thread',
    proposalCard: {
      proposalId: 'proposal-project-1',
      title: '创建全员群项目 thread',
      status: 'pending'
    }
  }];

  const approved = updateProjectGroupProposalMessage(list, 'proposal-project-1', {
    status: 'approved'
  });
  assert.equal(approved[0].proposalCard.status, 'approved');
  assert.equal(approved[0].metadata.project_group_text_fallback, true);

  const failed = updateProjectGroupProposalMessage(approved, 'proposal-project-1', {
    status: 'failed',
    error: { msg: '批准失败' }
  });
  assert.equal(failed[0].proposalCard.status, 'failed');
  assert.equal(failed[0].proposalCard.error, '批准失败');

  assert.deepEqual(updateProjectGroupProposalMessage(failed, 'missing', { status: 'rejected' }), failed);
});

test('text send effects create fresh project group card before old-context fallback can auto-confirm', async () => {
  const calls = [];
  const result = await runTextPostSendEffects({
    conversation: { id: 'pm-direct', type: 'robot', directCatId: 'riverpm' },
    content: '请作为 PM 创建项目群并组织多智能体分工执行',
    localMessage: { id: 'msg-1', status: 'success' },
    createCoordinatorTemplateCatsCard: async () => {
      calls.push('template-card');
      return { id: 'template-card' };
    },
    handleProjectGroupTextFallback: async () => {
      calls.push('project-group-fallback');
      return { id: 'project-card' };
    },
    startAgentPendingFeedback: () => calls.push('pending-feedback'),
    createProjectGroupCard: () => {
      calls.push('project-card');
      return { id: 'fresh-project-card' };
    },
    createDeploymentCard: async () => calls.push('deployment-card')
  });

  assert.deepEqual(calls, ['template-card', 'project-card', 'pending-feedback', 'deployment-card']);
  assert.equal(result.projectGroupCardCreated, true);
  assert.equal(result.handledProjectGroupFallback, false);
  assert.equal(result.shouldReturn, false);
});

test('text send effects still allow explicit confirmation fallback when no fresh project card is created', async () => {
  const calls = [];
  const result = await runTextPostSendEffects({
    conversation: { id: 'pm-direct', type: 'robot', directCatId: 'riverpm' },
    content: '确认创建',
    localMessage: { id: 'msg-confirm', status: 'success' },
    createCoordinatorTemplateCatsCard: async () => {
      calls.push('template-card');
      return null;
    },
    createProjectGroupCard: () => {
      calls.push('project-card');
      return null;
    },
    handleProjectGroupTextFallback: async () => {
      calls.push('project-group-fallback');
      return { id: 'created-project-group-card' };
    },
    startAgentPendingFeedback: () => calls.push('pending-feedback'),
    createDeploymentCard: async () => calls.push('deployment-card')
  });

  assert.deepEqual(calls, ['template-card', 'project-card', 'project-group-fallback']);
  assert.equal(result.projectGroupCardCreated, false);
  assert.equal(result.handledProjectGroupFallback, true);
  assert.equal(result.shouldSend, false);
  assert.equal(result.shouldReturn, true);
  assert.equal(result.result.id, 'created-project-group-card');
});

test('text pre-send effects consume project group confirmation before PM bridge send', async () => {
  const calls = [];
  const result = await resolveTextPreSendEffects({
    conversation: { id: 'pm-direct', type: 'robot', directCatId: 'riverpm' },
    content: '确认',
    handleProjectGroupTextFallback: async () => {
      calls.push('project-group-fallback');
      return {
        id: 'project-group-card:msg-1',
        projectGroupCard: {
          status: 'created',
          projectGroupNo: 'riverwatch-group'
        }
      };
    }
  });

  assert.deepEqual(calls, ['project-group-fallback']);
  assert.equal(result.handledProjectGroupFallback, true);
  assert.equal(result.shouldSend, false);
  assert.equal(result.shouldReturn, true);
  assert.equal(result.result.projectGroupCard.projectGroupNo, 'riverwatch-group');
});

test('project group text confirmation can recover from recent project start context', async () => {
  const {
    resolveProjectGroupTextConfirmation
  } = await import('../services/native-im/project-group.js');
  const conversation = {
    id: 'clowder_cat:coordinator',
    channelId: 'clowder_cat:coordinator',
    channelType: 1,
    type: 'robot',
    source: 'clowder',
    directCatId: 'coordinator',
    name: 'PM 智能体'
  };
  const agent = {
    id: 'coordinator',
    name: 'PM 智能体',
    roleTemplate: 'coordinator'
  };
  const messages = [
    {
      id: 'prompt-lost-card',
      senderId: 'u-owner',
      type: 'text',
      content: '项目名叫 ISSUE-048项目群，拉 Codex 分工执行',
      status: 'success'
    }
  ];

  const resolved = resolveProjectGroupTextConfirmation({
    text: '就按这个来',
    messages,
    conversation,
    agent
  });
  assert.equal(resolved.action, 'create_and_confirm');
  assert.equal(resolved.sourceMessage.id, 'prompt-lost-card');
  assert.equal(resolved.sourceText, '项目名叫 ISSUE-048项目群，拉 Codex 分工执行');

  const cancelled = resolveProjectGroupTextConfirmation({
    text: '不建了',
    messages,
    conversation,
    agent
  });
  assert.equal(cancelled.action, 'cancel_context');
  assert.equal(cancelled.sourceMessage.id, 'prompt-lost-card');

  assert.equal(resolveProjectGroupTextConfirmation({
    text: '确认',
    messages: [{ id: 'plain-1', type: 'text', content: '今天天气不错', status: 'success' }],
    conversation,
    agent
  }), null);
});

test('project group confirmation trigger is limited to coordinator direct chats', async () => {
  const {
    buildProjectGroupConfirmationInput,
    shouldCreateProjectGroupConfirmation
  } = await import('../services/native-im/project-group.js');
  const coordinatorConversation = {
    id: 'clowder_cat:coordinator',
    channelId: 'clowder_cat:coordinator',
    channelType: 1,
    threadId: 'thread-pm-project-1',
    type: 'robot',
    source: 'clowder',
    directCatId: 'coordinator',
    name: 'PM 智能体'
  };
  const coordinatorAgent = {
    id: 'coordinator',
    name: 'PM 智能体',
    roleTemplate: 'coordinator',
    alias: '@pm'
  };
  const workerAgents = [
    coordinatorAgent,
    { id: 'codex', name: 'Codex', alias: '@codex', status: 'active', roleTemplate: 'engineer' },
    { id: 'claude-code', directCatId: 'claude', name: 'Claude Code', alias: '@claude', status: 'active', roleTemplate: 'reviewer' },
    { id: 'spark', name: '创意火花', status: 'inactive', roleTemplate: 'creative' }
  ];

  assert.equal(shouldCreateProjectGroupConfirmation({
    conversation: coordinatorConversation,
    agent: coordinatorAgent,
    text: '为项目名叫 ISSUE-029项目群，拉 Codex 和 Claude 分工执行'
  }), true);
  assert.equal(shouldCreateProjectGroupConfirmation({
    conversation: { id: 'g1', type: 'group', channelType: 2, name: '项目群' },
    agent: coordinatorAgent,
    text: '创建项目群'
  }), false);
  assert.equal(shouldCreateProjectGroupConfirmation({
    conversation: { id: 'clowder_cat:codex', type: 'robot', source: 'clowder', directCatId: 'codex', name: 'Codex' },
    agent: workerAgents[1],
    text: '创建项目群'
  }), false);

  const cardInput = buildProjectGroupConfirmationInput({
    conversation: coordinatorConversation,
    agent: coordinatorAgent,
    sourceMessage: { id: 'prompt-029', content: '项目名叫 ISSUE-029项目群，拉 Codex 和 Claude 分工执行' },
    text: '项目名叫 ISSUE-029项目群，拉 Codex 和 Claude 分工执行',
    currentUser: { id: 'u-owner' },
    availableAgents: workerAgents
  });

  assert.equal(cardInput.projectName, 'ISSUE-029项目群');
  assert.equal(cardInput.pmDirectChannelId, 'clowder_cat:coordinator');
  assert.equal(cardInput.pmDirectChannelType, 1);
  assert.equal(cardInput.pmDirectThreadId, 'thread-pm-project-1');
  assert.equal(cardInput.projectThreadId, 'thread-pm-project-1');
  assert.deepEqual(cardInput.userMemberIds, ['u-owner']);
  assert.deepEqual(cardInput.targetCatIds, ['codex', 'claude']);

  const riverWatchCard = buildProjectGroupConfirmationInput({
    conversation: {
      ...coordinatorConversation,
      id: 'clowder_cat:riverpm',
      channelId: 'clowder_cat:riverpm',
      directCatId: 'riverpm',
      name: 'RiverWatch PM'
    },
    agent: {
      id: 'riverpm',
      name: 'RiverWatch PM',
      roleTemplate: 'general',
      alias: '@riverpm'
    },
    sourceMessage: { id: 'prompt-riverwatch', content: 'RiverWatch 项目需要 PPT、PRD、Vue 前端页面、README 和 preview 部署链接' },
    text: 'RiverWatch 项目需要 PPT、PRD、Vue 前端页面、README 和 preview 部署链接',
    currentUser: { id: 'u-owner' },
    availableAgents: [
      { id: 'architect', name: '布偶猫（架构师）', source: 'clowder', raw: { source: 'disconnected' } },
      { id: 'devops', name: '孟加拉猫（DevOps）', source: 'clowder', raw: { source: 'disconnected' } }
    ]
  });
  assert.deepEqual(riverWatchCard.targetCatIds, []);

  const riverWatchWithReusableCats = buildProjectGroupConfirmationInput({
    conversation: {
      ...coordinatorConversation,
      id: 'clowder_cat:riverpm144763',
      channelId: 'clowder_cat:riverpm144763',
      directCatId: 'riverpm144763',
      name: 'RiverWatch PM 144763'
    },
    agent: {
      id: 'riverpm144763',
      name: 'RiverWatch PM 144763',
      roleTemplate: 'general',
      alias: '@riverpm144763'
    },
    sourceMessage: { id: 'prompt-riverwatch-real', content: 'RiverWatch 项目需要 PPT、PRD、Vue 前端页面、README 和 preview 部署链接' },
    text: 'RiverWatch 项目需要 PPT、PRD、Vue 前端页面、README 和 preview 部署链接',
    currentUser: { id: 'u-owner' },
    availableAgents: [
      { id: 'bobo', name: '波斯猫（前端工程师）', source: 'clowder', roleTemplate: 'general', capabilityTags: ['前端架构', 'Vue 页面实现'] },
      { id: 'runtime-cat-source', name: '狸花猫（资料整理师）', source: 'clowder', roleTemplate: 'general', capabilityTags: ['source processing'] },
      { id: 'runtime-cat-deck', name: '俄罗斯蓝猫（叙事策略师）', source: 'clowder', roleTemplate: 'general', capabilityTags: ['deck-strategist'] },
      { id: 'devops', name: '孟加拉猫（DevOps）', source: 'clowder', raw: { source: 'disconnected' } }
    ]
  });
  assert.deepEqual(
    riverWatchWithReusableCats.targetCatIds.sort(),
    ['bobo', 'runtime-cat-deck', 'runtime-cat-source'].sort()
  );
  assert.ok(!riverWatchWithReusableCats.targetCatIds.includes('devops'));
});

test('coordinator capability scan does not treat live preview as devops coverage', async () => {
  const {
    detectRequiredCapabilityProfile,
    findMissingRoles,
    scanExistingCats
  } = await import('../services/native-im/coordinator-capability.js');

  const profile = detectRequiredCapabilityProfile('RiverWatch 项目需要 PPT、PRD、Vue 前端页面、README 和 preview 部署链接');
  const availableAgents = [
    {
      id: 'sensen',
      name: '挪威森林猫（SVG执行守门人）',
      source: 'clowder',
      roleTemplate: 'general',
      desc: 'SVG executor、串行生成纪律、spec_lock、live preview 守护',
      capabilityTags: ['SVG executor', '串行生成纪律', 'live preview 守护']
    },
    {
      id: 'bobo',
      name: '波斯猫（前端工程师）',
      source: 'clowder',
      roleTemplate: 'general',
      capabilityTags: ['前端架构', 'Vue 页面实现']
    }
  ];

  assert.deepEqual(scanExistingCats({ requiredProfile: profile, availableAgents }).map((cat) => cat.id), ['bobo']);
  assert.ok(findMissingRoles({ requiredProfile: profile, availableAgents }).includes('devops'));
});

test('native conversation normalization preserves clowder binding thread ids', () => {
  const conversation = normalizeConversation({
    channel_id: 'clowder_cat:coordinator',
    channel_type: 1,
    threadId: 'thread-pm-project-1',
    binding: {
      threadId: 'thread-pm-project-1'
    }
  }, {
    category: 'robot',
    name: 'PM 智能体'
  });

  assert.equal(conversation.threadId, 'thread-pm-project-1');
  assert.equal(conversation.directThreadId, 'thread-pm-project-1');
});

test('project group confirmation builds ensure payload and created patch', async () => {
  const {
    buildProjectGroupExecutionMessagePayload,
    buildProjectGroupEnsurePayload,
    projectGroupCreatedPatch,
    projectGroupFailedPatch,
    resolveProjectGroupExecutionTargets
  } = await import('../services/native-im/project-group.js');
  const card = {
    projectName: 'ISSUE-029项目群',
    pmDirectChannelId: 'clowder_cat:coordinator',
    pmDirectChannelType: 1,
    pmDirectThreadId: 'thread-direct',
    projectThreadId: 'thread-project',
    pmMemberId: 'clowder_cat:coordinator',
    userMemberIds: ['u-owner'],
    catMemberIds: ['coordinator', 'codex'],
    targetCatIds: ['codex'],
    sourceText: '请拆解任务'
  };

  assert.deepEqual(buildProjectGroupEnsurePayload(card), {
    projectName: 'ISSUE-029项目群',
    pmDirectChannelId: 'clowder_cat:coordinator',
    pmDirectChannelType: 1,
    pmDirectThreadId: 'thread-direct',
    projectThreadId: 'thread-project',
    pmMemberId: 'clowder_cat:coordinator',
    userMemberIds: ['u-owner'],
    catMemberIds: ['coordinator', 'codex'],
    createdBy: 'user'
  });

  const created = projectGroupCreatedPatch({
    binding: {
      id: 'binding-029',
      projectGroupNo: 'g-029',
      projectName: 'ISSUE-029项目群',
      projectThreadId: 'thread-project',
      catMemberIds: ['coordinator', 'codex']
    },
    reused: true
  }, card);

  assert.deepEqual(created, {
    status: 'created',
    projectGroupNo: 'g-029',
    projectGroupName: 'ISSUE-029项目群',
    projectBindingId: 'binding-029',
    projectThreadId: 'thread-project',
    catMemberIds: ['coordinator', 'codex'],
    reused: true,
    error: ''
  });
  assert.deepEqual(projectGroupFailedPatch({ msg: 'sync failed' }), {
    status: 'failed',
    error: 'sync failed'
  });

  assert.deepEqual(buildProjectGroupExecutionMessagePayload({
    card: {
      sourceText: '请完成 RiverWatch PRD、README、Vue HTML 和部署预览。',
      projectName: 'RiverWatch 项目群'
    },
    groupId: 'riverwatch-group',
    groupName: 'RiverWatch 项目群',
    createdPatch: {
      projectGroupNo: 'riverwatch-group',
      projectThreadId: 'thread-riverwatch'
    },
    workerCatIds: ['source-curator-claude', 'frontend-claude'],
    catIds: ['riverpm-claude', 'source-curator-claude', 'frontend-claude']
  }), {
    channelId: 'riverwatch-group',
    channelType: 2,
    text: '请完成 RiverWatch PRD、README、Vue HTML 和部署预览。',
    promptContext: '项目群：RiverWatch 项目群',
    targetCatIds: ['source-curator-claude', 'frontend-claude'],
    threadId: 'thread-riverwatch'
  });

  assert.deepEqual(resolveProjectGroupExecutionTargets({
    card: {
      catMemberIds: ['riverpm-claude', 'runtime-cat-old-codex', 'source-curator-claude'],
      targetCatIds: ['runtime-cat-old-codex'],
      workerCatIds: ['runtime-cat-old-codex'],
      coordinatorProfile: {
        platform: 'claude-code',
        clientId: 'anthropic',
        provider: 'claude',
        accessMode: 'oauth',
        accountRef: 'claude'
      }
    },
    createdPatch: {
      catMemberIds: ['riverpm-claude', 'runtime-cat-old-codex', 'source-curator-claude']
    },
    agents: [
      { id: 'runtime-cat-old-codex', clientId: 'openai', accountRef: 'codex', authType: 'oauth' },
      { id: 'source-curator-claude', clientId: 'anthropic', accountRef: 'claude', authType: 'oauth' }
    ],
    coordinatorId: 'riverpm-claude'
  }), {
    catIds: ['riverpm-claude', 'source-curator-claude'],
    workerCatIds: ['source-curator-claude']
  });

  assert.deepEqual(buildProjectGroupEnsurePayload({
    projectName: 'RiverWatch 项目群',
    pmDirectChannelId: 'clowder_cat:riverpm-claude',
    pmMemberId: 'clowder_cat:riverpm-claude',
    userMemberIds: ['u-owner'],
    catMemberIds: ['riverpm-claude', 'runtime-cat-old-codex', 'source-curator-claude'],
    targetCatIds: ['runtime-cat-old-codex'],
    workerCatIds: ['runtime-cat-old-codex'],
    coordinator: { id: 'riverpm-claude' },
    coordinatorProfile: {
      platform: 'claude-code',
      clientId: 'anthropic',
      provider: 'claude',
      accessMode: 'oauth',
      accountRef: 'claude'
    }
  }, {
    currentUser: { id: 'u-owner' },
    agents: [
      { id: 'runtime-cat-old-codex', clientId: 'openai', accountRef: 'codex', authType: 'oauth' },
      { id: 'source-curator-claude', clientId: 'anthropic', accountRef: 'claude', authType: 'oauth' }
    ]
  }), {
    projectName: 'RiverWatch 项目群',
    pmDirectChannelId: 'clowder_cat:riverpm-claude',
    pmDirectChannelType: 1,
    pmMemberId: 'clowder_cat:riverpm-claude',
    userMemberIds: ['u-owner'],
    catMemberIds: ['riverpm-claude', 'source-curator-claude'],
    createdBy: 'user'
  });
});

test('project group creation does not forward original kickoff text as an executable group prompt', async () => {
  const {
    buildProjectGroupCreationContextMessage
  } = await import('../services/native-im/project-group.js');

  const oldStageKickoff = [
    '@riverwatch-source-curator-085592 @riverwatch-deck-strategist-085592 @riverwatch-storyboard-designer-085592 我想做一个 RiverWatch 项目。',
    '本轮请先只完成缺失执行猫盘点和 RiverWatch 项目群确认卡，不要生成交付物。'
  ].join('\n');

  assert.equal(
    buildProjectGroupCreationContextMessage({
      sourceText: oldStageKickoff,
      projectName: 'RiverWatch 项目群'
    }),
    null
  );
});

test('clowder project binding and thread tasks normalize into a group board', () => {
  const board = normalizeClowderProjectBoard({
    binding: {
      id: 'binding-1',
      projectGroupNo: 'g-project',
      projectName: 'UI项目群',
      projectThreadId: 'thread-project-1',
      userMemberIds: ['u1', 'u2'],
      catMemberIds: ['coordinator', 'codex']
    },
    tasks: [
      {
        id: 'task-1',
        title: '项目群可见性',
        goal: '两个账号都能看到项目群',
        status: 'in_progress',
        assigneeCatId: 'coordinator',
        progress: 60,
        artifacts: [{
          id: 'doc-1',
          name: '项目群验收.md',
          type: 'md',
          summary: '成员与消息同步',
          workspacePath: 'docs/project.md',
          worktreeId: 'seedcmp',
          generatedByAgent: true
        }],
        logs: [{ time: '10:20', title: '同步成员', detail: '补齐 userMemberIds' }]
      },
      {
        id: 'task-2',
        name: '看板联动',
        description: 'thread tasks 显示在右侧看板',
        state: 'completed',
        catId: 'codex',
        outputs: [{ id: 'doc-2', filename: '看板截图.png', kind: 'png' }]
      }
    ],
    agents: [
      { id: 'coordinator', name: '协调者', alias: '@coordinator' },
      { id: 'codex', name: 'Codex', alias: '@codex' }
    ]
  });

  assert.equal(board.id, 'clowder-board-binding-1');
  assert.equal(board.groupId, 'g-project');
  assert.equal(board.groupName, 'UI项目群');
  assert.equal(board.threadId, 'thread-project-1');
  assert.equal(board.memberCount, 4);
  assert.equal(board.tasks.length, 2);
  assert.equal(board.tasks[0].agentId, 'coordinator');
  assert.equal(board.tasks[0].status, 'doing');
  assert.equal(board.tasks[0].documents[0].name, '项目群验收.md');
  assert.equal(board.tasks[0].documents[0].workspacePath, 'docs/project.md');
  assert.equal(board.tasks[0].documents[0].worktreeId, 'seedcmp');
  assert.equal(board.tasks[0].documents[0].generatedByAgent, true);
  assert.equal(board.tasks[1].status, 'done');
  assert.equal(board.tasks[1].documents[0].name, '看板截图.png');
});

test('clowder project board synthesizes tasks from thread artifacts when task cards are absent', () => {
  const board = normalizeClowderProjectBoard({
    binding: {
      id: 'binding-riverwatch',
      projectGroupNo: 'riverwatch-group',
      projectName: 'RiverWatch 项目群',
      projectThreadId: 'thread-riverwatch'
    },
    tasks: [],
    artifacts: [
      {
        id: 'artifact-source-pack',
        taskId: 'task-source',
        ownerCatId: 'source-curator',
        path: 'source-pack.md',
        workspaceRelativePath: 'source-pack.md',
        worktreeId: 'thread-riverwatch',
        kind: 'doc',
        description: '真实 USGS 数据源包',
        status: 'available',
        createdAt: 1781176284353
      }
    ],
    agents: [
      { id: 'source-curator', name: '资料整理师', alias: '@资料整理师' }
    ]
  });

  assert.equal(board.tasks.length, 1);
  assert.equal(board.tasks[0].id, 'task-source');
  assert.equal(board.tasks[0].agentId, 'source-curator');
  assert.equal(board.tasks[0].status, 'done');
  assert.equal(board.tasks[0].progress, 100);
  assert.equal(board.tasks[0].documents.length, 1);
  assert.equal(board.tasks[0].documents[0].name, 'source-pack.md');
  assert.equal(board.tasks[0].documents[0].workspacePath, 'source-pack.md');
  assert.equal(board.tasks[0].documents[0].worktreeId, 'thread-riverwatch');
});

test('project shared files include board documents before local/mock message files', () => {
  const board = normalizeClowderProjectBoard({
    binding: {
      id: 'binding-riverwatch',
      projectGroupNo: 'riverwatch-group',
      projectName: 'RiverWatch 项目群'
    },
    artifacts: [
      {
        id: 'artifact-source-pack',
        ownerCatId: 'source-curator',
        path: 'source-pack.md',
        workspaceRelativePath: 'source-pack.md',
        worktreeId: 'thread-riverwatch',
        kind: 'doc',
        description: '真实数据源包',
        status: 'available'
      }
    ]
  });
  const files = mergeSharedFilesWithBoardDocuments([
    { id: 'mock-file', type: 'file', name: 'test.md', source: 'mock' }
  ], board);

  assert.equal(collectProjectBoardDocuments(board).length, 1);
  assert.equal(files[0].name, 'source-pack.md');
  assert.equal(files[0].workspacePath, 'source-pack.md');
  assert.equal(files[0].worktreeId, 'thread-riverwatch');
  assert.equal(files[1].name, 'test.md');
});

test('project group info overview exposes member status and produced files', () => {
  const board = normalizeClowderProjectBoard({
    binding: {
      id: 'binding-overview',
      projectGroupNo: 'overview-group',
      projectName: 'Overview 项目群'
    },
    tasks: [
      {
        id: 'task-design',
        assigneeCatId: 'designer',
        title: '分镜设计',
        status: 'completed',
        progress: 100,
        documents: [{
          id: 'storyboard-doc',
          name: 'storyboard.md',
          workspacePath: 'docs/storyboard.md',
          worktreeId: 'thread-overview',
          description: '分镜产出'
        }]
      },
      {
        id: 'task-review',
        assigneeCatId: 'reviewer',
        title: '复杂度校验',
        status: 'blocked',
        progress: 35
      }
    ]
  });

  const overview = deriveProjectGroupInfoOverview({
    board,
    agents: [
      { id: 'designer', name: '土耳其安哥拉猫', alias: '@分镜' },
      { id: 'reviewer', name: '短短', alias: '@校验' }
    ],
    messageFiles: [{ id: 'local-file', type: 'file', name: 'local-note.md', source: 'local' }]
  });

  assert.equal(overview.taskCount, 2);
  assert.equal(overview.completedCount, 1);
  assert.equal(overview.documentCount, 1);
  assert.deepEqual(
    overview.memberStatuses.map((item) => [item.agentName, item.taskTitle, item.statusText, item.documentCount]),
    [
      ['土耳其安哥拉猫', '分镜设计', '已完成', 1],
      ['短短', '复杂度校验', '需修改', 0]
    ]
  );
  assert.equal(overview.files[0].name, 'storyboard.md');
  assert.equal(overview.files[0].workspacePath, 'docs/storyboard.md');
  assert.equal(overview.files[0].worktreeId, 'thread-overview');
  assert.equal(overview.files[1].name, 'local-note.md');
});

test('project board thread ids resolve from group raw binding shapes', () => {
  assert.deepEqual(
    resolveProjectBoardThreadIds({}, {
      raw: {
        binding: {
          thread_id: 'thread-from-raw-binding'
        }
      }
    }),
    ['thread-from-raw-binding']
  );
});

test('file preview resolves workspace artifacts and never falls back to demo content', () => {
  const resolved = resolvePreviewFileSource({
    name: 'source-pack.md',
    type: 'md',
    source: 'clowder',
    generatedByAgent: true,
    workspacePath: 'source-pack.md',
    worktreeId: 'thread-riverwatch'
  });

  assert.equal(
    resolved.url,
    '/v1/clowder/workspace/file/raw?worktreeId=thread-riverwatch&path=source-pack.md'
  );
  assert.equal(resolved.path, 'source-pack.md');
  assert.equal(resolved.worktreeId, 'thread-riverwatch');
  assert.equal(previewContentOrEmpty({ previewKind: 'markdown', fetchedContent: '', fileContent: '' }), '');
  assert.equal(previewContentOrEmpty({ previewKind: 'html', fetchedContent: '', fileContent: '' }), '');
  assert.equal(previewContentOrEmpty({ previewKind: 'code', fetchedContent: '', fileContent: '' }), '');
});

test('mock project boards skip remote clowder binding sync', () => {
  assert.equal(shouldSyncRemoteProjectBoard({ id: 'riverwatch-group', source: 'mock', type: 'group' }), false);
  assert.equal(shouldSyncRemoteProjectBoard({ id: 'local-group', source: 'local', type: 'group' }), false);
  assert.equal(shouldSyncRemoteProjectBoard({ id: 'g-project', source: 'clowder', type: 'group' }), true);
  assert.equal(shouldSyncRemoteProjectBoard({ id: 'g-project', isProjectGroup: true, type: 'group' }), true);
});

test('native service falls back to direct clowder api when tangseng cat proxy fails', async () => {
  const calls = [];
  const request = async (options) => {
    calls.push(options);
    if (options.url === '/v1/clowder/cats?includeUnavailable=true') {
      return {
        statusCode: 502,
        data: { error: 'cat_directory_unavailable', message: 'clowder cat templates failed' }
      };
    }
    if (options.url === '/clowder-api/api/cat-templates') {
      return {
        statusCode: 200,
        data: {
          templates: [
            {
              id: 'architect',
              name: '布偶猫（架构师）',
              nickname: '宪宪',
              roleDescription: '主架构师',
              personality: '温柔但有主见',
              teamStrengths: '架构设计、写代码一把好手'
            }
          ]
        }
      };
    }
    return { statusCode: 404, data: { msg: `unexpected ${options.url}` } };
  };
  const service = createNativeImService({
    baseUrl: '/v1/',
    clowderBaseUrl: '/clowder-api/api/',
    request,
    getToken: () => 'token'
  });

  const directory = await service.fetchClowderCatDirectory({ includeUnavailable: true });

  assert.equal(calls[0].url, '/v1/clowder/cats?includeUnavailable=true');
  assert.equal(calls[1].url, '/clowder-api/api/cat-templates');
  assert.equal(directory.agents.length, 1);
  assert.equal(directory.agents[0].id, 'architect');
  assert.equal(directory.agents[0].name, '布偶猫（架构师）');
  assert.equal(directory.agents[0].creator, 'System');
});

test('native service can prefer direct clowder api for global official directory', async () => {
  const calls = [];
  const request = async (options) => {
    calls.push(options);
    if (options.url === '/clowder-api/api/cat-templates') {
      return {
        statusCode: 200,
        data: {
          templates: [
            {
              id: 'qa',
              name: '英短（QA工程师）',
              teamStrengths: '自动化测试、回归验证'
            }
          ]
        }
      };
    }
    return { statusCode: 404, data: { msg: `unexpected ${options.url}` } };
  };
  const service = createNativeImService({
    baseUrl: '/v1/',
    clowderBaseUrl: '/clowder-api/api/',
    request,
    getToken: () => 'token'
  });

  const directory = await service.fetchClowderCatDirectory({ preferDirect: true });

  assert.equal(calls[0].url, '/clowder-api/api/cat-templates');
  assert.equal(calls.some((call) => call.url.startsWith('/v1/clowder/cats')), false);
  assert.equal(directory.agents[0].id, 'qa');
  assert.equal(directory.agents[0].creator, 'System');
});

test('role template options use cat-template roles without virtual defaults', () => {
  const options = buildRoleTemplateOptions([
    {
      id: 'architect',
      name: '布偶猫（架构师）',
      nickname: '宪宪',
      roleDescription: '主架构师和核心开发者',
      personality: '温柔但有主见',
      teamStrengths: '架构设计、代码实现'
    },
    {
      id: 'qa',
      name: '英短（QA工程师）',
      nickname: '短短',
      roleDescription: 'QA / 测试工程师',
      teamStrengths: '自动化测试、回归验证'
    },
    {
      id: 'coordinator',
      name: '暹罗猫（协调者）',
      nickname: '罗罗',
      roleDescription: '显性 PM / 主 Agent，只协调、少直接执行',
      teamStrengths: '需求澄清、任务拆分、并行调度'
    }
  ]);

  assert.deepEqual(options.map((item) => item.id), ['architect', 'qa', 'coordinator']);
  assert.equal(options.some((item) => item.id === 'general'), false);
  const coordinator = options.find((item) => item.id === 'coordinator');
  assert.equal(coordinator?.label, '暹罗猫（协调者）');
  assert.equal(coordinator?.nickname, '罗罗');
  assert.equal(applyRoleTemplateToForm({
    name: '',
    aliasRaw: '',
    desc: '',
    capabilityTags: [],
    systemPrompt: '',
    roleTemplate: 'architect'
  }, new Set(), coordinator).aliasRaw, 'luoluo');
  assert.equal(options[0].label, '布偶猫（架构师）');
  assert.equal(options[0].description, '主架构师和核心开发者');
  assert.deepEqual(options[1].capabilityTags, ['自动化测试', '回归验证']);
});

test('role template options normalize TangSeng bridged cat template fields', () => {
  const options = buildRoleTemplateOptions([
    {
      roleTemplateId: 'architect',
      catId: 'architect',
      displayName: '布偶猫（架构师）',
      aliases: ['@xianxian'],
      personalitySummary: '温柔但有主见',
      capabilitySummary: '主架构师和核心开发者，擅长深度思考和系统设计',
      source: 'role-template'
    },
    {
      roleTemplateId: 'qa',
      catId: 'qa',
      displayName: '英短（QA工程师）',
      mentionPatterns: ['@duanduan'],
      personalitySummary: '情绪极其稳定',
      capabilitySummary: 'QA / 测试工程师，负责测试策略、自动化用例、回归验证和质量门禁',
      source: 'role-template'
    }
  ]);
  const architect = options.find((item) => item.id === 'architect');
  const qa = options.find((item) => item.id === 'qa');

  assert.equal(architect.label, '布偶猫（架构师）');
  assert.equal(architect.name, '布偶猫（架构师）');
  assert.equal(architect.nickname, 'xianxian');
  assert.equal(architect.roleDescription, '主架构师和核心开发者，擅长深度思考和系统设计');
  assert.equal(architect.personality, '温柔但有主见');
  assert.deepEqual(architect.capabilityTags, ['主架构师和核心开发者', '擅长深度思考和系统设计']);
  assert.equal(qa.label, '英短（QA工程师）');
  assert.equal(qa.nickname, 'duanduan');
});

test('role template selection syncs basic info from cat-template without overwriting dirty fields', () => {
  const template = buildRoleTemplateOptions([
    {
      id: 'peer-reviewer',
      name: '缅因猫（审查官）',
      nickname: '因因',
      roleDescription: '代码审查专家，擅长安全分析、测试覆盖和代码质量把控',
      personality: '严谨认真，注重细节，会直言不讳地指出问题',
      teamStrengths: 'Review、找bug、coding落地',
      restrictions: ['禁止放行未验证的安全风险']
    }
  ]).find((item) => item.id === 'peer-reviewer');

  const synced = applyRoleTemplateToForm({
    name: '',
    aliasRaw: '',
    desc: '',
    capabilityTags: [],
    systemPrompt: '',
    roleTemplate: 'general'
  }, new Set(), template);

  assert.equal(synced.roleTemplate, 'peer-reviewer');
  assert.equal(synced.name, '缅因猫（审查官）');
  assert.equal(synced.aliasRaw, 'yinyin');
  assert.equal(synced.desc, '代码审查专家，擅长安全分析、测试覆盖和代码质量把控');
  assert.deepEqual(synced.capabilityTags, ['Review', '找bug', 'coding落地']);
  assert.match(synced.systemPrompt, /严谨认真/);
  assert.match(synced.systemPrompt, /禁止放行未验证的安全风险/);

  const preserved = applyRoleTemplateToForm({
    name: '自定义名字',
    aliasRaw: 'custom',
    desc: '保留介绍',
    capabilityTags: ['保留标签'],
    systemPrompt: '保留提示词',
    roleTemplate: 'general'
  }, new Set(['name', 'alias', 'desc', 'capabilityTags', 'systemPrompt']), template);

  assert.equal(preserved.roleTemplate, 'peer-reviewer');
  assert.equal(preserved.name, '自定义名字');
  assert.equal(preserved.aliasRaw, 'custom');
  assert.equal(preserved.desc, '保留介绍');
  assert.deepEqual(preserved.capabilityTags, ['保留标签']);
  assert.equal(preserved.systemPrompt, '保留提示词');
});

test('native service keeps normalized clowder cat ids for deletion and direct routing', async () => {
  const request = makeRequestStub({
    'GET clowder/cats?includeUnavailable=true': {
      agents: [{
        catId: 'qqqa',
        id: 'display-card-id',
        displayName: 'QQQA',
        mentionPatterns: ['@QQQA'],
        source: 'runtime-created',
        available: true,
        connected: true
      }]
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const directory = await service.fetchClowderCatDirectory();

  assert.equal(directory.agents.length, 1);
  assert.equal(directory.agents[0].id, 'qqqa');
  assert.equal(directory.agents[0].catId, 'qqqa');
  assert.equal(directory.agents[0].directCatId, 'qqqa');
  assert.equal(resolveAgentDeleteIdentity(directory.agents[0]).catId, 'qqqa');
});

test('native service sends direct clowder cat messages through conversation bridge', async () => {
  const request = makeRequestStub({
    'POST clowder/conversation/message': {
      message_id: 'bridge-1',
      status: 'success'
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const sent = await service.sendClowderConversationMessage({
    channelId: 'clowder_cat:opus',
    channelType: 1,
    text: '你好',
    directCatId: 'opus'
  });

  assert.equal(request.calls[0].method, 'POST');
  assert.equal(request.calls[0].url, '/v1/clowder/conversation/message');
  assert.deepEqual(request.calls[0].data, {
    channelId: 'clowder_cat:opus',
    channelType: 1,
    text: '你好',
    directCatId: 'opus'
  });
  assert.equal(sent.id, 'bridge-1');
  assert.equal(sent.channelId, 'clowder_cat:opus');
  assert.equal(sent.channelType, 1);
  assert.equal(sent.status, 'success');
});

test('native service creates custom clowder cats as routable direct agents', async () => {
  const request = makeRequestStub({
    'POST clowder/cats': {
      threadId: 'thread-pm-1',
      agent: {
        catId: 'custom-reviewer',
        displayName: 'DeepSeek 审查猫',
        alias: '@deep-review',
        defaultModel: 'deepseek-chat',
        platform: 'claude-code',
        capabilityTags: ['代码审查'],
        available: true,
        connected: true
      },
      contact: {
        connected: true,
        source: 'runtime-created'
      },
      binding: {
        channelId: 'clowder_cat:custom-reviewer',
        channelType: 1,
        threadId: 'thread-pm-1'
      }
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const agent = await service.createClowderCat({
    name: 'DeepSeek 审查猫',
    alias: '@deep-review',
    roleTemplateId: 'reviewer',
    platform: 'claude-code',
    accessMode: 'api-key',
    accountRef: 'deepseek-env',
    defaultModel: 'deepseek-chat',
    personality: '严谨审查',
    capabilities: ['代码审查'],
    apiKey: 'sk-should-not-stay-in-browser'
  });

  assert.equal(request.calls[0].method, 'POST');
  assert.equal(request.calls[0].url, '/v1/clowder/cats');
  assert.deepEqual(request.calls[0].data, {
    name: 'DeepSeek 审查猫',
    alias: '@deep-review',
    roleTemplateId: 'reviewer',
    clientId: 'anthropic',
    authType: 'api_key',
    accountRef: 'deepseek-env',
    defaultModel: 'deepseek-chat',
    personality: '严谨审查',
    capabilities: ['代码审查']
  });
  assert.equal(agent.id, 'custom-reviewer');
  assert.equal(agent.directCatId, 'custom-reviewer');
  assert.equal(agent.threadId, 'thread-pm-1');
  assert.equal(agent.directThreadId, 'thread-pm-1');
  assert.equal(agent.source, 'clowder');
  assert.equal(agent.connected, true);
  assert.equal(agent.apiKey, '');
  const conversation = createAgentConversation(agent);
  assert.equal(conversation.threadId, 'thread-pm-1');
  assert.equal(conversation.directThreadId, 'thread-pm-1');
});

test('native service fetches local oauth capabilities by provider', async () => {
  const request = makeRequestStub({
    'GET clowder/local-auth/capabilities': {
      providers: [
        {
          provider: 'codex',
          authConfigured: true,
          profile: 'default',
          defaultModel: 'gpt-5.1-codex'
        },
        {
          provider: 'claude',
          authConfigured: false,
          diagnostics: ['未找到 Claude Code 登录配置']
        }
      ]
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const capabilities = await service.getLocalAuthCapabilities();

  assert.equal(request.calls[0].method, 'GET');
  assert.equal(request.calls[0].url, '/v1/clowder/local-auth/capabilities');
  assert.equal(capabilities.codex.authConfigured, true);
  assert.equal(capabilities.codex.defaultModel, 'gpt-5.1-codex');
  assert.equal(capabilities.claude.authConfigured, false);
  assert.deepEqual(capabilities.claude.diagnostics, ['未找到 Claude Code 登录配置']);
});

test('native service creates oauth clowder cats with local cli account refs', async () => {
  const request = makeRequestStub({
    'POST clowder/cats': {
      agent: {
        catId: 'oauth-codex',
        displayName: 'OAuth Codex',
        alias: '@oauth-codex',
        platform: 'codex',
        accessMode: 'oauth',
        available: true,
        connected: true
      },
      contact: {
        connected: true,
        source: 'runtime-created'
      }
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  await service.createClowderCat({
    name: 'OAuth Codex',
    alias: '@oauth-codex',
    roleTemplateId: 'engineer',
    platform: 'codex',
    accessMode: 'oauth',
    accountRef: 'user-input-should-not-win',
    defaultModel: 'should-not-submit',
    personality: '使用本机 CLI 登录态',
    capabilities: ['代码生成']
  });

  assert.equal(request.calls[0].method, 'POST');
  assert.equal(request.calls[0].url, '/v1/clowder/cats');
  assert.deepEqual(request.calls[0].data, {
    name: 'OAuth Codex',
    alias: '@oauth-codex',
    roleTemplateId: 'engineer',
    clientId: 'openai',
    authType: 'oauth',
    accountRef: 'codex',
    personality: '使用本机 CLI 登录态',
    capabilities: ['代码生成']
  });
  assert.equal(Object.prototype.hasOwnProperty.call(request.calls[0].data, 'defaultModel'), false);
});

test('native service preserves explicit oauth account refs when creating template cats', async () => {
  const request = makeRequestStub({
    'POST clowder/cats': {
      agent: {
        catId: 'oauth-template-cat',
        displayName: 'OAuth Template Cat',
        alias: '@oauth-template-cat',
        platform: 'claude-code',
        accessMode: 'oauth',
        available: true,
        connected: true
      },
      contact: {
        connected: true,
        source: 'runtime-created'
      }
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  await service.createClowderCat({
    name: 'OAuth Template Cat',
    alias: '@oauth-template-cat',
    roleTemplateId: 'source-curator',
    clientId: 'claude-code',
    accessMode: 'oauth',
    accountRef: 'claude-team-profile',
    inheritCoordinatorAuth: true,
    personality: 'inherit coordinator auth',
    capabilities: ['资料整理']
  });

  assert.equal(request.calls[0].method, 'POST');
  assert.equal(request.calls[0].url, '/v1/clowder/cats');
  assert.equal(request.calls[0].data.clientId, 'anthropic');
  assert.equal(request.calls[0].data.authType, 'oauth');
  assert.equal(request.calls[0].data.accountRef, 'claude-team-profile');
  assert.equal(Object.prototype.hasOwnProperty.call(request.calls[0].data, 'defaultModel'), false);
});

test('native service forwards stable cat ids when creating template cats', async () => {
  const request = makeRequestStub({
    'POST clowder/cats': {
      agent: {
        catId: 'riverwatch-source-curator-934553',
        displayName: '狸花猫（资料整理师）',
        alias: '@source-curator',
        platform: 'claude-code',
        accessMode: 'oauth',
        available: true,
        connected: true
      },
      contact: {
        connected: true,
        source: 'runtime-created'
      }
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  await service.createClowderCat({
    catId: 'riverwatch-source-curator-934553',
    name: '狸花猫（资料整理师）',
    alias: '@source-curator',
    roleTemplateId: 'source-curator',
    clientId: 'claude-code',
    accessMode: 'oauth',
    accountRef: 'claude',
    inheritCoordinatorAuth: true
  });

  assert.equal(request.calls[0].data.catId, 'riverwatch-source-curator-934553');
});

test('native service deletes clowder cats through contact lifecycle API', async () => {
  const request = makeRequestStub({
    'DELETE clowder/cats/codex': { deleted: true, id: 'codex' }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const result = await service.deleteClowderCat('codex');

  assert.equal(request.calls[0].method, 'DELETE');
  assert.equal(request.calls[0].url, '/v1/clowder/cats/codex');
  assert.deepEqual(result, { deleted: true, id: 'codex' });
});

test('native service treats missing clowder cats as idempotent deletes', async () => {
  const request = makeRequestStub({
    'DELETE clowder/cats/qqqa': {
      statusCode: 404,
      data: { error: 'Cat "qqqa" not found' }
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const result = await service.deleteClowderCat('qqqa');

  assert.equal(request.calls[0].method, 'DELETE');
  assert.equal(request.calls[0].url, '/v1/clowder/cats/qqqa');
  assert.deepEqual(result, {
    deleted: true,
    id: 'qqqa',
    alreadyDeleted: true,
    status: 404
  });
});

test('native service syncs clowder group cats without sending agents as native members', async () => {
  const request = makeRequestStub({
    'POST clowder/group/cats/sync': {
      groupId: 'g100',
      catIds: ['codex'],
      cats: [{ catId: 'codex', displayName: 'Codex', connected: true }]
    }
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const result = await service.syncGroupCats({
    groupId: 'g100',
    groupName: '研发群',
    agents: [{ id: 'codex', name: 'Codex', alias: '@codex', avatar: 'codex.png', desc: '代码生成' }]
  });

  assert.equal(request.calls[0].method, 'POST');
  assert.equal(request.calls[0].url, '/v1/clowder/group/cats/sync');
  assert.deepEqual(request.calls[0].data.catIds, ['codex']);
  assert.deepEqual(request.calls[0].data.cats, [{
    catId: 'codex',
    displayName: 'Codex',
    aliases: ['@codex'],
    mentionPatterns: ['@codex', 'Codex'],
    avatar: 'codex.png',
    personalitySummary: '代码生成',
    capabilitySummary: '',
    available: true,
    availabilityState: 'available',
    source: 'ui',
    connected: true
  }]);
  assert.equal(request.calls[0].data.prompt.includes('研发群'), true);
  assert.deepEqual(result.catIds, ['codex']);
});

test('agent cleanup identity resolves clowder contact and raw cat ids', () => {
  assert.deepEqual(resolveAgentDeleteIdentity({
    id: 'clowder_cat:codex',
    raw: { cat_id: 'codex-raw' }
  }), {
    catId: 'codex',
    directConversationIds: ['clowder_cat:codex', 'codex']
  });

  assert.deepEqual(resolveAgentDeleteIdentity({
    id: 'local-agent',
    directCatId: 'claude',
    alias: '@claude'
  }), {
    catId: 'claude',
    directConversationIds: ['clowder_cat:claude', 'claude', 'local-agent']
  });
});

test('deleted agent records suppress stale directory agents', () => {
  const deletedRecords = {};
  markAgentDeleted(deletedRecords, {
    id: 'qqqa',
    catId: 'qqqa',
    name: 'QQQA',
    source: 'clowder'
  }, 1781067000000);

  const filtered = filterDeletedAgents([
    { id: 'qqqa', catId: 'qqqa', name: 'QQQA', source: 'clowder' },
    { id: 'architect', catId: 'architect', name: '布偶猫（架构师）', source: 'clowder' }
  ], deletedRecords);

  assert.deepEqual(Object.keys(deletedRecords), ['qqqa']);
  assert.deepEqual(filtered.map((agent) => agent.id), ['architect']);
});

test('deleted agent records allow newer recreated custom agents', () => {
  const deletedRecords = {};
  markAgentDeleted(deletedRecords, {
    id: 'qqqa',
    catId: 'qqqa',
    name: 'QQQA',
    source: 'clowder'
  }, 1781067000000);

  const filtered = filterDeletedAgents([
    {
      id: 'qqqa',
      catId: 'qqqa',
      name: 'QQQA',
      source: 'clowder',
      creator: 'User',
      lastActiveAt: 1781068000000
    }
  ], deletedRecords);

  assert.deepEqual(filtered.map((agent) => agent.id), ['qqqa']);
});

test('agent cleanup prunes agents conversations group members and optional direct messages', () => {
  const state = {
    agents: [
      { id: 'codex', directCatId: 'codex', name: 'Codex' },
      { id: 'claude', directCatId: 'claude', name: 'Claude' }
    ],
    conversations: [
      { id: 'clowder_cat:codex', directCatId: 'codex', type: 'robot' },
      { id: 'g1', type: 'group' },
      { id: 'clowder_cat:claude', directCatId: 'claude', type: 'robot' }
    ],
    members: {
      g1: [
        { id: 'me', nickname: '我' },
        { id: 'codex', agentId: 'codex', isAgent: true },
        { id: 'agent:claude', agentId: 'claude', isAgent: true }
      ]
    },
    messages: {
      'clowder_cat:codex': [{ id: 'm1' }],
      g1: [{ id: 'g-msg', senderId: 'codex' }],
      'clowder_cat:claude': [{ id: 'm2' }]
    },
    activeId: 'clowder_cat:codex'
  };

  const next = cleanupAgentFromLocalState(state, {
    id: 'codex',
    directCatId: 'codex'
  }, {
    deleteDirectMessages: true
  });

  assert.deepEqual(next.agents.map((agent) => agent.id), ['claude']);
  assert.deepEqual(next.conversations.map((conv) => conv.id), ['g1', 'clowder_cat:claude']);
  assert.deepEqual(next.members.g1.map((member) => member.id), ['me', 'agent:claude']);
  assert.equal(Object.prototype.hasOwnProperty.call(next.messages, 'clowder_cat:codex'), false);
  assert.deepEqual(next.messages.g1, [{ id: 'g-msg', senderId: 'codex' }]);
  assert.equal(next.activeId, '');
  assert.deepEqual(next.removedConversationIds, ['clowder_cat:codex']);
  assert.deepEqual(next.directConversationIds, ['clowder_cat:codex', 'codex']);
});

test('deleted conversation records suppress stale sync entries but allow newer messages', () => {
  const deletedAtSeq12 = {
    [conversationDeleteKey('clowder_cat:architect', 1)]: {
      lastSeq: 12,
      lastTime: 1781065600000,
      deletedAt: 1781065700000
    }
  };

  assert.equal(
    shouldSuppressDeletedConversation({
      channelId: 'clowder_cat:architect',
      channelType: 1,
      lastSeq: 12,
      lastTime: 1781065600000
    }, deletedAtSeq12),
    true
  );

  assert.equal(
    shouldSuppressDeletedConversation({
      channelId: 'clowder_cat:architect',
      channelType: 1,
      lastSeq: 13,
      lastTime: 1781065800000
    }, deletedAtSeq12),
    false
  );

  const filtered = filterDeletedConversations([
    { id: 'clowder_cat:architect', channelId: 'clowder_cat:architect', channelType: 1, lastSeq: 12, lastTime: 1781065600000 },
    { id: 'clowder_cat:cs', channelId: 'clowder_cat:cs', channelType: 1, lastSeq: 2, lastTime: 1781065900000 },
    { id: 'clowder_cat:architect', channelId: 'clowder_cat:architect', channelType: 1, lastSeq: 13, lastTime: 1781065800000 }
  ], deletedAtSeq12);

  assert.deepEqual(filtered.map((item) => `${item.channelId}:${item.lastSeq}`), [
    'clowder_cat:cs:2',
    'clowder_cat:architect:13'
  ]);
});

test('agent delete tombstone suppresses stale direct conversation even when sync has fresh timestamp only', () => {
  const deletedAgentDirectConversation = {
    [conversationDeleteKey('clowder_cat:architect', 1)]: {
      lastSeq: Number.MAX_SAFE_INTEGER,
      lastTime: 1781065600000,
      deletedAt: 1781065700000
    }
  };

  assert.equal(
    shouldSuppressDeletedConversation({
      channelId: 'clowder_cat:architect',
      channelType: 1,
      lastSeq: 0,
      lastTime: 1781069900000
    }, deletedAgentDirectConversation),
    true
  );
});

test('agent delete permanent tombstone ignores the previous direct conversation sequence', () => {
  const record = createDeletedConversationRecord({
    channelId: 'clowder_cat:architect',
    channelType: 1,
    lastSeq: 12,
    lastTime: 1781065600000
  }, 1781065700000, { permanent: true });

  assert.equal(record.lastSeq, Number.MAX_SAFE_INTEGER);
  assert.equal(
    shouldSuppressDeletedConversation({
      channelId: 'clowder_cat:architect',
      channelType: 1,
      lastSeq: 0,
      lastTime: 1781069900000
    }, {
      [conversationDeleteKey('clowder_cat:architect', 1)]: record
    }),
    true
  );
});

test('permanent conversation tombstone suppresses newer sync entries', () => {
  const record = createDeletedConversationRecord({
    channelId: 'left-group',
    channelType: 2,
    lastSeq: 12,
    lastTime: 1781065600000
  }, 1781065700000, { permanent: true });

  assert.equal(
    shouldSuppressDeletedConversation({
      channelId: 'left-group',
      channelType: 2,
      lastSeq: 13,
      lastTime: 1781069900000
    }, {
      [conversationDeleteKey('left-group', 2)]: record
    }),
    true
  );
});

test('group upsert respects deleted conversation tombstones from leave group', () => {
  const record = createDeletedConversationRecord({
    channelId: 'left-group',
    channelType: 2,
    lastSeq: 0,
    lastTime: 1781065600000
  }, 1781065700000, { permanent: true });

  const conversations = upsertGroupConversation([], {
    groupNo: 'left-group',
    name: '已退出的群',
    last_msg_time: 1781069900
  }, {
    deletedRecords: {
      [conversationDeleteKey('left-group', 2)]: record
    }
  });

  assert.deepEqual(conversations, []);
});

test('deleted group tombstones suppress group-store shaped records', () => {
  const record = createDeletedConversationRecord({
    channelId: 'left-group',
    channelType: 2
  }, 1781065700000, { permanent: true });

  const groups = filterDeletedGroups([
    { id: 'left-group', name: '已退出的群', memberCount: 2 },
    { id: 'active-group', name: '仍在的群', memberCount: 3 }
  ], {
    [conversationDeleteKey('left-group', 2)]: record
  });

  assert.deepEqual(groups.map((group) => group.id), ['active-group']);
});

test('group creation candidates include existing agents and split native contacts from agents', () => {
  const contacts = [
    { id: 'u1', nickname: '张伟', avatar: 'u1.png' }
  ];
  const agents = [
    { id: 'codex', name: 'Codex', alias: '@codex', avatar: 'codex.png', platform: 'codex' },
    { id: 'claude', name: 'Claude Code', alias: '@claude', status: 'active' }
  ];

  const agentOnlyCandidates = buildSelectableGroupMembers({ contacts: [], agents });
  assert.equal(agentOnlyCandidates.length, 2);
  assert.deepEqual(agentOnlyCandidates.map((item) => item.id), ['agent:codex', 'agent:claude']);
  assert.equal(agentOnlyCandidates[0].inviteType, 'agent');
  assert.equal(agentOnlyCandidates[0].agentId, 'codex');
  assert.equal(agentOnlyCandidates[0].nickname, 'Codex');
  assert.equal(agentOnlyCandidates[0].alias, '@codex');

  const candidates = buildSelectableGroupMembers({
    contacts,
    agents,
    existingMembers: [{ id: 'agent:claude', agentId: 'claude', isAgent: true }]
  });
  assert.deepEqual(candidates.map((item) => item.id), ['agent:codex', 'u1']);

  const split = splitSelectedGroupMembers(['u1', 'agent:codex'], candidates);
  assert.deepEqual(split.contactIds, ['u1']);
  assert.deepEqual(split.agentIds, ['codex']);
  assert.deepEqual(split.agents.map((agent) => agent.id), ['codex']);
});

test('local oauth capability loader dedupes concurrent probes and force refreshes', async () => {
  let calls = 0;
  const loader = createLocalOAuthCapabilityLoader(async () => {
    calls += 1;
    await Promise.resolve();
    return {
      providers: [
        { provider: 'codex', authConfigured: true, defaultModel: 'gpt-5-codex' }
      ]
    };
  });

  const [first, second] = await Promise.all([loader.load(), loader.load()]);

  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.equal(loader.state.loading, false);
  assert.equal(loader.state.capabilities.codex.authConfigured, true);

  await loader.load({ force: true });

  assert.equal(calls, 2);
});

test('local oauth status resolves ready missing error and idle states', () => {
  const capabilities = {
    codex: {
      provider: 'codex',
      authConfigured: true,
      defaultModel: 'gpt-5-codex',
      profile: 'default'
    },
    claude: {
      provider: 'claude',
      authConfigured: false,
      diagnostics: ['请先运行 claude login']
    }
  };

  assert.deepEqual(resolveLocalOAuthStatus({
    accessMode: 'api-key',
    platform: 'codex',
    capabilities
  }), {
    state: 'idle',
    provider: 'codex',
    providerLabel: 'Codex',
    loginCommand: 'codex login',
    canCreate: true,
    capability: null,
    message: '',
    detail: ''
  });

  const ready = resolveLocalOAuthStatus({ accessMode: 'oauth', platform: 'codex', capabilities });
  assert.equal(ready.state, 'ready');
  assert.equal(ready.canCreate, true);
  assert.equal(ready.detail, '配置档：default · CLI 默认模型：gpt-5-codex');

  const missing = resolveLocalOAuthStatus({ accessMode: 'oauth', platform: 'claude-code', capabilities });
  assert.equal(missing.state, 'missing');
  assert.equal(missing.canCreate, false);
  assert.equal(missing.message, '请先运行 claude login');

  const error = resolveLocalOAuthStatus({
    accessMode: 'oauth',
    platform: 'codex',
    capabilities: {},
    error: '探测接口不可用'
  });
  assert.equal(error.state, 'error');
  assert.equal(error.canCreate, false);
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

test('conversation helpers keep locally cleared drafts from stale remote restore', () => {
  const conversations = [{ id: 'g1', channelId: 'g1', channelType: 2, draft: '' }];
  const merged = mergeRemoteDrafts(conversations, [{ channelId: 'g1', channelType: 2, draft: '远端旧草稿' }], {
    clearedKeys: new Set(['g1-2'])
  });

  assert.equal(merged[0].draft, '');
});

test('conversation preview normalizes long multiline text to a single line', () => {
  const preview = formatConversationPreview('第一行\n第二行   |  很长的 markdown 内容');

  assert.equal(preview, '第一行 第二行 | 很长的 markdown 内容');
});

test('conversation draft persistence skips local robot and mock conversations', () => {
  assert.equal(
    shouldPersistConversationDraft({ id: 'clowder_ai', channelId: 'clowder_ai', channelType: 1, type: 'robot', isAgent: true }),
    false
  );
  assert.equal(
    shouldPersistConversationDraft({ id: 'clowder', channelId: 'clowder', channelType: 1, type: 'single' }),
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
  assert.equal(
    shouldPersistConversationDraft({ id: 'group-project', channelId: 'group-project', channelType: 2, type: 'group', projectThreadId: 'thread-project' }),
    false
  );
  assert.equal(
    shouldPersistConversationDraft({ id: 'group-project', channelId: 'group-project', channelType: 2, type: 'group', source: 'clowder', isProjectGroup: true }),
    false
  );
  const [projectGroup] = upsertGroupConversation([], {
    id: 'group-project',
    name: 'RiverWatch PM',
    projectThreadId: 'thread-project'
  });
  assert.equal(projectGroup.projectThreadId, 'thread-project');
  assert.equal(shouldPersistConversationDraft(projectGroup), false);
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

test('group member page helpers keep routing scoped to the current group', () => {
  assert.equal(resolveGroupPageId({ id: 'real-group-160100' }, { activeGroupId: '2', activeConversationId: 'agent-review' }), 'real-group-160100');
  assert.equal(resolveGroupPageId({}, { activeGroupId: 'project-alpha', activeConversationId: '2' }), 'project-alpha');
  assert.equal(resolveGroupPageId({}, { activeConversationId: 'fallback-group' }), 'fallback-group');

  assert.equal(buildGroupScopedRoute('/pages/group/members', 'real-group-160100'), '/pages/group/members?id=real-group-160100');
  assert.equal(buildGroupScopedRoute('/pages/chat/detail', 'group with spaces', { at: 'u 1' }), '/pages/chat/detail?id=group%20with%20spaces&at=u%201');
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

test('conversation normalizer gives message-bearing conversations a visible fallback time', () => {
  const before = Date.now();
  const conversation = normalizeConversation({
    channel_id: 'g-no-last-time',
    channel_type: 2,
    last_message: {
      payload: JSON.stringify({ type: 1, content: '后端只有摘要没有时间' })
    }
  }, {
    name: '缺时间群'
  });
  const after = Date.now();

  assert.equal(conversation.lastMessage, '后端只有摘要没有时间');
  assert.ok(conversation.lastTime >= before);
  assert.ok(conversation.lastTime <= after);
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

test('group upsert gives groups with a real last message a visible fallback time', () => {
  const before = Date.now();
  const conversations = upsertGroupConversation([], {
    group_no: 'g-no-last-time',
    name: '缺时间群',
    last_message: {
      payload: JSON.stringify({ type: 1, content: '群里有摘要但无时间' })
    }
  });
  const after = Date.now();

  assert.equal(conversations[0].lastMessage, '群里有摘要但无时间');
  assert.ok(conversations[0].lastTime >= before);
  assert.ok(conversations[0].lastTime <= after);
});

test('conversation normalizer does not invent current time for empty remote group rows', () => {
  const conversation = normalizeConversation({
    channel_id: 'g-empty-remote',
    channel_type: 2
  }, {
    name: '空远端群'
  });

  assert.equal(conversation.lastMessage, '');
  assert.equal(conversation.lastTime, 0);
});

test('conversation merge preserves group create time fallback when remote sync has no time', () => {
  const groupCreateTime = 1780488000000;
  const conversations = upsertGroupConversation([], {
    group_no: 'g-create-fallback',
    name: '创建时间群',
    created_at: groupCreateTime / 1000
  });

  const existing = conversations[0];
  const remote = normalizeConversation({
    channel_id: 'g-create-fallback',
    channel_type: 2
  }, {
    name: '创建时间群'
  });
  const mergedTimeline = mergeNativeConversationTimeline(existing, remote);

  assert.equal(existing.lastMessage, '你已加入群聊 创建时间群');
  assert.equal(existing.lastTime, groupCreateTime);
  assert.equal(remote.lastTime, 0);
  assert.equal(mergedTimeline.lastMessage, '你已加入群聊 创建时间群');
  assert.equal(mergedTimeline.lastTime, groupCreateTime);
});

test('native group mention messages preserve highlight metadata from synced payloads', () => {
  const message = normalizeMessage({
    message_id: 'mention-msg-1',
    from_uid: '13733632709',
    from_name: '发送者',
    payload: JSON.stringify({
      type: 1,
      content: '@leng_test_updated AT验收 20260609',
      mention: {
        uids: ['18337488675'],
        names: {
          18337488675: 'leng_test_updated'
        }
      }
    })
  });

  assert.deepEqual(message.mentions, [{
    userId: '18337488675',
    uid: '18337488675',
    name: 'leng_test_updated',
    offset: 0
  }]);
});

test('native messages preserve clowder proposal rich blocks as proposal cards', () => {
  const message = normalizeMessage({
    message_id: 'proposal-msg-1',
    from_uid: 'clowder_cat:coordinator',
    payload: JSON.stringify({
      type: 1,
      content: '提议新建 thread：注册链路',
      rich_blocks: [
        {
          id: 'proposal-prop-1',
          kind: 'card',
          title: '提议新建 thread：注册链路',
          bodyMarkdown: '建议拆成独立 thread 跟进。',
          fields: [{ label: '建议成员', value: 'codex' }],
          actions: [
            { label: '批准并创建', action: 'propose:approve', payload: { proposalId: 'prop-1' } },
            { label: '驳回', action: 'propose:reject', payload: { proposalId: 'prop-1' } }
          ]
        }
      ]
    })
  });

  assert.equal(message.type, 'proposal_card');
  assert.equal(message.content, '提议新建 thread：注册链路');
  assert.equal(message.proposalCard.proposalId, 'prop-1');
  assert.equal(message.proposalCard.fields[0].value, 'codex');
  assert.equal(message.richBlocks.length, 1);
});

test('native messages render textual clowder proposal ids as proposal cards', () => {
  const message = normalizeMessage({
    message_id: 'proposal-msg-text',
    from_uid: 'clowder_cat:coordinator',
    payload: JSON.stringify({
      type: 1,
      content: [
        '架构师完成，我来发起一个新 thread 提案。',
        '',
        '提案摘要：',
        '- 📌 标题：架构师测试群',
        '- 👥 成员：宪宪（布偶猫/架构师） + 我（协调者）',
        '- 🔗 提案 ID：proposal_mq84hcmdtx4eadem',
        '',
        '你那边应该能看到一个提案卡片，点「创建」后 thread 就开了。'
      ].join('\n')
    })
  });

  assert.equal(message.type, 'proposal_card');
  assert.equal(message.proposalCard.proposalId, 'proposal_mq84hcmdtx4eadem');
  assert.equal(message.proposalCard.title, '架构师测试群');
  assert.deepEqual(message.proposalCard.actions.map((action) => action.action), ['propose:approve', 'propose:reject']);
});

test('conversation summary marks group messages that mention the current user', () => {
  const message = normalizeMessage({
    message_id: 'mention-msg-2',
    from_uid: '13733632709',
    from_name: '发送者',
    payload: JSON.stringify({
      type: 1,
      content: '@leng_test_updated AT验收 20260609',
      mention: {
        uids: ['18337488675'],
        names: {
          18337488675: 'leng_test_updated'
        }
      }
    })
  });
  const currentUser = { id: '18337488675', uid: '18337488675', nickname: 'leng_test_updated' };

  assert.equal(
    messageState.conversationSummaryForMessage(message, currentUser, { id: 'g-mention', type: 'group' }),
    '[有人@我] 发送者: @leng_test_updated AT验收 20260609'
  );
  assert.equal(
    messageState.conversationSummaryForMessage(message, { id: 'not-mentioned' }, { id: 'g-mention', type: 'group' }),
    '发送者: @leng_test_updated AT验收 20260609'
  );
  assert.equal(
    messageState.conversationSummaryForMessage({ ...message, senderId: '18337488675' }, currentUser, { id: 'g-mention', type: 'group' }),
    '我: @leng_test_updated AT验收 20260609'
  );
});

test('reply targets are scoped to the conversation that created them', () => {
  const messageReply = createReplyTarget({
    id: 'msg-a',
    senderName: '张伟',
    contentPreview: '引用内容'
  }, 'group-a');
  const fileReply = createReplyTarget({
    id: 'file-selection-1',
    fileName: '需求.md',
    contentPreview: '选中的文件片段'
  }, 'group-a');

  assert.equal(messageReply.conversationId, 'group-a');
  assert.equal(fileReply.conversationId, 'group-a');
  assert.equal(replyTargetForConversation(messageReply, 'group-a'), messageReply);
  assert.equal(replyTargetForConversation(messageReply, 'group-b'), null);
  assert.equal(shouldClearReplyTargetOnConversationChange(fileReply, 'group-b'), true);
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

test('clowder generated html files preserve inline preview content', () => {
  const list = messageState.mergeAgentReplyEventIntoList([], {
    streamKey: 'stream-html-1',
    phase: 'final',
    senderId: 'clowder',
    senderName: 'Clowder 协同猫',
    content: 'HTML 文件已生成',
    files: [{
      id: 'html-preview',
      name: 'agent-preview-20260609.html',
      content: '<!doctype html><html><body><h1>Agent HTML Preview</h1></body></html>'
    }]
  });

  assert.equal(list.length, 2);
  assert.equal(list[1].type, 'file');
  assert.equal(list[1].fileType, 'html');
  assert.match(list[1].previewContent, /Agent HTML Preview/);
});

test('native file message payloads normalize sender and receiver file cards', () => {
  const message = normalizeMessage({
    message_id: 'file-msg-1',
    from_uid: '13733632709',
    from_name: '发送者',
    payload: JSON.stringify({
      type: 8,
      content: '[文件] upload-20260609.md',
      file_name: 'upload-20260609.md',
      remote_url: '/files/upload-20260609.md',
      size: 2048
    })
  });

  assert.equal(message.type, 'file');
  assert.equal(message.fileName, 'upload-20260609.md');
  assert.equal(message.name, 'upload-20260609.md');
  assert.equal(message.url, '/files/upload-20260609.md');
  assert.equal(message.content, '[文件] upload-20260609.md');
});

test('native clowder rich file blocks surface as file card messages', () => {
  const incoming = normalizeMessage({
    message_id: 'rich-msg-1',
    from_uid: 'clowder:riverpm',
    from_name: 'RiverWatch PM',
    payload: JSON.stringify({
      type: 1,
      content: '已完成 RiverWatch 产物，请查看文件卡。',
      cat_id: 'riverpm',
      cat_display_name: 'RiverWatch PM',
      rich_blocks: [{
        id: 'riverwatch-prd',
        kind: 'file',
        fileName: 'RiverWatch_PRD.docx',
        url: '/v1/clowder/workspace/file/raw?worktreeId=thread-riverwatch&path=RiverWatch_PRD.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }]
    })
  });

  const list = messageState.mergeNativeMessageIntoList([], incoming, {
    conversation: {
      id: 'riverwatch-group',
      channelId: 'riverwatch-group',
      channelType: 2,
      type: 'group',
      source: 'clowder',
      isProjectGroup: true
    },
    currentUser: { id: 'demo-user' }
  });

  assert.equal(list.length, 2);
  assert.equal(list[0].type, 'text');
  assert.equal(list[1].type, 'file');
  assert.equal(list[1].fileName, 'RiverWatch_PRD.docx');
  assert.equal(list[1].url, '/v1/clowder/workspace/file/raw?worktreeId=thread-riverwatch&path=RiverWatch_PRD.docx');
  assert.equal(list[1].generatedByAgent, true);
  assert.equal(list[1].senderName, 'RiverWatch PM');
});

test('clowder helper creates markdown placeholder chunks and final event', () => {
  assert.equal(typeof messageState.isClowderConversation, 'function');
  assert.equal(typeof messageState.createClowderMarkdownStreamEvents, 'function');
  assert.equal(messageState.isClowderConversation({ id: 'clowder_ai', name: 'Clowder AI', type: 'robot' }), true);
  assert.equal(messageState.isClowderConversation({ id: 'clowder', name: 'clowder', type: 'single' }), true);

  const events = messageState.createClowderMarkdownStreamEvents('请用 markdown 表格总结当前任务', {
    streamKey: 'clowder-test-stream',
    targetMessageId: 'prompt-for-stream',
    chunkSize: 24
  });
  assert.equal(events[0].phase, 'placeholder');
  assert.equal(events[0].targetMessageId, 'prompt-for-stream');
  assert.ok(events.some((event) => event.phase === 'chunk'));
  assert.equal(events.at(-1).phase, 'final');
  assert.equal(new Set(events.map((event) => event.streamKey)).size, 1);
  assert.match(events.at(-1).content, /\| 项目 \| 说明 \|/);
  assert.match(events.at(-1).content, /```markdown/);

  const firstChunk = events.find((event) => event.phase === 'chunk');
  const streaming = [events[0], firstChunk].reduce(
    (list, event) => messageState.mergeAgentReplyEventIntoList(list, event),
    []
  );
  assert.doesNotMatch(streaming[0].content, /正在思考/);
  assert.equal(streaming[0].streaming, true);

  const merged = events.reduce(
    (list, event) => messageState.mergeAgentReplyEventIntoList(list, event),
    []
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].streaming, false);
  assert.equal(merged[0].renderMode, 'markdown');
  assert.equal(merged[0].content, events.at(-1).content);
});

test('native clowder stream messages normalize and merge as one markdown message', () => {
  const chunk = normalizeMessage({
    message_id: 'wk-1',
    client_msg_no: 'clowder-stream-invoke-1',
    from_uid: 'clowder:opus',
    payload: JSON.stringify({
      type: 1,
      content: '## 标题\n\n| 项 | 值 |\n| --- | --- |\n| A | B | ▌',
      format: 'markdown',
      markdown: true,
      stream: {
        state: 'chunk',
        platform_message_id: 'im-web-stream-1'
      },
      platform_message_id: 'im-web-stream-1'
    })
  });
  const final = normalizeMessage({
    message_id: 'wk-2',
    client_msg_no: 'clowder-stream-invoke-1',
    from_uid: 'clowder:opus',
    payload: JSON.stringify({
      type: 1,
      content: '## 标题\n\n| 项 | 值 |\n| --- | --- |\n| A | B |',
      format: 'markdown',
      markdown: true,
      stream: {
        state: 'final',
        platform_message_id: 'im-web-stream-1'
      },
      platform_message_id: 'im-web-stream-1'
    })
  });

  assert.equal(chunk.streamKey, 'im-web-stream-1');
  assert.equal(chunk.streamPhase, 'chunk');
  assert.equal(chunk.renderMode, 'markdown');
  assert.equal(chunk.streaming, true);

  const merged = messageState.mergeNativeMessageIntoList(
    messageState.mergeNativeMessageIntoList([], chunk),
    final
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'im-web-stream-1');
  assert.equal(merged[0].streaming, false);
  assert.equal(merged[0].status, 'success');
  assert.doesNotMatch(merged[0].content, /▌$/);
});

test('native clowder reaction event adds an idempotent emoji to the target user message', () => {
  assert.equal(typeof messageState.applyReactionEventIntoList, 'function');
  const messages = [{
    id: 'user-message-1',
    messageId: 'user-message-1',
    senderId: 'u1',
    senderName: '我',
    content: '请处理这个任务',
    type: 'text',
    reactions: []
  }];
  const event = normalizeMessage({
    message_id: 'reaction-event-1',
    payload: JSON.stringify({
      type: 1000,
      event: 'clowder_reaction',
      target_message_id: 'user-message-1',
      emoji: '❤️',
      user_id: 'clowder'
    })
  });

  const once = messageState.applyReactionEventIntoList(messages, event.reactionEvent);
  const twice = messageState.applyReactionEventIntoList(once, event.reactionEvent);

  assert.equal(event.isSilentSystem, true);
  assert.deepEqual(twice[0].reactions, [{ emoji: '❤️', userIds: ['clowder'], count: 1 }]);
});

test('synced clowder history preserves local successful user prompt until backend echo arrives', () => {
  assert.equal(typeof messageState.mergeSyncedMessagesPreservingLocalContext, 'function');
  const localPrompt = {
    id: 'local-prompt-1',
    clientMsgNo: 'local-prompt-1',
    senderId: 'u1',
    senderName: '我',
    content: '请总结任务',
    type: 'text',
    status: 'success',
    source: 'clowder',
    time: 1000,
    reactions: []
  };
  const localPending = {
    id: 'local-pending-1',
    clientMsgNo: 'local-pending-1',
    senderId: 'u1',
    content: '还在发送',
    type: 'text',
    status: 'sending',
    time: 1100
  };
  const remoteFinal = {
    id: 'stream-1',
    streamKey: 'stream-1',
    senderId: 'clowder',
    senderName: 'Clowder AI',
    content: '任务总结完成',
    type: 'text',
    status: 'success',
    time: 1200
  };

  const merged = messageState.mergeSyncedMessagesPreservingLocalContext(
    [localPrompt, localPending],
    [remoteFinal],
    { currentUser: { id: 'u1' }, conversation: { id: 'clowder_cat:opus', type: 'robot', source: 'clowder' } }
  );

  assert.deepEqual(merged.map((message) => message.id), ['local-prompt-1', 'local-pending-1', 'stream-1']);
  assert.equal(merged[0].content, '请总结任务');
});

test('synced clowder history preserves local coordinator confirmation cards', () => {
  const templateCard = {
    id: 'coordinator-template-cats-card:prompt-riverwatch',
    type: 'coordinator_template_cats_request',
    contentType: 'coordinator_template_cats_request',
    senderId: 'riverpm144763',
    senderName: 'RiverWatch PM 144763',
    content: '协调者盘点：建议创建 1 个缺失模板猫猫（RiverWatch 多交付项目）',
    status: 'success',
    time: 1100,
    coordinatorTemplateCatsCard: {
      cardId: 'coordinator-template-cats-card:prompt-riverwatch',
      status: 'pending_confirmation',
      items: [{ roleTemplateId: 'devops', templateId: 'devops', name: '孟加拉猫（DevOps）', status: 'pending' }],
      reusableCats: [{ id: 'bobo', name: '波斯猫（前端工程师）', matchedRole: 'frontend' }]
    },
    metadata: { coordinator_template_cats_request: true }
  };
  const projectCard = {
    id: 'project-group-card:prompt-riverwatch',
    type: 'project_group_confirmation',
    contentType: 'project_group_confirmation',
    senderId: 'riverpm144763',
    senderName: 'RiverWatch PM 144763',
    content: 'PM / 协调者建议创建项目群：RiverWatch PM 144763 项目群',
    status: 'success',
    time: 1200,
    projectGroupCard: {
      cardId: 'project-group-card:prompt-riverwatch',
      status: 'pending_confirmation',
      targetCatIds: ['bobo'],
      workerCatIds: ['bobo']
    },
    metadata: { project_group_confirmation: true }
  };
  const remoteFinal = {
    id: 'remote-final-riverwatch',
    senderId: 'clowder_cat:riverpm144763',
    content: '我会先组织项目群和执行智能体。',
    type: 'text',
    status: 'success',
    time: 1300
  };

  const merged = messageState.mergeSyncedMessagesPreservingLocalContext(
    [templateCard, projectCard],
    [remoteFinal],
    { currentUser: { id: 'u1' }, conversation: { id: 'clowder_cat:riverpm144763', type: 'robot', source: 'clowder' } }
  );

  assert.deepEqual(merged.map((message) => message.id), [
    'coordinator-template-cats-card:prompt-riverwatch',
    'project-group-card:prompt-riverwatch',
    'remote-final-riverwatch'
  ]);
});

test('agent placeholder ack adds reaction to user prompt instead of visible thinking message', () => {
  const userPrompt = {
    id: 'prompt-ack-1',
    clientMsgNo: 'prompt-ack-1',
    senderId: 'u1',
    senderName: '我',
    content: '请开始分析',
    type: 'text',
    status: 'success',
    time: 1000,
    reactions: []
  };

  const acknowledged = messageState.mergeAgentReplyEventIntoList([userPrompt], {
    streamKey: 'stream-ack-1',
    phase: 'placeholder',
    targetMessageId: 'prompt-ack-1',
    emoji: '👀',
    senderId: 'clowder:opus',
    senderName: 'Opus'
  });

  assert.equal(acknowledged.length, 1);
  assert.equal(acknowledged[0].content, '请开始分析');
  assert.deepEqual(acknowledged[0].reactions, [{ emoji: '👀', userIds: ['clowder:opus'], count: 1 }]);
});

test('local agent pending feedback is scoped and cleared by first reply chunk', () => {
  assert.equal(typeof messageState.applyAgentPendingFeedbackIntoList, 'function');
  assert.equal(typeof messageState.clearAgentPendingFeedbackFromList, 'function');
  const userPrompt = {
    id: 'prompt-pending-1',
    clientMsgNo: 'prompt-pending-client-1',
    senderId: 'u1',
    senderName: '我',
    content: '请开始分析',
    type: 'text',
    status: 'success',
    time: 1000,
    reactions: [
      { emoji: '👍', userIds: ['reviewer'], count: 1 }
    ]
  };

  const pending = messageState.applyAgentPendingFeedbackIntoList([userPrompt], {
    targetMessageId: 'prompt-pending-client-1',
    agentId: 'clowder:opus',
    emoji: '👀',
    streamKey: 'pending:prompt-pending-client-1'
  });

  assert.equal(pending.length, 1);
  assert.deepEqual(pending[0].reactions, [
    { emoji: '👍', userIds: ['reviewer'], count: 1 },
    {
      emoji: '👀',
      userIds: ['clowder:opus'],
      count: 1,
      kind: 'agent_pending',
      streamKey: 'pending:prompt-pending-client-1',
      localOnly: true
    }
  ]);

  const answered = messageState.mergeAgentReplyEventIntoList(pending, {
    streamKey: 'stream-pending-1',
    phase: 'chunk',
    targetMessageId: 'prompt-pending-client-1',
    delta: '收到，开始处理。',
    senderId: 'clowder:opus',
    senderName: 'Opus'
  });

  assert.equal(answered.length, 2);
  assert.deepEqual(answered[0].reactions, [{ emoji: '👍', userIds: ['reviewer'], count: 1 }]);
  assert.equal(answered[1].id, 'stream-pending-1');
  assert.equal(answered[1].content, '收到，开始处理。');
});

test('native clowder reply chunk clears local pending feedback by target message id', () => {
  const userPrompt = {
    id: 'prompt-native-pending-1',
    messageId: 'prompt-native-pending-1',
    clientMsgNo: 'prompt-native-client-1',
    senderId: 'u1',
    senderName: '我',
    content: '请开始分析',
    type: 'text',
    status: 'success',
    time: 1000,
    reactions: []
  };
  const pending = messageState.applyAgentPendingFeedbackIntoList([userPrompt], {
    targetMessageId: 'prompt-native-pending-1',
    agentId: 'opus',
    streamKey: 'pending:prompt-native-pending-1'
  });
  const chunk = normalizeMessage({
    message_id: 'stream-native-pending-1',
    from_uid: 'clowder_cat:opus',
    payload: JSON.stringify({
      type: 1000,
      event: 'clowder_stream',
      stream_key: 'stream-native-pending-1',
      phase: 'chunk',
      target_message_id: 'prompt-native-pending-1',
      delta: '收到，开始处理。',
      markdown: true
    }),
    timestamp: 2
  });

  const merged = messageState.mergeNativeMessageIntoList(pending, chunk, {
    currentUser: { id: 'u1' },
    conversation: { id: 'clowder_cat:opus', type: 'robot', source: 'clowder' }
  });

  assert.equal(chunk.targetMessageId, 'prompt-native-pending-1');
  assert.deepEqual(merged[0].reactions, []);
  assert.equal(merged[1].id, 'stream-native-pending-1');
  assert.equal(merged[1].content, '收到，开始处理。');
});

test('native clowder placeholder without target reacts to latest self prompt and stays hidden', () => {
  const userPrompt = {
    id: 'prompt-real-ack-1',
    messageId: 'prompt-real-ack-1',
    clientMsgNo: 'prompt-real-ack-1',
    senderId: 'u1',
    senderName: '我',
    content: '真实账号问题复现',
    type: 'text',
    status: 'success',
    time: 1000,
    reactions: []
  };
  const placeholder = normalizeMessage({
    message_id: 'placeholder-real-1',
    from_uid: 'clowder_cat:opus',
    payload: JSON.stringify({
      type: 1000,
      event: 'clowder_stream',
      stream_key: 'im-web-real-placeholder-1',
      phase: 'placeholder',
      content: '【布偶猫🐱】🤔 思考中...',
      markdown: true
    }),
    timestamp: 2
  });

  const merged = messageState.mergeNativeMessageIntoList(
    [userPrompt],
    placeholder,
    {
      currentUser: { id: 'u1' },
      conversation: { id: 'clowder_cat:opus', type: 'robot', source: 'clowder' }
    }
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'prompt-real-ack-1');
  assert.deepEqual(merged[0].reactions, [{ emoji: '👀', userIds: ['clowder_cat:opus'], count: 1 }]);
  assert.equal(merged.some((message) => /思考中/.test(String(message.content || ''))), false);
});

test('synced clowder history restores cached prompt after refresh and filters standalone thinking placeholders', () => {
  const cachedPrompt = {
    id: 'cached-refresh-prompt-1',
    messageId: 'cached-refresh-prompt-1',
    clientMsgNo: 'cached-refresh-prompt-1',
    senderId: 'u1',
    senderName: '我',
    content: '刷新后仍应显示这条用户消息',
    type: 'text',
    status: 'success',
    source: 'clowder',
    time: 1000,
    reactions: []
  };
  const placeholder = normalizeMessage({
    message_id: 'placeholder-refresh-1',
    from_uid: 'clowder_cat:opus',
    payload: JSON.stringify({
      type: 1000,
      event: 'clowder_stream',
      stream_key: 'im-web-refresh-placeholder-1',
      phase: 'placeholder',
      content: '【布偶猫🐱】🤔 思考中...',
      markdown: true
    }),
    timestamp: 2
  });
  const finalReply = normalizeMessage({
    message_id: 'final-refresh-1',
    from_uid: 'clowder_cat:opus',
    payload: JSON.stringify({
      type: 1,
      content: '刷新后仍应显示这条用户消息 收到，宪宪确认通过 ✅'
    }),
    timestamp: 3
  });

  const merged = messageState.mergeSyncedMessagesPreservingLocalContext(
    [],
    [placeholder, finalReply],
    {
      currentUser: { id: 'u1' },
      conversation: { id: 'clowder_cat:opus', type: 'robot', source: 'clowder' },
      preservedContextMessages: [cachedPrompt]
    }
  );

  assert.deepEqual(merged.map((message) => message.id), ['cached-refresh-prompt-1', 'final-refresh-1']);
  assert.deepEqual(merged[0].reactions, [{ emoji: '👀', userIds: ['clowder_cat:opus'], count: 1 }]);
  assert.equal(merged.some((message) => /思考中/.test(String(message.content || ''))), false);
});

test('clowder prompt context cache survives refresh and deduplicates prompts per account conversation', () => {
  assert.equal(typeof messageState.rememberClowderPromptContext, 'function');
  assert.equal(typeof messageState.readClowderPromptContext, 'function');
  const values = new Map();
  const storage = {
    getStorageSync: (key) => values.get(key) || '',
    setStorageSync: (key, value) => values.set(key, value)
  };
  const currentUser = { id: 'u1', name: '我' };
  const prompt = {
    id: 'remote-prompt-cache-1',
    messageId: 'remote-prompt-cache-1',
    clientMsgNo: 'local-prompt-cache-1',
    senderId: 'u1',
    senderName: '我',
    content: '缓存这条真实用户消息',
    type: 'text',
    status: 'success',
    time: 1000,
    reactions: []
  };

  messageState.rememberClowderPromptContext(storage, 'clowder_cat:opus', prompt, currentUser);
  messageState.rememberClowderPromptContext(storage, 'clowder_cat:opus', prompt, currentUser);

  const restored = messageState.readClowderPromptContext(storage, 'clowder_cat:opus', currentUser);

  assert.equal(restored.length, 1);
  assert.equal(restored[0].id, 'remote-prompt-cache-1');
  assert.equal(restored[0].content, '缓存这条真实用户消息');
  assert.equal(restored[0].senderId, 'u1');
});

test('native clowder stream system events normalize as mergeable markdown deltas', () => {
  const chunk = normalizeMessage({
    message_id: 'evt-chunk-1',
    from_uid: 'clowder:opus',
    payload: JSON.stringify({
      type: 1000,
      event: 'clowder_stream',
      stream_key: 'real-stream-1',
      phase: 'chunk',
      delta: '## 任务',
      markdown: true
    })
  });
  const final = normalizeMessage({
    message_id: 'evt-final-1',
    from_uid: 'clowder:opus',
    payload: JSON.stringify({
      type: 1000,
      event: 'clowder_stream',
      stream_key: 'real-stream-1',
      phase: 'final',
      content: '## 任务\n\n已完成',
      markdown: true
    })
  });

  assert.equal(chunk.type, 'text');
  assert.equal(chunk.streamKey, 'real-stream-1');
  assert.equal(chunk.streamPhase, 'chunk');
  assert.equal(chunk.content, '## 任务');
  assert.equal(chunk.streaming, true);

  const merged = messageState.mergeNativeMessageIntoList(
    messageState.mergeNativeMessageIntoList([], chunk),
    final
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'real-stream-1');
  assert.equal(merged[0].content, '## 任务\n\n已完成');
  assert.equal(merged[0].streaming, false);
});

test('native clowder stream chunk deltas append until final replaces content', () => {
  const firstChunk = normalizeMessage({
    message_id: 'evt-chunk-a',
    from_uid: 'clowder:opus',
    payload: JSON.stringify({
      type: 1000,
      event: 'clowder_stream',
      stream_key: 'delta-stream-1',
      phase: 'chunk',
      delta: '## '
    })
  });
  const secondChunk = normalizeMessage({
    message_id: 'evt-chunk-b',
    from_uid: 'clowder:opus',
    payload: JSON.stringify({
      type: 1000,
      event: 'clowder_stream',
      stream_key: 'delta-stream-1',
      phase: 'chunk',
      delta: '任务'
    })
  });
  const final = normalizeMessage({
    message_id: 'evt-final-b',
    from_uid: 'clowder:opus',
    payload: JSON.stringify({
      type: 1000,
      event: 'clowder_stream',
      stream_key: 'delta-stream-1',
      phase: 'final',
      content: '## 任务\n\n完成'
    })
  });

  const streaming = messageState.mergeNativeMessageIntoList(
    messageState.mergeNativeMessageIntoList([], firstChunk),
    secondChunk
  );
  assert.equal(streaming[0].content, '## 任务');
  assert.equal(streaming[0].streaming, true);

  const completed = messageState.mergeNativeMessageIntoList(streaming, final);
  assert.equal(completed[0].content, '## 任务\n\n完成');
  assert.equal(completed[0].streaming, false);
});

test('durable clowder stream messages without phase stay completed during history merge', () => {
  const durableFinal = {
    id: 'durable-stream-1',
    streamKey: 'durable-stream-1',
    messageId: 'durable-stream-1',
    senderId: 'clowder',
    senderName: 'Clowder AI',
    type: 'text',
    content: '最终回复',
    status: 'success',
    streaming: false,
    renderMode: 'markdown',
    time: 1000
  };

  const merged = messageState.mergeNativeMessageIntoList([], durableFinal);

  assert.equal(merged[0].id, 'durable-stream-1');
  assert.equal(merged[0].content, '最终回复');
  assert.equal(merged[0].status, 'success');
  assert.equal(merged[0].streaming, false);
});

test('native clowder duplicate durable replies with different ids collapse', () => {
  const conversation = { id: 'clowder_cat:luoluo', type: 'robot', source: 'clowder' };
  const first = normalizeMessage({
    message_id: 'wk-first-reply',
    client_msg_no: 'first-client-msg',
    from_uid: 'clowder_cat:luoluo',
    from_name: '暹罗猫（协调者）',
    timestamp: 1781067600,
    payload: JSON.stringify({
      type: 1,
      content: '## 快慢指针 PPT 课程汇报\n\n1. 需求拆解\n2. 分工派发',
      format: 'markdown',
      markdown: true
    })
  });
  const duplicate = normalizeMessage({
    message_id: 'wk-second-reply',
    client_msg_no: 'second-client-msg',
    from_uid: 'clowder_cat:luoluo',
    from_name: '暹罗猫（协调者）',
    timestamp: 1781067602,
    payload: JSON.stringify({
      type: 1,
      content: '## 快慢指针 PPT 课程汇报\n\n1. 需求拆解\n2. 分工派发',
      format: 'markdown',
      markdown: true
    })
  });

  const merged = messageState.mergeNativeMessageIntoList(
    messageState.mergeNativeMessageIntoList([], first, { conversation }),
    duplicate,
    { conversation }
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].content, first.content);
  assert.equal(merged[0].senderId, 'clowder_cat:luoluo');
});

test('native clowder final durable reply replaces partial streamed bubble', () => {
  const conversation = { id: 'clowder_cat:qq', type: 'robot', source: 'clowder' };
  const partial = normalizeMessage({
    message_id: 'wk-partial-reply',
    client_msg_no: 'partial-client-msg',
    from_uid: 'clowder_cat:qq',
    from_name: 'QQ',
    timestamp: 1781067700,
    payload: JSON.stringify({
      type: 1,
      content: [
        'QQ～宪宪在呢！🐾',
        '',
        '不过开工自检扫到两个小问题，先跟你同步一下：',
        '',
        '1. 主仓库在 new_ui 分支上',
        '2. 有 5 个未 push 的 commit，内容涉及长期上下文接口、智能'
      ].join('\n'),
      format: 'markdown',
      markdown: true
    })
  });
  const final = normalizeMessage({
    message_id: 'wk-final-reply',
    client_msg_no: 'final-client-msg',
    from_uid: 'clowder_cat:qq',
    from_name: 'QQ',
    timestamp: 1781067702,
    payload: JSON.stringify({
      type: 1,
      content: [
        'QQ～宪宪在呢！🐾',
        '',
        '不过开工自检扫到两个小问题，先跟你同步一下：',
        '',
        '1. 主仓库在 new_ui 分支上',
        '2. 有 5 个未 push 的 commit，内容涉及长期上下文接口、智能体消息修复、Clowder 直聊名称退化等。需要 push 吗？',
        '',
        '有什么需要我做的？'
      ].join('\n'),
      format: 'markdown',
      markdown: true
    })
  });

  const merged = messageState.mergeNativeMessageIntoList(
    messageState.mergeNativeMessageIntoList([], partial, { conversation }),
    final,
    { conversation }
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'wk-final-reply');
  assert.equal(merged[0].content, final.content);
  assert.equal(merged[0].streaming, false);
});

test('native clowder short durable markdown fragments collapse into one reply bubble', () => {
  const conversation = { id: 'clowder_cat:pm', type: 'robot', source: 'clowder' };
  const fragments = [
    ['wk-frag-1', '1. **'],
    ['wk-frag-2', '其他执行猫** 已完成需求分析。'],
    ['wk-frag-3', '\n2. **'],
    ['wk-frag-4', '等待蓝蓝 spec_lock'],
    ['wk-frag-5', ' lock**)'],
    ['wk-frag-6', '\n3. **验收** 输出已聚合。']
  ].map(([messageId, content], index) => normalizeMessage({
    message_id: messageId,
    client_msg_no: `frag-client-${index + 1}`,
    from_uid: 'clowder_cat:pm',
    from_name: 'PM',
    timestamp: 1781067800 + index,
    payload: JSON.stringify({
      type: 1,
      content,
      format: 'markdown',
      markdown: true
    })
  }));

  const merged = fragments.reduce(
    (list, message) => messageState.mergeNativeMessageIntoList(list, message, { conversation }),
    []
  );

  assert.equal(merged.length, 1);
  assert.equal(
    merged[0].content,
    '1. **其他执行猫** 已完成需求分析。\n2. **等待蓝蓝 spec_lock lock**)\n3. **验收** 输出已聚合。'
  );
  assert.equal(merged[0].senderId, 'clowder_cat:pm');
  assert.equal(merged[0].streaming, false);
});

test('native text payload unwraps nested JSON content strings before rendering', () => {
  const nested = normalizeMessage({
    message_id: 'wk-nested-json-text',
    client_msg_no: 'nested-json-client',
    from_uid: 'clowder_cat:pm',
    from_name: 'PM',
    timestamp: 1781067900,
    payload: JSON.stringify({
      type: 1,
      content: JSON.stringify({
        type: 1,
        content: 'PM 已完成聚合，不应把 JSON 外壳显示成乱码。',
        format: 'markdown',
        markdown: true
      })
    })
  });

  assert.equal(nested.content, 'PM 已完成聚合，不应把 JSON 外壳显示成乱码。');
  assert.equal(nested.renderMode, 'markdown');
  assert.equal(nested.isMarkdown, true);
});

test('native clowder fragment merge appends normalized text instead of structured raw payload', () => {
  const conversation = { id: 'clowder_cat:pm', type: 'robot', source: 'clowder' };
  const first = normalizeMessage({
    message_id: 'wk-frag-json-1',
    client_msg_no: 'frag-json-client-1',
    from_uid: 'clowder_cat:pm',
    from_name: 'PM',
    timestamp: 1781068000,
    payload: JSON.stringify({
      type: 1,
      content: '1. **',
      format: 'markdown',
      markdown: true
    })
  });
  const second = {
    ...normalizeMessage({
      message_id: 'wk-frag-json-2',
      client_msg_no: 'frag-json-client-2',
      from_uid: 'clowder_cat:pm',
      from_name: 'PM',
      timestamp: 1781068001,
      payload: JSON.stringify({
        type: 1,
        content: '聚合结论** 已发送给用户。',
        format: 'markdown',
        markdown: true
      })
    }),
    raw: {
      type: 1,
      content: JSON.stringify({
        type: 1,
        content: '聚合结论** 已发送给用户。'
      })
    }
  };

  const merged = messageState.mergeNativeMessageIntoList(
    messageState.mergeNativeMessageIntoList([], first, { conversation }),
    second,
    { conversation }
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].content, '1. **聚合结论** 已发送给用户。');
  assert.equal(merged[0].content.includes('"type"'), false);
});

test('synced native history keeps older local messages when latest page is partial', () => {
  const conversation = { id: 'clowder_cat:pm', type: 'robot', source: 'clowder' };
  const olderUser = {
    id: 'old-user-1',
    messageId: 'old-user-1',
    clientMsgNo: 'old-user-client-1',
    senderId: 'u1',
    senderName: '我',
    content: '这条较早的本地历史不应因为只拉最新页而消失',
    type: 'text',
    status: 'success',
    source: 'clowder',
    time: 1000,
    reactions: []
  };
  const olderCat = {
    id: 'old-cat-1',
    messageId: 'old-cat-1',
    senderId: 'clowder_cat:pm',
    senderName: 'PM',
    content: '这条较早的智能体回复也应保留',
    type: 'text',
    status: 'success',
    source: 'clowder',
    time: 1100,
    reactions: []
  };
  const latestRemote = {
    id: 'latest-remote-1',
    messageId: 'latest-remote-1',
    senderId: 'clowder_cat:pm',
    senderName: 'PM',
    content: '最新同步页里的回复',
    type: 'text',
    status: 'success',
    source: 'clowder',
    time: 2000,
    reactions: []
  };

  const merged = messageState.mergeSyncedMessagesPreservingLocalContext(
    [olderUser, olderCat],
    [latestRemote],
    {
      currentUser: { id: 'u1' },
      conversation,
      partialSync: true
    }
  );

  assert.deepEqual(merged.map((message) => message.id), ['old-user-1', 'old-cat-1', 'latest-remote-1']);
});

test('native clowder generated workspace files resolve through clowder workspace raw proxy', () => {
  const normalized = messageState.normalizeAgentReplyEvent({
    streamKey: 'ppt-artifact-stream',
    phase: 'final',
    content: 'PPTX 已生成：slides/presentation.pptx',
    generatedFiles: [
      {
        fileName: 'presentation.pptx',
        fileType: 'pptx',
        path: 'slides/presentation.pptx',
        worktreeId: 'main'
      }
    ]
  });

  assert.equal(normalized.files.length, 1);
  const file = normalized.files[0];
  assert.equal(file.fileName, 'presentation.pptx');
  assert.equal(file.path, 'slides/presentation.pptx');
  assert.equal(file.worktreeId, 'main');
  assert.equal(
    file.url,
    '/v1/clowder/workspace/file/raw?worktreeId=main&path=slides%2Fpresentation.pptx'
  );
  assert.notEqual(file.url, 'slides/presentation.pptx');
  assert.equal(file.sourceUrl, file.url);
  assert.equal(file.contentUrl, file.url);
});

test('mobile preview payload keeps workspace path without treating file name as inline content', () => {
  const payload = buildPreviewFilePayload({
    id: 'issue044-file',
    fileName: 'lesson.md',
    content: 'lesson.md',
    fileType: 'md',
    url: '/v1/clowder/workspace/file/raw?worktreeId=seedcmp&path=slides%2Flesson.md',
    sourceUrl: '/v1/clowder/workspace/file/raw?worktreeId=seedcmp&path=slides%2Flesson.md',
    contentUrl: '/v1/clowder/workspace/file/raw?worktreeId=seedcmp&path=slides%2Flesson.md',
    path: 'slides/lesson.md',
    workspacePath: 'slides/lesson.md',
    worktreeId: 'seedcmp',
    source: 'clowder',
    generatedByAgent: true
  });

  assert.equal(payload.name, 'lesson.md');
  assert.equal(payload.content, 'lesson.md');
  assert.equal(payload.previewContent, '');
  assert.equal(payload.path, 'slides/lesson.md');
  assert.equal(payload.workspacePath, 'slides/lesson.md');
  assert.equal(payload.worktreeId, 'seedcmp');
  assert.equal(payload.generatedByAgent, true);
});

test('native service manages clowder manual context pins through TangSeng bridge', async () => {
  const request = makeRequestStub({
    'GET clowder/thread/thread-direct-1/manual-context-pins?limit=5': {
      threadId: 'thread-direct-1',
      pins: [{
        id: 'pin-1',
        threadId: 'thread-direct-1',
        messageId: 'msg-1',
        contentExcerpt: '用户明确要求所有回答使用中文',
        status: 'active'
      }]
    },
    'POST clowder/thread/thread-direct-1/manual-context-pins': {
      pin: {
        id: 'pin-1',
        threadId: 'thread-direct-1',
        messageId: 'msg-1',
        contentExcerpt: '用户明确要求所有回答使用中文',
        status: 'active'
      }
    },
    'PATCH clowder/thread/thread-direct-1/manual-context-pins/source-status': {
      threadId: 'thread-direct-1',
      pins: [{
        id: 'pin-1',
        messageId: 'msg-1',
        status: 'source_deleted'
      }]
    },
    'DELETE clowder/thread/thread-direct-1/manual-context-pins/pin-1': {}
  });
  const service = createNativeImService({
    baseUrl: '/v1/',
    request,
    getToken: () => 'token'
  });

  const listed = await service.listManualContextPins('thread-direct-1', { limit: 5 });
  const created = await service.upsertManualContextPin('thread-direct-1', {
    channelId: 'clowder_cat:luoluo',
    channelType: 1,
    messageId: 'msg-1',
    clientMsgNo: 'client-1',
    contentExcerpt: '用户明确要求所有回答使用中文',
    senderName: '我'
  });
  const marked = await service.markManualContextPinSourceStatus('thread-direct-1', {
    messageId: 'msg-1',
    status: 'source_deleted'
  });
  await service.removeManualContextPin('thread-direct-1', 'pin-1');

  assert.equal(listed[0].id, 'pin-1');
  assert.equal(created.id, 'pin-1');
  assert.equal(marked[0].status, 'source_deleted');
  assert.equal(request.calls[0].method, 'GET');
  assert.equal(request.calls[0].url, '/v1/clowder/thread/thread-direct-1/manual-context-pins?limit=5');
  assert.equal(request.calls[1].method, 'POST');
  assert.equal(request.calls[1].url, '/v1/clowder/thread/thread-direct-1/manual-context-pins');
  assert.deepEqual(request.calls[1].data, {
    channelId: 'clowder_cat:luoluo',
    channelType: 1,
    messageId: 'msg-1',
    clientMsgNo: 'client-1',
    contentExcerpt: '用户明确要求所有回答使用中文',
    senderName: '我'
  });
  assert.equal(request.calls[2].method, 'PATCH');
  assert.equal(request.calls[2].url, '/v1/clowder/thread/thread-direct-1/manual-context-pins/source-status');
  assert.deepEqual(request.calls[2].data, {
    messageId: 'msg-1',
    status: 'source_deleted'
  });
  assert.equal(request.calls[3].method, 'DELETE');
  assert.equal(request.calls[3].url, '/v1/clowder/thread/thread-direct-1/manual-context-pins/pin-1');
});

test('manual context pin helpers resolve threads build payloads and mark messages', () => {
  const directConversation = {
    id: 'clowder_cat:luoluo',
    channelId: 'clowder_cat:luoluo',
    channelType: 1,
    type: 'robot',
    threadId: 'thread-direct-1'
  };
  const groupConversation = {
    id: 'group-1',
    channelId: 'group-1',
    channelType: 2,
    type: 'group',
    projectThreadId: 'thread-group-1',
    binding: {
      thread_id: 'thread-group-fallback'
    }
  };
  const message = {
    id: 'local-1',
    messageId: 'msg-server-1',
    clientMsgNo: 'client-1',
    messageSeq: 42,
    senderName: '产品经理',
    type: 'text',
    content: '## 关键约束\n\n后续回答必须先列风险，再给实现步骤。'.repeat(8)
  };
  const fileMessage = {
    id: 'file-local',
    messageId: 'file-msg-1',
    senderName: '设计师',
    type: 'file',
    fileName: '需求说明.md'
  };

  const payload = buildManualContextPinPayload(message, directConversation);
  const filePayload = buildManualContextPinPayload(fileMessage, groupConversation);
  const marked = applyManualContextPinsToMessages([message, fileMessage], [{
    id: 'pin-1',
    threadId: 'thread-direct-1',
    messageId: 'msg-server-1',
    status: 'active',
    contentExcerpt: payload.contentExcerpt
  }]);

  assert.equal(resolveConversationThreadId(directConversation), 'thread-direct-1');
  assert.equal(resolveConversationThreadId(groupConversation), 'thread-group-1');
  assert.equal(payload.channelId, 'clowder_cat:luoluo');
  assert.equal(payload.channelType, 1);
  assert.equal(payload.messageId, 'msg-server-1');
  assert.equal(payload.clientMsgNo, 'client-1');
  assert.equal(payload.messageSeq, 42);
  assert.equal(payload.senderName, '产品经理');
  assert(payload.contentExcerpt.includes('关键约束'));
  assert(payload.contentExcerpt.length <= 240);
  assert.equal(filePayload.channelId, 'group-1');
  assert.equal(filePayload.channelType, 2);
  assert.equal(filePayload.contentExcerpt, '[文件] 需求说明.md');
  assert.equal(marked[0].manualContextPinned, true);
  assert.equal(marked[0].manualContextPinId, 'pin-1');
  assert.equal(marked[1].manualContextPinned, false);
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

test('native normalizer hides empty time-only system messages from chat and digest', () => {
  const normalized = normalizeMessage({
    message_id: 'sys-time-1',
    timestamp: 1780490400,
    content: JSON.stringify({ type: 1000, time: 1780490400 })
  });

  assert.equal(normalized.type, 'system');
  assert.equal(normalized.content, '');
  assert.equal(normalized.isSilentSystem, true);
  assert.equal(messageState.isVisibleChatMessage(normalized), false);
  assert.equal(
    messageState.conversationSummaryForMessage(normalized, {}, { type: 'single' }),
    ''
  );

  const conversation = normalizeConversation({
    channel_id: 'filehelper',
    channel_type: 1,
    last_message: {
      timestamp: 1780490400,
      payload: JSON.stringify({ type: 1000, time: 1780490400 })
    }
  }, {
    name: 'filehelper'
  });
  assert.equal(conversation.lastMessage, '');
  assert.equal(conversation.lastTime, 1780490400000);
});

test('native normalizer renders group system event messages with concrete text', () => {
  assert.deepEqual(
    normalizeContent({
      type: 1000,
      event: 'group_member_add',
      operator_name: '张伟',
      members: [{ name: '李四' }, { uid: 'u5', name: '王五' }]
    }),
    {
      type: 'system',
      content: '张伟 邀请 李四、王五 加入群聊',
      systemEvent: 'group_member_add',
      isSilentSystem: false
    }
  );

  assert.equal(
    normalizeContent({
      type: 1000,
      event: 'group_notice_update',
      operator_name: '群主',
      notice: '今晚 8 点发布新公告'
    }).content,
    '群主 修改了群公告：今晚 8 点发布新公告'
  );

  assert.equal(
    normalizeContent({ type: 99, event: 'group_exit', operator_name: '李四' }).content,
    '李四 退出了群聊'
  );
});

test('self id resolver accepts backend userId user_id and raw id shapes', () => {
  assert.equal(messageState.resolveSelfId({ userId: 'u-userId' }), 'u-userId');
  assert.equal(messageState.resolveSelfId({ user_id: 'u-user-id' }), 'u-user-id');
  assert.equal(messageState.resolveSelfId({ raw: { id: 'u-raw-id' } }), 'u-raw-id');
});

test('outbound sender prefers real current user over page fallback sender', () => {
  const sender = messageState.resolveOutboundSender({
    uid: 'u100',
    nickname: '真实用户',
    avatar: '/avatar/u100.png'
  }, {
    id: 'me',
    name: '我'
  });

  assert.deepEqual(sender, {
    id: 'u100',
    name: '真实用户',
    avatar: '/avatar/u100.png'
  });
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

test('mock h5 media messages stay local successful when no upload backend exists', () => {
  assert.equal(typeof messageState.shouldUseLocalMockMediaSuccess, 'function');
  assert.equal(
    messageState.shouldUseLocalMockMediaSuccess(
      { id: '2', type: 'group', source: 'mock' },
      { type: 'image', url: 'blob:http://localhost/mock-image' }
    ),
    true
  );
  assert.equal(
    messageState.shouldKeepLocalSendSuccess(
      { msg: '未获取到上传地址' },
      { id: '2', type: 'group', source: 'mock' }
    ),
    true
  );
  assert.equal(
    messageState.shouldUseLocalMockMediaSuccess(
      { id: 'real-g1', type: 'group' },
      { type: 'file', url: '/tmp/report.txt' }
    ),
    false
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
    applyClowderAgentDirectoryToConversations,
    createAgentConversation,
    createAgentMember,
    getClowderCatIdFromContactId,
    mergeClowderAgentRuntimeConfig,
    shouldPreserveClowderAgentDisplayName
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

  const clowderConversation = createAgentConversation({
    id: 'opus',
    name: '布偶猫',
    source: 'clowder',
    raw: { catId: 'opus' },
    desc: '官方猫猫'
  });
  assert.equal(clowderConversation.id, 'clowder_cat:opus');
  assert.equal(clowderConversation.channelId, 'clowder_cat:opus');
  assert.equal(clowderConversation.channelType, 1);
  assert.equal(clowderConversation.type, 'robot');
  assert.equal(clowderConversation.source, 'clowder');
  assert.equal(clowderConversation.agentId, 'opus');
  assert.equal(clowderConversation.directCatId, 'opus');
  assert.equal(getClowderCatIdFromContactId('clowder_cat:opus'), 'opus');

  const technicalNameConversation = createAgentConversation({
    id: 'luoluo',
    name: 'clowder_cat:luoluo',
    displayName: '暹罗猫（协调者）',
    source: 'clowder',
    alias: '@luoluo',
    raw: { catId: 'luoluo' },
    desc: '需求澄清、任务拆分'
  });
  assert.equal(technicalNameConversation.id, 'clowder_cat:luoluo');
  assert.equal(technicalNameConversation.name, '暹罗猫（协调者）');

  const riverPmAgent = {
    id: 'riverpm-real',
    catId: 'riverpm-real',
    directCatId: 'riverpm-real',
    name: 'RiverWatch PM',
    roleTemplate: 'coordinator',
    platform: 'claude-code',
    accessMode: 'oauth',
    source: 'clowder',
    raw: { catId: 'riverpm-real' }
  };
  const riverPmConversation = createAgentConversation(riverPmAgent);
  const resolvedRiverPm = findAgentForConversation(riverPmConversation, [
    { id: 'frontend', name: 'Frontend', roleTemplate: 'frontend' },
    riverPmAgent
  ]);
  assert.equal(riverPmConversation.id, 'clowder_cat:riverpm-real');
  assert.equal(resolvedRiverPm?.id, 'riverpm-real');
  assert.equal(resolvedRiverPm?.roleTemplate, 'coordinator');

  assert.equal(
    shouldPreserveClowderAgentDisplayName(clowderConversation, {
      id: 'clowder_cat:opus',
      channelId: 'clowder_cat:opus',
      name: 'clowder_cat:opus'
    }),
    true
  );
  assert.equal(
    shouldPreserveClowderAgentDisplayName(clowderConversation, {
      id: 'clowder_cat:opus',
      channelId: 'clowder_cat:opus',
      name: '布偶猫',
      type: 'single'
    }),
    true
  );
  const refreshedPm = mergeClowderAgentRuntimeConfig(
    {
      id: 'riverpm-real',
      catId: 'riverpm-real',
      directCatId: 'riverpm-real',
      name: 'RiverWatch PM',
      roleTemplate: 'general',
      templateId: 'general',
      platform: 'clowder',
      accessMode: 'backend',
      accountRef: '',
      source: 'clowder',
      raw: { source: 'existing' }
    },
    {
      id: 'riverpm-real',
      catId: 'riverpm-real',
      directCatId: 'riverpm-real',
      name: 'RiverWatch PM',
      roleTemplate: 'coordinator',
      templateId: 'coordinator',
      platform: 'claude-code',
      accessMode: 'oauth',
      accountRef: 'claude',
      source: 'clowder',
      creator: 'User'
    }
  );
  assert.equal(refreshedPm.platform, 'claude-code');
  assert.equal(refreshedPm.accessMode, 'oauth');
  assert.equal(refreshedPm.accountRef, 'claude');
  assert.equal(refreshedPm.roleTemplate, 'coordinator');
  assert.equal(refreshedPm.templateId, 'coordinator');
  assert.equal(
    shouldPreserveClowderAgentDisplayName(clowderConversation, {
      id: 'clowder_cat:opus',
      channelId: 'clowder_cat:opus',
      name: 'clowder_cat:opus',
      type: 'single'
    }),
    true
  );
  assert.equal(
    shouldPreserveClowderAgentDisplayName({
      ...clowderConversation,
      name: 'clowder_cat:opus'
    }, {
      id: 'clowder_cat:opus',
      channelId: 'clowder_cat:opus',
      name: '布偶猫',
      type: 'single'
    }),
    false
  );

  const mergedMembers = mergeGroupMembersWithAgentMembers([
    { id: 'u1', nickname: '用户一', role: 'owner' },
    { id: 'clowder_cat:coordinator', nickname: 'PM', role: 'admin' }
  ], [
    { catId: 'coordinator', displayName: '暹罗猫（协调者）', alias: '@pm', source: 'clowder' },
    { catId: 'codex', displayName: 'Codex', alias: '@codex', source: 'clowder' }
  ]);

  assert.equal(mergedMembers.length, 3);
  assert.equal(mergedMembers.find((item) => item.id === 'clowder_cat:coordinator').isAgent, true);
  assert.equal(mergedMembers.find((item) => item.id === 'clowder_cat:coordinator').agentId, 'coordinator');
  assert.equal(mergedMembers.find((item) => item.id === 'codex').nickname, 'Codex');

  const restoredConversations = applyClowderAgentDirectoryToConversations([
    {
      id: 'clowder_cat:architect',
      channelId: 'clowder_cat:architect',
      channelType: 1,
      type: 'single',
      name: 'clowder_cat:architect',
      avatar: ''
    }
  ], [
    {
      id: 'architect',
      catId: 'architect',
      name: '布偶猫（架构师）',
      avatar: 'architect.png',
      source: 'clowder'
    }
  ]);

  assert.equal(restoredConversations[0].name, '布偶猫（架构师）');
  assert.equal(restoredConversations[0].avatar, 'architect.png');
  assert.equal(restoredConversations[0].type, 'robot');
  assert.equal(restoredConversations[0].directCatId, 'architect');

  const restoredAliasConversation = applyClowderAgentDirectoryToConversations([
    {
      id: 'clowder_cat:luoluo',
      channelId: 'clowder_cat:luoluo',
      channelType: 1,
      type: 'single',
      name: 'clowder_cat:luoluo',
      avatar: ''
    }
  ], [
    {
      id: 'coordinator',
      catId: 'coordinator',
      name: '暹罗猫（协调者）',
      alias: '@luoluo',
      aliases: ['@luoluo'],
      mentionPatterns: ['@luoluo', '罗罗'],
      avatar: 'keeper.png',
      source: 'clowder'
    }
  ]);

  assert.equal(restoredAliasConversation[0].name, '暹罗猫（协调者）');
  assert.equal(restoredAliasConversation[0].avatar, 'keeper.png');
  assert.equal(restoredAliasConversation[0].type, 'robot');
  assert.equal(restoredAliasConversation[0].directCatId, 'luoluo');
});

test('clowder direct cat conversations are detected for bridge routing', () => {
  assert.equal(typeof messageState.isClowderDirectCatConversation, 'function');
  assert.equal(
    messageState.isClowderDirectCatConversation({
      id: 'clowder_cat:opus',
      channelId: 'clowder_cat:opus',
      channelType: 1,
      source: 'clowder',
      directCatId: 'opus'
    }),
    true
  );
  assert.equal(
    messageState.resolveClowderDirectCatId({
      id: 'clowder_cat:opus',
      channelId: 'clowder_cat:opus'
    }),
    'opus'
  );
  assert.equal(
    messageState.isClowderDirectCatConversation({
      id: 'g1',
      channelId: 'g1',
      channelType: 2,
      type: 'group'
    }),
    false
  );
});

test('clowder project group conversations are detected for bridge routing', () => {
  assert.equal(typeof messageState.isClowderProjectGroupConversation, 'function');
  assert.equal(
    messageState.isClowderProjectGroupConversation({
      id: 'riverwatch-group',
      channelId: 'riverwatch-group',
      channelType: 2,
      type: 'group',
      projectThreadId: 'thread-riverwatch-1'
    }),
    true
  );
  assert.equal(
    messageState.isClowderProjectGroupConversation({
      id: 'plain-group',
      channelId: 'plain-group',
      channelType: 2,
      type: 'group'
    }),
    false
  );
  assert.equal(
    messageState.shouldStartLocalClowderStream({
      id: 'riverwatch-group',
      channelId: 'riverwatch-group',
      channelType: 2,
      type: 'group',
      projectThreadId: 'thread-riverwatch-1'
    }),
    false
  );
});

test('clowder project group bridge payload carries thread and mentioned cats', () => {
  assert.equal(typeof messageState.buildClowderConversationBridgePayload, 'function');

  const payload = messageState.buildClowderConversationBridgePayload({
    id: 'riverwatch-group',
    channelId: 'riverwatch-group',
    channelType: 2,
    type: 'group',
    name: 'RiverWatch 项目群',
    projectThreadId: 'thread-riverwatch-1'
  }, {
    content: '@资料整理师 请生成真实文件卡',
    mentions: [
      { userId: 'clowder_cat:source-curator', name: '资料整理师' },
      { userId: 'runtime-cat-frontend', name: '前端工程师' },
      { userId: 'clowder_cat:source-curator', name: '资料整理师' }
    ]
  });

  assert.deepEqual(payload, {
    text: '@资料整理师 请生成真实文件卡',
    threadId: 'thread-riverwatch-1',
    targetCatIds: ['source-curator', 'runtime-cat-frontend'],
    promptContext: '项目群：RiverWatch 项目群'
  });
});

test('clowder project group bridge payload derives target cats from line-start text mentions', () => {
  const payload = messageState.buildClowderConversationBridgePayload({
    id: 'riverwatch-group',
    channelId: 'riverwatch-group',
    channelType: 2,
    type: 'group',
    name: 'RiverWatch 项目群',
    projectThreadId: 'thread-riverwatch-1',
    catMembers: [
      { id: 'runtime-cat-source', name: '狸花猫（资料整理师）', alias: '@狸花猫（资料整理师）' },
      { id: 'runtime-cat-deck', name: '俄罗斯蓝猫（叙事策略师）', alias: '@俄罗斯蓝猫（叙事策略师）' }
    ]
  }, {
    content: `@狸花猫（资料整理师）
请你只负责生成 source-pack.md，并用 cc_rich 发送文件卡。`,
    mentions: []
  });

  assert.deepEqual(payload, {
    text: '@狸花猫（资料整理师）\n请你只负责生成 source-pack.md，并用 cc_rich 发送文件卡。',
    threadId: 'thread-riverwatch-1',
    targetCatIds: ['runtime-cat-source'],
    promptContext: '项目群：RiverWatch 项目群'
  });
});

test('clowder project group bridge payload does not revive stale codex runtime cats when Claude OAuth members exist', () => {
  const payload = messageState.buildClowderConversationBridgePayload({
    id: 'riverwatch-group',
    channelId: 'riverwatch-group',
    channelType: 2,
    type: 'group',
    name: 'RiverWatch 项目群',
    projectThreadId: 'thread-riverwatch-claude',
    catMemberIds: ['runtime-cat-18b7fe993abed0a2', 'source-curator-claude'],
    workerCatIds: ['runtime-cat-18b7fe993abed0a2'],
    targetCatIds: ['runtime-cat-18b7fe993abed0a2'],
    catMembers: [
      {
        id: 'runtime-cat-18b7fe993abed0a2',
        name: '狸花猫（资料整理师）',
        alias: '@狸花猫（资料整理师）',
        clientId: 'openai',
        accountRef: 'codex',
        authType: 'oauth'
      },
      {
        id: 'source-curator-claude',
        name: '狸花猫（资料整理师）',
        alias: '@狸花猫（资料整理师）',
        clientId: 'anthropic',
        accountRef: 'claude',
        authType: 'oauth'
      }
    ]
  }, {
    content: `@狸花猫（资料整理师）
请你只负责生成 source-pack.md，并用 cc_rich 发送文件卡。`,
    mentions: []
  });

  assert.deepEqual(payload, {
    text: '@狸花猫（资料整理师）\n请你只负责生成 source-pack.md，并用 cc_rich 发送文件卡。',
    threadId: 'thread-riverwatch-claude',
    targetCatIds: ['source-curator-claude'],
    promptContext: '项目群：RiverWatch 项目群'
  });
});

test('project group conversation upsert preserves cat members for mention routing', () => {
  const [conversation] = upsertGroupConversation([], {
    id: 'riverwatch-group',
    name: 'RiverWatch 项目群',
    projectThreadId: 'thread-riverwatch-1',
    catMemberIds: ['runtime-cat-source'],
    catMembers: [
      { id: 'runtime-cat-source', name: '狸花猫（资料整理师）', alias: '@狸花猫（资料整理师）' }
    ]
  });

  assert.deepEqual(conversation.catMemberIds, ['runtime-cat-source']);
  assert.deepEqual(conversation.catMembers, [
    { id: 'runtime-cat-source', name: '狸花猫（资料整理师）', alias: '@狸花猫（资料整理师）' }
  ]);
});

test('conversation display unread ignores mock and locally read conversations', () => {
  const conversations = [
    { id: 'mock-a', channelId: 'mock-a', channelType: 1, source: 'mock', unread: 3 },
    { id: 'active-a', channelId: 'active-a', channelType: 1, unread: 2 },
    { id: 'fresh-a', channelId: 'fresh-a', channelType: 1, unread: 4, lastSeq: 9 },
    { id: 'read-a', channelId: 'read-a', channelType: 1, unread: 5, lastSeq: 7 }
  ];
  const readMarkers = {
    'read-a:1': { seq: 7, time: 1781000000000 }
  };

  assert.equal(conversationDisplayUnread(conversations[0]), 0);
  assert.equal(conversationDisplayUnread(conversations[1], { activeId: 'active-a' }), 0);
  assert.equal(conversationDisplayUnread(conversations[3], { readMarkers }), 0);
  assert.equal(totalDisplayUnread(conversations, { activeId: 'active-a', readMarkers }), 4);
});

test('coordinator capability profile detection covers ppt and review intents', async () => {
  const {
    detectRequiredCapabilityProfile,
    scanExistingCats,
    findMissingRoles
  } = await import('../services/native-im/coordinator-capability.js');

  const pptProfile = detectRequiredCapabilityProfile('帮我做一个 PPT 演示成稿');
  assert.equal(pptProfile?.id, 'ppt-delivery');
  assert.ok(pptProfile.roleTemplateIds.includes('source-curator'));
  assert.ok(pptProfile.roleTemplateIds.includes('deck-strategist'));

  const reviewProfile = detectRequiredCapabilityProfile('请评审一下这个架构方案');
  assert.equal(reviewProfile?.id, 'architecture-review');
  assert.equal(detectRequiredCapabilityProfile('今天天气怎么样'), null);

  const availableAgents = [
    { id: 'cat-1', name: '资料官', roleTemplate: 'source-curator', capabilityTags: ['资料整理'] },
    { id: 'cat-2', name: '架构师', roleTemplate: 'architect', capabilityTags: ['系统设计'] }
  ];
  const reusable = scanExistingCats({ requiredProfile: pptProfile, availableAgents });
  assert.equal(reusable.length, 1);
  assert.equal(reusable[0].id, 'cat-1');

  const missing = findMissingRoles({ requiredProfile: pptProfile, availableAgents });
  assert.deepEqual(missing.sort(), ['deck-qa-exporter', 'deck-strategist', 'storyboard-designer', 'svg-executor-guardian'].sort());
});

test('coordinator missing role scan ignores role-template catalog entries', async () => {
  const {
    detectRequiredCapabilityProfile,
    findMissingRoles,
    scanExistingCats
  } = await import('../services/native-im/coordinator-capability.js');
  const {
    buildCoordinatorTemplateCatsRequestInput
  } = await import('../services/native-im/coordinator-template-cats.js');

  const profile = detectRequiredCapabilityProfile('RiverWatch 项目需要 PPT、PRD、Vue 前端页面、README 和 preview 部署链接');
  assert.equal(profile?.id, 'riverwatch-delivery');

  const availableAgents = [
    { id: 'tpl-source', name: '资料整理模板', roleTemplate: 'source-curator', source: 'role-template', raw: { source: 'role-template' } },
    { id: 'tpl-deck', name: 'PPT 模板', roleTemplate: 'deck-strategist', source: 'official', raw: { source: 'role-template' } },
    { id: 'source-curator', name: '资料整理师', roleTemplate: 'source-curator', source: 'clowder', raw: { source: 'disconnected' } },
    { id: 'deck-strategist', name: 'PPT 策略师', roleTemplate: 'deck-strategist', source: 'clowder', raw: { source: 'disconnected' } },
    { id: 'frontend', name: 'Frontend', roleTemplate: 'frontend', source: 'clowder', raw: { source: 'disconnected' } },
    {
      id: 'runtime-cat-source',
      name: '狸花猫（资料整理师）',
      roleTemplate: 'general',
      source: 'clowder',
      raw: {
        source: 'runtime-created',
        roleDescription: 'PPT / 文档源材料整理专家，负责资料转 Markdown、素材清单、来源结构和输入完整性检查',
        teamStrengths: 'source processing、资料清洗、素材盘点、引用和缺口识别'
      }
    },
    { id: 'real-devops', name: 'DevOps', roleTemplate: 'devops', source: 'user' }
  ];

  const missing = findMissingRoles({ requiredProfile: profile, availableAgents });
  assert.ok(!missing.includes('source-curator'));
  assert.ok(missing.includes('deck-strategist'));
  assert.ok(missing.includes('frontend'));
  assert.ok(!missing.includes('devops'));

  const cardInput = buildCoordinatorTemplateCatsRequestInput({
    conversation: { id: 'clowder_cat:riverpm', channelId: 'clowder_cat:riverpm', channelType: 1, type: 'robot', source: 'clowder', directCatId: 'riverpm', name: 'RiverWatch PM' },
    coordinator: { id: 'riverpm', name: 'RiverWatch PM', roleTemplate: 'coordinator', platform: 'claude-code', accessMode: 'oauth', accountRef: 'claude' },
    sourceMessage: { id: 'msg-riverwatch', content: 'RiverWatch 项目需要 PPT、PRD、Vue 前端页面、README 和 preview 部署链接' },
    text: 'RiverWatch 项目需要 PPT、PRD、Vue 前端页面、README 和 preview 部署链接',
    availableAgents,
    templates: [
      { id: 'source-curator', name: '资料整理师' },
      { id: 'deck-strategist', name: 'PPT 策略师' },
      { id: 'storyboard-designer', name: '分镜设计师' },
      { id: 'frontend', name: 'Frontend' },
      { id: 'devops', name: 'DevOps' }
    ]
  });
  assert.deepEqual(
    cardInput.items.map((item) => item.roleTemplateId).sort(),
    ['deck-strategist', 'frontend', 'storyboard-designer'].sort()
  );

  const allMissingInput = buildCoordinatorTemplateCatsRequestInput({
    conversation: { id: 'clowder_cat:riverpm', channelId: 'clowder_cat:riverpm', channelType: 1, type: 'robot', source: 'clowder', directCatId: 'riverpm', name: 'RiverWatch PM' },
    coordinator: { id: 'riverpm', name: 'RiverWatch PM', roleTemplate: 'coordinator', platform: 'claude-code', accessMode: 'oauth', accountRef: 'claude' },
    sourceMessage: { id: 'msg-riverwatch-all-missing', content: 'RiverWatch 项目需要 PPT、PRD、Vue 前端页面、README 和 preview 部署链接' },
    text: 'RiverWatch 项目需要 PPT、PRD、Vue 前端页面、README 和 preview 部署链接',
    availableAgents: [{ id: 'riverpm', name: 'RiverWatch PM', roleTemplate: 'coordinator', source: 'user' }],
    templates: [
      { id: 'source-curator', name: '资料整理师' },
      { id: 'deck-strategist', name: 'PPT 策略师' },
      { id: 'storyboard-designer', name: '分镜设计师' },
      { id: 'frontend', name: 'Frontend' },
      { id: 'devops', name: 'DevOps' }
    ]
  });
  assert.equal(allMissingInput.items.length, 5);
  assert.deepEqual(allMissingInput.reusableCats, []);
});

test('claude oauth coordinator does not reuse codex runtime cats for RiverWatch roles', async () => {
  const {
    detectRequiredCapabilityProfile,
    findMissingRoles,
    scanExistingCats
  } = await import('../services/native-im/coordinator-capability.js');
  const {
    buildCoordinatorTemplateCatsRequestInput
  } = await import('../services/native-im/coordinator-template-cats.js');
  const {
    buildProjectGroupConfirmationInput
  } = await import('../services/native-im/project-group.js');

  const prompt = 'RiverWatch 项目需要 PPT、PRD、Vue 前端页面、README 和 preview 部署链接';
  const profile = detectRequiredCapabilityProfile(prompt);
  const coordinator = {
    id: 'riverpm',
    name: 'RiverWatch PM',
    roleTemplate: 'coordinator',
    platform: 'claude-code',
    accessMode: 'oauth',
    accountRef: 'claude'
  };
  const availableAgents = [
    {
      id: 'runtime-cat-source',
      name: '狸花猫（资料整理师）',
      source: 'clowder',
      roleTemplate: 'general',
      platform: 'codex',
      clientId: 'openai',
      accessMode: 'oauth',
      accountRef: 'codex',
      raw: {
        source: 'runtime-created',
        clientId: 'openai',
        accountRef: 'codex',
        roleDescription: 'PPT / 文档源材料整理专家，source processing、资料清洗、素材盘点'
      }
    },
    {
      id: 'runtime-cat-deck',
      name: '俄罗斯蓝猫（叙事策略师）',
      source: 'clowder',
      roleTemplate: 'general',
      platform: 'codex',
      clientId: 'openai',
      accessMode: 'oauth',
      accountRef: 'codex',
      capabilityTags: ['deck-strategist'],
      raw: { source: 'runtime-created', clientId: 'openai', accountRef: 'codex' }
    },
    {
      id: 'bobo',
      name: '波斯猫（前端工程师）',
      source: 'clowder',
      roleTemplate: 'general',
      platform: 'claude-code',
      clientId: 'anthropic',
      accessMode: 'oauth',
      accountRef: 'claude',
      capabilityTags: ['前端架构', 'Vue 页面实现']
    },
    {
      id: 'devops',
      name: '孟加拉猫（DevOps）',
      source: 'clowder',
      roleTemplate: 'devops',
      platform: 'claude-code',
      clientId: 'anthropic',
      accessMode: 'oauth',
      accountRef: 'claude'
    }
  ];
  const coordinatorProfile = {
    platform: 'claude-code',
    provider: 'claude',
    accessMode: 'oauth',
    accountRef: 'claude'
  };

  assert.deepEqual(
    scanExistingCats({ requiredProfile: profile, availableAgents, coordinatorProfile }).map((cat) => cat.id).sort(),
    ['bobo', 'devops'].sort()
  );
  assert.deepEqual(
    findMissingRoles({ requiredProfile: profile, availableAgents, coordinatorProfile }).sort(),
    ['deck-strategist', 'source-curator', 'storyboard-designer'].sort()
  );

  const templateInput = buildCoordinatorTemplateCatsRequestInput({
    conversation: {
      id: 'clowder_cat:riverpm',
      channelId: 'clowder_cat:riverpm',
      channelType: 1,
      type: 'robot',
      source: 'clowder',
      directCatId: 'riverpm',
      name: 'RiverWatch PM'
    },
    coordinator,
    sourceMessage: { id: 'msg-riverwatch-claude', content: prompt },
    text: prompt,
    availableAgents,
    templates: [
      { id: 'source-curator', name: '资料整理师' },
      { id: 'deck-strategist', name: 'PPT 策略师' },
      { id: 'storyboard-designer', name: '分镜设计师' },
      { id: 'frontend', name: 'Frontend' },
      { id: 'devops', name: 'DevOps' }
    ]
  });

  assert.deepEqual(
    templateInput.items.map((item) => item.roleTemplateId).sort(),
    ['deck-strategist', 'source-curator', 'storyboard-designer'].sort()
  );
  assert.deepEqual(
    templateInput.reusableCats.map((cat) => cat.id).sort(),
    ['bobo', 'devops'].sort()
  );

  const projectCard = buildProjectGroupConfirmationInput({
    conversation: {
      id: 'clowder_cat:riverpm',
      channelId: 'clowder_cat:riverpm',
      channelType: 1,
      type: 'robot',
      source: 'clowder',
      directCatId: 'riverpm',
      name: 'RiverWatch PM'
    },
    agent: coordinator,
    sourceMessage: { id: 'prompt-riverwatch-claude', content: prompt },
    text: prompt,
    currentUser: { id: 'u-owner' },
    availableAgents
  });

  assert.deepEqual(projectCard.targetCatIds.sort(), ['bobo', 'devops'].sort());
  assert.ok(!projectCard.targetCatIds.includes('runtime-cat-source'));
  assert.ok(!projectCard.targetCatIds.includes('runtime-cat-deck'));

  const explicitlyMentionedOldRuntimeCats = buildProjectGroupConfirmationInput({
    conversation: {
      id: 'clowder_cat:riverpm',
      channelId: 'clowder_cat:riverpm',
      channelType: 1,
      type: 'robot',
      source: 'clowder',
      directCatId: 'riverpm',
      name: 'RiverWatch PM'
    },
    agent: coordinator,
    sourceMessage: {
      id: 'prompt-riverwatch-mentions',
      content: '@runtime-cat-source @runtime-cat-deck @bobo @devops RiverWatch 项目需要 PPT、PRD、Vue 前端页面、README 和 preview 部署链接'
    },
    text: '@runtime-cat-source @runtime-cat-deck @bobo @devops RiverWatch 项目需要 PPT、PRD、Vue 前端页面、README 和 preview 部署链接',
    currentUser: { id: 'u-owner' },
    availableAgents
  });

  assert.deepEqual(explicitlyMentionedOldRuntimeCats.targetCatIds.sort(), ['bobo', 'devops'].sort());
  assert.ok(!explicitlyMentionedOldRuntimeCats.catMemberIds.includes('runtime-cat-source'));
  assert.ok(!explicitlyMentionedOldRuntimeCats.catMemberIds.includes('runtime-cat-deck'));
});

test('coordinator template cats request input lists missing role templates and reusable cats', async () => {
  const {
    buildCoordinatorTemplateCatsRequestInput,
    shouldCreateCoordinatorTemplateCatsRequest,
    resolveCoordinatorCreationProfile,
    buildAgentPayloadFromTemplate,
    deriveTemplateCatPayloadOverrides,
    createCoordinatorTemplateCatsMessage,
    upsertCoordinatorTemplateCatsMessage,
    updateCoordinatorTemplateCatsMessage,
    isCoordinatorTemplateCatsConfirmationMessage
  } = await import('../services/native-im/coordinator-template-cats.js');

  const coordinatorConversation = {
    id: 'clowder_cat:coordinator',
    channelId: 'clowder_cat:coordinator',
    channelType: 1,
    type: 'robot',
    source: 'clowder',
    directCatId: 'coordinator',
    name: 'PM 智能体'
  };
  const coordinatorAgent = {
    id: 'coordinator',
    name: 'PM 智能体',
    roleTemplate: 'coordinator',
    alias: '@pm',
    platform: 'codex',
    accessMode: 'oauth',
    accountRef: 'codex',
    defaultModel: 'gpt-5'
  };

  assert.equal(shouldCreateCoordinatorTemplateCatsRequest({
    conversation: coordinatorConversation,
    agent: coordinatorAgent,
    text: '帮我做一份 PPT 演示成稿'
  }), true);
  assert.equal(shouldCreateCoordinatorTemplateCatsRequest({
    conversation: { id: 'g1', type: 'group', channelType: 2, name: '项目群' },
    agent: coordinatorAgent,
    text: '帮我做一份 PPT 演示'
  }), false);
  assert.equal(shouldCreateCoordinatorTemplateCatsRequest({
    conversation: { id: 'clowder_cat:codex', type: 'robot', source: 'clowder', directCatId: 'codex' },
    agent: { id: 'codex', name: 'Codex', roleTemplate: 'engineer' },
    text: '帮我做一份 PPT 演示'
  }), false);
  assert.equal(shouldCreateCoordinatorTemplateCatsRequest({
    conversation: {
      id: 'clowder_cat:riverpm-live',
      channelId: 'clowder_cat:riverpm-live',
      channelType: 1,
      type: 'robot',
      source: 'clowder',
      directCatId: 'riverpm-live',
      name: 'RiverWatch PM 23243055'
    },
    agent: {
      id: 'riverpm-live',
      name: 'RiverWatch PM 23243055',
      alias: '@riverpm-live',
      roleTemplate: 'general',
      templateId: 'general',
      source: 'clowder',
      raw: { source: 'existing' }
    },
    text: 'RiverWatch 项目需要 PPT、PRD、Vue 前端页面、README 和 preview 部署链接'
  }), true);

  const templates = [
    { id: 'source-curator', name: '资料官', teamStrengths: '资料整理、信息抽取' },
    { id: 'deck-strategist', name: 'PPT 战略', alias: '@deck-strategist', aliases: ['@deck-strategist', '@strategy'], teamStrengths: '叙事结构与重点' },
    { id: 'storyboard-designer', name: '分镜设计师', teamStrengths: '页面分镜' },
    { id: 'svg-executor-guardian', name: 'SVG 执行', teamStrengths: '图形渲染' },
    { id: 'deck-qa-exporter', name: '导出官', teamStrengths: '校验与导出' }
  ];
  const availableAgents = [
    { id: 'cat-1', name: '资料官', roleTemplate: 'source-curator' }
  ];

  const cardInput = buildCoordinatorTemplateCatsRequestInput({
    conversation: coordinatorConversation,
    coordinator: coordinatorAgent,
    sourceMessage: { id: 'msg-039', content: '帮我做一份 PPT 演示成稿' },
    text: '帮我做一份 PPT 演示成稿',
    availableAgents,
    templates
  });

  assert.equal(cardInput.requiredProfile.id, 'ppt-delivery');
  assert.deepEqual(cardInput.reusableCats.map((cat) => cat.id), ['cat-1']);
  assert.equal(cardInput.items.find((item) => item.roleTemplateId === 'deck-strategist')?.alias, '@deck-strategist');
  assert.deepEqual(
    cardInput.items.map((item) => item.roleTemplateId).sort(),
    ['deck-qa-exporter', 'deck-strategist', 'storyboard-designer', 'svg-executor-guardian'].sort()
  );
  assert.equal(cardInput.coordinatorProfile.platform, 'codex');
  assert.equal(cardInput.coordinatorProfile.accessMode, 'oauth');
  assert.equal(cardInput.coordinatorProfile.inheritsFromCoordinator, true);

  const message = createCoordinatorTemplateCatsMessage(cardInput);
  assert.ok(isCoordinatorTemplateCatsConfirmationMessage(message));
  assert.equal(message.coordinatorTemplateCatsCard.status, 'pending_confirmation');
  assert.equal(message.coordinatorTemplateCatsCard.items.length, 4);

  const list = upsertCoordinatorTemplateCatsMessage([], cardInput);
  assert.equal(list.length, 1);
  const cardId = list[0].coordinatorTemplateCatsCard.cardId;

  const updated = updateCoordinatorTemplateCatsMessage(list, cardId, {
    status: 'created',
    items: list[0].coordinatorTemplateCatsCard.items.map((item) => ({
      ...item,
      status: 'created',
      agentId: `cat-${item.roleTemplateId}`
    }))
  });
  assert.equal(updated[0].coordinatorTemplateCatsCard.status, 'created');
  assert.ok(updated[0].coordinatorTemplateCatsCard.items.every((item) => item.status === 'created'));
  assert.match(updated[0].content, /已创建 4\/4/);

  const profile = resolveCoordinatorCreationProfile({
    id: 'coordinator',
    platform: 'claude',
    accessMode: 'api-key',
    accountRef: 'anthropic-prod',
    defaultModel: 'claude-sonnet-4-6'
  });
  assert.equal(profile.platform, 'claude');
  assert.equal(profile.clientId, 'anthropic');
  assert.equal(profile.accessMode, 'api-key');
  assert.equal(profile.authType, 'api_key');
  assert.equal(profile.accountRef, 'anthropic-prod');
  assert.equal(profile.defaultModel, 'claude-sonnet-4-6');
  assert.equal(profile.inheritsFromCoordinator, true);

  const oauthProfile = resolveCoordinatorCreationProfile({
    id: 'coordinator',
    platform: 'codex',
    accessMode: 'oauth'
  });
  assert.equal(oauthProfile.accessMode, 'oauth');
  assert.equal(oauthProfile.authType, 'oauth');
  assert.equal(oauthProfile.accountRef, 'codex');

  const payload = buildAgentPayloadFromTemplate(templates[1], profile);
  assert.equal(payload.platform, 'claude');
  assert.equal(payload.clientId, 'anthropic');
  assert.equal(payload.accessMode, 'api-key');
  assert.equal(payload.accountRef, 'anthropic-prod');
  assert.equal(payload.defaultModel, 'claude-sonnet-4-6');
  assert.equal(payload.roleTemplateId, 'deck-strategist');
  assert.equal(payload.name, 'PPT 战略');
  assert.ok(!Object.prototype.hasOwnProperty.call(payload, 'apiKey'));

  const oauthPayload = buildAgentPayloadFromTemplate(templates[1], oauthProfile);
  assert.equal(oauthPayload.accessMode, 'oauth');
  assert.equal(oauthPayload.authType, 'oauth');
  assert.equal(oauthPayload.alias, '@deck-strategist');
  assert.equal(oauthPayload.inheritCoordinatorAuth, true);
  assert.ok(!Object.prototype.hasOwnProperty.call(oauthPayload, 'defaultModel'));

  const riverWatchPayload = buildAgentPayloadFromTemplate(templates[1], oauthProfile, {
    agentIdPrefix: 'riverwatch',
    agentIdSuffix: '934553'
  });
  assert.equal(riverWatchPayload.catId, 'riverwatch-deck-strategist-934553');

  const riverWatchOverrides = deriveTemplateCatPayloadOverrides({
    sourceText: 'RiverWatch 项目需要 PPT、PRD 和 preview 部署链接',
    coordinator: { id: 'riverpm934553' }
  });
  assert.deepEqual(riverWatchOverrides, {
    agentIdPrefix: 'riverwatch',
    agentIdSuffix: '934553'
  });
  assert.deepEqual(deriveTemplateCatPayloadOverrides({ sourceText: '普通 PPT 项目', coordinator: { id: 'coordinator' } }), {});
});

test('coordinator template cats card cancel and partial-failure transitions', async () => {
  const {
    buildCoordinatorTemplateCatsRequestInput,
    upsertCoordinatorTemplateCatsMessage,
    updateCoordinatorTemplateCatsMessage
  } = await import('../services/native-im/coordinator-template-cats.js');

  const conversation = {
    id: 'clowder_cat:coordinator',
    channelId: 'clowder_cat:coordinator',
    channelType: 1,
    type: 'robot',
    source: 'clowder',
    directCatId: 'coordinator'
  };
  const coordinator = { id: 'coordinator', name: 'PM', roleTemplate: 'coordinator', platform: 'codex', accessMode: 'oauth' };
  const templates = [
    { id: 'deck-strategist', name: 'PPT 战略' },
    { id: 'storyboard-designer', name: '分镜设计师' },
    { id: 'svg-executor-guardian', name: 'SVG 执行' },
    { id: 'deck-qa-exporter', name: '导出官' },
    { id: 'source-curator', name: '资料官' }
  ];
  const cardInput = buildCoordinatorTemplateCatsRequestInput({
    conversation,
    coordinator,
    sourceMessage: { id: 'msg-x', content: '帮我做 PPT 演示成稿' },
    text: '帮我做 PPT 演示成稿',
    availableAgents: [],
    templates
  });
  const list = upsertCoordinatorTemplateCatsMessage([], cardInput);
  const cardId = list[0].coordinatorTemplateCatsCard.cardId;

  const cancelled = updateCoordinatorTemplateCatsMessage(list, cardId, { status: 'cancelled' });
  assert.equal(cancelled[0].coordinatorTemplateCatsCard.status, 'cancelled');
  assert.match(cancelled[0].content, /已取消/);

  const partial = updateCoordinatorTemplateCatsMessage(list, cardId, {
    status: 'partial',
    items: list[0].coordinatorTemplateCatsCard.items.map((item, idx) => idx === 0
      ? { ...item, status: 'created', agentId: 'cat-new-1' }
      : { ...item, status: 'failed', error: '凭证失败' })
  });
  assert.equal(partial[0].coordinatorTemplateCatsCard.status, 'partial');
  assert.match(partial[0].content, /部分创建：1\/5/);
});
