import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:5173/';
const API = 'http://localhost:8090/v1';
const PASSWORD = '12345678';
const CHANNEL_ID = 'clowder_cat:luoluo';
const DISPLAY_NAME = '暹罗猫（协调者）';

const results = [];
const browserLogs = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
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
  const suffix = label === 'mobile' ? '6' : '5';
  return `19${suffix}${digits}`;
}

async function registerSession(label) {
  const phone = phoneFor(label);
  await apiPost('/user/sms/registercode', { zone: '0086', phone });
  const session = await apiPost('/user/register', {
    zone: '0086',
    phone,
    name: `Issue042 ${label}`,
    code: '123456',
    password: PASSWORD,
    flag: 1,
    device: {
      device_id: `issue042-${label}-${Date.now()}`,
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
      name: session.name || `Issue042 ${label}`,
      nickname: session.name || `Issue042 ${label}`,
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

async function waitForStores(page) {
  await page.waitForFunction(() => {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia
      || app?._context?.config?.globalProperties?.$pinia;
    return Boolean(pinia?._s?.get('conversation') && pinia?._s?.get('agent'));
  }, { timeout: 10000 });
}

async function seedRegressionState(page) {
  return page.evaluate(({ channelId, displayName }) => {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia
      || app?._context?.config?.globalProperties?.$pinia;
    const convStore = pinia?._s?.get('conversation');
    const agentStore = pinia?._s?.get('agent');
    const messageStore = pinia?._s?.get('message');
    if (!convStore || !agentStore || !messageStore) throw new Error('required stores not available');

    const agent = {
      id: 'coordinator',
      catId: 'coordinator',
      directCatId: 'coordinator',
      name: displayName,
      nickname: '罗罗',
      alias: '@luoluo',
      aliases: ['@luoluo'],
      mentionPatterns: ['@luoluo', '罗罗'],
      avatar: '/avatars/keeper.png',
      desc: '需求澄清、任务拆分、并行调度、结果合成、交付闭环',
      source: 'clowder',
      status: 'active',
      isAgent: true
    };

    agentStore.agents = [
      agent,
      ...(agentStore.agents || []).filter((item) => item.id !== agent.id && item.catId !== agent.catId)
    ];
    convStore.applyNativeConversations([{
      id: channelId,
      channelId,
      channelType: 1,
      type: 'single',
      name: channelId,
      avatar: '',
      lastMessage: '我',
      lastTime: Date.now()
    }]);
    convStore.applyAgentDirectory(agentStore.agents);
    convStore.setActiveId(channelId);
    uni.setStorageSync('active_conversation_id', channelId);
    messageStore.messages[channelId] = [{
      id: `issue042-${Date.now()}`,
      senderId: 'me',
      senderName: '我',
      content: 'issue042 name regression smoke',
      type: 'text',
      time: Date.now(),
      status: 'success'
    }];

    const conversation = convStore.conversations.find((item) => item.id === channelId || item.channelId === channelId);
    return {
      id: conversation?.id || '',
      name: conversation?.name || '',
      type: conversation?.type || '',
      directCatId: conversation?.directCatId || ''
    };
  }, { channelId: CHANNEL_ID, displayName: DISPLAY_NAME });
}

async function readVisibleState(page) {
  return page.evaluate(({ channelId, displayName }) => {
    const bodyText = document.body.innerText || '';
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia
      || app?._context?.config?.globalProperties?.$pinia;
    const convStore = pinia?._s?.get('conversation');
    const conversation = convStore?.conversations?.find((item) => item.id === channelId || item.channelId === channelId);
    return {
      conversationName: conversation?.name || '',
      directCatId: conversation?.directCatId || '',
      hasDisplayName: bodyText.includes(displayName),
      hasTechnicalName: bodyText.includes(channelId),
      bodyTextSample: bodyText.slice(0, 600)
    };
  }, { channelId: CHANNEL_ID, displayName: DISPLAY_NAME });
}

async function verifyViewport(browser, label, viewport, pathName) {
  const session = await registerSession(label);
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ token, user, channelId }) => {
    localStorage.setItem('app_token', token);
    localStorage.setItem('app_user', JSON.stringify(user));
    localStorage.setItem('app_user_uid', user.uid || user.id);
    localStorage.setItem('active_conversation_id', channelId);
    localStorage.setItem('app_theme', 'light');
  }, { ...session, channelId: CHANNEL_ID });
  const page = await context.newPage();
  attachLoggers(page, label);
  await page.route('**/v1/coversation/clearUnread', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true })
    });
  });

  await page.goto(`${BASE}#${pathName}`, { waitUntil: 'networkidle' });
  await waitForStores(page);
  const seeded = await seedRegressionState(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(DIR, `${label}-01-after-directory.png`), fullPage: false });

  const visible = await readVisibleState(page);
  record(`${label}: store name is display name`, seeded.name === DISPLAY_NAME, JSON.stringify(seeded));
  record(`${label}: visible display name`, visible.hasDisplayName, JSON.stringify(visible));
  record(`${label}: no visible technical channel id`, !visible.hasTechnicalName, JSON.stringify(visible));
  record(`${label}: routing id preserved`, visible.directCatId === 'luoluo', JSON.stringify(visible));

  await context.close();
  return { label, session: { uid: session.user.uid }, seeded, visible };
}

fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
let details = [];
try {
  details = [
    await verifyViewport(browser, 'desktop', { width: 1440, height: 900 }, '/pages/chat/index'),
    await verifyViewport(browser, 'mobile', { width: 390, height: 844 }, `/pages/chat/detail?id=${encodeURIComponent(CHANNEL_ID)}`)
  ];
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(DIR, 'browser-console.json'), JSON.stringify(browserLogs, null, 2));
const summary = {
  issue: 'ISSUE-042',
  generatedAt: new Date().toISOString(),
  pass: results.every((item) => item.pass),
  results,
  details
};
fs.writeFileSync(path.join(DIR, 'result.json'), JSON.stringify(summary, null, 2));

if (!summary.pass) {
  process.exit(1);
}
