import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'issues/screenshots/003-fixes/verify4';
fs.mkdirSync(DIR, { recursive: true });

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail || ''}`);
}

const browser = await chromium.launch();
try {
  const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await ctxD.newPage();
  await d.goto('http://localhost:5173/#/pages/chat/index', { waitUntil: 'networkidle' });
  await d.waitForTimeout(800);

  // Get the active conversation id
  const convId = await d.evaluate(() => {
    const k = localStorage.getItem('active_conversation_id');
    return k;
  });
  console.log('Active conv id from storage:', convId);

  // Use the messageStore via window: send a message with replyRef directly
  const sent = await d.evaluate(async () => {
    // Try to access the message store via the pinia instance
    // Pinia stores are usually exposed via __VUE_DEVTOOLS_GLOBAL_HOOK__
    // but we can also reach them via app instance
    const app = document.querySelector('#app')?.__vue_app__;
    if (!app) return { error: 'no app' };
    const pinia = app.config.globalProperties.$pinia || app._context.config.globalProperties.$pinia;
    if (!pinia) return { error: 'no pinia' };
    const stores = Array.from(pinia._s.entries()).map(([k, v]) => ({ k, hasState: !!v.$state }));
    return { stores };
  });
  console.log('Stores:', JSON.stringify(sent));

  // Easier: just write a localStorage / Vuex-like message
  // The simplest way is to use the message input: but verify the quote UI is displayed
  // Let's look at the actual reply quote bar that appears in the input area
  await d.waitForTimeout(500);

  // Find an other user's message
  const msgBubble = d.locator('.message-bubble.bubble-other').first();
  const box = await msgBubble.boundingBox();
  if (box) {
    await d.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await d.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    await d.waitForTimeout(500);
    const ctxItems = await d.evaluate(() => {
      const el = document.querySelector('.msg-ctx-menu');
      if (!el) return [];
      return Array.from(el.querySelectorAll('.msg-ctx-item')).map(i => i.textContent.trim());
    });
    record('Context menu items', ctxItems.length >= 4, `items=${ctxItems.join('|')}`);

    // Click reply
    const replyItem = d.locator('.msg-ctx-item:has-text("引用消息")').first();
    if (await replyItem.count() > 0) {
      await replyItem.click().catch(() => {});
      await d.waitForTimeout(500);
    }
  }
  await d.screenshot({ path: path.join(DIR, '01-reply-set.png') });

  // Now check that the reply quote bar is in the input area
  const replyQuoteBar = await d.evaluate(() => {
    const bar = document.querySelector('.reply-quote-bar');
    if (!bar) return null;
    const r = bar.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  record('Reply quote bar shown in input area', replyQuoteBar && replyQuoteBar.y > 500, `pos=${JSON.stringify(replyQuoteBar)}`);

  // Now type and send the message
  // Try the uni-app textarea input
  const textarea = d.locator('textarea.input-textarea').first();
  await textarea.click();
  await d.waitForTimeout(200);
  // Use the keyboard
  await d.keyboard.type('Quote test');
  await d.waitForTimeout(200);
  // Now find send button
  const sendBtn = d.locator('.btn-send-msg').first();
  await sendBtn.click().catch(() => {});
  await d.waitForTimeout(800);
  await d.screenshot({ path: path.join(DIR, '02-after-send.png') });

  // Check reply-ref-me now exists
  const replyRefMe = await d.evaluate(() => {
    const el = document.querySelector('.reply-ref.reply-ref-me');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  if (replyRefMe) {
    // Compare with the corresponding me bubble
    const meBubble = await d.evaluate(() => {
      const els = document.querySelectorAll('.message-bubble.bubble-me');
      if (els.length === 0) return null;
      const last = els[els.length - 1];
      const r = last.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    if (meBubble) {
      const replyRefRight = replyRefMe.x + replyRefMe.w;
      const bubbleRight = meBubble.x + meBubble.w;
      const diff = Math.abs(replyRefRight - bubbleRight);
      record('Issue 3: reply-ref-me right edge aligns with me-bubble right edge (within 40px)', diff < 40, `diff=${Math.round(diff)}px replyRefRight=${Math.round(replyRefRight)} bubbleRight=${Math.round(bubbleRight)}`);
      // Also check it is positioned to the right side
      record('Issue 3: reply-ref-me is on right side (x >= me bubble x)', replyRefMe.x >= meBubble.x - 10, `replyRef.x=${Math.round(replyRefMe.x)} meBubble.x=${Math.round(meBubble.x)}`);
    } else {
      record('Issue 3: reply-ref-me exists', false, 'no me bubble found');
    }
  } else {
    record('Issue 3: reply-ref-me exists', false, 'no reply-ref-me found');
  }

  // Now look at the actual layout: take a focused screenshot
  await d.screenshot({ path: path.join(DIR, '03-final.png') });

  await ctxD.close();

  // Summary
  console.log('\n=== Summary ===');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`Passed: ${passed}/${results.length}, Failed: ${failed}`);
  fs.writeFileSync(path.join(DIR, 'results.json'), JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
