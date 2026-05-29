import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { login, runId } from './helpers/v3-clowder';

test.describe('remote history sync smoke', () => {
  test.skip(
    !process.env.RUN_REMOTE_HISTORY_SMOKE,
    'Requires a running remote IM Web dev server and TangSeng API with seeded conversation history.',
  );

  test('loads historical conversations from the remote 3000 browser entrypoint', async ({ page }) => {
    const id = runId('remote-history-sync');
    const outputDir = path.resolve(process.cwd(), '../../.ai/V3.0/tests-e2e', id);
    await mkdir(outputDir, { recursive: true });

    const failures: string[] = [];
    page.on('pageerror', err => failures.push(`pageerror: ${err.message}`));
    page.on('requestfailed', req => failures.push(`requestfailed: ${req.method()} ${req.url()} ${req.failure()?.errorText || 'unknown'}`));

    const syncResponsePromise = page.waitForResponse(response => {
      return response.request().method() === 'POST' && /\/v1\/conversation\/sync\b/.test(response.url());
    }, { timeout: 30000 });

    await login(page);
    const syncResponse = await syncResponsePromise;
    const contentType = syncResponse.headers()['content-type'] || '';
    const body = await syncResponse.json();
    const conversations = Array.isArray(body?.conversations) ? body.conversations : [];

    await expect(page.locator('.conversation-item')).not.toHaveCount(0, { timeout: 15000 });
    await page.screenshot({ path: path.join(outputDir, '01-history-loaded.png'), fullPage: true });

    const result = {
      runId: id,
      status: syncResponse.status(),
      contentType,
      conversationCount: conversations.length,
      visibleConversationCount: await page.locator('.conversation-item').count(),
      failures,
      url: page.url(),
      recordedAt: new Date().toISOString(),
    };
    await writeFile(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2));

    expect(syncResponse.status()).toBe(200);
    expect(contentType).toMatch(/json/i);
    expect(conversations.length).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });
});
