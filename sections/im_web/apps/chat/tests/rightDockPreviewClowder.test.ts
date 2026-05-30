import { describe, expect, it } from 'vitest'

describe('right dock preview and Clowder layout', () => {
  it('uses one resizable dock with tabs instead of rendering preview and Clowder as sibling asides', async () => {
    const chatView = await import('../src/views/ChatView.vue?raw')
    const preview = await import('../src/components/ChatSidePreview.vue?raw')
    const panel = await import('../src/components/ClowderConversationPanel.vue?raw')

    expect(chatView.default).toContain('rightDockVisible')
    expect(chatView.default).toContain('rightDockWidth')
    expect(chatView.default).toContain('startRightDockResize')
    expect(chatView.default).toContain('dock-tab')
    expect(chatView.default).toContain('style="{ width: `${rightDockWidth}px` }"')
    expect(chatView.default).toContain('<ChatSidePreview')
    expect(chatView.default).toContain('<ClowderConversationPanel')
    expect(preview.default).not.toContain('<aside')
    expect(panel.default).not.toContain('<aside')
  })
})

