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
const DUPLICATE_CONTENT = '## 快慢指针 PPT 课程汇报\n\n1. 需求拆解\n2. 分工派发';

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
  const suffix = label === 'mobile' ? '4' : '3';
  return `19${suffix}${digits}`;
}

async function registerSession(label) {
  const phone = phoneFor(label);
  await apiPost('/user/sms/registercode', { zone: '0086', phone });
  const session = await apiPost('/user/register', {
    zone: '0086',
    phone,
    name: `Issue043 ${label}`,
    code: '123456',
    password: PASSWORD,
    flag: 1,
    device: {
      device_id: `issue043-${label}-${Date.now()}`,
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
      name: session.name || `Issue043 ${label}`,
      nickname: session.name || `Issue043 ${label}`,
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
    return Boolean(pinia?._s?.get('conversation') && pinia?._s?.get('agent') && pinia?._s?.get('message'));
  }, { timeout: 10000 });
}

async function readCoordinatorRestrictions(page) {
  return page.evaluate(async () => {
    const token = localStorage.getItem('app_token') || '';
    const res = await fetch('/v1/clowder/cats?includeUnavailable=true', {
      headers: token ? { token } : {}
    });
    const data = await res.json();
    const templates = data.templates || data.data?.templates || [];
    const coordinator = templates.find((item) => item.roleTemplateId === 'coordinator' || item.catId === 'coordinator');
    return {
      status: res.status,
      found: Boolean(coordinator),
      displayName: coordinator?.displayName || '',
      restrictions: coordinator?.restrictions || [],
      roleDescription: coordinator?.roleDescription || ''
    };
  });
}

async function seedDuplicateMessages(page) {
  return page.evaluate(({ channelId, displayName, content }) => {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia
      || app?._context?.config?.globalProperties?.$pinia;
    const convStore = pinia?._s?.get('conversation');
    const agentStore = pinia?._s?.get('agent');
    const messageStore = pinia?._s?.get('message');
    if (!convStore || !agentStore || !messageStore) throw new Error('required stores not available');

    const agent = {
      id: 'luoluo',
      catId: 'luoluo',
      directCatId: 'luoluo',
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
    const conversation = convStore.upsertAgentConversation(agent);
    convStore.setActiveId(channelId);
    uni.setStorageSync('active_conversation_id', channelId);
    messageStore.messages[channelId] = [];

    const first = {
      id: 'wk-first-reply',
      messageId: 'wk-first-reply',
      clientMsgNo: 'first-client-msg',
      channelId,
      channelType: 1,
      senderId: channelId,
      senderName: displayName,
      content,
      type: 'text',
      status: 'success',
      source: 'clowder',
      renderMode: 'markdown',
      isMarkdown: true,
      time: Date.now()
    };
    const duplicate = {
      ...first,
      id: 'wk-second-reply',
      messageId: 'wk-second-reply',
      clientMsgNo: 'second-client-msg',
      time: first.time + 2000
    };
    messageStore.receiveNativeMessage(first);
    messageStore.receiveNativeMessage(duplicate);

    const messages = messageStore.messages[channelId] || [];
    const contentMatches = messages.filter((message) => message.content === content);
    const bodyText = document.body.innerText || '';
    return {
      conversation: {
        id: conversation?.id || '',
        name: conversation?.name || '',
        type: conversation?.type || '',
        source: conversation?.source || '',
        directCatId: conversation?.directCatId || ''
      },
      totalMessages: messages.length,
      contentCount: contentMatches.length,
      ids: messages.map((message) => message.id || message.messageId || message.clientMsgNo),
      visibleCountInBody: (bodyText.match(/快慢指针 PPT 课程汇报/g) || []).length,
      bodyTextSample: bodyText.slice(0, 800)
    };
  }, { channelId: CHANNEL_ID, displayName: DISPLAY_NAME, content: DUPLICATE_CONTENT });
}

async function verifyViewport(browser, label, viewport, routePath) {
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

  await page.goto(`${BASE}#${routePath}`, { waitUntil: 'networkidle' });
  await waitForStores(page);
  const restrictions = await readCoordinatorRestrictions(page);
  const state = await seedDuplicateMessages(page);
  await page.waitForTimeout(800);
  const renderedCount = await page.evaluate(() => (
    [...document.querySelectorAll('.message-list-inner .message-bubble')]
      .filter((element) => (element.innerText || '').includes('快慢指针 PPT 课程汇报')).length
  ));
  await page.screenshot({ path: path.join(DIR, `${label}-01-dedupe-chat.png`), fullPage: false });

  const restrictionsText = restrictions.restrictions.join('\n');
  record(`${label}: duplicate messages collapse in store`, state.contentCount === 1, JSON.stringify(state));
  record(`${label}: duplicate message renders once`, renderedCount === 1, JSON.stringify({ renderedCount, state }));
  record(`${label}: clowder conversation remains robot`, state.conversation.type === 'robot' && state.conversation.source === 'clowder', JSON.stringify(state.conversation));
  record(`${label}: coordinator restrictions forbid concrete work`, /生成内容或独立完成具体任务/.test(restrictionsText), JSON.stringify(restrictions));
  record(`${label}: coordinator restrictions require delegation`, /派发给合适执行猫/.test(restrictionsText), JSON.stringify(restrictions));

  await context.close();
  return { label, session: { uid: session.user.uid }, restrictions, state, renderedCount };
}

fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
let details = [];
try {
  details = [
    await verifyViewport(browser, 'desktop', { width: 1440, height: 900 }, `/pages/chat/detail?id=${encodeURIComponent(CHANNEL_ID)}`),
    await verifyViewport(browser, 'mobile', { width: 390, height: 844 }, `/pages/chat/detail?id=${encodeURIComponent(CHANNEL_ID)}`)
  ];
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(DIR, 'browser-console.json'), JSON.stringify(browserLogs, null, 2));
const summary = {
  issue: 'ISSUE-043',
  generatedAt: new Date().toISOString(),
  pass: results.every((item) => item.pass),
  results,
  details
};
fs.writeFileSync(path.join(DIR, 'result.json'), JSON.stringify(summary, null, 2));

if (!summary.pass) {
  process.exit(1);
}
