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

describe('clowder agent directory store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads available, unavailable, preferred, and last-active agents for a conversation', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()

    get.mockResolvedValueOnce({
      agents: [
        {
          catId: 'codex',
          displayName: 'Codex',
          mentionPatterns: ['@codex'],
          available: true,
          preferred: true,
          lastActiveAt: 1780000000000
        },
        {
          catId: 'opus',
          displayName: 'Opus',
          mentionPatterns: ['@opus'],
          available: false,
          preferred: false
        }
      ],
      preferredCatIds: ['codex'],
      lastActiveCatId: 'codex'
    })

    const directory = await store.loadAgentDirectory({ channelId: 'group-clowder', channelType: 2 })

    expect(get).toHaveBeenCalledWith('clowder/conversation/agents', {
      params: { channelId: 'group-clowder', channelType: 2 }
    })
    expect(directory.agents.map(agent => agent.catId)).toEqual(['codex', 'opus'])
    expect(directory.available.map(agent => agent.catId)).toEqual(['codex'])
    expect(directory.unavailable.map(agent => agent.catId)).toEqual(['opus'])
    expect(directory.preferred.map(agent => agent.catId)).toEqual(['codex'])
    expect(directory.lastActive?.catId).toBe('codex')
    expect(store.getConversation('group-clowder', 2)?.agents).toEqual(directory.agents)
  })

  it('deduplicates concurrent and immediate repeated agent directory loads', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()

    let resolveDirectory!: (value: unknown) => void
    get.mockReturnValueOnce(new Promise(resolve => {
      resolveDirectory = resolve
    }))

    const first = store.loadAgentDirectory({ channelId: 'group-clowder', channelType: 2 })
    const second = store.loadAgentDirectory({ channelId: 'group-clowder', channelType: 2 })

    expect(get).toHaveBeenCalledTimes(1)

    resolveDirectory({
      agents: [
        {
          catId: 'codex',
          displayName: 'Codex',
          mentionPatterns: ['@codex'],
          available: true
        }
      ]
    })

    const [firstDirectory, secondDirectory] = await Promise.all([first, second])
    expect(firstDirectory.agents.map(agent => agent.catId)).toEqual(['codex'])
    expect(secondDirectory).toBe(firstDirectory)

    const cached = await store.loadAgentDirectory({ channelId: 'group-clowder', channelType: 2 })
    expect(get).toHaveBeenCalledTimes(1)
    expect(cached).toStrictEqual(firstDirectory)
  })

  it('sets and clears focus through store actions while updating preferred agents', async () => {
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const store = useClowderStore()

    post
      .mockResolvedValueOnce({
        status: { enabled: true, configured: true, reachable: true, state: 'ready' },
        agents: [{ catId: 'codex', displayName: 'Codex', mentionPatterns: ['@codex'], available: true, preferred: true }],
        focusCatId: 'codex'
      })
      .mockResolvedValueOnce({
        status: { enabled: true, configured: true, reachable: true, state: 'ready' },
        agents: [{ catId: 'codex', displayName: 'Codex', mentionPatterns: ['@codex'], available: true, preferred: false }]
      })

    await store.setFocus({ channelId: 'group-clowder', channelType: 2 }, 'codex')
    expect(post).toHaveBeenCalledWith('clowder/conversation/focus', {
      channelId: 'group-clowder',
      channelType: 2,
      catId: 'codex'
    })
    expect(store.getConversation('group-clowder', 2)?.focusCatId).toBe('codex')

    await store.clearFocus({ channelId: 'group-clowder', channelType: 2 })
    expect(post).toHaveBeenCalledWith('clowder/conversation/focus/clear', {
      channelId: 'group-clowder',
      channelType: 2
    })
    expect(store.getConversation('group-clowder', 2)?.focusCatId).toBeUndefined()
  })
})
