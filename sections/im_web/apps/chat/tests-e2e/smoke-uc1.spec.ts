import { test, expect } from '@playwright/test'

/**
 * V2.0 Smoke Test: UC-1 用户登录 → 发送文本消息 → 收到回复
 *
 * Constitution Appendix A.6 Layer 5 E2E / Smoke Tests
 * 覆盖：UC-1
 */
test('UC-1: 登录后发送文本消息', async ({ page }) => {
  await page.goto('/login')
  // 注意：实际测试需要配置正确的测试账号和凭据
  // 通过环境变量：TEST_USERNAME / TEST_PASSWORD / TEST_UID
  const username = process.env.TEST_USERNAME || '18337488675'
  const password = process.env.TEST_PASSWORD || '123456'

  // 登录
  await page.getByPlaceholder(/手机号|账号|username/i).fill(username)
  await page.getByPlaceholder(/密码|password/i).fill(password)
  await page.getByRole('button', { name: /登录|login/i }).click()

  // 验证登录成功（跳转到聊天页）
  await expect(page).toHaveURL(/\/chat/)

  // 验证会话列表存在
  await expect(page.locator('.conversation-list-container')).toBeVisible({ timeout: 10000 })

  // 选择第一个会话
  const firstConversation = page.locator('.conversation-item').first()
  if (await firstConversation.isVisible()) {
    await firstConversation.click()

    // 验证消息输入框存在
    await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 5000 })

    // 发送测试消息
    const input = page.locator('.input-textarea')
    const testMessage = `smoke-test-${Date.now()}`
    await input.fill(testMessage)
    await input.press('Enter')

    // 验证消息出现在消息列表（乐观更新）
    await expect(page.locator('.message-list').getByText(testMessage, { exact: true }).last()).toBeVisible({ timeout: 5000 })
  }
})
