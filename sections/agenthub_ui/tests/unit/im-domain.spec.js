import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useConversationStore } from '../../stores/conversation.js';
import { useMessageStore } from '../../stores/message.js';
import { resetStorageForTests } from '../../utils/storage.js';
import { resetRequestRuntimeForTests, setRequestAdapter } from '../../utils/request.js';
import { createInboundMessage, toConversationItem } from '../../utils/im-mappers.js';

describe('IM domain mapping and stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetStorageForTests();
    resetRequestRuntimeForTests();
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

  it('persists drafts by uid and channel key', () => {
    const conversationStore = useConversationStore();
    conversationStore.setCurrentUid('u-1');
    conversationStore.addOrUpdateConversation('friend-a', 1, { name: '好友' });

    conversationStore.setDraft('friend-a', 1, '跨端草稿');

    expect(conversationStore.conversations[0].draft).toBe('跨端草稿');
    expect(conversationStore.getDraft('friend-a', 1)).toBe('跨端草稿');
  });
});
