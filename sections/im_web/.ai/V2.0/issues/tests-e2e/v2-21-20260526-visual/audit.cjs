const { chromium } = require('/media/leng/DiskB1/exp/seedcmp/sections/im_web/apps/chat/node_modules/@playwright/test');

const TARGET_URL = process.env.TARGET_URL || 'http://100.79.157.76:3000';
const OUT_DIR = '/media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/V2.0/issues/imgs/v2-21-20260526-visual';

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
  await page.screenshot({ path: `${OUT_DIR}/02-chat-shell.png`, fullPage: true });

  const firstConversation = page.locator('.conversation-item').first();
  if (await firstConversation.isVisible().catch(() => false)) {
    await firstConversation.click();
  } else {
    await page.goto(`${TARGET_URL}/chat/conversation/u_10000/1`, { waitUntil: 'domcontentloaded' });
  }

  await page.waitForSelector('.message-input-container', { timeout: 15000 });
  await page.screenshot({ path: `${OUT_DIR}/03-message-input.png`, fullPage: true });

  const aiButtonVisible = await page.getByTitle('AI 助手回复').isVisible().catch(() => false);
  const voiceButtonVisible = await page.getByTitle('开始录音').isVisible().catch(() => false);
  const fileButtonVisible = await page.getByTitle('选择文件').isVisible().catch(() => false);

  await page.locator('.input-textarea').fill('请用 Markdown 列出两个测试点');
  const aiButton = page.getByTitle('AI 助手回复');
  const aiEnabledBeforeClick = await aiButton.isEnabled().catch(() => false);
  await page.screenshot({ path: `${OUT_DIR}/04-ai-ready.png`, fullPage: true });

  const result = {
    targetUrl: TARGET_URL,
    aiButtonVisible,
    aiEnabledBeforeClick,
    voiceButtonVisible,
    fileButtonVisible,
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
