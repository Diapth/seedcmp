import { describe, expect, it } from 'vitest'

describe('UI layout stability contracts', () => {
  it('keeps chat input and message text within stable responsive bounds', async () => {
    const input = await import('../src/components/MessageInput.vue?raw')
    const list = await import('../src/components/MessageList.vue?raw')

    expect(input.default).toContain('min-height')
    expect(input.default).toContain('flex-wrap')
    expect(input.default).toContain('min-width: 0')
    expect(list.default).toContain('overflow-wrap')
    expect(list.default).toContain('max-width: min(')
  })

  it('keeps modal overlays above drawers and constrains dialog dimensions', async () => {
    const drawer = await import('../../../packages/base-vue/src/components/GroupSettingsDrawer.vue?raw')
    const text = drawer.default

    expect(text).toContain('z-index: 3200')
    expect(text).toContain('max-width: min(')
    expect(text).toContain('max-height: min(')
  })
})
