import { describe, expect, it } from 'vitest'

describe('realtime CMD group synchronization source', () => {
  it('invalidates and refreshes groupStore on group avatar updates', async () => {
    const source = await import('../../../packages/datasource-vue/src/cmd/index.ts?raw')
    const body = source.default.match(/case 'groupAvatarUpdate':[\s\S]*?break;/)?.[0] || ''

    expect(body).toContain('delete groupStore.groups[channel.channelID]')
    expect(body).toContain('groupStore.getGroupInfo(channel.channelID)')
  })

  it('refreshes both legacy channel members and normalized group members on member updates', async () => {
    const source = await import('../../../packages/datasource-vue/src/cmd/index.ts?raw')
    const body = source.default.match(/case 'memberUpdate':[\s\S]*?break;/)?.[0] || ''

    expect(body).toContain('channelStore.fetchGroupMembers(channel.channelID)')
    expect(body).toContain('groupStore.fetchGroupMembers(channel.channelID)')
  })
})
