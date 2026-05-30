import { expect, test } from '@playwright/test';
import {
  env,
  expectMessageWithoutClowderMeta,
  expectTextOnceAfterReload,
  login,
  openConversation,
  openV2Conversation,
  runId,
  sendChatMessage,
} from './helpers/v3-clowder';

test.describe('V3 Clowder V2 regression safety net', () => {
  test.skip(
    !process.env.RUN_V3_CLOWDER_SMOKE,
    'Requires runnable IM Web and one non-Clowder conversation.',
  );

  test('keeps non-Clowder messaging and optional V2 robot history working', async ({ page }) => {
    const id = runId('v3-v2');
    await login(page);

    await openV2Conversation(page);
    const normalMessage = `${id} v2 normal message`;
    await sendChatMessage(page, normalMessage);
    await expectMessageWithoutClowderMeta(page, normalMessage);
    await expectTextOnceAfterReload(page, normalMessage);
    await expectMessageWithoutClowderMeta(page, normalMessage);

    const robotConversation = env('TEST_V2_ROBOT_CONVERSATION');
    if (!robotConversation) {
      test.info().annotations.push({
        type: 'skip-note',
        description: 'TEST_V2_ROBOT_CONVERSATION not set; V2 robot reply assertion skipped.',
      });
      return;
    }

    await openConversation(page, { name: robotConversation, reason: `V2 robot conversation ${robotConversation} is not visible.` });
    await expect(page.locator('.ai-contact-panel, .robot-panel, body')).toContainText(/DeepSeek AI|AI 联系人|机器人/i, {
      timeout: 10000,
    });
    const robotMessage = `${id} v2 robot prompt`;
    await sendChatMessage(page, robotMessage);
    await expect(page.locator('.message-list .msg-row').filter({ hasNotText: robotMessage }).last()).toBeVisible({
      timeout: 60000,
    });
    await expect(page.locator('.message-list .clowder-meta')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.message-list')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.message-list .clowder-meta')).toHaveCount(0);
  });
});
