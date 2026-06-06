import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const get = vi.fn()
const post = vi.fn()

vi.mock('@tsdaodao/base-vue', () => ({
  apiClient: {
    get,
    post
  }
}))

describe('Clowder mixed human and cat group prompt', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('keeps durable cat membership and generates a deterministic group prompt', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const clowderStore = useClowderStore()

    const prompt = await clowderStore.syncMixedGroupCats({
      groupId: 'group-1',
      groupName: 'Launch Room',
      humanMembers: [
        { id: 'u_alice', displayName: 'Alice', role: 'owner', mentionHandle: '@Alice' },
        { id: 'u_bob', displayName: 'Bob', role: 'member', mentionHandle: '@Bob' }
      ],
      catMembers: [
        {
          catId: 'codex',
          displayName: 'Codex',
          aliases: ['@codex'],
          personalitySummary: 'Careful coding partner',
          capabilitySummary: 'code, tests',
          available: true
        },
        {
          catId: 'news',
          displayName: 'News Cat',
          aliases: ['@news'],
          personalitySummary: 'Brief news watcher',
          capabilitySummary: 'summaries',
          available: true
        }
      ],
      rules: {
        proactiveReplies: false,
        privacy: 'Cats can see display names, roles, and mention handles only.'
      }
    })

    expect(post).toHaveBeenCalledWith('clowder/group/cats/sync', expect.objectContaining({
      groupId: 'group-1',
      catIds: ['codex', 'news'],
      prompt: expect.stringContaining('Launch Room')
    }))
    expect(clowderStore.groupCatMemberships['group-1'].map(cat => cat.catId)).toEqual(['codex', 'news'])
    expect(prompt).toContain('Humans:')
    expect(prompt).toContain('- Alice (id: u_alice, role: owner, mention: @Alice)')
    expect(prompt).toContain('Cats:')
    expect(prompt).toContain('- Codex (catId: codex, aliases: @codex, mention: @codex)')
    expect(prompt).toContain('Allowed @ targets: @Alice, @Bob, @codex, @news')
    expect(prompt).toContain('Cats may answer only when mentioned or focused.')
    expect(prompt).toContain('Cats can see display names, roles, and mention handles only.')
  })

  it('forwards group cat mention targets and recent context to Clowder conversation routing', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const clowderStore = useClowderStore()

    await clowderStore.sendConversationMessage({
      channelId: 'group-1',
      channelType: 2,
      targetCatIds: ['codex'],
      promptContext: [
        'Group: Launch Room (id: group-1)',
        'Recent messages:',
        '- Alice: @Codex 帮我整理一下',
        '- News Cat: 上一轮摘要'
      ].join('\n')
    }, '@Codex 帮我整理一下')

    expect(post).toHaveBeenCalledWith('clowder/conversation/message', {
      channelId: 'group-1',
      channelType: 2,
      targetCatIds: ['codex'],
      promptContext: expect.stringContaining('Recent messages:'),
      text: '@Codex 帮我整理一下'
    })
  })

  it('message input builds Clowder group context from prompt metadata and recent messages', async () => {
    const source = await import('../src/components/MessageInput.vue?raw')

    expect(source.default).toContain('buildClowderPromptContext')
    expect(source.default).toContain('Recent messages:')
    expect(source.default).toContain('messageStore.getChannelMessages(props.channelId, props.channelType)')
    expect(source.default).toContain('targetCatIds')
    expect(source.default).toContain('promptContext: buildClowderPromptContext(text, targetCatIds, triggerReason, replyTarget)')
  })

  it('loads durable group cat membership back from the bridge', async () => {
    get.mockResolvedValueOnce({
      groupId: 'group-1',
      groupName: 'Launch Room',
      catIds: ['codex'],
      prompt: 'Group: Launch Room\nCats:\n- Codex',
      cats: [
        {
          catId: 'codex',
          displayName: 'Codex',
          aliases: ['@codex'],
          mentionPatterns: ['@codex'],
          available: true,
          connected: true
        }
      ]
    })
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const clowderStore = useClowderStore()

    const cats = await clowderStore.loadGroupCats('group-1')

    expect(get).toHaveBeenCalledWith('clowder/group/cats', { params: { groupId: 'group-1' } })
    expect(cats.map(cat => cat.catId)).toEqual(['codex'])
    expect(clowderStore.groupCatMemberships['group-1'].map(cat => cat.displayName)).toEqual(['Codex'])
    expect(clowderStore.groupPrompts['group-1']).toContain('Launch Room')
  })

  it('loads the durable group auto reply mode from the bridge', async () => {
    get
      .mockResolvedValueOnce({
        groupId: 'group-1',
        groupName: 'Launch Room',
        catIds: ['codex'],
        autoReplyMode: 'off',
        proactiveReplies: true,
        prompt: 'Group: Launch Room\nCats:\n- Codex',
        cats: [
          {
            catId: 'codex',
            displayName: 'Codex',
            aliases: ['@codex'],
            mentionPatterns: ['@codex'],
            available: true,
            connected: true
          }
        ]
      })
      .mockResolvedValueOnce({ agents: [] })

    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const clowderStore = useClowderStore()

    await clowderStore.loadGroupCats('group-1')

    expect(clowderStore.groupAutoReplyModes['group-1']).toBe('off')
    expect(clowderStore.groupPrompts['group-1']).toContain('Cats may answer only when mentioned or focused.')
  })

  it('rolls back local group auto reply state when bridge sync fails', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const clowderStore = useClowderStore()
    clowderStore.groupCatMemberships['group-1'] = [
      {
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
    ]
    clowderStore.groupAutoReplyModes['group-1'] = 'mentions_only'
    clowderStore.groupPrompts['group-1'] = 'previous prompt'
    post.mockRejectedValueOnce(new Error('sync failed'))

    await expect(clowderStore.setGroupAutoReplyMode('group-1', 'soft_mentions', 'Launch Room')).rejects.toThrow('sync failed')

    expect(clowderStore.groupAutoReplyModes['group-1']).toBe('mentions_only')
    expect(clowderStore.groupPrompts['group-1']).toBe('previous prompt')
    expect(clowderStore.error).toBe('sync failed')
  })

  it('persists group auto reply mode changes to the bridge', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const clowderStore = useClowderStore()
    clowderStore.groupCatMemberships['group-1'] = [
      {
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
    ]

    const mode = await clowderStore.setGroupAutoReplyMode('group-1', 'off', 'Launch Room')

    expect(mode).toBe('off')
    expect(post).toHaveBeenCalledWith('clowder/group/cats/sync', expect.objectContaining({
      groupId: 'group-1',
      autoReplyMode: 'off',
      proactiveReplies: false,
      prompt: expect.stringContaining('Cats may answer only when mentioned or focused.')
    }))
  })

  it('adds a connected cat to an existing group and syncs the durable membership', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const clowderStore = useClowderStore()
    clowderStore.connectedCatContacts = [
      {
        id: 'clowder_cat:codex',
        catId: 'codex',
        displayName: 'Codex',
        aliases: ['@codex'],
        mentionNames: ['@codex'],
        avatar: '',
        personalitySummary: 'Careful coding partner',
        capabilitySummary: 'code, tests',
        available: true,
        availabilityState: 'available',
        source: 'existing',
        connected: true
      }
    ]

    const cats = await clowderStore.addGroupCat('group-1', 'codex', 'Launch Room')

    expect(cats.map(cat => cat.catId)).toEqual(['codex'])
    expect(post).toHaveBeenCalledWith('clowder/group/cats/sync', expect.objectContaining({
      groupId: 'group-1',
      groupName: 'Launch Room',
      catIds: ['codex'],
      cats: [expect.objectContaining({ catId: 'codex', displayName: 'Codex' })],
      prompt: expect.stringContaining('Codex')
    }))
  })

  it('falls back to the group agent directory when no durable cat membership exists yet', async () => {
    get
      .mockResolvedValueOnce({
        groupId: 'group-legacy',
        catIds: [],
        cats: [],
        prompt: ''
      })
      .mockResolvedValueOnce({
        agents: [
          {
            catId: 'opus',
            displayName: '布偶猫',
            aliases: ['@布偶猫'],
            mentionPatterns: ['@布偶猫'],
            available: true
          }
        ]
      })
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const clowderStore = useClowderStore()

    const cats = await clowderStore.loadGroupCats('group-legacy')

    expect(get).toHaveBeenNthCalledWith(1, 'clowder/group/cats', { params: { groupId: 'group-legacy' } })
    expect(get).toHaveBeenNthCalledWith(2, 'clowder/conversation/agents', { params: { channelId: 'group-legacy', channelType: 2 } })
    expect(cats.map(cat => cat.displayName)).toEqual(['布偶猫'])
    expect(clowderStore.groupCatMemberships['group-legacy'].map(cat => cat.catId)).toEqual(['opus'])
  })

  it('merges current agent directory into stale durable group membership', async () => {
    get
      .mockResolvedValueOnce({
        groupId: 'group-stale',
        catIds: ['ragdoll'],
        cats: [
          {
            catId: 'ragdoll',
            displayName: '布偶猫',
            aliases: ['@布偶猫'],
            mentionPatterns: ['@布偶猫'],
            available: true,
            connected: true
          }
        ],
        prompt: 'Group: stale group'
      })
      .mockResolvedValueOnce({
        agents: [
          {
            catId: 'codex',
            displayName: 'Codex',
            aliases: ['@codex'],
            mentionPatterns: ['@codex', '@Codex'],
            available: true
          },
          {
            catId: 'ragdoll',
            displayName: '布偶猫',
            aliases: ['@布偶猫'],
            mentionPatterns: ['@布偶猫'],
            available: true
          }
        ]
      })
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const clowderStore = useClowderStore()

    const cats = await clowderStore.loadGroupCats('group-stale')

    expect(get).toHaveBeenNthCalledWith(1, 'clowder/group/cats', { params: { groupId: 'group-stale' } })
    expect(get).toHaveBeenNthCalledWith(2, 'clowder/conversation/agents', { params: { channelId: 'group-stale', channelType: 2 } })
    expect(cats.map(cat => cat.catId)).toEqual(['ragdoll', 'codex'])
    expect(cats.find(cat => cat.catId === 'codex')?.mentionNames).toContain('@codex')
    expect(clowderStore.groupCatMemberships['group-stale'].map(cat => cat.catId)).toEqual(['ragdoll', 'codex'])
  })

  it('falls back to the global cat directory when group agent directory is unavailable', async () => {
    get
      .mockResolvedValueOnce({
        groupId: 'group-stale',
        catIds: ['ragdoll'],
        cats: [
          {
            catId: 'ragdoll',
            displayName: '布偶猫',
            aliases: ['@ragdoll-kn9a'],
            mentionPatterns: ['@ragdoll-kn9a'],
            available: true,
            connected: true
          }
        ],
        prompt: 'Group: stale group'
      })
      .mockRejectedValueOnce(new Error('agent directory forbidden'))
      .mockResolvedValueOnce({
        agents: [
          {
            catId: 'ragdoll',
            displayName: '布偶猫',
            aliases: ['@ragdoll-kn9a'],
            mentionPatterns: ['@ragdoll-kn9a'],
            available: true,
            connected: true
          },
          {
            catId: 'codex',
            displayName: 'Codex',
            aliases: ['@codex'],
            mentionPatterns: ['@codex'],
            available: true,
            connected: true
          }
        ]
      })
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const clowderStore = useClowderStore()

    const cats = await clowderStore.loadGroupCats('group-stale')

    expect(get).toHaveBeenNthCalledWith(1, 'clowder/group/cats', { params: { groupId: 'group-stale' } })
    expect(get).toHaveBeenNthCalledWith(2, 'clowder/conversation/agents', { params: { channelId: 'group-stale', channelType: 2 } })
    expect(get).toHaveBeenNthCalledWith(3, 'clowder/cats', { params: { includeUnavailable: true } })
    expect(cats.map(cat => cat.catId)).toEqual(['ragdoll'])
    expect(clowderStore.groupCatMemberships['group-stale'].map(cat => cat.catId)).toEqual(['ragdoll'])
    expect(clowderStore.groupPrompts['group-stale']).toContain('Allowed @ targets: @ragdoll-kn9a')
  })
})
