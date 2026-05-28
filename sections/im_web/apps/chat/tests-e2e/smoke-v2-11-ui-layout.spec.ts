import { test, expect } from '@playwright/test'

test('V2-11 UI layout: drawers, modals, and input controls stay within viewport bounds', async ({ page }) => {
  await page.goto('/login')

  const username = process.env.TEST_USERNAME || '18337488675'
  const password = process.env.TEST_PASSWORD || '123456'

  if (await page.getByPlaceholder(/手机号|账号|username/i).isVisible({ timeout: 5000 }).catch(() => false)) {
    await page.getByPlaceholder(/手机号|账号|username/i).fill(username)
    await page.getByPlaceholder(/密码|password/i).fill(password)
    await page.getByRole('button', { name: /登录|login/i }).click()
  }

  await expect(page).toHaveURL(/\/chat/, { timeout: 15000 })
  await expect(page.locator('.main-layout')).toBeVisible()

  const firstConversation = page.locator('.conversation-item').first()
  test.skip(!(await firstConversation.isVisible()), 'No conversation is available for UI layout smoke.')
  await firstConversation.click()
  await expect(page.locator('.message-input-container')).toBeVisible({ timeout: 5000 })

  const inputBox = await page.locator('.message-input-container').boundingBox()
  expect(inputBox).not.toBeNull()
  expect(inputBox!.x).toBeGreaterThanOrEqual(0)
  expect(inputBox!.x + inputBox!.width).toBeLessThanOrEqual(1440)

  const settingsButton = page.getByRole('button', { name: /群聊设置/ })
  if (await settingsButton.isVisible()) {
    await settingsButton.click()
    const drawer = page.locator('.drawer-content').last()
    await expect(drawer).toBeVisible()
    const drawerBox = await drawer.boundingBox()
    expect(drawerBox).not.toBeNull()
    expect(drawerBox!.x).toBeGreaterThanOrEqual(0)
    expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(1440)

    await page.getByText('邀请成员').click()
    const modal = page.locator('.invite-modal').last()
    await expect(modal).toBeVisible()
    const modalBox = await modal.boundingBox()
    expect(modalBox).not.toBeNull()
    expect(modalBox!.x).toBeGreaterThanOrEqual(0)
    expect(modalBox!.x + modalBox!.width).toBeLessThanOrEqual(1440)
    expect(modalBox!.y).toBeGreaterThanOrEqual(0)
    expect(modalBox!.y + modalBox!.height).toBeLessThanOrEqual(900)
  }
})
