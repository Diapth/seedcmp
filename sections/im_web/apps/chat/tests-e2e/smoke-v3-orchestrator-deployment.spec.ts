import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { login, sendChatMessage } from './helpers/v3-clowder';

const terminalDeploymentStatusPattern = /部署成功|部署失败|已取消|部署已完成/;
const actionableDeploymentStatusPattern = /需要补充信息|待确认/;

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

async function deploymentCardText(card: Locator) {
  return ((await card.textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
}

async function deploymentStatusText(card: Locator) {
  return ((await card.locator('.deployment-status').textContent().catch(() => '')) || '').trim();
}

async function deploymentMetaValue(card: Locator, index: number) {
  return ((await card.locator('.deployment-meta dd').nth(index).textContent().catch(() => '')) || '').trim();
}

async function findDeploymentTargetCandidate(card: Locator, target: string) {
  const targetLabel = target.split('/').pop() || target;
  const candidates = card.locator('.deployment-field').first().locator('.deployment-candidate');
  const count = await candidates.count();
  let labelMatch = -1;
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    const title = ((await candidate.getAttribute('title').catch(() => '')) || '').trim();
    const label = ((await candidate.textContent().catch(() => '')) || '').trim();
    if (title === target || label === target) return candidate;
    if (labelMatch < 0 && label === targetLabel) labelMatch = index;
  }
  return labelMatch >= 0 ? candidates.nth(labelMatch) : null;
}

async function findActionableDeploymentCardIndex(page: Page) {
  const cards = page.locator('.deployment-card');
  const count = await cards.count();
  for (let index = count - 1; index >= 0; index -= 1) {
    const card = cards.nth(index);
    const status = await deploymentStatusText(card);
    const text = await deploymentCardText(card);
    if (terminalDeploymentStatusPattern.test(`${status} ${text}`)) continue;
    if (actionableDeploymentStatusPattern.test(status) || /待确认目标|请先补充部署/.test(text)) {
      return index;
    }
  }
  return -1;
}

async function findConfirmableDeploymentCardIndex(page: Page, target: string) {
  const cards = page.locator('.deployment-card');
  const count = await cards.count();
  for (let index = count - 1; index >= 0; index -= 1) {
    const card = cards.nth(index);
    const status = await deploymentStatusText(card);
    const text = await deploymentCardText(card);
    if (terminalDeploymentStatusPattern.test(`${status} ${text}`)) continue;
    const selectedTarget = await deploymentMetaValue(card, 0);
    const confirm = card.getByRole('button', { name: /确认/ });
    const confirmDisabled = await confirm.isDisabled().catch(() => true);
    const confirmLabel = (await confirm.getAttribute('aria-label').catch(() => '')) || '';
    if (selectedTarget === target && !confirmDisabled && !/请先补充/.test(confirmLabel)) {
      return index;
    }
  }
  return -1;
}

async function waitForDeploymentCard(page: Page, cardsBefore: number) {
  const cards = page.locator('.deployment-card');
  let cardIndex = -1;

  try {
    await expect.poll(async () => {
      if (await cards.count() <= cardsBefore) return -1;
      cardIndex = await findActionableDeploymentCardIndex(page);
      return cardIndex;
    }, { timeout: 15000 }).toBeGreaterThanOrEqual(0);
  } catch {
    await expect.poll(async () => {
      cardIndex = await findActionableDeploymentCardIndex(page);
      return cardIndex;
    }, { timeout: 45000 }).toBeGreaterThanOrEqual(0);
  }

  return cards.nth(cardIndex);
}

async function ensurePreviewEnvironment(card: Locator) {
  const environment = (await deploymentMetaValue(card, 1)).toLowerCase();
  if (environment === 'preview') return;

  const previewOption = card.locator('.deployment-candidate', { hasText: /预览|preview/i }).first();
  if (await previewOption.isVisible().catch(() => false)) {
    await previewOption.click();
    await expect.poll(async () => {
      return (await deploymentMetaValue(card, 1)).toLowerCase();
    }, { timeout: 30000 }).toBe('preview');
  }
}

async function commitDeploymentTarget(page: Page, card: Locator, target: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const activeCardIndex = await findActionableDeploymentCardIndex(page);
    const editableCard = activeCardIndex >= 0 ? page.locator('.deployment-card').nth(activeCardIndex) : card;
    const targetCandidate = await findDeploymentTargetCandidate(editableCard, target);

    if (targetCandidate && await targetCandidate.isVisible().catch(() => false)) {
      await targetCandidate.click();
    } else {
      const targetInput = editableCard.getByPlaceholder('输入部署目标');
      await targetInput.fill(target);
      await expect(targetInput).toHaveValue(target, { timeout: 5000 });

      const applyTarget = editableCard.getByRole('button', { name: '应用' });
      if (await applyTarget.isEnabled({ timeout: 5000 }).catch(() => false)) {
        await applyTarget.click();
      } else {
        await targetInput.press('Enter');
        await targetInput.blur();
      }
    }

    await page.waitForTimeout(1000);
    const confirmableCardIndex = await findConfirmableDeploymentCardIndex(page, target);
    if (confirmableCardIndex >= 0) {
      return page.locator('.deployment-card').nth(confirmableCardIndex);
    }
  }

  await sendChatMessage(page, `部署 ${target} 到 preview 环境。`);
  await page.waitForTimeout(1000);

  let confirmableCardIndex = -1;
  await expect.poll(async () => {
    confirmableCardIndex = await findConfirmableDeploymentCardIndex(page, target);
    return confirmableCardIndex;
  }, { timeout: 45000 }).toBeGreaterThanOrEqual(0);

  return page.locator('.deployment-card').nth(confirmableCardIndex);
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
    const target = process.env.TEST_DEPLOYMENT_TARGET || 'packages/api/data/agenthub-coffee-event/index.html';
    const prompt = buildDemoPrompt();

    await page.goto(`/chat/conversation/${groupId}/2`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.message-list')).toBeVisible({ timeout: 20000 });

    const cardsBefore = await page.locator('.deployment-card').count();
    await sendChatMessage(page, prompt);
    let card = await waitForDeploymentCard(page, cardsBefore);
    await expect(card).toBeVisible({ timeout: 10000 });

    await ensurePreviewEnvironment(card);
    card = await commitDeploymentTarget(page, card, target);

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
