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
})
