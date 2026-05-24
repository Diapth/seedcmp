import { describe, expect, it } from 'vitest'

describe('robot and report flow contracts', () => {
  it('keeps robot command menu and unavailable states inside the message input flow', async () => {
    const source = await import('../src/components/MessageInput.vue?raw')
    const text = source.default

    expect(text).toContain('robotMenuState')
    expect(text).toContain('openRobotMenu')
    expect(text).toContain('sendRobotCommand')
    expect(text).toContain('机器人暂不可用')
    expect(text).toContain('robot ack')
  })

  it('supports report category, description, attachment, submit, and failure states', async () => {
    const source = await import('../src/views/UserProfileDrawer.vue?raw')
    const text = source.default

    expect(text).toContain('reportState')
    expect(text).toContain('reportCategory')
    expect(text).toContain('reportDescription')
    expect(text).toContain('reportAttachment')
    expect(text).toContain('submitReport')
    expect(text).toContain('reportTarget')
  })
})
