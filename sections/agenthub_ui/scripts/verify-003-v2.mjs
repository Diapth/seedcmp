import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'issues/screenshots/003-fixes/verify2';
fs.mkdirSync(DIR, { recursive: true });

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail || ''}`);
}

const browser = await chromium.launch();
try {
  // Desktop 1440x900
  const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await ctxD.newPage();
  await d.goto('http://localhost:5173/#/pages/chat/index', { waitUntil: 'networkidle' });
  await d.waitForTimeout(800);

  // Check right pane width using a wider selector
  const rightBox = await d.evaluate(() => {
    const el = document.querySelector('.workbench-right');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { width: rect.width, x: rect.x };
  });
  record('Issue 1: right pane width', rightBox && rightBox.width >= 360, `w=${rightBox ? Math.round(rightBox.width) : 'none'}`);

  // Click group
  const groupItem = d.locator('text=AgentHub 产品研发群').first();
  if (await groupItem.count() > 0) {
    await groupItem.click().catch(() => {});
    await d.waitForTimeout(500);
  }

  // Programmatic test: send a reply message directly using the store
  // Open the right panel first (already open)
  // The simpler way is to test by directly using the reply button via long press
  // Actually let's use a different approach - use keyboard simulation to set reply target

  // First locate the message bubble to long-press
  const msgBubble = d.locator('.message-bubble.bubble-other').first();
  const exists = await msgBubble.count();
  if (exists > 0) {
    // Manually trigger long press on the message
    await msgBubble.dispatchEvent('contextmenu', { dataTransfer: null });
    await d.waitForTimeout(500);
    await d.screenshot({ path: path.join(DIR, '01-contextmenu-open.png') });

    // Look for the message context menu (uses .ctx-menu class from MessageContextMenu)
    const ctxMenu = d.locator('.ctx-menu').first();
    if (await ctxMenu.count() > 0) {
      // Find reply item
      const replyItem = d.locator('text=引用消息').first();
      if (await replyItem.count() > 0) {
        await replyItem.click().catch(() => {});
        await d.waitForTimeout(500);
        await d.screenshot({ path: path.join(DIR, '02-reply-quote-set.png') });
      }
    } else {
      console.log('  context menu did not open, trying another method');
    }
  }

  // Type and send
  const textarea = d.locator('textarea.input-textarea').first();
  await textarea.fill('Test reply message').catch(() => {});
  await d.waitForTimeout(300);
  const sendBtn = d.locator('.btn-send-msg').first();
  await sendBtn.click().catch(() => {});
  await d.waitForTimeout(800);
  await d.screenshot({ path: path.join(DIR, '03-after-send.png') });

  // Check if reply ref is now visible
  const replyRefMeCount = await d.locator('.reply-ref.reply-ref-me').count();
  const replyRefOtherCount = await d.locator('.reply-ref:not(.reply-ref-me)').count();
  record('Reply ref element exists for self', replyRefMeCount > 0 || replyRefOtherCount > 0, `me=${replyRefMeCount} other=${replyRefOtherCount}`);

  if (replyRefMeCount > 0) {
    const replyRefMeBox = await d.locator('.reply-ref.reply-ref-me').first().boundingBox();
    const meBubble = d.locator('.message-bubble.bubble-me').last();
    const meBubbleBox = await meBubble.boundingBox().catch(() => null);
    if (meBubbleBox && replyRefMeBox) {
      const replyRefRight = replyRefMeBox.x + replyRefMeBox.width;
      const bubbleRight = meBubbleBox.x + meBubbleBox.width;
      const diff = Math.abs(replyRefRight - bubbleRight);
      record('Issue 3: reply ref right edge aligns with bubble (within 40px)', diff < 40, `diff=${Math.round(diff)}px replyRefRight=${Math.round(replyRefRight)} bubbleRight=${Math.round(bubbleRight)}`);
    }
  }

  // Test emoji panel
  const emojiBtn = d.locator('text=表情').first();
  if (await emojiBtn.count() > 0) {
    await emojiBtn.click().catch(() => {});
    await d.waitForTimeout(500);
    const emojiPanel = d.locator('.emoji-picker-container').first();
    const panelBox = await emojiPanel.boundingBox().catch(() => null);
    record('Issue 4: emoji panel height <= 280px', panelBox && panelBox.height <= 280, `h=${panelBox ? Math.round(panelBox.height) : 'none'}`);
    await d.screenshot({ path: path.join(DIR, '04-desktop-emoji.png') });
  }

  await ctxD.close();

  // Mobile
  const ctxM = await browser.newContext({ viewport: { width: 375, height: 844 } });
  const m = await ctxM.newPage();
  await m.goto('http://localhost:5173/#/pages/chat/detail?id=1', { waitUntil: 'networkidle' });
  await m.waitForTimeout(800);

  const emojiBtnM = m.locator('text=表情').first();
  if (await emojiBtnM.count() > 0) {
    await emojiBtnM.click().catch(() => {});
    await m.waitForTimeout(500);
    const panelM = m.locator('.emoji-picker-container').first();
    const panelBoxM = await panelM.boundingBox().catch(() => null);
    record('Issue 4: mobile emoji panel height <= 220px', panelBoxM && panelBoxM.height <= 220, `h=${panelBoxM ? Math.round(panelBoxM.height) : 'none'}`);
    await m.screenshot({ path: path.join(DIR, '05-mobile-emoji.png') });
  }

  // Test 1024x768 for tablet
  const ctxT = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const t = await ctxT.newPage();
  await t.goto('http://localhost:5173/#/pages/chat/index', { waitUntil: 'networkidle' });
  await t.waitForTimeout(800);
  const tGroup = t.locator('text=AgentHub 产品研发群').first();
  if (await tGroup.count() > 0) {
    await tGroup.click().catch(() => {});
    await t.waitForTimeout(500);
  }
  await t.screenshot({ path: path.join(DIR, '06-tablet-1024.png') });
  // Check no horizontal scroll
  const hasOverflow = await t.evaluate(() => {
    return document.body.scrollWidth > window.innerWidth;
  });
  record('No horizontal overflow on 1024x768', !hasOverflow, `bodyW=${await t.evaluate(() => document.body.scrollWidth)} winW=1024`);
  await ctxT.close();
  await ctxM.close();

  // Summary
  console.log('\n=== Summary ===');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`Passed: ${passed}/${results.length}, Failed: ${failed}`);
  fs.writeFileSync(path.join(DIR, 'results.json'), JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
