import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

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
  commonApi: {
    getChannelInfo: vi.fn(async () => ({}))
  },
  resolveApiAssetUrl: (url: string) => url
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
  MessageContent: class {},
  MediaMessageContent: class {},
  MessageImage: class {}
}))

describe('clowder streaming merge contracts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('keeps Clowder stream merge keys and final cleanup in messageStore', async () => {
    const source = await import('../../../packages/datasource-vue/src/stores/messageStore.ts?raw')

    expect(source.default).toContain('clowder-stream-')
    expect(source.default).toContain('findMergeableLocalAiStream')
    expect(source.default).toContain('mergePersistedAiIntoLocal')
    expect(source.default).toContain('pruneDuplicateAiStreams')
  })

  it('places a Clowder thinking placeholder after the user question in group chats', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const messageStore = useMessageStore()
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'creator', name: 'Creator' }

    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'placeholder',
      messageSeq: 1,
      clientMsgNo: 'server-random-placeholder',
      fromUID: 'creator',
      timestamp: 100,
      content: {
        type: 1,
        text: '【布偶猫🐱】🤔 思考中...',
        connectorId: 'im-web',
        streaming: true,
        stream: { state: 'placeholder' }
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })
    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'question',
      messageSeq: 3,
      clientMsgNo: 'question-client',
      fromUID: 'creator',
      timestamp: 101,
      content: { type: 1, text: '@布偶猫 收到请确认。' },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })

    const texts = messageStore.getChannelMessages('group-cat-cafe', 2).map(item => item.content.text)
    expect(texts).toEqual(['@布偶猫 收到请确认。', '【布偶猫🐱】🤔 思考中...'])
  })

  it('lets newer group user messages push an older Clowder thinking placeholder upward', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const messageStore = useMessageStore()
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'creator', name: 'Creator' }

    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'placeholder',
      messageSeq: 1,
      clientMsgNo: 'server-random-placeholder',
      fromUID: 'creator',
      timestamp: 100,
      content: {
        type: 1,
        text: '【布偶猫🐱】🤔 思考中...',
        connectorId: 'im-web',
        streaming: true,
        stream: { state: 'placeholder' }
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })
    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'question',
      messageSeq: 3,
      clientMsgNo: 'question-client',
      fromUID: 'creator',
      timestamp: 101,
      content: { type: 1, text: '@布偶猫 文件发给我' },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })
    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'newer-human',
      messageSeq: 4,
      clientMsgNo: 'newer-human-client',
      fromUID: 'member',
      timestamp: 102,
      content: { type: 1, text: '我补充一个信息' },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })

    const texts = messageStore.getChannelMessages('group-cat-cafe', 2).map(item => item.content.text)
    expect(texts).toEqual(['@布偶猫 文件发给我', '【布偶猫🐱】🤔 思考中...', '我补充一个信息'])
  })

  it('merges a persisted Clowder placeholder into the final streamed group reply', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'placeholder',
      messageSeq: 1,
      clientMsgNo: 'server-random-placeholder',
      fromUID: 'creator',
      timestamp: 100,
      content: {
        type: 1,
        text: '【布偶猫🐱】🤔 思考中...',
        connectorId: 'im-web',
        invocationId: 'invoke-1',
        streaming: true,
        stream: { state: 'placeholder' }
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })
    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'final',
      messageSeq: 4,
      clientMsgNo: '',
      fromUID: 'creator',
      timestamp: 108,
      content: {
        type: 1,
        text: '收到，猫群自动测试通过。[布偶猫/宪宪 deepseek-v4-flash]',
        connectorId: 'im-web',
        invocationId: 'invoke-1',
        markdown: true
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })

    const messages = messageStore.getChannelMessages('group-cat-cafe', 2)
    expect(messages).toHaveLength(1)
    expect(messages[0].messageSeq).toBe(4)
    expect(messages[0].content.text).toContain('猫群自动测试通过')
  })

  it('preserves the local cat identity when a human interrupts before the final streamed group reply', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'placeholder',
      messageSeq: 1,
      clientMsgNo: 'server-random-placeholder',
      fromUID: 'creator',
      timestamp: 100,
      content: {
        type: 1,
        text: '【布偶猫🐱】🤔 思考中...',
        connectorId: 'im-web',
        catId: 'ragdoll-kn9a',
        catDisplayName: '布偶猫',
        markdown: true,
        invocationId: 'invoke-identity',
        streaming: true,
        stream: { state: 'placeholder' }
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })
    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'human-interrupt',
      messageSeq: 3,
      clientMsgNo: 'human-interrupt-client',
      fromUID: 'member-b',
      timestamp: 102,
      content: { type: 1, text: '我插一句' },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })
    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'final',
      messageSeq: 4,
      clientMsgNo: '',
      fromUID: 'creator',
      timestamp: 108,
      content: {
        type: 1,
        text: '我是群里的布偶猫，可以帮大家整理上下文。',
        connectorId: 'im-web',
        invocationId: 'invoke-identity'
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })

    const messages = messageStore.getChannelMessages('group-cat-cafe', 2)
    const final = messages.find(item => item.messageID === 'final')
    expect(final?.content.catDisplayName).toBe('布偶猫')
    expect(final?.content.catId).toBe('ragdoll-kn9a')
    expect(final?.content.markdown).toBe(true)
  })
})
