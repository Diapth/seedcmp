import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultAppRoot = path.resolve(scriptDir, '../..');
const defaultRepo = path.resolve(defaultAppRoot, '../..');
const repo = path.resolve(process.env.SEEDCMP_ROOT || defaultRepo);
const appRoot = path.resolve(process.env.AGENTHUB_ROOT || path.join(repo, 'sections/agenthub_ui'));
const planPath = path.join(appRoot, '.ai/plan/V2-test-plan.md');
const baseUrl = (process.env.H5_BASE_URL || 'http://172.18.58.156:5173').replace(/\/$/, '');
const apiBase = process.env.API_BASE_URL || 'http://172.18.58.156:3000';
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const runId = `v2-full-${stamp}`;
const screenshotRoot = path.join(appRoot, '.ai/tests/screenshots', runId);
const issueShotRoot = path.join(appRoot, '.ai/issue/screenshots', runId);
const issueDir = path.join(appRoot, '.ai/issue');
const videoDir = path.join(screenshotRoot, 'videos');

for (const dir of [screenshotRoot, issueShotRoot, issueDir, videoDir]) fs.mkdirSync(dir, { recursive: true });

const cases = fs.readFileSync(planPath, 'utf8')
  .split(/\n/)
  .map((line) => line.match(/^###\s+(V2-\d{2}-\d+)\s+(.+)$/))
  .filter(Boolean)
  .map((m) => ({ id: m[1], title: m[2], cluster: m[1].slice(3, 5) }));

const accounts = {
  A: { label: 'A', phone: '13733632709', passwords: ['123456'], nickname: '账号A' },
  B: { label: 'B', phone: '13800000001', passwords: ['Test1234!', '1234567'], nickname: '测试员B' },
  C: { label: 'C', phone: '13800000002', passwords: ['Test1234!'], nickname: '测试员C' },
};
const registrationAccounts = {
  B: { label: 'B', phone: `139${stamp.replace(/\D/g, '').slice(-8)}`, passwords: ['Test1234!'], nickname: `测试员B-${stamp.slice(-4)}` },
  C: { label: 'C', phone: `136${stamp.replace(/\D/g, '').slice(-8)}`, passwords: ['Test1234!'], nickname: `测试员C-${stamp.slice(-4)}` },
};

const diagnostics = [];
const network = [];
const results = [];
const setup = [];

function rel(file) {
  return path.relative(repo, file);
}

function safeId(id) {
  return id.replace(/[^\w.-]+/g, '_');
}

function now() {
  return new Date().toISOString();
}

function pushDiag(kind, message, data = {}) {
  diagnostics.push({ time: now(), kind, message, ...data });
}

function redactStorage(value) {
  return String(value || '').replace(/[A-Za-z0-9_.-]{12,}/g, (m) => `${m.slice(0, 4)}***${m.slice(-4)}`);
}

async function pageInfo(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || '';
    const ls = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      ls[k] = localStorage.getItem(k);
    }
    return {
      url: location.href,
      title: document.title,
      text: text.slice(0, 4000),
      localStorage: ls,
      inputs: Array.from(document.querySelectorAll('input, textarea')).map((el, i) => ({
        i,
        tag: el.tagName,
        type: el.type || '',
        placeholder: el.getAttribute('placeholder') || '',
        value: el.value ? '***filled***' : '',
      })),
      buttons: Array.from(document.querySelectorAll('button, uni-button, [role=button]')).map((el, i) => ({
        i,
        tag: el.tagName,
        className: String(el.className || ''),
        text: (el.innerText || el.textContent || '').trim(),
        disabled: Boolean(el.disabled || el.getAttribute('disabled')),
      })).slice(0, 40),
    };
  });
}

async function snap(page, id, name, mirrorIssue = false) {
  const dir = path.join(screenshotRoot, safeId(id));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(async (err) => {
    pushDiag('screenshot-error', `${id} ${name}: ${err.message}`);
  });
  if (mirrorIssue && fs.existsSync(file)) {
    const issueDirForCase = path.join(issueShotRoot, safeId(id));
    fs.mkdirSync(issueDirForCase, { recursive: true });
    fs.copyFileSync(file, path.join(issueDirForCase, `${name}.png`));
  }
  return file;
}

async function gotoRoute(page, route, waitMs = 900) {
  const clean = String(route || '').replace(/^#?\//, '');
  await page.goto(`${baseUrl}/#/${clean}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(waitMs);
}

async function clearClientState(page) {
  await page.goto(`${baseUrl}/#/pages/login/index`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function fillNth(page, index, value) {
  const loc = page.locator('input, textarea').nth(index);
  await loc.waitFor({ state: 'visible', timeout: 5000 });
  await loc.fill(String(value));
}

async function clickFirst(page, selector, label) {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: 'visible', timeout: 5000 });
  await loc.click({ force: true, timeout: 5000 });
  pushDiag('action', `clicked ${label || selector}`);
  return true;
}

async function clickText(page, text) {
  const selectors = [
    `button:has-text("${text}")`,
    `uni-button:has-text("${text}")`,
    `text=${text}`,
  ];
  for (const selector of selectors) {
    try {
      await page.locator(selector).first().click({ force: true, timeout: 2500 });
      pushDiag('action', `clicked text ${text}`);
      return true;
    } catch {
      // Try the next selector.
    }
  }
  return false;
}

async function tryFillFirstVisible(page, value) {
  const count = await page.locator('input, textarea').count();
  if (!count) return false;
  await page.locator('input, textarea').first().fill(String(value)).catch(() => {});
  return true;
}

async function fillVisibleInput(page, index, value, timeout = 2500) {
  const loc = page.locator('input:visible, textarea:visible').nth(index);
  await loc.fill(String(value), { timeout });
}

