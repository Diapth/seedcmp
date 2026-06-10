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
const WORKTREE_ID = 'seedcmp';
const WORKSPACE_PATH = 'slides/lesson.md';
const FILE_NAME = 'lesson.md';
const RAW_MARKDOWN = [
  '# Workspace Artifact Rendered',
  '',
  '来自 Clowder workspace raw。'
].join('\n');

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
  const suffix = label === 'mobile' ? '8' : '7';
  return `19${suffix}${digits}`;
}

async function registerSession(label) {
  const phone = phoneFor(label);
  await apiPost('/user/sms/registercode', { zone: '0086', phone });
  const session = await apiPost('/user/register', {
    zone: '0086',
    phone,
    name: `Issue044 ${label}`,
    code: '123456',
    password: PASSWORD,
    flag: 1,
    device: {
      device_id: `issue044-${label}-${Date.now()}`,
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
      name: session.name || `Issue044 ${label}`,
      nickname: session.name || `Issue044 ${label}`,
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

async function seedWorkspaceArtifact(page) {
  return page.evaluate(({ channelId, displayName, worktreeId, workspacePath, fileName }) => {
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

    messageStore.receiveAgentReplyEvent(channelId, {
      streamKey: 'issue044-artifact',
      phase: 'final',
      content: `产物已生成：${workspacePath}`,
      senderId: channelId,
      senderName: displayName,
      generatedFiles: [{
        id: 'issue044-file',
        fileName,
        fileType: 'md',
        path: workspacePath,
        worktreeId
      }]
    });

    const messages = messageStore.messages[channelId] || [];
    const fileMessage = messages.find((message) => message.id === 'issue044-file');
    return {
      conversation: {
        id: conversation?.id || '',
        name: conversation?.name || '',
        type: conversation?.type || '',
        source: conversation?.source || '',
        directCatId: conversation?.directCatId || ''
      },
      fileMessage: {
        id: fileMessage?.id || '',
        fileName: fileMessage?.fileName || '',
        url: fileMessage?.url || '',
        path: fileMessage?.path || '',
        workspacePath: fileMessage?.workspacePath || '',
        worktreeId: fileMessage?.worktreeId || '',
        source: fileMessage?.source || '',
        generatedByAgent: Boolean(fileMessage?.generatedByAgent)
      }
    };
  }, { channelId: CHANNEL_ID, displayName: DISPLAY_NAME, worktreeId: WORKTREE_ID, workspacePath: WORKSPACE_PATH, fileName: FILE_NAME });
}

function decodeRawRequest(rawUrl) {
  const url = new URL(rawUrl);
  return {
    worktreeId: url.searchParams.get('worktreeId') || '',
    path: url.searchParams.get('path') || '',
    href: rawUrl
  };
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
  const rawRequests = [];
  const badStaticRequests = [];
  attachLoggers(page, label);

  page.on('request', (request) => {
    const url = request.url();
    if (/\/assets\/(lesson|presentation|快慢指针).*?\.(md|pptx|pdf|txt)(?:[?#]|$)/i.test(url)
      || /\/slides\/lesson\.md(?:[?#]|$)/i.test(url)
      || /\/slides\/presentation\.pptx(?:[?#]|$)/i.test(url)) {
      badStaticRequests.push(url);
    }
  });

  await page.route('**/v1/coversation/clearUnread', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true })
    });
  });

  await page.route('**/v1/clowder/workspace/file/raw**', (route) => {
    rawRequests.push(decodeRawRequest(route.request().url()));
    route.fulfill({
      status: 200,
      contentType: 'text/markdown; charset=utf-8',
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition': `inline; filename="${FILE_NAME}"`
      },
      body: RAW_MARKDOWN
    });
  });

  await page.goto(`${BASE}#${routePath}`, { waitUntil: 'networkidle' });
  await waitForStores(page);
  const seeded = await seedWorkspaceArtifact(page);
  await page.waitForSelector('.file-card .btn-preview', { timeout: 10000 });
  await page.locator('.file-card .btn-preview').last().click();

  try {
    await page.waitForFunction(({ title, body }) => {
      const text = document.body.innerText || '';
      return text.includes(title) && text.includes(body);
    }, { title: FILE_NAME, body: 'Workspace Artifact Rendered' }, { timeout: 10000 });
  } catch (error) {
    const failureState = await page.evaluate(() => ({
      hash: location.hash,
      bodyText: (document.body.innerText || '').slice(0, 1200),
      previewTitle: document.querySelector('.preview-filename')?.textContent?.trim() || '',
      markdownText: document.querySelector('.markdown-body')?.textContent?.replace(/\s+/g, ' ').trim() || '',
      fileCards: [...document.querySelectorAll('.file-card')].map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim()),
      buttons: [...document.querySelectorAll('button')].map((node) => ({
        text: (node.textContent || '').replace(/\s+/g, ' ').trim(),
        disabled: Boolean(node.disabled)
      }))
    }));
    await page.screenshot({ path: path.join(DIR, `${label}-error-preview-timeout.png`), fullPage: false });
    fs.writeFileSync(path.join(DIR, `${label}-error-state.json`), JSON.stringify({
      error: error.message,
      seeded,
      rawRequests,
      badStaticRequests,
      failureState
    }, null, 2));
    throw error;
  }

  const visible = await page.evaluate(() => {
    const previewTitle = document.querySelector('.preview-filename')?.textContent?.trim() || '';
    const markdownText = document.querySelector('.markdown-body')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const bodyText = document.body.innerText || '';
    const previewWidth = document.querySelector('.file-preview-shell')?.getBoundingClientRect().width || 0;
    return {
      previewTitle,
      markdownText,
      hasWorkspaceText: bodyText.includes('Workspace Artifact Rendered'),
      hasOldFastSlowTitle: bodyText.includes('快慢指针-数据结构课汇报.md'),
      urlHash: location.hash,
      previewWidth,
      bodySample: bodyText.slice(0, 900)
    };
  });

  await page.screenshot({ path: path.join(DIR, `${label}-01-workspace-artifact-preview.png`), fullPage: false });

  const rawHit = rawRequests.find((request) => (
    request.worktreeId === WORKTREE_ID && request.path === WORKSPACE_PATH
  ));
  record(`${label}: generated file keeps workspace metadata`, seeded.fileMessage.path === WORKSPACE_PATH && seeded.fileMessage.worktreeId === WORKTREE_ID, JSON.stringify(seeded.fileMessage));
  record(`${label}: preview title matches clicked file`, visible.previewTitle === FILE_NAME, JSON.stringify(visible));
  record(`${label}: preview renders workspace raw markdown`, visible.hasWorkspaceText && /来自 Clowder workspace raw/.test(visible.markdownText), JSON.stringify({ visible, rawRequests }));
  record(`${label}: workspace raw API receives exact path`, Boolean(rawHit), JSON.stringify(rawRequests));
  record(`${label}: no frontend static fallback request`, badStaticRequests.length === 0, JSON.stringify(badStaticRequests));
  record(`${label}: stale preview is absent`, !visible.hasOldFastSlowTitle, JSON.stringify(visible));
  record(`${label}: preview panel has usable width`, visible.previewWidth >= Math.min(320, viewport.width - 24), JSON.stringify(visible));

  await context.close();
  return {
    label,
    session: { uid: session.user.uid },
    seeded,
    visible,
    rawRequests,
    badStaticRequests
  };
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
  issue: 'ISSUE-044',
  generatedAt: new Date().toISOString(),
  pass: results.every((item) => item.pass),
  results,
  details
};
fs.writeFileSync(path.join(DIR, 'result.json'), JSON.stringify(summary, null, 2));

if (!summary.pass) {
  process.exit(1);
}
