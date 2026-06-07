import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const agenthubBaseUrl = (process.env.AGENTHUB_H5_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const imWebBaseUrl = (process.env.IM_WEB_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const username = process.env.TEST_USERNAME || '008618337488675';
const password = process.env.TEST_PASSWORD || '123456';
const conversationName = process.env.TEST_CONVERSATION || 'qwq';
const runId = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
const messageText = process.env.TEST_MESSAGE || `agenthub-imweb-live-${runId}`;
const evidenceDir = path.resolve('.ai', 'tests-e2e', `v1-2-${runId}`);
const events = [];
const wsFrames = [];

fs.mkdirSync(evidenceDir, { recursive: true });

function record(type, detail = {}) {
  events.push({
    at: new Date().toISOString(),
    type,
    ...detail
  });
}

function capturePage(page, label) {
  page.on('console', (msg) => {
    record('console', { page: label, level: msg.type(), text: msg.text().slice(0, 1000) });
  });
  page.on('pageerror', (error) => {
    record('pageerror', { page: label, message: error.message, stack: error.stack });
  });
  page.on('requestfailed', (request) => {
    record('requestfailed', { page: label, url: request.url(), failure: request.failure()?.errorText || '' });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      record('http-error', { page: label, url: response.url(), status: response.status() });
    }
  });
  page.on('websocket', (socket) => {
    const wsUrl = socket.url();
    record('websocket-open', { page: label, url: wsUrl });
    socket.on('framesent', (frame) => {
      wsFrames.push({
        at: new Date().toISOString(),
        page: label,
        direction: 'sent',
        url: wsUrl,
        size: Buffer.byteLength(String(frame.payload || '')),
        payload: String(frame.payload || '').slice(0, 180)
      });
    });
    socket.on('framereceived', (frame) => {
      wsFrames.push({
        at: new Date().toISOString(),
        page: label,
        direction: 'received',
        url: wsUrl,
        size: Buffer.byteLength(String(frame.payload || '')),
        payload: String(frame.payload || '').slice(0, 180)
      });
    });
    socket.on('close', () => record('websocket-close', { page: label, url: wsUrl }));
  });
}

async function loginAgenthub(page) {
  await page.goto(`${agenthubBaseUrl}/#/pages/login/index`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.login-page', { timeout: 15000 });
  const inputs = page.locator('.form-container input.uni-input-input');
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.locator('.btn-submit').click();
  await page.waitForSelector('.conversation-item', { timeout: 25000 });
  record('agenthub-login-ok');
}

async function loginImWeb(page) {
  await page.goto(`${imWebBaseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/手机号|账号|username/i).fill(username);
  await page.getByPlaceholder(/密码|password/i).fill(password);
  await page.getByRole('button', { name: /安全登录|登录|login/i }).click();
  await page.waitForSelector('.conversation-item', { timeout: 25000 });
  record('imweb-login-ok');
}

async function selectAgenthubConversation(page) {
  const item = page.locator('.conversation-item', { hasText: conversationName }).first();
  await item.waitFor({ state: 'visible', timeout: 15000 });
  await item.click();
  await page.waitForSelector('.chat-header', { timeout: 10000 });
  await page.waitForSelector('.chat-messages-area', { timeout: 10000 });
  const title = await page.locator('.chat-title').first().innerText();
  record('agenthub-conversation-selected', { requestedName: conversationName, title });
  return title;
}

async function selectImWebConversation(page) {
  const item = page.locator('.conversation-item', { hasText: conversationName }).first();
  await item.waitFor({ state: 'visible', timeout: 15000 });
  const meta = await item.evaluate((node) => ({
    channelId: node.getAttribute('data-channel-id') || '',
    channelType: node.getAttribute('data-channel-type') || '',
    text: node.innerText
  }));
  await item.click();
  await page.waitForSelector('.message-input-container', { timeout: 15000 });
  await page.waitForSelector('.message-list', { timeout: 15000 });
  record('imweb-conversation-selected', meta);
  return meta;
}

async function sendAgenthubMessage(page) {
  const input = page.locator('.message-input-area textarea.uni-textarea-textarea').first();
  await input.waitFor({ state: 'visible', timeout: 15000 });
  await input.fill(messageText);
  await page.locator('.btn-send-msg').click();
  await page.locator('.chat-messages-area').getByText(messageText, { exact: true }).last().waitFor({
    state: 'visible',
    timeout: 10000
  });
  record('agenthub-message-visible', { messageText });
}

async function assertImWebReceived(page) {
  await page.locator('.message-list').getByText(messageText, { exact: true }).last().waitFor({
    state: 'visible',
    timeout: 10000
  });
  record('imweb-message-received-without-refresh', { messageText });
}

async function main() {
  const browser = await chromium.launch();
  const agenthubContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const imWebContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const agenthubPage = await agenthubContext.newPage();
  const imWebPage = await imWebContext.newPage();
  capturePage(agenthubPage, 'agenthub_ui');
  capturePage(imWebPage, 'im_web');

  try {
    record('run-start', {
      agenthubBaseUrl,
      imWebBaseUrl,
      username,
      conversationName,
      messageText
    });
    await loginAgenthub(agenthubPage);
    await loginImWeb(imWebPage);
    await selectAgenthubConversation(agenthubPage);
    const imWebConversation = await selectImWebConversation(imWebPage);
    await agenthubPage.screenshot({ path: path.join(evidenceDir, '01-agenthub-before-send.png'), fullPage: true });
    await imWebPage.screenshot({ path: path.join(evidenceDir, '02-imweb-before-send.png'), fullPage: true });

    await sendAgenthubMessage(agenthubPage);
    await assertImWebReceived(imWebPage);

    await agenthubPage.screenshot({ path: path.join(evidenceDir, '03-agenthub-after-send.png'), fullPage: true });
    await imWebPage.screenshot({ path: path.join(evidenceDir, '04-imweb-received-without-refresh.png'), fullPage: true });
    record('run-pass', { imWebConversation });
  } catch (error) {
    record('run-fail', { message: error.message, stack: error.stack });
    await agenthubPage.screenshot({ path: path.join(evidenceDir, 'error-agenthub.png'), fullPage: true }).catch(() => undefined);
    await imWebPage.screenshot({ path: path.join(evidenceDir, 'error-imweb.png'), fullPage: true }).catch(() => undefined);
    throw error;
  } finally {
    fs.writeFileSync(path.join(evidenceDir, 'events.json'), JSON.stringify(events, null, 2));
    fs.writeFileSync(path.join(evidenceDir, 'ws-frames.json'), JSON.stringify(wsFrames.slice(-300), null, 2));
    await browser.close();
    console.log(`Evidence written to ${evidenceDir}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
