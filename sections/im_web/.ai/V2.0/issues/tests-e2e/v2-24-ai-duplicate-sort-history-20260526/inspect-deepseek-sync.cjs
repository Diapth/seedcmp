const { chromium } = require('/media/leng/DiskB1/exp/seedcmp/sections/im_web/apps/chat/node_modules/@playwright/test');

const TARGET_URL = process.env.TARGET_URL || 'http://100.79.157.76:3000';

function parsePayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'object') return payload;
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  const deepseekSyncs = [];

  page.on('request', req => {
    if (!req.url().includes('/v1/message/channel/sync')) return;
    const body = req.postDataJSON?.() || {};
    if (body.channel_id !== 'deepseek_ai_robot') return;
    deepseekSyncs.push({ request: body, response: null });
  });
  page.on('response', async resp => {
    if (!resp.url().includes('/v1/message/channel/sync')) return;
    const req = resp.request();
    const body = req.postDataJSON?.() || {};
    if (body.channel_id !== 'deepseek_ai_robot') return;
    const json = await resp.json().catch(() => null);
    const record = deepseekSyncs.find(item => item.request === body && item.response === null) ||
      deepseekSyncs.find(item => JSON.stringify(item.request) === JSON.stringify(body) && item.response === null);
    const messages = (Array.isArray(json?.messages) ? json.messages : []).map(msg => {
      const payload = parsePayload(msg.payload);
      return {
        message_idstr: msg.message_idstr,
        message_seq: msg.message_seq,
        client_msg_no: msg.client_msg_no,
        from_uid: msg.from_uid,
        timestamp: msg.timestamp,
        text: payload.text || payload.content || '',
        ai: payload.ai === true,
        markdown: payload.markdown === true || payload.format === 'markdown'
      };
    });
    const response = {
      status: resp.status(),
      start_message_seq: json?.start_message_seq,
      end_message_seq: json?.end_message_seq,
      pull_mode: json?.pull_mode,
      more: json?.more,
      messageCount: messages.length,
      aiCount: messages.filter(item => item.from_uid === 'deepseek_ai_robot').length,
      userCount: messages.filter(item => item.from_uid !== 'deepseek_ai_robot').length,
      messages
    };
    if (record) record.response = response;
    else deepseekSyncs.push({ request: body, response });
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

  const dom = await page.evaluate(() => Array.from(document.querySelectorAll('.msg-row')).map(row => ({
    isMe: row.classList.contains('is-me'),
    text: row.textContent || '',
    markdown: row.querySelectorAll('.markdown-body').length
  })));

  console.log(JSON.stringify({ deepseekSyncs, dom }, null, 2));
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
