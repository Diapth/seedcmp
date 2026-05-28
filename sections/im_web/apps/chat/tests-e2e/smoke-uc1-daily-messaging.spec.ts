import { test, expect } from '@playwright/test'

test('UC-1 daily messaging: send text and expose action affordances', async ({ page }) => {
  await page.goto('/login')

  const username = process.env.TEST_USERNAME || '18337488675'
  const password = process.env.TEST_PASSWORD || '123456'

  await page.getByPlaceholder(/手机号|账号|username/i).fill(username)
  await page.getByPlaceholder(/密码|password/i).fill(password)
  await page.getByRole('button', { name: /登录|login/i }).click()

  await expect(page).toHaveURL(/\/chat/, { timeout: 15000 })
  await expect(page.locator('.conversation-list-container')).toBeVisible({ timeout: 10000 })

  const firstConversation = page.locator('.conversation-item').first()
  test.skip(!(await firstConversation.isVisible()), 'No conversation is available for the daily messaging smoke flow.')

  await firstConversation.click()
  await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 5000 })

  const input = page.locator('.input-textarea')
  const testMessage = `smoke-us1-${Date.now()}`
  await input.fill(testMessage)
  await input.press('Enter')

  const sentMessage = page.locator('.message-list').getByText(testMessage, { exact: true }).last()
  await expect(sentMessage).toBeVisible({ timeout: 5000 })

  const sentMessageRow = page.locator('.msg-row').filter({ hasText: testMessage }).last()
  await expect(sentMessageRow).toBeVisible({ timeout: 3000 })
  const box = await sentMessageRow.boundingBox()
  expect(box).not.toBeNull()
  await sentMessageRow.dispatchEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: Math.round((box?.x || 0) + (box?.width || 1) / 2),
    clientY: Math.round((box?.y || 0) + (box?.height || 1) / 2)
  })
  await expect(page.getByText('回复')).toBeVisible({ timeout: 3000 })
  await expect(page.getByText(/设为置顶|取消置顶/)).toBeVisible()
  await expect(page.getByText('查看回执')).toBeVisible()
})
