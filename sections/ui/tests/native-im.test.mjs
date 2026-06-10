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
  conversationDeleteKey,
  conversationDisplayUnread,
  filterDeletedConversations,
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
  normalizeClowderProjectBoard
} from '../services/native-im/project-board.js';
import {
  cleanupAgentFromLocalState,
  filterDeletedAgents,
  markAgentDeleted,
  resolveAgentDeleteIdentity
} from '../services/native-im/agent-cleanup.js';
import {
  buildSelectableGroupMembers,
  splitSelectedGroupMembers
} from '../services/native-im/group-member-candidates.js';
import {
  normalizeSkillCatalogPreview,
  normalizeUserSkillList
} from '../services/native-im/skill-state.js';
import {
  buildDeploymentCardMessage,
  isDeploymentCardMessage,
  shouldCreateDeploymentCard,
  updateDeploymentCardMessage,
  upsertDeploymentCardMessage
} from '../services/native-im/deployment.js';

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
    accessMode: 'backend',
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

test('deployment helper detects deployment intent only in clowder direct chats', () => {
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

  assert.equal(shouldCreateDeploymentCard({ conversation: clowderDirect, text: '帮我把这个项目部署到 preview 环境' }), true);
  assert.equal(shouldCreateDeploymentCard({ conversation: clowderDirect, text: '先不部署，继续改文案' }), false);
  assert.equal(shouldCreateDeploymentCard({ conversation: normalDirect, text: '帮我部署到线上' }), false);
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
  const coordination = await service.createCoordination({
    threadId: 'thread-project-1',
    goal: '验收项目群看板'
  });

  assert.equal(request.calls[0].method, 'GET');
  assert.equal(request.calls[0].url, '/v1/clowder/project-groups/active?projectGroupNo=g-project');
  assert.equal(request.calls[1].method, 'GET');
  assert.equal(request.calls[1].url, '/v1/clowder/thread/thread-project-1/tasks');
  assert.equal(request.calls[2].method, 'POST');
  assert.equal(request.calls[2].url, '/v1/clowder/coordinator/coordination');
  assert.equal(binding.id, 'binding-1');
  assert.equal(tasks[0].id, 'task-1');
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

test('project group confirmation trigger is limited to coordinator direct chats', async () => {
  const {
    buildProjectGroupConfirmationInput,
    shouldCreateProjectGroupConfirmation
  } = await import('../services/native-im/project-group.js');
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
  assert.deepEqual(cardInput.userMemberIds, ['u-owner']);
  assert.deepEqual(cardInput.targetCatIds, ['codex', 'claude']);
});

test('project group confirmation builds ensure payload and created patch', async () => {
  const {
    buildProjectGroupEnsurePayload,
    projectGroupCreatedPatch,
    projectGroupFailedPatch
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
        artifacts: [{ id: 'doc-1', name: '项目群验收.md', type: 'md', summary: '成员与消息同步' }],
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
  assert.equal(board.tasks[1].status, 'done');
  assert.equal(board.tasks[1].documents[0].name, '看板截图.png');
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
  assert.equal(agent.source, 'clowder');
  assert.equal(agent.connected, true);
  assert.equal(agent.apiKey, '');
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
  assert.equal(
    shouldPreserveClowderAgentDisplayName(clowderConversation, {
      id: 'clowder_cat:opus',
      channelId: 'clowder_cat:opus',
      name: 'clowder_cat:opus',
      type: 'single'
    }),
    true
  );

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
