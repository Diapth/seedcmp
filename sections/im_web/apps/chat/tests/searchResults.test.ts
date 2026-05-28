import { describe, expect, it } from 'vitest'

describe('global search result contracts', () => {
  it('uses global search service with categorized people, group, and message routing', async () => {
    const source = await import('../src/components/SearchResultList.vue?raw')
    const text = source.default

    expect(text).toContain('commonApi.globalSearch')
    expect(text).toContain('VITE_ENABLE_REMOTE_GLOBAL_SEARCH')
    expect(text).toContain('remoteResults')
    expect(text).toContain('filteredContacts')
    expect(text).toContain('filteredGroups')
    expect(text).toContain('filteredMessages')
    expect(text).toContain('handleOpenChat')
    expect(text).toContain('handleOpenUser')
    expect(text).toContain('联系人')
    expect(text).toContain('群组')
    expect(text).toContain('聊天记录')
  })
})
