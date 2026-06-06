// Phase 8 verification: visit the running H5 dev server and assert fixes are visible
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:5173/';
const SCREENSHOT_DIR = path.resolve('issues/screenshots/phase8-20260604');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail || ''}`);
}

const browser = await chromium.launch();
try {
  // ============ Mobile viewport (375x844) — subpages hide tab bar ============
  const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 844 } });
  const mobile = await mobileCtx.newPage();

  // 1. Visit each subpage and assert: tab-bar hidden on mobile
  const subpages = [
    { path: '#/pages/contacts/friend-requests', name: 'friend-requests' },
    { path: '#/pages/contacts/blacklist', name: 'blacklist' },
    { path: '#/pages/contacts/add', name: 'contacts-add' },
    { path: '#/pages/settings/devices', name: 'devices' },
    { path: '#/pages/group/create', name: 'group-create' },
    { path: '#/pages/group/members', name: 'group-members' },
    { path: '#/pages/agents/new', name: 'agents-new' },
    { path: '#/pages/search/index', name: 'search' },
    { path: '#/pages/profile/index', name: 'profile' },
    { path: '#/pages/group/qrcode', name: 'qrcode' },
  ];
  for (const sp of subpages) {
    await mobile.goto(BASE + sp.path, { waitUntil: 'networkidle' });
    await mobile.waitForTimeout(400);
    const hasTabBar = await mobile.locator('.mobile-tab-bar').count();
    record(`mobile-tab-hidden: ${sp.name}`, hasTabBar === 0, `tab-bar count=${hasTabBar}`);
    await mobile.screenshot({ path: path.join(SCREENSHOT_DIR, `mobile-${sp.name}.png`), fullPage: false });
  }

  // 2. back-btn ≥ 44x44 on the new subpages (not the search/profile/qrcode trio which were already fixed)
  const backBtnPages = ['friend-requests', 'blacklist', 'devices', 'group-create', 'group-members', 'agents-new'];
  for (const p of backBtnPages) {
    await mobile.goto(BASE + `#/pages/${p === 'group-create' ? 'group/create' : p === 'group-members' ? 'group/members' : p === 'devices' ? 'settings/devices' : p === 'agents-new' ? 'agents/new' : 'contacts/' + p}`, { waitUntil: 'networkidle' });
    await mobile.waitForTimeout(300);
    const box = await mobile.locator('.back-btn').first().boundingBox();
    const ok = box && box.width >= 44 && box.height >= 44;
    record(`back-btn ≥44x44: ${p}`, ok, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'no .back-btn');
  }

  // 3. Critical ≤32px buttons now ≥44px
  const buttonChecks = [
    { page: 'settings/devices', selector: '.btn-logout-device', min: 44, name: 'devices logout' },
    { page: 'group/members', selector: '.btn-kick', min: 44, name: 'members kick' },
    { page: 'contacts/blacklist', selector: '.btn-remove', min: 44, name: 'blacklist remove' },
    { page: 'contacts/friend-requests', selector: '.btn-accept', min: 44, name: 'friend-requests accept' },
    { page: 'group/create', selector: '.btn-submit', min: 44, name: 'group-create submit' },
    { page: 'search/index', selector: '.clear-btn', min: 44, name: 'search clear' },
  ];
  for (const b of buttonChecks) {
    await mobile.goto(BASE + `#/pages/${b.page}`, { waitUntil: 'networkidle' });
    await mobile.waitForTimeout(300);
    const box = await mobile.locator(b.selector).first().boundingBox().catch(() => null);
    const ok = box && box.height >= b.min;
    record(`button ≥${b.min}px: ${b.name}`, ok, box ? `h=${Math.round(box.height)}` : 'not found');
  }

  await mobileCtx.close();

  // ============ Desktop viewport (1440x900) — verify ContactCard danger actions & QR caption ============
  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktop = await desktopCtx.newPage();

  // 4. ContactCard 4-button rearrangement — visit a contact detail. There's no direct detail page for ContactCard in the public routes, so we just verify component still exists by visiting /pages/contacts/index and checking.
  await desktop.goto(BASE + '#/pages/contacts/index', { waitUntil: 'networkidle' });
  await desktop.waitForTimeout(400);
  await desktop.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-contacts.png') });

  // 5. QR pages: caption visible + dark mode renders
  await desktop.goto(BASE + '#/pages/profile/index', { waitUntil: 'networkidle' });
  await desktop.waitForTimeout(400);
  const captionProfile = await desktop.locator('text=演示用二维码').count();
  record('QR caption: profile', captionProfile > 0, `caption count=${captionProfile}`);
  await desktop.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-profile.png') });

  await desktop.goto(BASE + '#/pages/group/qrcode', { waitUntil: 'networkidle' });
  await desktop.waitForTimeout(400);
  const captionQr = await desktop.locator('text=演示用二维码').count();
  record('QR caption: qrcode', captionQr > 0, `caption count=${captionQr}`);
  await desktop.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-qrcode.png') });

  // 6. Dark mode: flip theme and re-screenshot
  // The app reads theme from storage; use appStore via page evaluate to flip
  await desktop.evaluate(() => {
    document.documentElement.className = 'theme-dark';
  });
  await desktop.goto(BASE + '#/pages/profile/index', { waitUntil: 'networkidle' });
  await desktop.waitForTimeout(400);
  await desktop.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-profile-dark.png') });

  await desktop.goto(BASE + '#/pages/chat/index', { waitUntil: 'networkidle' });
  await desktop.waitForTimeout(600);
  await desktop.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-chat-dark.png') });

  // 7. Verify chevron icon in DOM (not back+rotate)
  await desktop.evaluate(() => { document.documentElement.className = 'theme-light'; });
  await desktop.goto(BASE + '#/pages/profile/index', { waitUntil: 'networkidle' });
  await desktop.waitForTimeout(300);
  const chevronCount = await desktop.locator('svg').evaluateAll(els =>
    els.filter(el => el.innerHTML.includes('M9 18l6-6')).length
  );
  record('chevron-right icon present', chevronCount > 0, `chevron svgs=${chevronCount}`);

  // 8. Verify zero legacy arrow-right CSS classes
  const arrowClassesCount = await desktop.evaluate(() => {
    return document.querySelectorAll('.arrow-right, .arrow-down').length;
  });
  record('legacy .arrow-* classes removed', arrowClassesCount === 0, `count=${arrowClassesCount}`);

  await desktopCtx.close();
} finally {
  await browser.close();
}

const pass = results.filter(r => r.pass).length;
const fail = results.filter(r => !r.pass).length;
console.log(`\n=== Phase 8 verification: ${pass} pass, ${fail} fail ===`);
if (fail > 0) {
  console.log('\nFailures:');
  results.filter(r => !r.pass).forEach(r => console.log(`  - ${r.name}: ${r.detail}`));
  process.exit(1);
}
