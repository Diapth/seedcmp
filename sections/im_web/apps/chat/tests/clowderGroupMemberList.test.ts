import { describe, expect, it } from 'vitest'

describe('Clowder cat group members', () => {
  it('renders connected cats in the group member list and wires removal through Clowder state', async () => {
    const source = await import('../src/views/GroupMemberList.vue?raw')

    expect(source.default).toContain('useClowderStore')
    expect(source.default).toContain('catMembers')
    expect(source.default).toContain('filteredCatMembers')
    expect(source.default).toContain('handleRemoveCatMember')
    expect(source.default).toContain('removeGroupCat')
    expect(source.default).toContain('clowder-cat-member')
    expect(source.default).toContain('猫猫成员')
  })
})
