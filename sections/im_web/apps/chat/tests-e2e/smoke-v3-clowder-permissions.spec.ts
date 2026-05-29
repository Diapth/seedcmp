import { expect, test } from '@playwright/test';
import {
  closeContexts,
  clowderReplyCount,
  clowderThreadId,
  createSecondUserContext,
  env,
  expectDenialVisible,
  login,
  openClowderPanel,
  openGroupConversation,
  runId,
  sendChatMessage,
  waitForNewClowderReply,
} from './helpers/v3-clowder';

test.describe('V3 Clowder group permissions smoke', () => {
  test.skip(
    !process.env.RUN_V3_CLOWDER_SMOKE,
    'Requires TangSeng, WuKongIM, Clowder API, signed bridge env, and two group users.',
  );

  test('allows one group, denies another, and blocks non-admin commands', async ({ page, browser }) => {
    const agent = env('TEST_AGENT_A', 'codex').replace(/^@/, '');
    const id = runId('v3-permission');

    await login(page);
    await openGroupConversation(page);

    if (process.env.V3_CLOWDER_MUTATE_PERMISSIONS === '1') {
      await sendChatMessage(page, '/allow-group');
      await expect(page.locator('.message-list')).toContainText(/allowed|授权|已允许|Clowder/i, { timeout: 30000 });
    }

    const beforeAllowed = await clowderReplyCount(page);
    await sendChatMessage(page, `@${agent} ${id} allowed permission smoke`);
    await waitForNewClowderReply(page, beforeAllowed);

    await openClowderPanel(page);
    const threadBeforeDeniedAttempt = await clowderThreadId(page);

    if (process.env.V3_CLOWDER_MUTATE_PERMISSIONS === '1') {
      await sendChatMessage(page, '/deny-group');
      await expectDenialVisible(page);
    } else if (process.env.TEST_DENIED_GROUP_CONVERSATION) {
      await openConversationByNameForPermission(page, process.env.TEST_DENIED_GROUP_CONVERSATION);
    } else {
      test.info().annotations.push({
        type: 'skip-note',
        description: 'Denied-group mutation skipped. Set V3_CLOWDER_MUTATE_PERMISSIONS=1 or TEST_DENIED_GROUP_CONVERSATION for denial assertions.',
      });
    }

    if (process.env.V3_CLOWDER_MUTATE_PERMISSIONS === '1' || process.env.TEST_DENIED_GROUP_CONVERSATION) {
      await sendChatMessage(page, `@${agent} ${id} denied permission smoke`);
      await expectDenialVisible(page);
    }

    const secondUserAvailable = Boolean(process.env.TEST_B_USERNAME && process.env.TEST_B_PASSWORD);
    if (secondUserAvailable) {
      const { context, page: pageB } = await createSecondUserContext(browser);
      try {
        await openGroupConversation(pageB);
        await sendChatMessage(pageB, `/focus ${agent}`);
        await expectDenialVisible(pageB);
        await openClowderPanel(page);
        const threadAfterDeniedAttempt = await clowderThreadId(page);
        expect(threadAfterDeniedAttempt).toBe(threadBeforeDeniedAttempt);
      } finally {
        await closeContexts([context]);
      }
    } else {
      test.info().annotations.push({
        type: 'skip-note',
        description: 'TEST_B_USERNAME/TEST_B_PASSWORD not set; non-admin command denial check skipped.',
      });
    }
  });
});

async function openConversationByNameForPermission(page: import('@playwright/test').Page, name: string) {
  const item = page.locator('.conversation-item', { hasText: name }).first();
  test.skip(!(await item.isVisible().catch(() => false)), `Denied group ${name} is not visible.`);
  await item.click();
  await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 10000 });
}
