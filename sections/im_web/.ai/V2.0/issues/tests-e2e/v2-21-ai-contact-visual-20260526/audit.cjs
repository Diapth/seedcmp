const { chromium } = require('/media/leng/DiskB1/exp/seedcmp/sections/im_web/apps/chat/node_modules/@playwright/test');

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const OUT_DIR = '/media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/V2.0/issues/imgs/v2-21-ai-contact-visual-20260526';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const consoleMessages = [];
  const failedRequests = [];
  const failedResponses = [];

  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on('requestfailed', req => {
    failedRequests.push(`${req.method()} ${req.url()} ${req.failure()?.errorText || ''}`);
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto(`${TARGET_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.screenshot({ path: `${OUT_DIR}/01-login.png`, fullPage: true });

  const phone = page.getByPlaceholder(/手机号|账号|username/i);
  const password = page.getByPlaceholder(/密码|password/i);
  if (await phone.isVisible().catch(() => false)) {
    await phone.fill(process.env.IM_WEB_USER || '18337488675');
    await password.fill(process.env.IM_WEB_PASSWORD || '123456');
    await page.getByRole('button', { name: /登录|安全登录|login/i }).click();
    await page.waitForURL(/\/chat/, { timeout: 15000 }).catch(() => {});
  }

  await page.waitForSelector('.main-layout', { timeout: 15000 });
  await page.getByRole('button', { name: '联系人' }).click();
  await page.waitForSelector('.contact-list-container', { timeout: 10000 });
  await page.screenshot({ path: `${OUT_DIR}/02-contacts.png`, fullPage: true });

  const deepSeekContact = page.getByText('DeepSeek AI', { exact: true });
  const deepSeekVisible = await deepSeekContact.isVisible().catch(() => false);
  if (deepSeekVisible) {
    await deepSeekContact.click();
  }

  await page.waitForURL(/\/chat\/conversation\/u_10000\/1\?robot=deepseek/, { timeout: 10000 }).catch(() => {});
  await page.waitForSelector('.message-input-container', { timeout: 10000 });
  await page.screenshot({ path: `${OUT_DIR}/03-deepseek-conversation.png`, fullPage: true });

  const aiPanelVisible = await page.getByText('发送消息后自动由 AI 回复').isVisible().catch(() => false);
  const aiContactEnabledVisible = await page.getByText('AI 联系人已启用').isVisible().catch(() => false);
  const url = page.url();

  await page.locator('.input-textarea').fill('请用 Markdown 回复一行测试内容');
  await page.screenshot({ path: `${OUT_DIR}/04-deepseek-ready-to-send.png`, fullPage: true });

  const result = {
    targetUrl: TARGET_URL,
    currentUrl: url,
    deepSeekVisible,
    aiPanelVisible,
    aiContactEnabledVisible,
    consoleMessages,
    failedRequests,
    failedResponses
  };
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
