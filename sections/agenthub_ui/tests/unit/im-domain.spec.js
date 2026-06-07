import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useContactStore } from '../../stores/contact.js';
import { useConversationStore } from '../../stores/conversation.js';
import { useMessageStore } from '../../stores/message.js';
import { resetStorageForTests } from '../../utils/storage.js';
import { resetRequestRuntimeForTests, setRequestAdapter } from '../../utils/request.js';
import { createInboundMessage, toConversationItem } from '../../utils/im-mappers.js';
import { isClowderConversation } from '../../utils/clowder-conversation.js';

const wkSdkMock = vi.hoisted(() => ({
  sendTextMessage: vi.fn(),
  sendTypingCommand: vi.fn()
}));

vi.mock('@/utils/wk-sdk.js', () => ({
  sendTextMessage: wkSdkMock.sendTextMessage,
  sendTypingCommand: wkSdkMock.sendTypingCommand
}));

describe('IM domain mapping and stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetStorageForTests();
    resetRequestRuntimeForTests();
    wkSdkMock.sendTextMessage.mockReset();
    wkSdkMock.sendTypingCommand.mockReset();
  });

  it('maps backend conversations to the existing agenthub visual contract', () => {
    const mapped = toConversationItem({
      channel_id: 'group-a',
      channel_type: 2,
      unread: 3,
      timestamp: 1780490000000,
      last_message: { content: { text: '收到' } },
      channel_name: '项目群',
      channel_logo: 'https://example.com/group.png',
      extra: { top: 1, mute: 0, draft: '稍后回复' }
    });

    expect(mapped).toMatchObject({
      id: 'group-a',
      type: 'group',
      name: '项目群',
      unread: 3,
      isPinned: true,
      isMuted: false,
      draft: '稍后回复'
    });
  });

  it('only treats explicit clowder conversations as clowder-capable', () => {
    expect(isClowderConversation({
      id: 'ordinary-group',
      channelType: 2,
      type: 'group',
      name: '普通测试群'
    })).toBe(false);

    expect(isClowderConversation({
      id: 'a0cd1e35f2c9494d9be852004641277a',
      channelType: 1,
      type: 'single',
      name: '测试员B'
    })).toBe(false);

    expect(isClowderConversation({
      id: 'clowder_cat:coordinator',
      channelType: 1,
      type: 'single'
    })).toBe(true);

    expect(isClowderConversation({
      id: 'project-group',
      channelType: 2,
      type: 'group',
      raw: { binding_id: 'bind-1' }
    })).toBe(true);
  });

  it('maps the real conversation/sync shape with users, recents and second timestamps', async () => {
    setRequestAdapter(async ({ url }) => {
      expect(url).toContain('/conversation/sync');
      return {
        status: 200,
        data: {
          conversations: [
            {
              channel_id: 'clowder_cat:coordinator',
              channel_type: 1,
              unread: 2,
              timestamp: 1780740778,
              last_msg_seq: 10,
              recents: [
                {
                  message_seq: 10,
                  from_uid: 'clowder_cat:coordinator',
                  timestamp: 1780740778,
                  payload: {
                    type: 1,
                    text: '我已创建项目群「V340项目群06101256」'
                  }
                },
                {
                  message_seq: 9,
                  from_uid: 'u-1',
                  timestamp: 1780740777,
                  payload: { type: 99 }
                }
              ]
            }
          ],
          users: [
            {
              uid: 'clowder_cat:coordinator',
              name: 'PM',
              avatar: 'https://example.com/pm.png',
              top: 1,
              mute: 0
            }
          ],
          groups: []
        }
      };
    });

    const conversationStore = useConversationStore();
    await conversationStore.fetchConversations();

    expect(conversationStore.conversations[0]).toMatchObject({
      id: 'clowder_cat:coordinator',
      type: 'single',
      name: 'PM',
      avatar: 'https://example.com/pm.png',
      unread: 2,
      lastMessage: '我已创建项目群「V340项目群06101256」',
      lastMessageSeq: 10,
      isPinned: true,
      isMuted: false
    });
    expect(conversationStore.conversations[0].lastTime).toBe(1780740778000);
  });

  it('uses friend sync as the direct conversation name fallback when users are omitted', async () => {
    setRequestAdapter(async ({ url }) => {
      if (url.includes('/conversation/sync')) {
        return {
          status: 200,
          data: {
            conversations: [
              {
                channel_id: 'friend-b',
                channel_type: 1,
                unread: 0,
                timestamp: 1780741200,
                recents: [
                  {
                    message_seq: 12,
                    from_uid: 'me',
                    timestamp: 1780741200,
                    payload: { type: 1, text: '真实留痕' }
                  }
                ]
              }
            ],
            users: [],
            groups: []
          }
        };
      }

      if (url.includes('/friend/sync')) {
        return {
          status: 200,
          data: [
            {
              uid: 'friend-b',
              name: '测试员B',
              avatar: 'https://example.com/b.png'
            }
          ]
        };
      }

      if (url.includes('/group/my')) {
        return { status: 200, data: [] };
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const conversationStore = useConversationStore();
    await conversationStore.fetchConversations();

    expect(conversationStore.conversations[0]).toMatchObject({
      id: 'friend-b',
      name: '测试员B',
      avatar: 'https://example.com/b.png',
      lastMessage: '真实留痕'
    });
  });

  it('refreshes stale friend cache before mapping direct conversation identities', async () => {
    const contactStore = useContactStore();
    contactStore.contacts = [{ id: 'u_10000', nickname: '系统账号', avatar: '' }];

    setRequestAdapter(async ({ url }) => {
      if (url.includes('/conversation/sync')) {
        return {
          status: 200,
          data: {
            conversations: [
              {
                channel_id: 'friend-b',
                channel_type: 1,
                timestamp: 1780741200,
                recents: [{ message_seq: 1, timestamp: 1780741200, payload: { type: 1, text: '旧缓存复现' } }]
              }
            ],
            users: [],
            groups: []
          }
        };
      }
      if (url.includes('/friend/sync')) {
        return {
          status: 200,
          data: [{ uid: 'friend-b', name: '测试员B', avatar: 'https://example.com/b.png' }]
        };
      }
      if (url.includes('/group/my')) {
        return { status: 200, data: [] };
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const conversationStore = useConversationStore();
    await conversationStore.fetchConversations();

    expect(conversationStore.conversations[0]).toMatchObject({
      id: 'friend-b',
      name: '测试员B',
      avatar: 'https://example.com/b.png'
    });
  });

  it('falls back to user profile lookup when conversation and friend sync omit channel identity', async () => {
    setRequestAdapter(async ({ url }) => {
      if (url.includes('/conversation/sync')) {
        return {
          status: 200,
          data: {
            conversations: [
              {
                channel_id: 'friend-b',
                channel_type: 1,
                timestamp: 1780741200,
                recents: [{ message_seq: 1, timestamp: 1780741200, payload: { type: 1, text: '资料兜底' } }]
              }
            ],
            users: [],
            groups: []
          }
        };
      }
      if (url.includes('/friend/sync')) {
        return { status: 200, data: [] };
      }
      if (url.includes('/users/friend-b')) {
        return {
          status: 200,
          data: { uid: 'friend-b', name: '测试员B', avatar: 'https://example.com/b.png' }
        };
      }
      if (url.includes('/group/my')) {
        return { status: 200, data: [] };
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const conversationStore = useConversationStore();
    await conversationStore.fetchConversations();

    expect(conversationStore.conversations[0]).toMatchObject({
      id: 'friend-b',
      name: '测试员B',
      avatar: 'https://example.com/b.png'
    });
  });

  it('adds my groups as conversations and hydrates their latest message summary', async () => {
    setRequestAdapter(async ({ url, data }) => {
      if (url.includes('/conversation/sync')) {
        return {
          status: 200,
          data: { conversations: [], users: [], groups: [] }
        };
      }

      if (url.includes('/group/my')) {
        return {
          status: 200,
          data: [
            {
              group_no: 'group-v340',
              name: 'V340项目群06101256',
              logo: 'https://example.com/group.png',
              top: 1,
              mute: 0,
              member_count: 3,
              created_at: '2026-06-06 10:12:57'
            }
          ]
        };
      }

      if (url.includes('/message/channel/sync')) {
        expect(data).toMatchObject({
          channel_id: 'group-v340',
          channel_type: 2,
          limit: 10
        });
        return {
          status: 200,
          data: {
            messages: [
              {
                message_seq: 3,
                timestamp: 1780740982,
                payload: { type: 1, text: '较早消息' }
              },
              {
                message_seq: 4,
                timestamp: 1780741021,
                payload: {
                  type: 8,
                  name: 'acceptance-result.json',
                  text: 'acceptance-result.json'
                }
              }
            ]
          }
        };
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const conversationStore = useConversationStore();
    await conversationStore.fetchConversations();

    expect(conversationStore.conversations[0]).toMatchObject({
      id: 'group-v340',
      type: 'group',
      name: 'V340项目群06101256',
      avatar: 'https://example.com/group.png',
      lastMessage: '[文件] acceptance-result.json',
      lastMessageSeq: 4,
      isPinned: true,
      memberCount: 3
    });
    expect(conversationStore.conversations[0].lastTime).toBe(1780741021000);
  });

  it('uses group created_at as fallback time when a group has no messages yet', async () => {
    setRequestAdapter(async ({ url }) => {
      if (url.includes('/conversation/sync')) {
        return { status: 200, data: { conversations: [], users: [], groups: [] } };
      }
      if (url.includes('/group/my')) {
        return {
          status: 200,
          data: [{ group_no: 'empty-group', name: '新群', created_at: '2026-06-06 10:12:57' }]
        };
      }
      if (url.includes('/message/channel/sync')) {
        return { status: 200, data: { messages: [] } };
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const conversationStore = useConversationStore();
    await conversationStore.fetchConversations();

    expect(conversationStore.conversations[0].lastTime).toBe(Date.parse('2026-06-06T10:12:57'));
  });

  it('deduplicates realtime messages and keeps the existing MessageBubble fields stable', () => {
    const messageStore = useMessageStore();
    const inbound = createInboundMessage({
      message_id: 'm-1',
      client_msg_no: 'c-1',
      from_uid: 'friend-a',
      from_name: '好友',
      timestamp: 1780491000000,
      content: { type: 'text', text: '真实消息' }
    });

    messageStore.addRealtimeMessage('friend-a', 1, inbound);
    messageStore.addRealtimeMessage('friend-a', 1, inbound);

    const list = messageStore.getMessages('friend-a');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'm-1', senderId: 'friend-a', content: '真实消息' });
  });

  it('preserves conversation identity when message hydration updates only message fields', () => {
    const conversationStore = useConversationStore();

    conversationStore.addOrUpdateConversation('friend-a', 1, {
      name: '测试员B',
      avatar: 'https://example.com/b.png',
      isPinned: true,
      isMuted: true
    });
    conversationStore.addOrUpdateConversation('friend-a', 1, {
      lastMessage: '最新留痕',
      lastMessageSeq: 4,
      lastTime: 1780741200000
    });

    expect(conversationStore.getConversation('friend-a', 1)).toMatchObject({
      name: '测试员B',
      avatar: 'https://example.com/b.png',
      isPinned: true,
      isMuted: true,
      lastMessage: '最新留痕',
      lastMessageSeq: 4
    });
  });

  it('hydrates the message bucket from conversation recents as a refresh fallback', () => {
    const conversationStore = useConversationStore();
    const messageStore = useMessageStore();

    const conversation = conversationStore.addOrUpdateConversation('friend-a', 1, {
      name: '测试员B',
      raw: {
        channel_id: 'friend-a',
        channel_type: 1,
        recents: [
          {
            message_id: 'recent-1',
            message_seq: 8,
            from_uid: 'friend-a',
            timestamp: 1780741200,
            payload: { type: 1, text: '刷新兜底消息' }
          }
        ]
      }
    });

    messageStore.hydrateFromConversationRecents(conversation);

    expect(messageStore.getMessages('friend-a', 1)).toEqual([
      expect.objectContaining({
        id: 'recent-1',
        content: '刷新兜底消息',
        messageSeq: 8
      })
    ]);
    expect(conversationStore.getConversation('friend-a', 1).name).toBe('测试员B');
  });

  it('hydrates one visible message from conversation summary when recents are missing', () => {
    const messageStore = useMessageStore();
    const conversation = {
      id: 'friend-a',
      channelId: 'friend-a',
      channelType: 1,
      name: '测试员B',
      lastMessage: '左侧摘要消息',
      lastMessageSeq: 11,
      lastTime: 1780741300000
    };

    messageStore.hydrateFromConversationRecents(conversation);

    expect(messageStore.getMessages('friend-a', 1)).toEqual([
      expect.objectContaining({
        content: '左侧摘要消息',
        messageSeq: 11
      })
    ]);
  });

  it('replaces the summary fallback with the real synced message by message sequence', () => {
    const messageStore = useMessageStore();
    messageStore.hydrateFromConversationRecents({
      id: 'friend-a',
      channelId: 'friend-a',
      channelType: 1,
      lastMessage: '同一条消息',
      lastMessageSeq: 12,
      lastTime: 1780741300000
    });

    messageStore.addRealtimeMessage('friend-a', 1, {
      message_id: 'real-12',
      message_seq: 12,
      from_uid: 'friend-a',
      timestamp: 1780741301,
      payload: { type: 1, text: '同一条消息' }
    });

    expect(messageStore.getMessages('friend-a', 1)).toHaveLength(1);
    expect(messageStore.getMessages('friend-a', 1)[0]).toMatchObject({
      id: 'real-12',
      messageSeq: 12,
      content: '同一条消息'
    });
  });

  it('provides display fallback messages from the conversation summary without waiting for hydration', () => {
    const messageStore = useMessageStore();

    const list = messageStore.getConversationPreviewMessages({
      id: 'friend-a',
      channelId: 'friend-a',
      channelType: 1,
      lastMessage: '首帧摘要',
      lastMessageSeq: 13,
      lastTime: 1780741400000
    });

    expect(list).toEqual([
      expect.objectContaining({
        content: '首帧摘要',
        messageSeq: 13
      })
    ]);
    expect(messageStore.getMessages('friend-a', 1)).toHaveLength(0);
  });

  it('prefers hydrated messages over conversation summary display fallback', () => {
    const messageStore = useMessageStore();
    messageStore.addRealtimeMessage('friend-a', 1, {
      message_id: 'real-13',
      message_seq: 13,
      from_uid: 'friend-a',
      timestamp: 1780741401,
      payload: { type: 1, text: '真实首帧' }
    });

    const list = messageStore.getConversationPreviewMessages({
      id: 'friend-a',
      channelId: 'friend-a',
      channelType: 1,
      lastMessage: '旧摘要',
      lastMessageSeq: 13,
      lastTime: 1780741400000
    });

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'real-13', content: '真实首帧' });
  });

  it('loads the latest visible history window from the conversation sequence', async () => {
    const conversationStore = useConversationStore();
    const messageStore = useMessageStore();
    conversationStore.addOrUpdateConversation('friend-a', 1, {
      name: '测试员B',
      lastMessage: '最新窗口消息',
      lastMessageSeq: 88,
      lastTime: 1780741500000
    });

    const requests = [];
    setRequestAdapter(async ({ url, data }) => {
      if (url.includes('/message/channel/sync')) {
        requests.push(data);
        return {
          status: 200,
          data: {
            messages: [
              {
                message_id: 'real-88',
                message_seq: 88,
                from_uid: 'friend-a',
                timestamp: 1780741500,
                payload: { type: 1, text: '最新窗口消息' }
              }
            ]
          }
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    await messageStore.syncMessages('friend-a', 1, { hydrateVisibleHistory: true, limit: 30 });

    expect(requests[0]).toMatchObject({
      channel_id: 'friend-a',
      channel_type: 1,
      start_message_seq: 88,
      pull_mode: 0
    });
    expect(messageStore.getMessages('friend-a', 1)).toEqual([
      expect.objectContaining({
        id: 'real-88',
        messageSeq: 88,
        content: '最新窗口消息'
      })
    ]);
  });

  it('still replaces a synthetic summary when visible history hydration runs', async () => {
    const conversationStore = useConversationStore();
    const messageStore = useMessageStore();
    const conversation = conversationStore.addOrUpdateConversation('friend-a', 1, {
      name: '测试员B',
      lastMessage: '摘要先显示',
      lastMessageSeq: 89,
      lastTime: 1780741510000
    });
    messageStore.hydrateFromConversationRecents(conversation);

    const requests = [];
    setRequestAdapter(async ({ url, data }) => {
      if (url.includes('/message/channel/sync')) {
        requests.push(data);
        return {
          status: 200,
          data: {
            messages: [
              {
                message_id: 'real-89',
                message_seq: 89,
                from_uid: 'friend-a',
                timestamp: 1780741510,
                payload: { type: 1, text: '真实消息替换摘要' }
              }
            ]
          }
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    await messageStore.syncMessages('friend-a', 1, { hydrateVisibleHistory: true, limit: 30 });

    expect(requests[0]).toMatchObject({
      start_message_seq: 89,
      pull_mode: 0
    });
    expect(messageStore.getMessages('friend-a', 1)).toHaveLength(1);
    expect(messageStore.getMessages('friend-a', 1)[0]).toMatchObject({
      id: 'real-89',
      content: '真实消息替换摘要',
      messageSeq: 89
    });
  });

  it('normalizes second timestamps on inbound messages for chat time display', () => {
    const inbound = createInboundMessage({
      message_id: 'm-second',
      from_uid: 'friend-a',
      timestamp: 1780740778,
      payload: { type: 1, text: '秒级时间' }
    });

    expect(inbound.time).toBe(1780740778000);
  });

  it('maps real deployment card payloads to deployment messages with channel context', () => {
    const inbound = createInboundMessage({
      message_id: 'm-deploy',
      from_uid: 'clowder_cat:coordinator',
      channel_id: 'project-group-1',
      channel_type: 2,
      timestamp: 1780740778,
      payload: {
        type: 7,
        cardType: 'deployment',
        title: '部署请求',
        status: 'pending_confirmation',
        deploymentRequestId: 'dep-1',
        deploymentRequest: {
          deploymentRequestId: 'dep-1',
          target: 'web',
          environment: 'preview'
        }
      }
    });

    expect(inbound).toMatchObject({
      type: 'deployment',
      content: '部署请求',
      deploymentRequestId: 'dep-1',
      channelId: 'project-group-1',
      channelType: 2
    });
    expect(inbound.deployment).toMatchObject({
      status: 'pending_confirmation',
      target: 'web',
      environment: 'preview'
    });
  });

  it('hydrates active backend deployment requests as local deployment card messages', () => {
    const messageStore = useMessageStore();

    const card = messageStore.addDeploymentRequestCard({
      id: 'dep-active',
      status: 'pending_confirmation',
      channelId: 'project-group-1',
      channelType: 2,
      originalText: 'V1-3 deployment proof',
      target: 'agenthub-ui',
      environment: 'preview'
    });

    expect(card).toMatchObject({
      id: 'deployment-card-dep-active',
      clientMsgNo: 'deployment-card-dep-active',
      type: 'deployment',
      content: 'V1-3 deployment proof',
      deploymentRequestId: 'dep-active',
      channelId: 'project-group-1',
      channelType: 2
    });
    expect(card.deployment).toMatchObject({
      requestId: 'dep-active',
      status: 'pending_confirmation',
      target: 'agenthub-ui',
      environment: 'preview'
    });
    expect(messageStore.getMessages('project-group-1', 2)).toHaveLength(1);

    messageStore.addDeploymentRequestCard({
      id: 'dep-active',
      status: 'running',
      channelId: 'project-group-1',
      channelType: 2,
      originalText: 'V1-3 deployment proof',
      target: 'agenthub-ui',
      environment: 'preview'
    });

    expect(messageStore.getMessages('project-group-1', 2)).toHaveLength(1);
    expect(messageStore.getMessages('project-group-1', 2)[0].deployment.status).toBe('running');
  });

  it('persists drafts by uid and channel key', () => {
    const conversationStore = useConversationStore();
    conversationStore.setCurrentUid('u-1');
    conversationStore.addOrUpdateConversation('friend-a', 1, { name: '好友' });

    conversationStore.setDraft('friend-a', 1, '跨端草稿');

    expect(conversationStore.conversations[0].draft).toBe('跨端草稿');
    expect(conversationStore.getDraft('friend-a', 1)).toBe('跨端草稿');
  });

  it('clears unread locally and posts the backend read cursor', async () => {
    const adapter = vi.fn(async () => ({ status: 200, data: { code: 0, data: {} } }));
    setRequestAdapter(adapter);
    const conversationStore = useConversationStore();
    conversationStore.addOrUpdateConversation('group-a', 2, {
      name: '项目群',
      unread: 5,
      lastMessageSeq: 42
    });

    await conversationStore.clearUnread('group-a', 2);

    expect(conversationStore.getConversation('group-a', 2).unread).toBe(0);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0][0].url).toContain('/coversation/clearUnread');
    expect(adapter.mock.calls[0][0].data).toMatchObject({
      channel_id: 'group-a',
      channel_type: 2,
      unread: 0,
      message_seq: 42
    });
  });

  it('skips remote draft sync for unchanged empty drafts', async () => {
    const adapter = vi.fn(async () => ({ status: 200, data: { code: 0, data: {} } }));
    setRequestAdapter(adapter);
    const conversationStore = useConversationStore();
    conversationStore.addOrUpdateConversation('friend-a', 1, { name: '好友', draft: '' });

    conversationStore.setDraft('friend-a', 1, '');
    await Promise.resolve();

    expect(adapter).not.toHaveBeenCalled();
  });

  it('keeps Clowder cat direct conversation drafts local', async () => {
    const adapter = vi.fn(async () => ({ status: 200, data: { code: 0, data: {} } }));
    setRequestAdapter(adapter);
    const conversationStore = useConversationStore();
    conversationStore.setCurrentUid('u-1');
    conversationStore.addOrUpdateConversation('clowder_cat:codex', 1, { name: 'qwq' });

    conversationStore.setDraft('clowder_cat:codex', 1, '本地草稿');
    await Promise.resolve();

    expect(conversationStore.getDraft('clowder_cat:codex', 1)).toBe('本地草稿');
    expect(adapter).not.toHaveBeenCalled();
  });

  it('marks optimistic text sends successful and clears pending after SDK send resolves', async () => {
    wkSdkMock.sendTextMessage.mockResolvedValue({
      clientSeq: 42,
      messageSeq: 108,
      messageID: 'server-message-108'
    });
    const conversationStore = useConversationStore();
    const messageStore = useMessageStore();
    conversationStore.addOrUpdateConversation('clowder_cat:codex', 1, { name: 'qwq' });

    const msg = await messageStore.sendMessage(
      'clowder_cat:codex',
      '真实发送',
      { id: 'u-1', name: '我' },
      'text'
    );

    expect(wkSdkMock.sendTextMessage).toHaveBeenCalledWith(expect.objectContaining({
      channelId: 'clowder_cat:codex',
      channelType: 1,
      text: '真实发送',
      clientMsgNo: msg.clientMsgNo
    }));
    expect(msg).toMatchObject({
      id: 'server-message-108',
      messageSeq: 108,
      clientSeq: 42,
      status: 'success'
    });
    expect(messageStore.pendingQueue[msg.clientMsgNo]).toBeUndefined();
  });

  it('rejects non-text sends until real upload-backed media sending is connected', async () => {
    const conversationStore = useConversationStore();
    const messageStore = useMessageStore();
    conversationStore.addOrUpdateConversation('friend-a', 1, { name: '好友' });

    await expect(messageStore.sendMessage(
      'friend-a',
      'https://example.com/fake.png',
      { id: 'u-1', name: '我' },
      'image'
    )).rejects.toMatchObject({
      code: 'MEDIA_SEND_UNAVAILABLE'
    });
    expect(wkSdkMock.sendTextMessage).not.toHaveBeenCalled();
    expect(messageStore.getMessages('friend-a')).toHaveLength(0);
  });

  it('applies realtime revoke by client message number without echoing a revoke request', async () => {
    const adapter = vi.fn(async () => ({ status: 200, data: { code: 0, data: {} } }));
    setRequestAdapter(adapter);
    const messageStore = useMessageStore();
    messageStore.addMessage('friend-a', {
      id: 'server-message-1',
      clientMsgNo: 'client-message-1',
      content: '可撤回消息',
      type: 'text',
      channelType: 1
    }, 1);

    const applied = messageStore.applyMessageRevoke('friend-a', 'client-message-1');

    expect(applied).toBe(true);
    expect(messageStore.getMessages('friend-a')[0]).toMatchObject({
      id: 'server-message-1',
      clientMsgNo: 'client-message-1',
      status: 'revoked',
      type: 'system',
      content: '你撤回了一条消息'
    });
    expect(adapter).not.toHaveBeenCalled();
  });

  it('sends local revoke with server id while matching by client message number', async () => {
    const adapter = vi.fn(async ({ url }) => {
      expect(url).toContain('/message/revoke?');
      expect(decodeURIComponent(url)).toContain('message_id=server-message-1');
      expect(decodeURIComponent(url)).toContain('client_msg_no=client-message-1');
      return { status: 200, data: { code: 0, data: {} } };
    });
    setRequestAdapter(adapter);
    const messageStore = useMessageStore();
    messageStore.addMessage('friend-a', {
      id: 'server-message-1',
      clientMsgNo: 'client-message-1',
      content: '本端撤回',
      type: 'text',
      channelType: 1
    }, 1);

    await messageStore.revokeMessage('friend-a', 'client-message-1');

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(messageStore.getMessages('friend-a')[0].status).toBe('revoked');
  });

  it('posts reactions with the message channel type', async () => {
    const adapter = vi.fn(async () => ({ status: 200, data: { code: 0, data: {} } }));
    setRequestAdapter(adapter);
    const messageStore = useMessageStore();
    messageStore.addMessage('group-a', {
      id: 'group-message-1',
      content: '群消息',
      type: 'text',
      channelType: 2,
      reactions: []
    }, 2);

    messageStore.reactMessage('group-a', 'group-message-1', '👍', 'u-1');

    expect(messageStore.getMessages('group-a')[0].reactions).toEqual([
      { emoji: '👍', userIds: ['u-1'], count: 1 }
    ]);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0][0].url).toContain('/reactions');
    expect(adapter.mock.calls[0][0].data).toMatchObject({
      channel_id: 'group-a',
      channel_type: 2,
      message_id: 'group-message-1',
      emoji: '👍'
    });
  });

  it('sends typing command for a real channel', async () => {
    wkSdkMock.sendTypingCommand.mockResolvedValue({});
    const messageStore = useMessageStore();

    await messageStore.sendTyping('group-a', 2);

    expect(wkSdkMock.sendTypingCommand).toHaveBeenCalledWith({
      channelId: 'group-a',
      channelType: 2
    });
  });
});
