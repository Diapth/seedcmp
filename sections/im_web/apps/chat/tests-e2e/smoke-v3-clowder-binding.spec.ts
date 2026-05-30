import { expect, test } from '@playwright/test';
import {
  closeContexts,
  clowderReplyCount,
  clowderThreadId,
  createSecondUserContext,
  env,
  expectTextOnceAfterReload,
  login,
  openClowderPanel,
  openDirectConversation,
  openGroupConversation,
  runId,
  sendChatMessage,
  waitForNewClowderReply,
} from './helpers/v3-clowder';

test.describe('V3 Clowder direct and group binding smoke', () => {
  test.skip(
    !process.env.RUN_V3_CLOWDER_SMOKE,
    'Requires TangSeng, WuKongIM, Clowder API, signed bridge env, one direct chat, and one group chat.',
  );

  test('binds direct and group conversations and shows one durable reply after refresh', async ({ page, browser }) => {
    const agent = env('TEST_AGENT_A', 'codex').replace(/^@/, '');
    const id = runId('v3-binding');

    await login(page);

    await openDirectConversation(page);
    await openClowderPanel(page);
    const directThreadBefore = await clowderThreadId(page);
    expect(directThreadBefore).toBeTruthy();

    const directMessage = `@${agent} ${id} direct binding smoke`;
    const directCount = await clowderReplyCount(page);
    await sendChatMessage(page, directMessage);
    await waitForNewClowderReply(page, directCount);
    await expectTextOnceAfterReload(page, directMessage);
    await waitForNewClowderReply(page, directCount);

    await openGroupConversation(page);
    await openClowderPanel(page);
    const groupThreadBefore = await clowderThreadId(page);
    expect(groupThreadBefore).toBeTruthy();

    const groupMessage = `@${agent} ${id} group binding smoke`;
    const groupCount = await clowderReplyCount(page);
    await sendChatMessage(page, groupMessage);
    await waitForNewClowderReply(page, groupCount);
    await expectTextOnceAfterReload(page, groupMessage);
    await waitForNewClowderReply(page, groupCount);

    const secondUserAvailable = Boolean(process.env.TEST_B_USERNAME && process.env.TEST_B_PASSWORD);
    if (secondUserAvailable) {
      const { context, page: pageB } = await createSecondUserContext(browser);
      try {
        await openGroupConversation(pageB);
        await expect(pageB.locator('.message-list').getByText(groupMessage, { exact: true }).last()).toBeVisible({
          timeout: 15000,
        });
        await expect(pageB.locator('.message-list .clowder-meta').last()).toBeVisible({ timeout: 60000 });
      } finally {
        await closeContexts([context]);
      }
    } else {
      test.info().annotations.push({
        type: 'skip-note',
        description: 'TEST_B_USERNAME/TEST_B_PASSWORD not set; second-account group visibility check skipped.',
      });
    }
  });
});
