import { describe, expect, it } from 'vitest'

describe('Clowder AI contact routing', () => {
  it('keeps the Clowder AI contact on normal IM/Clowder routing instead of the DeepSeek local assistant path', async () => {
    const source = await import('../src/components/MessageInput.vue?raw')

    expect(source.default).toContain("const CLOWDER_AI_ROBOT_ID = 'clowder_ai'")
    expect(source.default).toContain('isClowderAiConversation')
    expect(source.default).toContain('v-if="isClowderAiConversation"')
    expect(source.default).toContain('messageStore.sendMessage(props.channelId, props.channelType, text, options)')
    expect(source.default).not.toContain("props.channelId === DEEPSEEK_AI_ROBOT_ID || props.channelId === CLOWDER_AI_ROBOT_ID")
  })
})

