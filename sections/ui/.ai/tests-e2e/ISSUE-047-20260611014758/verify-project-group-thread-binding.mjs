import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.H5_BASE_URL || 'http://localhost:5173/';
const PM_CHANNEL_ID = 'clowder_cat:coordinator';
const INHERITED_THREAD_ID = 'thread-pm-project-issue047';
const PROJECT_GROUP_ID = 'issue047-project-group';
const PROJECT_BINDING_ID = 'binding-issue047';

const results = [];
const browserLogs = [];
const apiCalls = [];

function record(name, pass, detail = '') {
  const item = { name, pass, detail };
  results.push(item);
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

function attachLoggers(page, label) {
  page.on('console', (msg) => {
    browserLogs.push({ label, type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (error) => {
    browserLogs.push({ label, type: 'pageerror', text: error.message });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      browserLogs.push({ label, type: 'http-error', status: response.status(), url: response.url() });
    }
  });
}

async function jsonBody(request) {
  try {
    return request.postDataJSON();
  } catch {
    const raw = request.postData() || '';
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return { raw };
    }
  }
}

async function installApiRoutes(page, label) {
  await page.route('**/v1/conversation/sync', async (route) => {
    apiCalls.push({ label, path: '/v1/conversation/sync', body: await jsonBody(route.request()) });
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [{
          channel_id: PM_CHANNEL_ID,
          channel_type: 1,
          name: '暹罗猫（协调者）',
          category: 'robot',
          avatar: '',
          threadId: INHERITED_THREAD_ID,
          binding: { threadId: INHERITED_THREAD_ID },
          last_msg: { type: 1, content: '请创建项目群' },
          last_msg_timestamp: Date.now()
        }]
      })
    });
  });
  await page.route('**/v1/message/channel/sync', async (route) => {
    apiCalls.push({ label, path: '/v1/message/channel/sync', body: await jsonBody(route.request()) });
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] })
    });
  });
  await page.route('**/v1/clowder/thread/**/manual-context-pins**', async (route) => {
    apiCalls.push({ label, path: '/v1/clowder/thread/manual-context-pins', method: route.request().method() });
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pins: [] })
    });
  });
  await page.route('**/v1/clowder/cats**', async (route) => {
    apiCalls.push({ label, path: '/v1/clowder/cats', method: route.request().method() });
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        agents: [
          {
            id: 'coordinator',
            catId: 'coordinator',
            displayName: '暹罗猫（协调者）',
            roleTemplateId: 'coordinator',
            source: 'role-template',
            available: true
          },
          {
            id: 'codex',
            catId: 'codex',
            displayName: '狸花猫（工程师）',
            roleTemplateId: 'engineer',
            source: 'role-template',
            available: true
          },
          {
            id: 'reviewer',
            catId: 'reviewer',
            displayName: '布偶猫（评审）',
            roleTemplateId: 'reviewer',
            source: 'role-template',
            available: true
          }
        ],
        templates: []
      })
    });
  });
  await page.route('**/v1/clowder/project-groups/ensure', async (route) => {
    const body = await jsonBody(route.request());
    apiCalls.push({ label, path: '/v1/clowder/project-groups/ensure', body });
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reused: false,
        binding: {
          id: PROJECT_BINDING_ID,
          projectGroupNo: PROJECT_GROUP_ID,
          projectName: body.projectName || 'Issue047项目群',
          pmDirectChannelId: body.pmDirectChannelId,
          pmDirectThreadId: body.pmDirectThreadId,
          projectThreadId: body.projectThreadId || body.pmDirectThreadId,
          catMemberIds: body.catMemberIds || []
        }
      })
    });
  });
  await page.route('**/v1/clowder/group/cats/sync', async (route) => {
    const body = await jsonBody(route.request());
    apiCalls.push({ label, path: '/v1/clowder/group/cats/sync', body });
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        groupId: body.groupId,
        catIds: body.catIds || [],
        cats: body.cats || [],
        projectThreadId: body.projectThreadId,
        projectBindingId: body.projectBindingId
      })
    });
  });
  await page.route('**/v1/clowder/conversation/message', async (route) => {
    const body = await jsonBody(route.request());
    apiCalls.push({ label, path: '/v1/clowder/conversation/message', body });
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: {
          id: `${label}-clowder-project-message`,
          message_id: `${label}-clowder-project-message`,
          channel_id: body.channelId,
          channel_type: body.channelType,
          from_uid: 'user-issue047',
          payload: { type: 1, content: body.text },
          timestamp: Date.now()
        }
      })
    });
  });
  await page.route('**/v1/groups/**/membersync**', async (route) => {
    apiCalls.push({ label, path: '/v1/groups/membersync', method: route.request().method() });
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        members: [
          { uid: 'user-issue047', name: 'Issue047 用户', role: 'owner' },
          { uid: 'clowder_cat:coordinator', name: '暹罗猫（协调者）', role: 'member' },
          { uid: 'clowder_cat:codex', name: '狸花猫（工程师）', role: 'member' }
        ]
      })
    });
  });
  await page.route('**/v1/group/my', async (route) => {
    apiCalls.push({ label, path: '/v1/group/my', method: route.request().method() });
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ groups: [] })
    });
  });
  await page.route(/\/v1\/clowder\/group\/cats(?:\?.*)?$/, async (route) => {
    apiCalls.push({ label, path: '/v1/clowder/group/cats', method: route.request().method() });
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        catIds: ['coordinator', 'codex'],
        cats: [
          { catId: 'coordinator', displayName: '暹罗猫（协调者）' },
          { catId: 'codex', displayName: '狸花猫（工程师）' }
        ]
      })
    });
  });
  await page.route('**/v1/coversation/clearUnread', async (route) => {
    apiCalls.push({ label, path: '/v1/coversation/clearUnread', body: await jsonBody(route.request()) });
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true })
    });
  });
  await page.route('**/v1/friend/apply**', async (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ applies: [] }) });
  });
  await page.route('**/v1/friend/sync**', async (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ friends: [] }) });
  });
  await page.route('**/v1/user/friend**', async (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ friends: [] }) });
  });
}

