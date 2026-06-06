import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'issues/screenshots/003-fixes/verify3';
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
  const groupItem = d.locator('text=AgentHub 产品研发群').first();
  if (await groupItem.count() > 0) {
    await groupItem.click().catch(() => {});
    await d.waitForTimeout(800);
  }

  // Issue 1: right pane width
  const rightBox = await d.evaluate(() => {
    const el = document.querySelector('.workbench-right');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width;
  });
  record('Issue 1: right pane width >= 360px', rightBox && rightBox >= 360, `w=${rightBox}`);

  // Find a message and trigger contextmenu via right click
  const msgBubble = d.locator('.message-bubble.bubble-other').first();
  if (await msgBubble.count() > 0) {
    const box = await msgBubble.boundingBox();
    if (box) {
      // Playwright's right click
      await d.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await d.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
      await d.waitForTimeout(500);
      const ctxMenu = await d.evaluate(() => {
        const el = document.querySelector('.msg-ctx-menu');
        if (!el) return null;
        return { items: Array.from(el.querySelectorAll('.msg-ctx-item')).map(i => i.textContent.trim()) };
      });
      record('Message context menu opens on right-click', ctxMenu && ctxMenu.items && ctxMenu.items.length > 0, `items=${ctxMenu ? ctxMenu.items.join('|') : 'none'}`);

      if (ctxMenu) {
        // Click reply
        const replyItem = d.locator('.msg-ctx-item:has-text("引用消息")').first();
        if (await replyItem.count() > 0) {
          await replyItem.click().catch(() => {});
          await d.waitForTimeout(500);
          // Type message
          const textarea = d.locator('textarea.input-textarea').first();
          await textarea.fill('Test reply alignment').catch(() => {});
          await d.waitForTimeout(200);
          const sendBtn = d.locator('.btn-send-msg').first();
          await sendBtn.click().catch(() => {});
          await d.waitForTimeout(800);
        }
      }
    }
  }
  await d.screenshot({ path: path.join(DIR, '01-after-reply.png') });

  // Check reply-ref-me alignment
  const replyAlignment = await d.evaluate(() => {
    const replyRef = document.querySelector('.reply-ref.reply-ref-me');
    const meBubble = document.querySelector('.message-bubble.bubble-me');
    if (!replyRef || !meBubble) return { exists: false };
    const rr = replyRef.getBoundingClientRect();
    const mb = meBubble.getBoundingClientRect();
    const replyRefRight = rr.x + rr.width;
    const bubbleRight = mb.x + mb.width;
    return {
      exists: true,
      replyRefRight,
      bubbleRight,
      diff: Math.abs(replyRefRight - bubbleRight),
      // Also check that replyRef x is greater than or equal to meBubble x
      replyRefX: rr.x,
      meBubbleX: mb.x
    };
  });
  if (replyAlignment.exists) {
    record('Issue 3: reply ref right edge aligns with bubble (within 40px)', replyAlignment.diff < 40, `diff=${Math.round(replyAlignment.diff)}px`);
    record('Issue 3: reply ref on the right side (x >= me bubble x)', replyAlignment.replyRefX >= replyAlignment.meBubbleX - 5, `replyRef.x=${Math.round(replyAlignment.replyRefX)} meBubble.x=${Math.round(replyAlignment.meBubbleX)}`);
  } else {
    record('Issue 3: reply ref alignment', false, 'no reply-ref-me found');
  }

  // Test emoji panel - on desktop
  const emojiBtn = d.locator('text=表情').first();
  if (await emojiBtn.count() > 0) {
    await emojiBtn.click().catch(() => {});
    await d.waitForTimeout(500);
    const emojiPanelBox = await d.evaluate(() => {
      const el = document.querySelector('.emoji-picker-container');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    record('Issue 4: desktop emoji panel height <= 280px', emojiPanelBox && emojiPanelBox.h <= 280, `h=${emojiPanelBox ? Math.round(emojiPanelBox.h) : 'none'}`);
    await d.screenshot({ path: path.join(DIR, '02-desktop-emoji.png') });
  }

  // Check that desktop emoji panel does NOT cover the messages
  const coversCheck = await d.evaluate(() => {
    const panel = document.querySelector('.emoji-picker-container');
    if (!panel) return null;
    const r = panel.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  if (coversCheck) {
    // It should be at the bottom area, not covering middle messages
    const isInBottomHalf = coversCheck.y > 400;
    record('Issue 4: emoji panel positioned in bottom half (not covering messages)', isInBottomHalf, `y=${Math.round(coversCheck.y)} h=${Math.round(coversCheck.h)}`);
  }

  await ctxD.close();

  // Mobile
  const ctxM = await browser.newContext({ viewport: { width: 375, height: 844 } });
  const m = await ctxM.newPage();
  await m.goto('http://localhost:5173/#/pages/chat/detail?id=1', { waitUntil: 'networkidle' });
  await m.waitForTimeout(800);

  // Mobile emoji
  const emojiBtnM = m.locator('text=表情').first();
  if (await emojiBtnM.count() > 0) {
    await emojiBtnM.click().catch(() => {});
    await m.waitForTimeout(500);
    const mobileEmojiBox = await m.evaluate(() => {
      const el = document.querySelector('.emoji-picker-container');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    record('Issue 4: mobile emoji panel height <= 220px', mobileEmojiBox && mobileEmojiBox.h <= 220, `h=${mobileEmojiBox ? Math.round(mobileEmojiBox.h) : 'none'}`);
    await m.screenshot({ path: path.join(DIR, '03-mobile-emoji.png') });
  }

  // Test file preview page
  const ctxP = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctxP.newPage();
  const fileParam = encodeURIComponent(JSON.stringify({
    name: 'Test.docx',
    fileName: 'Test.docx',
    fileSize: '2.5 MB',
    fileType: 'docx',
    previewContent: 'Test preview content for verification.\n\nThis should render in the file preview page.'
  }));
  await p.goto(`http://localhost:5173/#/pages/files/preview?file=${fileParam}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(DIR, '04-file-preview.png') });

  // Check no sidebar visible (replaced by spacer)
  const previewInfo = await p.evaluate(() => {
    const sidebar = document.querySelector('.desktop-sidebar-spacer');
    const desktopSidebar = document.querySelector('.desktop-sidebar');
    return {
      hasSpacer: !!sidebar,
      hasDesktopSidebar: !!desktopSidebar
    };
  });
  record('Issue 2: file preview replaces sidebar with spacer', previewInfo.hasSpacer && !previewInfo.hasDesktopSidebar, JSON.stringify(previewInfo));

  // Verify content rendered
  const previewContent = await p.evaluate(() => {
    const main = document.querySelector('.document-page, .markdown-body, .plain-preview, .preview-body');
    if (!main) return null;
    return main.textContent.length;
  });
  record('Issue 2: file preview content rendered with text', previewContent > 20, `textLength=${previewContent}`);

  // Check no horizontal overflow
  const overflow = await p.evaluate(() => document.body.scrollWidth > window.innerWidth);
  record('Issue 2: no horizontal overflow on preview page', !overflow, '');

  await ctxP.close();
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
