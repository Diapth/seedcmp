import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.H5_BASE_URL || 'http://172.18.58.156:5174';
const account = {
  username: process.env.TEST_USERNAME || '13733632709',
  password: process.env.TEST_PASSWORD || '123456'
};
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const runDir = path.resolve(`.ai/tests/right-panel-jitter-${stamp}`);
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
  const submit = page.locator('.btn-submit, button').filter({ hasText: /安全登录|登录/ }).first();
  await submit.click();
  await page.waitForURL(/pages\/chat\/index|#\/pages\/chat\/index/, { timeout: 20000 }).catch(async () => {
    await page.waitForSelector('.conversation-item, .workbench-list', { timeout: 20000 });
  });
}

async function ensureChat(page) {
  await page.goto(`${baseUrl}/#/pages/chat/index`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('.workbench-list', { timeout: 20000 });
  const loginVisible = await page.locator('.login-page, .btn-submit').first().isVisible().catch(() => false);
  if (loginVisible) {
    await fillLogin(page);
  }
  await page.waitForSelector('.conversation-item', { timeout: 20000 });
}

async function openExistingGroup(page) {
  const groupItem = page.locator('.conversation-item').filter({ hasText: /AgentHub同步测试群/ }).first();
  await groupItem.waitFor({ state: 'visible', timeout: 20000 });
  await groupItem.click();
  await page.waitForSelector('.chat-title', { timeout: 10000 });
  const rightVisible = await page.locator('.right-workspace-container').first().isVisible().catch(() => false);
  if (!rightVisible) {
    await page.locator('.toggle-detail-btn').first().click();
  }
  await page.waitForSelector('.right-workspace-container .group-info', { timeout: 15000 });
}

async function sampleRightPanel(page) {
  await page.waitForTimeout(500);
  const samples = [];
  for (let i = 0; i < 40; i += 1) {
    const item = await page.evaluate(() => {
      const container = document.querySelector('.right-workspace-container');
      const group = document.querySelector('.right-workspace-container .group-info');
      const header = document.querySelector('.right-workspace-container .workspace-header');
      const action = document.querySelector('.right-workspace-container .action-section');
      const text = container?.innerText || '';
      const rectOf = (el) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          top: Math.round(rect.top * 100) / 100,
          left: Math.round(rect.left * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100
        };
      };
      return {
        at: Date.now(),
        container: rectOf(container),
        group: rectOf(group),
        header: rectOf(header),
        action: rectOf(action),
        hasProjectSyncText: text.includes('项目工作台同步中'),
        memberCountVisible: /\d+ 位成员/.test(text),
        textSample: text.slice(0, 500)
      };
    });
    samples.push(item);
    await page.waitForTimeout(100);
  }
  return samples;
}

function maxDelta(samples, key, prop) {
  const values = samples
    .map((sample) => sample[key]?.[prop])
    .filter((value) => typeof value === 'number');
  if (values.length <= 1) return 0;
  return Math.max(...values) - Math.min(...values);
}

async function main() {
  await ensureDir();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1840, height: 960 } });
  const page = await context.newPage();
  page.on('requestfinished', async (request) => {
    const response = await request.response().catch(() => null);
    network.push({
      method: request.method(),
      url: request.url(),
      status: response?.status() || 0
    });
  });
  page.on('console', (message) => {
    consoleMessages.push({ type: message.type(), text: message.text() });
  });

  try {
    await fillLogin(page);
    await ensureChat(page);
    await openExistingGroup(page);
    await screenshot(page, '02-group-right-panel-open');
    const samples = await sampleRightPanel(page);
    await screenshot(page, '03-group-right-panel-after-sampling');

    const result = {
      baseUrl,
      account: account.username,
      sampleCount: samples.length,
      hasProjectSyncText: samples.some((sample) => sample.hasProjectSyncText),
      memberCountVisible: samples.some((sample) => sample.memberCountVisible),
      deltas: {
        containerTop: maxDelta(samples, 'container', 'top'),
        containerHeight: maxDelta(samples, 'container', 'height'),
        groupTop: maxDelta(samples, 'group', 'top'),
        groupHeight: maxDelta(samples, 'group', 'height'),
        actionTop: maxDelta(samples, 'action', 'top'),
        actionHeight: maxDelta(samples, 'action', 'height')
      },
      firstTextSample: samples[0]?.textSample || '',
      lastTextSample: samples.at(-1)?.textSample || '',
      pass: false
    };
    result.pass = !result.hasProjectSyncText &&
      result.memberCountVisible &&
      result.deltas.containerTop <= 1 &&
      result.deltas.containerHeight <= 1 &&
      result.deltas.groupTop <= 1 &&
      result.deltas.actionTop <= 1;

    await fs.writeFile(path.join(runDir, 'samples.json'), JSON.stringify(samples, null, 2));
    await fs.writeFile(path.join(runDir, 'network.json'), JSON.stringify(network, null, 2));
    await fs.writeFile(path.join(runDir, 'console.json'), JSON.stringify(consoleMessages, null, 2));
    await fs.writeFile(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2));
    await fs.writeFile(path.join(runDir, 'report.md'), [
      '# Right Panel Jitter Check',
      '',
      `- baseUrl: ${baseUrl}`,
      `- account: ${account.username}`,
      `- pass: ${result.pass ? 'PASS' : 'FAIL'}`,
      `- hasProjectSyncText: ${result.hasProjectSyncText}`,
      `- memberCountVisible: ${result.memberCountVisible}`,
      `- deltas: ${JSON.stringify(result.deltas)}`,
      '',
      '## Text Sample',
      '',
      result.lastTextSample
    ].join('\n'));

    if (!result.pass) {
      throw new Error(`Right panel jitter check failed: ${JSON.stringify(result)}`);
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
