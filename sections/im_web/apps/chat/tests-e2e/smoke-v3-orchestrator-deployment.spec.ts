import { expect, test } from '@playwright/test';
import { login, sendChatMessage } from './helpers/v3-clowder';

test.describe('V3 orchestrator to deployment demo', () => {
  test.describe.configure({ timeout: 240000 });

  test.beforeEach(() => {
    test.skip(
      process.env.RUN_V3_CLOWDER_SMOKE !== '1',
      'Set RUN_V3_CLOWDER_SMOKE=1 to run the orchestrator deployment browser smoke.',
    );
  });

  test('creates a deployment card, confirms it, opens preview, and posts a coordinator summary', async ({ page }) => {
    await login(page);

    const groupId = process.env.TEST_GROUP_CONVERSATION_ID || '16e006b0b84f40faaa77a271e69b5021';
    const target = process.env.TEST_DEPLOYMENT_TARGET || 'packages/api/qa-test-page.html';
    const prompt = process.env.TEST_ORCHESTRATOR_DEPLOYMENT_PROMPT ||
      '@协调者 请协调团队做一个“AgentHub 咖啡店活动页”静态页面，要求 Claude/Codex 至少一个真实执行，完成后部署到 preview 环境，最后在聊天里给我预览链接、源码下载链接、执行分工和风险说明。';

    await page.goto(`/chat/conversation/${groupId}/2`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.message-list')).toBeVisible({ timeout: 20000 });

    const cardsBefore = await page.locator('.deployment-card').count();
    await sendChatMessage(page, prompt);
    await expect.poll(async () => page.locator('.deployment-card').count(), { timeout: 60000 }).toBeGreaterThan(cardsBefore);

    const card = page.locator('.deployment-card').last();
    await expect(card).toBeVisible({ timeout: 10000 });

    await card.getByPlaceholder('输入部署目标').fill(target);
    await card.getByPlaceholder('输入部署目标').press('Enter');
    await expect.poll(async () => {
      const confirm = card.getByRole('button', { name: /确认/ });
      return !(await confirm.isDisabled().catch(() => true));
    }, { timeout: 30000 }).toBe(true);

    await card.getByRole('button', { name: /确认/ }).click();
    await expect(card).toContainText('部署成功', { timeout: 90000 });
    await expect(card.getByRole('button', { name: '打开预览' })).toBeVisible();
    await expect(card.getByRole('button', { name: '下载源码包' })).toBeVisible();

    await card.getByRole('button', { name: '打开预览' }).click();
    await expect(page.locator('.chat-side-preview iframe[title="部署预览"]')).toBeVisible({ timeout: 10000 });
    await expect.poll(async () => {
      const frame = page.frames().find((item) => /\/api\/deployments\/.+\/preview/.test(item.url()));
      const text = frame ? await frame.locator('body').textContent().catch(() => '') : '';
      return (text || '').replace(/\s+/g, ' ').trim().length;
    }, { timeout: 30000 }).toBeGreaterThan(20);

    await expect(page.locator('.message-list')).toContainText('Coordinator / Deployment 结果汇总', { timeout: 30000 });
    await expect(page.locator('.message-list')).toContainText('预览链接', { timeout: 30000 });
    await expect(page.locator('.message-list')).toContainText('源码下载', { timeout: 30000 });
  });
});
