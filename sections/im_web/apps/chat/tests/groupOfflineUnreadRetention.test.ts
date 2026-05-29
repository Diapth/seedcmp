import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const syncConversations = vi.fn()
const syncConversationExtra = vi.fn()
const syncMessages = vi.fn()
const clearUnread = vi.fn()
const updateConversationExtra = vi.fn()

vi.mock('@tsdaodao/base-vue', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  },
  apiDelete: vi.fn(),
  StorageService: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn()
  }
}))

vi.mock('@tsdaodao/datasource-vue/api', () => ({
  syncApi: {
    syncConversations,
    syncConversationExtra,
    syncMessages,
    clearUnread,
    updateConversationExtra,
    deleteConversation: vi.fn()
  },
  groupApi: {
    getMyGroups: vi.fn(async () => []),
    getGroupInfo: vi.fn(),
    getGroupMembers: vi.fn(),
    updateSetting: vi.fn()
  },
  commonApi: {
    getChannelInfo: vi.fn(async () => ({ name: '群聊', avatar: '', top: 0, mute: 0 }))
  }
}))

describe('group offline unread retention', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.localStorage.clear()
    syncConversationExtra.mockResolvedValue([])
    syncMessages.mockResolvedValue({ messages: [] })
    clearUnread.mockResolvedValue(undefined)
    updateConversationExtra.mockResolvedValue({})
  })

  it('keeps locally cleared unread at zero when later sync returns stale unread for the cleared sequence', async () => {
    const { useConversationStore } = await import('@tsdaodao/datasource-vue')
    const store = useConversationStore()

    await store.addOrUpdateConversation('group-a', 2, {
      messageSeq: 10,
      timestamp: 1700000010,
      fromUID: 'member-a',
      payload: { type: 1, text: 'offline message' }
    })

    await store.clearUnread('group-a', 2)
    expect(store.conversations[0].unread).toBe(0)

    syncConversations.mockResolvedValue({
      conversations: [{
        channel_id: 'group-a',
        channel_type: 2,
        unread: 5,
        last_msg_seq: 10,
        last_msg_time: 1700000010,
        last_message: {
          message_seq: 10,
          timestamp: 1700000010,
          payload: { type: 1, text: 'offline message' }
        }
      }],
      groups: [{ group_no: 'group-a', name: '群聊' }]
    })

    await store.syncConversations()

    expect(store.conversations.find(item => item.channel_id === 'group-a')?.unread).toBe(0)
    expect(store.unreadMap['group-a-2']).toBe(0)
  })

  it('keeps a local-only AI conversation read after refresh when remote sync returns stale unread', async () => {
    let apiCalls = 0
    syncConversations.mockImplementation(async () => {
      apiCalls++
      return {
        conversations: [{
          channel_id: 'clowder_ai',
          channel_type: 1,
          unread: 1,
          last_msg_seq: 0,
          last_msg_time: 1700000010,
          last_message: {
            message_seq: 0,
            timestamp: 1700000010,
            payload: { type: 1, text: 'stale unread' }
          }
        }],
        users: [{ uid: 'clowder_ai', name: 'Clowder AI' }]
      }
    })

    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const firstStore = useConversationStore()
    const firstUserStore = useUserStore()
    firstUserStore.currentUser = { uid: 'reader-a', name: 'Reader' }

    await firstStore.syncConversations()
    expect(firstStore.conversations.find(item => item.channel_id === 'clowder_ai')?.unread).toBe(1)

    await firstStore.clearUnread('clowder_ai', 1)
    expect(firstStore.conversations.find(item => item.channel_id === 'clowder_ai')?.unread).toBe(0)
    expect(window.localStorage.getItem('im-web:cleared-unread:reader-a')).toContain('clowder_ai-1')

    setActivePinia(createPinia())
    const secondStore = useConversationStore()
    const secondUserStore = useUserStore()
    secondUserStore.currentUser = { uid: 'reader-a', name: 'Reader' }

    await secondStore.syncConversations()

    expect(apiCalls).toBe(2)
    expect(secondStore.conversations.find(item => item.channel_id === 'clowder_ai')?.unread).toBe(0)
    expect(secondStore.unreadMap['clowder_ai-1']).toBe(0)
  })

  it('does not sync an empty draft when no remote draft has ever been saved', async () => {
    vi.useFakeTimers()
    const { useConversationStore } = await import('@tsdaodao/datasource-vue')
    const store = useConversationStore()

    await store.updateDraft('group-a', 2, 'draft')
    await store.updateDraft('group-a', 2, '')
    await vi.runAllTimersAsync()

    expect(updateConversationExtra).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('syncs an empty draft after a non-empty draft was saved remotely', async () => {
    vi.useFakeTimers()
    const { useConversationStore } = await import('@tsdaodao/datasource-vue')
    const store = useConversationStore()

    await store.updateDraft('group-a', 2, 'draft')
    await vi.runAllTimersAsync()
    expect(updateConversationExtra).toHaveBeenCalledWith('group-a', 2, { draft: 'draft' })

    await store.updateDraft('group-a', 2, '')
    await vi.runAllTimersAsync()
    expect(updateConversationExtra).toHaveBeenLastCalledWith('group-a', 2, { draft: '' })
    vi.useRealTimers()
  })
})
