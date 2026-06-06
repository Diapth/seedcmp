import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const baseUrl = (process.env.H5_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const loginUrl = `${baseUrl}/#/pages/login/index`;

const viewports = [
  { width: 375, height: 844, name: '375x844_mobile' },
  { width: 768, height: 1024, name: '768x1024_tablet' },
  { width: 1024, height: 768, name: '1024x768_desktop_small' },
  { width: 1440, height: 900, name: '1440x900_desktop_large' }
];

function getExecutablePath() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`Found local browser at: ${p}`);
      return p;
    }
  }
  return null;
}

async function run() {
  const screenshotDir = path.resolve('issues/screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log('Launching browser...');
  const executablePath = getExecutablePath();
  const launchOptions = {};
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage();

  // Capture browser console logs and page errors for diagnostic purposes
  page.on('console', msg => {
    console.log(`BROWSER LOG [${msg.type()}]:`, msg.text());
  });
  page.on('pageerror', exception => {
    console.log('BROWSER EXCEPTION:', exception.stack || exception.message || exception);
  });
  page.on('unhandledrejection', msg => {
    console.log('BROWSER UNHANDLED REJECTION:', msg.failure()?.errorText || msg);
  });
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText));
  page.on('response', res => {
    if (res.status() >= 400) {
      console.log('HTTP ERROR:', res.url(), res.status());
    }
  });

  console.log(`Navigating to ${loginUrl} ...`);
  let success = false;
  for (let i = 0; i < 15; i++) {
    try {
      await page.goto(loginUrl, { timeout: 5000 });
      success = true;
      break;
    } catch (e) {
      console.log('Waiting for dev server to be ready...');
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!success) {
    console.error(`Failed to connect to dev server on ${baseUrl}`);
    process.exit(1);
  }

  // Wait for the login page elements to render to avoid capturing a blank or white screen
  console.log('Waiting 3 seconds for hydration diagnostics...');
  await page.waitForTimeout(3000);
  try {
    const diag = await page.evaluate(() => {
      return {
        title: document.title,
        appHtml: document.getElementById('app') ? document.getElementById('app').innerHTML : 'no-app-element',
        uniExists: typeof uni !== 'undefined',
        getAppExists: typeof getApp !== 'undefined',
        windowKeys: Object.keys(window).filter(k => k.toLowerCase().includes('uni') || k.toLowerCase().includes('vue') || k.toLowerCase().includes('pinia')),
        location: window.location.href
      };
    });
    console.log('HYDRATION DIAGNOSTICS:', diag);
  } catch(e) {
    console.log('Failed to evaluate diagnostics:', e);
  }

  console.log('Waiting for .login-page to load...');
  try {
    await page.waitForSelector('.login-page', { timeout: 12000 });
  } catch (err) {
    console.error('Timeout waiting for .login-page. Current page content:');
    console.log(await page.content());
    const errorScreenshotPath = path.join(screenshotDir, 'setup_timeout_error.png');
    await page.screenshot({ path: errorScreenshotPath });
    console.log(`Saved timeout error screenshot to ${errorScreenshotPath}`);
    throw err;
  }

  for (const vp of viewports) {
    console.log(`Setting viewport: ${vp.width}x${vp.height}`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(1000);
    const screenshotPath = path.join(screenshotDir, `setup_${vp.name}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved screenshot to ${screenshotPath}`);
  }

  await browser.close();
  console.log('Smoke test and screenshots completed successfully!');
}

run().catch(err => {
  console.error('SMOKE TEST RUN ERROR:', err);
  process.exit(1);
});
