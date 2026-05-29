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

describe('clowder control store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('binds a thread and tracks the last delivery state', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()

    post.mockResolvedValueOnce({
      connectorId: 'im-web',
      externalChatId: '2:group-clowder',
      channelId: 'group-clowder',
      channelType: 2,
      threadId: 'thread-new',
      userId: 'owner-1',
      status: 'active'
    })
    get.mockResolvedValueOnce({
      status: { enabled: true, configured: true, reachable: true, state: 'ready' },
      binding: {
        connectorId: 'im-web',
        externalChatId: '2:group-clowder',
        channelId: 'group-clowder',
        channelType: 2,
        threadId: 'thread-new',
        userId: 'owner-1',
        status: 'active'
      },
      agents: [],
      lastDelivery: {
        externalChatId: '2:group-clowder',
        threadId: 'thread-new',
        state: 'delivered'
      }
    })

    await store.bindConversation({ channelId: 'group-clowder', channelType: 2, threadId: 'thread-new' })
    const state = await store.loadConversation({ channelId: 'group-clowder', channelType: 2 })

    expect(post).toHaveBeenCalledWith('clowder/conversation/bind', {
      channelId: 'group-clowder',
      channelType: 2,
      threadId: 'thread-new'
    })
    expect(state.binding?.threadId).toBe('thread-new')
    expect(state.lastDelivery?.state).toBe('delivered')
  })
})