async function waitForStores(page) {
  await page.waitForFunction(() => {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia
      || app?._context?.config?.globalProperties?.$pinia;
    return Boolean(pinia?._s?.get('conversation') && pinia?._s?.get('message') && pinia?._s?.get('agent'));
  }, { timeout: 10000 });
}

async function seedPmConversationAndAgents(page, label) {
  return page.evaluate(({ pmChannelId, inheritedThreadId, label }) => {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia
      || app?._context?.config?.globalProperties?.$pinia;
    const convStore = pinia?._s?.get('conversation');
    const agentStore = pinia?._s?.get('agent');
    const messageStore = pinia?._s?.get('message');
    if (!convStore || !agentStore || !messageStore) throw new Error('required stores not available');

    const agents = [
      {
        id: 'coordinator',
        catId: 'coordinator',
        directCatId: 'coordinator',
        name: '暹罗猫（协调者）',
        displayName: '暹罗猫（协调者）',
        roleTemplateId: 'coordinator',
        source: 'clowder',
        available: true,
        isAgent: true,
        threadId: inheritedThreadId,
        directThreadId: inheritedThreadId
      },
      {
        id: 'codex',
        catId: 'codex',
        directCatId: 'codex',
        name: '狸花猫（工程师）',
        displayName: '狸花猫（工程师）',
        roleTemplateId: 'engineer',
        source: 'clowder',
        available: true,
        isAgent: true
      },
      {
        id: 'reviewer',
        catId: 'reviewer',
        directCatId: 'reviewer',
        name: '布偶猫（评审）',
        displayName: '布偶猫（评审）',
        roleTemplateId: 'reviewer',
        source: 'clowder',
        available: true,
        isAgent: true
      }
    ];
    agentStore.agents = [
      ...agents,
      ...(agentStore.agents || []).filter((agent) => !agents.some((item) => item.id === agent.id || item.catId === agent.catId))
    ];

    const conversation = {
      id: pmChannelId,
      channelId: pmChannelId,
      channelType: 1,
      type: 'robot',
      source: 'clowder',
      isAgent: true,
      directCatId: 'coordinator',
      name: '暹罗猫（协调者）',
      threadId: inheritedThreadId,
      directThreadId: inheritedThreadId,
      binding: { threadId: inheritedThreadId },
      unread: 0,
      isPinned: false,
      isMuted: false,
      draft: ''
    };
    convStore.deletedRecords = {};
    convStore.conversations = (convStore.conversations || []).filter((item) => item.source !== 'mock');
    const agentConversation = convStore.upsertAgentConversation(agents[0]);
    if (agentConversation) {
      Object.assign(agentConversation, conversation);
    } else {
      convStore.applyNativeConversations([conversation], { replaceMock: true });
    }
    convStore.setActiveId(pmChannelId);
    uni.setStorageSync('active_conversation_id', pmChannelId);
    messageStore.messages[pmChannelId] = [];
    const storedConversation = convStore.conversations.find((item) => item.id === pmChannelId);
    return {
      label,
      activeId: convStore.activeId,
      conversation: storedConversation ? {
        id: storedConversation.id,
        channelId: storedConversation.channelId,
        channelType: storedConversation.channelType,
        type: storedConversation.type,
        source: storedConversation.source,
        threadId: storedConversation.threadId || '',
        directThreadId: storedConversation.directThreadId || ''
      } : null,
      agentIds: agentStore.agents.map((agent) => agent.id || agent.catId)
    };
  }, { pmChannelId: PM_CHANNEL_ID, inheritedThreadId: INHERITED_THREAD_ID, label });
}

