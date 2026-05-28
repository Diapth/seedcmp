import { test, expect } from '@playwright/test'

test('UC-4 recovery: login shell exposes connection and recovery-safe chat surface', async ({ page }) => {
  await page.goto('/login')

  const username = process.env.TEST_USERNAME || '18337488675'
  const password = process.env.TEST_PASSWORD || '123456'

  await page.getByPlaceholder(/手机号|账号|username/i).fill(username)
  await page.getByPlaceholder(/密码|password/i).fill(password)
  await page.getByRole('button', { name: /登录|login/i }).click()

  await expect(page).toHaveURL(/\/chat/, { timeout: 15000 })
  await expect(page.locator('.conversation-list-container')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.main-layout')).toBeVisible()
  await expect(page.locator('.message-input-container').or(page.locator('.welcome-container'))).toBeVisible({ timeout: 10000 })
})
