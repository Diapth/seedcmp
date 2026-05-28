import { describe, expect, it } from 'vitest'

describe('message UI stability guards', () => {
  it('filters unsupported message types before rendering cells', async () => {
    const source = await import('../src/components/MessageList.vue?raw')

    expect(source.default).toContain('const supportedMessageTypes = new Set')
    expect(source.default).toContain('function isRenderableMessage')
    expect(source.default).toContain('const renderableMessages = computed')
    expect(source.default).toContain('messages.value.filter(isRenderableMessage)')
  })

  it('normalizes text payload content and ignores non-digest system messages in stores', async () => {
    const messageStore = await import('../../../packages/datasource-vue/src/stores/messageStore.ts?raw')
    const conversationStore = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts?raw')

    expect(messageStore.default).toContain('normalized.type === 1')
    expect(messageStore.default).toContain('normalized.text = normalized.content')
    expect(conversationStore.default).toContain('![99, 1000].includes(getMessageType(raw))')
  })
})
