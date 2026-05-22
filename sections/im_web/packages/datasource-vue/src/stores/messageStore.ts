import { defineStore } from 'pinia';
import { ref } from 'vue';
import WKSDK, { Message as WKMessage } from 'wukongimjssdk';
import { syncApi } from '../api';
import { useConversationStore } from './conversationStore';
import { useUserStore } from './userStore';

export interface Message {
  messageID: string;
  messageSeq: number;
  clientMsgNo: string;
  fromUID: string;
  timestamp: number;
  content: any;
  isRevoked: boolean;
  revokeUID?: string;
  status: 'sending' | 'success' | 'fail';
  reactions?: any[];
  remoteExtra?: any;
}

export interface Reaction {
  emoji: string;
  count: number;
  users?: string[];
  [key: string]: any;
}

export const useMessageStore = defineStore('message', () => {
  const messages = ref<Record<string, Message[]>>({});
  const typingState = ref<Record<string, { timer: any; isTyping: boolean }>>({});

  const conversationStore = useConversationStore();
  const userStore = useUserStore();

  function getChannelMessages(channelId: string, channelType: number): Message[] {
    const key = `${channelId}-${channelType}`;
    return messages.value[key] || [];
  }

  function normalizeSyncedPayload(payload: any) {
    if (!payload) return {};
    if (typeof payload === 'object') return normalizeMessageContent(payload);
    if (typeof payload !== 'string') return {};

    try {
      return normalizeMessageContent(JSON.parse(payload));
    } catch (plainErr) {
      try {
        return normalizeMessageContent(JSON.parse(atob(payload)));
      } catch (base64Err) {
        console.warn('[MessageStore] Failed to decode synced message payload', base64Err || plainErr);
        return {};
      }
    }
  }

  function normalizeRemoteExtra(extra: any) {
    if (!extra) return undefined;
    return {
      ...extra,
      readed: extra.readed === 1 || extra.readed === true,
      revoke: extra.revoke === 1 || extra.revoke === true,
      readedCount: extra.readed_count || extra.readedCount || 0,
      unreadCount: extra.unread_count || extra.unreadCount || 0,
      revoker: extra.revoker
    };
  }

  function normalizeMessageContent(content: any) {
    if (!content || typeof content !== 'object') return {};

    const normalized = { ...content };
    if (normalized.type === 1 && normalized.text === undefined && normalized.content !== undefined) {
      normalized.text = normalized.content;
    }

    return normalized;
  }

  async function syncMessages(channelId: string, channelType: number) {
    const key = `${channelId}-${channelType}`;
    const list = messages.value[key] || [];
    const startSeq = list.length > 0 ? list[list.length - 1].messageSeq : 0;

    try {
      const res: any = await syncApi.syncMessages({
        channel_id: channelId,
        channel_type: channelType,
        limit: 30,
        start_message_seq: startSeq,
        end_message_seq: 0,
        pull_mode: 1
      });

      if (res && Array.isArray(res.messages)) {
        const synced: Message[] = res.messages.filter((item: any) => item.is_deleted !== 1).map((item: any) => {
          const remoteExtra = normalizeRemoteExtra(item.message_extra);

          return {
            messageID: String(item.message_idstr || item.message_id || ''),
            messageSeq: item.message_seq,
            clientMsgNo: item.client_msg_no,
            fromUID: item.from_uid,
            timestamp: item.timestamp,
            content: normalizeSyncedPayload(item.payload),
            isRevoked: item.revoke === 1 || item.is_revoked === 1 || remoteExtra?.revoke === true,
            revokeUID: remoteExtra?.revoker,
            status: 'success',
            reactions: item.reactions || [],
            remoteExtra
          };
        });

        const currentList = messages.value[key] || [];
        const mergedMap = new Map<string, Message>();
        currentList.forEach(m => mergedMap.set(m.clientMsgNo, m));
        synced.forEach(m => mergedMap.set(m.clientMsgNo, m));

        messages.value[key] = Array.from(mergedMap.values()).sort((a, b) => a.messageSeq - b.messageSeq);
      }
    } catch (e) {
      console.error(`[MessageStore] Failed to sync messages for channel ${key}`, e);
    }
  }

  function addMessage(channelId: string, channelType: number, msg: Message) {
    const key = `${channelId}-${channelType}`;
    if (!messages.value[key]) {
      messages.value[key] = [];
    }

    const idx = messages.value[key].findIndex(m => m.clientMsgNo === msg.clientMsgNo);
    if (idx !== -1) {
      messages.value[key][idx] = { ...messages.value[key][idx], ...msg };
    } else {
      messages.value[key].push(msg);
    }

    messages.value[key].sort((a, b) => a.messageSeq - b.messageSeq || a.timestamp - b.timestamp);

    conversationStore.addOrUpdateConversation(channelId, channelType, {
      messageSeq: msg.messageSeq,
      timestamp: msg.timestamp,
      fromUID: msg.fromUID,
      payload: msg.content,
      isOwnMessage: msg.fromUID === userStore.currentUser?.uid
    });
  }

  function normalizeContent(content: any) {
    if (!content) return {};
    if (typeof content.encodeJSON === 'function') {
      return normalizeMessageContent({
        type: content.contentType,
        ...content.encodeJSON()
      });
    }
    if (content.contentObj && typeof content.contentObj === 'object') {
      return normalizeMessageContent({
        type: content.contentType,
        ...content.contentObj
      });
    }
    return normalizeMessageContent(content);
  }

  function addRealtimeMessage(channelId: string, channelType: number, rawMessage: WKMessage) {
    const normalized: Message = {
      messageID: rawMessage.messageID,
      messageSeq: rawMessage.messageSeq,
      clientMsgNo: rawMessage.clientMsgNo,
      fromUID: rawMessage.fromUID,
      timestamp: rawMessage.timestamp,
      content: normalizeContent(rawMessage.content),
      isRevoked: rawMessage.remoteExtra?.revoke === true || rawMessage.isDeleted === true,
      revokeUID: rawMessage.remoteExtra?.revoker,
      status: rawMessage.status === 2 ? 'fail' : (rawMessage.status === 0 ? 'sending' : 'success'),
      reactions: rawMessage.reactions || [],
      remoteExtra: rawMessage.remoteExtra
    };
    addMessage(channelId, channelType, normalized);
  }

  async function revokeMessage(channelId: string, channelType: number, clientMsgNo: string, messageId: string) {
    try {
      await syncApi.revokeMessage({
        channel_id: channelId,
        channel_type: channelType,
        message_id: messageId,
        client_msg_no: clientMsgNo
      });

      handleMessageRevoked(channelId, channelType, clientMsgNo);
    } catch (e) {
      console.error('[MessageStore] Failed to revoke message', e);
    }
  }

  function handleMessageRevoked(channelId: string, channelType: number, clientMsgNo: string) {
    const key = `${channelId}-${channelType}`;
    const list = messages.value[key] || [];
    const msg = list.find(m => m.clientMsgNo === clientMsgNo);
    if (msg) {
      msg.isRevoked = true;
    }
  }

  function applyReactionToggle(msg: Message, emoji: string, uid: string) {
    if (!msg.reactions) {
      msg.reactions = [];
    }

    const reactions = msg.reactions as Reaction[];
    const existing = reactions.find(reaction => reaction.emoji === emoji);

    if (!existing) {
      reactions.push({
        emoji,
        count: 1,
        users: uid ? [uid] : []
      });
      return;
    }

    const users = Array.isArray(existing.users) ? existing.users : [];
    const hasReacted = uid ? users.includes(uid) : false;

    if (hasReacted) {
      existing.users = users.filter(user => user !== uid);
      existing.count = Math.max(0, Number(existing.count || 0) - 1);
    } else {
      existing.users = uid ? [...users, uid] : users;
      existing.count = Number(existing.count || 0) + 1;
    }

    msg.reactions = reactions.filter(reaction => Number(reaction.count || 0) > 0);
  }

  async function toggleReaction(channelId: string, channelType: number, msg: Message, emoji: string) {
    if (!msg.messageID) {
      throw new Error('Message ID is required to update reactions.');
    }

    await syncApi.addReaction({
      channel_id: channelId,
      channel_type: channelType,
      message_id: msg.messageID,
      emoji
    });

    applyReactionToggle(msg, emoji, userStore.currentUser?.uid || '');
  }

  function setTyping(channelId: string, channelType: number) {
    const key = `${channelId}-${channelType}`;

    if (typingState.value[key]?.timer) {
      clearTimeout(typingState.value[key].timer);
    }

    typingState.value[key] = {
      isTyping: true,
      timer: setTimeout(() => {
        typingState.value[key].isTyping = false;
      }, 3000)
    };
  }

  async function sendMessage(
    channelId: string, 
    channelType: number, 
    text: string, 
    options?: { 
      mention?: { all?: boolean; uids?: string[] }; 
      reply?: any 
    }
  ) {
    const clientMsgNo = Math.random().toString(36).substring(7);
    const fromUID = userStore.currentUser?.uid || '';

    const content = {
      type: 1, // Text message
      text: text,
      mention: options?.mention,
      reply: options?.reply
    };

    const tempMsg: Message = {
      messageID: '',
      messageSeq: 0,
      clientMsgNo,
      fromUID,
      timestamp: Math.floor(Date.now() / 1000),
      content,
      isRevoked: false,
      status: 'sending'
    };

    addMessage(channelId, channelType, tempMsg);

    try {
      const channel = WKSDK.shared().newChannel(channelId, channelType);
      const textMsg = WKSDK.shared().newMessageText(text);
      if (options?.mention) {
        textMsg.mention = options.mention;
      }
      if (options?.reply) {
        textMsg.reply = options.reply;
      }

      const res = await WKSDK.shared().chatManager.send(textMsg, channel);
      if (res) {
        tempMsg.status = 'success';
        tempMsg.messageID = res.messageID || '';
        tempMsg.messageSeq = res.messageSeq || 0;
        addMessage(channelId, channelType, tempMsg);
      }
    } catch (err) {
      tempMsg.status = 'fail';
      addMessage(channelId, channelType, tempMsg);
      throw err;
    }
  }

  const replyTarget = ref<Message | null>(null);

  function setReplyTarget(msg: Message | null) {
    replyTarget.value = msg;
  }

  return {
    messages,
    typingState,
    replyTarget,
    getChannelMessages,
    syncMessages,
    addMessage,
    revokeMessage,
    handleMessageRevoked,
    toggleReaction,
    setTyping,
    sendMessage,
    addRealtimeMessage,
    setReplyTarget
  };
});
