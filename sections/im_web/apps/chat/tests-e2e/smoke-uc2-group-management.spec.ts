import { test, expect } from '@playwright/test'

test('UC-2 group management: settings surface exposes safe group controls', async ({ page }) => {
  await page.goto('/login')

  const username = process.env.TEST_USERNAME || '18337488675'
  const password = process.env.TEST_PASSWORD || '123456'

  await page.getByPlaceholder(/手机号|账号|username/i).fill(username)
  await page.getByPlaceholder(/密码|password/i).fill(password)
  await page.getByRole('button', { name: /登录|login/i }).click()

  await expect(page).toHaveURL(/\/chat/, { timeout: 15000 })
  await expect(page.locator('.conversation-list-container')).toBeVisible({ timeout: 10000 })

  const groupConversation = page.locator('.conversation-item', { hasText: /群|Group|测试链条/ }).first()
  test.skip(!(await groupConversation.isVisible()), 'No group conversation is available for the group management smoke flow.')

  await groupConversation.click()
  const settingsButton = page.getByRole('button', { name: /群聊设置/ })
  await expect(settingsButton).toBeVisible({ timeout: 5000 })
  await settingsButton.click()

  await expect(page.getByText('群聊信息')).toBeVisible()
  await expect(page.getByText('群二维码')).toBeVisible()
  await expect(page.getByText(/邀请确认|关闭邀请确认/)).toBeVisible()
  await expect(page.getByText(/全员禁言|关闭全员禁言/)).toBeVisible()
  await expect(page.getByText('邀请成员')).toBeVisible()
})
