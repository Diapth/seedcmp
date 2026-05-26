const { chromium } = require('/media/leng/DiskB1/exp/seedcmp/sections/im_web/apps/chat/node_modules/@playwright/test');

const TARGET_URL = process.env.TARGET_URL || 'http://100.79.157.76:3000';
const OUT_DIR = '/media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/V2.0/issues/imgs/v2-24-ai-duplicate-sort-history-20260526';

function parsePayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'object') return payload;
  try {
    return JSON.parse(payload);
  } catch {
    try {
      return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    } catch {
      return {};
    }
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const syncRequests = [];
  const syncResponses = [];

  page.on('request', req => {
    if (req.url().includes('/v1/message/channel/sync')) {
      syncRequests.push({
        url: req.url(),
        postData: req.postDataJSON?.() || req.postData()
      });
    }
  });
  page.on('response', async resp => {
    if (resp.url().includes('/v1/message/channel/sync')) {
      syncResponses.push({
        url: resp.url(),
        status: resp.status(),
        json: await resp.json().catch(() => null)
      });
    }
  });

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
  await page.getByRole('button', { name: '联系人' }).click();
  await page.waitForSelector('.contact-list-container', { timeout: 10000 });
  await page.locator('.ai-robot-action').click();
  await page.waitForURL(/\/chat\/conversation\/deepseek_ai_robot\/1$/, { timeout: 10000 });
  await page.waitForSelector('.message-input-container', { timeout: 10000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT_DIR}/06-history-current.png`, fullPage: true });

  const domSummary = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.msg-row')).map(row => ({
      isMe: row.classList.contains('is-me'),
      text: row.textContent || '',
      markdown: row.querySelectorAll('.markdown-body').length
    }));
    return {
      totalRows: rows.length,
      userRows: rows.filter(row => row.isMe).length,
      aiRows: rows.filter(row => !row.isMe).length,
      aiMarkdownRows: rows.filter(row => !row.isMe && row.markdown > 0).length,
      rows
    };
  });

  const responseMessages = syncResponses.flatMap(item =>
    (Array.isArray(item.json?.messages) ? item.json.messages : []).map(msg => {
      const payload = parsePayload(msg.payload);
      return {
        message_id: msg.message_id,
        message_idstr: msg.message_idstr,
        message_seq: msg.message_seq,
        client_msg_no: msg.client_msg_no,
        from_uid: msg.from_uid,
        timestamp: msg.timestamp,
        text: payload.text || payload.content || '',
        ai: payload.ai === true,
        markdown: payload.markdown === true || payload.format === 'markdown'
      };
    })
  );

  console.log(JSON.stringify({
    currentUrl: page.url(),
    syncRequests,
    syncResponseCount: syncResponses.length,
    responseSummary: {
      totalMessages: responseMessages.length,
      userMessages: responseMessages.filter(item => item.from_uid !== 'deepseek_ai_robot').length,
      aiMessages: responseMessages.filter(item => item.from_uid === 'deepseek_ai_robot').length,
      aiMarkdownMessages: responseMessages.filter(item => item.from_uid === 'deepseek_ai_robot' && item.markdown).length,
      messages: responseMessages
    },
    domSummary
  }, null, 2));
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
