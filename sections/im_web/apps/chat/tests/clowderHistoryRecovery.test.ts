import { describe, expect, it } from 'vitest'

describe('clowder history recovery contracts', () => {
  it('preserves large-history ordering and reconnect dedup helpers for Clowder replies', async () => {
    const source = await import('../../../packages/datasource-vue/src/stores/messageStore.ts?raw')

    expect(source.default).toContain('syncMessages')
    expect(source.default).toContain('start_message_seq')
    expect(source.default).toContain('protectHistory')
    expect(source.default).toContain('isAiAssistantSource')
    expect(source.default).toContain('CLOWDER_CONNECTOR_ID')
  })
})
