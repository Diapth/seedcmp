import { expect, test } from '@playwright/test';
import { login, sendChatMessage } from './helpers/v3-clowder';

/**
 * V3-39: Agent artifact storage boundaries — browser smoke.
 *
 * Proves the three-layer contract end-to-end from the user's seat:
 *   1. A durable project artifact is produced under the USER workspace
 *      (maomi_workspace), never surfaced to the user as an internal
 *      `.clowder/workspaces` runtime-scratch path.
 *   2. "打包发给我" promotes that source into a published web DELIVERY
 *      attachment served from /uploads.
 *   3. The delivered media survives a page reload independently of runtime
 *      scratch (history recovery).
 *
 * Modeled on verify-file-delivery.spec.ts; reuses helpers/v3-clowder.ts.
 */
test.describe('V3-39 Clowder artifact storage boundaries', () => {
  test.describe.configure({ timeout: 240000 });

  test('produces a maomi_workspace artifact and delivers it as a web attachment', async ({ page }) => {
    // 1. Login
    await login(page);

    // 2. Ensure a fresh Codex OAuth cat (automate web login -> create codex OAuth)
    await page.goto('/chat/clowder-cats');
    await expect(page.locator('.cat-console-page')).toBeVisible({ timeout: 15000 });

    const existingCat = page.locator('.cat-row', { hasText: 'Codex' }).first();
    if (await existingCat.isVisible().catch(() => false)) {
      console.log('Codex cat already registered, deleting to ensure fresh state...');
      await existingCat.locator('button:has-text("删除")').click();
      const dialog = page.locator('.app-dialog-mask');
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await dialog.locator('textarea.app-dialog-input').fill('Codex');
      await dialog.locator('button.danger:has-text("删除")').click();
      await expect(dialog).toBeHidden({ timeout: 10000 });
      console.log('Deleted existing Codex cat.');
    }

    console.log('Registering Codex cat (OAuth)...');
    await page.locator('input[placeholder="例如：代码助手"]').fill('Codex');
    await page.locator('input[placeholder="例如：@codex"]').fill('@codex');
    await page.locator('select').first().selectOption({ label: '选择 roleTemplates 角色模板' });
    // Running platform: Codex == openai
    await page.locator('select').nth(1).selectOption('openai');
    // Add type: OAuth
    await page.locator('select').nth(2).selectOption('oauth');

    const createBtn = page.locator('button:has-text("创建猫猫并连接")');
    await expect(createBtn).toBeEnabled({ timeout: 15000 });
    await createBtn.click();

    // 3. Land in the conversation
    await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 15000 });

    // 4. Ask the cat to create a durable project artifact in the USER workspace
    console.log('Requesting a durable project artifact under maomi_workspace...');
    await sendChatMessage(
      page,
      '@codex 在 Maomi Workspace 里创建一个名为 boundaries-demo 的项目并生成一个 index.html 文件',
    );

    // 5. Package & deliver — promotes the user-workspace source to a web attachment
    const pattern = /maomi_workspace\.(zip|tar\.gz|gz)/;
    const matchingRows = page.locator('.message-list .msg-row', { hasText: pattern });
    const beforeMatchingCount = await matchingRows.count();
    console.log(`Matching file-card rows before packaging: ${beforeMatchingCount}`);

    await sendChatMessage(page, '@codex 把 Maomi Workspace 打包发给我');

    console.log('Waiting for Codex to package and reply...');
    await expect
      .poll(async () => matchingRows.count(), { timeout: 120000 })
      .toBeGreaterThan(beforeMatchingCount);
    const fileRow = matchingRows.last();

    // 6. Boundary guarantee (V3-39 §2.2): the DELIVERED card resolves to a
    //    browser-usable /uploads URL — never a raw runtime-scratch local path.
    const downloadBtn = fileRow.locator('button:has-text("下载")').first();
    await expect(downloadBtn).toBeVisible({ timeout: 5000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await downloadBtn.click();
    const download = await downloadPromise;
    const downloadUrl = download.url();
    console.log(`File download URL: ${downloadUrl}`);
    expect(downloadUrl).toMatch(/\/uploads\/[a-zA-Z0-9_-]+\.(zip|tar\.gz|gz)/);
    // Source/delivery are distinct: the delivery surface must NOT be a .clowder path.
    expect(downloadUrl).not.toMatch(/\.clowder[\\/]workspaces/);

    // 7. History recovery — delivered media persists independent of runtime scratch
    console.log('Reloading to verify delivered attachment survives...');
    await page.reload();
    await expect(page.locator('.message-list')).toBeVisible({ timeout: 15000 });

    const restoredRows = page.locator('.message-list .msg-row', { hasText: pattern });
    await expect(restoredRows).toHaveCount(beforeMatchingCount + 1, { timeout: 15000 });
    const restoredRow = restoredRows.last();
    await expect(restoredRow).toBeVisible({ timeout: 15000 });

    const restoredBtn = restoredRow.locator('button:has-text("下载")').first();
    await expect(restoredBtn).toBeVisible({ timeout: 5000 });

    const restoredDownloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await restoredBtn.click();
    const restoredDownload = await restoredDownloadPromise;
    const restoredDownloadUrl = restoredDownload.url();
    console.log(`Restored download URL: ${restoredDownloadUrl}`);
    expect(restoredDownloadUrl).toMatch(/\/uploads\/[a-zA-Z0-9_-]+\.(zip|tar\.gz|gz)/);
  });
});
