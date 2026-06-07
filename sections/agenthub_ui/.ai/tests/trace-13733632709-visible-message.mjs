import { chromium } from 'playwright';
import WKSDK, { Channel, ConnectStatus, MessageText } from 'wukongimjssdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '../..');
const repoRoot = path.resolve(appRoot, '../..');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const runId = `trace-13733632709-${stamp}`;
const artifactRoot = path.join(appRoot, '.ai/tests', runId);
const screenshotRoot = path.join(artifactRoot, 'screenshots');
const baseUrl = (process.env.H5_BASE_URL || 'http://172.18.58.156:5174').replace(/\/$/, '');
const apiBase = (process.env.API_BASE_URL || 'http://172.18.58.156:3000/v1').replace(/\/$/, '');

const accountA = {
  label: 'A',
  phone: '13733632709',
  username: '008613733632709',
  password: '123456',
  expectedUid: '41232e72652648f8946988f45ba4895d'
};

const accountB = {
  label: 'B',
  phone: '13800000001',
  username: '008613800000001',
  uid: 'a0cd1e35f2c9494d9be852004641277a',
  name: '测试员B'
};

const messageText = process.env.TRACE_MESSAGE ||
  `AgentHub 13733632709 visible trace ${new Date().toISOString().replace(/[:.]/g, '-')}`;

fs.mkdirSync(screenshotRoot, { recursive: true });

const steps = [];
const network = [];
const apiRecords = [];
const sdkRecords = [];
const screenshots = [];
const failures = [];

function now() {
  return new Date().toISOString();
}

function rel(file) {
  return path.relative(repoRoot, file);
}

function redact(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/[A-Za-z0-9_.-]{20,}/g, (token) => `${token.slice(0, 6)}***${token.slice(-4)}`);
}

function responsePreview(data) {
  const raw = typeof data === 'string' ? data : JSON.stringify(data);
  return redact(raw).slice(0, 1200);
}

function recordStep(name, status, detail = {}) {
  steps.push({ time: now(), name, ...detail, status });
  if (status === 'FAIL') failures.push({ name, ...detail });
}

function normalizeWsAddr(wsAddr) {
  const raw = String(wsAddr || '').trim();
  if (!raw) return 'ws://172.18.58.156:5200/';
  try {
    const apiUrl = new URL(baseUrl);
    const wsUrl = new URL(raw);
    if (['0.0.0.0', '127.0.0.1', 'localhost'].includes(wsUrl.hostname)) {
      wsUrl.hostname = apiUrl.hostname;
    }
    return wsUrl.toString();
  } catch {
    return raw.replace('0.0.0.0', '172.18.58.156');
  }
}

async function readJsonOrText(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function apiRequest(pathname, options = {}) {
  const headers = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) {
    headers.token = options.token;
    headers.authorization = `Bearer ${options.token}`;
  }
  const url = `${apiBase}${pathname}`;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const data = await readJsonOrText(response);
  apiRecords.push({
    time: now(),
    method: options.method || 'GET',
    path: pathname,
    status: response.status,
    preview: responsePreview(data)
  });
  return { status: response.status, data };
}

function pickAuth(data) {
  return {
    uid: data?.uid || data?.data?.uid || data?.user?.uid || data?.data?.user?.uid || '',
    token: data?.token || data?.data?.token || data?.user?.token || data?.data?.user?.token || '',
    name: data?.name || data?.data?.name || data?.user?.name || data?.data?.user?.name || ''
  };
}

async function loginAByApi() {
  const response = await apiRequest('/user/login', {
    method: 'POST',
    body: {
      username: accountA.username,
      password: accountA.password,
      flag: 1,
      device: {
        device_id: `trace-a-${stamp.slice(-6)}`,
        device_name: `trace-a-${stamp.slice(-6)}`,
        device_model: 'agenthub-trace',
        device_type: 2
      }
    }
  });
  const auth = pickAuth(response.data);
  const ok = response.status === 200 && auth.uid === accountA.expectedUid && Boolean(auth.token);
  recordStep('api-login-13733632709', ok ? 'PASS' : 'FAIL', {
    httpStatus: response.status,
    uid: auth.uid,
    tokenAcquired: Boolean(auth.token)
  });
  if (!ok) throw new Error('A API login failed');
  return auth;
}

async function verifyFriendship(token) {
  const response = await apiRequest('/friend/sync?version=0&limit=200&api_version=1', { token });
  const list = Array.isArray(response.data)
    ? response.data
    : response.data?.friends || response.data?.data?.friends || response.data?.data || [];
  const friends = Array.isArray(list) ? list : [];
  const friend = friends.find((item) => item.uid === accountB.uid || item.to_uid === accountB.uid);
  const ok = response.status === 200 && Boolean(friend);
  recordStep('friendship-a-has-b', ok ? 'PASS' : 'FAIL', {
    httpStatus: response.status,
    friendName: friend?.name || friend?.remark || friend?.to_name || '',
    friendUid: friend?.uid || friend?.to_uid || ''
  });
  if (!ok) throw new Error('A and B are not friends');
  return friend;
}

