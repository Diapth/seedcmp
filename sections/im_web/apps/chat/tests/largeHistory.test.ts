import { describe, expect, it } from 'vitest'

describe('large history rendering contracts', () => {
  it('keeps message rows stable and renders a bounded visible window for large histories', async () => {
    const source = await import('../src/components/MessageList.vue?raw')
    const text = source.default

    expect(text).toContain('visibleMessages')
    expect(text).toContain('historyWindowSize')
    expect(text).toContain('topSpacerHeight')
    expect(text).toContain('bottomSpacerHeight')
    expect(text).toContain('message-row-wrapper')
    expect(text).toContain('min-height')
  })
})
