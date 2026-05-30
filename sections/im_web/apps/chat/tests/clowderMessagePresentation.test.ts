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
  useRemoteConfig: () => ({ remoteConfig: { value: { revoke_second: 120 } } }),
  ChannelAvatar: {
    props: ['name', 'avatar', 'size', 'isGroup'],
    template: '<div class="channel-avatar" :data-name="name" :data-avatar="avatar">{{ name }}</div>'
  },
  TextCell: { props: ['message', 'isMe'], template: '<div class="text-cell">{{ message.content?.text }}</div>' },
  TimeCell: { props: ['timestamp'], template: '<div class="time-cell">{{ timestamp }}</div>' },
  ImageCell: { template: '<div />' },
  SystemCell: { template: '<div />' },
  VoiceCell: { template: '<div />' },
  FileCell: { template: '<div />' },
  VideoCell: { template: '<div />' },
  GifCell: { template: '<div />' },
  StickerCell: { template: '<div />' },
  LocationCell: { template: '<div />' },
  CardCell: { template: '<div />' },
  MergeCell: { template: '<div />' },
  ContextMenu: { template: '<div />' },
  AppDialog: { template: '<div />' },
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

  it('uses Clowder cat identity for direct-cat message avatars instead of generic user cache fallback', async () => {
    const { default: MessageList } = await import('../src/components/MessageList.vue')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const { useChannelStore } = await import('../../../packages/datasource-vue/src/stores/channelStore.ts')
    const messageStore = useMessageStore()
    const userStore = useUserStore()
    const channelStore = useChannelStore()
    userStore.currentUser = { uid: 'me', name: 'Me' }
    userStore.userCache['clowder:opus'] = { uid: 'clowder:opus', name: 'Clowder', avatar: '' }
    channelStore.updateChannelInfo('clowder_cat:opus', 1, {
      name: '布偶猫',
      avatar: 'https://example.test/ragdoll.png'
    })

    messageStore.addMessage('clowder_cat:opus', 1, {
      messageID: 'm-ragdoll',
      messageSeq: 12,
      clientMsgNo: 'clowder-ragdoll',
      fromUID: 'clowder:opus',
      timestamp: 100,
      content: {
        type: 1,
        text: '【布偶猫🐱】思考中...',
        connectorId: 'im-web',
        streaming: true
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })

    render(MessageList, {
      props: {
        channelId: 'clowder_cat:opus',
        channelType: 1
      }
    })

    const avatar = document.querySelector('.msg-avatar.channel-avatar')
    expect(avatar).toHaveAttribute('data-name', '布偶猫')
    expect(avatar).toHaveAttribute('data-avatar', 'https://example.test/ragdoll.png')
  })

  it('keeps group Clowder cat replies from the current user transport sender on the assistant side', async () => {
    const { default: MessageList } = await import('../src/components/MessageList.vue')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const messageStore = useMessageStore()
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'creator', name: 'Creator' }
    userStore.userCache.creator = { uid: 'creator', name: 'Creator', avatar: '' }

    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'm-cat-group',
      messageSeq: 21,
      clientMsgNo: 'clowder-group-ragdoll',
      fromUID: 'creator',
      timestamp: 100,
      content: {
        type: 1,
        text: '【布偶猫🐱】收到，我能看到群聊上下文。',
        connectorId: 'im-web',
        catId: 'ragdoll-kn9a',
        catDisplayName: '布偶猫',
        markdown: true
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })

    render(MessageList, {
      props: {
        channelId: 'group-cat-cafe',
        channelType: 2
      }
    })

    expect(document.querySelector('.msg-row')?.classList.contains('is-me')).toBe(false)
    expect(document.querySelector('.msg-avatar.channel-avatar')).toHaveAttribute('data-name', '布偶猫')
  })

  it('does not fall back to the transport user avatar for group Clowder cat replies', async () => {
    const { default: MessageList } = await import('../src/components/MessageList.vue')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const messageStore = useMessageStore()
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'viewer', name: 'Viewer' }
    userStore.userCache.creator = {
      uid: 'creator',
      name: 'Creator',
      avatar: 'https://example.test/human-creator.png'
    }

    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'm-cat-group-no-avatar',
      messageSeq: 24,
      clientMsgNo: 'clowder-group-ragdoll-no-avatar',
      fromUID: 'creator',
      timestamp: 100,
      content: {
        type: 1,
        text: '【布偶猫🐱】我用猫猫身份回复。',
        connectorId: 'im-web',
        catId: 'ragdoll-kn9a',
        catDisplayName: '布偶猫',
        markdown: true
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })

    render(MessageList, {
      props: {
        channelId: 'group-cat-cafe',
        channelType: 2
      }
    })

    const avatar = document.querySelector('.msg-avatar.channel-avatar')
    expect(avatar).toHaveAttribute('data-name', '布偶猫')
    expect(avatar).toHaveAttribute('data-avatar', '')
  })

  it('uses nearby Clowder cat context for follow-up connector attachment messages without repeated cat metadata', async () => {
    const { default: MessageList } = await import('../src/components/MessageList.vue')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const messageStore = useMessageStore()
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'viewer', name: 'Viewer' }
    userStore.userCache.creator = {
      uid: 'creator',
      name: 'yunyi',
      avatar: 'https://example.test/yunyi.png'
    }

    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'm-cat-rich-text',
      messageSeq: 81,
      clientMsgNo: 'cat-rich-text',
      fromUID: 'creator',
      timestamp: 100,
      content: {
        type: 1,
        text: '文件刚才已经发到聊天里了。',
        connectorId: 'im-web',
        catId: 'ragdoll-kn9a',
        catDisplayName: '布偶猫',
        markdown: true
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })
    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'm-cat-file-followup',
      messageSeq: 82,
      clientMsgNo: 'cat-file-followup',
      fromUID: 'creator',
      timestamp: 100,
      content: {
        type: 1,
        text: 'ordering-demo.tar.gz',
        connectorId: 'im-web',
        markdown: true
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })

    render(MessageList, {
      props: {
        channelId: 'group-cat-cafe',
        channelType: 2
      }
    })

    const labels = [...document.querySelectorAll('.user-name-label')].map(item => item.textContent?.trim())
    const avatars = [...document.querySelectorAll('.msg-avatar.channel-avatar')]
    expect(labels).toEqual(['布偶猫', '布偶猫'])
    expect(avatars[1]).toHaveAttribute('data-name', '布偶猫')
    expect(avatars[1]).toHaveAttribute('data-avatar', '')
  })

  it('infers group Clowder cat identity from final reply suffix when transport sender is current user', async () => {
    const { default: MessageList } = await import('../src/components/MessageList.vue')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const messageStore = useMessageStore()
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'creator', name: 'Creator' }
    userStore.userCache.creator = { uid: 'creator', name: 'Creator', avatar: '' }

    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'm-cat-group-final',
      messageSeq: 22,
      clientMsgNo: 'clowder-group-ragdoll-final',
      fromUID: 'creator',
      timestamp: 100,
      content: {
        type: 1,
        text: '收到，猫群自动测试通过。[布偶猫/宪宪 deepseek-v4-flash]',
        connectorId: 'im-web',
        markdown: true
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })

    render(MessageList, {
      props: {
        channelId: 'group-cat-cafe',
        channelType: 2
      }
    })

    expect(document.querySelector('.msg-row')?.classList.contains('is-me')).toBe(false)
    expect(document.querySelector('.msg-avatar.channel-avatar')).toHaveAttribute('data-name', '布偶猫')
    expect(document.querySelector('.user-name-label')).toHaveTextContent('布偶猫')
  })

  it('infers group Clowder cat identity from Clowder slash signatures inside final reply text', async () => {
    const { default: MessageList } = await import('../src/components/MessageList.vue')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const messageStore = useMessageStore()
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'creator', name: 'Creator' }
    userStore.userCache.creator = { uid: 'creator', name: 'Creator', avatar: '' }

    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'm-cat-group-slash-final',
      messageSeq: 23,
      clientMsgNo: 'clowder-group-ragdoll-slash-final',
      fromUID: 'creator',
      timestamp: 100,
      content: {
        type: 1,
        text: '布偶猫/宪宪已收到群聊消息 ✅ [宪宪/deepseek-v4-flash🐾]',
        connectorId: 'im-web',
        markdown: true
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })

    render(MessageList, {
      props: {
        channelId: 'group-cat-cafe',
        channelType: 2
      }
    })

    expect(document.querySelector('.msg-avatar.channel-avatar')).toHaveAttribute('data-name', '布偶猫')
    expect(document.querySelector('.user-name-label')).toHaveTextContent('布偶猫')
  })

  it('prefers final reply signatures over incidental slash text for group cat sender labels', async () => {
    const { default: MessageList } = await import('../src/components/MessageList.vue')
    const { useMessageStore } = await import('../../../packages/datasource-vue/src/stores/messageStore.ts')
    const { useUserStore } = await import('../../../packages/datasource-vue/src/stores/userStore.ts')
    const messageStore = useMessageStore()
    const userStore = useUserStore()
    userStore.currentUser = { uid: 'viewer', name: 'Viewer' }
    userStore.userCache.creator = { uid: 'creator', name: 'yunyi', avatar: 'https://example.test/yunyi.png' }

    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'm-ragdoll-incidental-slash',
      messageSeq: 56,
      clientMsgNo: 'ragdoll-incidental-slash',
      fromUID: 'creator',
      timestamp: 100,
      content: {
        type: 1,
        text: '你好呀！这里要确认：是给餐厅/食堂用的真实点餐系统？\n[布偶猫/宪宪🐾 deepseek-v4-flash]',
        connectorId: 'im-web',
        markdown: true
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })
    messageStore.addMessage('group-cat-cafe', 2, {
      messageID: 'm-codex-incidental-mention-slash',
      messageSeq: 58,
      clientMsgNo: 'codex-incidental-mention-slash',
      fromUID: 'creator',
      timestamp: 101,
      content: {
        type: 1,
        text: '知道呀，我刚读完整个 thread。铲屎官让 @ragdoll-kn9a（布偶猫/宪宪）做一个桌面 Web 点餐 demo。[Codex/deepseek-v4-flash🐾]',
        connectorId: 'im-web',
        markdown: true
      },
      isRevoked: false,
      status: 'success'
    }, { countUnread: false })

    render(MessageList, {
      props: {
        channelId: 'group-cat-cafe',
        channelType: 2
      }
    })

    const labels = [...document.querySelectorAll('.user-name-label')].map(item => item.textContent?.trim())
    const avatars = [...document.querySelectorAll('.msg-avatar.channel-avatar')]
    expect(labels).toEqual(['布偶猫', 'Codex'])
    expect(avatars[0]).toHaveAttribute('data-name', '布偶猫')
    expect(avatars[1]).toHaveAttribute('data-name', 'Codex')
  })

  it('infers the Clowder bubble cat label from a final reply suffix', () => {
    render(TextCell, {
      props: {
        isMe: false,
        message: {
          fromUID: 'creator',
          content: {
            type: 1,
            text: '收到，猫群自动测试通过。[布偶猫/宪宪 deepseek-v4-flash]',
            connectorId: 'im-web',
            markdown: true
          }
        }
      }
    })

    expect(document.querySelector('.clowder-cat')).toHaveTextContent('布偶猫')
  })

  it('infers the Clowder bubble cat label from a slash signature in final reply text', () => {
    render(TextCell, {
      props: {
        isMe: false,
        message: {
          fromUID: 'creator',
          content: {
            type: 1,
            text: '布偶猫/宪宪已收到群聊消息 ✅ [宪宪/deepseek-v4-flash🐾]',
            connectorId: 'im-web',
            markdown: true
          }
        }
      }
    })

    expect(document.querySelector('.clowder-cat')).toHaveTextContent('布偶猫')
  })

  it('prefers final reply signatures over incidental slash text for Clowder bubble labels', () => {
    render(TextCell, {
      props: {
        isMe: false,
        message: {
          fromUID: 'creator',
          content: {
            type: 1,
            text: '知道呀，我刚读完整个 thread。铲屎官让 @ragdoll-kn9a（布偶猫/宪宪）做一个桌面 Web 点餐 demo。[Codex/deepseek-v4-flash🐾]',
            connectorId: 'im-web',
            markdown: true
          }
        }
      }
    })

    expect(document.querySelector('.clowder-cat')).toHaveTextContent('Codex')
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
