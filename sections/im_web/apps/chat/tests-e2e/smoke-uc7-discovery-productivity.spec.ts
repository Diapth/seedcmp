import { test, expect } from '@playwright/test'

test('UC-7 discovery and productivity: workplace, search, and robot surfaces are safe', async ({ page }) => {
  await page.goto('/login')

  const username = process.env.TEST_USERNAME || '18337488675'
  const password = process.env.TEST_PASSWORD || '123456'

  await page.getByPlaceholder(/手机号|账号|username/i).fill(username)
  await page.getByPlaceholder(/密码|password/i).fill(password)
  await page.getByRole('button', { name: /安全登录|login/i }).click()

  await expect(page).toHaveURL(/\/chat/, { timeout: 15000 })
  await expect(page.getByText('工作台')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.app-tile').first()).toBeVisible()

  await page.getByPlaceholder('搜索会话/联系人/聊天记录...').fill('test')
  await expect(page.locator('.search-result-list')).toBeVisible()
  await expect(page.getByText(/联系人|群组|聊天记录|未找到相关结果/).first()).toBeVisible()
  await page.locator('.clear-search-btn').click()

  const firstConversation = page.locator('.conversation-item').first()
  test.skip(!(await firstConversation.isVisible()), 'No conversation is available for the robot surface smoke flow.')

  await firstConversation.click()
  await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 5000 })
  await page.getByTitle('机器人菜单').click()
  await expect(page.getByText(/机器人响应中|机器人暂不可用/)).toBeVisible({ timeout: 5000 })
})
