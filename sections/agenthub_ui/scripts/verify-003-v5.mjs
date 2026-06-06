import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'issues/screenshots/003-fixes/verify5';
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

  // Click the group
  const groupItem = d.locator('text=AgentHub 产品研发群').first();
  if (await groupItem.count() > 0) {
    await groupItem.click().catch(() => {});
    await d.waitForTimeout(500);
  }

  // Inject a reply message via the pinia store
  const injectResult = await d.evaluate(() => {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia || app?._context?.config?.globalProperties?.$pinia;
    if (!pinia) return { error: 'no pinia' };
    const messageStore = pinia._s.get('message');
    const conversationStore = pinia._s.get('conversation');
    if (!messageStore || !conversationStore) return { error: 'no stores' };

    // Find current group conversation
    const activeId = conversationStore.activeId || '2';
    const targetMsg = messageStore.messages[activeId]?.[0];
    if (!targetMsg) return { error: 'no target msg', activeId, msgs: messageStore.messages };

    // Send a reply message
    messageStore.sendMessage(
      activeId,
      'This is my quoted reply',
      { id: 'me', name: 'Me' },
      'text',
      {
        replyRef: {
          messageId: targetMsg.id,
          senderName: targetMsg.senderName,
          contentPreview: targetMsg.content?.slice(0, 60) || ''
        }
      }
    );
    return { success: true, activeId, replyContent: targetMsg.content?.slice(0, 30) };
  });
  console.log('Inject result:', JSON.stringify(injectResult));
  await d.waitForTimeout(500);
  await d.screenshot({ path: path.join(DIR, '01-with-reply.png') });

  // Check the reply ref
  const check = await d.evaluate(() => {
    const ref = document.querySelector('.reply-ref.reply-ref-me');
    if (!ref) return { exists: false };
    const r = ref.getBoundingClientRect();
    const bubble = document.querySelector('.message-bubble.bubble-me');
    const rb = bubble ? bubble.getBoundingClientRect() : null;
    return {
      exists: true,
      replyRef: { x: r.x, y: r.y, w: r.width, h: r.height },
      meBubble: rb ? { x: rb.x, y: rb.y, w: rb.width, h: rb.height } : null
    };
  });
  console.log('Check result:', JSON.stringify(check, null, 2));
  if (check.exists && check.meBubble) {
    const replyRefRight = check.replyRef.x + check.replyRef.w;
    const bubbleRight = check.meBubble.x + check.meBubble.w;
    const diff = Math.abs(replyRefRight - bubbleRight);
    record('Issue 3: reply-ref-me right aligns with me bubble (within 40px)', diff < 40, `diff=${Math.round(diff)}px`);
    record('Issue 3: reply-ref-me x >= me bubble x (right aligned)', check.replyRef.x >= check.meBubble.x - 10, `replyRef.x=${Math.round(check.replyRef.x)} meBubble.x=${Math.round(check.meBubble.x)}`);
  } else {
    record('Issue 3: reply ref test', false, `check=${JSON.stringify(check)}`);
  }

  // Also check that the overall reply-ref element is positioned on the right side
  // (the message-content-wrapper has align-items: flex-end for me)
  if (check.exists) {
    // The reply-ref should be on the right side of the chat area
    const onRightSide = check.replyRef.x > 600; // chat area starts after list (320) + sidebar (64) = ~384
    record('Issue 3: reply-ref visually on the right side', onRightSide, `x=${Math.round(check.replyRef.x)}`);
  }

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
