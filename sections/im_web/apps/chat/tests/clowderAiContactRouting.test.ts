import { describe, expect, it } from 'vitest'

describe('Clowder AI contact routing', () => {
  it('keeps the Clowder AI contact on normal IM/Clowder routing instead of the DeepSeek local assistant path', async () => {
    const source = await import('../src/components/MessageInput.vue?raw')

    expect(source.default).toContain("const CLOWDER_AI_ROBOT_ID = 'clowder_ai'")
    expect(source.default).toContain('isClowderAiContactId')
    expect(source.default).toContain('isClowderAiConversation')
    expect(source.default).toContain('v-if="isClowderAiConversation"')
    expect(source.default).toContain('messageStore.sendMessage(props.channelId, props.channelType, text, options)')
    expect(source.default).toContain('clowderStore.sendConversationMessage')
    expect(source.default).toContain('sendClowderRouteMessage')
    expect(source.default).toContain('scheduleClowderConversationSync')
    expect(source.default).toContain('300000')
    expect(source.default).not.toContain("props.channelId === DEEPSEEK_AI_ROBOT_ID || props.channelId === CLOWDER_AI_ROBOT_ID")
  })

  it('routes direct Clowder cat contacts and includes mixed group prompt context for cat mentions', async () => {
    const source = await import('../src/components/MessageInput.vue?raw')

    expect(source.default).toContain('isClowderCatConversation')
    expect(source.default).toContain('getClowderCatIdFromContactId')
    expect(source.default).toContain('catMentionMembers')
    expect(source.default).toContain('filteredMentionTargets')
    expect(source.default).toContain('clowderPromptContext')
    expect(source.default).toContain('targetCatIds')
    expect(source.default).toContain('clowderStore.sendConversationMessage')
  })

  it('loads group cat memberships from the chat input before showing mention targets', async () => {
    const source = await import('../src/components/MessageInput.vue?raw')

    expect(source.default).toContain('ensureGroupMentionMembersLoaded')
    expect(source.default).toContain('clowderStore.loadGroupCats(props.channelId)')
    expect(source.default).toContain('void ensureGroupMentionMembersLoaded()')
  })
})