async function fetchImAddress(uid, token) {
  const response = await apiRequest(`/users/${encodeURIComponent(uid)}/im`, { token });
  const data = response.data?.data || response.data || {};
  const wsAddr = normalizeWsAddr(data.ws_addr || data.wsAddr);
  const ok = response.status === 200 && Boolean(wsAddr);
  recordStep('fetch-im-ws-address', ok ? 'PASS' : 'FAIL', {
    httpStatus: response.status,
    wsAddr
  });
  if (!ok) throw new Error('IM ws address missing');
  return wsAddr;
}

function waitForConnected(shared, timeoutMs = 10000) {
  if (shared.connectManager.connected()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      shared.connectManager.removeConnectStatusListener(listener);
      reject(new Error('WKSDK connect timeout'));
    }, timeoutMs);
    const listener = (status, reasonCode, connectionInfo) => {
      sdkRecords.push({
        time: now(),
        event: 'connect-status',
        status,
        statusName: ConnectStatus[status] || String(status),
        reasonCode,
        nodeId: connectionInfo?.nodeId || 0
      });
      if (status === ConnectStatus.Connected) {
        clearTimeout(timer);
        shared.connectManager.removeConnectStatusListener(listener);
        resolve();
      }
      if (status === ConnectStatus.ConnectFail || status === ConnectStatus.ConnectKick) {
        clearTimeout(timer);
        shared.connectManager.removeConnectStatusListener(listener);
        reject(new Error(`WKSDK connect failed: ${ConnectStatus[status] || status}/${reasonCode}`));
      }
    };
    shared.connectManager.addConnectStatusListener(listener);
  });
}

function waitForSendAck(shared, clientSeq, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      shared.chatManager.removeMessageStatusListener(listener);
      reject(new Error(`WKSDK send ack timeout for clientSeq=${clientSeq}`));
    }, timeoutMs);
    const listener = (packet) => {
      sdkRecords.push({
        time: now(),
        event: 'send-ack',
        clientSeq: packet?.clientSeq,
        messageID: packet?.messageID?.toString?.() || String(packet?.messageID || ''),
        messageSeq: packet?.messageSeq || 0,
        reasonCode: packet?.reasonCode
      });
      if (packet?.clientSeq !== clientSeq) return;
      clearTimeout(timer);
      shared.chatManager.removeMessageStatusListener(listener);
      if (packet?.reasonCode && packet.reasonCode !== 1) {
        reject(new Error(`WKSDK send rejected: reasonCode=${packet.reasonCode}`));
        return;
      }
      resolve(packet);
    };
    shared.chatManager.addMessageStatusListener(listener);
  });
}

async function sendSdkTraceMessage({ uid, token, wsAddr }) {
  const shared = WKSDK.shared();
  shared.config.uid = uid;
  shared.config.token = token;
  shared.config.provider.connectAddrCallback = (callback) => callback(wsAddr);
  shared.connect();
  await waitForConnected(shared);
  await new Promise((resolve) => setTimeout(resolve, 350));
  recordStep('wksdk-connect-as-13733632709', 'PASS', { uid, wsAddr });

  const message = await shared.chatManager.send(new MessageText(messageText), new Channel(accountB.uid, 1));
  const ack = await waitForSendAck(shared, message.clientSeq);
  sdkRecords.push({
    time: now(),
    event: 'send-message',
    clientSeq: message?.clientSeq,
    clientMsgNo: message?.clientMsgNo,
    messageID: ack?.messageID?.toString?.() || message?.messageID,
    messageSeq: ack?.messageSeq || message?.messageSeq,
    status: message?.status,
    channelId: accountB.uid,
    channelType: 1,
    text: messageText
  });
  recordStep('wksdk-send-a-to-b', 'PASS', {
    channelId: accountB.uid,
    channelType: 1,
    clientSeq: message?.clientSeq,
    messageSeq: ack?.messageSeq || message?.messageSeq || 0
  });
}

