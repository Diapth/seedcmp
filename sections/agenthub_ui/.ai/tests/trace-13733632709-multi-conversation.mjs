import { chromium } from 'playwright';
import WKSDK, { Channel, ConnectStatus, MessageText } from 'wukongimjssdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '../..');
const repoRoot = path.resolve(appRoot, '../..');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const runId = `trace-13733632709-multi-${stamp}`;
const artifactRoot = path.join(appRoot, '.ai/tests', runId);
const screenshotRoot = path.join(artifactRoot, 'screenshots');
const baseUrl = (process.env.H5_BASE_URL || 'http://172.18.58.156:5173').replace(/\/$/, '');
const apiBase = (process.env.API_BASE_URL || 'http://172.18.58.156:3000/v1').replace(/\/$/, '');

const accountA = {
  phone: '13733632709',
  username: '008613733632709',
  password: '123456',
  uid: '41232e72652648f8946988f45ba4895d'
};
const accountB = {
  uid: 'a0cd1e35f2c9494d9be852004641277a',
  name: '测试员B'
};

const runSuffix = new Date().toISOString().replace(/[:.]/g, '-');
const groupName = `AgentHub同步测试群-${stamp.slice(-6)}`;
const directTrace = `AgentHub 13733632709 multi direct trace ${runSuffix}`;
const groupTrace = `AgentHub 13733632709 multi group trace ${runSuffix}`;

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

function preview(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text
    .replace(/[A-Za-z0-9_.-]{20,}/g, (token) => `${token.slice(0, 6)}***${token.slice(-4)}`)
    .slice(0, 1200);
}

