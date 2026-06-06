import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'issues/screenshots/003-fixes/final';
fs.mkdirSync(DIR, { recursive: true });

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail || ''}`);
}

const browser = await chromium.launch();
try {
  // =================== Desktop 1440x900 ===================
  console.log('\n========== Desktop 1440x900 ==========');
  const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await ctxD.newPage();
  await d.goto('http://localhost:5173/#/pages/chat/index', { waitUntil: 'networkidle' });
  await d.waitForTimeout(800);

  // Click group conversation
  const groupItem = d.locator('text=AgentHub 产品研发群').first();
  if (await groupItem.count() > 0) {
    await groupItem.click().catch(() => {});
    await d.waitForTimeout(500);
  }
  await d.screenshot({ path: path.join(DIR, '01-desktop-overview.png') });

  // Issue 1: right pane width
  const rightW = await d.evaluate(() => {
    const el = document.querySelector('.workbench-right');
    return el ? el.getBoundingClientRect().width : 0;
  });
  record('Issue 1: right panel width >= 360px', rightW >= 360, `w=${Math.round(rightW)}px`);

  // Issue 1: group avatar size (was 76, now 64)
  const groupAvatarH = await d.evaluate(() => {
    const el = document.querySelector('.group-info [class*="avatar"]');
    if (!el) return 0;
    return el.getBoundingClientRect().height;
  });
  record('Issue 1: group avatar height <= 70px', groupAvatarH > 0 && groupAvatarH <= 70, `h=${Math.round(groupAvatarH)}px`);

  // Issue 1: danger section subdued
  const dangerBg = await d.evaluate(() => {
    const el = document.querySelector('.action-row.danger');
    if (!el) return null;
    return getComputedStyle(el).backgroundColor;
  });
  record('Issue 1: danger action subtle bg (transparent)', dangerBg && (dangerBg === 'rgba(0, 0, 0, 0)' || dangerBg === 'transparent'), `bg=${dangerBg}`);

  // Issue 3: inject a quoted reply and check alignment
  await d.evaluate(() => {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config?.globalProperties?.$pinia || app?._context?.config?.globalProperties?.$pinia;
    if (!pinia) return;
    const messageStore = pinia._s.get('message');
    const conversationStore = pinia._s.get('conversation');
    const activeId = conversationStore.activeId || '2';
    const msgs = messageStore.messages[activeId] || [];
    const target = msgs.find(m => m.senderId !== 'me');
    if (!target) return;
    messageStore.sendMessage(
      activeId,
      'Quoted reply test',
      { id: 'me', name: 'Me' },
      'text',
      {
        replyRef: {
          messageId: target.id,
          senderName: target.senderName,
          contentPreview: (target.content || '').slice(0, 60)
        }
      }
    );
  });
  await d.waitForTimeout(500);
  await d.screenshot({ path: path.join(DIR, '02-desktop-quoted-reply.png') });

  const replyCheck = await d.evaluate(() => {
    const ref = document.querySelector('.reply-ref.reply-ref-me');
    const bubble = document.querySelector('.message-bubble.bubble-me');
    if (!ref || !bubble) return { exists: false };
    const rr = ref.getBoundingClientRect();
    const mb = bubble.getBoundingClientRect();
    return {
      exists: true,
      diff: Math.abs((rr.x + rr.width) - (mb.x + mb.width))
    };
  });
  record('Issue 3: reply-ref-me right edge aligns with me bubble (within 5px)', replyCheck.exists && replyCheck.diff < 5, `diff=${replyCheck.diff ? Math.round(replyCheck.diff) : 'N/A'}px`);

  // Issue 4: open emoji picker and check height
  const emojiBtn = d.locator('text=表情').first();
  if (await emojiBtn.count() > 0) {
    await emojiBtn.click().catch(() => {});
    await d.waitForTimeout(500);
    const emojiH = await d.evaluate(() => {
      const el = document.querySelector('.emoji-picker-container');
      return el ? el.getBoundingClientRect().height : 0;
    });
    record('Issue 4: desktop emoji panel height <= 280px', emojiH > 0 && emojiH <= 280, `h=${Math.round(emojiH)}px`);
    await d.screenshot({ path: path.join(DIR, '03-desktop-emoji.png') });
    // Close
    await d.locator('body').click().catch(() => {});
    await d.waitForTimeout(300);
  }

  await ctxD.close();

  // =================== File preview page 1280x800 ===================
  console.log('\n========== File preview page ==========');
  const ctxP = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctxP.newPage();
  const fileParam = encodeURIComponent(JSON.stringify({
    name: 'Test Report.docx',
    fileName: 'Test Report.docx',
    fileSize: '2.5 MB',
    fileType: 'docx',
    previewContent: 'Test content\n\nLine 2 of preview content.\n\nLine 3 of preview.'
  }));
  await p.goto(`http://localhost:5173/#/pages/files/preview?file=${fileParam}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(DIR, '04-file-preview.png') });

  // Issue 2: sidebar replaced by spacer
  const sidebarCheck = await p.evaluate(() => {
    return {
      hasSpacer: !!document.querySelector('.desktop-sidebar-spacer'),
      hasDesktopSidebar: !!document.querySelector('.desktop-sidebar')
    };
  });
  record('Issue 2: file preview uses spacer (no desktop sidebar)', sidebarCheck.hasSpacer && !sidebarCheck.hasDesktopSidebar, JSON.stringify(sidebarCheck));

  // Issue 2: preview content visible
  const previewVisible = await p.evaluate(() => {
    const main = document.querySelector('.preview-body');
    if (!main) return false;
    return main.textContent.length > 20;
  });
  record('Issue 2: file preview content rendered', previewVisible, '');

  // Issue 2: no horizontal overflow
  const overflowP = await p.evaluate(() => document.body.scrollWidth > window.innerWidth);
  record('Issue 2: no horizontal overflow on preview page', !overflowP, '');

  await ctxP.close();

  // =================== Mobile 375x844 ===================
  console.log('\n========== Mobile 375x844 ==========');
  const ctxM = await browser.newContext({ viewport: { width: 375, height: 844 } });
  const m = await ctxM.newPage();
  await m.goto('http://localhost:5173/#/pages/chat/detail?id=1', { waitUntil: 'networkidle' });
  await m.waitForTimeout(800);
  await m.screenshot({ path: path.join(DIR, '05-mobile-chat.png') });

  // Issue 5: toolbar above input box-row
  const order = await m.evaluate(() => {
    const toolbar = document.querySelector('.input-toolbar');
    const inputBox = document.querySelector('.input-box-row');
    if (!toolbar || !inputBox) return null;
    const t = toolbar.getBoundingClientRect();
    const i = inputBox.getBoundingClientRect();
    return { toolbarBottom: t.y + t.height, inputTop: i.y };
  });
  record('Issue 5: mobile toolbar above input box', order && order.toolbarBottom <= order.inputTop + 5, JSON.stringify(order));

  // Issue 5: input row single-line
  const inputH = await m.evaluate(() => {
    const el = document.querySelector('.input-box-row');
    return el ? el.getBoundingClientRect().height : 0;
  });
  record('Issue 5: mobile input row height <= 60px', inputH > 0 && inputH <= 60, `h=${Math.round(inputH)}px`);

  // Issue 4: mobile emoji panel height
  const emojiBtnM = m.locator('text=表情').first();
  if (await emojiBtnM.count() > 0) {
    await emojiBtnM.click().catch(() => {});
    await m.waitForTimeout(500);
    const mobileEmojiH = await m.evaluate(() => {
      const el = document.querySelector('.emoji-picker-container');
      return el ? el.getBoundingClientRect().height : 0;
    });
    record('Issue 4: mobile emoji panel height <= 220px', mobileEmojiH > 0 && mobileEmojiH <= 220, `h=${Math.round(mobileEmojiH)}px`);
    await m.screenshot({ path: path.join(DIR, '06-mobile-emoji.png') });
  }

  // Mobile no horizontal overflow
  const overflowM = await m.evaluate(() => document.body.scrollWidth > window.innerWidth);
  record('Mobile: no horizontal overflow', !overflowM, '');

  await ctxM.close();

  // =================== Tablet 768x1024 ===================
  console.log('\n========== Tablet 768x1024 ==========');
  const ctxT = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const t = await ctxT.newPage();
  await t.goto('http://localhost:5173/#/pages/chat/index', { waitUntil: 'networkidle' });
  await t.waitForTimeout(800);
  await t.screenshot({ path: path.join(DIR, '07-tablet.png') });
  const overflowT = await t.evaluate(() => document.body.scrollWidth > window.innerWidth);
  record('Tablet 768: no horizontal overflow', !overflowT, '');
  await ctxT.close();

  // =================== 1024x768 desktop ===================
  console.log('\n========== 1024x768 desktop ==========');
  const ctxD2 = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const d2 = await ctxD2.newPage();
  await d2.goto('http://localhost:5173/#/pages/chat/index', { waitUntil: 'networkidle' });
  await d2.waitForTimeout(800);
  const groupItem2 = d2.locator('text=AgentHub 产品研发群').first();
  if (await groupItem2.count() > 0) {
    await groupItem2.click().catch(() => {});
    await d2.waitForTimeout(500);
  }
  await d2.screenshot({ path: path.join(DIR, '08-desktop-1024.png') });
  const overflowD2 = await d2.evaluate(() => document.body.scrollWidth > window.innerWidth);
  record('1024x768: no horizontal overflow', !overflowD2, '');
  await ctxD2.close();

  // =================== Summary ===================
  console.log('\n========== Summary ==========');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('\nFailed items:');
  for (const r of results.filter(r => !r.pass)) {
    console.log(`  - ${r.name}: ${r.detail}`);
  }
  fs.writeFileSync(path.join(DIR, 'results.json'), JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
