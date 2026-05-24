import { describe, expect, it } from 'vitest'

describe('group invite, QR, approval, expired, and unavailable states', () => {
  it('wraps invite, QR, approval, scan join, blacklist, and unavailable backend states in groupApi', async () => {
    const source = await import('../../../packages/datasource-vue/src/api/index.ts?raw')

    expect(source.default).toContain('inviteMembers(groupNo: string, members: string[])')
    expect(source.default).toContain('member/invite')
    expect(source.default).toContain('getGroupQRCode')
    expect(source.default).toContain('qrcode')
    expect(source.default).toContain('getInviteDetail')
    expect(source.default).toContain('group/invites')
    expect(source.default).toContain('confirmInvite')
    expect(source.default).toContain('group/invite/sure')
    expect(source.default).toContain('scanJoinGroup')
    expect(source.default).toContain('scanjoin')
    expect(source.default).toContain('blacklistMember')
  })

  it('surfaces QR invite and approval states without pretending unsupported flows are available', async () => {
    const drawer = await import('../../../packages/base-vue/src/components/GroupSettingsDrawer.vue?raw')
    const create = await import('../src/views/CreateGroupPage.vue?raw')

    for (const text of ['群二维码', '邀请确认', '已过期', '待审批', '暂不可用']) {
      expect(drawer.default + create.default).toContain(text)
    }
    expect(drawer.default).toContain('loadQRCode')
    expect(drawer.default).toContain('showQrModal')
    expect(create.default).toContain('inviteMode')
  })
})
