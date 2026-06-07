import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const agenthubBaseUrl = (process.env.AGENTHUB_H5_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
const imWebBaseUrl = (process.env.IM_WEB_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const apiBaseUrl = `${imWebBaseUrl}/v1`;
const username = process.env.TEST_USERNAME || '008618337488675';
const password = process.env.TEST_PASSWORD || '';
const runId = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
const shortRun = runId.slice(-6).toLowerCase();
const evidenceDir = path.resolve('.ai', 'tests-e2e', `v1-3-${runId}`);
const events = [];
const apiEvidence = {};

const catName = `V13验收猫${shortRun}`;
const catAlias = `@v13${shortRun}`;
const projectName = `V13验收项目${shortRun}`;
const deploymentTitle = `V1-3 deployment ${shortRun}`;

fs.mkdirSync(evidenceDir, { recursive: true });

function record(type, detail = {}) {
  events.push({
    at: new Date().toISOString(),
    type,
    ...detail
  });
}

function redactToken(value = '') {
  const token = String(value || '');
  return token ? `${token.slice(0, 6)}...${token.slice(-6)}` : '';
}

function sanitized(value) {
  if (Array.isArray(value)) return value.map(sanitized);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (/token|password/i.test(key)) return [key, redactToken(item)];
    return [key, sanitized(item)];
  }));
}

