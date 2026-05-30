import { expect, test } from '@playwright/test';
import {
  clowderReplyCount,
  env,
  expectCommandResponse,
  expectNoDeepSeekFallback,
  login,
  openClowderPanel,
  openGroupConversation,
  runId,
  sendChatMessage,
  waitForNewClowderReply,
} from './helpers/v3-clowder';

test.describe('V3 Clowder multi-agent smoke', () => {
  test.skip(
    !process.env.RUN_V3_CLOWDER_SMOKE,
    'Requires TangSeng, WuKongIM, Clowder API, signed bridge env, and two configured Clowder agents.',
  );

  test('routes @mention and /ask to two different agents from one group', async ({ page }) => {
    const agentA = env('TEST_AGENT_A', 'codex').replace(/^@/, '');
    const agentB = env('TEST_AGENT_B');
    test.skip(!agentB, 'Set TEST_AGENT_B to run two-agent routing smoke.');
    const normalizedAgentB = agentB.replace(/^@/, '');
    const id = runId('v3-agents');

    await login(page);
    await openGroupConversation(page);

    let count = await clowderReplyCount(page);
    await sendChatMessage(page, `@${agentA} ${id} agent-a`);
    await waitForNewClowderReply(page, count);
    await expect(page.locator('.message-list .clowder-cat').last()).toContainText(new RegExp(agentA, 'i'), {
      timeout: 10000,
    });

    count = await clowderReplyCount(page);
    await sendChatMessage(page, `/ask ${normalizedAgentB} ${id} agent-b`);
    await waitForNewClowderReply(page, count);
    await expect(page.locator('.message-list .clowder-cat').last()).toContainText(new RegExp(normalizedAgentB, 'i'), {
      timeout: 10000,
    });

    await sendChatMessage(page, `/focus ${agentA}`);
    await expectCommandResponse(page, /focus|preferred|已设置|聚焦|默认/i);

    await openClowderPanel(page);
    await expect(page.locator('.clowder-panel')).toContainText(new RegExp(agentA, 'i'), { timeout: 10000 });

    count = await clowderReplyCount(page);
    await sendChatMessage(page, `${id} follow up without explicit mention`);
    await waitForNewClowderReply(page, count);
    await expectNoDeepSeekFallback(page);

    count = await clowderReplyCount(page);
    await sendChatMessage(page, `@${agentA} ${id} concurrent-a`);
    await sendChatMessage(page, `@${normalizedAgentB} ${id} concurrent-b`);
    await expect.poll(async () => clowderReplyCount(page), { timeout: 90000 }).toBeGreaterThanOrEqual(count + 2);
    await expectNoDeepSeekFallback(page);
  });
});
