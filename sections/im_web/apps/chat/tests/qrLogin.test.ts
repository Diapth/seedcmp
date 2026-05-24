import { describe, expect, it, vi } from 'vitest'

vi.mock('@tsdaodao/datasource-vue', () => ({
  useUserStore: () => ({
    login: vi.fn(),
    applyLoginResult: vi.fn()
  }),
  authApi: {
    getLoginUUID: vi.fn(),
    getLoginStatus: vi.fn(),
    loginWithAuthCode: vi.fn(),
    login: vi.fn()
  }
}))

describe('QR login state machine', () => {
  it('maps waiting, scanned, confirmed, expired, rejected, and failed states', async () => {
    const { normalizeQrLoginStatus } = await import('../../../packages/login-vue/src/stores/loginStore.ts')

    expect(normalizeQrLoginStatus({ status: 'waiting' })).toBe('qr_waiting')
    expect(normalizeQrLoginStatus({ status: 'scanned' })).toBe('qr_scanned')
    expect(normalizeQrLoginStatus({ status: 'confirmed', auth_code: 'a' })).toBe('qr_confirmed')
    expect(normalizeQrLoginStatus({ status: 'expired' })).toBe('qr_expired')
    expect(normalizeQrLoginStatus({ status: 'rejected' })).toBe('qr_rejected')
    expect(normalizeQrLoginStatus(null)).toBe('qr_failed')
  })

  it('renders QR login controls and terminal state copy on the login page', async () => {
    const source = await import('../../../packages/login-vue/src/views/LoginPage.vue?raw')
    const text = source.default

    expect(text).toContain('startQrLogin')
    expect(text).toContain('refreshQrLogin')
    expect(text).toContain('qr_scanned')
    expect(text).toContain('qr_expired')
    expect(text).toContain('qr_rejected')
    expect(text).toContain('qr_failed')
  })
})
