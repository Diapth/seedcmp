import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'issues/screenshots/003-fixes/verify';
fs.mkdirSync(DIR, { recursive: true });

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail || ''}`);
}

const browser = await chromium.launch();
try {
  // Desktop 1440x900
  console.log('\n=== Desktop 1440x900 ===');
  const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await ctxD.newPage();
  await d.goto('http://localhost:5173/#/pages/chat/index', { waitUntil: 'networkidle' });
  await d.waitForTimeout(800);

  // 1. Right panel width check (issue 1)
  const rightPane = d.locator('.workbench-right').first();
  const rightBox = await rightPane.boundingBox().catch(() => null);
  record('Issue 1: right pane wider than 360px', rightBox && rightBox.width >= 360, `w=${rightBox ? Math.round(rightBox.width) : 'none'}`);

  // Click group conversation
  const groupItem = d.locator('text=AgentHub 产品研发群').first();
  if (await groupItem.count() > 0) {
    await groupItem.click().catch(() => {});
    await d.waitForTimeout(800);
  }
  await d.screenshot({ path: path.join(DIR, '01-desktop-group.png') });

  // 2. GroupInfoPanel renders correctly
  const groupName = await d.locator('.group-name').count();
  record('GroupInfoPanel: group name visible', groupName > 0, `count=${groupName}`);

  // 3. Group avatar size
  const groupAvatar = d.locator('.group-info .group-avatar, .group-info [class*=avatar]').first();
  const avatarBox = await groupAvatar.boundingBox().catch(() => null);
  record('Group avatar reasonable size', avatarBox && avatarBox.height <= 80, `h=${avatarBox ? Math.round(avatarBox.height) : 'none'}`);

  // 4. Danger section is subdued (should be transparent/light bg)
  const dangerBtn = d.locator('.action-row.danger').first();
  if (await dangerBtn.count() > 0) {
    const color = await dangerBtn.evaluate(el => getComputedStyle(el).backgroundColor);
    record('Danger section background subtle (transparent or base)', color === 'rgba(0, 0, 0, 0)' || color.includes('rgba(0, 0, 0, 0)'), `bg=${color}`);
  }

  // 5. Send a quoted reply to test alignment
  const firstOtherMsg = d.locator('.message-bubble.bubble-other').first();
  if (await firstOtherMsg.count() > 0) {
    await firstOtherMsg.click({ button: 'right' }).catch(() => {});
    await d.waitForTimeout(400);
    const replyBtn = d.locator('text=引用消息').first();
    if (await replyBtn.count() > 0) {
      await replyBtn.click().catch(() => {});
      await d.waitForTimeout(300);
      const textarea = d.locator('textarea.input-textarea').first();
      await textarea.fill('Test reply').catch(() => {});
      const sendBtn = d.locator('.btn-send-msg').first();
      await sendBtn.click().catch(() => {});
      await d.waitForTimeout(500);
    }
  }
  await d.screenshot({ path: path.join(DIR, '02-desktop-with-reply.png') });

  // 6. Check reply ref alignment for "me" - should be right-aligned
  const replyRefMe = d.locator('.reply-ref.reply-ref-me').first();
  const replyRefMeBox = await replyRefMe.boundingBox().catch(() => null);
  const meBubble = d.locator('.message-bubble.bubble-me').last();
  const meBubbleBox = await meBubble.boundingBox().catch(() => null);
  if (replyRefMeBox && meBubbleBox) {
    const replyRefRight = replyRefMeBox.x + replyRefMeBox.width;
    const bubbleRight = meBubbleBox.x + meBubbleBox.width;
    const diff = Math.abs(replyRefRight - bubbleRight);
    record('Issue 3: reply ref right edge aligns with bubble', diff < 30, `diff=${Math.round(diff)}px`);
  } else {
    record('Issue 3: reply ref right edge aligns with bubble', false, 'reply-ref-me or bubble-me not found');
  }

  // 7. Emoji picker - open and check height
  const emojiBtn = d.locator('text=表情').first();
  if (await emojiBtn.count() > 0) {
    await emojiBtn.click().catch(() => {});
    await d.waitForTimeout(400);
    const emojiPanel = d.locator('.emoji-picker-container').first();
    const panelBox = await emojiPanel.boundingBox().catch(() => null);
    record('Issue 4: emoji panel height <= 280px', panelBox && panelBox.height <= 280, `h=${panelBox ? Math.round(panelBox.height) : 'none'}`);
    await d.screenshot({ path: path.join(DIR, '03-desktop-emoji.png') });
    await emojiBtn.click().catch(() => {});
  }

  // 8. File preview page
  const ctxP = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctxP.newPage();
  const fileParam = encodeURIComponent(JSON.stringify({
    name: 'Test file.docx',
    fileName: 'Test file.docx',
    fileSize: '2.5 MB',
    fileType: 'docx',
    previewContent: 'AgentHub IM file preview\n\nDesktop preview: right panel switches to file preview pane.\n\nMobile preview: opens dedicated preview page.'
  }));
  await p.goto(`http://localhost:5173/#/pages/files/preview?file=${fileParam}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(DIR, '04-file-preview-page.png') });

  // Check sidebar replaced by spacer
  const sidebar = await p.locator('.desktop-sidebar-spacer').first();
  const sidebarBox = await sidebar.boundingBox().catch(() => null);
  record('Issue 2: file preview desktop sidebar replaced by spacer', sidebarBox && sidebarBox.width <= 70, `spacer w=${sidebarBox ? Math.round(sidebarBox.width) : 'none'}`);

  const previewContent = await p.locator('.document-page, .markdown-body, .plain-preview').count();
  record('Issue 2: preview content rendered', previewContent > 0, `count=${previewContent}`);

  await ctxP.close();
  await ctxD.close();

  // Mobile 375x844
  console.log('\n=== Mobile 375x844 ===');
  const ctxM = await browser.newContext({ viewport: { width: 375, height: 844 } });
  const m = await ctxM.newPage();
  await m.goto('http://localhost:5173/#/pages/chat/detail?id=1', { waitUntil: 'networkidle' });
  await m.waitForTimeout(800);
  await m.screenshot({ path: path.join(DIR, '05-mobile-chat.png') });

  // 9. Mobile menu (toolbar) should be ABOVE input
  const inputBoxRow = m.locator('.input-box-row').first();
  const inputBoxRowBox = await inputBoxRow.boundingBox().catch(() => null);
  const toolbar = m.locator('.input-toolbar').first();
  const toolbarBox = await toolbar.boundingBox().catch(() => null);
  if (toolbarBox && inputBoxRowBox) {
    record('Issue 5: toolbar above input box', toolbarBox.y + toolbarBox.height <= inputBoxRowBox.y + 5, `toolbar bottom=${Math.round(toolbarBox.y + toolbarBox.height)} input top=${Math.round(inputBoxRowBox.y)}`);
  } else {
    record('Issue 5: toolbar above input box', false, 'toolbar/input not found');
  }

  // 10. Mobile input should be single-line height
  if (inputBoxRowBox) {
    record('Issue 5: mobile input row single-line height', inputBoxRowBox.height <= 60, `h=${Math.round(inputBoxRowBox.height)}`);
  }

  // 11. Mobile: open emoji - should not block messages
  const emojiBtnM = m.locator('text=表情').first();
  if (await emojiBtnM.count() > 0) {
    await emojiBtnM.click().catch(() => {});
    await m.waitForTimeout(500);
    await m.screenshot({ path: path.join(DIR, '06-mobile-emoji.png') });
    const emojiPanelM = m.locator('.emoji-picker-container').first();
    const panelBoxM = await emojiPanelM.boundingBox().catch(() => null);
    record('Issue 4: mobile emoji panel constrained height', panelBoxM && panelBoxM.height <= 220, `h=${panelBoxM ? Math.round(panelBoxM.height) : 'none'}`);
  }
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