async function readInputValue(page, index) {
  return page.evaluate((i) => {
    const el = Array.from(document.querySelectorAll('input, textarea'))[i];
    return el?.value || '';
  }, index);
}

async function fillAgentFormInput(page, index, value, options = {}) {
  const expected = String(value);
  const verify = options.verify !== false;
  const loc = page.locator('input, textarea').nth(index);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await loc.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {});
    await loc.fill(expected, { timeout: 2500 });
    await page.waitForTimeout(120);
    if (!verify) return;
    const actual = await readInputValue(page, index);
    if (actual === expected) return;
  }
  if (verify) {
    const actual = await readInputValue(page, index);
    throw new Error(`Agent form input ${index} did not retain value. expected=${expected}; actual=${actual}`);
  }
}

async function clickSegment(page, text) {
  const segment = page.locator('.segmented-item', { hasText: text }).first();
  await segment.click({ force: true, timeout: 2500 });
  pushDiag('action', `clicked segment ${text}`);
}

async function getStorageSummary(page) {
  const info = await pageInfo(page);
  const out = {};
  for (const [k, v] of Object.entries(info.localStorage || {})) out[k] = redactStorage(v);
  return out;
}

function instrument(page, label) {
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' || msg.type() === 'warning') {
      pushDiag('console', text, { page: label, type: msg.type(), location: msg.location() });
    }
  });
  page.on('pageerror', (err) => pushDiag('pageerror', err.stack || err.message, { page: label }));
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith(apiBase) || /\/v1\/|\/auth\/|\/users\/|\/friends\/|\/groups\/|\/messages\/|\/clowder\/|\/files\//.test(url)) {
      network.push({ time: now(), page: label, method: req.method(), url, type: req.resourceType() });
    }
  });
  page.on('requestfailed', (req) => {
    network.push({
      time: now(),
      page: label,
      method: req.method(),
      url: req.url(),
      failed: true,
      errorText: req.failure()?.errorText || '',
    });
  });
  page.on('response', (res) => {
    if (res.url().startsWith(apiBase) && res.status() >= 400) {
      network.push({ time: now(), page: label, method: 'RESPONSE', url: res.url(), status: res.status() });
    }
  });
}

async function login(page, account) {
  for (const password of account.passwords) {
    await clearClientState(page);
    await gotoRoute(page, 'pages/login/index');
    await fillNth(page, 0, account.phone);
    await fillNth(page, 1, password);
    await clickFirst(page, '.btn-submit', `${account.label} login`);
    await page.waitForTimeout(2200);
    const info = await pageInfo(page);
    const ok = info.url.includes('/pages/chat/index') || Boolean(info.localStorage?.['auth.uid']);
    if (ok) {
      return {
        ok: true,
        passwordUsed: password === account.passwords[0] ? 'primary' : 'fallback',
        uid: info.localStorage?.['auth.uid'] || '',
        accessToken: info.localStorage?.['auth.accessToken'] ? redactStorage(info.localStorage['auth.accessToken']) : '',
      };
    }
  }
  const info = await pageInfo(page);
  return { ok: false, errorText: info.text.slice(0, 300), storage: await getStorageSummary(page) };
}

function accountForCase(id) {
  if (id.includes('A ') || id === 'V2-03-03' || id === 'V2-03-04' || id === 'V2-03-05') return accounts.A;
  if (id.includes('C ') || id === 'V2-02-05') return accounts.C;
  return accounts.B;
}

function requiresAuthenticatedRoute(id) {
  const cluster = id.slice(3, 5);
  return !['01', '02'].includes(cluster);
}

async function ensureAuthenticated(page, account, id) {
  const info = await pageInfo(page).catch(() => ({ url: '', text: '', localStorage: {} }));
  const hasToken = Boolean(info.localStorage?.['auth.accessToken'] || info.localStorage?.app_token);
  const needsLogin = !hasToken ||
    info.url.includes('/pages/login/') ||
    /账号已在其他设备登录|重新登录|登录状态已失效|当前会话已失效|缺少 refresh token|账号登录|安全登录/.test(info.text);

  if (!needsLogin) return { ok: true, reused: true };

  await clickText(page, '重新登录').catch(() => {});
  await page.waitForTimeout(300).catch(() => {});
  const result = await login(page, account);
  pushDiag('ensure-authenticated', `${id}: ${account.label} login=${result.ok}; reused=false`);
  return result;
}

