import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor, within } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'

const updateConversationExtra = vi.fn()
const deleteConversation = vi.fn()
const syncConversations = vi.fn()
const syncConversationExtra = vi.fn(async () => [])
const getMyGroups = vi.fn(async () => [])
const routerPush = vi.fn()
const routeParams: Record<string, string> = {}
const messageSuccess = vi.fn()
const messageError = vi.fn()

vi.mock('@arco-design/web-vue', () => ({
  Message: {
    success: messageSuccess,
    error: messageError
  }
}))

vi.mock('@tsdaodao/base-vue', async () => {
  const actual = await vi.importActual<any>('../../../packages/base-vue/src/utils/clowderMessageIdentity.ts')
  return {
    ...actual,
    apiClient: {
      defaults: { baseURL: 'http://api.example/v1/' },
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn()
    },
    apiDelete: vi.fn(),
    ChannelAvatar: {
      props: ['name', 'avatar', 'size', 'isGroup'],
      template: '<div class="channel-avatar">{{ name }}</div>'
    },
    ContextMenu: {
      props: ['items'],
      template: '<div><button v-for="item in items" :key="item.label" @click="item.action()">{{ item.label }}</button></div>'
    },
    SkeletonScreen: { template: '<div />' },
    StorageService: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    }
  }
})

vi.mock('@tsdaodao/datasource-vue/api', () => ({
  syncApi: {
    updateConversationExtra,
    deleteConversation,
    syncConversations,
    syncConversationExtra,
    clearUnread: vi.fn()
  },
  groupApi: {
    getMyGroups,
    getGroupInfo: vi.fn(),
    getGroupMembers: vi.fn(),
    updateSetting: vi.fn()
  },
  commonApi: {
    getChannelInfo: vi.fn(async () => ({ name: 'Target', avatar: '', top: 0, mute: 0 }))
  }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
  useRoute: () => ({ params: routeParams })
}))

