const fs = require('fs');
const { chromium } = require('/media/leng/DiskB1/exp/seedcmp/sections/im_web/apps/chat/node_modules/@playwright/test');

const TARGET_URL = process.env.TARGET_URL || 'http://100.79.157.76:3000';
const OUT_DIR = '/media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/V2.0/issues/imgs/v2-24-ai-duplicate-sort-history-20260526';

fs.mkdirSync(OUT_DIR, { recursive: true });

async function loginIfNeeded(page) {
  await page.goto(`${TARGET_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  const phone = page.getByPlaceholder(/手机号|账号|username/i);
  const password = page.getByPlaceholder(/密码|password/i);
  if (await phone.isVisible().catch(() => false)) {
    await phone.fill(process.env.IM_WEB_USER || '18337488675');
    await password.fill(process.env.IM_WEB_PASSWORD || '123456');
    await page.getByRole('button', { name: /登录|安全登录|login/i }).click();
    await page.waitForURL(/\/chat/, { timeout: 15000 }).catch(() => {});
  }
  await page.waitForSelector('.main-layout', { timeout: 15000 });
}

async function openDeepSeek(page) {
  await page.getByRole('button', { name: '联系人' }).click();
  await page.waitForSelector('.contact-list-container', { timeout: 10000 });
  await page.locator('.ai-robot-action').click();
  await page.waitForURL(/\/chat\/conversation\/deepseek_ai_robot\/1$/, { timeout: 10000 });
  await page.waitForSelector('.message-input-container', { timeout: 10000 });
}

function normalizeRenderedText(text) {
  return String(text || '').replace(/^D/, '').trim();
}

async function snapshot(page, markers) {
  return page.evaluate((values) => {
    const normalizeRenderedText = (text) => String(text || '').replace(/^D/, '').trim();
    const rows = Array.from(document.querySelectorAll('.msg-row')).map((row) => ({
      text: row.textContent || '',
      normalizedText: normalizeRenderedText(row.textContent || ''),
      isMe: row.classList.contains('is-me'),
      markdownCount: row.querySelectorAll('.markdown-body').length
    }));
    const byMarker = {};
    for (const marker of values) {
      const markerRows = rows.filter(row => row.text.includes(marker));
      const exactAiRows = markerRows.filter(row => !row.isMe && row.normalizedText === marker);
      const userIndexes = rows
        .map((row, index) => ({ row, index }))
        .filter(item => item.row.isMe && item.row.text.includes(marker))
        .map(item => item.index);
      const aiIndexes = rows
        .map((row, index) => ({ row, index }))
        .filter(item => !item.row.isMe && item.row.text.includes(marker))
        .map(item => item.index);
      byMarker[marker] = {
        userRows: markerRows.filter(row => row.isMe).length,
        aiRows: markerRows.filter(row => !row.isMe).length,
        exactAiRows: exactAiRows.length,
        exactAiMarkdownRows: exactAiRows.filter(row => row.markdownCount > 0).length,
        aiMarkdownRows: markerRows.filter(row => !row.isMe && row.markdownCount > 0).length,
        userIndexes,
        aiIndexes,
        orderOk: userIndexes.length > 0 &&
          aiIndexes.length > 0 &&
          Math.min(...userIndexes) < Math.max(...aiIndexes),
        aiTexts: markerRows.filter(row => !row.isMe).map(row => row.normalizedText)
      };
    }
    return {
      totalRows: rows.length,
      aiRows: rows.filter(row => !row.isMe).length,
      aiMarkdownRows: rows.filter(row => !row.isMe && row.markdownCount > 0).length,
      duplicateAiTexts: Object.entries(rows
        .filter(row => !row.isMe)
        .reduce((acc, row) => {
          acc[row.normalizedText] = (acc[row.normalizedText] || 0) + 1;
          return acc;
        }, {}))
        .filter(([, count]) => count > 1)
        .map(([text, count]) => ({ text, count })),
      byMarker,
      rows
    };
  }, markers);
}

async function sendPrompt(page, marker) {
  const input = page.locator('.input-textarea');
  await input.fill(`请只回复这一行 Markdown：**${marker}**`);
  const aiResponsePromise = page.waitForResponse(resp => resp.url().includes('/v1/robot/ai_reply'), { timeout: 60000 });
  await page.getByRole('button', { name: '发送消息' }).click();
  await page.waitForFunction(() => {
    const el = document.querySelector('.input-textarea');
    return el && el.value === '';
  }, null, { timeout: 5000 });
  await page.waitForFunction((value) => {
    return Array.from(document.querySelectorAll('.msg-row'))
      .some(row => row.classList.contains('is-me') && (row.textContent || '').includes(value));
  }, marker, { timeout: 15000 });
  const aiResponse = await aiResponsePromise;
  await aiResponse.finished().catch(() => null);
  await page.waitForFunction((value) => {
    return Array.from(document.querySelectorAll('.msg-row'))
      .some(row => !row.classList.contains('is-me') && (row.textContent || '').includes(value));
  }, marker, { timeout: 60000 });
  await page.waitForTimeout(1800);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const consoleMessages = [];
  const failedRequests = [];
  const failedResponses = [];
  const syncResponses = [];

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
    if (url.includes('/v1/message/channel/sync')) {
      const reqBody = response.request().postDataJSON?.() || {};
      if (reqBody.channel_id === 'deepseek_ai_robot') {
        const json = await response.json().catch(() => null);
        syncResponses.push({
          status: response.status(),
          request: reqBody,
          messageCount: Array.isArray(json?.messages) ? json.messages.length : 0,
          aiCount: Array.isArray(json?.messages)
            ? json.messages.filter(msg => msg.from_uid === 'deepseek_ai_robot').length
            : 0
        });
      }
    }
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${url}`);
    }
  });

  await loginIfNeeded(page);
  await openDeepSeek(page);
  await page.screenshot({ path: `${OUT_DIR}/06-multi-before.png`, fullPage: true });

  const markers = [
    `V2-24-history-a-${Date.now()}`,
    `V2-24-history-b-${Date.now()}`
  ];

  const before = await snapshot(page, markers);
  await sendPrompt(page, markers[0]);
  const afterFirst = await snapshot(page, markers);
  await page.screenshot({ path: `${OUT_DIR}/07-multi-after-first.png`, fullPage: true });

  await sendPrompt(page, markers[1]);
  const afterSecond = await snapshot(page, markers);
  await page.screenshot({ path: `${OUT_DIR}/08-multi-after-second.png`, fullPage: true });

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('.message-input-container', { timeout: 15000 });
  for (const marker of markers) {
    await page.waitForFunction((value) => document.body.innerText.includes(value), marker, { timeout: 60000 });
  }
  await page.waitForTimeout(1800);
  const afterRefresh = await snapshot(page, markers);
  await page.screenshot({ path: `${OUT_DIR}/09-multi-after-refresh.png`, fullPage: true });

  const markerChecks = Object.values(afterRefresh.byMarker);
  const result = {
    targetUrl: TARGET_URL,
    currentUrl: page.url(),
    markers,
    before: {
      totalRows: before.totalRows,
      aiRows: before.aiRows,
      aiMarkdownRows: before.aiMarkdownRows
    },
    afterFirst: afterFirst.byMarker,
    afterSecond: afterSecond.byMarker,
    afterRefresh: {
      totalRows: afterRefresh.totalRows,
      aiRows: afterRefresh.aiRows,
      aiMarkdownRows: afterRefresh.aiMarkdownRows,
      duplicateAiTexts: afterRefresh.duplicateAiTexts,
      byMarker: afterRefresh.byMarker
    },
    syncResponses,
    consoleMessages,
    failedRequests,
    failedResponses
  };

  console.log(JSON.stringify(result, null, 2));

  const relevantFailures = failedResponses.filter(item =>
    item.includes('/robot/ai_reply') ||
    item.includes('/message/channel/sync') ||
    item.includes('/channels/deepseek_ai_robot/1')
  );
  const passed =
    markerChecks.length === markers.length &&
    markerChecks.every(check =>
      check.userRows === 1 &&
      check.aiRows >= 1 &&
      check.aiMarkdownRows === check.aiRows &&
      check.orderOk === true
    ) &&
    afterRefresh.aiRows >= 2 &&
    afterRefresh.aiMarkdownRows >= 2 &&
    afterRefresh.aiRows === afterRefresh.aiMarkdownRows &&
    afterRefresh.duplicateAiTexts.length === 0 &&
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
