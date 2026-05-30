import { describe, expect, it } from 'vitest'

describe('clowder conversation panel component', () => {
  it('defines ready, disabled, denied, loading, and error states without nested card layout', async () => {
    const source = await import('../src/components/ClowderConversationPanel.vue?raw')

    expect(source.default).toContain('ClowderConversationPanel')
    for (const token of ['ready', 'disabled', 'denied', 'loading', 'error']) {
      expect(source.default).toContain(token)
    }
    expect(source.default).toContain('agentDirectories')
    expect(source.default).toContain('setFocus')
    expect(source.default).not.toContain('card')
  })
})