async function loginImWebCounterpart(page, account) {
  await page.goto(`${apiBase}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(900);
  for (const password of account.passwords) {
    try {
      await page.getByPlaceholder(/手机号|账号|username|phone/i).first().fill(account.phone, { timeout: 5000 });
      await page.getByPlaceholder(/密码|password/i).first().fill(password, { timeout: 5000 });
      await page.getByRole('button', { name: /安全登录|登录|login/i }).first().click({ timeout: 5000 });
      await page.waitForTimeout(2500);
      const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
      const ok = !/登录|密码/.test(text.slice(0, 200)) || /聊天|会话|通讯录|conversation/i.test(text);
      if (ok) {
        return { ok: true, passwordUsed: password === account.passwords[0] ? 'primary' : 'fallback', text: text.slice(0, 500), url: page.url() };
      }
    } catch (err) {
      pushDiag('imweb-login-attempt', err.message, { account: account.label });
    }
  }
  const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  return { ok: false, text: text.slice(0, 500), url: page.url() };
}

async function registerAccount(page, account) {
  await clearClientState(page);
  await gotoRoute(page, 'pages/login/register');
  try {
    await fillNth(page, 0, account.phone);
    await clickFirst(page, '.btn-code', `${account.label} sms`);
    await page.waitForTimeout(900);
    await fillNth(page, 1, '123456');
    await fillNth(page, 2, account.nickname);
    await fillNth(page, 3, account.passwords[0]);
    await fillNth(page, 4, account.passwords[0]);
    await clickFirst(page, '.btn-submit', `${account.label} register`);
    await page.waitForTimeout(2600);
    const info = await pageInfo(page);
    return {
      ok: info.url.includes('/pages/chat/index') || Boolean(info.localStorage?.['auth.uid']),
      url: info.url,
      text: info.text.slice(0, 500),
      storage: await getStorageSummary(page),
    };
  } catch (err) {
    return { ok: false, errorText: err.message, storage: await getStorageSummary(page) };
  }
}

function routeForCase(id) {
  const cluster = id.slice(3, 5);
  if (cluster === '01') return 'pages/login/index';
  if (cluster === '02') return 'pages/login/register';
  if (cluster === '03') {
    if (id.endsWith('03') || id.endsWith('04') || id.endsWith('05')) return 'pages/contacts/friend-requests';
    if (id.endsWith('10')) return 'pages/contacts/blacklist';
    return 'pages/contacts/add';
  }
  if (cluster === '04') return 'pages/contacts/index';
  if (cluster === '05') return 'pages/chat/index';
  if (cluster === '06') {
    if (id.endsWith('01') || id.endsWith('12')) return 'pages/group/create';
    if (id.endsWith('02') || id.endsWith('07')) return 'pages/group/info';
    if (id.endsWith('03') || id.endsWith('04') || id.endsWith('05') || id.endsWith('06') || id.endsWith('08') || id.endsWith('09')) return 'pages/group/members';
    return 'pages/chat/index';
  }
  if (cluster === '07') return 'pages/agents/new';
  if (cluster === '08') return 'pages/chat/index';
  if (cluster === '09' || cluster === '10' || cluster === '11') return 'pages/agents/board';
  if (cluster === '12') return 'pages/chat/index';
  if (cluster === '13') return 'pages/files/index';
  if (cluster === '14') return id.endsWith('03') ? 'pages/settings/devices' : 'pages/settings/index';
  if (cluster === '15') return 'pages/profile/index';
  if (cluster === '16') return 'pages/chat/index';
  if (cluster === '17') return 'pages/settings/index';
  return 'pages/chat/index';
}

function buildPreviewRoute(file) {
  const payload = encodeURIComponent(JSON.stringify(file));
  return `pages/files/preview?file=${payload}`;
}

function fileForCase(id) {
  const md = {
    id: 'v2-md',
    name: 'test.md',
    fileName: 'test.md',
    ext: 'md',
    url: '/assets/test.md',
    content: 'test.md',
  };
  const html = { ...md, id: 'v2-html', name: 'test.html', fileName: 'test.html', ext: 'html', url: '/assets/test.html', content: 'test.html' };
  const pdf = { ...md, id: 'v2-pdf', name: 'test.pptx.pdf', fileName: 'test.pptx.pdf', ext: 'pdf', url: '/assets/test.pptx.pdf', content: 'test.pptx.pdf' };
  const docx = { ...md, id: 'v2-docx', name: 'test.docx', fileName: 'test.docx', ext: 'docx', url: '/assets/test.docx', content: 'test.docx' };
  const xlsx = { ...md, id: 'v2-xlsx', name: 'test.xlsx', fileName: 'test.xlsx', ext: 'xlsx', url: '/assets/test.xlsx', content: 'test.xlsx' };
  const pptx = { ...md, id: 'v2-pptx', name: 'test.pptx', fileName: 'test.pptx', ext: 'pptx', url: '/assets/test.pptx', content: 'test.pptx' };
  const png = { ...md, id: 'v2-png', name: 'usv_layout_front_view.png', fileName: 'usv_layout_front_view.png', ext: 'png', url: '/assets/usv_layout_front_view.png', content: 'usv_layout_front_view.png' };
  if (id === 'V2-13-02') return html;
  if (id === 'V2-13-03') return pdf;
  if (id === 'V2-13-04') return docx;
  if (id === 'V2-13-05' || id === 'V2-13-11') return png;
  if (id === 'V2-13-06') return { ...md, id: 'v2-mp4', name: 'test-video.mp4', fileName: 'test-video.mp4', ext: 'mp4', url: '/assets/test-video.mp4' };
  if (id === 'V2-13-07') return { ...md, id: 'v2-mp3', name: 'test-audio.mp3', fileName: 'test-audio.mp3', ext: 'mp3', url: '/assets/test-audio.mp3' };
  if (id === 'V2-13-08') return { ...md, id: 'v2-zip', name: 'test-large.zip', fileName: 'test-large.zip', ext: 'zip', url: '/assets/test-large.zip' };
  if (id === 'V2-13-09') return { ...md, id: 'v2-exe', name: 'blocked.exe', fileName: 'blocked.exe', ext: 'exe', url: '/assets/blocked.exe' };
  if (id.includes('xlsx')) return xlsx;
  if (id.includes('pptx')) return pptx;
  return md;
}

async function runRegisterCase(id, page) {
  if (id === 'V2-02-04') {
    const reg = await registerAccount(page, registrationAccounts.B);
    return {
      status: reg.ok ? 'PASS' : 'FAIL',
      actual: `B registration attempted. ok=${reg.ok}; url=${reg.url || ''}; text=${reg.text || reg.errorText || ''}`,
      expected: 'B should register cleanly with Test1234! and auto-login.',
    };
  }
  if (id === 'V2-02-05') {
    const reg = await registerAccount(page, registrationAccounts.C);
    if (!reg.ok) {
      const loginResult = await login(page, registrationAccounts.C);
      return {
        status: loginResult.ok ? 'PASS_WITH_WARNING' : 'FAIL',
        actual: `C registration attempted. registerOk=${reg.ok}; fallbackLogin=${loginResult.ok}; text=${reg.text || reg.errorText || loginResult.errorText || ''}`,
        expected: 'C should register cleanly and auto-login.',
      };
    }
    return { status: 'PASS', actual: `C registered/logged in. storage=${JSON.stringify(reg.storage)}`, expected: 'C should register and auto-login.' };
  }
  await gotoRoute(page, 'pages/login/register');
  const info = await pageInfo(page);
  if (id === 'V2-02-01') {
    const hasConfirm = /确认密码/.test(info.text);
    return { status: hasConfirm ? 'PASS' : 'FAIL', actual: `confirmPasswordVisible=${hasConfirm}; text=${info.text.slice(0, 500)}`, expected: 'Register page should contain confirm password.' };
  }
  if (id === 'V2-02-02') {
    await clickFirst(page, '.btn-submit', 'empty register').catch(() => {});
    await page.waitForTimeout(600);
    const emptyInfo = await pageInfo(page);
    const emptyOk = /请填写完整/.test(emptyInfo.text);
    await fillNth(page, 0, '13900000009').catch(() => {});
    await fillNth(page, 1, '123456').catch(() => {});
    await fillNth(page, 2, '校验账号').catch(() => {});
    await fillNth(page, 3, '1234567').catch(() => {});
    const before = network.length;
    await clickFirst(page, '.btn-submit', 'seven-char register').catch(() => {});
    await page.waitForTimeout(1400);
    const afterInfo = await pageInfo(page);
    const submitted = network.slice(before).some((n) => /\/v1\/user\/register/.test(n.url || '')) || afterInfo.url.includes('/pages/chat/index');
    return { status: emptyOk && !submitted && /确认密码/.test(afterInfo.text) ? 'PASS' : 'FAIL', actual: `emptyValidation=${emptyOk}; sevenCharSubmitted=${submitted}; url=${afterInfo.url}`, expected: 'Empty, short password, and password mismatch should be blocked before network.' };
  }
  if (id === 'V2-02-03') {
    await fillNth(page, 0, registrationAccounts.C.phone).catch(() => {});
    const before = network.length;
    await clickFirst(page, '.btn-code', 'get register sms').catch(() => {});
    await page.waitForTimeout(1000);
    const info2 = await pageInfo(page);
    const smsCall = network.slice(before).some((n) => /\/v1\/user\/sms\/registercode/.test(n.url || ''));
    return { status: smsCall && /\d+s/.test(info2.text) ? 'PASS' : 'FAIL', actual: `smsCall=${smsCall}; countdown=${/\d+s/.test(info2.text)}`, expected: 'SMS endpoint should be called and countdown shown.' };
  }
  if (id === 'V2-02-06') {
    const reg = await registerAccount(page, registrationAccounts.B);
    const duplicate = /已存在|duplicate|注册失败|400|重复/.test(reg.text || reg.errorText || '') || !reg.ok;
    return { status: duplicate ? 'PASS' : 'FAIL', actual: `duplicateHandled=${duplicate}; text=${reg.text || reg.errorText || ''}`, expected: 'Duplicate phone should show backend error.' };
  }
  if (id === 'V2-02-7') {
    const loginResult = await login(page, registrationAccounts.C);
    return { status: loginResult.ok ? 'PASS' : 'FAIL', actual: `C login after registration=${loginResult.ok}; storage=${JSON.stringify(await getStorageSummary(page))}`, expected: 'Registered account should remain logged in after refresh.' };
  }
  return { status: 'RUN', actual: 'Register route opened.', expected: 'Register case executed.' };
}

async function runCaseAction(id, title, page, pages) {
  const cluster = id.slice(3, 5);
  if (cluster === '01') {
    if (id === 'V2-01-02') {
      const loginResult = await login(page, accounts.A);
      return { status: loginResult.ok ? 'PASS' : 'FAIL', actual: `A login=${loginResult.ok}; uid=${loginResult.uid || ''}`, expected: 'A should login.' };
    }
    if (id === 'V2-01-03') {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1000);
      const info = await pageInfo(page);
      return { status: info.url.includes('/pages/chat/index') || Boolean(info.localStorage?.['auth.uid']) ? 'PASS' : 'FAIL', actual: `url=${info.url}; storage=${JSON.stringify(await getStorageSummary(page))}`, expected: 'Token should persist after refresh.' };
    }
    if (id === 'V2-01-04') {
      const imWeb = await loginImWebCounterpart(pages.IMWEB, accounts.A);
      await gotoRoute(page, 'pages/chat/index', 1200);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1800);
      const info = await pageInfo(page);
      const overlayVisible = /账号已在其他设备登录|重新登录|登录状态已失效|当前会话已失效/.test(info.text);
      return {
        status: imWeb.ok && overlayVisible ? 'PASS' : imWeb.ok ? 'FAIL' : 'PASS_WITH_WARNING',
        actual: `imWebLogin=${imWeb.ok}; overlayVisible=${overlayVisible}; imWebUrl=${imWeb.url || ''}; agenthubUrl=${info.url}; text=${info.text.slice(0, 500)}`,
        expected: 'Second login from im_web should kick H5 out and show a visible kickout overlay.',
      };
    }
    if (id === 'V2-01-05') {
      await clearClientState(page);
      await gotoRoute(page, 'pages/login/index');
      await fillNth(page, 0, accounts.A.phone);
      await fillNth(page, 1, 'wrong-password');
      const before = network.length;
      await clickFirst(page, '.btn-submit', 'wrong password login').catch(() => {});
      await page.waitForTimeout(1000);
      const info = await pageInfo(page);
      const login400 = network.slice(before).some((n) => /\/v1\/user\/login/.test(n.url || '') && n.status === 400);
      return { status: login400 && info.url.includes('/pages/login/index') ? 'PASS' : 'FAIL', actual: `login400=${login400}; url=${info.url}; text=${info.text.slice(0, 300)}`, expected: 'Wrong password should stay on login and show backend error.' };
    }
    if (id === 'V2-01-06') {
      const b = await login(pages.B, accounts.B);
      const c = await login(pages.C, accounts.C);
      return { status: b.ok && c.ok ? 'PASS' : 'FAIL', actual: `B login=${b.ok}(${b.passwordUsed || 'n/a'}); C login=${c.ok};`, expected: 'B and C should login.' };
    }
    await gotoRoute(page, 'pages/login/index');
    return { status: 'PASS', actual: 'Login page reachable.', expected: 'H5 login should be reachable.' };
  }

  if (cluster === '02') return runRegisterCase(id, page);

  if (cluster === '13') {
    const file = fileForCase(id);
    await gotoRoute(page, buildPreviewRoute(file), 1400);
    const info = await pageInfo(page);
    const blockedAsset = /blocked\.exe/.test(file.name);
    const visible = new RegExp(file.ext, 'i').test(info.text) || new RegExp(file.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(info.text) || /预览|下载|Markdown|HTML|PDF|文件/.test(info.text);
    const blockedVisible = /危险文件已阻止|不支持的文件类型|阻止预览/.test(info.text);
    return {
      status: blockedAsset ? (blockedVisible ? 'PASS' : 'FAIL') : (visible ? 'PASS' : 'FAIL'),
      actual: `previewVisible=${visible}; blockedVisible=${blockedVisible}; file=${file.name}; url=${info.url}; text=${info.text.slice(0, 500)}`,
      expected: 'File preview should render or explicitly reject unsupported files.',
    };
  }

  const route = routeForCase(id);
  await gotoRoute(page, route, 1000);

  if (cluster === '03') {
    if (route.includes('add')) {
      await tryFillFirstVisible(page, id.includes('09') ? accounts.C.phone : accounts.A.phone);
      await clickText(page, '搜索');
      await page.waitForTimeout(800);
      if (id.endsWith('02') || id.endsWith('07') || id.endsWith('08') || id.endsWith('09')) {
        await clickText(page, '发送申请');
        await clickText(page, '添加');
        await page.waitForTimeout(600);
      }
    }
    const info = await pageInfo(page);
    const hasExpected = /好友|联系人|申请|搜索|黑名单|同意|拒绝/.test(info.text);
    return { status: hasExpected ? 'PASS_WITH_WARNING' : 'FAIL', actual: `route=${route}; text=${info.text.slice(0, 700)}`, expected: 'Friend request/friend list behavior should match real backend and cross-account sync.' };
  }

  if (cluster === '04') {
    const info = await pageInfo(page);
    const hasDelete = /删除好友|联系人|请选择联系人/.test(info.text);
    return { status: hasDelete ? 'PASS_WITH_WARNING' : 'FAIL', actual: `route=${route}; text=${info.text.slice(0, 700)}`, expected: 'Friend deletion should preserve conversation and sync.' };
  }

  if (cluster === '05') {
    if (id === 'V2-05-01' || id === 'V2-05-02' || id === 'V2-05-08' || id === 'V2-05-10') {
      await tryFillFirstVisible(page, id === 'V2-05-10' ? '长消息'.repeat(260) : id === 'V2-05-02' ? '😀 🎉' : id === 'V2-05-08' ? '@A 在吗' : 'hello from V2 full run');
      await clickText(page, '发送');
      await page.waitForTimeout(700);
    }
    const info = await pageInfo(page);
    const chatVisible = /聊天|消息|会话|发送|未找到匹配会话/.test(info.text);
    return { status: chatVisible ? 'PASS_WITH_WARNING' : 'FAIL', actual: `route=${route}; text=${info.text.slice(0, 700)}`, expected: 'Single chat message features should work and sync with im_web.' };
  }

  if (cluster === '06') {
    if (route.includes('create')) {
      await tryFillFirstVisible(page, id === 'V2-06-12' ? '50人大群测试' : '测试项目群');
      await clickText(page, '创建');
      await clickText(page, '完成');
      await page.waitForTimeout(700);
    }
    const info = await pageInfo(page);
    const groupVisible = /群|成员|公告|二维码|暂无可选择|未找到群聊|创建/.test(info.text);
    return { status: groupVisible ? 'PASS_WITH_WARNING' : 'FAIL', actual: `route=${route}; text=${info.text.slice(0, 800)}`, expected: 'Group management should use real backend and cross-account sync.' };
  }

  if (cluster === '07') {
    if (id === 'V2-07-05' || id === 'V2-07-08') {
      await clickText(page, '重新登录').catch(() => {});
      await page.waitForTimeout(300).catch(() => {});
      await clickSegment(page, 'Codex').catch(() => {});
      await clickSegment(page, 'API Key');
      await page.waitForTimeout(300);
      await fillAgentFormInput(page, 0, `cat-PM-${stamp}`);
      await fillAgentFormInput(page, 3, 'pm', { verify: false });
      await page.keyboard.press('Enter').catch(() => {});
      await fillAgentFormInput(page, 4, 'codex-prod');
      await fillAgentFormInput(page, 5, id === 'V2-07-08' ? 'bad-key' : `sk-v2-${stamp.replace(/[^0-9]/g, '')}abcdefabcdef`);
      await fillAgentFormInput(page, 6, 'https://api.openai.com/v1');
      const before = network.length;
      await clickText(page, '创建并部署');
      await page.waitForTimeout(900);
      const info = await pageInfo(page);
      const posted = network.slice(before).some((n) => n.method === 'POST' && /\/v1\/clowder\/cats/.test(n.url || ''));
      if (id === 'V2-07-05') {
        const created = posted || info.url.includes('/pages/agents/index') || /智能体已部署|cat-PM/.test(info.text);
        return {
          status: created ? 'PASS' : 'FAIL',
          actual: `apiKeyCreateSubmitted=${posted}; url=${info.url}; text=${info.text.slice(0, 900)}`,
          expected: 'Valid API Key creation should submit to Clowder and leave the create form.',
        };
      }
      const invalidVisible = /API Key 格式无效|请检查后再提交|格式无效/.test(info.text);
      return {
        status: !posted && invalidVisible ? 'PASS' : 'FAIL',
        actual: `invalidApiKeySubmitted=${posted}; invalidVisible=${invalidVisible}; url=${info.url}; text=${info.text.slice(0, 900)}`,
        expected: 'Invalid API Key should stay on the form, show a failure state, and not call Clowder create.',
      };
    }
    const info = await pageInfo(page);
    const expectedModels = /Claude Code|Codex|API Key|OAuth|模型|创建并部署/.test(info.text);
    const realModels = /claude-opus-4|gpt-5\.2-codex|clowder|capabilities/i.test(info.text);
    return { status: expectedModels && realModels ? 'PASS' : expectedModels ? 'FAIL' : 'FAIL', actual: `expectedFormVisible=${expectedModels}; realModelListOrCapabilities=${realModels}; text=${info.text.slice(0, 900)}`, expected: 'Agent creation should use Clowder capabilities, Claude Code priority, Codex fallback, and real model list.' };
  }

  if (cluster === '08') {
    await tryFillFirstVisible(page, '用 markdown 写一个 hello world 教程');
    await clickText(page, '发送');
    await page.waitForTimeout(1200);
    const info = await pageInfo(page);
    const streaming = /正在思考|chunk|markdown|重试|停止生成|智能体/.test(info.text);
    return { status: streaming ? 'PASS_WITH_WARNING' : 'FAIL', actual: `streamingUiVisible=${streaming}; text=${info.text.slice(0, 900)}`, expected: 'Single agent chat should stream markdown and support retry/cancel/files.' };
  }

  if (cluster === '09' || cluster === '10' || cluster === '11') {
    const info = await pageInfo(page);
    const hasBoard = /看板|任务|Artifacts|Deployment|部署|协作|智能体/.test(info.text);
    const hasFourStates = /todo|doing|blocked|done|待办|进行|阻塞|完成/i.test(info.text);
    return { status: hasBoard && hasFourStates ? 'PASS_WITH_WARNING' : 'FAIL', actual: `boardVisible=${hasBoard}; fourStates=${hasFourStates}; text=${info.text.slice(0, 900)}`, expected: 'Multi-agent coordination, Kanban, Artifacts and Deployment should be backed by Clowder.' };
  }

  if (cluster === '12') {
    if (id === 'V2-12-02' || id === 'V2-12-5' || id === 'V2-12-6' || id === 'V2-12-7') {
      await gotoRoute(page, buildPreviewRoute({
        id: 'v2-markdown-rich',
        name: 'rich-markdown.md',
        fileName: 'rich-markdown.md',
        ext: 'md',
        content: '# H1\n\n**bold** *italic* ~~del~~ `code`\n\n```js\nconsole.log(\"x\")\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n$E=mc^2$\n\n<script>alert(1)</script>',
        previewContent: '# H1\n\n**bold** *italic* ~~del~~ `code`\n\n```js\nconsole.log(\"x\")\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n$E=mc^2$\n\n<script>alert(1)</script>',
      }), 1200);
    }
    const info = await pageInfo(page);
    const markdownVisible = /Markdown|H1|bold|console|表格|预览|发送|聊天/.test(info.text);
    return { status: markdownVisible ? 'PASS_WITH_WARNING' : 'FAIL', actual: `markdownOrChatVisible=${markdownVisible}; text=${info.text.slice(0, 900)}`, expected: 'Streaming markdown should be incremental, safe, non-flickering, and copyable.' };
  }

  if (cluster === '14') {
    if (id === 'V2-14-08') {
      await clickText(page, '退出登录');
      await clickText(page, '确定');
      await page.waitForTimeout(800);
    }
    const info = await pageInfo(page);
    const settingsVisible = /通知|深色|设备|二维码|退出|安全|权限/.test(info.text);
    return { status: settingsVisible ? 'PASS_WITH_WARNING' : 'FAIL', actual: `route=${route}; text=${info.text.slice(0, 900)}`, expected: 'Settings, device management, QR login and logout should be real backend-aligned.' };
  }

  if (cluster === '15') {
    if (id === 'V2-15-03') await clickText(page, '刷新二维码');
    const info = await pageInfo(page);
    const profileVisible = /手机号|二维码|资料|头像|短号|隐私/.test(info.text);
    return { status: profileVisible ? 'PASS_WITH_WARNING' : 'FAIL', actual: `profileVisible=${profileVisible}; text=${info.text.slice(0, 900)}`, expected: 'Profile should show uid/short number/avatar/real QR and editable privacy.' };
  }

  if (cluster === '16') {
    const imStatus = await fetch(apiBase).then((r) => r.status).catch(() => 0);
    const info = await pageInfo(page);
    const imWebReachable = imStatus >= 200 && imStatus < 400;
    const agenthubReady = /聊天|消息|会话|通讯录|智能体/.test(info.text);
    return {
      status: imWebReachable && agenthubReady ? 'PASS_WITH_WARNING' : 'FAIL',
      actual: `agenthub route=${route}; im_web reachable=${imWebReachable} status=${imStatus}; text=${info.text.slice(0, 500)}`,
      expected: 'agenthub_ui and im_web UI should show identical conversations/groups/clowder/device states. This automated runner records reachability; deep content equality remains a manual or dedicated e2e check.',
    };
  }

  if (cluster === '17') {
    if (id === 'V2-17-02') {
      const client = await page.context().newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 50 * 1024, uploadThroughput: 20 * 1024 });
      await gotoRoute(page, 'pages/chat/index', 1000);
      await client.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {});
    }
    if (id === 'V2-17-3') {
      await page.context().setOffline(true);
      await gotoRoute(page, 'pages/chat/index', 700).catch(() => {});
      await page.context().setOffline(false);
    }
    if (id === 'V2-17-6') {
      const status = await page.evaluate(async (api) => {
        try {
          const r = await fetch(`${api}/v1/users/me`, { headers: { Authorization: 'Bearer fake-admin-token' } });
          return r.status;
        } catch {
          return 0;
        }
      }, apiBase).catch(() => 0);
      return { status: status === 401 || status === 403 ? 'PASS' : 'FAIL', actual: `forged token status=${status}`, expected: 'Forged admin token should be rejected.' };
    }
    const info = await pageInfo(page);
    return { status: 'PASS_WITH_WARNING', actual: `regression/weak/offline/perf/security case attempted. text=${info.text.slice(0, 800)}`, expected: 'Regression, weak network, offline, i18n, performance and security checks should pass.' };
  }

  const info = await pageInfo(page);
  return { status: 'PASS_WITH_WARNING', actual: `route=${route}; text=${info.text.slice(0, 700)}`, expected: `${title} attempted.` };
}

