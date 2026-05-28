import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const addMessageListener = vi.fn()
const addMessageStatusListener = vi.fn()
const addCMDListener = vi.fn()

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
    syncConversationExtra: vi.fn(async () => []),
    clearUnread: vi.fn(),
    updateConversationExtra: vi.fn(),
    deleteConversation: vi.fn()
  },
  commonApi: {
    getChannelInfo: vi.fn(async () => ({ name: 'Target', avatar: '', top: 0, mute: 0 }))
  },
  groupApi: {
    getMyGroups: vi.fn(async () => []),
    getGroupInfo: vi.fn(),
    getGroupMembers: vi.fn()
  },
  userApi: {
    getReddot: vi.fn()
  }
}))

vi.mock('wukongimjssdk', () => ({
  default: {
    shared: () => ({
      chatManager: {
        addMessageListener,
        addMessageStatusListener,
        addCMDListener
      }
    })
  },
  MessageContent: class {},
  MediaMessageContent: class {},
  MessageImage: class {}
}))

describe('message listener own echo handling', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/chat/conversation/friend-a/1' }
    })
  })

  it('skips SDK realtime echo for current user when uid and fromUID have different primitive types', async () => {
    const { registerMessageListeners } = await import('../../../packages/datasource-vue/src/cmd/index.ts')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')

    const userStore = useUserStore()
    userStore.currentUser = { uid: 1 as any, name: 'Me' }

    registerMessageListeners()
    const listener = addMessageListener.mock.calls[0][0]
    listener({
      channel: { channelID: 'friend-a', channelType: 1 },
      fromUID: '1',
      clientMsgNo: 'sdk-client-1',
      messageID: 'm1',
      messageSeq: 1,
      timestamp: 100,
      status: 1,
      reactions: [],
      remoteExtra: undefined,
      content: { contentType: 1, contentObj: { text: 'hello' } }
    })

    expect(useMessageStore().getChannelMessages('friend-a', 1)).toHaveLength(0)
  })
})
