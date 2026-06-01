import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const updateConversationExtra = vi.fn()
const deleteConversation = vi.fn()

vi.mock('@tsdaodao/base-vue', async () => {
  const actual = await vi.importActual<any>('../../../packages/base-vue/src/utils/clowderMessageIdentity.ts')
  return {
    ...actual,
    apiClient: {
      defaults: { baseURL: 'http://api.example/v1/' },
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn()
    },
    apiDelete: vi.fn(),
    StorageService: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    }
  }
})

vi.mock('@tsdaodao/datasource-vue/api', () => ({
  syncApi: {
    updateConversationExtra,
    deleteConversation,
    syncConversations: vi.fn(),
    syncConversationExtra: vi.fn(async () => []),
    clearUnread: vi.fn()
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

describe('conversation actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    updateConversationExtra.mockResolvedValue(undefined)
    deleteConversation.mockResolvedValue(undefined)
  })

  it('hides a conversation without deleting its messages and reveals it on new activity', async () => {
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const store = useConversationStore()

    store.conversations.push({
      channel_id: 'friend-a',
      channel_type: 1,
      unread: 0,
      last_msg_seq: 1,
      last_msg_time: 100,
      last_message: { content: { type: 1, text: 'hello' } },
      top: 0,
      mute: 0,
      name: 'Friend A',
      avatar: ''
    })

    await store.hideConversation('friend-a', 1)

    expect(store.sortedConversations.map(item => item.channel_id)).toEqual([])
    expect(deleteConversation).not.toHaveBeenCalled()
    expect(updateConversationExtra).toHaveBeenCalledWith('friend-a', 1, { hidden: 1 })

    await store.addOrUpdateConversation('friend-a', 1, {
      fromUID: 'friend-a',
      messageSeq: 2,
      timestamp: 120,
      content: { type: 1, text: 'new message' }
    })

    expect(store.sortedConversations.map(item => item.channel_id)).toEqual(['friend-a'])
    expect(updateConversationExtra).toHaveBeenLastCalledWith('friend-a', 1, { hidden: 0 })
  })

  it('conversation list exposes state-aware pin mute hide and delete menu actions', async () => {
    const source = await import('../src/views/ConversationList.vue?raw')

    expect(source.default).toContain('conversationStore.hideConversation')
    expect(source.default).toContain("selectedConversation.value?.top")
    expect(source.default).toContain("selectedConversation.value?.mute")
    expect(source.default).toContain("label: isSelectedConversationPinned.value ? '取消置顶' : '置顶'")
    expect(source.default).toContain("label: isSelectedConversationMuted.value ? '关闭免打扰' : '消息免打扰'")
    expect(source.default).toContain("label: '隐藏会话'")
  })
})
