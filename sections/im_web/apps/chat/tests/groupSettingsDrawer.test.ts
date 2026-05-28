import { describe, expect, it } from 'vitest'

describe('group settings drawer component contract', () => {
  it('uses store-owned group actions, permission gates, confirmations, and unavailable states', async () => {
    const source = await import('../../../packages/base-vue/src/components/GroupSettingsDrawer.vue?raw')

    for (const method of [
      'groupStore.updateGroupProfile',
      'groupStore.updateGroupSetting',
      'groupStore.inviteMembers',
      'groupStore.exitGroup',
      'groupStore.disbandGroup',
      'groupStore.muteAll'
    ]) {
      expect(source.default).toContain(method)
    }

    expect(source.default).toContain('confirmDestructive')
    expect(source.default).toContain('canManageGroup')
    expect(source.default).toContain('isOwner')
    expect(source.default).toContain('普通成员不允许')
    expect(source.default).toContain('暂不可用')
  })
})
