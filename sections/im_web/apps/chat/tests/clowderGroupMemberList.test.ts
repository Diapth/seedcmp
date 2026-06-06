import { describe, expect, it } from 'vitest'

describe('Clowder cat group members', () => {
  it('renders connected cats in the group member list and wires removal through Clowder state', async () => {
    const source = await import('../src/views/GroupMemberList.vue?raw')

    expect(source.default).toContain('useClowderStore')
    expect(source.default).toContain('catMembers')
    expect(source.default).toContain('availableCatsForGroup')
    expect(source.default).toContain('filteredCatMembers')
    expect(source.default).toContain('handleAddCatMember')
    expect(source.default).toContain('handleRemoveCatMember')
    expect(source.default).toContain('addGroupCat')
    expect(source.default).toContain('removeGroupCat')
    expect(source.default).toContain('currentMemberRole')
    expect(source.default).toContain('isCurrentUserOwner')
    expect(source.default).toContain('clowder-cat-member')
    expect(source.default).toContain('猫猫成员')
    expect(source.default).toContain('watch(groupNo')
    expect(source.default).toContain('loadGroupMemberState')
    expect(source.default).toContain('loadGroupCats(targetGroupNo')
    expect(source.default).toContain('loadCatContactDirectory')
    expect(source.default).toContain('cat-identity')
    expect(source.default).toContain('{{ cat.catId }}')
  })

  it('group settings drawer includes Clowder cats in member summary and preview', async () => {
    const source = await import('../../../packages/base-vue/src/components/GroupSettingsDrawer.vue?raw')

    expect(source.default).toContain('useClowderStore')
    expect(source.default).toContain('loadGroupCats(props.groupNo')
    expect(source.default).toContain('catMembers')
    expect(source.default).toContain('群成员 ({{ members.length + catMembers.length }}人)')
    expect(source.default).toContain('猫猫 {{ catMembers.length }}')
    expect(source.default).toContain('clowder-cat-member')
    expect(source.default).toContain('添加猫猫')
    expect(source.default).toContain(`@click="emit('members-click')"`)
  })
})
