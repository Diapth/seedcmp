import { describe, expect, it } from 'vitest'

describe('SDK recovery connection state contract', () => {
  it('exposes user-facing connection states and reconnect metadata', async () => {
    const source = await import('../../../packages/datasource-vue/src/stores/sdk.ts?raw')

    expect(source.default).toContain('connectionState')
    expect(source.default).toContain('recoveryState')
    expect(source.default).toContain('lastError')
    expect(source.default).toContain('lastRecoveredAt')
    expect(source.default).toContain('scheduleReconnect')
    expect(source.default).toContain('markRecovered')
    expect(source.default).toContain('setConnectionState')
  })
})
