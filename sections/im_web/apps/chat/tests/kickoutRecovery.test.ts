import { describe, expect, it } from 'vitest'

describe('kickout recovery cleanup contract', () => {
  it('clears sensitive datasource stores and storage when kickout relogin is requested', async () => {
    const kickout = await import('../../../packages/datasource-vue/src/stores/kickout.ts?raw')
    const app = await import('../src/App.vue?raw')

    expect(kickout.default).toContain('clearSensitiveState')
    expect(kickout.default).toContain('useMessageStore')
    expect(kickout.default).toContain('useConversationStore')
    expect(kickout.default).toContain('useGroupStore')
    expect(kickout.default).toContain('useUserStore')
    expect(kickout.default).toContain('StorageService.clear')
    expect(app.default).toContain('kickoutStore.clearSensitiveState')
  })

  it('shows connection and recovery indicators from MainLayout', async () => {
    const layout = await import('../src/layouts/MainLayout.vue?raw')

    expect(layout.default).toContain('connectionBanner')
    expect(layout.default).toContain('connectionStateLabel')
    expect(layout.default).toContain('recoveryState')
    expect(layout.default).toContain('正在重连')
    expect(layout.default).toContain('恢复同步')
  })
})