function exactText(value) {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s*${escaped}\\s*$`);
}

function conversationItemByName(page, name) {
  return page.locator('.conversation-item').filter({
    has: page.locator('.item-name', { hasText: exactText(name) })
  }).first();
}

function capturePage(page, label) {
  page.on('console', (msg) => {
    record('console', { page: label, level: msg.type(), text: msg.text().slice(0, 1000) });
  });
  page.on('pageerror', (error) => {
    record('pageerror', { page: label, message: error.message, stack: error.stack });
  });
  page.on('requestfailed', (request) => {
    record('requestfailed', { page: label, url: request.url(), failure: request.failure()?.errorText || '' });
  });
  page.on('response', (response) => {
    const url = response.url();
    const status = response.status();
    if (url.includes('/v1/clowder/') || url.includes('/v1/message/send')) {
      record('api-response', { page: label, url, status });
    }
    if (status >= 400) {
      record('http-error', { page: label, url, status });
    }
  });
}

async function api(pathname, { method = 'GET', token = '', body } = {}) {
  const response = await fetch(`${apiBaseUrl}/${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { token, Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${method} ${pathname} failed ${response.status}: ${JSON.stringify(json).slice(0, 800)}`);
  }
  return json;
}

async function loginApi() {
  if (!password) {
    throw new Error('TEST_PASSWORD is required for V1-3 live E2E');
  }
  const login = await api('user/login', {
    method: 'POST',
    body: {
      username,
      password,
      flag: 1,
      device: {
        device_id: `agenthub-v13-${runId}`,
        device_name: 'AgentHub V1-3 E2E',
        device_model: 'playwright',
        device_type: 2
      }
    }
  });
  const data = login.data || login;
  const token = data.token || data.access_token || data.accessToken || '';
  if (!token) throw new Error('API login did not return token');
  apiEvidence.login = {
    uid: data.uid || data.user?.uid || data.user_id || '',
    token: redactToken(token)
  };
  record('api-login-ok', apiEvidence.login);
  return { token, uid: apiEvidence.login.uid };
}

async function loginAgenthub(page) {
  await page.goto(`${agenthubBaseUrl}/#/pages/login/index`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.login-page', { timeout: 15000 });
  const inputs = page.locator('.form-container input.uni-input-input');
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.locator('.btn-submit').click();
  await page.waitForSelector('.conversation-item', { timeout: 25000 });
  record('agenthub-login-ok');
}

async function loginImWeb(page) {
  await page.goto(`${imWebBaseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/手机号|账号|username/i).fill(username);
  await page.getByPlaceholder(/密码|password/i).fill(password);
  await page.getByRole('button', { name: /安全登录|登录|login/i }).click();
  await page.waitForSelector('.conversation-item', { timeout: 25000 });
  record('imweb-login-ok');
}

async function createOAuthCat(token) {
  const response = await api('clowder/cats', {
    method: 'POST',
    token,
    body: {
      name: catName,
      alias: catAlias,
      platform: 'claude-code',
      clientId: 'claude-code',
      authType: 'oauth',
      accountRef: 'claude',
      defaultModel: 'opus',
      roleTemplateId: 'coordinator',
      capabilities: ['V1-3验收', '项目拆解']
    }
  });
  const agent = response.agent || response.cat || response.data?.agent || response.data?.cat || {};
  const catId = agent.catId || agent.cat_id || agent.id;
  if (!catId) throw new Error(`create cat response missing catId: ${JSON.stringify(response)}`);
  apiEvidence.cat = sanitized({ catId, agent, runtimeChoice: 'Claude Code', oauthProvider: 'claude' });
  record('oauth-cat-created', { catId, catName });
  return { catId, agent };
}

async function createProjectGroup(token, catId, agent) {
  const response = await api('clowder/project-groups/ensure', {
    method: 'POST',
    token,
    body: {
      projectName,
      pmDirectChannelId: 'clowder_cat:coordinator',
      pmDirectChannelType: 1,
      projectThreadId: `v1-3-thread-${runId}`,
      pmMemberId: 'clowder_cat:coordinator',
      pmDisplayName: 'PM',
      catMemberIds: [catId],
      createdBy: 'pm'
    }
  });
  const binding = response.binding || response.data?.binding;
  if (!binding?.projectGroupNo) throw new Error(`project group response missing projectGroupNo: ${JSON.stringify(response)}`);

  await api('clowder/group/cats/sync', {
    method: 'POST',
    token,
    body: {
      groupId: binding.projectGroupNo,
      groupName: projectName,
      catIds: [catId],
      cats: [agent],
      proactiveReplies: true,
      autoReplyMode: 'soft_mentions',
      prompt: `V1-3 acceptance project group with ${catName}`
    }
  });

  apiEvidence.projectGroup = sanitized({ binding, group: response.group, catId });
  record('project-group-created', {
    projectName,
    groupNo: binding.projectGroupNo,
    bindingId: binding.id,
    catId
  });
  return binding;
}

async function createDeploymentRequestForHydration(token, binding) {
  const deployment = await api('clowder/conversation/deployment-request', {
    method: 'POST',
    token,
    body: {
      channelId: binding.projectGroupNo,
      channelType: 2,
      threadId: binding.projectThreadId,
      sourceMessageId: `v1-3-source-${runId}`,
      cardMessageId: `v1-3-card-${runId}`,
      originalText: `${deploymentTitle}: deploy AgentHub UI acceptance artifact to preview`,
      target: 'agenthub-ui',
      environment: 'preview',
      workspacePath: 'sections/agenthub_ui',
      forceNew: true
    }
  });
  const deploymentRequest = deployment.deploymentRequest || deployment.data?.deploymentRequest;
  if (!deploymentRequest?.id) throw new Error(`deployment response missing id: ${JSON.stringify(deployment)}`);

  const active = await api(`clowder/conversation/deployment-request/active?channelId=${encodeURIComponent(binding.projectGroupNo)}&channelType=2`, {
    token
  });

  apiEvidence.deployment = sanitized({
    deploymentRequest,
    activeDeploymentRequest: active.deploymentRequest || active.data?.deploymentRequest || active
  });
  record('deployment-request-created-for-card-hydration', {
    deploymentRequestId: deploymentRequest.id,
    groupNo: binding.projectGroupNo
  });
  return deploymentRequest;
}

async function verifyAgenthubAgentsPage(page) {
  await page.goto(`${agenthubBaseUrl}/#/pages/agents/index`, { waitUntil: 'domcontentloaded' });
  await page.getByText(catName, { exact: false }).first().waitFor({ state: 'visible', timeout: 25000 });
  await page.screenshot({ path: path.join(evidenceDir, '01-agenthub-agent-directory-oauth-cat.png'), fullPage: true });
  record('agenthub-agent-directory-visible', { catName });
}

async function verifyAgenthubProjectGroup(page, deploymentRequest) {
  await page.goto(`${agenthubBaseUrl}/#/pages/chat/index`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const item = conversationItemByName(page, projectName);
  await item.waitFor({ state: 'visible', timeout: 30000 });
  await page.screenshot({ path: path.join(evidenceDir, '02-agenthub-project-group-list.png'), fullPage: true });
  await item.click();
  await page.waitForSelector('.chat-header', { timeout: 15000 });
  await page.locator('.chat-title', { hasText: exactText(projectName) }).first().waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.deployment-card', { hasText: deploymentTitle }).first().waitFor({ state: 'visible', timeout: 25000 });
  await page.screenshot({ path: path.join(evidenceDir, '03-agenthub-deployment-card-before-confirm.png'), fullPage: true });
  record('agenthub-deployment-card-visible', {
    deploymentRequestId: deploymentRequest.id,
    groupNo: deploymentRequest.channelId || deploymentRequest.channel_id || ''
  });
}

async function confirmAgenthubDeployment(page, deploymentRequest) {
  const card = page.locator('.deployment-card', { hasText: deploymentTitle }).first();
  const responsePromise = page.waitForResponse((response) => (
    response.url().includes('/v1/clowder/conversation/deployment-action') && response.status() < 500
  ), { timeout: 20000 });
  await card.locator('.action-btn', { hasText: exactText('确认') }).first().click();
  const response = await responsePromise;
  const body = await response.json().catch(() => ({}));
  apiEvidence.deploymentAction = sanitized({ status: response.status(), body });
  await page.screenshot({ path: path.join(evidenceDir, '04-agenthub-deployment-card-after-confirm.png'), fullPage: true });
  record('agenthub-deployment-confirm-clicked', {
    deploymentRequestId: deploymentRequest.id,
    status: response.status()
  });
}

async function verifyImWebProjectGroup(page) {
  await page.goto(`${imWebBaseUrl}/chat`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const item = conversationItemByName(page, projectName);
  await item.waitFor({ state: 'visible', timeout: 30000 });
  await item.click();
  await page.waitForSelector('.message-list', { timeout: 15000 });
  await page.locator('.channel-name', { hasText: exactText(projectName) }).first().waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.deployment-card', { hasText: 'agenthub-ui' }).first().waitFor({ state: 'visible', timeout: 25000 });
  await page.screenshot({ path: path.join(evidenceDir, '05-imweb-project-group-deployment-card.png'), fullPage: true });
  record('imweb-project-group-visible', { projectName });
}

async function main() {
  const browser = await chromium.launch();
  const agenthubContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const imWebContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 844 }, isMobile: true });
  const agenthubPage = await agenthubContext.newPage();
  const imWebPage = await imWebContext.newPage();
  const mobilePage = await mobileContext.newPage();
  capturePage(agenthubPage, 'agenthub_ui');
  capturePage(imWebPage, 'im_web');
  capturePage(mobilePage, 'agenthub_ui_mobile');

  try {
    record('run-start', {
      agenthubBaseUrl,
      imWebBaseUrl,
      username,
      catName,
      projectName,
      deploymentTitle
    });

    const { token } = await loginApi();
    await loginAgenthub(agenthubPage);
    await loginImWeb(imWebPage);

    const { catId, agent } = await createOAuthCat(token);
    const binding = await createProjectGroup(token, catId, agent);
    const deploymentRequest = await createDeploymentRequestForHydration(token, binding);

    await verifyAgenthubAgentsPage(agenthubPage);
    await verifyAgenthubProjectGroup(agenthubPage, deploymentRequest);
    await verifyImWebProjectGroup(imWebPage);
    await confirmAgenthubDeployment(agenthubPage, deploymentRequest);

    await loginAgenthub(mobilePage);
    await mobilePage.goto(`${agenthubBaseUrl}/#/pages/chat/index`, { waitUntil: 'domcontentloaded' });
    await mobilePage.getByText(projectName, { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 });
    await mobilePage.screenshot({ path: path.join(evidenceDir, '06-agenthub-mobile-project-group.png'), fullPage: true });

    record('run-pass', {
      catId,
      projectGroupNo: binding.projectGroupNo,
      deploymentRequestId: deploymentRequest.id,
      runtimeChoice: 'Claude Code',
      oauthProvider: 'claude'
    });
  } catch (error) {
    record('run-fail', { message: error.message, stack: error.stack });
    await agenthubPage.screenshot({ path: path.join(evidenceDir, 'error-agenthub.png'), fullPage: true }).catch(() => undefined);
    await imWebPage.screenshot({ path: path.join(evidenceDir, 'error-imweb.png'), fullPage: true }).catch(() => undefined);
    await mobilePage.screenshot({ path: path.join(evidenceDir, 'error-agenthub-mobile.png'), fullPage: true }).catch(() => undefined);
    throw error;
  } finally {
    fs.writeFileSync(path.join(evidenceDir, 'events.json'), JSON.stringify(events, null, 2));
    fs.writeFileSync(path.join(evidenceDir, 'api-evidence.json'), JSON.stringify(apiEvidence, null, 2));
    await browser.close();
    console.log(`Evidence written to ${evidenceDir}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