async function createAndConfirmProjectGroup(page, label) {
  return page.evaluate(async ({ pmChannelId, inheritedThreadId, projectGroupId }) => {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia
      || app?._context?.config?.globalProperties?.$pinia;
    const convStore = pinia?._s?.get('conversation');
    const agentStore = pinia?._s?.get('agent');
    const messageStore = pinia?._s?.get('message');
    const appStore = pinia?._s?.get('app');
    if (!convStore || !agentStore || !messageStore || !appStore) throw new Error('required stores not available');

    const conversation = convStore.conversations.find((item) => item.id === pmChannelId);
    const coordinator = agentStore.agents.find((agent) => (agent.id || agent.catId) === 'coordinator');
    const sourceMessage = {
      id: 'issue047-source-message',
      messageId: 'issue047-source-message',
      clientMsgNo: 'issue047-client',
      channelId: pmChannelId,
      channelType: 1,
      senderId: appStore.currentUser?.id || appStore.currentUser?.uid || 'user-issue047',
      senderName: appStore.currentUser?.nickname || 'Issue047 用户',
      type: 'text',
      content: '项目名叫 Issue047项目群，拉 Codex 和 Reviewer 分工执行',
      status: 'success',
      time: Date.now()
    };
    messageStore.messages[pmChannelId] = [sourceMessage];

    messageStore.createProjectGroupConfirmation(pmChannelId, {
      sourceMessage,
      sourceText: sourceMessage.content,
      projectName: 'Issue047项目群',
      pmDirectChannelId: conversation?.channelId || conversation?.id || pmChannelId,
      pmDirectChannelType: Number(conversation?.channelType || 1),
      pmDirectThreadId: conversation?.threadId || conversation?.directThreadId || inheritedThreadId,
      projectThreadId: conversation?.threadId || conversation?.directThreadId || inheritedThreadId,
      pmMemberId: 'clowder_cat:coordinator',
      userMemberIds: [appStore.currentUser?.id || appStore.currentUser?.uid || 'user-issue047'],
      catMemberIds: ['coordinator', 'codex', 'reviewer'],
      targetCatIds: ['codex', 'reviewer'],
      workerCatIds: ['codex', 'reviewer'],
      coordinator: {
        id: coordinator?.catId || coordinator?.id || 'coordinator',
        name: coordinator?.name || coordinator?.displayName || '暹罗猫（协调者）',
        avatar: coordinator?.avatar || ''
      }
    });
    const pending = (messageStore.messages[pmChannelId] || []).find((message) => message.type === 'project_group_confirmation');
    if (!pending) throw new Error('project group card not created');

    const confirmed = await messageStore.confirmProjectGroupFromCard(pmChannelId, pending.id, {
      currentUser: appStore.currentUser || {},
      agents: agentStore.agents
    });
    const card = confirmed?.projectGroupCard || {};
    const currentPmConversation = convStore.conversations.find((item) => item.id === pmChannelId);
    const groupConversation = convStore.conversations.find((item) => item.id === projectGroupId);
    return {
      pendingCard: pending.projectGroupCard,
      confirmedCard: card,
      groupConversation,
      activeId: convStore.activeId,
      groupMembers: convStore.groupMembers(projectGroupId),
      pmConversationThreadId: currentPmConversation?.threadId || currentPmConversation?.directThreadId || '',
      pmConversation: currentPmConversation ? {
        id: currentPmConversation.id,
        channelId: currentPmConversation.channelId,
        channelType: currentPmConversation.channelType,
        type: currentPmConversation.type,
        source: currentPmConversation.source,
        threadId: currentPmConversation.threadId || '',
        directThreadId: currentPmConversation.directThreadId || ''
      } : null,
      inheritedThreadId
    };
  }, { pmChannelId: PM_CHANNEL_ID, inheritedThreadId: INHERITED_THREAD_ID, projectGroupId: PROJECT_GROUP_ID });
}

