import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@tsdaodao/contacts-vue', () => ({
  useRobotConfigStore: () => ({ enabledConfigs: [] })
}))

vi.mock('wukongimjssdk', () => ({
  default: {
    shared: () => ({
      newChannel: vi.fn((channelId: string, channelType: number) => ({ channelId, channelType })),
      newMessageText: vi.fn((text: string) => ({ contentType: 1, contentObj: { text } })),
      chatManager: {
        send: vi.fn(async () => ({ messageID: 'sent', messageSeq: 1 }))
      }
    })
  },
  CMDContent: class {
    cmd = ''
    param = {}
  },
  MessageContent: class {
    contentType = 1
    encode() {
      return new TextEncoder().encode(JSON.stringify({ type: this.contentType }))
    }
  },
  MediaMessageContent: class {},
  MessageImage: class {
    url = ''
  },
  MessageFile: class {
    constructor(public url: string, public name: string, public size: number) {}
  }
}))

describe('Clowder AI contact routing', () => {
  beforeEach(() => {
    cleanup()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

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

  it('shows mention targets when @ is typed in the middle or at the end of a group draft', async () => {
    const { default: MessageInput } = await import('../src/components/MessageInput.vue')
    const { useGroupStore } = await import('../../../packages/datasource-vue/src/stores/groupStore.ts')
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const groupStore = useGroupStore()
    const clowderStore = useClowderStore()
    groupStore.groupMembers['group-cat-cafe'] = [{
      uid: 'human-1',
      member_uid: 'human-1',
      name: 'Human',
      display_name: 'Human',
      role_label: '成员'
    }]
    clowderStore.groupCatMemberships['group-cat-cafe'] = [{
      id: 'clowder_cat:ragdoll-kn9a',
      catId: 'ragdoll-kn9a',
      displayName: '布偶猫',
      aliases: ['@布偶猫'],
      mentionNames: ['@布偶猫'],
      avatar: '',
      personalitySummary: '',
      capabilitySummary: '',
      available: true,
      availabilityState: 'available',
      source: 'existing',
      connected: true
    }]

    render(MessageInput, {
      props: {
        channelId: 'group-cat-cafe',
        channelType: 2
      }
    })

    const textarea = screen.getByPlaceholderText('输入消息，Enter 发送，Ctrl+Enter 换行') as HTMLTextAreaElement
    await fireEvent.update(textarea, '你好@')
    await waitFor(() => expect(screen.getByText('布偶猫')).toBeInTheDocument())

    await fireEvent.update(textarea, '请@布偶')
    await waitFor(() => expect(screen.getByText('布偶猫')).toBeInTheDocument())
  })

  it('closes the mention popup after inserting a selected target', async () => {
    const { default: MessageInput } = await import('../src/components/MessageInput.vue')
    const { useGroupStore } = await import('../../../packages/datasource-vue/src/stores/groupStore.ts')
    const { useClowderStore } = await import('../../../packages/datasource-vue/src/stores/clowderStore.ts')
    const groupStore = useGroupStore()
    const clowderStore = useClowderStore()
    groupStore.groupMembers['group-cat-cafe'] = [{
      uid: 'human-1',
      member_uid: 'human-1',
      name: 'Human',
      display_name: 'Human',
      role_label: '成员'
    }]
    clowderStore.groupCatMemberships['group-cat-cafe'] = [{
      id: 'clowder_cat:ragdoll-kn9a',
      catId: 'ragdoll-kn9a',
      displayName: '布偶猫',
      aliases: ['@布偶猫'],
      mentionNames: ['@布偶猫'],
      avatar: '',
      personalitySummary: '',
      capabilitySummary: '',
      available: true,
      availabilityState: 'available',
      source: 'existing',
      connected: true
    }]

    render(MessageInput, {
      props: {
        channelId: 'group-cat-cafe',
        channelType: 2
      }
    })

    const textarea = screen.getByPlaceholderText('输入消息，Enter 发送，Ctrl+Enter 换行') as HTMLTextAreaElement
    await fireEvent.update(textarea, '你好 @')
    const option = await screen.findByText('布偶猫')
    await fireEvent.click(option)

    await waitFor(() => expect(screen.queryByText('布偶猫')).not.toBeInTheDocument())
    expect(textarea.value).toBe('你好 @布偶猫 ')
  })
})
