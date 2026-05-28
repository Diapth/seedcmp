import { test, expect } from '@playwright/test'

test('UC-8 desktop readiness: theme, responsive shell, and history surface stay stable', async ({ page }) => {
  await page.goto('/login')

  const username = process.env.TEST_USERNAME || '18337488675'
  const password = process.env.TEST_PASSWORD || '123456'

  await page.getByPlaceholder(/手机号|账号|username/i).fill(username)
  await page.getByPlaceholder(/密码|password/i).fill(password)
  await page.getByRole('button', { name: /安全登录|login/i }).click()

  await expect(page).toHaveURL(/\/chat/, { timeout: 15000 })
  await expect(page.locator('.main-layout')).toBeVisible()
  await expect(page.locator('.conversation-list-container')).toBeVisible({ timeout: 10000 })

  await page.getByTitle('切换深色').click()
  await expect(page.locator('html')).toHaveAttribute('theme-mode', 'dark')
  await page.setViewportSize({ width: 680, height: 760 })
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect(page.locator('.chat-viewport')).toBeVisible()

  const firstConversation = page.locator('.conversation-item').first()
  test.skip(!(await firstConversation.isVisible()), 'No conversation is available for the large history smoke flow.')

  await firstConversation.click()
  await expect(page.locator('.message-list')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.message-row-wrapper').first()).toBeVisible({ timeout: 5000 })
})
