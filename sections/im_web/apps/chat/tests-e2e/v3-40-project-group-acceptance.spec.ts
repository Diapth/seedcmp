import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { login, runId, sendChatMessage } from './helpers/v3-clowder';

test.describe('V3-40 PM project group acceptance', () => {
  test.describe.configure({ timeout: 300000 });

  test.skip(
    !process.env.RUN_V3_40_ACCEPTANCE,
    'Set RUN_V3_40_ACCEPTANCE=1 to run the real V3-40 browser acceptance.',
  );

  test('creates a PM project group and routes execution into it', async ({ page }) => {
    const id = runId('v340');
    const projectName = `V340项目群${id.slice(-8)}`;
    const evidenceDir = path.resolve(
      process.cwd(),
      process.env.V3_40_EVIDENCE_DIR || `../../.ai/V3.0/tests-e2e/v3-40-${id}`,
    );
    await fs.mkdir(evidenceDir, { recursive: true });

    const browserConsole: string[] = [];
    const failedRequests: string[] = [];
    page.on('console', (msg) => {
      browserConsole.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('requestfailed', (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`.trim());
    });

    async function screenshot(name: string) {
      await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: true });
    }

    async function createOAuthCat() {
      const catName = `V340 Claude ${id.slice(-6)}`;
      const alias = `@v340claude${id.slice(-6).toLowerCase()}`;
      await page.goto('/chat/clowder-cats');
      await expect(page.locator('.cat-console-page')).toBeVisible({ timeout: 15000 });
      await screenshot('01-cat-console-before-create');

      await page.locator('input[placeholder="例如：代码助手"]').fill(catName);
      await page.locator('input[placeholder="例如：@codex"]').fill(alias);
      await page.locator('select').nth(1).selectOption('anthropic');
      await page.locator('select').nth(2).selectOption('oauth');
      await expect(page.locator('.oauth-status')).toContainText(/Claude Code|已配置|已检测到/, { timeout: 15000 });

      const createButton = page.locator('button:has-text("创建猫猫并连接")');
      await expect(createButton).toBeEnabled({ timeout: 20000 });
      await createButton.click();
      await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 30000 });
      await expect(page).toHaveURL(/\/chat\/conversation\/clowder_cat/i, { timeout: 30000 });
      await screenshot('02-claude-oauth-cat-created');
      return { catName, alias, catUrl: page.url() };
    }

    await login(page);
    await screenshot('00-after-login');
    const cat = await createOAuthCat();

    const pmChannelId = 'clowder_cat:coordinator';
    await page.goto(`/chat/conversation/${encodeURIComponent(pmChannelId)}/1`);
    await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 15000 });
    await screenshot('03-pm-direct-before-request');

    const taskText = `帮我做一个项目，项目名叫 ${projectName}，请 PM 创建项目群并拉猫猫执行，项目群里给出一句 V3-40 验收说明。`;
    await sendChatMessage(page, taskText);

    const confirmProjectGroupButton = page.getByRole('button', { name: '确认创建项目群' }).first();
    await expect(confirmProjectGroupButton).toBeVisible({ timeout: 15000 });
    await screenshot('04-pm-direct-confirmation-card');
    await confirmProjectGroupButton.click();

    const handoffButton = page.getByRole('button', { name: new RegExp(`打开项目群「${projectName}`) }).first();
    await expect(handoffButton).toBeVisible({ timeout: 45000 });
    await screenshot('05-pm-direct-handoff');

    const activeBinding = await page.evaluate(async ({ channelId, channelType }) => {
      const token = window.localStorage.getItem('token') || '';
      const params = new URLSearchParams({
        pmDirectChannelId: channelId,
        pmDirectChannelType: String(channelType),
      });
      const response = await fetch(`/v1/clowder/project-groups/active?${params.toString()}`, {
        headers: token ? { token } : {},
      });
      const body = await response.json().catch(() => ({}));
      return { status: response.status, body };
    }, { channelId: pmChannelId, channelType: 1 });
    expect(activeBinding.status).toBe(200);
    const activeCatMemberIds = Array.isArray(activeBinding.body?.binding?.catMemberIds)
      ? activeBinding.body.binding.catMemberIds.filter(Boolean)
      : [];
    expect(activeCatMemberIds.length).toBeGreaterThan(0);

    await handoffButton.click();
    await expect(page).toHaveURL(/\/chat\/conversation\/[^/]+\/2/, { timeout: 15000 });
    const groupUrl = page.url();
    const groupMatch = groupUrl.match(/\/chat\/conversation\/([^/]+)\/2/);
    const groupNo = decodeURIComponent(groupMatch?.[1] || '');
    expect(groupNo).toBeTruthy();
    await expect(page.locator('.message-list')).toBeVisible({ timeout: 15000 });
    await screenshot('06-project-group-opened');

    const clowderReplyCountBefore = await page.locator('.message-list .clowder-meta').count();
    await expect
      .poll(async () => page.locator('.message-list .clowder-meta').count(), { timeout: 180000 })
      .toBeGreaterThan(clowderReplyCountBefore);
    await screenshot('07-project-group-agent-reply');

    await page.goto(`/chat/group-members/${encodeURIComponent(groupNo)}`);
    await expect(page.locator('.members-page')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('body')).toContainText(/PM|协调者|clowder_cat:coordinator/, { timeout: 15000 });
    await expect(page.locator('.clowder-cat-member').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('body')).toContainText(new RegExp(activeCatMemberIds.map(id => String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')), { timeout: 15000 });
    await screenshot('08-project-group-members');

    await page.goto(`/chat/conversation/${encodeURIComponent(pmChannelId)}/1`);
    await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 15000 });
    const panelButton = page.getByTestId('clowder-panel-open').or(page.locator('button[title="Clowder"]')).first();
    await expect(panelButton).toBeVisible({ timeout: 15000 });
    await panelButton.click();
    const panel = page.locator('.clowder-panel').first();
    await expect(panel).toBeVisible({ timeout: 15000 });
    await expect(panel).toContainText(/Project Group|Project Thread|V340项目群/, { timeout: 15000 });
    await screenshot('09-pm-direct-panel-project-context');

    const finalBinding = await page.evaluate(async ({ channelId, channelType }) => {
      const token = window.localStorage.getItem('token') || '';
      const params = new URLSearchParams({
        pmDirectChannelId: channelId,
        pmDirectChannelType: String(channelType),
      });
      const response = await fetch(`/v1/clowder/project-groups/active?${params.toString()}`, {
        headers: token ? { token } : {},
      });
      const body = await response.json().catch(() => ({}));
      return { status: response.status, body };
    }, { channelId: pmChannelId, channelType: 1 });
    expect(finalBinding.status).toBe(200);
    expect(String(finalBinding.body?.binding?.projectThreadId || '')).not.toBe('');

    await fs.writeFile(
      path.join(evidenceDir, 'acceptance-result.json'),
      JSON.stringify({
        id,
        projectName,
        taskText,
        account: process.env.TEST_USERNAME || '18337488675',
        cat,
        pmChannelId,
        groupNo,
        groupUrl,
        activeBinding,
        finalBinding,
        failedRequests,
        browserConsole: browserConsole.slice(-200),
      }, null, 2),
    );
  });
});
