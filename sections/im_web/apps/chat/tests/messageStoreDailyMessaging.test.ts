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
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
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

  it('backfills the recent history window when local channel state only has newer realtime messages', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const store = useMessageStore()

    store.addRealtimeMessage('group-history', 2, {
      messageID: 'm-40',
      messageSeq: 40,
      clientMsgNo: 'client-40',
      fromUID: 'friend-a',
      timestamp: 400,
      status: 1,
      reactions: [],
      remoteExtra: undefined,
      content: { contentType: 1, contentObj: { text: 'latest realtime only' } }
    } as any, { isUnreadCleared: true })

    syncMessages.mockImplementation(async (params: any) => {
      if (params.start_message_seq === 40) {
        return { messages: [] }
      }
      if (params.start_message_seq === 1) {
        return {
          messages: [
            {
              message_idstr: 'm-1',
              message_seq: 1,
              client_msg_no: 'client-1',
              from_uid: 'friend-a',
              timestamp: 100,
              payload: JSON.stringify({ type: 1, text: 'oldest visible message' })
            },
            {
              message_idstr: 'm-20',
              message_seq: 20,
              client_msg_no: 'client-20',
              from_uid: 'friend-b',
              timestamp: 200,
              payload: JSON.stringify({ type: 1, text: 'older visible message' })
            }
          ]
        }
      }
      if (params.start_message_seq === 21) {
        return {
          messages: [
            {
              message_idstr: 'm-21',
              message_seq: 21,
              client_msg_no: 'client-21',
              from_uid: 'friend-a',
              timestamp: 210,
              payload: JSON.stringify({ type: 1, text: 'bridge visible message' })
            },
            {
              message_idstr: 'm-30',
              message_seq: 30,
              client_msg_no: 'client-30',
              from_uid: 'friend-b',
              timestamp: 300,
              payload: JSON.stringify({ type: 1, text: 'middle visible message' })
            },
            {
              message_idstr: 'm-40',
              message_seq: 40,
              client_msg_no: 'client-40',
              from_uid: 'friend-a',
              timestamp: 400,
              payload: JSON.stringify({ type: 1, text: 'latest realtime only' })
            }
          ]
        }
      }
      return { messages: [] }
    })

    await store.syncMessages('group-history', 2, { hydrateVisibleHistory: true })

    expect(syncMessages).toHaveBeenCalledWith(expect.objectContaining({
      channel_id: 'group-history',
      channel_type: 2,
      start_message_seq: 1
    }))
    expect(syncMessages).toHaveBeenCalledWith(expect.objectContaining({
      channel_id: 'group-history',
      channel_type: 2,
      start_message_seq: 21
    }))
    expect(store.getChannelMessages('group-history', 2).map(item => item.content.text)).toEqual([
      'oldest visible message',
      'older visible message',
      'bridge visible message',
      'middle visible message',
      'latest realtime only'
    ])
  })

  it('hydrates the visible recent history when the server latest window starts after earlier messages', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const store = useMessageStore()

    const makeRawMessage = (seq: number) => ({
      message_idstr: `m-${seq}`,
      message_seq: seq,
      client_msg_no: `client-${seq}`,
      from_uid: seq % 2 === 0 ? 'friend-a' : 'friend-b',
      timestamp: 1000 + seq,
      payload: JSON.stringify({ type: 1, text: `message-${seq}` })
    })

    syncMessages.mockImplementation(async (params: any) => {
      if (params.start_message_seq === 0) {
        return { messages: Array.from({ length: 30 }, (_, index) => makeRawMessage(index + 72)) }
      }
      if (params.start_message_seq === 1) {
        return { messages: Array.from({ length: 30 }, (_, index) => makeRawMessage(index + 1)) }
      }
      if (params.start_message_seq === 31) {
        return { messages: Array.from({ length: 30 }, (_, index) => makeRawMessage(index + 31)) }
      }
      if (params.start_message_seq === 61) {
        return { messages: Array.from({ length: 30 }, (_, index) => makeRawMessage(index + 61)) }
      }
      if (params.start_message_seq === 91) {
        return { messages: Array.from({ length: 11 }, (_, index) => makeRawMessage(index + 91)) }
      }
      return { messages: [] }
    })

    await store.syncMessages('group-long-history', 2, { hydrateVisibleHistory: true })

    expect(syncMessages).toHaveBeenCalledWith(expect.objectContaining({ start_message_seq: 0 }))
    expect(syncMessages).toHaveBeenCalledWith(expect.objectContaining({ start_message_seq: 1 }))
    expect(syncMessages).toHaveBeenCalledWith(expect.objectContaining({ start_message_seq: 31 }))
    expect(store.getChannelMessages('group-long-history', 2).map(item => item.content.text)).toEqual(
      Array.from({ length: 101 }, (_, index) => `message-${index + 1}`)
    )
  })

  it('starts cold visible-history sync from the known latest conversation sequence', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const store = useMessageStore()
    const conversationStore = useConversationStore()
    conversationStore.conversations.push({
      channel_id: 'friend-long',
      channel_type: 1,
      unread: 0,
      last_msg_seq: 120,
      last_msg_time: 1200,
      last_message: {},
      top: 0,
      mute: 0,
      name: 'Long Friend',
      avatar: ''
    })

    const makeRawMessage = (seq: number) => ({
      message_idstr: `m-${seq}`,
      message_seq: seq,
      client_msg_no: `client-${seq}`,
      from_uid: 'friend-long',
      timestamp: 1000 + seq,
      payload: JSON.stringify({ type: 1, text: `message-${seq}` })
    })

    syncMessages.mockImplementation(async (params: any) => {
      if (params.pull_mode === 0 && params.start_message_seq === 120) {
        return { messages: [118, 119, 120].map(makeRawMessage) }
      }
      return { messages: [] }
    })

    await store.syncMessages('friend-long', 1, { hydrateVisibleHistory: true })

    expect(syncMessages).toHaveBeenNthCalledWith(1, expect.objectContaining({
      channel_id: 'friend-long',
      channel_type: 1,
      start_message_seq: 120,
      pull_mode: 0
    }))
    expect(store.getChannelMessages('friend-long', 1).map(item => item.content.text)).toEqual([
      'message-118',
      'message-119',
      'message-120'
    ])
  })

  it('uses a history-only device id for visible channel history sync', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const store = useMessageStore()

    syncMessages.mockResolvedValue({
      messages: [{
        message_idstr: 'm-1',
        message_seq: 1,
        client_msg_no: 'client-1',
        from_uid: 'friend-history',
        timestamp: 1001,
        payload: JSON.stringify({ type: 1, text: 'history visible message' })
      }]
    })

    await store.syncMessages('friend-history', 1, { hydrateVisibleHistory: true })

    expect(syncMessages).toHaveBeenCalledWith(expect.objectContaining({
      channel_id: 'friend-history',
      channel_type: 1,
      device_uuid: 'im-web-history'
    }))
  })

  it('loads older channel history before the current earliest visible message', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const store = useMessageStore()

    const makeLocalMessage = (seq: number) => ({
      messageID: `m-${seq}`,
      messageSeq: seq,
      clientMsgNo: `client-${seq}`,
      fromUID: seq % 2 === 0 ? 'friend-a' : 'friend-b',
      timestamp: 1000 + seq,
      content: { type: 1, text: `message-${seq}` },
      isRevoked: false,
      status: 'success' as const
    })
    for (let seq = 199; seq <= 228; seq++) {
      store.addMessage('group-long-history', 2, makeLocalMessage(seq), { countUnread: false })
    }

    const makeRawMessage = (seq: number) => ({
      message_idstr: `m-${seq}`,
      message_seq: seq,
      client_msg_no: `client-${seq}`,
      from_uid: seq % 2 === 0 ? 'friend-a' : 'friend-b',
      timestamp: 1000 + seq,
      payload: JSON.stringify({ type: 1, text: `message-${seq}` })
    })
    syncMessages.mockResolvedValue({
      messages: Array.from({ length: 30 }, (_, index) => makeRawMessage(170 + index))
    })

    const loaded = await store.loadEarlierMessages('group-long-history', 2)

    expect(loaded).toBe(29)
    expect(syncMessages).toHaveBeenCalledWith(expect.objectContaining({
      channel_id: 'group-long-history',
      channel_type: 2,
      limit: 30,
      start_message_seq: 199,
      pull_mode: 0,
      device_uuid: 'im-web-history'
    }))
    expect(store.getChannelMessages('group-long-history', 2).map(item => item.content.text)).toEqual(
      Array.from({ length: 59 }, (_, index) => `message-${170 + index}`)
    )
  })

  it('refreshes a stale local visible-history window from the known latest conversation sequence', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const store = useMessageStore()
    const conversationStore = useConversationStore()
    conversationStore.conversations.push({
      channel_id: 'group-stale-window',
      channel_type: 2,
      unread: 0,
      last_msg_seq: 120,
      last_msg_time: 1200,
      last_message: {},
      top: 0,
      mute: 0,
      name: 'Stale Group',
      avatar: ''
    })
    store.addMessage('group-stale-window', 2, {
      messageID: 'm-20',
      messageSeq: 20,
      clientMsgNo: 'client-20',
      fromUID: 'friend-a',
      timestamp: 1020,
      content: { type: 1, text: 'old local window' },
      isRevoked: false,
      status: 'success'
    })

    const makeRawMessage = (seq: number) => ({
      message_idstr: `m-${seq}`,
      message_seq: seq,
      client_msg_no: `client-${seq}`,
      from_uid: 'friend-a',
      timestamp: 1000 + seq,
      payload: JSON.stringify({ type: 1, text: `message-${seq}` })
    })

    syncMessages.mockImplementation(async (params: any) => {
      if (params.pull_mode === 0 && params.start_message_seq === 120) {
        return { messages: [118, 119, 120].map(makeRawMessage) }
      }
      return { messages: [] }
    })

    await store.syncMessages('group-stale-window', 2, { hydrateVisibleHistory: true })

    expect(syncMessages).toHaveBeenNthCalledWith(1, expect.objectContaining({
      channel_id: 'group-stale-window',
      channel_type: 2,
      start_message_seq: 120,
      pull_mode: 0
    }))
    expect(store.getChannelMessages('group-stale-window', 2).map(item => item.content.text)).toContain('message-120')
  })

  it('keeps background sync to the latest page unless visible history hydration is requested', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const store = useMessageStore()

    syncMessages.mockImplementation(async (params: any) => {
      if (params.start_message_seq === 0) {
        return {
          messages: [{
            message_idstr: 'm-72',
            message_seq: 72,
            client_msg_no: 'client-72',
            from_uid: 'friend-a',
            timestamp: 1072,
            payload: JSON.stringify({ type: 1, text: 'latest page only' })
          }]
        }
      }
      throw new Error(`unexpected backfill start ${params.start_message_seq}`)
    })

    await store.syncMessages('group-background-sync', 2)

    expect(syncMessages).toHaveBeenCalledTimes(1)
    expect(syncMessages).toHaveBeenCalledWith(expect.objectContaining({ start_message_seq: 0 }))
    expect(store.getChannelMessages('group-background-sync', 2).map(item => item.content.text)).toEqual([
      'latest page only'
    ])
  })

  it('increments unread when an existing non-active conversation receives a realtime message', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const messageStore = useMessageStore()
    const conversationStore = useConversationStore()

    conversationStore.conversations.push({
      channel_id: 'friend-a',
      channel_type: 1,
      unread: 0,
      last_msg_seq: 1,
      last_msg_time: 100,
      last_message: {
        messageSeq: 1,
        timestamp: 100,
        fromUID: 'friend-a',
        payload: { type: 1, text: 'existing' },
        content: { type: 1, text: 'existing' }
      },
      top: 0,
      mute: 0,
      name: 'Friend A',
      avatar: ''
    })
    conversationStore.unreadMap['friend-a-1'] = 0

    messageStore.addRealtimeMessage('friend-a', 1, {
      messageID: 'm-new',
      messageSeq: 2,
      clientMsgNo: 'client-new',
      fromUID: 'friend-a',
      timestamp: 101,
      status: 1,
      reactions: [],
      remoteExtra: undefined,
      content: { contentType: 1, contentObj: { text: 'new unread' } }
    } as any, { isUnreadCleared: false })

    await vi.waitFor(() => {
      expect(conversationStore.conversations.find(item => item.channel_id === 'friend-a')?.unread).toBe(1)
      expect(conversationStore.unreadMap['friend-a-1']).toBe(1)
    })
  })

  it('does not let unsupported content become the conversation digest', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
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

  it('registers all supported content types and exposes an unavailable fallback content type', async () => {
    const source = await import('../../../packages/datasource-vue/src/contentTypes/index.ts?raw')

    for (const type of [3, 4, 5, 6, 7, 8, 11, 12, 13]) {
      expect(source.default).toContain(`sdk.register(${type}`)
    }
    expect(source.default).toContain('UnsupportedMessageContent')
    expect(source.default).toContain('createUnavailableMessage')
    expect(source.default).toContain('[暂不支持的消息]')
  })
})
