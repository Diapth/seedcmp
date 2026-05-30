import crypto from 'node:crypto';
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';

export const DEFAULT_USERNAME = '18337488675';
export const DEFAULT_PASSWORD = '123456';

export function env(name: string, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

export function clowderUrl() {
  return env('CLOWDER_URL', 'http://localhost:3003').replace(/\/$/, '');
}

export function runId(prefix = 'v3-smoke') {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
}

export function requireEnv(name: string, reason?: string) {
  const value = env(name);
  test.skip(!value, reason || `Set ${name} to run this V3 Clowder smoke.`);
  return value;
}

export async function skipIfNotVisible(locator: Locator, reason: string) {
  test.skip(!(await locator.isVisible().catch(() => false)), reason);
}

export async function login(page: Page, options: { username?: string; password?: string } = {}) {
  const username = options.username || env('TEST_USERNAME', DEFAULT_USERNAME);
  const password = options.password || env('TEST_PASSWORD', DEFAULT_PASSWORD);

  await page.goto('/login');
  await page.getByPlaceholder(/手机号|账号|username/i).fill(username);
  await page.getByPlaceholder(/密码|password/i).fill(password);
  await page.getByRole('button', { name: /安全登录|登录|login/i }).click();

  await expect(page).toHaveURL(/\/chat/, { timeout: 15000 });
  await expect(page.locator('.conversation-list-container')).toBeVisible({ timeout: 10000 });
}

export async function openConversation(
  page: Page,
  options: {
    name?: string;
    fallbackPattern?: RegExp;
    reason?: string;
  } = {},
) {
  await expect(page.locator('.conversation-list-container')).toBeVisible({ timeout: 10000 });
  const item = options.name
    ? page.locator('.conversation-item', { hasText: options.name }).first()
    : options.fallbackPattern
      ? page.locator('.conversation-item', { hasText: options.fallbackPattern }).first()
      : page.locator('.conversation-item').first();

  await skipIfNotVisible(item, options.reason || 'Required test conversation is not available.');
  await item.click();
  await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.message-list')).toBeVisible({ timeout: 10000 });
}

export async function openDirectConversation(page: Page) {
  await openConversation(page, {
    name: env('TEST_DIRECT_CONVERSATION'),
    reason: 'Set TEST_DIRECT_CONVERSATION or provide at least one visible direct conversation for V3 binding smoke.',
  });
}

export async function openGroupConversation(page: Page) {
  await openConversation(page, {
    name: env('TEST_GROUP_CONVERSATION'),
    fallbackPattern: /群|Group|测试链条/i,
    reason: 'Set TEST_GROUP_CONVERSATION or provide a visible group conversation for V3 group smoke.',
  });
}

export async function openV2Conversation(page: Page) {
  await openConversation(page, {
    name: env('TEST_V2_CONVERSATION'),
    reason: 'Set TEST_V2_CONVERSATION or provide a visible non-Clowder conversation for V2 regression smoke.',
  });
}

export async function sendChatMessage(page: Page, message: string) {
  const input = page.locator('.input-textarea');
  await expect(input).toBeVisible({ timeout: 10000 });
  await input.fill(message);
  await input.press('Enter');
  await expect(page.locator('.message-list').getByText(message, { exact: true }).last()).toBeVisible({ timeout: 10000 });
}

export async function openClowderPanel(page: Page) {
  const button = page.getByTestId('clowder-panel-open').or(page.locator('button[title="Clowder"]')).first();
  await expect(button).toBeVisible({ timeout: 10000 });
  await button.click();
  const panel = page.getByTestId('clowder-panel').or(page.locator('.clowder-panel')).first();
  await expect(panel).toBeVisible({ timeout: 10000 });
  return panel;
}

export async function clowderThreadId(page: Page) {
  const thread = page.getByTestId('clowder-thread-id').or(page.locator('.clowder-panel .thread-id')).first();
  await expect(thread).toBeVisible({ timeout: 10000 });
  return (await thread.textContent())?.trim() || '';
}

export async function expectPanelReadyOrExplained(page: Page) {
  const panel = page.getByTestId('clowder-panel').or(page.locator('.clowder-panel')).first();
  await expect(panel).toContainText(/Thread|Focus|Agents/, { timeout: 10000 });
  await expect
    .poll(async () => {
      const text = await panel.textContent();
      return /ready|disabled:|error:|denied|unconfigured|connecting|loading/i.test(text || '');
    }, { timeout: 15000 })
    .toBe(true);
}

export async function expectNoPanelClipping(page: Page) {
  const panel = page.getByTestId('clowder-panel').or(page.locator('.clowder-panel')).first();
  const box = await panel.boundingBox();
  expect(box?.width || 0).toBeGreaterThan(260);
  const firstAgent = page.getByTestId(/clowder-agent-row-/).or(page.locator('.clowder-panel .agent-row')).first();
  if (await firstAgent.isVisible().catch(() => false)) {
    const agentBox = await firstAgent.boundingBox();
    expect(agentBox?.width || 0).toBeGreaterThan(120);
    await expect(firstAgent).not.toHaveText('');
  }
}

export async function waitForNewClowderReply(page: Page, previousCount: number, timeout = 60000) {
  const meta = page.getByTestId('clowder-message-badge').or(page.locator('.message-list .clowder-meta'));
  await expect.poll(async () => meta.count(), { timeout }).toBeGreaterThan(previousCount);
  await expect(meta.last()).toBeVisible({ timeout: 5000 });
}

export async function clowderReplyCount(page: Page) {
  return page.getByTestId('clowder-message-badge').or(page.locator('.message-list .clowder-meta')).count();
}

export async function expectTextOnceAfterReload(page: Page, text: string) {
  await page.reload();
  await expect(page.locator('.message-list')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.message-list').getByText(text, { exact: true })).toHaveCount(1, { timeout: 15000 });
}

export async function expectMessageWithoutClowderMeta(page: Page, text: string) {
  const row = page.locator('.msg-row', { hasText: text }).last();
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect(row.locator('.clowder-meta, [data-testid="clowder-message-badge"]')).toHaveCount(0);
}

export async function expectCommandResponse(page: Page, pattern: RegExp) {
  await expect(
    page.getByTestId('clowder-command-response').or(page.locator('.sys-msg-row, .system-cell, .message-list')),
  ).toContainText(pattern, { timeout: 30000 });
}

export async function expectDenialVisible(page: Page) {
  await expect(page.locator('body')).toContainText(
    /group_not_allowed|command_admin_only|permission_denied|Clowder group not allowed|Clowder admin only|Clowder denied|未授权|管理员|无权/,
    { timeout: 30000 },
  );
}

export async function expectNoDeepSeekFallback(page: Page) {
  await expect(page.locator('.message-list')).not.toContainText(/deepseek_ai_robot|DeepSeek AI/);
}

export async function createSecondUserContext(browser: Browser) {
  const username = requireEnv('TEST_B_USERNAME', 'Set TEST_B_USERNAME for multi-account V3 Clowder smoke.');
  const password = requireEnv('TEST_B_PASSWORD', 'Set TEST_B_PASSWORD for multi-account V3 Clowder smoke.');
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { username, password });
  return { context, page };
}

export async function closeContexts(contexts: BrowserContext[]) {
  await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
}

export async function expectClowderPwaReady(page: Page) {
  await page.goto(clowderUrl(), { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
  const swReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unavailable';
    try {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<undefined>((resolve) => window.setTimeout(() => resolve(undefined), 5000)),
      ]);
      return registration?.active?.scriptURL || 'not-ready';
    } catch (err) {
      return `error:${err instanceof Error ? err.message : String(err)}`;
    }
  });
  expect(swReady).toBeTruthy();
  return swReady;
}

