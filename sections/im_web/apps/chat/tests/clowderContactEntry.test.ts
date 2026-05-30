import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const getChannelInfo = vi.fn()

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
})
