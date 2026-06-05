import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'

const get = vi.fn()
const post = vi.fn()

vi.mock('@tsdaodao/base-vue', () => ({
  apiClient: {
    defaults: { baseURL: 'http://api.example/v1/' },
    get,
    post,
    put: vi.fn()
  },
  apiDelete: vi.fn(),
  ChannelAvatar: {
    props: ['name', 'avatar', 'size', 'isGroup'],
    template: '<div class="channel-avatar" :data-name="name" :data-avatar="avatar">{{ name }}</div>'
  },
  ContextMenu: { template: '<div />' },
  SkeletonScreen: { template: '<div />' },
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
    syncConversations: vi.fn(async () => ({ conversations: [], users: [], groups: [] })),
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
    getMyGroups: vi.fn(async () => [
      { group_no: 'group-clowder', name: '集群', logo: '', role: 0, top: 0, mute: 0 }
    ]),
    getGroupInfo: vi.fn(),
    getGroupMembers: vi.fn(),
    updateSetting: vi.fn()
  },
  commonApi: {
    getChannelInfo: vi.fn(async (_channelId: string, channelType: number) => ({
      name: channelType === 2 ? '集群' : '用户',
      avatar: '',
      top: 0,
      mute: 0
    }))
  },
  resolveApiAssetUrl: (url: string) => url
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {} })
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

function mockClowderEndpoints() {
  get.mockImplementation((url: string) => {
    if (url === 'clowder/group/cats') {
      return Promise.resolve({ groupId: 'group-clowder', catIds: [], cats: [], prompt: '' })
    }
    if (url === 'clowder/conversation/agents') {
      return Promise.reject({ status: 403, msg: 'Forbidden' })
    }
    if (url === 'clowder/cats') {
      return Promise.resolve({
        agents: [
          {
            catId: 'ragdoll-kn9a',
            displayName: '布偶猫',
            aliases: ['@ragdoll-kn9a'],
            mentionPatterns: ['@ragdoll-kn9a', '@布偶猫'],
            avatar: '',
            available: true,
            connected: true
          }
        ]
      })
    }
    return Promise.resolve({})
  })
  post.mockResolvedValue({})
}

function clowderHistoryMessages() {
  return [
    {
      message_seq: 90,
      timestamp: 1780000090,
      from_uid: 'yunyi',
      payload: JSON.stringify({
        type: 1,
        text: '文件已发给你了\n[布偶猫/宪宪🐾 deepseek-v4-flash]',
        connector_id: 'im-web',
        ai: true,
        cat_display_name: '布偶猫'
      })
    },
    {
      message_seq: 91,
      timestamp: 1780000091,
      from_uid: 'yunyi',
      payload: JSON.stringify({
        type: 2,
        text: '图片',
        url: 'http://localhost:3003/uploads/demo.png',
        connector_id: 'im-web',
        ai: true
      })
    }
  ]
}

function clowderHistoryMessageObjects() {
  return clowderHistoryMessages().map(message => ({
    ...message,
    payload: JSON.parse(String(message.payload))
  }))
}

function clowderFileFallbackMessages() {
  return [
    {
      message_seq: 115,
      timestamp: 1780000115,
      from_uid: 'me',
      payload: JSON.stringify({
        type: 1,
        content: '@布偶猫 把昨天你做的代码打包成压缩包发出来'
      })
    },
    {
      message_seq: 117,
      timestamp: 1780000117,
      from_uid: 'yunyi',
      payload: JSON.stringify({
        type: 1,
        text: '好嘞，压缩包发到聊天里了。\n\n[布偶猫/宪宪🐾 deepseek-v4-flash]',
        content: '好嘞，压缩包发到聊天里了。\n\n[布偶猫/宪宪🐾 deepseek-v4-flash]',
        connector_id: 'im-web',
        ai: true,
        cat_display_name: '布偶猫',
        rich_blocks: [
          {
            id: 'file-ordering-demo',
            v: 1,
            kind: 'file',
            fileName: 'ordering-demo.tar.gz',
            url: '/uploads/ordering-demo.tar.gz',
            fileSize: 86660
          }
        ]
      })
    },
    {
      message_seq: 118,
      timestamp: 1780000118,
      from_uid: 'yunyi',
      payload: JSON.stringify({
        type: 1,
        text: 'ordering-demo.tar.gz',
        content: 'ordering-demo.tar.gz',
        connector_id: 'im-web',
        ai: true
      })
    }
  ]
}

