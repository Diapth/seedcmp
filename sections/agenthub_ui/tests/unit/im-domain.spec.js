import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationStore } from '../../stores/conversation.js';
import { useMessageStore } from '../../stores/message.js';
import { resetStorageForTests } from '../../utils/storage.js';
import { resetRequestRuntimeForTests, setRequestAdapter } from '../../utils/request.js';
import { createInboundMessage, toConversationItem } from '../../utils/im-mappers.js';

const wkSdkMock = vi.hoisted(() => ({
  sendTextMessage: vi.fn()
}));

vi.mock('@/utils/wk-sdk.js', () => ({
  sendTextMessage: wkSdkMock.sendTextMessage
}));

describe('IM domain mapping and stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetStorageForTests();
    resetRequestRuntimeForTests();
    wkSdkMock.sendTextMessage.mockReset();
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

  it('normalizes second timestamps on inbound messages for chat time display', () => {
    const inbound = createInboundMessage({
      message_id: 'm-second',
      from_uid: 'friend-a',
      timestamp: 1780740778,
      payload: { type: 1, text: '秒级时间' }
    });

    expect(inbound.time).toBe(1780740778000);
  });

  it('persists drafts by uid and channel key', () => {
    const conversationStore = useConversationStore();
    conversationStore.setCurrentUid('u-1');
    conversationStore.addOrUpdateConversation('friend-a', 1, { name: '好友' });

    conversationStore.setDraft('friend-a', 1, '跨端草稿');

    expect(conversationStore.conversations[0].draft).toBe('跨端草稿');
    expect(conversationStore.getDraft('friend-a', 1)).toBe('跨端草稿');
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
});
