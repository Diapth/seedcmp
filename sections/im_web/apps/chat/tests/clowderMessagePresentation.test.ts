import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import TextCell from '../../../packages/base-vue/src/components/messages/TextCell.vue'

vi.mock('@tsdaodao/base-vue', () => ({
  apiClient: {
    defaults: { baseURL: 'http://api.example/v1/' },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  },
  apiDelete: vi.fn(),
  StorageService: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn()
  }
}))

vi.mock('@tsdaodao/datasource-vue/api', () => ({
  syncApi: {
    syncMessages: vi.fn(),
    syncConversations: vi.fn(),
    syncConversationExtra: vi.fn(async () => []),
    updateConversationExtra: vi.fn(),
    clearUnread: vi.fn(),
    deleteConversation: vi.fn(),
    revokeMessage: vi.fn(),
    addReaction: vi.fn(),
    markReaded: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
    mutualDeleteMessage: vi.fn(),
    getMessageReceipt: vi.fn(),
    pinMessage: vi.fn(),
    syncPinnedMessages: vi.fn(),
    syncReminders: vi.fn(),
    doneReminders: vi.fn()
  },
  groupApi: {
    getMyGroups: vi.fn(async () => []),
    getGroupInfo: vi.fn(),
    getGroupMembers: vi.fn(),
    updateSetting: vi.fn()
  },
  commonApi: {
    getChannelInfo: vi.fn(async () => ({ name: 'Clowder AI', avatar: '', top: 0, mute: 0 }))
  }
}))

vi.mock('wukongimjssdk', () => ({
  default: {
    shared: () => ({
      register: vi.fn(),
      newChannel: vi.fn(),
      newMessageText: vi.fn((text: string) => ({ contentType: 1, contentObj: { text } })),
      chatManager: { send: vi.fn() }
    })
  },
  MessageContent: class {
    encode() {
      return new TextEncoder().encode(JSON.stringify({ type: this.contentType }))
    }
  },
  MediaMessageContent: class {},
  MessageImage: class {}
}))

