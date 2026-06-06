import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const get = vi.fn()
const post = vi.fn()
const del = vi.fn()
const getChannelInfo = vi.fn()

vi.mock('@tsdaodao/base-vue', () => ({
  apiClient: {
    get,
    post,
    delete: del
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

  it('deduplicates concurrent and immediate repeated cat directory loads', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()

    let resolveDirectory!: (value: unknown) => void
    get.mockReturnValueOnce(new Promise(resolve => {
      resolveDirectory = resolve
    }))

    const first = store.loadCatContactDirectory({ includeUnavailable: true })
    const second = store.loadCatContactDirectory({ includeUnavailable: true })

    expect(get).toHaveBeenCalledTimes(1)

    resolveDirectory({
      agents: [
        {
          catId: 'codex',
          displayName: 'Codex',
          aliases: ['@codex'],
          mentionPatterns: ['@codex'],
          available: true,
          connected: true,
          source: 'existing'
        }
      ]
    })

    const [firstDirectory, secondDirectory] = await Promise.all([first, second])
    expect(firstDirectory.map(cat => cat.catId)).toEqual(['codex'])
    expect(secondDirectory).toBe(firstDirectory)

    const cached = await store.loadCatContactDirectory({ includeUnavailable: true })
    expect(get).toHaveBeenCalledTimes(1)
    expect(cached).toBe(store.catContactDirectory)
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

  it('deletes a connected cat and prunes local contact, group, directory, and focus state', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()
    const deletedCat: any = {
      id: 'clowder_cat:codex',
      uid: 'clowder_cat:codex',
      catId: 'codex',
      channelId: 'clowder_cat:codex',
      channelType: 1,
      directConversationId: 'clowder_cat:codex',
      outboundSenderId: 'clowder_cat_codex',
      historyGroupKey: 'clowder-cat:codex',
      connectorId: 'im-web',
      category: 'clowder-cat',
      robot: 1,
      name: 'Codex',
      displayName: 'Codex',
      avatar: '',
      aliases: ['@codex'],
      mentionNames: ['@codex'],
      personalitySummary: 'Careful coding partner',
      capabilitySummary: 'code, tests',
      available: true,
      availabilityState: 'available',
      source: 'existing',
      connected: true
    }
    const remainingCat: any = {
      ...deletedCat,
      id: 'clowder_cat:news',
      uid: 'clowder_cat:news',
      catId: 'news',
      channelId: 'clowder_cat:news',
      directConversationId: 'clowder_cat:news',
      outboundSenderId: 'clowder_cat_news',
      historyGroupKey: 'clowder-cat:news',
      name: 'News Cat',
      displayName: 'News Cat',
      aliases: ['@news'],
      mentionNames: ['@news'],
      personalitySummary: 'Brief news watcher',
      capabilitySummary: 'summaries'
    }
    store.connectedCatContacts = [deletedCat, remainingCat]
    store.catContactDirectory = [deletedCat, remainingCat]
    store.groupCatMemberships['group-1'] = [deletedCat, remainingCat]
    store.groupPrompts['group-1'] = 'old prompt'
    store.conversations['group-1-2'] = {
      status: { enabled: true, configured: true, reachable: true, state: 'ready' },
      agents: [
        { catId: 'codex', displayName: 'Codex', mentionPatterns: ['@codex'], available: true, preferred: true },
        { catId: 'news', displayName: 'News Cat', mentionPatterns: ['@news'], available: true }
      ],
      focusCatId: 'codex'
    }
    store.agentDirectories['group-1-2'] = {
      agents: [
        { catId: 'codex', displayName: 'Codex', mentionPatterns: ['@codex'], available: true, preferred: true },
        { catId: 'news', displayName: 'News Cat', mentionPatterns: ['@news'], available: true }
      ],
      available: [],
      unavailable: [],
      preferred: [],
      lastActive: undefined
    }
    del.mockResolvedValueOnce({ deleted: true, id: 'codex' })

    await expect(store.deleteCatContact('codex')).resolves.toEqual({ deleted: true, id: 'codex' })

    expect(del).toHaveBeenCalledWith('clowder/cats/codex')
    expect(store.connectedCatContacts.map(cat => cat.catId)).toEqual(['news'])
    expect(store.catContactDirectory.map(cat => cat.catId)).toEqual(['news'])
    expect(store.groupCatMemberships['group-1'].map(cat => cat.catId)).toEqual(['news'])
    expect(store.groupPrompts['group-1']).toContain('News Cat')
    expect(store.getConversation('group-1', 2)?.agents.map(agent => agent.catId)).toEqual(['news'])
    expect(store.getConversation('group-1', 2)?.focusCatId).toBeUndefined()
    expect(store.agentDirectories['group-1-2'].agents.map(agent => agent.catId)).toEqual(['news'])
  })

  it('keeps local cat state when remote delete fails', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()
    store.connectedCatContacts = [{
      id: 'clowder_cat:codex',
      uid: 'clowder_cat:codex',
      catId: 'codex',
      channelId: 'clowder_cat:codex',
      channelType: 1,
      directConversationId: 'clowder_cat:codex',
      outboundSenderId: 'clowder_cat_codex',
      historyGroupKey: 'clowder-cat:codex',
      connectorId: 'im-web',
      category: 'clowder-cat',
      robot: 1,
      name: 'Codex',
      displayName: 'Codex',
      avatar: '',
      aliases: ['@codex'],
      mentionNames: ['@codex'],
      personalitySummary: 'Careful coding partner',
      capabilitySummary: 'code, tests',
      available: true,
      availabilityState: 'available',
      source: 'existing',
      connected: true
    }]
    del.mockRejectedValueOnce(new Error('delete failed'))

    await expect(store.deleteCatContact('codex')).rejects.toThrow('delete failed')

    expect(store.connectedCatContacts.map(cat => cat.catId)).toEqual(['codex'])
    expect(store.error).toBe('delete failed')
  })
})
