import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const getChannelInfo = vi.fn()
const getCatDirectory = vi.fn()

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
  },
  ChannelAvatar: {}
}))

vi.mock('@tsdaodao/datasource-vue/api', () => ({
  commonApi: {
    getChannelInfo
  },
  groupApi: {
    getGroupMembers: vi.fn()
  }
}))

vi.mock('@tsdaodao/datasource-vue/api/clowder', () => ({
  clowderApi: {
    getCatDirectory
  }
}))

describe('Clowder AI fixed contact entry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders a fixed Clowder AI contact shortcut that opens the clowder_ai direct conversation', async () => {
    const contactList = await import('../../../packages/contacts-vue/src/views/ContactList.vue?raw')

    expect(contactList.default).toContain("const CLOWDER_AI_ROBOT_ID = 'clowder_ai'")
    expect(contactList.default).toContain('handleClowderRobot')
    expect(contactList.default).toContain('Clowder AI')
    expect(contactList.default).toContain('`/chat/conversation/${CLOWDER_AI_ROBOT_ID}/1`')
    expect(contactList.default).toContain('clowder-icon')
  })

  it('shows a Clowder cat management entry and read-only routable cat contact rows', async () => {
    const contactList = await import('../../../packages/contacts-vue/src/views/ContactList.vue?raw')

    expect(contactList.default).toContain('useClowderStore')
    expect(contactList.default).toContain('loadCatContactDirectory')
    expect(contactList.default).toContain('handleConnectCat')
    expect(contactList.default).toContain('handleConfigureClowderCats')
    expect(contactList.default).toContain('Clowder 猫猫')
    expect(contactList.default).toContain("cat.source !== 'disconnected'")
    expect(contactList.default).toContain('clowder-cat-contact')
    expect(contactList.default).toContain('cat.personalitySummary')
    expect(contactList.default).toContain('cat.capabilitySummary')
    expect(contactList.default).toContain('router.push(`/chat/conversation/${cat.directConversationId}/1`)')
  })

  it('provides stable channel metadata for the Clowder AI direct conversation without remote lookup', async () => {
    const { useChannelStore } = await import('@tsdaodao/datasource-vue')
    const store = useChannelStore()

    const info = await store.getChannelInfo('clowder_ai', 1)

    expect(info).toMatchObject({
      channel_id: 'clowder_ai',
      channel_type: 1,
      name: 'Clowder AI',
      robot: 1
    })
    expect(getChannelInfo).not.toHaveBeenCalled()
  })

  it('treats legacy clowder:bot direct conversations as virtual channels without remote channel lookup', async () => {
    const { useChannelStore } = await import('@tsdaodao/datasource-vue')
    const store = useChannelStore()

    const info = await store.getChannelInfo('clowder:bot-1', 1)

    expect(info).toMatchObject({
      channel_id: 'clowder:bot-1',
      channel_type: 1,
      name: 'Clowder AI',
      robot: 1,
      category: 'clowder'
    })
    expect(getChannelInfo).not.toHaveBeenCalled()
  })

  it('refreshes raw cached clowder cat ids from the cat directory before display', async () => {
    getCatDirectory.mockResolvedValueOnce({
      agents: [
        {
          catId: 'opus',
          displayName: '布偶猫',
          available: true,
          connected: true,
          aliases: ['@布偶猫'],
          mentionPatterns: []
        }
      ]
    })
    const { useChannelStore } = await import('@tsdaodao/datasource-vue')
    const store = useChannelStore()
    store.updateChannelInfo('clowder_cat:opus', 1, {
      name: 'clowder_cat:opus',
      avatar: ''
    })

    const info = await store.getChannelInfo('clowder_cat:opus', 1)

    expect(info).toMatchObject({
      channel_id: 'clowder_cat:opus',
      channel_type: 1,
      name: '布偶猫',
      robot: 1,
      category: 'clowder-cat'
    })
    expect(getCatDirectory).toHaveBeenCalledWith({ includeUnavailable: true })
    expect(getChannelInfo).not.toHaveBeenCalled()
  })
})
