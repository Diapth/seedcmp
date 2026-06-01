import { describe, expect, it } from 'vitest'

describe('V3 Clowder smoke conversation selection contracts', () => {
  it('exposes channel metadata in the conversation list for live smoke selectors', async () => {
    const source = await import('../src/views/ConversationList.vue?raw')

    expect(source.default).toContain(':data-channel-id="conv.channel_id"')
    expect(source.default).toContain(':data-channel-type="conv.channel_type"')
  })

  it('exposes message persistence metadata for reload smoke waits', async () => {
    const source = await import('../src/components/MessageList.vue?raw')
    const chatView = await import('../src/views/ChatView.vue?raw')

    expect(source.default).toContain(':data-message-status="item.msg.status"')
    expect(source.default).toContain(':data-message-seq="item.msg.messageSeq"')
    expect(chatView.default).toContain('scheduleVisibleHistoryRefresh')
    expect(chatView.default).toContain('hydrateVisibleHistory: true')
  })

  it('does not let direct and V2 smoke fall back to the first visible group conversation', async () => {
    const source = await import('../tests-e2e/helpers/v3-clowder.ts?raw')

    expect(source.default).toContain('[data-channel-type="1"]')
    expect(source.default).toContain('Clowder AI')
    expect(source.default).toContain('DeepSeek AI')
    expect(source.default).toContain('文件传输助手')
    expect(source.default).toContain('草稿')
    expect(source.default).toContain('preferredV2ConversationNames')
    expect(source.default).toContain("'123'")
    expect(source.default).toContain('TestFriend2')
    expect(source.default).toContain('TestFriend')
    expect(source.default).toContain('waitForSentMessagePersisted')
    expect(source.default).toContain('data-message-status')
    expect(source.default).not.toContain('digestVisible')
    expect(source.default).toContain('non-Clowder direct conversation')
  })

  it('keeps live smoke waits aligned with slow Clowder replies and multi-hop routing text', async () => {
    const binding = await import('../tests-e2e/smoke-v3-clowder-binding.spec.ts?raw')
    const multiAgent = await import('../tests-e2e/smoke-v3-clowder-multi-agent.spec.ts?raw')
    const streaming = await import('../tests-e2e/smoke-v3-clowder-streaming-media.spec.ts?raw')

    expect(binding.default).toContain('test.describe.configure({ timeout: 180000 })')
    expect(binding.default).toContain('Second-account group visibility check skipped')
    expect(multiAgent.default).toContain('test.describe.configure({ timeout: 180000 })')
    expect(streaming.default).toContain('test.describe.configure({ timeout: 180000 })')
    expect(multiAgent.default).toContain('expectClowderReplyContaining')
    expect(multiAgent.default).not.toContain("locator('.message-list .clowder-cat').last()).toContainText(new RegExp(normalizedAgentB")
  })
})