function step(name, status, detail = {}) {
  steps.push({ time: now(), name, status, ...detail });
  if (status === 'FAIL') failures.push({ name, ...detail });
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function api(pathname, options = {}) {
  const headers = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) {
    headers.token = options.token;
    headers.authorization = `Bearer ${options.token}`;
  }
  const response = await fetch(`${apiBase}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const data = await readJson(response);
  apiRecords.push({
    time: now(),
    method: options.method || 'GET',
    path: pathname,
    status: response.status,
    request: options.body || null,
    preview: preview(data)
  });
  return { status: response.status, data };
}

function pickAuth(data = {}) {
  return {
    uid: data.uid || data.data?.uid || data.user?.uid || data.data?.user?.uid || '',
    token: data.token || data.data?.token || data.user?.token || data.data?.user?.token || ''
  };
}

function normalizeWsAddr(wsAddr) {
  const raw = String(wsAddr || '').trim();
  if (!raw) return 'ws://172.18.58.156:5200/';
  try {
    const pageUrl = new URL(baseUrl);
    const wsUrl = new URL(raw);
    if (['0.0.0.0', '127.0.0.1', 'localhost'].includes(wsUrl.hostname)) wsUrl.hostname = pageUrl.hostname;
    return wsUrl.toString();
  } catch {
    return raw.replace('0.0.0.0', '172.18.58.156');
  }
}

async function loginA() {
  const response = await api('/user/login', {
    method: 'POST',
    body: {
      username: accountA.username,
      password: accountA.password,
      flag: 1,
      device: {
        device_id: `multi-a-${stamp.slice(-6)}`,
        device_name: `multi-a-${stamp.slice(-6)}`,
        device_model: 'agenthub-multi-trace',
        device_type: 2
      }
    }
  });
  const auth = pickAuth(response.data);
  const ok = response.status === 200 && auth.uid === accountA.uid && Boolean(auth.token);
  step('api-login-13733632709', ok ? 'PASS' : 'FAIL', { uid: auth.uid, tokenAcquired: Boolean(auth.token) });
  if (!ok) throw new Error('A login failed');
  return auth;
}

async function createGroup(token) {
  const response = await api('/group/create', {
    method: 'POST',
    token,
    body: {
      name: groupName,
      group_no: '',
      members: [accountB.uid],
      avatar: '',
      description: 'AgentHub 13733632709 multi conversation sync test'
    }
  });
  const data = response.data?.data || response.data?.group || response.data || {};
  const groupNo = data.group_no || data.groupNo || data.id || '';
  const ok = response.status >= 200 && response.status < 300 && Boolean(groupNo);
  step('api-create-temp-group-with-b', ok ? 'PASS' : 'FAIL', { groupName, groupNo, httpStatus: response.status });
  if (!ok) throw new Error('Group create failed');
  return groupNo;
}

async function fetchWs(uid, token) {
  const response = await api(`/users/${encodeURIComponent(uid)}/im`, { token });
  const data = response.data?.data || response.data || {};
  const wsAddr = normalizeWsAddr(data.ws_addr || data.wsAddr);
  const ok = response.status === 200 && Boolean(wsAddr);
  step('fetch-im-ws-address', ok ? 'PASS' : 'FAIL', { wsAddr });
  if (!ok) throw new Error('Missing ws address');
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

function waitForAck(shared, clientSeq, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      shared.chatManager.removeMessageStatusListener(listener);
      reject(new Error(`WKSDK ack timeout: ${clientSeq}`));
    }, timeoutMs);
    const listener = (packet) => {
      if (packet?.clientSeq !== clientSeq) return;
      clearTimeout(timer);
      shared.chatManager.removeMessageStatusListener(listener);
      sdkRecords.push({
        time: now(),
        event: 'send-ack',
        clientSeq,
        messageID: packet?.messageID?.toString?.() || String(packet?.messageID || ''),
        messageSeq: packet?.messageSeq || 0,
        reasonCode: packet?.reasonCode
      });
      if (packet?.reasonCode && packet.reasonCode !== 1) {
        reject(new Error(`WKSDK send rejected: ${packet.reasonCode}`));
        return;
      }
      resolve(packet);
    };
    shared.chatManager.addMessageStatusListener(listener);
  });
}

async function sendText(shared, channelId, channelType, text, stepName) {
  const message = await shared.chatManager.send(new MessageText(text), new Channel(channelId, channelType));
  const ack = await waitForAck(shared, message.clientSeq);
  sdkRecords.push({
    time: now(),
    event: 'send-message',
    channelId,
    channelType,
    clientSeq: message.clientSeq,
    clientMsgNo: message.clientMsgNo,
    messageSeq: ack?.messageSeq || message.messageSeq || 0,
    text
  });
  step(stepName, 'PASS', { channelId, channelType, messageSeq: ack?.messageSeq || message.messageSeq || 0 });
}

async function sendTraces(auth, wsAddr, groupNo) {
  const shared = WKSDK.shared();
  shared.config.uid = auth.uid;
  shared.config.token = auth.token;
  shared.config.provider.connectAddrCallback = (callback) => callback(wsAddr);
  shared.connect();
  await waitForConnected(shared);
  await new Promise((resolve) => setTimeout(resolve, 350));
  step('wksdk-connect-as-13733632709', 'PASS', { uid: auth.uid, wsAddr });
  await sendText(shared, accountB.uid, 1, directTrace, 'wksdk-send-direct-trace');
  await sendText(shared, groupNo, 2, groupTrace, 'wksdk-send-group-trace');
}

async function verifyChannelContains(token, channelId, channelType, text, stepName) {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const response = await api('/message/channel/sync', {
    method: 'POST',
    token,
    body: {
      channel_id: channelId,
      channel_type: channelType,
      limit: 30,
      start_message_seq: 0,
      end_message_seq: 0,
      pull_mode: 1
    }
  });
  const found = JSON.stringify(response.data).includes(text);
  step(stepName, found ? 'PASS' : 'FAIL', { channelId, channelType, httpStatus: response.status });
  if (!found) throw new Error(`${stepName} failed`);
}

async function screenshot(page, name) {
  const file = path.join(screenshotRoot, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  screenshots.push(rel(file));
}

function instrument(page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      network.push({ time: now(), type: 'console', level: msg.type(), text: msg.text(), location: msg.location() });
    }
  });
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith(apiBase.replace(/\/v1$/, '')) || /\/v1\//.test(url)) {
      network.push({ time: now(), type: 'request', method: request.method(), url });
    }
  });
  page.on('response', (response) => {
    const url = response.url();
    if (url.startsWith(apiBase.replace(/\/v1$/, '')) || /\/v1\//.test(url)) {
      network.push({ time: now(), type: 'response', status: response.status(), url });
    }
  });
  page.on('requestfailed', (request) => {
    network.push({ time: now(), type: 'requestfailed', method: request.method(), url: request.url(), errorText: request.failure()?.errorText || '' });
  });
}

async function loginH5(page) {
  await page.goto(`${baseUrl}/#/pages/login/index`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.locator('input').nth(0).fill(accountA.phone);
  await page.locator('input').nth(1).fill(accountA.password);
  await screenshot(page, '01-login-filled');
  await page.locator('.btn-submit').click({ force: true });
  await page.waitForTimeout(5000);
  const uid = await page.evaluate(() => localStorage.getItem('auth.uid') || '');
  const ok = uid === accountA.uid && page.url().includes('/pages/chat/index');
  step('h5-login-13733632709', ok ? 'PASS' : 'FAIL', { uid, url: page.url() });
  if (!ok) throw new Error('H5 login failed');
}

async function verifyH5(page, groupNo) {
  await screenshot(page, '02-conversation-list-multi');
  const currentUserName = await page.evaluate(() => {
    try {
      const user = JSON.parse(localStorage.getItem('app_user') || '{}');
      return user.nickname || user.name || user.username || 'leng';
    } catch {
      return 'leng';
    }
  });
  const listText = await page.locator('body').innerText({ timeout: 5000 });
  const listOk = listText.includes(accountB.name) &&
    listText.includes(directTrace) &&
    listText.includes(groupName) &&
    listText.includes(groupTrace);
  step('h5-list-shows-direct-and-group-traces', listOk ? 'PASS' : 'FAIL', {
    hasB: listText.includes(accountB.name),
    hasDirectTrace: listText.includes(directTrace),
    hasGroup: listText.includes(groupName),
    hasGroupTrace: listText.includes(groupTrace)
  });
  if (!listOk) throw new Error('Conversation list does not show both traces');

  const groupPreview = `${currentUserName}: ${groupTrace}`;
  const groupPreviewOk = listText.includes(groupPreview);
  step('h5-group-list-preview-prefixes-sender-nickname', groupPreviewOk ? 'PASS' : 'FAIL', {
    expected: groupPreview,
    currentUserName,
    preview: listText.slice(0, 800)
  });
  if (!groupPreviewOk) throw new Error('Group list preview does not prefix sender nickname');

  await page.locator('.conversation-item', { hasText: groupName }).first().click({ force: true });
  await page.waitForTimeout(3000);
  await screenshot(page, '03-group-chat-detail');
  const groupDetailText = await page.locator('.chat-messages-area').innerText({ timeout: 5000 }).catch(() => '');
  const groupOk = groupDetailText.includes(groupTrace);
  step('h5-group-detail-shows-trace', groupOk ? 'PASS' : 'FAIL', { groupNo, preview: groupDetailText.slice(0, 500) });
  if (!groupOk) throw new Error('Group detail does not show trace');

  const groupPageText = await page.locator('body').innerText({ timeout: 5000 });
  const memberCountOk = /[1-9]\d* 位成员/.test(groupPageText) && !groupPageText.includes('0 位成员');
  step('h5-group-detail-member-count-is-not-zero', memberCountOk ? 'PASS' : 'FAIL', {
    groupNo,
    preview: groupPageText.slice(0, 800)
  });
  if (!memberCountOk) throw new Error('Group detail still shows zero members');

  await page.locator('.conversation-item', { hasText: accountB.name }).first().click({ force: true });
  await page.waitForTimeout(3000);
  await screenshot(page, '04-direct-chat-detail');
  const directDetailText = await page.locator('.chat-messages-area').innerText({ timeout: 5000 }).catch(() => '');
  const directOk = directDetailText.includes(directTrace);
  step('h5-direct-detail-shows-trace', directOk ? 'PASS' : 'FAIL', { preview: directDetailText.slice(0, 500) });
  if (!directOk) throw new Error('Direct detail does not show trace');

  const directAvatarTexts = await page.locator('.chat-messages-area .message-avatar .fallback-text').allInnerTexts().catch(() => []);
  const directAvatarOk = !directAvatarTexts.includes('4');
  step('h5-direct-message-avatars-use-display-names', directAvatarOk ? 'PASS' : 'FAIL', {
    avatarTexts: directAvatarTexts
  });
  if (!directAvatarOk) throw new Error('Direct message avatar still uses raw uid initial');

  const active404s = network.filter((item) => item.status === 404 && (
    String(item.url || '').includes('/clowder/conversation/deployment-request/active') ||
    String(item.url || '').includes('/clowder/project-groups/active')
  ));
  const noActive404 = active404s.length === 0;
  step('h5-ordinary-direct-and-group-do-not-request-clowder-active-404', noActive404 ? 'PASS' : 'FAIL', {
    active404Count: active404s.length,
    active404Urls: active404s.map((item) => item.url)
  });
  if (!noActive404) throw new Error('Ordinary conversations still request Clowder active endpoints and log 404');
}

function writeArtifacts() {
  fs.writeFileSync(path.join(artifactRoot, 'network.json'), JSON.stringify(network, null, 2));
  fs.writeFileSync(path.join(artifactRoot, 'api-records.json'), JSON.stringify(apiRecords, null, 2));
  fs.writeFileSync(path.join(artifactRoot, 'sdk-records.json'), JSON.stringify(sdkRecords, null, 2));
  fs.writeFileSync(path.join(artifactRoot, 'full-results.json'), JSON.stringify({
    runId,
    generatedAt: now(),
    status: failures.length ? 'FAIL' : 'PASS',
    baseUrl,
    apiBase,
    accountA,
    accountB,
    groupName,
    directTrace,
    groupTrace,
    steps,
    screenshots,
    failures
  }, null, 2));
  const lines = [
    '# 13733632709 Multi Conversation Trace Report',
    '',
    `- runId: ${runId}`,
    `- generatedAt: ${now()}`,
    `- status: ${failures.length ? 'FAIL' : 'PASS'}`,
    `- H5: ${baseUrl}`,
    `- testedAccount: ${accountA.phone}`,
    `- directPeer: ${accountB.name} (${accountB.uid})`,
    `- groupName: ${groupName}`,
    `- directTrace: ${directTrace}`,
    `- groupTrace: ${groupTrace}`,
    '',
    '## Steps',
    '',
    '| Step | Status | Detail |',
    '|---|---|---|',
    ...steps.map(({ name, status, time, ...detail }) => `| ${name} | ${status} | ${preview(detail)} |`),
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
    failures.forEach((failure) => lines.push(`- ${failure.name}: ${preview(failure)}`));
    lines.push('');
  }
  fs.writeFileSync(path.join(artifactRoot, 'report.md'), `${lines.join('\n')}\n`);
}

async function main() {
  const auth = await loginA();
  const groupNo = await createGroup(auth.token);
  const wsAddr = await fetchWs(auth.uid, auth.token);
  await sendTraces(auth, wsAddr, groupNo);
  await verifyChannelContains(auth.token, accountB.uid, 1, directTrace, 'api-direct-channel-sync-contains-trace');
  await verifyChannelContains(auth.token, groupNo, 2, groupTrace, 'api-group-channel-sync-contains-trace');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 946 } });
    instrument(page);
    await loginH5(page);
    await verifyH5(page, groupNo);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main()
  .catch((err) => {
    step('runner-error', 'FAIL', { message: err.message, stack: err.stack });
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      WKSDK.shared().disconnect?.();
    } catch {
      // best effort cleanup only
    }
    writeArtifacts();
    console.log(JSON.stringify({
      runId,
      status: failures.length ? 'FAIL' : 'PASS',
      groupName,
      directTrace,
      groupTrace,
      report: rel(path.join(artifactRoot, 'report.md')),
      artifactRoot: rel(artifactRoot)
    }, null, 2));
    process.exit(process.exitCode || 0);
  });