async function verifyMessageByApi(token) {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const response = await apiRequest('/message/channel/sync', {
    method: 'POST',
    token,
    body: {
      channel_id: accountB.uid,
      channel_type: 1,
      limit: 20,
      start_message_seq: 0,
      end_message_seq: 0,
      pull_mode: 1
    }
  });
  const data = response.data?.data || response.data || {};
  const messages = data.messages || [];
  const found = JSON.stringify(messages).includes(messageText);
  recordStep('api-message-channel-sync-contains-trace', found ? 'PASS' : 'FAIL', {
    httpStatus: response.status,
    messageCount: Array.isArray(messages) ? messages.length : 0
  });
  if (!found) throw new Error('Message was not found by channel sync');

  const conv = await apiRequest('/conversation/sync', {
    method: 'POST',
    token,
    body: { msg_count: 30 }
  });
  const convData = conv.data?.data || conv.data || {};
  const convFound = JSON.stringify(convData).includes(messageText) && JSON.stringify(convData).includes(accountB.uid);
  recordStep('api-conversation-sync-contains-trace', convFound ? 'PASS' : 'FAIL', {
    httpStatus: conv.status
  });
  if (!convFound) throw new Error('Trace message was not found by conversation sync');
}

function instrumentPage(page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      network.push({ time: now(), type: 'console', level: msg.type(), text: msg.text(), location: msg.location() });
    }
  });
  page.on('pageerror', (err) => {
    network.push({ time: now(), type: 'pageerror', text: err.stack || err.message });
  });
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith(apiBase.replace(/\/v1$/, '')) || /\/v1\//.test(url)) {
      network.push({ time: now(), type: 'request', method: request.method(), url });
    }
  });
  page.on('requestfailed', (request) => {
    network.push({
      time: now(),
      type: 'requestfailed',
      method: request.method(),
      url: request.url(),
      errorText: request.failure()?.errorText || ''
    });
  });
  page.on('response', (response) => {
    const url = response.url();
    if (url.startsWith(apiBase.replace(/\/v1$/, '')) || /\/v1\//.test(url)) {
      network.push({ time: now(), type: 'response', status: response.status(), url });
    }
  });
}

