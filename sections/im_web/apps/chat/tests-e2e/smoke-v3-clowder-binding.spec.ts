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
  openConversation,
  openDirectConversation,
  openGroupConversation,
  runId,
  sendChatMessage,
  waitForNewClowderReply,
} from './helpers/v3-clowder';

test.describe('V3 Clowder direct and group binding smoke', () => {
  test.describe.configure({ timeout: 180000 });

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
    await expect(page.locator('.message-list .clowder-meta').last()).toBeVisible({ timeout: 60000 });

    await openGroupConversation(page);
    await openClowderPanel(page);
    const groupThreadBefore = await clowderThreadId(page);
    expect(groupThreadBefore).toBeTruthy();

    const groupMessage = `@${agent} ${id} group binding smoke`;
    const groupCount = await clowderReplyCount(page);
    await sendChatMessage(page, groupMessage);
    await waitForNewClowderReply(page, groupCount);
    await expectTextOnceAfterReload(page, groupMessage);
    await expect(page.locator('.message-list .clowder-meta').last()).toBeVisible({ timeout: 60000 });

    const secondUserAvailable = Boolean(process.env.TEST_B_USERNAME && process.env.TEST_B_PASSWORD);
    if (secondUserAvailable) {
      const { context, page: pageB } = await createSecondUserContext(browser);
      try {
        const configuredGroup = env('TEST_GROUP_CONVERSATION');
        const secondUserGroup = configuredGroup
          ? pageB.locator('.conversation-item', { hasText: configuredGroup }).first()
          : pageB.locator('.conversation-item[data-channel-type="2"]').filter({ hasText: /群|Group|测试链条/i }).first();
        if (!(await secondUserGroup.isVisible().catch(() => false))) {
          test.info().annotations.push({
            type: 'skip-note',
            description: 'Second-account group visibility check skipped because the group is not visible for TEST_B_USERNAME.',
          });
          return;
        }
        await openConversation(pageB, { item: secondUserGroup });
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
