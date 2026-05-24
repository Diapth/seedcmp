import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const syncMessages = vi.fn()

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
    syncMessages,
    syncConversations: vi.fn(),
    syncConversationExtra: vi.fn(async () => []),
    updateConversationExtra: vi.fn(),
    clearUnread: vi.fn(),
    deleteConversation: vi.fn(),
    revokeMessage: vi.fn(),
    addReaction: vi.fn()
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

vi.mock('wukongimjssdk', () => {
  class MessageContent {
    encodeJSON() {
      return {}
    }
  }

  class MediaMessageContent extends MessageContent {}
  class MessageImage extends MediaMessageContent {
    width = 0
    height = 0
    url = ''
    get contentType() {
      return 2
    }
    encodeJSON() {
      return { width: this.width, height: this.height, url: this.url }
    }
  }

  return {
    default: {
      shared: () => ({
        newChannel: vi.fn(),
        newMessageText: vi.fn((text: string) => ({ contentType: 1, contentObj: { text } })),
        chatManager: { send: vi.fn() },
        register: vi.fn()
      })
    },
    MessageContent,
    MediaMessageContent,
    MessageImage
  }
})

describe('message store daily messaging normalization', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('normalizes text payloads and suppresses duplicate synced/realtime messages by clientMsgNo', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore')
    const store = useMessageStore()

    store.addRealtimeMessage('friend-a', 1, {
      messageID: 'm-local',
      messageSeq: 1,
      clientMsgNo: 'client-1',
      fromUID: 'friend-a',
      timestamp: 100,
      status: 1,
      reactions: [],
      remoteExtra: undefined,
      content: { contentType: 1, contentObj: { content: 'hello from content' } }
    } as any)

    syncMessages.mockResolvedValue({
      messages: [{
        message_id: 1001,
        message_idstr: 'm-remote',
        message_seq: 2,
        client_msg_no: 'client-1',
        from_uid: 'friend-a',
        timestamp: 101,
        payload: JSON.stringify({ type: 1, content: 'hello from content' }),
        reactions: [{ emoji: '👍', count: 1 }]
      }]
    })

    await store.syncMessages('friend-a', 1)

    const list = store.getChannelMessages('friend-a', 1)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      messageID: 'm-remote',
      messageSeq: 2,
      clientMsgNo: 'client-1',
      content: { type: 1, text: 'hello from content' },
      status: 'success',
      reactions: [{ emoji: '👍', count: 1 }]
    })
  })

  it('does not let unsupported content become the conversation digest', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore')
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore')
    const messageStore = useMessageStore()
    const conversationStore = useConversationStore()

    messageStore.addMessage('friend-a', 1, {
      messageID: 'unsupported',
      messageSeq: 1,
      clientMsgNo: 'unsupported-1',
      fromUID: 'friend-a',
      timestamp: 100,
      content: { type: 777, text: 'unsupported payload' },
      isRevoked: false,
      status: 'success'
    })
    messageStore.addMessage('friend-a', 1, {
      messageID: 'text',
      messageSeq: 2,
      clientMsgNo: 'text-1',
      fromUID: 'friend-a',
      timestamp: 101,
      content: { type: 1, text: 'visible text' },
      isRevoked: false,
      status: 'success'
    })
    await vi.waitFor(() => {
      const conv = conversationStore.conversations.find(item => item.channel_id === 'friend-a')
      expect(conv?.last_message?.content).toMatchObject({ type: 1, text: 'visible text' })
    })
  })
})