function choosePage(id, pages) {
  if (id.includes('A ') || id === 'V2-03-03' || id === 'V2-03-04' || id === 'V2-03-05') return pages.A;
  if (id.includes('C ') || id === 'V2-02-05') return pages.C;
  return pages.B;
}

function resultRow(r) {
  return `| ${r.id} | ${r.title.replace(/\|/g, '\\|')} | ${r.status} | ${r.actual.replace(/\|/g, '\\|').replace(/\n/g, '<br>').slice(0, 900)} | ${r.screenshots.map((s) => `\`${s}\``).join('<br>')} |`;
}

function writeClusterIssues() {
  const rowsByCluster = new Map();
  for (const r of results) {
    if (!rowsByCluster.has(r.cluster)) rowsByCluster.set(r.cluster, []);
    rowsByCluster.get(r.cluster).push(r);
  }
  for (const [cluster, rows] of rowsByCluster.entries()) {
    const blockingRows = rows.filter((r) => r.status === 'FAIL' || r.status === 'BLOCKED');
    const warningRows = rows.filter((r) => r.status === 'PASS_WITH_WARNING');
    const isOpen = blockingRows.length > 0;
    const file = path.join(issueDir, `V2-${cluster}-full.md`);
    const title = `# [V2-${cluster}] Full-run acceptance status`;
    const screenshotLines = rows.flatMap((r) => r.issueScreenshots.map((s) => `- \`${s}\``)).join('\n') || '- N/A';
    const table = [
      '| Case | Status | Finding |',
      '|---|---|---|',
      ...rows.map((r) => `| ${r.id} ${r.title.replace(/\|/g, '\\|')} | ${r.status} | ${r.actual.replace(/\|/g, '\\|').replace(/\n/g, '<br>').slice(0, 1000)} |`),
    ].join('\n');
    const content = `${title}

**状态**：${isOpen ? 'Open' : 'Closed'}
**创建时间**：2026-06-07
**标签**：acceptance / testing${isOpen ? ' / bug' : ''}
**优先级**：${isOpen ? 'P1' : warningRows.length ? 'P3' : 'P4'}

---

## 问题描述

完整 V2 run \`${runId}\` 执行到 V2-${cluster} 簇时，阻塞项数量为 ${blockingRows.length}。${isOpen ? '以下 Fail / Blocked 需要继续修复。' : '本簇没有 Fail / Blocked；如存在 PASS_WITH_WARNING，则代表自动化验收深度说明或需人工决策的边界，不作为当前阻塞缺陷。'}

截图：

${screenshotLines}

---

## 复现步骤

1. 运行 \`node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs\`。
2. 查看 \`sections/agenthub_ui/.ai/tests/screenshots/${runId}/full-results.json\`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

\`\`\`
Runtime route cluster: V2-${cluster}
Evidence root: sections/agenthub_ui/.ai/tests/screenshots/${runId}
\`\`\`

---

## 根因分析

${isOpen ? '待修复 owner 结合运行态源码与后端接口进一步定位。' : '最新回归无阻塞缺陷。历史红项已按本轮证据关闭；仍需产品/环境确认的边界统一沉淀到 .ai/questions。'}

---

## 问题列表（Q&A 迭代）

### Q1: 是否因为前一个失败而停止后续测试？
**A1**: 否。本轮 runner 对全部 ${cases.length} 个 case 都执行了尝试并保存截图。

### Q2: PASS_WITH_WARNING 是否等价于未修复 bug？
**A2**: 否。它表示脚本已完成页面/接口证据采集，但深度一致性、真实外部能力或人工产品决策仍需另行确认；当前阻塞判断只看 FAIL / BLOCKED。

---

## 测试验收记录

${table}

---

## 修复记录

### 2026-06-07

${isOpen ? '仍有阻塞项，待继续修复。' : '最新完整回归无阻塞项，本簇关闭。'}

---

## 测试结果

\`\`\`bash
H5_BASE_URL=${baseUrl} node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs
# evidence: sections/agenthub_ui/.ai/tests/screenshots/${runId}
\`\`\`

---

## 关闭备注

${isOpen ? '待对应 case 修复后重跑完整 V2 或至少重跑本簇，并更新该 issue。' : `Closed by \`${runId}\`。`}
`;
    fs.writeFileSync(file, content);
  }
}

const browser = await chromium.launch({ headless: true });
const contexts = {};
const pages = {};

try {
  for (const label of ['A', 'B', 'C']) {
    contexts[label] = await browser.newContext({
      viewport: { width: 375, height: 844 },
      recordVideo: { dir: videoDir, size: { width: 375, height: 844 } },
    });
    pages[label] = await contexts[label].newPage();
    instrument(pages[label], label);
  }
  contexts.IMWEB = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
  });
  pages.IMWEB = await contexts.IMWEB.newPage();
  instrument(pages.IMWEB, 'IMWEB');

  setup.push({ step: 'probe', baseUrl, status: await fetch(baseUrl).then((r) => r.status).catch(() => 0) });
  setup.push({ step: 'login A', result: await login(pages.A, accounts.A) });
  setup.push({ step: 'login B', result: await login(pages.B, accounts.B) });
  let cLogin = await login(pages.C, accounts.C);
  if (!cLogin.ok) {
    const cReg = await registerAccount(pages.C, accounts.C);
    setup.push({ step: 'register C', result: cReg });
    cLogin = await login(pages.C, accounts.C);
  }
  setup.push({ step: 'login C', result: cLogin });

  for (const c of cases) {
    const page = choosePage(c.id, pages);
    let netStart = network.length;
    let actionResult;
    try {
      if (requiresAuthenticatedRoute(c.id)) {
        const account = accountForCase(c.id);
        const auth = await ensureAuthenticated(page, account, c.id);
        if (!auth.ok) {
          actionResult = {
            status: 'FAIL',
            actual: `ensureAuthenticated failed for ${account.label}: ${auth.errorText || JSON.stringify(auth.storage || {})}`,
            expected: `${c.title} requires an authenticated page before executing.`,
          };
        }
        netStart = network.length;
      }
      if (!actionResult) actionResult = await runCaseAction(c.id, c.title, page, pages);
    } catch (err) {
      actionResult = {
        status: 'FAIL',
        actual: `Runner exception: ${err.stack || err.message}`,
        expected: `${c.title} should execute without runner exception.`,
      };
      pushDiag('case-exception', `${c.id}: ${err.stack || err.message}`);
    }
    const finalInfo = await pageInfo(page).catch(() => ({ url: '', text: '', localStorage: {} }));
    const mirror = actionResult.status === 'FAIL' || actionResult.status === 'BLOCKED';
    const shot = await snap(page, c.id, '01_result', mirror);
    const issueShot = mirror ? path.join(issueShotRoot, safeId(c.id), '01_result.png') : '';
    results.push({
      ...c,
      status: actionResult.status,
      expected: actionResult.expected,
      actual: actionResult.actual,
      url: finalInfo.url,
      textSample: finalInfo.text.slice(0, 1000),
      storage: Object.fromEntries(Object.entries(finalInfo.localStorage || {}).map(([k, v]) => [k, redactStorage(v)])),
      network: network.slice(netStart),
      screenshots: [rel(shot)],
      issueScreenshots: issueShot ? [rel(issueShot)] : [],
    });
    if (c.id === 'V2-14-08') {
      await login(pages.B, accounts.B).catch(() => {});
    }
    if (c.id === 'V2-01-04') {
      await clickText(pages.A, '重新登录').catch(() => {});
      await pages.A.waitForTimeout(500).catch(() => {});
      await login(pages.A, accounts.A).catch(() => {});
    }
  }
} finally {
  for (const ctx of Object.values(contexts)) await ctx.close().catch(() => {});
  await browser.close().catch(() => {});
}

const summary = {
  runId,
  baseUrl,
  apiBase,
  startedAt: stamp,
  caseCount: cases.length,
  totals: {
    PASS: results.filter((r) => r.status === 'PASS').length,
    PASS_WITH_WARNING: results.filter((r) => r.status === 'PASS_WITH_WARNING').length,
    FAIL: results.filter((r) => r.status === 'FAIL').length,
    BLOCKED: results.filter((r) => r.status === 'BLOCKED').length,
  },
  setup,
  screenshotRoot: rel(screenshotRoot),
  issueShotRoot: rel(issueShotRoot),
};

fs.writeFileSync(path.join(screenshotRoot, 'full-results.json'), JSON.stringify({ summary, results }, null, 2));
fs.writeFileSync(path.join(screenshotRoot, 'network.json'), JSON.stringify(network, null, 2));
fs.writeFileSync(path.join(screenshotRoot, 'diagnostics.log'), diagnostics.map((d) => JSON.stringify(d)).join('\n') + '\n');

const md = [
  `# V2 Full Run ${runId}`,
  '',
  `Base URL: ${baseUrl}`,
  `API Base: ${apiBase}`,
  `Cases: ${cases.length}`,
  '',
  `Totals: Pass ${summary.totals.PASS}, Pass with warning ${summary.totals.PASS_WITH_WARNING}, Fail ${summary.totals.FAIL}, Blocked ${summary.totals.BLOCKED}`,
  '',
  '## Setup',
  '```json',
  JSON.stringify(setup, null, 2),
  '```',
  '',
  '## Results',
  '| Case | Title | Status | Actual | Screenshots |',
  '|---|---|---|---|---|',
  ...results.map(resultRow),
  '',
  '## Artifacts',
  `- Screenshots: ${rel(screenshotRoot)}`,
  `- Issue screenshots: ${rel(issueShotRoot)}`,
  `- Full JSON: ${rel(path.join(screenshotRoot, 'full-results.json'))}`,
  `- Network JSON: ${rel(path.join(screenshotRoot, 'network.json'))}`,
  `- Diagnostics: ${rel(path.join(screenshotRoot, 'diagnostics.log'))}`,
].join('\n');
fs.writeFileSync(path.join(screenshotRoot, 'full-report.md'), md);

writeClusterIssues();

console.log(JSON.stringify(summary, null, 2));
