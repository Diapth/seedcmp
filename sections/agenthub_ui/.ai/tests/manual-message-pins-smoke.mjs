import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.AGENTHUB_H5_URL || 'http://localhost:5173';
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const evidenceDir = path.resolve('.ai/tests-e2e', `manual-pins-${timestamp}`);
fs.mkdirSync(evidenceDir, { recursive: true });

const diagnostics = [];
const network = [];

function record(step, ok, detail = '') {
  diagnostics.push({ step, ok, detail, at: new Date().toISOString() });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[manual-pins] ${mark} ${step}${detail ? ` - ${detail}` : ''}`);
  if (!ok) throw new Error(`${step}${detail ? `: ${detail}` : ''}`);
}

async function waitForAny(locator, timeout = 10000) {
  const count = await locator.count().catch(() => 0);
  if (count > 0) return locator.first();
  await locator.first().waitFor({ state: 'visible', timeout });
  return locator.first();
}

async function openFirstMessageMenu(page) {
  const bubble = await waitForAny(page.locator('.message-bubble').filter({ hasText: /.+/ }), 15000);
  await bubble.click({ button: 'right' });
  await page.waitForSelector('.msg-ctx-menu', { state: 'visible', timeout: 5000 });
  return bubble;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('request', (req) => network.push({ type: 'request', method: req.method(), url: req.url() }));
  page.on('response', (res) => network.push({ type: 'response', status: res.status(), url: res.url() }));

  try {
    await page.goto(`${baseUrl}/#/pages/chat/index`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: path.join(evidenceDir, '00-chat-loaded.png'), fullPage: true });

    const firstConversation = page.locator('.conversation-item, .workbench-list text, .uni-list-item').first();
    if (await firstConversation.count().catch(() => 0)) {
      await firstConversation.click().catch(() => undefined);
    }

    const bubble = await openFirstMessageMenu(page);
    await page.screenshot({ path: path.join(evidenceDir, '01-menu-pin.png'), fullPage: true });
    record('message menu contains pin action', await page.getByText('Pin 为长期上下文').count() > 0);

    await page.getByText('Pin 为长期上下文').first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(evidenceDir, '02-badge-after-pin.png'), fullPage: true });
    record('pinned bubble badge is visible', await page.getByText('长期上下文').count() > 0);

    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(evidenceDir, '03-refresh-pin-list.png'), fullPage: true });
    record('pinned context list persists after refresh', await page.getByText('长期上下文').count() > 0);

    await openFirstMessageMenu(page);
    record('message menu contains unpin action', await page.getByText('取消长期上下文 pin').count() > 0);
    await page.getByText('取消长期上下文 pin').first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(evidenceDir, '05-unpin-removed.png'), fullPage: true });

    await browser.close();
  } catch (err) {
    await page.screenshot({ path: path.join(evidenceDir, 'error.png'), fullPage: true }).catch(() => undefined);
    await browser.close().catch(() => undefined);
    throw err;
  } finally {
    fs.writeFileSync(path.join(evidenceDir, 'diagnostics.log'), diagnostics.map((item) => JSON.stringify(item)).join('\n'));
    fs.writeFileSync(path.join(evidenceDir, 'network.json'), JSON.stringify(network, null, 2));
  }
}

run().catch((err) => {
  console.error(`[manual-pins] ${err.stack || err.message}`);
  process.exit(1);
});
