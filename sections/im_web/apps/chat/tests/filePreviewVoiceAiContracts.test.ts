import { describe, expect, it } from 'vitest'

describe('file preview, voice sending, and AI markdown contracts', () => {
  it('file cells delegate document preview to the chat side preview instead of opening an internal dialog', async () => {
    const source = await import('../../../packages/base-vue/src/components/messages/FileCell.vue?raw')
    const list = await import('../src/components/MessageList.vue?raw')
    const chat = await import('../src/views/ChatView.vue?raw')

    expect(source.default).toContain('previewKind')
    expect(source.default).toContain("defineEmits")
    expect(source.default).toContain("emit('preview'")
    expect(source.default).not.toContain('preview-dialog')
    expect(source.default).not.toContain('previewVisible')
    expect(source.default).toContain('markdown')
    expect(source.default).toContain('office')
    expect(list.default).toContain("defineEmits")
    expect(list.default).toContain("@preview=\"handleFilePreview\"")
    expect(list.default).toContain("emit('open-preview'")
    expect(chat.default).toContain('ChatSidePreview')
    expect(chat.default).toContain('@open-preview="handleOpenPreview"')
    expect(chat.default).toContain('sidePreview')
  })

  it('text cells render marked AI replies with copyable code blocks and HTML preview actions', async () => {
    const source = await import('../../../packages/base-vue/src/components/messages/TextCell.vue?raw')
    const markdownSource = await import('../../../packages/base-vue/src/utils/markdown.ts?raw')
    const markdown = await import('../../../packages/base-vue/src/utils/markdown.ts')

    expect(source.default).toContain('renderMarkdown')
    expect(source.default).toContain('isMarkdown')
    expect(source.default).toContain('v-html')
    expect(source.default).toContain('markdown-body')
    expect(source.default).toContain('handleMarkdownClick')
    expect(markdownSource.default).toContain('data-code-action="copy"')
    expect(source.default).toContain("emit('preview-code'")

    const html = markdown.renderMarkdown('```html\n<h1>Hello</h1>\n<script>alert(1)</script>\n```')
    expect(html).toContain('markdown-code-block')
    expect(html).toContain('data-code-action="copy"')
    expect(html).toContain('data-code-action="preview-html"')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('chat side preview renders files and AI HTML in the right-side workspace', async () => {
    const source = await import('../src/components/ChatSidePreview.vue?raw')

    expect(source.default).toContain('file-markdown')
    expect(source.default).toContain('file-html')
    expect(source.default).toContain('ai-html')
    expect(source.default).toContain('htmlPreviewSandbox')
    expect(source.default).toContain("sandbox=\"allow-scripts\"")
    expect(source.default).toContain('preview-panel')
    expect(source.default).toContain('openExternal')
    expect(source.default).toContain("emit('close')")
  })

  it('message store can encode and send voice messages', async () => {
    const contentTypes = await import('../../../packages/datasource-vue/src/contentTypes/index.ts?raw')
    const store = await import('../../../packages/datasource-vue/src/stores/messageStore.ts?raw')

    expect(contentTypes.default).toContain('constructor(url?: string, time?: number)')
    expect(contentTypes.default).toContain('get contentType(): number')
    expect(contentTypes.default).toContain('return 4')
    expect(contentTypes.default).toContain('encodeJSON()')
    expect(store.default).toContain("kind: 'voice'")
    expect(store.default).toContain('sendVoiceMessage')
    expect(store.default).toContain('new MessageVoice')
  })

  it('message input exposes recorder controls and AI assistant action without key leakage', async () => {
    const input = await import('../src/components/MessageInput.vue?raw')
    const vite = await import('../vite.config.ts?raw')
    const api = await import('../../../packages/datasource-vue/src/api/index.ts?raw')

    expect(input.default).toContain('startVoiceRecording')
    expect(input.default).toContain('stopVoiceRecording')
    expect(input.default).toContain('sendAiAssistant')
    expect(input.default).toContain('MediaRecorder')
    expect(input.default).toContain('messageStore.sendVoiceMessage')
    expect(api.default).toContain('requestAiReply')
    expect(api.default).toContain('requestAiReplyStream')
    expect(api.default).toContain('parseAiStreamLine')
    expect(input.default).toContain('appendAiReplyStreamChunk')
    expect(input.default).toContain('updateMessageStatus(aiMessageClientMsgNo')
    expect(input.default).toContain('removeMessageByClientMsgNo(aiMessageClientMsgNo)')
    expect(api.default).toContain("`${String(apiClient.defaults?.baseURL || '/v1/').replace(/\\/$/, '')}/robot/ai_reply`")
    expect(api.default).not.toContain("window.location.port === '3000'")
    expect(vite.default).not.toContain('DEEPSEEK_API_KEY')
    expect(vite.default).not.toContain('api.deepseek.com')
    expect(vite.default).not.toContain('persisted: false')
    expect(input.default).not.toContain('DEEPSEEK_API_KEY')
    expect(api.default).not.toContain('DEEPSEEK_API_KEY')
  })

  it('contacts expose DeepSeek AI as an independent robot account instead of a system account query mode', async () => {
    const contacts = await import('../../../packages/contacts-vue/src/views/ContactList.vue?raw')
    const input = await import('../src/components/MessageInput.vue?raw')

    expect(contacts.default).toContain("DEEPSEEK_AI_ROBOT_ID = 'deepseek_ai_robot'")
    expect(contacts.default).toContain('handleDeepSeekRobot')
    expect(contacts.default).toContain('`/chat/conversation/${DEEPSEEK_AI_ROBOT_ID}/1`')
    expect(contacts.default).toContain('DeepSeek AI')
    expect(contacts.default).toContain('机器人')
    expect(input.default).toContain('isAiRobotConversation')
    expect(input.default).toContain('props.channelId === DEEPSEEK_AI_ROBOT_ID')
    expect(input.default).toContain('await sendAiAssistant(text)')
    expect(input.default).toContain('inputText.value = \'\'')
    expect(contacts.default).not.toContain('robot=${DEEPSEEK_AI_CONTACT_ID}')
    expect(input.default).not.toContain("route.query.robot === 'deepseek'")
  })

  it('AI SSE parser extracts incremental markdown chunks and completion metadata', async () => {
    const { parseAiStreamLine } = await import('../../../packages/datasource-vue/src/api/index.ts')

    expect(parseAiStreamLine('data: {"delta":"# 标题"}')).toEqual({ delta: '# 标题' })
    expect(parseAiStreamLine('data: {"content":"\\n正文"}')).toEqual({ delta: '\n正文' })
    expect(parseAiStreamLine('data: {"done":true,"message_id":"42","message_seq":9}')).toEqual({
      done: true,
      message_id: '42',
      message_seq: 9
    })
    expect(parseAiStreamLine('data: [DONE]')).toEqual({ done: true })
    expect(parseAiStreamLine(': keep-alive')).toBeNull()
  })

  it('conversation clearUnread skips remote calls for brand-new empty robot conversations', async () => {
    const source = await import('../../../packages/datasource-vue/src/stores/conversationStore.ts?raw')

    expect(source.default).toContain('isBrandNewEmptyConversation')
    expect(source.default).toContain("channelId === 'deepseek_ai_robot'")
    expect(source.default).toContain('return;')
  })
})
