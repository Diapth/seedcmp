const { chromium } = require('/media/leng/DiskB1/exp/seedcmp/sections/im_web/apps/chat/node_modules/@playwright/test');

const TARGET_URL = process.env.TARGET_URL || 'http://100.79.157.76:3000';
const OUT_DIR = '/media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/V2.0/issues/imgs/v2-24-ai-duplicate-sort-history-20260526';

async function snapshotRows(page, marker) {
  return page.evaluate((value) => {
    const rows = Array.from(document.querySelectorAll('.msg-row')).map((row) => {
      const text = row.textContent || '';
      return {
        text,
        isMe: row.classList.contains('is-me'),
        hasMarker: text.includes(value),
        markdownCount: row.querySelectorAll('.markdown-body').length,
        bubbleCount: row.querySelectorAll('.bubble').length
      };
    });
    return {
      totalRows: rows.length,
      markerRows: rows.filter(row => row.hasMarker),
      userMarkerRows: rows.filter(row => row.hasMarker && row.isMe),
      aiMarkerRows: rows.filter(row => row.hasMarker && !row.isMe),
      rows
    };
  }, marker);
}

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
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/v1/robot/ai_reply')) {
      aiResponses.push(`${response.status()} ${url} ${response.headers()['content-type'] || ''}`);
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
  await page.locator('.ai-robot-action').click();
  await page.waitForURL(/\/chat\/conversation\/deepseek_ai_robot\/1$/, { timeout: 10000 });
  await page.waitForSelector('.message-input-container', { timeout: 10000 });
  await page.screenshot({ path: `${OUT_DIR}/02-deepseek-before-send.png`, fullPage: true });

  const initialRows = await snapshotRows(page, '__never__');
  const marker = `V2-24-${Date.now()}`;
  const prompt = `请只回复这一行 Markdown：**${marker}**`;
  const input = page.locator('.input-textarea');
  await input.fill(prompt);
  const aiResponsePromise = page.waitForResponse(resp => resp.url().includes('/v1/robot/ai_reply'), { timeout: 60000 });
  await page.getByRole('button', { name: '发送消息' }).click();

  await page.waitForFunction(() => {
    const el = document.querySelector('.input-textarea');
    return el && el.value === '';
  }, null, { timeout: 5000 });

  await page.waitForFunction((value) => {
    const rows = Array.from(document.querySelectorAll('.msg-row'));
    return rows.some(row => row.classList.contains('is-me') && (row.textContent || '').includes(value));
  }, marker, { timeout: 15000 });
  const duringStream = await snapshotRows(page, marker);
  await page.screenshot({ path: `${OUT_DIR}/03-during-stream.png`, fullPage: true });

  const aiResponse = await aiResponsePromise;
  await aiResponse.finished().catch(() => null);
  await page.waitForFunction((value) => {
    const rows = Array.from(document.querySelectorAll('.msg-row'));
    return rows.some(row => !row.classList.contains('is-me') && (row.textContent || '').includes(value));
  }, marker, { timeout: 60000 });
  await page.waitForTimeout(2500);
  const afterComplete = await snapshotRows(page, marker);
  await page.screenshot({ path: `${OUT_DIR}/04-after-complete.png`, fullPage: true });

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('.message-input-container', { timeout: 15000 });
  await page.waitForFunction((value) => document.body.innerText.includes(value), marker, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const afterRefresh = await snapshotRows(page, marker);
  await page.screenshot({ path: `${OUT_DIR}/05-after-refresh.png`, fullPage: true });

  const relevantFailures = failedResponses.filter(item =>
    item.includes('/robot/ai_reply') ||
    item.includes('/message/channel/sync') ||
    item.includes('/channels/deepseek_ai_robot/1')
  );
  const result = {
    targetUrl: TARGET_URL,
    currentUrl: page.url(),
    marker,
    initialRows: initialRows.totalRows,
    inputCleared: await input.inputValue().catch(() => '') === '',
    duringStream: {
      userMarkerRows: duringStream.userMarkerRows.length,
      aiMarkerRows: duringStream.aiMarkerRows.length,
      aiMarkdownRows: duringStream.aiMarkerRows.filter(row => row.markdownCount > 0).length
    },
    afterComplete: {
      userMarkerRows: afterComplete.userMarkerRows.length,
      aiMarkerRows: afterComplete.aiMarkerRows.length,
      aiMarkdownRows: afterComplete.aiMarkerRows.filter(row => row.markdownCount > 0).length,
      totalRows: afterComplete.totalRows
    },
    afterRefresh: {
      userMarkerRows: afterRefresh.userMarkerRows.length,
      aiMarkerRows: afterRefresh.aiMarkerRows.length,
      aiMarkdownRows: afterRefresh.aiMarkerRows.filter(row => row.markdownCount > 0).length,
      totalRows: afterRefresh.totalRows
    },
    aiResponses,
    consoleMessages,
    failedRequests,
    failedResponses,
    relevantFailures
  };
  console.log(JSON.stringify(result, null, 2));

  const passed =
    result.inputCleared &&
    result.duringStream.userMarkerRows === 1 &&
    result.duringStream.aiMarkerRows <= 1 &&
    result.afterComplete.userMarkerRows === 1 &&
    result.afterComplete.aiMarkerRows === 1 &&
    result.afterComplete.aiMarkdownRows === 1 &&
    result.afterRefresh.userMarkerRows === 1 &&
    result.afterRefresh.aiMarkerRows === 1 &&
    result.afterRefresh.aiMarkdownRows === 1 &&
    result.afterRefresh.totalRows >= initialRows.totalRows &&
    relevantFailures.length === 0 &&
    failedRequests.length === 0;

  if (!passed) {
    process.exitCode = 1;
  }
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
