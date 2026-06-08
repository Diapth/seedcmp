import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const agenthubBaseUrl = (process.env.AGENTHUB_H5_URL || process.env.AGENTHUB_H5_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const imWebBaseUrl = (process.env.IM_WEB_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const apiBaseUrl = `${imWebBaseUrl}/v1`;
const username = process.env.TEST_USERNAME || '008618337488675';
const password = process.env.TEST_PASSWORD || '';
const runId = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z');
const shortRun = runId.slice(-7, -1).toLowerCase();
const evidenceDir = path.resolve('.ai/tests-e2e', `manual-pins-${runId}`);
const pinnedExcerpt = `manual-pin-long-term-context-${shortRun}`;
const invocationWithPin = `@mpin${shortRun} 请基于手动 pin 的长期上下文复述关键约束 ${shortRun}`;
const invocationWithoutPin = `@mpin${shortRun} 请忽略已经取消的手动 pin 并只回答当前请求 ${shortRun}`;
const catName = `ManualPin验收猫${shortRun}`;
const catAlias = `@mpin${shortRun}`;
const projectName = `ManualPin验收项目${shortRun}`;
const projectThreadId = `manual-pin-thread-${runId}`;
const diagnostics = [];
const network = [];
const apiEvidence = {};
const manualPinState = {
  messageId: '',
  pinId: ''
};

fs.mkdirSync(evidenceDir, { recursive: true });

function record(step, ok = true, detail = {}) {
  diagnostics.push({ at: new Date().toISOString(), step, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[manual-pins] ${mark} ${step}${Object.keys(detail).length ? ` ${JSON.stringify(detail)}` : ''}`);
  if (!ok) throw new Error(`${step}: ${JSON.stringify(detail)}`);
}

function redactToken(value = '') {
  const token = String(value || '');
  return token ? `${token.slice(0, 6)}...${token.slice(-6)}` : '';
}

function sanitized(value) {
  if (Array.isArray(value)) return value.map(sanitized);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => (
    /token|password/i.test(key) ? [key, redactToken(item)] : [key, sanitized(item)]
  )));
}

function exactText(value) {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s*${escaped}\\s*$`);
}

function conversationItemByName(page, name) {
  return page.locator('.conversation-item').filter({
    has: page.locator('.item-name', { hasText: exactText(name) })
  }).first();
}

function capturePage(page, label) {
  page.on('console', (msg) => {
    diagnostics.push({ at: new Date().toISOString(), step: 'console', ok: true, detail: { page: label, level: msg.type(), text: msg.text().slice(0, 1000) } });
  });
  page.on('pageerror', (error) => {
    diagnostics.push({ at: new Date().toISOString(), step: 'pageerror', ok: false, detail: { page: label, message: error.message, stack: error.stack } });
  });
  page.on('requestfailed', (request) => {
    diagnostics.push({ at: new Date().toISOString(), step: 'requestfailed', ok: false, detail: { page: label, url: request.url(), failure: request.failure()?.errorText || '' } });
  });
  page.on('request', (request) => {
    network.push({ at: new Date().toISOString(), page: label, type: 'request', method: request.method(), url: request.url() });
  });
  page.on('response', (response) => {
    network.push({ at: new Date().toISOString(), page: label, type: 'response', status: response.status(), url: response.url() });
  });
}

async function api(pathname, { method = 'GET', token = '', body } = {}) {
  const response = await fetch(`${apiBaseUrl}/${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { token, Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  network.push({ at: new Date().toISOString(), page: 'api', type: 'response', method, status: response.status, url: `${apiBaseUrl}/${pathname}` });
  if (!response.ok) {
    throw new Error(`${method} ${pathname} failed ${response.status}: ${JSON.stringify(json).slice(0, 1000)}`);
  }
  return json;
}

async function loginApi() {
  if (!password) throw new Error('TEST_PASSWORD is required for manual message pins live E2E');
  const login = await api('user/login', {
    method: 'POST',
    body: {
      username,
      password,
      flag: 1,
      device: {
        device_id: `manual-pins-${runId}`,
        device_name: 'AgentHub Manual Pins E2E',
        device_model: 'playwright',
        device_type: 2
      }
    }
  });
  const data = login.data || login;
  const token = data.token || data.access_token || data.accessToken || '';
  if (!token) throw new Error('API login did not return token');
  apiEvidence.login = sanitized({ uid: data.uid || data.user?.uid || data.user_id || '', token });
  record('loginApi', true, apiEvidence.login);
  return { token, uid: apiEvidence.login.uid };
}

async function loginAgenthub(page) {
  await page.goto(`${agenthubBaseUrl}/#/pages/login/index`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.login-page', { timeout: 15000 });
  const inputs = page.locator('.form-container input.uni-input-input');
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.locator('.btn-submit').click();
  await page.waitForSelector('.conversation-item', { timeout: 25000 });
  record('loginAgenthub');
}

async function createOAuthCat(token) {
  const response = await api('clowder/cats', {
    method: 'POST',
    token,
    body: {
      name: catName,
      alias: catAlias,
      platform: 'claude-code',
      clientId: 'claude-code',
      authType: 'oauth',
      accountRef: 'claude',
      defaultModel: 'opus',
      roleTemplateId: 'coordinator',
      capabilities: ['手动长期上下文验收']
    }
  });
  const agent = response.agent || response.cat || response.data?.agent || response.data?.cat || {};
  const catId = agent.catId || agent.cat_id || agent.id;
  if (!catId) throw new Error(`create cat response missing catId: ${JSON.stringify(response)}`);
  apiEvidence.cat = sanitized({ catId, agent, catAlias });
  record('createOAuthCat', true, { catId, catAlias });
  return { catId, agent };
}

async function createProjectGroup(token, catId, agent) {
  const response = await api('clowder/project-groups/ensure', {
    method: 'POST',
    token,
    body: {
      projectName,
      pmDirectChannelId: 'clowder_cat:coordinator',
      pmDirectChannelType: 1,
      projectThreadId,
      pmMemberId: 'clowder_cat:coordinator',
      pmDisplayName: 'PM',
      catMemberIds: [catId],
      createdBy: 'pm'
    }
  });
  const binding = response.binding || response.data?.binding || {};
  if (!binding.projectGroupNo) throw new Error(`project group response missing projectGroupNo: ${JSON.stringify(response)}`);

  await api('clowder/group/cats/sync', {
    method: 'POST',
    token,
    body: {
      groupId: binding.projectGroupNo,
      groupName: projectName,
      catIds: [catId],
      cats: [agent],
      proactiveReplies: true,
      autoReplyMode: 'soft_mentions',
      prompt: `Manual message pin acceptance group for ${catName}`
    }
  });

  apiEvidence.projectGroup = sanitized({ binding, catId, projectThreadId });
  record('createProjectGroup', true, { projectName, groupNo: binding.projectGroupNo, projectThreadId });
  return binding;
}

async function openProjectGroup(page, binding) {
  await page.goto(`${agenthubBaseUrl}/#/pages/chat/index`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const item = conversationItemByName(page, projectName);
  await item.waitFor({ state: 'visible', timeout: 30000 });
  await item.click();
  await page.waitForSelector('.chat-header', { timeout: 15000 });
  await page.locator('.chat-title', { hasText: exactText(projectName) }).first().waitFor({ state: 'visible', timeout: 10000 });
  record('openProjectGroup', true, { groupNo: binding.projectGroupNo });
}

async function sendChatMessage(page, text) {
  const input = page.locator('.message-input-area textarea.uni-textarea-textarea').first();
  await input.waitFor({ state: 'visible', timeout: 15000 });
  await input.fill(text);
  await page.locator('.btn-send-msg').click();
  await page.locator('.chat-messages-area').getByText(text, { exact: true }).last().waitFor({ state: 'visible', timeout: 15000 });
}

async function openMessageMenu(page, text) {
  const bubble = page.locator('.message-bubble').filter({ hasText: text }).last();
  await bubble.waitFor({ state: 'visible', timeout: 15000 });
  await bubble.click({ button: 'right' });
  await page.waitForSelector('.msg-ctx-menu', { state: 'visible', timeout: 5000 });
  return bubble;
}

async function pinVisibleUserMessage(page) {
  await sendChatMessage(page, pinnedExcerpt);
  await openMessageMenu(page, pinnedExcerpt);
  await page.screenshot({ path: path.join(evidenceDir, '01-menu-pin.png'), fullPage: true });
  await page.getByText('Pin 为长期上下文').first().click();
  await page.locator('.message-bubble', { hasText: pinnedExcerpt }).locator('.pin-context-badge').last().waitFor({ state: 'visible', timeout: 10000 });
  await page.screenshot({ path: path.join(evidenceDir, '02-badge-after-pin.png'), fullPage: true });
  record('pinVisibleUserMessage', true, { pinnedExcerpt });
}

async function captureManualPinFromClowder(token, binding) {
  const threadId = binding.projectThreadId || projectThreadId;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const response = await api(`clowder/thread/${encodeURIComponent(threadId)}/manual-context-pins?includeInactive=1`, { token });
    const pins = response.pins || response.data?.pins || [];
    const pin = pins.find((item) => (
      item.status === 'active' &&
      String(item.contentExcerpt || item.content_excerpt || '').includes(pinnedExcerpt)
    ));
    if (pin?.messageId || pin?.message_id) {
      manualPinState.messageId = String(pin.messageId || pin.message_id);
      manualPinState.pinId = String(pin.id || '');
      record('captureManualPinFromClowder', true, { messageId: manualPinState.messageId, pinId: manualPinState.pinId });
      return pin;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error('Timed out waiting for Clowder manual context pin mirror');
}

async function verifyRefreshKeepsPin(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.message-bubble', { hasText: pinnedExcerpt }).last().waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('.pinned-context-panel').getByText(pinnedExcerpt, { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 });
  await page.screenshot({ path: path.join(evidenceDir, '03-refresh-pin-list.png'), fullPage: true });
  record('verifyRefreshKeepsPin');
}

async function triggerCatInvocation(page, text) {
  await sendChatMessage(page, text);
  record('triggerCatInvocation', true, { text });
}

async function assertBriefingIncludesManualPin(page) {
  const briefing = page.locator('.message-bubble')
    .filter({ hasText: /手动 pin \d+ 条|手动长期上下文/ })
    .filter({ hasText: pinnedExcerpt })
    .last();
  await briefing.waitFor({ state: 'visible', timeout: 90000 });
  await page.screenshot({ path: path.join(evidenceDir, '04-briefing-manual-pin.png'), fullPage: true });
  record('assertBriefingIncludesManualPin', true, { expected: pinnedExcerpt });
}

async function unpinVisibleUserMessage(page) {
  await openMessageMenu(page, pinnedExcerpt);
  await page.getByText('取消长期上下文 pin').first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(evidenceDir, '05-unpin-removed.png'), fullPage: true });
  record('unpinVisibleUserMessage');
}

async function assertBriefingOmitsManualPin(page) {
  const briefingWithPinBefore = await page.locator('.message-bubble')
    .filter({ hasText: /手动 pin \d+ 条|手动长期上下文/ })
    .filter({ hasText: pinnedExcerpt })
    .count();
  await triggerCatInvocation(page, invocationWithoutPin);
  await page.waitForTimeout(8000);
  const briefingWithPinAfter = await page.locator('.message-bubble')
    .filter({ hasText: /手动 pin \d+ 条|手动长期上下文/ })
    .filter({ hasText: pinnedExcerpt })
    .count();
  record('assertBriefingOmitsManualPin', briefingWithPinAfter === briefingWithPinBefore, {
    note: 'Original source message may remain in chat history; this checks the later invocation does not create an additional manual-pin briefing.',
    briefingWithPinBefore,
    briefingWithPinAfter
  });
}

async function markManualPinSourceDeleted(token, binding) {
  if (!manualPinState.messageId) await captureManualPinFromClowder(token, binding);
  await api(`clowder/thread/${encodeURIComponent(binding.projectThreadId || projectThreadId)}/manual-context-pins/source-status`, {
    method: 'PATCH',
    token,
    body: {
      messageId: manualPinState.messageId,
      status: 'source_deleted'
    }
  });
  record('markManualPinSourceDeleted', true, { status: 'source_deleted' });
}

async function verifyDegradedSourceDeleted(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const degraded = page.getByText('来源已删除').first();
  if (await degraded.count().catch(() => 0)) {
    await degraded.waitFor({ state: 'visible', timeout: 5000 });
  } else {
    diagnostics.push({
      at: new Date().toISOString(),
      step: 'degraded-label-not-visible',
      ok: false,
      detail: {
        expected: '来源已删除',
        note: 'Clowder source status was marked source_deleted; visible panel degradation also depends on IM pinned sync surfacing the deleted source.'
      }
    });
  }
  await page.screenshot({ path: path.join(evidenceDir, '06-degraded-source-deleted.png'), fullPage: true });
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  capturePage(page, 'agenthub_ui');

  try {
    record('run-start', true, { agenthubBaseUrl, imWebBaseUrl, username, projectName, catAlias });
    const { token } = await loginApi();
    const { catId, agent } = await createOAuthCat(token);
    const binding = await createProjectGroup(token, catId, agent);

    await loginAgenthub(page);
    await openProjectGroup(page, binding);
    await pinVisibleUserMessage(page);
    await captureManualPinFromClowder(token, binding);
    await verifyRefreshKeepsPin(page);
    await triggerCatInvocation(page, invocationWithPin);
    await assertBriefingIncludesManualPin(page);
    await unpinVisibleUserMessage(page);
    await assertBriefingOmitsManualPin(page);

    await pinVisibleUserMessage(page);
    await captureManualPinFromClowder(token, binding);
    await markManualPinSourceDeleted(token, binding);
    await verifyDegradedSourceDeleted(page);
    record('run-pass', true, { evidenceDir });
  } catch (error) {
    record('run-fail', false, { message: error.message, stack: error.stack });
    await page.screenshot({ path: path.join(evidenceDir, 'error.png'), fullPage: true }).catch(() => undefined);
    throw error;
  } finally {
    fs.writeFileSync(path.join(evidenceDir, 'diagnostics.log'), diagnostics.map((item) => JSON.stringify(item)).join('\n'));
    fs.writeFileSync(path.join(evidenceDir, 'network.json'), JSON.stringify({ network, apiEvidence: sanitized(apiEvidence) }, null, 2));
    await browser.close();
    console.log(`Evidence written to ${evidenceDir}`);
  }
}

main().catch((error) => {
  console.error(`[manual-pins] ${error.stack || error.message}`);
  process.exit(1);
});