async function screenshot(page, name) {
  const file = path.join(screenshotRoot, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  screenshots.push(rel(file));
  return file;
}

async function loginAInH5(page) {
  await page.goto(`${baseUrl}/#/pages/login/index`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.locator('input').nth(0).fill(accountA.phone);
  await page.locator('input').nth(1).fill(accountA.password);
  await screenshot(page, '01-h5-login-filled');
  await page.locator('.btn-submit').click({ force: true });
  await page.waitForTimeout(4500);
  const uid = await page.evaluate(() => localStorage.getItem('auth.uid') || '');
  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  const ok = uid === accountA.expectedUid && page.url().includes('/pages/chat/index');
  recordStep('h5-login-13733632709', ok ? 'PASS' : 'FAIL', {
    url: page.url(),
    uid,
    textPreview: bodyText.slice(0, 300)
  });
  if (!ok) throw new Error('H5 login failed');
}

async function verifyVisibleTraceInH5(page) {
  await screenshot(page, '02-h5-conversation-list-visible-trace');
  const bodyText = await page.locator('body').innerText({ timeout: 5000 });
  const listOk = bodyText.includes(accountB.name) && bodyText.includes(messageText);
  recordStep('h5-conversation-list-shows-trace', listOk ? 'PASS' : 'FAIL', {
    hasContact: bodyText.includes(accountB.name),
    hasMessageText: bodyText.includes(messageText)
  });
  if (!listOk) throw new Error('Conversation list does not show trace message');

  await page.getByText(accountB.name).first().click({ force: true });
  await page.waitForTimeout(150);
  const firstFrameDetailText = await page.locator('.chat-messages-area').innerText({ timeout: 3000 }).catch(() => '');
  const firstFrameOk = firstFrameDetailText.includes(messageText);
  recordStep('h5-chat-detail-first-frame-shows-trace', firstFrameOk ? 'PASS' : 'FAIL', {
    detailTextPreview: firstFrameDetailText.slice(0, 500),
    messageText
  });
  if (!firstFrameOk) throw new Error('Chat detail first frame does not show trace message');

  await page.waitForTimeout(2500);
  await screenshot(page, '03-h5-chat-detail-after-open-b');
  const titleText = await page.locator('.chat-header .chat-title').first().innerText({ timeout: 5000 }).catch(() => '');
  const titleOk = titleText.includes(accountB.name);
  recordStep('h5-chat-detail-title-keeps-peer-name', titleOk ? 'PASS' : 'FAIL', {
    titleText,
    expectedName: accountB.name
  });
  if (!titleOk) throw new Error('Chat detail title does not keep peer name');

  const detailText = await page.locator('.chat-messages-area').innerText({ timeout: 5000 }).catch(() => '');
  const detailOk = detailText.includes(messageText);
  recordStep('h5-chat-detail-message-area-shows-trace', detailOk ? 'PASS' : 'FAIL', {
    detailTextPreview: detailText.slice(0, 500),
    messageText
  });
  if (!detailOk) throw new Error('Chat detail message area does not show trace message');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3500);
  await screenshot(page, '04-h5-chat-detail-after-refresh');
  const refreshedTitleText = await page.locator('.chat-header .chat-title').first().innerText({ timeout: 5000 }).catch(() => '');
  const refreshedDetailText = await page.locator('.chat-messages-area').innerText({ timeout: 5000 }).catch(() => '');
  const refreshedOk = refreshedTitleText.includes(accountB.name) && refreshedDetailText.includes(messageText);
  recordStep('h5-chat-detail-after-refresh-keeps-trace', refreshedOk ? 'PASS' : 'FAIL', {
    titleText: refreshedTitleText,
    detailTextPreview: refreshedDetailText.slice(0, 500),
    messageText
  });
  if (!refreshedOk) throw new Error('Chat detail loses trace message after refresh');

  const deployment404 = network.some((item) =>
    item.status === 404 &&
    String(item.url || '').includes('/clowder/conversation/deployment-request/active') &&
    String(item.url || '').includes(`channelId=${accountB.uid}`)
  );
  recordStep('h5-direct-chat-does-not-request-deployment-active-404', deployment404 ? 'FAIL' : 'PASS', {
    deployment404
  });
  if (deployment404) throw new Error('Direct chat still requests deployment active endpoint and logs 404');
}

function writeArtifacts() {
  fs.writeFileSync(path.join(artifactRoot, 'network.json'), JSON.stringify(network, null, 2));
  fs.writeFileSync(path.join(artifactRoot, 'api-records.json'), JSON.stringify(apiRecords, null, 2));
  fs.writeFileSync(path.join(artifactRoot, 'sdk-records.json'), JSON.stringify(sdkRecords, null, 2));
  fs.writeFileSync(path.join(artifactRoot, 'full-results.json'), JSON.stringify({
    runId,
    generatedAt: now(),
    baseUrl,
    apiBase,
    accountA: { phone: accountA.phone, uid: accountA.expectedUid },
    accountB,
    messageText,
    status: failures.length ? 'FAIL' : 'PASS',
    steps,
    screenshots,
    failures
  }, null, 2));

  const lines = [
    '# 13733632709 Visible Trace Test Report',
    '',
    `- runId: ${runId}`,
    `- generatedAt: ${now()}`,
    `- status: ${failures.length ? 'FAIL' : 'PASS'}`,
    `- H5: ${baseUrl}`,
    `- API: ${apiBase}`,
    `- testedAccount: ${accountA.phone}`,
    `- testedUid: ${accountA.expectedUid}`,
    `- peer: ${accountB.name} (${accountB.uid})`,
    `- traceMessage: ${messageText}`,
    '',
    '## Steps',
    '',
    '| Step | Status | Detail |',
    '|---|---|---|',
    ...steps.map((step) => {
      const { name, status, time, ...detail } = step;
      return `| ${name} | ${status} | ${responsePreview(detail)} |`;
    }),
    '',
    '## Screenshots',
    '',
    ...screenshots.map((file) => `- ${file}`),
    '',
    '## Records',
    '',
    `- ${rel(path.join(artifactRoot, 'network.json'))}`,
    `- ${rel(path.join(artifactRoot, 'api-records.json'))}`,
    `- ${rel(path.join(artifactRoot, 'sdk-records.json'))}`,
    `- ${rel(path.join(artifactRoot, 'full-results.json'))}`,
    ''
  ];
  if (failures.length) {
    lines.push('## Failures', '');
    failures.forEach((failure) => lines.push(`- ${failure.name}: ${responsePreview(failure)}`));
    lines.push('');
  }
  fs.writeFileSync(path.join(artifactRoot, 'report.md'), `${lines.join('\n')}\n`);
}

async function main() {
  const auth = await loginAByApi();
  await verifyFriendship(auth.token);
  const wsAddr = await fetchImAddress(auth.uid, auth.token);
  await sendSdkTraceMessage({ uid: auth.uid, token: auth.token, wsAddr });
  await verifyMessageByApi(auth.token);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 946 } });
    instrumentPage(page);
    await loginAInH5(page);
    await verifyVisibleTraceInH5(page);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main()
  .catch((err) => {
    recordStep('runner-error', 'FAIL', { message: err.message, stack: err.stack });
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      WKSDK.shared().disconnect?.();
    } catch {
      // Ignore cleanup errors after a failed SDK connect.
    }
    writeArtifacts();
    console.log(JSON.stringify({
      runId,
      status: failures.length ? 'FAIL' : 'PASS',
      messageText,
      report: rel(path.join(artifactRoot, 'report.md')),
      artifactRoot: rel(artifactRoot)
    }, null, 2));
    process.exit(process.exitCode || 0);
  });
