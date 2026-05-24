import { test, expect } from '@playwright/test'

test('UC-6 account settings: profile, devices, and QR login surfaces are reachable', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByText('扫码登录')).toBeVisible()
  await expect(page.getByText(/使用手机端扫码安全登录/)).toBeVisible()
  await page.getByRole('button', { name: '生成二维码' }).click()
  await expect(page.getByText(/等待手机扫码|扫码登录暂不可用/)).toBeVisible({ timeout: 5000 })

  const username = process.env.TEST_USERNAME || '18337488675'
  const password = process.env.TEST_PASSWORD || '123456'

  await page.getByPlaceholder(/手机号|账号|username/i).fill(username)
  await page.getByPlaceholder(/密码|password/i).fill(password)
  await page.getByRole('button', { name: /安全登录|login/i }).click()

  await expect(page).toHaveURL(/\/chat/, { timeout: 15000 })
  await expect(page.locator('.conversation-list-container')).toBeVisible({ timeout: 10000 })

  await page.locator('.user-profile').click()
  await expect(page.getByText('个人资料与设置')).toBeVisible()
  await expect(page.getByText('个人二维码')).toBeVisible()
  await expect(page.getByLabel('个人二维码')).toBeVisible()
  await expect(page.getByText(/桌面通知|当前浏览器不支持通知|收到新消息时显示桌面提醒/)).toBeVisible()

  await page.getByRole('button', { name: '打开设备管理' }).click()
  await expect(page).toHaveURL(/\/chat\/devices/, { timeout: 5000 })
  await expect(page.getByText('设备管理')).toBeVisible()
  await expect(page.getByRole('button', { name: /退出当前会话|处理中/ })).toBeVisible()
})