async function verifyViewport(browser, label, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ pmChannelId }) => {
    localStorage.setItem('app_token', 'issue047-token');
    localStorage.setItem('app_user_uid', 'user-issue047');
    localStorage.setItem('app_user', JSON.stringify({
      id: 'user-issue047',
      uid: 'user-issue047',
      nickname: 'Issue047 用户',
      name: 'Issue047 用户'
    }));
    localStorage.setItem('app_theme', 'light');
    localStorage.setItem('active_conversation_id', pmChannelId);
  }, { pmChannelId: PM_CHANNEL_ID });

  const page = await context.newPage();
  attachLoggers(page, label);
  await installApiRoutes(page, label);

  await page.goto(`${BASE}#/pages/chat/detail?id=${encodeURIComponent(PM_CHANNEL_ID)}`, { waitUntil: 'networkidle' });
  await waitForStores(page);
  const seeded = await seedPmConversationAndAgents(page, label);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(DIR, `${label}-01-pm-thread.png`), fullPage: false });

  const result = await createAndConfirmProjectGroup(page, label);
  try {
    await page.waitForFunction(() => {
      const text = document.body.innerText || '';
      return text.includes('已创建') || text.includes('打开项目群');
    }, undefined, { timeout: 10000 });
  } catch (error) {
    const state = await page.evaluate(({ pmChannelId, projectGroupId }) => {
      const app = document.querySelector('#app')?.__vue_app__;
      const pinia = app?.config?.globalProperties?.$pinia
        || app?._context?.config?.globalProperties?.$pinia;
      const convStore = pinia?._s?.get('conversation');
      const messageStore = pinia?._s?.get('message');
      return {
        bodyText: (document.body.innerText || '').slice(0, 1500),
        activeId: convStore?.activeId || '',
        pmMessages: messageStore?.messages?.[pmChannelId] || [],
        groupConversation: convStore?.conversations?.find((item) => item.id === projectGroupId) || null
      };
    }, { pmChannelId: PM_CHANNEL_ID, projectGroupId: PROJECT_GROUP_ID });
    fs.writeFileSync(path.join(DIR, `${label}-failure-state.json`), JSON.stringify({
      error: error.message,
      state,
      calls: apiCalls.filter((call) => call.label === label)
    }, null, 2));
    await page.screenshot({ path: path.join(DIR, `${label}-failure.png`), fullPage: false });
    throw error;
  }
  await page.screenshot({ path: path.join(DIR, `${label}-02-project-group-created.png`), fullPage: false });

  const calls = apiCalls.filter((call) => call.label === label);
  const ensureCall = calls.find((call) => call.path === '/v1/clowder/project-groups/ensure');
  const syncCall = calls.find((call) => call.path === '/v1/clowder/group/cats/sync');
  const messageCall = calls.find((call) => call.path === '/v1/clowder/conversation/message');
  const clearUnreadCall = calls.find((call) => call.path === '/v1/coversation/clearUnread');

  record(`${label}: PM direct conversation keeps inherited thread`, result.pmConversationThreadId === INHERITED_THREAD_ID, JSON.stringify({ seeded, result }));
  record(`${label}: pending card carries PM and project thread`, result.pendingCard?.pmDirectThreadId === INHERITED_THREAD_ID && result.pendingCard?.projectThreadId === INHERITED_THREAD_ID, JSON.stringify(result.pendingCard));
  record(`${label}: ensure project group sends inherited thread`, ensureCall?.body?.pmDirectThreadId === INHERITED_THREAD_ID && ensureCall?.body?.projectThreadId === INHERITED_THREAD_ID, JSON.stringify(ensureCall?.body));
  record(`${label}: group cat sync inherits project binding`, syncCall?.body?.projectThreadId === INHERITED_THREAD_ID && syncCall?.body?.projectBindingId === PROJECT_BINDING_ID, JSON.stringify(syncCall?.body));
  record(`${label}: first group clowder message uses inherited thread`, messageCall?.body?.channelId === PROJECT_GROUP_ID && messageCall?.body?.channelType === 2 && messageCall?.body?.threadId === INHERITED_THREAD_ID, JSON.stringify(messageCall?.body));
  record(`${label}: created card points to same inherited thread`, result.confirmedCard?.projectGroupNo === PROJECT_GROUP_ID && result.confirmedCard?.projectThreadId === INHERITED_THREAD_ID, JSON.stringify(result.confirmedCard));
  record(`${label}: group conversation added without stealing active PM chat`, Boolean(result.groupConversation?.id) && result.activeId === PM_CHANNEL_ID, JSON.stringify({ activeId: result.activeId, groupConversation: result.groupConversation }));
  record(`${label}: unread clear uses PM direct channel`, clearUnreadCall?.body?.channel_id === PM_CHANNEL_ID && Number(clearUnreadCall?.body?.channel_type) === 1, JSON.stringify(clearUnreadCall?.body));

  await context.close();
  return { label, seeded, result, calls };
}

fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
let details = [];
try {
  details = [
    await verifyViewport(browser, 'desktop', { width: 1440, height: 900 }),
    await verifyViewport(browser, 'mobile', { width: 390, height: 844 })
  ];
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(DIR, 'browser-console.json'), JSON.stringify(browserLogs, null, 2));
fs.writeFileSync(path.join(DIR, 'api-calls.json'), JSON.stringify(apiCalls, null, 2));
const summary = {
  issue: 'ISSUE-047',
  generatedAt: new Date().toISOString(),
  baseUrl: BASE,
  pass: results.every((item) => item.pass),
  results,
  details
};
fs.writeFileSync(path.join(DIR, 'result.json'), JSON.stringify(summary, null, 2));

if (!summary.pass) {
  process.exit(1);
}
