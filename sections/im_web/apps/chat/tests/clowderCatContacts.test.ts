import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const get = vi.fn()
const post = vi.fn()
const getChannelInfo = vi.fn()

vi.mock('@tsdaodao/base-vue', () => ({
  apiClient: {
    get,
    post
  }
}))

vi.mock('@tsdaodao/datasource-vue/api', () => ({
  commonApi: {
    getChannelInfo
  },
  groupApi: {
    getGroupMembers: vi.fn()
  }
}))

describe('Clowder cats as contact identities', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('maps routable cats into contact-like entries with durable IM identities', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()

    get.mockResolvedValueOnce({
      agents: [
        {
          catId: 'codex',
          displayName: 'Codex',
          aliases: ['@codex', 'code'],
          mentionPatterns: ['@codex'],
          avatar: '',
          personalitySummary: 'Careful coding partner',
          capabilitySummary: 'code, tests',
          available: true,
          source: 'existing'
        },
        {
          catId: 'news',
          displayName: 'News Cat',
          aliases: ['@news'],
          mentionPatterns: ['@news'],
          personalitySummary: 'Brief news watcher',
          capabilitySummary: 'summaries',
          available: false,
          source: 'runtime-created'
        }
      ]
    })

    const directory = await store.loadCatContactDirectory()

    expect(get).toHaveBeenCalledWith('clowder/cats', { params: undefined })
    expect(directory.map(cat => cat.id)).toEqual(['clowder_cat:codex', 'clowder_cat:news'])
    expect(directory[0]).toMatchObject({
      uid: 'clowder_cat:codex',
      channelId: 'clowder_cat:codex',
      directConversationId: 'clowder_cat:codex',
      outboundSenderId: 'clowder_cat_codex',
      historyGroupKey: 'clowder-cat:codex',
      category: 'clowder-cat',
      connectorId: 'im-web',
      source: 'existing',
      available: true
    })
    expect(directory[0].aliases).toContain('@codex')
    expect(directory[1].availabilityState).toBe('unavailable')
  })

  it('connects an existing cat and exposes direct conversation metadata without remote lookup', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const { useChannelStore } = await import('@tsdaodao/datasource-vue')
    const clowderStore = useClowderStore()
    const channelStore = useChannelStore()

    post.mockResolvedValueOnce({
      agent: {
        catId: 'codex',
        displayName: 'Codex',
        aliases: ['@codex'],
        mentionPatterns: ['@codex'],
        personalitySummary: 'Careful coding partner',
        capabilitySummary: 'code, tests',
        available: true,
        source: 'existing'
      },
      contact: {
        connected: true
      }
    })

    const contact = await clowderStore.connectExistingCat('codex')
    const channel = await channelStore.getChannelInfo('clowder_cat:codex', 1)

    expect(post).toHaveBeenCalledWith('clowder/cats/connect', { catId: 'codex' })
    expect(contact.connected).toBe(true)
    expect(clowderStore.connectedCatContacts.map(cat => cat.catId)).toEqual(['codex'])
    expect(channel).toMatchObject({
      channel_id: 'clowder_cat:codex',
      channel_type: 1,
      name: 'Codex',
      robot: 1,
      category: 'clowder-cat',
      catId: 'codex'
    })
    expect(getChannelInfo).not.toHaveBeenCalled()
  })

  it('keeps locally connected cats when a refreshed directory only returns template candidates', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()

    post.mockResolvedValueOnce({
      agent: {
        catId: 'runtime-helper',
        displayName: '代码助手',
        aliases: ['@helper'],
        mentionPatterns: ['@helper'],
        personalitySummary: '稳健地写代码',
        capabilitySummary: '代码审查、测试',
        available: true,
        source: 'runtime-created'
      },
      contact: {
        connected: true,
        source: 'runtime-created'
      }
    })

    await store.createCatAndConnect({
      name: '代码助手',
      alias: '@helper',
      clientId: 'openai',
      authType: 'api_key',
      accountRef: 'openai-prod'
    })

    expect(store.connectedCatContacts.map(cat => cat.catId)).toEqual(['runtime-helper'])
    expect(store.catContactDirectory.map(cat => cat.catId)).toContain('runtime-helper')

    get.mockResolvedValueOnce({
      agents: [
        {
          catId: 'ragdoll',
          displayName: '布偶猫',
          aliases: ['@ragdoll', '@布偶猫'],
          mentionPatterns: ['@ragdoll', '@布偶猫'],
          personalitySummary: '温柔但有主见',
          capabilitySummary: '架构设计',
          available: true,
          connected: false,
          source: 'disconnected'
        }
      ]
    })

    const refreshed = await store.loadCatContactDirectory({ includeUnavailable: true })

    expect(get).toHaveBeenCalledWith('clowder/cats', { params: { includeUnavailable: true } })
    expect(refreshed.map(cat => cat.catId)).toEqual(['ragdoll', 'runtime-helper'])
    expect(store.connectedCatContacts.map(cat => cat.catId)).toEqual(['runtime-helper'])
    expect(store.catContactDirectory.find(cat => cat.catId === 'runtime-helper')).toMatchObject({
      displayName: '代码助手',
      connected: true
    })
  })

  it('loads cloneable role templates separately from connected cat contacts', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()

    get.mockResolvedValueOnce({
      agents: [
        {
          catId: 'codex',
          displayName: 'Codex',
          aliases: ['@codex'],
          mentionPatterns: ['@codex'],
          personalitySummary: 'Careful coding partner',
          capabilitySummary: 'code, tests',
          available: true,
          connected: true,
          source: 'existing'
        },
        {
          catId: 'runtime-helper',
          displayName: '代码助手',
          aliases: ['@helper'],
          mentionPatterns: ['@helper'],
          personalitySummary: '稳健地写代码',
          capabilitySummary: '代码审查、测试',
          available: true,
          connected: true,
          source: 'runtime-created'
        }
      ],
      templates: [
        {
          roleTemplateId: 'ragdoll',
          catId: 'ragdoll',
          displayName: '布偶猫',
          personalitySummary: '温柔但有主见',
          capabilitySummary: '架构设计',
          cloneable: true,
          source: 'role-template'
        },
        {
          roleTemplateId: 'maine-coon',
          catId: 'maine-coon',
          displayName: 'Codex',
          personalitySummary: '严谨认真',
          capabilitySummary: 'Review、找 bug、coding 落地',
          cloneable: true,
          source: 'role-template'
        },
        {
          roleTemplateId: 'coordinator',
          catId: 'coordinator',
          displayName: '协调者',
          personalitySummary: '清晰、稳健',
          capabilitySummary: '需求澄清、任务拆分',
          cloneable: true,
          source: 'role-template'
        }
      ]
    })

    await store.loadCatContactDirectory({ includeUnavailable: true })

    expect(store.catContactDirectory.map(cat => cat.catId)).toEqual(['codex', 'runtime-helper'])
    expect(store.catRoleTemplates.map(template => template.roleTemplateId)).toEqual(['ragdoll', 'maine-coon', 'coordinator'])
    expect(store.catRoleTemplates.find(template => template.roleTemplateId === 'coordinator')).toMatchObject({
      displayName: '协调者',
      cloneable: true
    })
  })
})
