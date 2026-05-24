import { describe, expect, it } from 'vitest'
import { getMyGroupRole, isGroupOwner } from '@tsdaodao/datasource-vue'

describe('group owner permission fallback', () => {
  it('treats the current user as owner when member role or creator/owner identifies them', () => {
    expect(isGroupOwner({ owner: 'u1', role: 0 }, 'u1')).toBe(true)
    expect(getMyGroupRole({ creator: 'u2', role: 0 }, 'u2')).toBe(1)
    expect(getMyGroupRole({ owner: 'u1', role: 2 }, 'member')).toBe(2)
  })

  it('uses current member role in the settings drawer permission gates', async () => {
    const source = await import('../../../packages/base-vue/src/components/GroupSettingsDrawer.vue?raw')

    expect(source.default).toContain('const currentMember = computed')
    expect(source.default).toContain('const currentMemberRole = computed')
    expect(source.default).toContain('currentMemberRole.value === 1')
    expect(source.default).toContain('currentMemberRole.value === 2')
    expect(source.default).toContain('v-if="isOwner" class="avatar-edit-overlay"')
  })
})
