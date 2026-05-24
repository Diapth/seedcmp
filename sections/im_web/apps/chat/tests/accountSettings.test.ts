import { describe, expect, it } from 'vitest'

describe('account settings contracts', () => {
  it('keeps profile, avatar, personal QR, notification, and navigation states visible', async () => {
    const source = await import('../src/views/MyProfileDrawer.vue?raw')
    const text = source.default

    expect(text).toContain('userStore.updateProfile')
    expect(text).toContain('userStore.updateAvatar')
    expect(text).toContain('personalQrPayload')
    expect(text).toContain('notificationPermissionState')
    expect(text).toContain('registerDeviceToken')
    expect(text).toContain('unregisterDeviceToken')
    expect(text).toContain('打开设备管理')
  })

  it('clears local session state after quitting the current web session', async () => {
    const source = await import('../src/views/DeviceManagementPage.vue?raw')
    const text = source.default

    expect(text).toContain('authApi.getDevices')
    expect(text).toContain('authApi.deleteDevice')
    expect(text).toContain('userStore.logout')
    expect(text).toContain("router.replace('/login')")
    expect(text).toContain('quittingSession')
  })
})
