import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const revokeMessage = vi.fn()
const addReaction = vi.fn()

vi.mock('@tsdaodao/base-vue', () => ({
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
}))

vi.mock('@tsdaodao/datasource-vue/api', () => ({
  syncApi: {
    revokeMessage,
    addReaction,
    syncConversations: vi.fn(),
    syncConversationExtra: vi.fn(async () => []),
    updateConversationExtra: vi.fn(),
    clearUnread: vi.fn(),
    deleteConversation: vi.fn(),
    syncMessages: vi.fn()
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

vi.mock('wukongimjssdk', () => ({
  default: {
    shared: () => ({
      register: vi.fn(),
      newChannel: vi.fn(),
      newMessageText: vi.fn(),
      chatManager: { send: vi.fn() }
    })
  },
  MessageContent: class {},
  MediaMessageContent: class {},
  MessageImage: class {}
}))

describe('message action state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    revokeMessage.mockResolvedValue(undefined)
    addReaction.mockResolvedValue(undefined)
  })

  it('marks revoked messages and keeps stale revoked text out of the conversation summary', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore')
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore')
    const messageStore = useMessageStore()
    const conversationStore = useConversationStore()

    messageStore.addMessage('friend-a', 1, {
      messageID: 'm1',
      messageSeq: 1,
      clientMsgNo: 'c1',
      fromUID: 'me',
      timestamp: 100,
      content: { type: 1, text: 'first text' },
      isRevoked: false,
      status: 'success'
    })
    messageStore.addMessage('friend-a', 1, {
      messageID: 'm2',
      messageSeq: 2,
      clientMsgNo: 'c2',
      fromUID: 'me',
      timestamp: 101,
      content: { type: 1, text: 'second text' },
      isRevoked: false,
      status: 'success'
    })
    await vi.waitFor(() => {
      expect(conversationStore.conversations.find(item => item.channel_id === 'friend-a')?.last_message?.content?.text).toBe('second text')
    })

    await messageStore.revokeMessage('friend-a', 1, 'c2', 'm2')

    expect(revokeMessage).toHaveBeenCalledWith({
      channel_id: 'friend-a',
      channel_type: 1,
      message_id: 'm2',
      client_msg_no: 'c2'
    })
    expect(messageStore.getChannelMessages('friend-a', 1).find(item => item.clientMsgNo === 'c2')?.isRevoked).toBe(true)
    await vi.waitFor(() => {
      expect(conversationStore.conversations.find(item => item.channel_id === 'friend-a')?.last_message?.content?.text).toBe('first text')
    })
  })

  it('toggles local reaction participants after backend acknowledgement', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore')
    const messageStore = useMessageStore()
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'me', name: 'Me' }

    const msg = {
      messageID: 'm1',
      messageSeq: 1,
      clientMsgNo: 'c1',
      fromUID: 'friend-a',
      timestamp: 100,
      content: { type: 1, text: 'hello' },
      isRevoked: false,
      status: 'success' as const,
      reactions: []
    }
    messageStore.addMessage('friend-a', 1, msg)

    await messageStore.toggleReaction('friend-a', 1, msg, '👍')
    expect(msg.reactions).toEqual([{ emoji: '👍', count: 1, users: ['me'] }])

    await messageStore.toggleReaction('friend-a', 1, msg, '👍')
    expect(msg.reactions).toEqual([])
  })
})