describe('Clowder group identity recovery', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockClowderEndpoints()
  })

  it('recovers group cat members from recent Clowder history when backend group state was lost', async () => {
    const api = await import('@tsdaodao/datasource-vue/api')
    vi.mocked(api.syncApi.syncMessages).mockResolvedValueOnce({ messages: clowderHistoryMessageObjects() })

    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()

    const cats = await store.loadGroupCats('group-clowder')

    expect(cats.map(cat => cat.catId)).toEqual(['ragdoll-kn9a'])
    expect(store.groupCatMemberships['group-clowder']?.[0]).toMatchObject({
      catId: 'ragdoll-kn9a',
      displayName: '布偶猫',
      connected: true
    })
    expect(post).toHaveBeenCalledWith('clowder/group/cats/sync', expect.objectContaining({
      groupId: 'group-clowder',
      catIds: ['ragdoll-kn9a']
    }))
  })

  it('backfills group conversation digest sender from previous Clowder text when the latest media row lacks cat metadata', async () => {
    const api = await import('@tsdaodao/datasource-vue/api')
    vi.mocked(api.syncApi.syncMessages).mockResolvedValueOnce({ messages: clowderHistoryMessages() })

    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const store = useConversationStore()

    await store.syncGroupConversations({ throwOnError: true })

    const group = store.conversations.find(conv => conv.channel_id === 'group-clowder' && Number(conv.channel_type) === 2)
    expect(group?.last_message?.content).toMatchObject({
      type: 2,
      text: '图片',
      connector_id: 'im-web',
      catDisplayName: '布偶猫'
    })
  })

  it('keeps the recovered cat digest identity when normal conversation sync later returns only the latest media row', async () => {
    const api = await import('@tsdaodao/datasource-vue/api')
    vi.mocked(api.syncApi.syncMessages).mockResolvedValueOnce({ messages: clowderHistoryMessages() })
    vi.mocked(api.syncApi.syncConversations).mockResolvedValueOnce({
      conversations: [
        {
          channel_id: 'group-clowder',
          channel_type: 2,
          unread: 0,
          last_msg_seq: 91,
          last_msg_time: 1780000091,
          last_message: {
            message_seq: 91,
            timestamp: 1780000091,
            from_uid: 'yunyi',
            payload: JSON.stringify({
              type: 2,
              text: '图片',
              url: 'http://localhost:3003/uploads/demo.png',
              connector_id: 'im-web',
              ai: true
            })
          }
        }
      ],
      users: [],
      groups: [
        { group_no: 'group-clowder', name: '集群', logo: '', role: 0, top: 0, mute: 0 }
      ]
    })

    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const store = useConversationStore()

    await store.syncGroupConversations({ throwOnError: true })
    await store.syncConversations({ throwOnError: true })

    const group = store.conversations.find(conv => conv.channel_id === 'group-clowder' && Number(conv.channel_type) === 2)
    expect(group?.last_message?.content).toMatchObject({
      type: 2,
      text: '图片',
      connector_id: 'im-web',
      catDisplayName: '布偶猫'
    })
  })

  it('repairs missing Clowder sender identity during normal conversation sync even when group prefetch did not run first', async () => {
    const api = await import('@tsdaodao/datasource-vue/api')
    vi.mocked(api.syncApi.syncConversations).mockResolvedValueOnce({
      conversations: [
        {
          channel_id: 'group-clowder',
          channel_type: 2,
          unread: 0,
          last_msg_seq: 91,
          last_msg_time: 1780000091,
          last_message: {
            message_seq: 91,
            timestamp: 1780000091,
            from_uid: 'yunyi',
            payload: JSON.stringify({
              type: 2,
              text: '图片',
              url: 'http://localhost:3003/uploads/demo.png',
              connector_id: 'im-web',
              ai: true
            })
          }
        }
      ],
      users: [],
      groups: [
        { group_no: 'group-clowder', name: '集群', logo: '', role: 0, top: 0, mute: 0 }
      ]
    })
    vi.mocked(api.syncApi.syncMessages).mockResolvedValueOnce({ messages: clowderHistoryMessages() })

    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const store = useConversationStore()

    await store.syncConversations({ throwOnError: true })

    const group = store.conversations.find(conv => conv.channel_id === 'group-clowder' && Number(conv.channel_type) === 2)
    expect(group?.last_message?.content).toMatchObject({
      type: 2,
      text: '图片',
      connector_id: 'im-web',
      catDisplayName: '布偶猫'
    })
  })

  it('keeps the Clowder cat sender when group message hydration summarizes a latest media row', async () => {
    const api = await import('@tsdaodao/datasource-vue/api')
    vi.mocked(api.syncApi.syncMessages).mockResolvedValueOnce({ messages: clowderHistoryMessageObjects() })

    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const conversationStore = useConversationStore()
    const messageStore = useMessageStore()
    conversationStore.conversations.push({
      channel_id: 'group-clowder',
      channel_type: 2,
      unread: 0,
      last_msg_seq: 0,
      last_msg_time: 0,
      last_message: undefined,
      top: 0,
      mute: 0,
      draft: '',
      name: '集群',
      avatar: ''
    })

    await messageStore.syncMessages('group-clowder', 2)

    const group = conversationStore.conversations.find(conv => conv.channel_id === 'group-clowder' && Number(conv.channel_type) === 2)
    expect(group?.last_message?.content).toMatchObject({
      type: 2,
      text: '图片',
      connector_id: 'im-web',
      catDisplayName: '布偶猫'
    })
  })

  it('recovers a Clowder file attachment and cat identity when the media callback persisted as filename text', async () => {
    const api = await import('@tsdaodao/datasource-vue/api')
    vi.mocked(api.syncApi.syncMessages).mockResolvedValueOnce({ messages: clowderFileFallbackMessages() })

    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const conversationStore = useConversationStore()
    const messageStore = useMessageStore()
    conversationStore.conversations.push({
      channel_id: 'group-clowder',
      channel_type: 2,
      unread: 0,
      last_msg_seq: 0,
      last_msg_time: 0,
      last_message: undefined,
      top: 0,
      mute: 0,
      draft: '',
      name: '集群',
      avatar: ''
    })

    await messageStore.syncMessages('group-clowder', 2)

    const list = messageStore.getChannelMessages('group-clowder', 2)
    const recoveredFile = list.find(message => message.messageSeq === 118)
    expect(recoveredFile?.content).toMatchObject({
      type: 8,
      name: 'ordering-demo.tar.gz',
      url: 'http://localhost:3004/uploads/ordering-demo.tar.gz',
      size: 86660,
      connector_id: 'im-web',
      catDisplayName: '布偶猫'
    })

    const group = conversationStore.conversations.find(conv => conv.channel_id === 'group-clowder' && Number(conv.channel_type) === 2)
    expect(group?.last_message?.content).toMatchObject({
      type: 8,
      name: 'ordering-demo.tar.gz',
      catDisplayName: '布偶猫'
    })
  })

  it('shows the recovered Clowder cat name in the conversation digest instead of the human transport uid', async () => {
    const { default: ConversationList } = await import('../src/views/ConversationList.vue')
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const conversationStore = useConversationStore()
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'me', name: 'Me' }
    userStore.userCache.yunyi = { uid: 'yunyi', name: 'yunyi', avatar: '' }
    conversationStore.conversations.push({
      channel_id: 'group-clowder',
      channel_type: 2,
      unread: 0,
      last_msg_seq: 91,
      last_msg_time: 1780000091,
      last_message: {
        messageSeq: 91,
        timestamp: 1780000091,
        fromUID: 'yunyi',
        content: {
          type: 2,
          text: '图片',
          connector_id: 'im-web',
          ai: true,
          catDisplayName: '布偶猫'
        },
        payload: {
          type: 2,
          text: '图片',
          connector_id: 'im-web',
          ai: true,
          catDisplayName: '布偶猫'
        }
      },
      top: 0,
      mute: 0,
      draft: '',
      name: '集群',
      avatar: ''
    })

    render(ConversationList)

    expect(screen.getByText('布偶猫：')).toBeInTheDocument()
    expect(screen.queryByText('yunyi：')).not.toBeInTheDocument()
  })

  it('still refreshes group conversations on mount when direct conversations already populated the sidebar', async () => {
    const { default: ConversationList } = await import('../src/views/ConversationList.vue')
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const conversationStore = useConversationStore()
    conversationStore.conversations.push({
      channel_id: 'clowder_ai',
      channel_type: 1,
      unread: 0,
      last_msg_seq: 1,
      last_msg_time: 1780000000,
      last_message: {
        messageSeq: 1,
        timestamp: 1780000000,
        fromUID: 'clowder_ai',
        content: { type: 1, text: 'hi' },
        payload: { type: 1, text: 'hi' }
      },
      top: 0,
      mute: 0,
      draft: '',
      name: 'Clowder AI',
      avatar: ''
    })
    const groupSync = vi.spyOn(conversationStore, 'syncGroupConversations').mockResolvedValue(undefined)
    vi.spyOn(conversationStore, 'syncConversations').mockResolvedValue(undefined)

    render(ConversationList)

    await waitFor(() => {
      expect(groupSync).toHaveBeenCalledWith({ throwOnError: true })
    })
  })
})
