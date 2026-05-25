import { describe, expect, it } from 'vitest'

describe('V2-19 chat interaction regressions', () => {
  it('renders group QR as a scannable visual surface instead of raw link text only', async () => {
    const drawer = await import('../../../packages/base-vue/src/components/GroupSettingsDrawer.vue?raw')
    const text = drawer.default

    expect(text).toContain('qrPayload')
    expect(text).toContain('qrModules')
    expect(text).toContain('qr-grid')
    expect(text).not.toContain(`<div v-else-if="qrState === 'ready'" class="qr-box">{{ qrCodeUrl }}</div>`)
  })

  it('explains robot usage, configuration, and unavailable states in the Bot panel', async () => {
    const input = await import('../src/components/MessageInput.vue?raw')
    const text = input.default

    expect(text).toContain('robot-panel-header')
    expect(text).toContain('机器人菜单')
    expect(text).toContain('机器人未配置')
    expect(text).toContain('请在服务端机器人管理中配置')
    expect(text).toContain('点击菜单即可发送指令')
  })

  it('normalizes friend uid comparison and syncs contacts when opening a user profile', async () => {
    const profile = await import('../src/views/UserProfileDrawer.vue?raw')
    const text = profile.default

    expect(text).toContain('watch(')
    expect(text).toContain('contactStore.syncContacts()')
    expect(text).toContain('String(c.uid) === String(props.uid)')
  })

  it('does not clear unread before the route is actually active', async () => {
    const list = await import('../src/views/ConversationList.vue?raw')
    const chatView = await import('../src/views/ChatView.vue?raw')

    expect(list.default).not.toContain('void conversationStore.clearUnread(channelId, channelType);\\n  router.push')
    expect(chatView.default).toContain('isChatViewActive')
    expect(chatView.default).toContain('conversationStore.clearUnread(cid, ctype)')
  })

  it('uses stable member ids for mentions and preserves mention payload on send', async () => {
    const input = await import('../src/components/MessageInput.vue?raw')
    const text = input.default

    expect(text).toContain('getMemberUid')
    expect(text).toContain('getMemberDisplayName')
    expect(text).toContain('mentionedUids.value.push(uid)')
    expect(text).toContain('text.includes(`@${name}`)')
    expect(text).toContain('text.includes(`@${uid}`)')
  })
})