describe('clowder message presentation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders Clowder connector and cat identity in text bubbles', async () => {
    const source = await import('../../../packages/base-vue/src/components/messages/TextCell.vue?raw')

    expect(source.default).toContain('clowder-meta')
    expect(source.default).toContain('catDisplayName')
    expect(source.default).toContain('connectorId')
    expect(source.default).toContain('Clowder')
  })

  it('keeps command responses in system-style messages', async () => {
    const source = await import('../../../packages/datasource-vue/src/stores/messageStore.ts?raw')

    expect(source.default).toContain('addClowderCommandResponse')
    expect(source.default).toContain('type: 1000')
    expect(source.default).toContain('connectorCommand')
  })

  it('renders Clowder thoughts, tool calls, tool results, and rich blocks inside the chat bubble', () => {
    render(TextCell, {
      props: {
        isMe: false,
        message: {
          fromUID: 'clowder:codex',
          content: {
            type: 1,
            text: '今天新闻整理完成。',
            connectorId: 'im-web',
            catId: 'codex',
            catDisplayName: 'Codex',
            format: 'markdown',
            markdown: true,
            metadata: {
              thinking: '先按国内、国际、科技三类筛选今天的新闻。',
              toolCalls: [
                { toolName: 'web_search', input: '今天 新闻' }
              ],
              toolResults: [
                { toolName: 'web_search', output: '检索到多条新闻来源' }
              ]
            },
            rich_blocks: [
              {
                id: 'rb-1',
                v: 1,
                kind: 'card',
                title: '工具调用',
                bodyMarkdown: 'web_search 已完成'
              }
            ]
          }
        }
      }
    })

    expect(document.querySelector('.clowder-transcript')).toBeTruthy()
    expect(document.querySelector('.clowder-thought')).toHaveTextContent('先按国内、国际、科技三类筛选今天的新闻。')
    expect(document.querySelector('.clowder-tool-call')).toHaveTextContent('web_search')
    expect(document.querySelector('.clowder-tool-result')).toHaveTextContent('检索到多条新闻来源')
    expect(document.querySelector('.clowder-rich-block')).toHaveTextContent('工具调用')
    expect(screen.getByText(/今天新闻整理完成/)).toBeInTheDocument()
  })

  it('renders streaming Clowder placeholders as thought transcript evidence', () => {
    render(TextCell, {
      props: {
        isMe: false,
        message: {
          fromUID: 'clowder_ai',
          content: {
            type: 1,
            text: '【Codex🐱】🤔 思考中...',
            connectorId: 'im-web',
            catId: 'codex',
            catDisplayName: 'Codex',
            format: 'markdown',
            markdown: true,
            streaming: true
          }
        }
      }
    })

    expect(document.querySelector('.clowder-thought')).toHaveTextContent('等待 Clowder 智能体输出')
  })

  it('renders all visible Clowder thought and transcript blocks from array aliases', () => {
    render(TextCell, {
      props: {
        isMe: false,
        message: {
          fromUID: 'clowder:news',
          content: {
            type: 1,
            text: '新闻整理完成。',
            connectorId: 'im-web',
            catDisplayName: '新闻猫',
            metadata: {
              thoughts: [
                '先搜索国内新闻。',
                { label: '国际', text: '再整理国际新闻。' }
              ],
              transcript: [
                { label: '科技', text: '最后筛选科技/AI 新闻。' },
                '输出摘要。'
              ]
            }
          }
        }
      }
    })

    const transcript = document.querySelector('.clowder-transcript')
    expect(transcript).toHaveTextContent('先搜索国内新闻。')
    expect(transcript).toHaveTextContent('再整理国际新闻。')
    expect(transcript).toHaveTextContent('最后筛选科技/AI 新闻。')
    expect(transcript).toHaveTextContent('输出摘要。')
  })

  it('message list builds AI copy text from body and visible Clowder transcript', async () => {
    const source = await import('../src/components/MessageList.vue?raw')

    expect(source.default).toContain('buildMessageCopyText')
    expect(source.default).toContain('visibleTranscriptText')
    expect(source.default).toContain('copyTextToClipboard')
  })

  it('preserves synced Clowder placeholder streaming state', async () => {
    const { syncApi } = await import('@tsdaodao/datasource-vue/api') as any
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    syncApi.syncMessages.mockResolvedValueOnce({
      messages: [{
        message_idstr: 'm-placeholder',
        message_seq: 11,
        client_msg_no: '',
        from_uid: 'clowder_ai',
        timestamp: 1780043000,
        payload: {
          type: 1,
          text: '【Codex🐱】🤔 思考中...',
          connector_id: 'im-web',
          streaming: true,
          stream: { state: 'placeholder' }
        }
      }]
    })

    const messageStore = useMessageStore()
    await messageStore.syncMessages('clowder_ai', 1)

    const [message] = messageStore.getChannelMessages('clowder_ai', 1)
    expect(message.content.streaming).toBe(true)
  })

  it('normalizes Clowder transcript aliases from outbound payloads', async () => {
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const messageStore = useMessageStore()

    messageStore.addMessage('clowder_ai', 1, {
      messageID: 'm-transcript',
      messageSeq: 9,
      clientMsgNo: 'clowder-transcript-1',
      fromUID: 'clowder:codex',
      timestamp: 1780022400,
      content: {
        type: 1,
        text: '完整任务完成。',
        connector_id: 'im-web',
        cat_id: 'codex',
        cat_display_name: 'Codex',
        rich_blocks: [
          { id: 'tool-card', v: 1, kind: 'card', title: '工具', bodyMarkdown: 'search' }
        ],
        metadata: {
          thinking: '需要联网整理新闻。',
          tool_calls: [{ name: 'web_search', input: 'today news' }],
          tool_results: [{ name: 'web_search', output: 'results' }]
        }
      },
      isRevoked: false,
      status: 'success'
    })

    const [message] = messageStore.getChannelMessages('clowder_ai', 1)
    expect(message.content.connectorId).toBe('im-web')
    expect(message.content.catId).toBe('codex')
    expect(message.content.catDisplayName).toBe('Codex')
    expect(message.content.richBlocks).toHaveLength(1)
    expect(message.content.metadata.toolCalls).toHaveLength(1)
    expect(message.content.metadata.toolResults).toHaveLength(1)
  })

  it('keeps user messages in the Clowder AI contact on the normal message path', async () => {
    const listSource = await import('../src/components/MessageList.vue?raw')
    const inputSource = await import('../src/components/MessageInput.vue?raw')

    expect(inputSource.default).toContain("const CLOWDER_AI_ROBOT_ID = 'clowder_ai'")
    expect(inputSource.default).toContain('if (isAiRobotConversation.value)')
    expect(inputSource.default).not.toContain('if (isAiRobotConversation.value || isClowderAiConversation.value)')
    expect(inputSource.default).toContain('messageStore.sendMessage(props.channelId, props.channelType, text, options)')
    expect(listSource.default).toContain('supportedMessageTypes = new Set([1')
    expect(listSource.default).toContain('function isMe(msg: any): boolean')
    expect(listSource.default).toContain("msg.fromUID === userStore.currentUser?.uid")
  })

  it('keeps file and image sending enabled for the Clowder AI contact', async () => {
    const inputSource = await import('../src/components/MessageInput.vue?raw')

    expect(inputSource.default).toContain('sendSelectedFile(file')
    expect(inputSource.default).toContain('messageStore.sendMediaMessage(props.channelId, props.channelType, file)')
    expect(inputSource.default).not.toContain('if (isClowderAiConversation.value) return')
  })
})
