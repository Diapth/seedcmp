import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { login, runId } from './helpers/v3-clowder';

const staleConversationPayload = {
  conversations: [{
    channel_id: 'clowder_ai',
    channel_type: 1,
    timestamp: 1700000010,
    last_msg_seq: 0,
    last_msg_time: 1700000010,
    unread: 1,
    recents: [{
      message_seq: 0,
      timestamp: 1700000010,
      from_uid: 'clowder_ai',
      channel_id: 'clowder_ai',
      channel_type: 1,
      payload: { type: 1, text: '/cats' }
    }],
    extra: {
      channel_id: 'clowder_ai',
      channel_type: 1,
      draft: '/cats',
      version: 100
    }
  }],
  users: [{
    uid: 'clowder_ai',
    name: 'Clowder AI',
    avatar: '',
    mute: 0,
    top: 0
  }],
  groups: []
};

test.describe('local AI draft and unread refresh smoke', () => {
  test.skip(
    !process.env.RUN_DRAFT_UNREAD_REFRESH_SMOKE,
    'Requires a running IM Web dev server and login-capable TangSeng API.',
  );

  test('does not revive cleared local AI draft or stale unread after refresh', async ({ page }) => {
    const id = runId('local-ai-draft-unread-refresh');
    const outputDir = path.resolve(process.cwd(), '../../.ai/V3.0/tests-e2e', id);
    await mkdir(outputDir, { recursive: true });

    const failures: string[] = [];
    page.on('pageerror', err => failures.push(`pageerror: ${err.message}`));
    page.on('requestfailed', req => {
      const errorText = req.failure()?.errorText || 'unknown';
      if (errorText !== 'net::ERR_ABORTED') {
        failures.push(`requestfailed: ${req.method()} ${req.url()} ${errorText}`);
      }
    });

    await page.route('**/v1/conversation/sync', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(staleConversationPayload)
    }));
    await page.route('**/v1/conversation/extra/sync', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ channel_id: 'clowder_ai', channel_type: 1, draft: '/cats', version: 100 }])
    }));
    await page.route('**/v1/coversation/clearUnread', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({})
    }));

    await login(page);

    const clowderRow = page.locator('.conversation-item', { hasText: 'Clowder AI' }).first();
    await expect(clowderRow.locator('.unread-badge')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(outputDir, '01-stale-unread-before-open.png'), fullPage: true });

    await clowderRow.click();
    await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 10000 });
    const input = page.locator('.input-textarea');
    await input.fill('/cats');
    await input.fill('');
    await page.reload();
    await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 10000 });
    await expect(input).toHaveValue('', { timeout: 10000 });
    await page.screenshot({ path: path.join(outputDir, '02-cleared-draft-after-reload.png'), fullPage: true });

    await page.goto('/chat');
    await page.reload();
    const refreshedRow = page.locator('.conversation-item', { hasText: 'Clowder AI' }).first();
    await expect(refreshedRow).toBeVisible({ timeout: 10000 });
    await expect(refreshedRow.locator('.unread-badge')).toHaveCount(0);
    await page.screenshot({ path: path.join(outputDir, '03-no-stale-unread-after-refresh.png'), fullPage: true });

    const result = {
      runId: id,
      failures,
      screenshots: [
        path.join(outputDir, '01-stale-unread-before-open.png'),
        path.join(outputDir, '02-cleared-draft-after-reload.png'),
        path.join(outputDir, '03-no-stale-unread-after-refresh.png')
      ],
      url: page.url(),
      recordedAt: new Date().toISOString()
    };
    await writeFile(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2));
    expect(failures).toEqual([]);
  });
});
