import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createClowderTestReply } from './setup'

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
    syncMessages: vi.fn(),
    syncConversations: vi.fn(),
    syncConversationExtra: vi.fn(async () => []),
    updateConversationExtra: vi.fn(),
    clearUnread: vi.fn(),
    deleteConversation: vi.fn(),
    revokeMessage: vi.fn(),
    addReaction: vi.fn(),
    markReaded: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
    mutualDeleteMessage: vi.fn(),
    getMessageReceipt: vi.fn(),
    pinMessage: vi.fn(),
    syncPinnedMessages: vi.fn(),
    syncReminders: vi.fn(),
    doneReminders: vi.fn()
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
      newMessageText: vi.fn((text: string) => ({ contentType: 1, contentObj: { text } })),
      chatManager: { send: vi.fn() }
    })
  },
  MessageContent: class {
    encode() {
      return new TextEncoder().encode(JSON.stringify({ type: this.contentType }))
    }
  },
  MediaMessageContent: class {},
  MessageImage: class {}
}))

describe('clowder message store contracts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('keeps Clowder reply metadata shape available for durable IM messages', async () => {
    const reply = createClowderTestReply({
      invocationId: 'invoke-123',
      stream: {
        state: 'final',
        platformMessageId: 'im-client-123'
      }
    })

    expect(reply).toMatchObject({
      connectorId: 'im-web',
      externalChatId: '2:group-clowder',
      invocationId: 'invoke-123',
      catId: 'codex',
      catDisplayName: 'Codex',
      format: 'markdown',
      stream: {
        state: 'final',
        platformMessageId: 'im-client-123'
      }
    })
  })

  it('preserves existing message store dedup and AI merge functions for Clowder integration reuse', async () => {
    const store = await import('../../../packages/datasource-vue/src/stores/messageStore.ts?raw')
    const source = store.default

    expect(source).toContain('getMessageMergeKey')
    expect(source).toContain('findMergeableLocalAiStream')
    expect(source).toContain('mergePersistedAiIntoLocal')
    expect(source).toContain('clientMsgNo')
    expect(source).toContain('messageID')
  })

  it('merges durable Clowder replies into local streaming placeholders', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    messageStore.addMessage('group-clowder', 2, {
      messageID: 'clowder-stream-local',
      messageSeq: 0,
      clientMsgNo: 'clowder-stream-local',
      fromUID: 'clowder:codex',
      timestamp: 100,
      content: {
        type: 1,
        text: 'Clowder reply',
        content: 'Clowder reply',
        connectorId: 'im-web',
        catId: 'codex',
        catDisplayName: 'Codex',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: true
      },
      isRevoked: false,
      status: 'sending'
    })

    messageStore.addRealtimeMessage('group-clowder', 2, {
      messageID: 'm-clowder-1',
      messageSeq: 12,
      clientMsgNo: 'server-clowder-client',
      fromUID: 'clowder:codex',
      timestamp: 101,
      status: 1,
      content: {
        contentType: 1,
        contentObj: {
          text: 'Clowder reply',
          content: 'Clowder reply',
          connectorId: 'im-web',
          catId: 'codex',
          catDisplayName: 'Codex'
        }
      },
      remoteExtra: {},
      reactions: []
    } as any)

    const list = messageStore.getChannelMessages('group-clowder', 2)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      messageID: 'm-clowder-1',
      messageSeq: 12,
      clientMsgNo: 'clowder-stream-local',
      fromUID: 'clowder:codex',
      status: 'success',
      content: {
        text: 'Clowder reply',
        connectorId: 'im-web',
        catId: 'codex',
        catDisplayName: 'Codex',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: false
      }
    })
  })

  it('merges persisted own direct-cat text back into the optimistic local row', async () => {
    const api = await import('@tsdaodao/datasource-vue/api')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const messageStore = useMessageStore()
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'me', name: 'Me' }

    messageStore.addMessage('clowder_cat:opus', 1, {
      messageID: '',
      messageSeq: 0,
      clientMsgNo: 'web-local-1',
      fromUID: 'me',
      timestamp: 100,
      content: { type: 1, text: '你好' },
      isRevoked: false,
      status: 'success',
      retryable: false
    })

    vi.mocked(api.syncApi.syncMessages).mockResolvedValueOnce({
      messages: [
        {
          message_idstr: 'server-message-1',
          message_seq: 8,
          client_msg_no: 'wk-sdk-client-1',
          from_uid: 'me',
          timestamp: 101,
          payload: JSON.stringify({ type: 1, text: '你好', content: '你好' })
        }
      ]
    })

    await messageStore.syncMessages('clowder_cat:opus', 1)

    const list = messageStore.getChannelMessages('clowder_cat:opus', 1)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      messageID: 'server-message-1',
      messageSeq: 8,
      clientMsgNo: 'web-local-1',
      fromUID: 'me',
      status: 'success',
      content: { type: 1, text: '你好' }
    })
  })

  it('keeps a direct-cat outgoing prompt before the Clowder assistant placeholder that it triggered', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const messageStore = useMessageStore()
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'me', name: 'Me' }

    messageStore.addMessage('clowder_cat:opus', 1, {
      messageID: '',
      messageSeq: 0,
      clientMsgNo: 'web-local-prompt-1',
      fromUID: 'me',
      timestamp: 100,
      content: { type: 1, text: '你好' },
      isRevoked: false,
      status: 'sending',
      retryable: false
    })

    messageStore.addMessage('clowder_cat:opus', 1, {
      messageID: 'cat-thinking-1',
      messageSeq: 12,
      clientMsgNo: '',
      fromUID: 'clowder_cat:opus',
      timestamp: 101,
      content: {
        type: 1,
        text: '【布偶猫🐱】🤔 思考中...',
        connector_id: 'im-web',
        cat_id: 'opus',
        cat_display_name: '布偶猫',
        streaming: true
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })

    const texts = messageStore.getChannelMessages('clowder_cat:opus', 1)
      .map(message => message.content.text)
    expect(texts).toEqual(['你好', '【布偶猫🐱】🤔 思考中...'])
  })

  it('updates direct-cat conversation titles from cat display metadata', async () => {
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const { useChannelStore } = await import('../../../packages/datasource-vue/src/stores/channelStore.ts')
    const conversationStore = useConversationStore()
    const channelStore = useChannelStore()

    await conversationStore.ensureConversation('clowder_cat:opus', 1, {
      messageSeq: 9,
      timestamp: 102,
      fromUID: 'clowder_cat:opus',
      isUnreadCleared: true,
      content: {
        type: 1,
        text: '布偶猫回复',
        catDisplayName: '布偶猫',
        catId: 'opus',
        connectorId: 'im-web'
      }
    })

    const conv = conversationStore.sortedConversations.find(item => item.channel_id === 'clowder_cat:opus')
    expect(conv?.name).toBe('布偶猫')
    expect(channelStore.channels['clowder_cat:opus-1']?.name).toBe('布偶猫')
  })

  it('derives direct-cat conversation titles from final reply suffixes during conversation creation', async () => {
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const { useChannelStore } = await import('../../../packages/datasource-vue/src/stores/channelStore.ts')
    const conversationStore = useConversationStore()
    const channelStore = useChannelStore()

    await conversationStore.ensureConversation('clowder_cat:opus', 1, {
      messageSeq: 10,
      timestamp: 103,
      fromUID: 'clowder_cat:opus',
      isUnreadCleared: true,
      content: {
        type: 1,
        text: '能联网的！有什么想让我查的吗？[宪宪/deepseek-v4-flash🐾]',
        connector_id: 'im-web',
        ai: true
      }
    })

    const conv = conversationStore.sortedConversations.find(item => item.channel_id === 'clowder_cat:opus')
    expect(conv?.name).toBe('宪宪')
    expect(channelStore.channels['clowder_cat:opus-1']?.name).toBe('宪宪')
  })

  it('does not derive direct-cat titles from incidental slash text before final signatures', async () => {
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const { useChannelStore } = await import('../../../packages/datasource-vue/src/stores/channelStore.ts')
    const conversationStore = useConversationStore()
    const channelStore = useChannelStore()

    await conversationStore.ensureConversation('clowder_cat:opus', 1, {
      messageSeq: 11,
      timestamp: 104,
      fromUID: 'clowder_cat:opus',
      isUnreadCleared: true,
      content: {
        type: 1,
        text: '你好呀！这里要确认：是给餐厅/食堂用的真实点餐系统？\n[宪宪/deepseek-v4-flash🐾]',
        connector_id: 'im-web',
        ai: true
      }
    })

    const conv = conversationStore.sortedConversations.find(item => item.channel_id === 'clowder_cat:opus')
    expect(conv?.name).toBe('宪宪')
    expect(channelStore.channels['clowder_cat:opus-1']?.name).toBe('宪宪')
  })

  it('keeps existing direct-cat summaries on the cat display name after message updates', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const { useChannelStore } = await import('../../../packages/datasource-vue/src/stores/channelStore.ts')
    const messageStore = useMessageStore()
    const conversationStore = useConversationStore()
    const channelStore = useChannelStore()

    conversationStore.conversations.push({
      channel_id: 'clowder_cat:opus',
      channel_type: 1,
      unread: 0,
      last_msg_seq: 1,
      last_msg_time: 100,
      top: 0,
      mute: 0,
      name: 'opus',
      avatar: ''
    })

    messageStore.addMessage('clowder_cat:opus', 1, {
      messageID: 'cat-reply-1',
      messageSeq: 10,
      clientMsgNo: '',
      fromUID: 'clowder_cat:opus',
      timestamp: 103,
      content: {
        type: 1,
        text: '布偶猫最终回复',
        cat_display_name: '布偶猫',
        cat_id: 'opus',
        connector_id: 'im-web'
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })

    const conv = conversationStore.sortedConversations.find(item => item.channel_id === 'clowder_cat:opus')
    expect(conv?.name).toBe('布偶猫')
    expect(channelStore.channels['clowder_cat:opus-1']?.name).toBe('布偶猫')
  })

  it('derives direct-cat titles from earlier streaming cat prefixes when final metadata is missing', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const { useChannelStore } = await import('../../../packages/datasource-vue/src/stores/channelStore.ts')
    const messageStore = useMessageStore()
    const conversationStore = useConversationStore()
    const channelStore = useChannelStore()

    conversationStore.conversations.push({
      channel_id: 'clowder_cat:opus',
      channel_type: 1,
      unread: 0,
      last_msg_seq: 1,
      last_msg_time: 100,
      top: 0,
      mute: 0,
      name: 'opus',
      avatar: ''
    })

    messageStore.addMessage('clowder_cat:opus', 1, {
      messageID: 'cat-placeholder-1',
      messageSeq: 9,
      clientMsgNo: '',
      fromUID: 'clowder_cat:opus',
      timestamp: 102,
      content: {
        type: 1,
        text: '【布偶猫🐱】🤔 思考中...',
        connector_id: 'im-web',
        ai: true,
        streaming: true
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })
    messageStore.addMessage('clowder_cat:opus', 1, {
      messageID: 'cat-final-1',
      messageSeq: 10,
      clientMsgNo: '',
      fromUID: 'clowder_cat:opus',
      timestamp: 103,
      content: {
        type: 1,
        text: '最终回复没有显式猫名元数据',
        connector_id: 'im-web',
        ai: true
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })

    const conv = conversationStore.sortedConversations.find(item => item.channel_id === 'clowder_cat:opus')
    expect(conv?.name).toBe('布偶猫')
    expect(channelStore.channels['clowder_cat:opus-1']?.name).toBe('布偶猫')
  })

  it('derives direct-cat titles from final reply suffixes when metadata and stream prefix are missing', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const { useChannelStore } = await import('../../../packages/datasource-vue/src/stores/channelStore.ts')
    const messageStore = useMessageStore()
    const conversationStore = useConversationStore()
    const channelStore = useChannelStore()

    conversationStore.conversations.push({
      channel_id: 'clowder_cat:opus',
      channel_type: 1,
      unread: 0,
      last_msg_seq: 1,
      last_msg_time: 100,
      top: 0,
      mute: 0,
      name: 'opus',
      avatar: ''
    })

    messageStore.addMessage('clowder_cat:opus', 1, {
      messageID: 'cat-final-suffix-1',
      messageSeq: 11,
      clientMsgNo: '',
      fromUID: 'clowder_cat:opus',
      timestamp: 104,
      content: {
        type: 1,
        text: '能联网的！有什么想让我查的吗？[宪宪/deepseek-v4-flash🐾]',
        connector_id: 'im-web',
        ai: true
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })

    const conv = conversationStore.sortedConversations.find(item => item.channel_id === 'clowder_cat:opus')
    expect(conv?.name).toBe('宪宪')
    expect(channelStore.channels['clowder_cat:opus-1']?.name).toBe('宪宪')
  })
})
