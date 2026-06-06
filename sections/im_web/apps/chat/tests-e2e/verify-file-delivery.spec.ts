import { expect, test } from '@playwright/test';
import {
  clowderReplyCount,
  login,
  sendChatMessage,
} from './helpers/v3-clowder';

test.describe('V3 Clowder native file delivery manual verification', () => {
  test.describe.configure({ timeout: 240000 });

  test('creates codex cat, packages maomi workspace, and delivers native file card', async ({ page }) => {
    // 1. Login
    await login(page);

    // 2. Navigate to Clowder Cat Console to ensure Codex cat is connected
    await page.goto('/chat/clowder-cats');
    await expect(page.locator('.cat-console-page')).toBeVisible({ timeout: 15000 });

    const existingCat = page.locator('.cat-row', { hasText: 'Codex' }).first();
    const isConnected = await existingCat.isVisible().catch(() => false);

    if (isConnected) {
      console.log('Codex cat is already registered, deleting it first to ensure fresh state...');
      await existingCat.locator('button:has-text("删除")').click();
      const dialog = page.locator('.app-dialog-mask');
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await dialog.locator('textarea.app-dialog-input').fill('Codex');
      await dialog.locator('button.danger:has-text("删除")').click();
      await expect(dialog).toBeHidden({ timeout: 10000 });
      console.log('Deleted existing Codex cat.');
    }

    console.log('Registering Codex cat...');
    await page.locator('input[placeholder="例如：代码助手"]').fill('Codex');
    await page.locator('input[placeholder="例如：@codex"]').fill('@codex');
    await page.locator('select').first().selectOption({ label: '选择 roleTemplates 角色模板' }); // clear template
    
    // Select running platform (Codex is the first option with value "openai")
    await page.locator('select').nth(1).selectOption('openai');
    // Select add type (OAuth is value "oauth")
    await page.locator('select').nth(2).selectOption('oauth');

    // Click create and connect
    const createBtn = page.locator('button:has-text("创建猫猫并连接")');
    await expect(createBtn).toBeEnabled({ timeout: 15000 });
    await createBtn.click();

    // 3. Verify we are in the conversation page
    await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 15000 });
    
    // 4. Send packaging command to Codex
    const pattern = /maomi_workspace\.(zip|tar\.gz|gz)/;
    const matchingRows = page.locator('.message-list .msg-row', { hasText: pattern });
    const beforeMatchingCount = await matchingRows.count();
    console.log(`Matching rows count before: ${beforeMatchingCount}`);
    
    await sendChatMessage(page, '@codex 把 Maomi Workspace 打包发给我');
    
    // 5. Wait for Codex reply (wait for new file card to appear in the list)
    console.log('Waiting for Codex to package and reply...');
    await expect.poll(async () => matchingRows.count(), { timeout: 120000 }).toBeGreaterThan(beforeMatchingCount);
    const fileRow = matchingRows.last();

    // 6. Assert file card exists and check download
    const downloadBtn = fileRow.locator('button:has-text("下载")').first();
    await expect(downloadBtn).toBeVisible({ timeout: 5000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await downloadBtn.click();
    const download = await downloadPromise;
    const downloadUrl = download.url();
    console.log(`File download URL: ${downloadUrl}`);
    expect(downloadUrl).toMatch(/\/uploads\/[a-zA-Z0-9_-]+\.(zip|tar\.gz|gz)/);

    // 7. Verify page refresh preserves the file card
    console.log('Refreshing page to verify history recovery...');
    await page.reload();
    await expect(page.locator('.message-list')).toBeVisible({ timeout: 15000 });
    
    // Re-query matching rows to get the correct count and row after reload
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
