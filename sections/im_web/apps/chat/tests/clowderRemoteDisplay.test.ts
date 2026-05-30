import { describe, expect, it } from 'vitest'

describe('Clowder remote display contracts', () => {
  it('renders durable cat replies with cat metadata instead of raw virtual sender ids', async () => {
    const source = await import('../src/components/MessageList.vue?raw')

    expect(source.default).toContain('getMessageSenderName')
    expect(source.default).toContain('getClowderSenderName')
    expect(source.default).toContain('catDisplayName')
    expect(source.default).toContain(':name="getMessageSenderName(item.msg)"')
    expect(source.default).toContain('{{ getMessageSenderName(item.msg) }}')
  })

  it('keeps synced direct cat conversation summaries on the cat display name', async () => {
    const conversationSource = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts?raw')
    const messageSource = await import('../../../packages/datasource-vue/src/stores/messageStore.ts?raw')

    expect(conversationSource.default).toContain('resolveClowderConversationName')
    expect(conversationSource.default).toContain('getClowderCatIdFromContactId')
    expect(conversationSource.default).toContain('cat_display_name')
    expect(messageSource.default).toContain('resolveClowderConversationName')
    expect(messageSource.default).toContain('item.name = resolveClowderConversationName')
  })
})
