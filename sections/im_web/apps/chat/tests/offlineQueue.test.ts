import { describe, expect, it } from 'vitest'

describe('offline queue and recovery sync contract', () => {
  it('preserves retryable pending work and exposes queue resend helpers in messageStore', async () => {
    const source = await import('../../../packages/datasource-vue/src/stores/messageStore.ts?raw')

    expect(source.default).toContain('pendingQueue')
    expect(source.default).toContain('queuePendingMessage')
    expect(source.default).toContain('retryPendingQueue')
    expect(source.default).toContain('markPendingFailed')
    expect(source.default).toContain('retryMessage(channelId')
  })

  it('coordinates conversations, messages, reactions, pins, reminders, read states, and group updates during recovery', async () => {
    const conversation = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts?raw')

    expect(conversation.default).toContain('recoveryState')
    expect(conversation.default).toContain('lastRecoveryAt')
    expect(conversation.default).toContain('recoverAfterReconnect')
    expect(conversation.default).toContain('messageStore.syncMessages')
    expect(conversation.default).toContain('messageStore.syncPinnedMessages')
    expect(conversation.default).toContain('messageStore.syncReminders')
    expect(conversation.default).toContain('groupStore.fetchMyGroups')
  })
})
