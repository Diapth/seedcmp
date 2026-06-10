import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:5173/';
const API = 'http://localhost:8090/v1';
const PASSWORD = '12345678';

const results = [];
const browserLogs = [];

function record(name, pass, detail = '') {
  const item = { name, pass, detail };
  results.push(item);
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function apiPost(pathname, body, token = '') {
  const res = await fetch(`${API}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { token } : {})
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok || data.status >= 400) {
    throw new Error(`${pathname} failed ${res.status}: ${text}`);
  }
  return data;
}

function phoneFor(label) {
  const digits = String(Date.now()).slice(-8);
  const suffix = label === 'mobile' ? '8' : '7';
  return `19${suffix}${digits}`;
}

async function registerSession(label) {
  const phone = phoneFor(label);
  await apiPost('/user/sms/registercode', { zone: '0086', phone });
  const session = await apiPost('/user/register', {
    zone: '0086',
    phone,
    name: `Issue041 ${label}`,
    code: '123456',
    password: PASSWORD,
    flag: 1,
    device: {
      device_id: `issue041-${label}-${Date.now()}`,
      device_name: 'Playwright',
      device_model: label
    }
  });
  const uid = String(session.uid || session.id || session.user_id || '');
  if (!uid || !session.token) {
    throw new Error(`register did not return uid/token: ${JSON.stringify(session).slice(0, 300)}`);
  }
  return {
    token: session.token,
    user: {
      id: uid,
      uid,
      name: session.name || `Issue041 ${label}`,
      nickname: session.name || `Issue041 ${label}`,
      phone,
      raw: session
    }
  };
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

async function createPmInBrowser(page, label) {
  return page.evaluate(async ({ label }) => {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia
      || app?._context?.config?.globalProperties?.$pinia;
    if (!pinia?._s) throw new Error('pinia not available');
    const agentStore = pinia._s.get('agent');
    const convStore = pinia._s.get('conversation');
    if (!agentStore || !convStore) throw new Error('agent/conversation store not available');

    const suffix = `${label}${Date.now().toString(36).slice(-5)}`.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const payload = {
      name: `PM 自动绑定 ${label}`,
      alias: `@pm${suffix}`,
      desc: '负责需求澄清、任务拆解和多智能体协调。',
      avatar: '',
      platform: 'codex',
      accessMode: 'oauth',
      model: '',
      accountRef: 'codex',
      apiKey: '',
      apiUrl: '',
      customModel: '',
      systemPrompt: '你是显性 PM / 主 Agent，负责需求理解、任务拆解、多 Agent 调度和交付聚合。',
      roleTemplate: 'coordinator',
      templateId: 'coordinator',
      capabilityTags: ['需求澄清', '任务拆解', '交付闭环']
    };
    const createdId = await agentStore.createAgent(payload);
    const createdAgent = agentStore.agents.find((agent) => agent.id === createdId);
    if (!createdAgent) throw new Error(`created agent not found: ${createdId}`);
    const conversation = convStore.upsertAgentConversation(createdAgent);
    if (conversation?.id) {
      convStore.setActiveId(conversation.id);
      uni.setStorageSync('active_conversation_id', conversation.id);
    }
    return {
      createdId,
      agentThreadId: createdAgent.threadId || createdAgent.directThreadId || '',
      conversationId: conversation?.id || '',
      conversationThreadId: conversation?.threadId || conversation?.directThreadId || '',
      directCatId: createdAgent.directCatId || createdAgent.catId || '',
      name: createdAgent.name,
      alias: createdAgent.alias
    };
  }, { label });
}

async function verifyViewport(browser, label, viewport) {
  const session = await registerSession(label);
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('app_token', token);
    localStorage.setItem('app_user', JSON.stringify(user));
    localStorage.setItem('app_user_uid', user.uid || user.id);
    localStorage.setItem('app_theme', 'light');
  }, session);
  const page = await context.newPage();
  attachLoggers(page, label);

  await page.goto(`${BASE}#/pages/agents/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(DIR, `${label}-01-new-agent.png`), fullPage: false });

  const created = await createPmInBrowser(page, label);
  record(`${label}: created agent has threadId`, Boolean(created.agentThreadId), JSON.stringify(created));
  record(`${label}: conversation has threadId`, Boolean(created.conversationThreadId), JSON.stringify(created));

  await page.goto(`${BASE}#/pages/chat/detail?id=${encodeURIComponent(created.conversationId)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(DIR, `${label}-02-chat-open.png`), fullPage: false });

  await page.evaluate(async ({ conversationId, label }) => {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia
      || app?._context?.config?.globalProperties?.$pinia;
    const messageStore = pinia?._s?.get('message');
    const appStore = pinia?._s?.get('app');
    if (!messageStore) throw new Error('message store not available');
    const user = appStore?.currentUser || {};
    await messageStore.sendNativeMessage(conversationId, {
      type: 'text',
      content: `issue041 ping ${label}`
    }, {
      id: user.uid || user.id || 'me',
      name: user.name || user.nickname || '我',
      avatar: user.avatar || ''
    });
  }, { conversationId: created.conversationId, label });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(DIR, `${label}-03-after-send.png`), fullPage: false });

  const chatState = await page.evaluate((conversationId) => {
    const text = document.body.innerText || '';
    const noBindCount = (text.match(/当前没有绑定 thread/g) || []).length;
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia
      || app?._context?.config?.globalProperties?.$pinia;
    const convStore = pinia?._s?.get('conversation');
    const messageStore = pinia?._s?.get('message');
    const conversation = convStore?.conversations?.find((item) => item.id === conversationId);
    const messages = messageStore?.messages?.[conversationId] || [];
    return {
      noBindCount,
      conversationThreadId: conversation?.threadId || conversation?.directThreadId || '',
      messageCount: messages.length,
      bodyTextSample: text.slice(0, 500)
    };
  }, created.conversationId);

  record(`${label}: no unbound-thread warning after send`, chatState.noBindCount === 0, JSON.stringify(chatState));
  record(`${label}: sent message rendered`, chatState.messageCount > 0, JSON.stringify(chatState));

  await context.close();
  return { label, session: { uid: session.user.uid }, created, chatState };
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
const summary = {
  issue: 'ISSUE-041',
  generatedAt: new Date().toISOString(),
  pass: results.every((item) => item.pass),
  results,
  details
};
fs.writeFileSync(path.join(DIR, 'result.json'), JSON.stringify(summary, null, 2));

if (!summary.pass) {
  process.exit(1);
}
