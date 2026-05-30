import { describe, expect, it } from 'vitest'
import { getFriendSearchState } from '@tsdaodao/contacts-vue/utils/friendSearchState'

describe('contact group creation and friend search state', () => {
  it('classifies self, existing friends, and users who can receive applications', () => {
    expect(getFriendSearchState({ uid: 'me' }, { currentUid: 'me', contacts: [] })).toMatchObject({
      type: 'self',
      message: '这是你自己'
    })
    expect(getFriendSearchState({ uid: 'friend-a', follow: 0 }, {
      currentUid: 'me',
      contacts: [{ uid: 'friend-a' }]
    }).type).toBe('friend')
    expect(getFriendSearchState({ uid: 'friend-b', follow: 1 }, {
      currentUid: 'me',
      contacts: []
    }).type).toBe('friend')
    expect(getFriendSearchState({ uid: 'stranger', follow: 0 }, {
      currentUid: 'me',
      contacts: [{ uid: 'friend-a' }]
    })).toMatchObject({ type: 'can_apply', message: '' })
  })

  it('keeps group creation wired to selected contacts and groupStore upsert', async () => {
    const source = await import('../src/views/CreateGroupPage.vue?raw')

    expect(source.default).toContain('contactStore.syncContacts()')
    expect(source.default).toContain('selectedUids.value')
    expect(source.default).toContain('groupApi.createGroup')
    expect(source.default).toContain('groupStore.upsertGroup')
    expect(source.default).toContain('router.push(`/chat/conversation/${groupNo}/2`)')
  })

  it('allows mixed human and connected Clowder cat contacts when creating a group', async () => {
    const source = await import('../src/views/CreateGroupPage.vue?raw')

    expect(source.default).toContain('useClowderStore')
    expect(source.default).toContain('loadCatContactDirectory')
    expect(source.default).toContain('mixedSelectableContacts')
    expect(source.default).toContain('selectedCatContactIds')
    expect(source.default).toContain('syncMixedGroupCats')
    expect(source.default).toContain('clowder-cat-badge')
    expect(source.default).toContain('猫猫')
    expect(source.default).toContain('member.catContact?.id')
  })

  it('allows cat-only group creation without requiring an invited human contact', async () => {
    const source = await import('../src/views/CreateGroupPage.vue?raw')

    expect(source.default).not.toContain("Message.warning('请选择至少一个真人联系人作为群成员')")
    expect(source.default).not.toContain('selectedHumanUids.value.length === 0')
    expect(source.default).toContain('members: selectedHumanUids.value')
    expect(source.default).toContain('selectedCats.length > 0')
  })
})