describe('conversation actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    updateConversationExtra.mockResolvedValue(undefined)
    deleteConversation.mockResolvedValue(undefined)
    syncConversations.mockResolvedValue({ conversations: [], users: [], groups: [] })
    syncConversationExtra.mockResolvedValue([])
    getMyGroups.mockResolvedValue([])
    routerPush.mockClear()
    messageSuccess.mockClear()
    messageError.mockClear()
    for (const key of Object.keys(routeParams)) delete routeParams[key]
    localStorage.clear()
  })

  it('hides a conversation without deleting its messages and reveals it on new activity', async () => {
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const store = useConversationStore()

    store.conversations.push({
      channel_id: 'friend-a',
      channel_type: 1,
      unread: 0,
      last_msg_seq: 1,
      last_msg_time: 100,
      last_message: { content: { type: 1, text: 'hello' } },
      top: 0,
      mute: 0,
      name: 'Friend A',
      avatar: ''
    })

    await store.hideConversation('friend-a', 1)

    expect(store.sortedConversations.map(item => item.channel_id)).toEqual([])
    expect(deleteConversation).not.toHaveBeenCalled()
    expect(updateConversationExtra).toHaveBeenCalledWith('friend-a', 1, { hidden: 1 })

    await store.addOrUpdateConversation('friend-a', 1, {
      fromUID: 'friend-a',
      messageSeq: 2,
      timestamp: 120,
      content: { type: 1, text: 'new message' }
    })

    expect(store.sortedConversations.map(item => item.channel_id)).toEqual(['friend-a'])
    expect(updateConversationExtra).toHaveBeenLastCalledWith('friend-a', 1, { hidden: 0 })
  })

  it('conversation list exposes state-aware pin mute hide and delete menu actions', async () => {
    const source = await import('../src/views/ConversationList.vue?raw')

    expect(source.default).toContain('conversationStore.hideConversation')
    expect(source.default).toContain("selectedConversation.value?.top")
    expect(source.default).toContain("selectedConversation.value?.mute")
    expect(source.default).toContain("label: isSelectedConversationPinned.value ? '取消置顶' : '置顶'")
    expect(source.default).toContain("label: isSelectedConversationMuted.value ? '关闭免打扰' : '消息免打扰'")
    expect(source.default).toContain("label: '隐藏会话'")
  })

  it('keeps a successfully deleted conversation suppressed across later recent sync', async () => {
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const store = useConversationStore()

    store.conversations.push({
      channel_id: 'friend-a',
      channel_type: 1,
      unread: 2,
      last_msg_seq: 10,
      last_msg_time: 100,
      last_message: { content: { type: 1, text: 'old' } },
      top: 0,
      mute: 0,
      name: 'Friend A',
      avatar: ''
    })

    await expect(store.deleteConversation('friend-a', 1)).resolves.toEqual({ ok: true, localOnly: false })
    expect(deleteConversation).toHaveBeenCalledWith('friend-a', 1)
    expect(store.sortedConversations.map(item => item.channel_id)).toEqual([])

    syncConversations.mockResolvedValueOnce({
      conversations: [{
        channel_id: 'friend-a',
        channel_type: 1,
        unread: 2,
        last_msg_seq: 10,
        last_msg_time: 100,
        last_message: { payload: { type: 1, text: 'old' }, messageSeq: 10, timestamp: 100, from_uid: 'friend-a' }
      }]
    })

    await store.syncConversations()
    expect(store.sortedConversations.map(item => item.channel_id)).toEqual([])
  })

  it('rolls back a normal conversation delete when the backend delete fails', async () => {
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const store = useConversationStore()
    const failure = new Error('delete failed')
    deleteConversation.mockRejectedValueOnce(failure)

    store.conversations.push({
      channel_id: 'friend-a',
      channel_type: 1,
      unread: 1,
      last_msg_seq: 3,
      last_msg_time: 30,
      last_message: { content: { type: 1, text: 'hello' } },
      top: 0,
      mute: 0,
      name: 'Friend A',
      avatar: ''
    })

    await expect(store.deleteConversation('friend-a', 1)).rejects.toThrow('delete failed')
    expect(store.sortedConversations.map(item => item.channel_id)).toEqual(['friend-a'])

    syncConversations.mockResolvedValueOnce({
      conversations: [{
        channel_id: 'friend-a',
        channel_type: 1,
        unread: 1,
        last_msg_seq: 3,
        last_msg_time: 30,
        last_message: { payload: { type: 1, text: 'hello' }, messageSeq: 3, timestamp: 30, from_uid: 'friend-a' }
      }]
    })
    await store.syncConversations()
    expect(store.sortedConversations.map(item => item.channel_id)).toEqual(['friend-a'])
  })

  it('does not recreate a deleted group conversation from group recovery without new activity', async () => {
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const store = useConversationStore()

    store.conversations.push({
      channel_id: 'group-a',
      channel_type: 2,
      unread: 0,
      last_msg_seq: 5,
      last_msg_time: 50,
      last_message: { content: { type: 1, text: 'group' } },
      top: 0,
      mute: 0,
      name: 'Group A',
      avatar: ''
    })
    getMyGroups.mockResolvedValueOnce([{ group_no: 'group-a', name: 'Group A', logo: '', top: 0, mute: 0 }])

    await store.deleteConversation('group-a', 2)
    await store.syncGroupConversations()

    expect(store.sortedConversations.map(item => item.channel_id)).toEqual([])
  })

  it('uses durable local-only delete for Clowder cat conversations', async () => {
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    let store = useConversationStore()

    store.conversations.push({
      channel_id: 'clowder_cat:codex',
      channel_type: 1,
      unread: 0,
      last_msg_seq: 8,
      last_msg_time: 80,
      last_message: { content: { type: 1, text: 'hi' } },
      top: 0,
      mute: 0,
      name: 'Codex',
      avatar: ''
    })

    await expect(store.deleteConversation('clowder_cat:codex', 1)).resolves.toEqual({ ok: true, localOnly: true })
    expect(deleteConversation).not.toHaveBeenCalled()
    expect(store.sortedConversations.map(item => item.channel_id)).toEqual([])

    setActivePinia(createPinia())
    const module = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    store = module.useConversationStore()
    syncConversations.mockResolvedValueOnce({
      conversations: [{
        channel_id: 'clowder_cat:codex',
        channel_type: 1,
        unread: 0,
        last_msg_seq: 8,
        last_msg_time: 80,
        last_message: { payload: { type: 1, text: 'hi' }, messageSeq: 8, timestamp: 80, from_uid: 'clowder_cat:codex' }
      }]
    })
    await store.syncConversations()

    expect(store.sortedConversations.map(item => item.channel_id)).toEqual([])
  })

  it('deletes the active conversation from the context menu and returns to chat root', async () => {
    const { default: ConversationList } = await import('../src/views/ConversationList.vue')
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const store = useConversationStore()
    routeParams.channelId = 'friend-a'
    routeParams.channelType = '1'
    store.conversations.push({
      channel_id: 'friend-a',
      channel_type: 1,
      unread: 0,
      last_msg_seq: 4,
      last_msg_time: 40,
      last_message: { content: { type: 1, text: 'hello' } },
      top: 0,
      mute: 0,
      name: 'Friend A',
      avatar: ''
    })

    const { container } = render(ConversationList)
    await fireEvent.contextMenu(container.querySelector('[data-channel-id="friend-a"]') as Element)
    await fireEvent.click(within(container).getByText('删除会话'))

    await waitFor(() => {
      expect(messageSuccess).toHaveBeenCalledWith('已删除会话')
      expect(routerPush).toHaveBeenCalledWith('/chat')
    })
  })

  it('shows a visible error and keeps the active route when context-menu delete fails', async () => {
    const { default: ConversationList } = await import('../src/views/ConversationList.vue')
    const { useConversationStore } = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts')
    const store = useConversationStore()
    deleteConversation.mockRejectedValueOnce(new Error('delete failed'))
    routeParams.channelId = 'friend-a'
    routeParams.channelType = '1'
    store.conversations.push({
      channel_id: 'friend-a',
      channel_type: 1,
      unread: 0,
      last_msg_seq: 4,
      last_msg_time: 40,
      last_message: { content: { type: 1, text: 'hello' } },
      top: 0,
      mute: 0,
      name: 'Friend A',
      avatar: ''
    })

    const { container } = render(ConversationList)
    await fireEvent.contextMenu(container.querySelector('[data-channel-id="friend-a"]') as Element)
    await fireEvent.click(within(container).getByText('删除会话'))

    await waitFor(() => {
      expect(messageError).toHaveBeenCalledWith('delete failed')
      expect(routerPush).not.toHaveBeenCalledWith('/chat')
    })
  })
})
