const { chromium } = require('/media/leng/DiskB1/exp/seedcmp/sections/im_web/apps/chat/node_modules/@playwright/test');

const TARGET_URL = process.env.TARGET_URL || 'http://100.79.157.76:3000';
const OUT_DIR = '/media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/V2.0/issues/imgs/v2-22-robot-ai-visual-20260526';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const consoleMessages = [];
  const failedRequests = [];
  const failedResponses = [];
  const aiResponses = [];

  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on('requestfailed', req => {
    failedRequests.push(`${req.method()} ${req.url()} ${req.failure()?.errorText || ''}`);
  });
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/v1/robot/ai_reply')) {
      aiResponses.push(`${response.status()} ${response.headers()['content-type'] || ''}`);
    }
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${url}`);
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

  const deepSeekRow = page.locator('.ai-robot-action');
  const deepSeekVisible = await page.getByText('DeepSeek AI', { exact: true }).isVisible().catch(() => false);
  const robotTagVisible = await deepSeekRow.getByText('机器人', { exact: true }).isVisible().catch(() => false);
  await deepSeekRow.click();

  await page.waitForURL(/\/chat\/conversation\/deepseek_ai_robot\/1$/, { timeout: 10000 });
  await page.waitForSelector('.message-input-container', { timeout: 10000 });
  await page.waitForResponse(resp => resp.url().includes('/v1/channels/deepseek_ai_robot/1'), { timeout: 10000 }).catch(() => null);
  await page.screenshot({ path: `${OUT_DIR}/03-deepseek-conversation.png`, fullPage: true });

  const aiPanelVisible = await page.getByText('发送消息后自动由 AI 回复').isVisible().catch(() => false);
  const input = page.locator('.input-textarea');
  const prompt = `请用 Markdown 回复两个短测试点 ${Date.now()}`;
  await input.fill(prompt);
  await page.screenshot({ path: `${OUT_DIR}/04-before-send.png`, fullPage: true });
  await page.getByRole('button', { name: '发送消息' }).click();

  await page.waitForFunction(() => {
    const el = document.querySelector('.input-textarea');
    return el && el.value === '';
  }, null, { timeout: 5000 });
  await page.waitForResponse(resp => resp.url().includes('/v1/robot/ai_reply'), { timeout: 45000 }).catch(() => null);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT_DIR}/05-after-send-stream.png`, fullPage: true });

  const inputCleared = await input.inputValue() === '';
  const hasMarkdownReply = await page.locator('.markdown-body').count();
  const currentUrl = page.url();
  const relevantFailures = failedResponses.filter(item =>
    item.includes('/channels/deepseek_ai_robot/1') ||
    item.includes('/coversation/clearUnread') ||
    item.includes('/robot/ai_reply')
  );

  const result = {
    targetUrl: TARGET_URL,
    currentUrl,
    deepSeekVisible,
    robotTagVisible,
    aiPanelVisible,
    inputCleared,
    hasMarkdownReply,
    aiResponses,
    consoleMessages,
    failedRequests,
    failedResponses,
    relevantFailures
  };
  console.log(JSON.stringify(result, null, 2));

  if (!deepSeekVisible || !robotTagVisible || !aiPanelVisible || !inputCleared || relevantFailures.length > 0) {
    process.exitCode = 1;
  }
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
