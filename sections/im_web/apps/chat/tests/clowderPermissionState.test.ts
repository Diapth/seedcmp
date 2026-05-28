import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const get = vi.fn()
const post = vi.fn()

vi.mock('@tsdaodao/base-vue', () => ({
  apiClient: {
    get,
    post
  }
}))

describe('clowder permission state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('stores denied and admin-only permission states with disabled reasons', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()

    get.mockResolvedValueOnce({
      status: { enabled: true, configured: true, reachable: true, state: 'denied' },
      permission: {
        connectorId: 'im-web',
        externalChatId: '2:group-denied',
        whitelistEnabled: true,
        allowed: false,
        adminOnlyCommands: true,
        adminSenderIds: ['owner-1']
      }
    })

    await store.loadConversation({ channelId: 'group-denied', channelType: 2 })

    expect(store.getConversation('group-denied', 2)?.disabledReason).toBe('group_not_allowed')
    expect(store.getConversation('group-denied', 2)?.permission?.adminOnlyCommands).toBe(true)
  })

  it('updates permission state after allow and deny actions', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()

    post
      .mockResolvedValueOnce({
        connectorId: 'im-web',
        externalChatId: '2:group-a',
        whitelistEnabled: true,
        allowed: true,
        adminOnlyCommands: false,
        adminSenderIds: []
      })
      .mockResolvedValueOnce({
        connectorId: 'im-web',
        externalChatId: '2:group-a',
        whitelistEnabled: true,
        allowed: false,
        adminOnlyCommands: false,
        adminSenderIds: []
      })

    await store.allowGroup({ channelId: 'group-a', channelType: 2 })
    expect(store.getConversation('group-a', 2)?.permission?.allowed).toBe(true)
    expect(store.getConversation('group-a', 2)?.disabledReason).toBeUndefined()

    await store.denyGroup({ channelId: 'group-a', channelType: 2 })
    expect(store.getConversation('group-a', 2)?.permission?.allowed).toBe(false)
    expect(store.getConversation('group-a', 2)?.disabledReason).toBe('group_not_allowed')
  })
})
