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
})
