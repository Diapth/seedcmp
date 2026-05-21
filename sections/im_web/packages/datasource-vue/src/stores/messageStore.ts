import { defineStore } from 'pinia';
import { ref } from 'vue';
import WKSDK from 'wukongimjssdk';
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
        const synced: Message[] = res.messages.map((item: any) => {
          let content = {};
          try {
            content = item.payload ? JSON.parse(atob(item.payload)) : {};
          } catch (err) {
            content = item.payload ? JSON.parse(item.payload) : {};
          }

          return {
            messageID: item.message_id,
            messageSeq: item.message_seq,
            clientMsgNo: item.client_msg_no,
            fromUID: item.from_uid,
            timestamp: item.timestamp,
            content,
            isRevoked: item.is_revoked === 1,
            status: 'success'
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
      payload: msg.content
    });
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
    setTyping,
    sendMessage,
    setReplyTarget
  };
});
