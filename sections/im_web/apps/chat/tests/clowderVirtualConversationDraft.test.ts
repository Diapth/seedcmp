import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const updateConversationExtra = vi.fn()
const syncConversationExtra = vi.fn(async () => [])

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
    syncConversations: vi.fn(),
    syncConversationExtra,
    syncMessages: vi.fn(async () => ({ messages: [] })),
    clearUnread: vi.fn(),
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
    getChannelInfo: vi.fn(async () => ({ name: 'Target', avatar: '', top: 0, mute: 0 }))
  }
}))

describe('clowder virtual conversation drafts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    syncConversationExtra.mockResolvedValue([])
    updateConversationExtra.mockResolvedValue({})
  })

  it('keeps Clowder AI drafts local without syncing conversation extra to TangSeng', async () => {
    vi.useFakeTimers()
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const store = useConversationStore()

    await store.updateDraft('clowder_ai', 1, '/cats')
    await vi.runAllTimersAsync()

    expect(store.drafts['clowder_ai-1']).toBe('/cats')
    expect(updateConversationExtra).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('continues syncing drafts for normal direct conversations', async () => {
    vi.useFakeTimers()
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const store = useConversationStore()

    await store.updateDraft('friend-a', 1, 'hello')
    await vi.runAllTimersAsync()

    expect(updateConversationExtra).toHaveBeenCalledWith('friend-a', 1, { draft: 'hello' })
    vi.useRealTimers()
  })

  it('clears a local draft when remote conversation extra sync returns an empty draft', async () => {
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const store = useConversationStore()
    store.conversations.push({
      channel_id: 'friend-a',
      channel_type: 1,
      unread: 0,
      last_msg_seq: 0,
      last_msg_time: 0,
      draft: 'already sent elsewhere'
    } as any)
    store.drafts['friend-a-1'] = 'already sent elsewhere'
    syncConversationExtra.mockResolvedValueOnce([
      { channel_id: 'friend-a', channel_type: 1, draft: '', version: 10 }
    ])

    await store.syncExtra()

    expect(store.drafts['friend-a-1']).toBe('')
    expect(store.conversations[0].draft).toBe('')
  })

  it('message input watches active conversation draft changes without overwriting newer local typing', async () => {
    const source = await import('../src/components/MessageInput.vue?raw')

    expect(source.default).toContain('activeConversationDraft')
    expect(source.default).toContain('lastAppliedDraft')
    expect(source.default).toContain('inputText.value === lastAppliedDraft')
  })
})
