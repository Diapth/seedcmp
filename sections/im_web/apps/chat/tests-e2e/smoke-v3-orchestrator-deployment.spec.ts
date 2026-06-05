import { expect, test } from '@playwright/test';
import { login, sendChatMessage } from './helpers/v3-clowder';

function normalizeAgentMention(value: string) {
  const text = value.trim();
  if (!text) return '';
  return text.startsWith('@') ? text : `@${text}`;
}

function buildDemoPrompt() {
  const agentMentions = [process.env.TEST_AGENT_A || '', process.env.TEST_AGENT_B || '']
    .map(normalizeAgentMention)
    .filter(Boolean)
    .join(' 和 ');
  const teamText = agentMentions ? `请协调 ${agentMentions}` : '请协调团队';

  return process.env.TEST_ORCHESTRATOR_DEPLOYMENT_PROMPT ||
    `@协调者 ${teamText} 做一个“AgentHub 咖啡店活动页”静态页面，要求 Claude/Codex 至少一个真实执行，完成后部署到 preview 环境，最后在聊天里给我预览链接、源码下载链接、执行分工和风险说明。`;
}

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
    const prompt = buildDemoPrompt();

    await page.goto(`/chat/conversation/${groupId}/2`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.message-list')).toBeVisible({ timeout: 20000 });

    const cardsBefore = await page.locator('.deployment-card').count();
    await sendChatMessage(page, prompt);
    await expect.poll(async () => {
      const cards = page.locator('.deployment-card');
      const count = await cards.count();
      if (count > cardsBefore) return true;
      if (count === 0) return false;

      const status = (await cards.last().locator('.deployment-status').textContent().catch(() => '') || '').trim();
      return /需要补充信息|待确认/.test(status);
    }, { timeout: 60000 }).toBe(true);

    const card = page.locator('.deployment-card').last();
    await expect(card).toBeVisible({ timeout: 10000 });

    const previewOption = card.locator('.deployment-candidate', { hasText: /预览|preview/i }).first();
    if (await previewOption.isVisible().catch(() => false)) {
      await previewOption.click();
    }

    const targetInput = card.getByPlaceholder('输入部署目标');
    await targetInput.fill(target);
    const applyTarget = card.getByRole('button', { name: '应用' });
    if (await applyTarget.isEnabled().catch(() => false)) {
      await applyTarget.click();
    } else {
      await targetInput.press('Enter');
    }
    await expect(card).toContainText(target, { timeout: 30000 });
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
