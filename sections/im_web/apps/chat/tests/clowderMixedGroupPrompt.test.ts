import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const post = vi.fn()

vi.mock('@tsdaodao/base-vue', () => ({
  apiClient: {
    get: vi.fn(),
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
})
