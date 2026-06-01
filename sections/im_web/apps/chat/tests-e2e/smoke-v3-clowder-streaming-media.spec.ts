import { expect, test } from '@playwright/test';
import {
  clowderReplyCount,
  env,
  login,
  openClowderPanel,
  openGroupConversation,
  runId,
  sendChatMessage,
  waitForNewClowderReply,
} from './helpers/v3-clowder';

test.describe('V3 Clowder streaming and media smoke', () => {
  test.describe.configure({ timeout: 180000 });

  test.skip(
    !process.env.RUN_V3_CLOWDER_SMOKE,
    'Requires runnable IM Web, TangSeng/WuKongIM, Clowder API, streaming agent, and media fixtures.',
  );

  test('streams one reply, refreshes, and keeps media fallback visible', async ({ page, context }) => {
    const agent = env('TEST_AGENT_A', 'codex').replace(/^@/, '');
    const id = runId('v3-stream');

    await login(page);
    await openGroupConversation(page);

    const before = await clowderReplyCount(page);
    await sendChatMessage(page, `@${agent} ${id} stream a long markdown answer with several paragraphs`);
    await waitForNewClowderReply(page, before, 90000);

    const afterFirstReply = await clowderReplyCount(page);
    await page.reload();
    await expect(page.locator('.message-list')).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => clowderReplyCount(page), { timeout: 30000 }).toBeGreaterThanOrEqual(afterFirstReply);

    if (process.env.TEST_UNSUPPORTED_MEDIA_MESSAGE) {
      await sendChatMessage(page, `${id} ${process.env.TEST_UNSUPPORTED_MEDIA_MESSAGE}`);
      await expect(page.locator('.unsupported-media, [data-testid="clowder-unsupported-media"]')).toBeVisible({
        timeout: 60000,
      });
    } else {
      test.info().annotations.push({
        type: 'skip-note',
        description: 'TEST_UNSUPPORTED_MEDIA_MESSAGE not set; live unsupported-media assertion skipped.',
      });
    }

    await openClowderPanel(page);
    await page.route('**/clowder/status**', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ state: 'error', enabled: true, configured: true, reachable: false, reason: 'clowder_unavailable' }),
      });
    });
    await page.reload();
    await openClowderPanel(page);
    await expect(page.locator('.clowder-panel, .clowder-status-badge')).toContainText(/error|unavailable|clowder_unavailable/i, {
      timeout: 15000,
    });
    await page.unroute('**/clowder/status**');

    const offlineBefore = await clowderReplyCount(page);
    await sendChatMessage(page, `@${agent} ${id} browser offline recovery`);
    await waitForNewClowderReply(page, offlineBefore, 90000);
    await context.setOffline(true);
    await page.waitForTimeout(1000);
    await context.setOffline(false);
    await page.reload();
    await expect.poll(async () => clowderReplyCount(page), { timeout: 30000 }).toBeGreaterThanOrEqual(offlineBefore + 1);
  });
});
