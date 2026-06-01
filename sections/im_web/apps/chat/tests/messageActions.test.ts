import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const revokeMessage = vi.fn()
const addReaction = vi.fn()
const markReaded = vi.fn()
const editMessage = vi.fn()
const deleteMessage = vi.fn()
const mutualDeleteMessage = vi.fn()
const getMessageReceipt = vi.fn()
const pinMessage = vi.fn()
const syncPinnedMessages = vi.fn()
const syncReminders = vi.fn()
const doneReminders = vi.fn()
const send = vi.fn()

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
    markReaded,
    editMessage,
    deleteMessage,
    mutualDeleteMessage,
    getMessageReceipt,
    pinMessage,
    syncPinnedMessages,
    syncReminders,
    doneReminders,
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
      newMessageText: vi.fn((text: string) => ({ contentType: 1, contentObj: { text } })),
      chatManager: { send }
    })
  },
  MessageContent: class {
    encode() {
      const contentObj = this.encodeJSON()
      contentObj.type = this.contentType
      return new TextEncoder().encode(JSON.stringify(contentObj))
    }
  },
  MediaMessageContent: class {},
  MessageImage: class {}
}))

describe('message action state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    revokeMessage.mockResolvedValue(undefined)
    addReaction.mockResolvedValue(undefined)
    markReaded.mockResolvedValue(undefined)
    editMessage.mockResolvedValue(undefined)
    deleteMessage.mockResolvedValue(undefined)
    mutualDeleteMessage.mockResolvedValue(undefined)
    getMessageReceipt.mockResolvedValue({ readed: [{ uid: 'u1', name: 'A' }], unread: [{ uid: 'u2', name: 'B' }] })
    pinMessage.mockResolvedValue(undefined)
    syncPinnedMessages.mockResolvedValue({
      pinned_messages: [{ message_id: 'm1', message_seq: 1, channel_id: 'friend-a', channel_type: 1, is_deleted: 0, version: 2 }],
      messages: []
    })
    syncReminders.mockResolvedValue([
      { id: 10, channel_id: 'group-a', channel_type: 2, message_id: 'm2', message_seq: 8, text: '[有人@我]', done: 0, version: 3 }
    ])
    doneReminders.mockResolvedValue(undefined)
    send.mockResolvedValue({
      messageID: 'm-sent',
      messageSeq: 3,
      clientMsgNo: 'c-sent',
      fromUID: 'me',
      timestamp: 103,
      status: 1,
      content: { contentType: 1, contentObj: { text: 'hello' } }
    })
  })

  it('marks revoked messages and keeps stale revoked text out of the conversation summary', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
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

  it('sends system robot menu commands as text payloads with bot command entities', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const store = useMessageStore()

    await store.sendMessage('u_10000', 1, '/基本信息', {
      robot: {
        robotId: 'u_10000',
        command: '/基本信息'
      }
    } as any)

    const sentContent = send.mock.calls[0][0]
    expect(sentContent.encodeJSON()).toEqual({
      content: '/基本信息',
      robot_id: 'u_10000',
      entities: [{
        type: 'bot_command',
        offset: 0,
        length: 5
      }]
    })
    expect(JSON.parse(new TextDecoder().decode(sentContent.encode()))).toEqual({
      content: '/基本信息',
      robot_id: 'u_10000',
      entities: [{
        type: 'bot_command',
        offset: 0,
        length: 5
      }],
      type: 1
    })
    expect(store.getChannelMessages('u_10000', 1)[0].content).toMatchObject({
      text: '/基本信息',
      robot_id: 'u_10000',
      entities: [{
        type: 'bot_command',
        offset: 0,
        length: 5
      }]
    })
  })

  it('toggles local reaction participants after backend acknowledgement', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
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

  it('tracks sending, failed, and retryable outgoing text messages without duplicating visible rows', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const messageStore = useMessageStore()
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'me', name: 'Me' }

    send.mockRejectedValueOnce(new Error('offline'))
    await expect(messageStore.sendMessage('friend-a', 1, 'hello')).rejects.toThrow('offline')
    const failed = messageStore.getChannelMessages('friend-a', 1)
    expect(failed).toHaveLength(1)
    expect(failed[0]).toMatchObject({
      fromUID: 'me',
      status: 'fail',
      retryable: true,
      content: { type: 1, text: 'hello' }
    })

    await messageStore.retryMessage('friend-a', 1, failed[0].clientMsgNo)
    const retried = messageStore.getChannelMessages('friend-a', 1)
    expect(retried).toHaveLength(1)
    expect(retried[0]).toMatchObject({
      messageID: 'm-sent',
      messageSeq: 3,
      clientMsgNo: failed[0].clientMsgNo,
      status: 'success',
      retryable: false
    })
  })

  it('remembers the SDK clientSeq alias when text send resolves before a durable seq', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const messageStore = useMessageStore()
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'me', name: 'Me' }

    send.mockResolvedValueOnce({
      messageID: '',
      messageSeq: 0,
      clientSeq: 42,
      clientMsgNo: 'sdk-client-42',
      fromUID: 'me',
      timestamp: 103,
      status: 1,
      content: { contentType: 1, contentObj: { text: 'hello before ack' } }
    })

    await messageStore.sendMessage('friend-a', 1, 'hello before ack')

    const [local] = messageStore.getChannelMessages('friend-a', 1)
    expect(local).toMatchObject({
      messageSeq: 0,
      status: 'success',
      content: { type: 1, text: 'hello before ack' }
    })
    expect(messageStore.resolvePendingAckClientMsgNo(42)).toBe(local.clientMsgNo)
  })

  it('merges local streaming AI replies with the persisted robot message returned by sync', async () => {
    const api = await import('@tsdaodao/datasource-vue/api')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'ai-stream-local',
      messageSeq: 0,
      clientMsgNo: 'ai-stream-local',
      fromUID: 'deepseek_ai_robot',
      timestamp: 100,
      content: {
        type: 1,
        text: '**流式回复**',
        content: '**流式回复**',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: true
      },
      isRevoked: false,
      status: 'sending'
    })

    messageStore.updateMessageStatus('ai-stream-local', {
      messageID: 'm-ai-1',
      messageSeq: 11,
      status: 'success',
      content: {
        type: 1,
        text: '**流式回复**',
        content: '**流式回复**',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: false
      }
    })

    vi.mocked(api.syncApi.syncMessages).mockResolvedValueOnce({
      messages: [{
        message_id: 1,
        message_idstr: 'm-ai-1',
        message_seq: 11,
        client_msg_no: 'server-ai-client',
        from_uid: 'deepseek_ai_robot',
        timestamp: 101,
        payload: JSON.stringify({
          type: 1,
          text: '**流式回复**',
          content: '**流式回复**',
          format: 'markdown',
          markdown: true,
          ai: true
        }),
        is_deleted: 0
      }]
    })

    await messageStore.syncMessages('deepseek_ai_robot', 1)

    const list = messageStore.getChannelMessages('deepseek_ai_robot', 1)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      messageID: 'm-ai-1',
      messageSeq: 11,
      clientMsgNo: 'ai-stream-local',
      fromUID: 'deepseek_ai_robot',
      status: 'success',
      content: {
        text: '**流式回复**',
        format: 'markdown',
        markdown: true,
        ai: true
      }
    })
  })

  it('syncMessages uses the last confirmed sequence and ignores pending stream rows', async () => {
    const api = await import('@tsdaodao/datasource-vue/api')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'm-user',
      messageSeq: 7,
      clientMsgNo: 'user-local',
      fromUID: 'me',
      timestamp: 100,
      content: { type: 1, text: 'prompt' },
      isRevoked: false,
      status: 'success'
    })
    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'ai-stream-local',
      messageSeq: 0,
      clientMsgNo: 'ai-stream-local',
      fromUID: 'deepseek_ai_robot',
      timestamp: 101,
      content: { type: 1, text: 'streaming', markdown: true, ai: true, streaming: true },
      isRevoked: false,
      status: 'sending'
    })
    vi.mocked(api.syncApi.syncMessages).mockResolvedValueOnce({ messages: [] })

    await messageStore.syncMessages('deepseek_ai_robot', 1)

    expect(api.syncApi.syncMessages).toHaveBeenCalledWith(expect.objectContaining({
      channel_id: 'deepseek_ai_robot',
      channel_type: 1,
      start_message_seq: 7
    }))
  })

  it('merges realtime persisted AI replies into the local streaming AI bubble', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'ai-stream-local',
      messageSeq: 0,
      clientMsgNo: 'ai-stream-local',
      fromUID: 'deepseek_ai_robot',
      timestamp: 100,
      content: {
        type: 1,
        text: '**实时回复**',
        content: '**实时回复**',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: true
      },
      isRevoked: false,
      status: 'sending'
    })

    messageStore.addRealtimeMessage('deepseek_ai_robot', 1, {
      messageID: 'm-ai-realtime',
      messageSeq: 12,
      clientMsgNo: 'server-ai-realtime-client',
      fromUID: 'deepseek_ai_robot',
      timestamp: 101,
      status: 1,
      content: {
        contentType: 1,
        contentObj: {
          text: '**实时回复**',
          content: '**实时回复**'
        }
      },
      remoteExtra: {},
      reactions: []
    } as any)

    const list = messageStore.getChannelMessages('deepseek_ai_robot', 1)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      messageID: 'm-ai-realtime',
      messageSeq: 12,
      clientMsgNo: 'ai-stream-local',
      fromUID: 'deepseek_ai_robot',
      status: 'success',
      content: {
        text: '**实时回复**',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: false
      }
    })
  })

  it('deduplicates realtime AI echoes when the SDK message id is numeric after SSE finalization', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'ai-stream-local',
      messageSeq: 0,
      clientMsgNo: 'ai-stream-local',
      fromUID: 'deepseek_ai_robot',
      timestamp: 100,
      content: {
        type: 1,
        text: '**最终回复**',
        content: '**最终回复**',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: true
      },
      isRevoked: false,
      status: 'sending'
    })

    messageStore.updateMessageStatus('ai-stream-local', {
      messageID: '12345',
      messageSeq: 15,
      status: 'success',
      content: {
        type: 1,
        text: '**最终回复**',
        content: '**最终回复**',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: false
      }
    })

    messageStore.addRealtimeMessage('deepseek_ai_robot', 1, {
      messageID: 12345,
      messageSeq: 15,
      clientMsgNo: 'server-ai-numeric-client',
      fromUID: 'deepseek_ai_robot',
      timestamp: 101,
      status: 1,
      content: {
        contentType: 1,
        contentObj: {
          text: '**最终回复**',
          content: '**最终回复**',
          format: 'markdown',
          markdown: true,
          ai: true
        }
      },
      remoteExtra: {},
      reactions: []
    } as any)

    const list = messageStore.getChannelMessages('deepseek_ai_robot', 1)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      messageID: '12345',
      clientMsgNo: 'ai-stream-local',
      content: {
        text: '**最终回复**',
        format: 'markdown',
        markdown: true,
        ai: true
      }
    })
  })

  it('merges realtime AI replies even when the backend person-channel seq is lower than the local prompt seq', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'm-user-newer',
      messageSeq: 30,
      clientMsgNo: 'user-newer',
      fromUID: 'me',
      timestamp: 100,
      content: { type: 1, text: 'prompt' },
      isRevoked: false,
      status: 'success'
    })
    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'ai-stream-local',
      messageSeq: 0,
      clientMsgNo: 'ai-stream-local',
      fromUID: 'deepseek_ai_robot',
      timestamp: 101,
      content: {
        type: 1,
        text: '**低序号回复**',
        content: '**低序号回复**',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: true
      },
      isRevoked: false,
      status: 'sending'
    })

    messageStore.addRealtimeMessage('deepseek_ai_robot', 1, {
      messageID: 'm-ai-lower-seq',
      messageSeq: 29,
      clientMsgNo: 'server-ai-lower-seq',
      fromUID: 'deepseek_ai_robot',
      timestamp: 102,
      status: 1,
      content: {
        contentType: 1,
        contentObj: {
          text: '**低序号回复**',
          content: '**低序号回复**'
        }
      },
      remoteExtra: {},
      reactions: []
    } as any)

    const list = messageStore.getChannelMessages('deepseek_ai_robot', 1)
    expect(list.filter(item => item.fromUID === 'deepseek_ai_robot')).toHaveLength(1)
    expect(list.find(item => item.clientMsgNo === 'ai-stream-local')).toMatchObject({
      messageID: 'm-ai-lower-seq',
      messageSeq: 29,
      content: {
        text: '**低序号回复**',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: false
      }
    })
  })

  it('removes an already inserted realtime AI duplicate when SSE finalization provides the same message id', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'ai-stream-local',
      messageSeq: 0,
      clientMsgNo: 'ai-stream-local',
      fromUID: 'deepseek_ai_robot',
      timestamp: 100,
      content: {
        type: 1,
        text: '**最终合并**',
        content: '**最终合并**',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: true
      },
      isRevoked: false,
      status: 'sending'
    })
    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'm-ai-final',
      messageSeq: 22,
      clientMsgNo: 'server-ai-final',
      fromUID: 'deepseek_ai_robot',
      timestamp: 101,
      content: {
        type: 1,
        text: '**最终合并**',
        content: '**最终合并**',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: false
      },
      isRevoked: false,
      status: 'success'
    })

    messageStore.updateMessageStatus('ai-stream-local', {
      messageID: 'm-ai-final',
      messageSeq: 22,
      status: 'success',
      content: {
        type: 1,
        text: '**最终合并**',
        content: '**最终合并**',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: false
      }
    })

    const list = messageStore.getChannelMessages('deepseek_ai_robot', 1)
    expect(list.filter(item => item.fromUID === 'deepseek_ai_robot')).toHaveLength(1)
    expect(list[0].clientMsgNo).toBe('ai-stream-local')
  })

  it('prunes local AI stream duplicates when the persisted backend message has no client message number', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'm-ai-persisted',
      messageSeq: 58,
      clientMsgNo: '',
      fromUID: 'deepseek_ai_robot',
      timestamp: 100,
      content: {
        type: 1,
        text: '**空客户端号回复**',
        content: '**空客户端号回复**',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: false
      },
      isRevoked: false,
      status: 'success'
    })
    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'ai-stream-local',
      messageSeq: 0,
      clientMsgNo: 'ai-stream-local',
      fromUID: 'deepseek_ai_robot',
      timestamp: 101,
      content: {
        type: 1,
        text: '**空客户端号回复**',
        content: '**空客户端号回复**',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: false
      },
      isRevoked: false,
      status: 'success'
    })

    const list = messageStore.getChannelMessages('deepseek_ai_robot', 1)
    expect(list.filter(item => item.fromUID === 'deepseek_ai_robot')).toHaveLength(1)
    expect(list[0]).toMatchObject({
      messageID: 'm-ai-persisted',
      clientMsgNo: '',
      content: {
        text: '**空客户端号回复**',
        format: 'markdown',
        markdown: true,
        ai: true
      }
    })
  })

  it('keeps distinct persisted AI replies when backend messages have empty client message numbers', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'm-ai-empty-1',
      messageSeq: 61,
      clientMsgNo: '',
      fromUID: 'deepseek_ai_robot',
      timestamp: 100,
      content: {
        type: 1,
        text: '**第一条持久化回复**',
        content: '**第一条持久化回复**',
        format: 'markdown',
        markdown: true,
        ai: true
      },
      isRevoked: false,
      status: 'success'
    })
    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'm-ai-empty-2',
      messageSeq: 62,
      clientMsgNo: '',
      fromUID: 'deepseek_ai_robot',
      timestamp: 101,
      content: {
        type: 1,
        text: '**第二条持久化回复**',
        content: '**第二条持久化回复**',
        format: 'markdown',
        markdown: true,
        ai: true
      },
      isRevoked: false,
      status: 'success'
    })

    const replies = messageStore.getChannelMessages('deepseek_ai_robot', 1)
      .filter(item => item.fromUID === 'deepseek_ai_robot')

    expect(replies).toHaveLength(2)
    expect(replies.map(item => item.content.text)).toEqual([
      '**第一条持久化回复**',
      '**第二条持久化回复**'
    ])
  })

  it('keeps multiple synced AI history replies with empty backend client message numbers', async () => {
    const api = await import('@tsdaodao/datasource-vue/api')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    vi.mocked(api.syncApi.syncMessages).mockResolvedValueOnce({
      messages: [
        {
          message_id: 1,
          message_idstr: 'm-ai-history-empty-1',
          message_seq: 71,
          client_msg_no: '',
          from_uid: 'deepseek_ai_robot',
          timestamp: 100,
          payload: JSON.stringify({
            type: 1,
            text: '**历史回复一**',
            content: '**历史回复一**',
            format: 'markdown',
            markdown: true,
            ai: true
          }),
          is_deleted: 0
        },
        {
          message_id: 2,
          message_idstr: 'm-ai-history-empty-2',
          message_seq: 72,
          client_msg_no: '',
          from_uid: 'deepseek_ai_robot',
          timestamp: 101,
          payload: JSON.stringify({
            type: 1,
            text: '**历史回复二**',
            content: '**历史回复二**',
            format: 'markdown',
            markdown: true,
            ai: true
          }),
          is_deleted: 0
        }
      ]
    })

    await messageStore.syncMessages('deepseek_ai_robot', 1)

    const replies = messageStore.getChannelMessages('deepseek_ai_robot', 1)
      .filter(item => item.fromUID === 'deepseek_ai_robot')

    expect(replies).toHaveLength(2)
    expect(replies.map(item => item.content.text)).toEqual([
      '**历史回复一**',
      '**历史回复二**'
    ])
  })

  it('does not merge older synced AI history into an active local stream', async () => {
    const api = await import('@tsdaodao/datasource-vue/api')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'm-user-latest',
      messageSeq: 20,
      clientMsgNo: 'user-latest',
      fromUID: 'me',
      timestamp: 200,
      content: { type: 1, text: 'new prompt' },
      isRevoked: false,
      status: 'success'
    })
    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'ai-stream-local',
      messageSeq: 0,
      clientMsgNo: 'ai-stream-local',
      fromUID: 'deepseek_ai_robot',
      timestamp: 201,
      content: {
        type: 1,
        text: 'new stream',
        content: 'new stream',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: true
      },
      isRevoked: false,
      status: 'sending'
    })
    vi.mocked(api.syncApi.syncMessages).mockResolvedValueOnce({
      messages: [{
        message_id: 1,
        message_idstr: 'm-ai-old',
        message_seq: 10,
        client_msg_no: 'server-ai-old',
        from_uid: 'deepseek_ai_robot',
        timestamp: 150,
        payload: JSON.stringify({
          type: 1,
          text: 'old reply',
          content: 'old reply',
          format: 'markdown',
          markdown: true,
          ai: true
        }),
        is_deleted: 0
      }]
    })

    await messageStore.syncMessages('deepseek_ai_robot', 1)

    const list = messageStore.getChannelMessages('deepseek_ai_robot', 1)
    expect(list.find(item => item.clientMsgNo === 'ai-stream-local')?.content.text).toBe('new stream')
    expect(list.find(item => item.clientMsgNo === 'server-ai-old')?.content.text).toBe('old reply')
  })

  it('merges current synced AI replies with lower person-channel seq when timestamps match the active stream', async () => {
    const api = await import('@tsdaodao/datasource-vue/api')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'm-user-newer',
      messageSeq: 30,
      clientMsgNo: 'user-newer',
      fromUID: 'me',
      timestamp: 200,
      content: { type: 1, text: 'prompt' },
      isRevoked: false,
      status: 'success'
    })
    messageStore.addMessage('deepseek_ai_robot', 1, {
      messageID: 'ai-stream-local',
      messageSeq: 0,
      clientMsgNo: 'ai-stream-local',
      fromUID: 'deepseek_ai_robot',
      timestamp: 201,
      content: {
        type: 1,
        text: '**当前同步回复**',
        content: '**当前同步回复**',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: true
      },
      isRevoked: false,
      status: 'sending'
    })
    vi.mocked(api.syncApi.syncMessages).mockResolvedValueOnce({
      messages: [{
        message_id: 1,
        message_idstr: 'm-ai-current-sync',
        message_seq: 29,
        client_msg_no: 'server-ai-current-sync',
        from_uid: 'deepseek_ai_robot',
        timestamp: 202,
        payload: JSON.stringify({
          type: 1,
          text: '**当前同步回复**',
          content: '**当前同步回复**',
          format: 'markdown',
          markdown: true,
          ai: true
        }),
        is_deleted: 0
      }]
    })

    await messageStore.syncMessages('deepseek_ai_robot', 1)

    const list = messageStore.getChannelMessages('deepseek_ai_robot', 1)
    expect(list.filter(item => item.fromUID === 'deepseek_ai_robot')).toHaveLength(1)
    expect(list.find(item => item.clientMsgNo === 'ai-stream-local')).toMatchObject({
      messageID: 'm-ai-current-sync',
      messageSeq: 29,
      content: {
        text: '**当前同步回复**',
        format: 'markdown',
        markdown: true,
        ai: true,
        streaming: false
      }
    })
  })

  it('orders DeepSeek AI replies after the triggering user message when backend seq is lower but timestamp is later', async () => {
    const api = await import('@tsdaodao/datasource-vue/api')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    vi.mocked(api.syncApi.syncMessages).mockResolvedValueOnce({
      messages: [
        {
          message_id: 1,
          message_idstr: 'm-ai-lower-seq-history',
          message_seq: 99,
          client_msg_no: '',
          from_uid: 'deepseek_ai_robot',
          timestamp: 201,
          payload: JSON.stringify({
            type: 1,
            text: '**稍后回复**',
            content: '**稍后回复**',
            format: 'markdown',
            markdown: true,
            ai: true
          }),
          is_deleted: 0
        },
        {
          message_id: 2,
          message_idstr: 'm-user-higher-seq-history',
          message_seq: 101,
          client_msg_no: 'user-higher-seq-history',
          from_uid: 'me',
          timestamp: 200,
          payload: JSON.stringify({
            type: 1,
            text: '触发 AI 的用户消息',
            content: '触发 AI 的用户消息'
          }),
          is_deleted: 0
        }
      ]
    })

    await messageStore.syncMessages('deepseek_ai_robot', 1)

    const texts = messageStore.getChannelMessages('deepseek_ai_robot', 1)
      .map(item => item.content.text)

    expect(texts).toEqual([
      '触发 AI 的用户消息',
      '**稍后回复**'
    ])
  })

  it('edits, locally deletes, mutually deletes, and marks receipts through backend-backed store actions', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    messageStore.addMessage('friend-a', 1, {
      messageID: 'm1',
      messageSeq: 1,
      clientMsgNo: 'c1',
      fromUID: 'me',
      timestamp: 100,
      content: { type: 1, text: 'original' },
      isRevoked: false,
      status: 'success'
    })

    await messageStore.editMessage('friend-a', 1, messageStore.getChannelMessages('friend-a', 1)[0], 'updated')
    expect(editMessage).toHaveBeenCalledWith({
      channel_id: 'friend-a',
      channel_type: 1,
      message_id: 'm1',
      message_seq: 1,
      content_edit: JSON.stringify({ type: 1, text: 'updated', content: 'updated' })
    })
    expect(messageStore.getChannelMessages('friend-a', 1)[0].content.text).toBe('updated')
    expect(messageStore.getChannelMessages('friend-a', 1)[0].remoteExtra?.contentEdit?.text).toBe('updated')

    await messageStore.markMessagesRead('friend-a', 1, ['m1'])
    expect(markReaded).toHaveBeenCalledWith({ channel_id: 'friend-a', channel_type: 1, message_ids: ['m1'] })
    expect(messageStore.getChannelMessages('friend-a', 1)[0].remoteExtra?.readed).toBe(true)

    const receipt = await messageStore.fetchReceipt('m1')
    expect(getMessageReceipt).toHaveBeenCalledWith('m1')
    expect(receipt).toEqual({ readed: [{ uid: 'u1', name: 'A' }], unread: [{ uid: 'u2', name: 'B' }], unavailable: false })
    expect(messageStore.receipts.m1.readed).toHaveLength(1)

    await messageStore.deleteLocalMessage('friend-a', 1, messageStore.getChannelMessages('friend-a', 1)[0])
    expect(deleteMessage).toHaveBeenCalledWith([{
      channel_id: 'friend-a',
      channel_type: 1,
      message_id: 'm1',
      message_seq: 1
    }])
    expect(messageStore.getChannelMessages('friend-a', 1)).toHaveLength(0)

    messageStore.addMessage('friend-a', 1, {
      messageID: 'm2',
      messageSeq: 2,
      clientMsgNo: 'c2',
      fromUID: 'me',
      timestamp: 101,
      content: { type: 1, text: 'mutual' },
      isRevoked: false,
      status: 'success'
    })
    await messageStore.deleteMutualMessage('friend-a', 1, messageStore.getChannelMessages('friend-a', 1)[0])
    expect(mutualDeleteMessage).toHaveBeenCalledWith({
      channel_id: 'friend-a',
      channel_type: 1,
      message_id: 'm2',
      message_seq: 2
    })
    expect(messageStore.getChannelMessages('friend-a', 1)[0].remoteExtra?.isMutualDeleted).toBe(true)
  })

  it('syncs pinned messages and reminders with actionable local state', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    const msg = {
      messageID: 'm1',
      messageSeq: 1,
      clientMsgNo: 'c1',
      fromUID: 'friend-a',
      timestamp: 100,
      content: { type: 1, text: 'pin me' },
      isRevoked: false,
      status: 'success' as const
    }
    messageStore.addMessage('friend-a', 1, msg)

    await messageStore.togglePinnedMessage('friend-a', 1, msg)
    expect(pinMessage).toHaveBeenCalledWith({
      channel_id: 'friend-a',
      channel_type: 1,
      message_id: 'm1',
      message_seq: 1
    })
    expect(msg.remoteExtra?.isPinned).toBe(true)

    await messageStore.syncPinnedMessages('friend-a', 1)
    expect(syncPinnedMessages).toHaveBeenCalledWith({ channel_id: 'friend-a', channel_type: 1, version: 0 })
    expect(messageStore.pinnedMessages['friend-a-1'][0].messageID).toBe('m1')

    await messageStore.syncReminders(['group-a'])
    expect(syncReminders).toHaveBeenCalledWith({ version: 0, limit: 100, channel_ids: ['group-a'] })
    expect(messageStore.reminders[0].text).toBe('[有人@我]')

    await messageStore.doneReminders([10])
    expect(doneReminders).toHaveBeenCalledWith([10])
    expect(messageStore.reminders[0].done).toBe(1)
  })

  it('exposes daily messaging action surfaces in list, input, and context menu UI', async () => {
    const list = await import('../src/components/MessageList.vue?raw')
    const input = await import('../src/components/MessageInput.vue?raw')
    const menu = await import('../../../packages/base-vue/src/components/ContextMenu.vue?raw')

    for (const label of ['编辑消息', '本地删除', '双向删除', '设为置顶', '查看回执', '提醒暂不可用', '重试发送']) {
      expect(list.default).toContain(label)
    }
    expect(list.default).toContain("label: '引用回复'")
    expect(list.default).toContain("label: '复制'")
    expect(list.default).toContain('messageStore.retryMessage')
    expect(list.default).toContain('messageStore.editMessage')
    expect(list.default).toContain('messageStore.deleteLocalMessage')
    expect(list.default).toContain('messageStore.deleteMutualMessage')
    expect(list.default).toContain('messageStore.togglePinnedMessage')
    expect(input.default).toContain('reply-preview-bar')
    expect(input.default).toContain('mentionedUids')
    expect(menu.default).toContain('disabled?: boolean')
    expect(menu.default).toContain('disabled: item.disabled')
    expect(menu.default).toContain('.context-menu-item.disabled')
  })

  it('exposes group avatar context menu hooks for mention and profile actions', async () => {
    const list = await import('../src/components/MessageList.vue?raw')
    const chatView = await import('../src/views/ChatView.vue?raw')
    const input = await import('../src/components/MessageInput.vue?raw')

    expect(list.default).toContain('handleAvatarContextMenu')
    expect(list.default).toContain("label: '@TA'")
    expect(list.default).toContain("label: '查看资料'")
    expect(list.default).toContain("emit('mention-user'")
    expect(list.default).toContain("emit('view-user-profile'")
    expect(chatView.default).toContain('@mention-user="handleMentionUser"')
    expect(chatView.default).toContain('@view-user-profile="handleViewUserProfile"')
    expect(input.default).toContain('mentionRequest')
    expect(input.default).toContain('appendExternalMention')
  })
})
