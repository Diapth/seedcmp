import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const syncConversations = vi.fn()
const syncConversationExtra = vi.fn()
const getMyGroups = vi.fn()
const syncMessages = vi.fn()

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
    remove: vi.fn()
  }
}))

vi.mock('@tsdaodao/datasource-vue/api', () => ({
  syncApi: {
    syncConversations,
    syncConversationExtra,
    syncMessages,
    syncPinnedMessages: vi.fn(async () => []),
    syncReminders: vi.fn(async () => []),
    deleteConversation: vi.fn()
  },
  groupApi: {
    getMyGroups,
    getGroupInfo: vi.fn(),
    getGroupMembers: vi.fn()
  },
  commonApi: {
    getChannelInfo: vi.fn(async () => ({ name: '会话', avatar: '' }))
  }
}))

describe('recovery failure state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    syncConversationExtra.mockResolvedValue([])
    syncMessages.mockResolvedValue({ messages: [] })
    getMyGroups.mockResolvedValue([])
  })

  it('marks recovery as failed when TangSeng conversation sync is unavailable', async () => {
    const unavailable = new Error('connect ECONNREFUSED 8090')
    syncConversations.mockRejectedValue(unavailable)

    const { useConversationStore } = await import('@tsdaodao/datasource-vue')
    const store = useConversationStore()

    await expect(store.recoverAfterReconnect()).rejects.toThrow('connect ECONNREFUSED 8090')
    expect(store.recoveryState).toBe('failed')
    expect(getMyGroups).not.toHaveBeenCalled()
  })

  it('marks recovery as failed when TangSeng group sync is unavailable', async () => {
    const unavailable = new Error('group sync unavailable')
    syncConversations.mockResolvedValue({ conversations: [] })
    getMyGroups.mockRejectedValue(unavailable)

    const { useConversationStore } = await import('@tsdaodao/datasource-vue')
    const store = useConversationStore()

    await expect(store.recoverAfterReconnect()).rejects.toThrow('group sync unavailable')
    expect(store.recoveryState).toBe('failed')
  })
})