export async function expectClowderApiPreflight(request: APIRequestContext) {
  const base = clowderUrl();
  const identityHeaders = { 'x-cat-cafe-user': env('CLOWDER_TEST_USER', 'user-1') };

  const status = await request.get(`${base}/api/connectors/im-web/status`, { headers: identityHeaders });
  expect(status.status()).toBe(200);
  const statusBody = await status.json();
  expect(statusBody.connectorId).toBe('im-web');
  expect(statusBody).toHaveProperty('enabled');
  expect(statusBody).toHaveProperty('configured');
  expect(statusBody).toHaveProperty('reachable');
  expect(statusBody).toHaveProperty('version');
  expect(statusBody).toHaveProperty('featureFlags');

  const commands = await request.get(`${base}/api/commands?surface=connector`, { headers: identityHeaders });
  expect(commands.status()).toBe(200);
  const commandText = JSON.stringify(await commands.json());
  expect(commandText).toMatch(/\/status/);
  expect(commandText).toMatch(/\/cats/);
  expect(commandText).toMatch(/\/focus/);

  const cats = await request.get(`${base}/api/cats`, { headers: identityHeaders });
  expect(cats.status()).toBeLessThan(500);

  const externalChatId = env('TEST_EXTERNAL_CHAT_ID', '2:v3-smoke-unbound-probe');
  const agents = await request.get(
    `${base}/api/connectors/im-web/agents?externalChatId=${encodeURIComponent(externalChatId)}`,
    { headers: identityHeaders },
  );
  expect(agents.status()).toBeLessThan(500);
  if (agents.ok()) {
    const body = await agents.json();
    expect(body).toHaveProperty('agents');
  }

  return { status: statusBody, commands: commandText, agentsStatus: agents.status() };
}

export function signImWebPayload(payload: unknown, secret: string) {
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return { rawBody, timestamp, signature };
}

export async function postSignedInboundProbe(request: APIRequestContext, payload: Record<string, unknown>) {
  const secret = requireEnv('CLOWDER_CONNECTOR_SECRET', 'Set CLOWDER_CONNECTOR_SECRET to run signed inbound API probes.');
  const { rawBody, timestamp, signature } = signImWebPayload(payload, secret);
  return request.post(`${clowderUrl()}/api/connectors/im-web/inbound`, {
    data: rawBody,
    headers: {
      'content-type': 'application/json',
      'x-im-web-timestamp': timestamp,
      'x-im-web-signature': signature,
    },
  });
}
