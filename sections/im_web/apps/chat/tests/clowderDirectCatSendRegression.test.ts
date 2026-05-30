import { describe, expect, it } from 'vitest'

describe('Clowder direct cat send regression', () => {
  it('does not immediately history-sync direct cat sends after the optimistic IM send', async () => {
    const source = await import('../src/components/MessageInput.vue?raw')

    expect(source.default).toContain('sendClowderRouteMessage')
    expect(source.default).toContain('scheduleClowderConversationSync(props.channelId, props.channelType)')
    expect(source.default).not.toContain('await messageStore.syncMessages(props.channelId, props.channelType)')
  })
})
