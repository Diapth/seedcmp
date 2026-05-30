import { describe, expect, it } from 'vitest'

describe('notification and unread contracts', () => {
  it('shows notification permission state and muted unread affordances in the conversation list', async () => {
    const source = await import('../src/views/ConversationList.vue?raw')
    const text = source.default

    expect(text).toContain('notificationPermissionState')
    expect(text).toContain('requestNotificationPermission')
    expect(text).toContain('muted-unread')
    expect(text).toContain('getUnreadCount')
    expect(text).toContain('syncError')
    expect(text).toContain('loadConversationList')
    expect(text).toContain('throwOnError: true')
    expect(text).toContain('会话同步失败')
  })

  it('keeps desktop notification unavailable and denied states in profile settings', async () => {
    const source = await import('../src/views/MyProfileDrawer.vue?raw')
    const text = source.default

    expect(text).toContain('notificationPermissionState')
    expect(text).toContain('unsupported')
    expect(text).toContain('denied')
    expect(text).toContain('Notification.requestPermission')
  })
})
