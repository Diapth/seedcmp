import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.H5_BASE_URL || 'http://172.18.58.156:5175';
const account = {
  username: process.env.TEST_USERNAME || '13733632709',
  password: process.env.TEST_PASSWORD || '123456'
};
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const runDir = path.resolve(`.ai/tests/conversation-switch-key-${stamp}`);
const screenshotDir = path.join(runDir, 'screenshots');
const network = [];
const consoleMessages = [];

async function ensureDir() {
  await fs.mkdir(screenshotDir, { recursive: true });
}

async function screenshot(page, name) {
  const file = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function fillLogin(page) {
  await page.goto(`${baseUrl}/#/pages/login/index`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('.login-page, input', { timeout: 15000 });
  const inputs = page.locator('input');
  await inputs.nth(0).fill(account.username);
  await inputs.nth(1).fill(account.password);
  await screenshot(page, '01-login-filled');
  await page.locator('.btn-submit, button').filter({ hasText: /安全登录|登录/ }).first().click();
  await page.waitForURL(/pages\/chat\/index|#\/pages\/chat\/index/, { timeout: 20000 }).catch(async () => {
    await page.waitForSelector('.conversation-item, .workbench-list', { timeout: 20000 });
  });
}

async function ensureChat(page) {
  await page.goto(`${baseUrl}/#/pages/chat/index`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('.workbench-list, .login-page', { timeout: 20000 });
  const loginVisible = await page.locator('.login-page, .btn-submit').first().isVisible().catch(() => false);
  if (loginVisible) await fillLogin(page);
  await page.waitForSelector('.conversation-item', { timeout: 20000 });
}

async function readState(page) {
  return page.evaluate(() => {
    const textOf = (selector) => document.querySelector(selector)?.innerText || '';
    const activeItems = Array.from(document.querySelectorAll('.conversation-item.active')).map((item) => item.innerText);
    return {
      title: textOf('.chat-title').trim(),
      subtitle: textOf('.chat-subtitle').trim(),
      rightTitle: textOf('.right-workspace-container .header-title').trim(),
      rightText: textOf('.right-workspace-container').slice(0, 800),
      messagesText: textOf('.chat-messages-area').slice(0, 1200),
      activeItems,
      activeConversationId: localStorage.getItem('active_conversation_id') || '',
      activeConversationKey: localStorage.getItem('active_conversation_key') || ''
    };
  });
}

async function clickConversation(page, pattern, label) {
  const item = page.locator('.conversation-item').filter({ hasText: pattern }).first();
  await item.waitFor({ state: 'visible', timeout: 20000 });
  await item.click();
  await page.waitForTimeout(900);
  await screenshot(page, label);
  return readState(page);
}

async function main() {
  await ensureDir();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1840, height: 960 } });
  const page = await context.newPage();
  page.on('requestfinished', async (request) => {
    const response = await request.response().catch(() => null);
    network.push({ method: request.method(), url: request.url(), status: response?.status() || 0 });
  });
  page.on('console', (message) => {
    consoleMessages.push({ type: message.type(), text: message.text() });
  });

  try {
    await fillLogin(page);
    await ensureChat(page);
    const groupState = await clickConversation(page, /未命名会话|AgentHub同步测试群/, '02-after-click-group');
    const directState = await clickConversation(page, /测试员B/, '03-after-click-test-b');

    const result = {
      baseUrl,
      account: account.username,
      groupState,
      directState,
      pass: false,
      checks: {
        titleIsTesterB: directState.title === '测试员B',
        subtitleIsSingle: directState.subtitle === '单聊会话',
        rightPaneIsDirect: directState.rightTitle === '会话详情' && directState.rightText.includes('测试员B') && !directState.rightText.includes('群聊信息'),
        activeKeyIsDirect: /-1"?$/.test(directState.activeConversationKey),
        oldTraceVisible: directState.messagesText.includes('AgentHub 13733632709 visible trace'),
        activeListIsTesterB: directState.activeItems.some((item) => item.includes('测试员B')) && !directState.activeItems.some((item) => item.includes('未命名会话'))
      }
    };
    result.pass = Object.values(result.checks).every(Boolean);

    await fs.writeFile(path.join(runDir, 'network.json'), JSON.stringify(network, null, 2));
    await fs.writeFile(path.join(runDir, 'console.json'), JSON.stringify(consoleMessages, null, 2));
    await fs.writeFile(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2));
    await fs.writeFile(path.join(runDir, 'report.md'), [
      '# Conversation Switch Key Check',
      '',
      `- baseUrl: ${baseUrl}`,
      `- account: ${account.username}`,
      `- pass: ${result.pass ? 'PASS' : 'FAIL'}`,
      `- checks: ${JSON.stringify(result.checks)}`,
      '',
      '## After Group',
      '',
      `- title: ${groupState.title}`,
      `- subtitle: ${groupState.subtitle}`,
      `- activeKey: ${groupState.activeConversationKey}`,
      '',
      '## After Tester B',
      '',
      `- title: ${directState.title}`,
      `- subtitle: ${directState.subtitle}`,
      `- rightTitle: ${directState.rightTitle}`,
      `- activeKey: ${directState.activeConversationKey}`,
      '',
      '## Message Sample',
      '',
      directState.messagesText
    ].join('\n'));

    if (!result.pass) {
      throw new Error(`Conversation switch check failed: ${JSON.stringify(result.checks)}`);
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
