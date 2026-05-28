import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const updateGroupInfo = vi.fn()
const updateSetting = vi.fn()
const inviteMembers = vi.fn()
const removeMembers = vi.fn()
const appointManager = vi.fn()
const removeManager = vi.fn()
const muteMember = vi.fn()
const muteAll = vi.fn()
const transferOwner = vi.fn()
const exitGroup = vi.fn()
const disbandGroup = vi.fn()
const blacklistMember = vi.fn()
const getGroupInfo = vi.fn()
const getGroupMembers = vi.fn()

vi.mock('@tsdaodao/base-vue', () => ({
  apiClient: {
    defaults: { baseURL: 'http://api.example/v1/' },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  },
  apiDelete: vi.fn(),
  StorageService: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn()
  }
}))

vi.mock('@tsdaodao/datasource-vue/api', () => ({
  groupApi: {
    getMyGroups: vi.fn(async () => []),
    getGroupInfo,
    getGroupMembers,
    updateGroupInfo,
    updateSetting,
    inviteMembers,
    removeMembers,
    appointManager,
    removeManager,
    muteMember,
    muteAll,
    transferOwner,
    exitGroup,
    disbandGroup,
    blacklistMember
  }
}))

describe('group permissions and management store actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    updateGroupInfo.mockResolvedValue(undefined)
    updateSetting.mockResolvedValue(undefined)
    inviteMembers.mockResolvedValue(undefined)
    removeMembers.mockResolvedValue(undefined)
    appointManager.mockResolvedValue(undefined)
    removeManager.mockResolvedValue(undefined)
    muteMember.mockResolvedValue(undefined)
    muteAll.mockResolvedValue(undefined)
    transferOwner.mockResolvedValue(undefined)
    exitGroup.mockResolvedValue(undefined)
    disbandGroup.mockResolvedValue(undefined)
    blacklistMember.mockResolvedValue(undefined)
    getGroupInfo.mockResolvedValue({ group_no: 'g1', name: 'Team', owner: 'owner', status: 1, role: 1, save: 1 })
    getGroupMembers.mockResolvedValue([
      { uid: 'owner', role: 1, name: 'Owner' },
      { uid: 'u2', role: 0, name: 'Member' }
    ])
  })

  it('normalizes current user permissions from owner, creator, or member role fallback', async () => {
    const { getMyGroupRole, canManageGroupMember } = await import('../../../packages/datasource-vue/src/stores/groupChatUtils.ts')

    expect(getMyGroupRole({ owner: 'me', role: 0 }, 'me')).toBe(1)
    expect(getMyGroupRole({ creator: 'me', role: 0 }, 'me')).toBe(1)
    expect(getMyGroupRole({ role: 2 }, 'other')).toBe(2)
    expect(canManageGroupMember({ owner: 'me' }, { uid: 'u2', role: 0 }, 'me')).toBe(true)
    expect(canManageGroupMember({ role: 2 }, { uid: 'owner', role: 1 }, 'admin')).toBe(false)
  })

  it('keeps profile, setting, membership, role, mute, blacklist, and lifecycle state in groupStore', async () => {
    const { useGroupStore } = await import('../../../packages/datasource-vue/src/stores/groupStore.ts')
    const store = useGroupStore()

    store.upsertGroup({ group_no: 'g1', name: 'Old', owner: 'owner', status: 1, role: 1, save: 1 })
    store.groupMembers.g1 = [
      { uid: 'owner', member_uid: 'owner', role: 1, name: 'Owner' },
      { uid: 'u2', member_uid: 'u2', role: 0, name: 'Member' }
    ]

    await store.updateGroupProfile('g1', { name: 'New', notice: 'Hello' })
    expect(updateGroupInfo).toHaveBeenCalledWith('g1', { name: 'New', notice: 'Hello' })
    expect(store.groups.g1).toMatchObject({ name: 'New', notice: 'Hello' })

    await store.updateGroupSetting('g1', { save: 0, mute: 1, invite: 1 })
    expect(updateSetting).toHaveBeenCalledWith('g1', { save: 0, mute: 1, invite: 1 })
    expect(store.groups.g1).toMatchObject({ save: 0, mute: 1, invite: 1 })

    await store.inviteMembers('g1', ['u3'])
    expect(inviteMembers).toHaveBeenCalledWith('g1', ['u3'])
    await store.appointManager('g1', 'u2')
    expect(appointManager).toHaveBeenCalledWith('g1', ['u2'])
    expect(store.groupMembers.g1.find((member: any) => member.uid === 'u2')?.role).toBe(2)

    await store.removeManager('g1', 'u2')
    expect(removeManager).toHaveBeenCalledWith('g1', ['u2'])
    expect(store.groupMembers.g1.find((member: any) => member.uid === 'u2')?.role).toBe(0)

    await store.muteMember('g1', 'u2', true)
    expect(muteMember).toHaveBeenCalledWith('g1', { member_uid: 'u2', action: 1, key: 1 })
    expect(store.groupMembers.g1.find((member: any) => member.uid === 'u2')?.is_mute).toBe(1)

    await store.blacklistMembers('g1', ['u2'], true)
    expect(blacklistMember).toHaveBeenCalledWith('g1', 1, ['u2'])
    expect(store.groupMembers.g1.find((member: any) => member.uid === 'u2')?.status).toBe('blacklisted')

    await store.transferOwner('g1', 'u2')
    expect(transferOwner).toHaveBeenCalledWith('g1', 'u2')
    expect(store.groups.g1.owner).toBe('u2')

    await store.removeMembers('g1', ['owner'])
    expect(removeMembers).toHaveBeenCalledWith('g1', ['owner'])
    expect(store.groupMembers.g1.some((member: any) => member.uid === 'owner')).toBe(false)

    await store.exitGroup('g1')
    expect(exitGroup).toHaveBeenCalledWith('g1')
    expect(store.groups.g1.status).toBe(0)

    store.upsertGroup({ group_no: 'g2', name: 'Group 2', owner: 'owner', status: 1 })
    await store.disbandGroup('g2')
    expect(disbandGroup).toHaveBeenCalledWith('g2')
    expect(store.groups.g2.status).toBe(0)
  })
})
