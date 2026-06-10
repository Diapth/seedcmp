import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:5173/';
const API = 'http://localhost:8090/v1';
const PASSWORD = '12345678';
const CHANNEL_ID = 'clowder_cat:qq';
const DISPLAY_NAME = 'QQ';

const PARTIAL_CONTENT = [
  'QQ～宪宪在呢！🐾',
  '',
  '不过开工自检扫到两个小问题，先跟你同步一下：',
  '',
  '1. 主仓库在 new_ui 分支上',
  '2. 有 5 个未 push 的 commit，内容涉及长期上下文接口、智能'
].join('\n');

const FINAL_CONTENT = [
  'QQ～宪宪在呢！🐾',
  '',
  '不过开工自检扫到两个小问题，先跟你同步一下：',
  '',
  '1. 主仓库在 new_ui 分支上',
  '2. 有 5 个未 push 的 commit，内容涉及长期上下文接口、智能体消息修复、Clowder 直聊名称退化等。需要 push 吗？',
  '',
  '有什么需要我做的？'
].join('\n');

const results = [];
const browserLogs = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
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
    if (response.status() >= 400 && !response.url().includes('/v1/coversation/clearUnread')) {
      browserLogs.push({ label, type: 'http-error', status: response.status(), url: response.url() });
    }
  });
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
    name: `Issue046 ${label}`,
    code: '123456',
    password: PASSWORD,
    flag: 1,
    device: {
      device_id: `issue046-${label}-${Date.now()}`,
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
      name: session.name || `Issue046 ${label}`,
      nickname: session.name || `Issue046 ${label}`,
      phone,
      raw: session
    }
  };
}

async function waitForStores(page) {
  await page.waitForFunction(() => {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia
      || app?._context?.config?.globalProperties?.$pinia;
    return Boolean(pinia?._s?.get('conversation') && pinia?._s?.get('agent') && pinia?._s?.get('message'));
  }, { timeout: 10000 });
}

async function seedPartialAndFinal(page) {
  return page.evaluate(({ channelId, displayName, partialContent, finalContent }) => {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia
      || app?._context?.config?.globalProperties?.$pinia;
    const convStore = pinia?._s?.get('conversation');
    const agentStore = pinia?._s?.get('agent');
    const messageStore = pinia?._s?.get('message');
    if (!convStore || !agentStore || !messageStore) throw new Error('required stores not available');

    const agent = {
      id: 'qq',
      catId: 'qq',
      directCatId: 'qq',
      name: displayName,
      nickname: displayName,
      avatar: '',
      desc: 'Clowder test cat',
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

    const base = {
      channelId,
      channelType: 1,
      senderId: channelId,
      senderName: displayName,
      type: 'text',
      status: 'success',
      source: 'clowder',
      renderMode: 'markdown',
      isMarkdown: true
    };
    const partial = {
      ...base,
      id: 'wk-partial-reply',
      messageId: 'wk-partial-reply',
      clientMsgNo: 'partial-client-msg',
      content: partialContent,
      time: Date.now()
    };
    const final = {
      ...base,
      id: 'wk-final-reply',
      messageId: 'wk-final-reply',
      clientMsgNo: 'final-client-msg',
      content: finalContent,
      time: partial.time + 2000
    };

    messageStore.receiveNativeMessage(partial);
    messageStore.receiveNativeMessage(final);

    const messages = messageStore.messages[channelId] || [];
    return {
      conversation: {
        id: conversation?.id || '',
        name: conversation?.name || '',
        type: conversation?.type || '',
        source: conversation?.source || '',
        directCatId: conversation?.directCatId || ''
      },
      totalMessages: messages.length,
      ids: messages.map((message) => message.id || message.messageId || message.clientMsgNo),
      contents: messages.map((message) => message.content),
      finalMatches: messages.filter((message) => message.content === finalContent).length,
      partialMatches: messages.filter((message) => message.content === partialContent).length
    };
  }, {
    channelId: CHANNEL_ID,
    displayName: DISPLAY_NAME,
    partialContent: PARTIAL_CONTENT,
    finalContent: FINAL_CONTENT
  });
}

async function verifyViewport(browser, label, viewport) {
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

  await page.goto(`${BASE}#/pages/chat/detail?id=${encodeURIComponent(CHANNEL_ID)}`, { waitUntil: 'networkidle' });
  await waitForStores(page);
  const state = await seedPartialAndFinal(page);
  await page.waitForTimeout(800);
  const renderedCount = await page.evaluate(() => (
    [...document.querySelectorAll('.message-list-inner .message-bubble')]
      .filter((element) => (element.innerText || '').includes('有什么需要我做的？')).length
  ));
  await page.screenshot({ path: path.join(DIR, `${label}-01-partial-dedupe-chat.png`), fullPage: false });

  record(`${label}: partial and final collapse in store`, state.totalMessages === 1 && state.finalMatches === 1 && state.partialMatches === 0, JSON.stringify(state));
  record(`${label}: final reply renders once`, renderedCount === 1, JSON.stringify({ renderedCount, state }));
  record(`${label}: clowder direct conversation stays active`, state.conversation.type === 'robot' && state.conversation.source === 'clowder', JSON.stringify(state.conversation));

  await context.close();
  return { label, state, renderedCount };
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
  issue: 'ISSUE-046',
  generatedAt: new Date().toISOString(),
  pass: results.every((item) => item.pass),
  results,
  details
};
fs.writeFileSync(path.join(DIR, 'result.json'), JSON.stringify(summary, null, 2));

if (!summary.pass) {
  process.exit(1);
}
