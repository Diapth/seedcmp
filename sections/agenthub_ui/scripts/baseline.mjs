import { chromium } from 'playwright';
import fs from 'node:fs';
const DIR = 'issues/screenshots/003-fixes/baseline';
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
try {
  // Desktop 1440x900
  const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await ctxD.newPage();
  await d.goto('http://localhost:5173/#/pages/chat/index', { waitUntil: 'networkidle' });
  await d.waitForTimeout(800);
  await d.screenshot({ path: `${DIR}/01-desktop-1440.png`, fullPage: false });
  // Switch to group
  const groupItem = d.locator('text=AgentHub 产品研发群').first();
  if (await groupItem.count() > 0) {
    await groupItem.click().catch(() => {});
    await d.waitForTimeout(800);
    await d.screenshot({ path: `${DIR}/02-desktop-group-active.png`, fullPage: false });
  }
  await ctxD.close();

  // File preview page
  const ctxP = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctxP.newPage();
  const fileParam = encodeURIComponent(JSON.stringify({
    name: '测试文件.docx', fileName: '测试文件.docx', fileSize: '2.5 MB', fileType: 'docx'
  }));
  await p.goto(`http://localhost:5173/#/pages/files/preview?file=${fileParam}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${DIR}/03-file-preview.png`, fullPage: false });
  await ctxP.close();

  // Mobile 375x844
  const ctxM = await browser.newContext({ viewport: { width: 375, height: 844 } });
  const m = await ctxM.newPage();
  await m.goto('http://localhost:5173/#/pages/chat/detail?id=1', { waitUntil: 'networkidle' });
  await m.waitForTimeout(800);
  await m.screenshot({ path: `${DIR}/04-mobile-chat.png`, fullPage: false });
  // Open emoji
  const emojiBtn = m.locator('text=表情').first();
  if (await emojiBtn.count() > 0) {
    await emojiBtn.click().catch(() => {});
    await m.waitForTimeout(500);
    await m.screenshot({ path: `${DIR}/05-mobile-emoji-open.png`, fullPage: false });
  }
  await ctxM.close();

  console.log('Baseline screenshots saved to ' + DIR);
} finally {
  await browser.close();
}
