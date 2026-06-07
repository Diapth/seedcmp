import { useConversationStore } from '@/stores/conversation.js';
import { useMessageStore } from '@/stores/message.js';

function parseSdkMessage(message = {}) {
  return {
    message_id: message.messageID || message.messageId || message.id,
    client_msg_no: message.clientMsgNo || message.client_msg_no,
    message_seq: message.messageSeq || message.message_seq,
    from_uid: message.fromUID || message.from_uid,
    timestamp: message.timestamp || Date.now(),
    content: message.content || message.payload || { text: message.text || '' },
    status: 'success',
    raw: message
  };
}

export function registerMessageListeners(sdk) {
  const shared = sdk?.shared ? sdk.shared() : sdk;
  const chatManager = shared?.chatManager;
  if (!chatManager?.addMessageListener) return false;

  chatManager.addMessageListener((message) => {
    const channel = message?.channel;
    if (!channel) {
      console.warn('[MSG_DROP]', { reason: 'missing_channel', message });
      return;
    }
    if (message?.header?.noPersist) {
      console.warn('[MSG_DROP]', { reason: 'no_persist', message });
      return;
    }
    useMessageStore().addRealtimeMessage(channel.channelID, channel.channelType, parseSdkMessage(message));
  });

  if (chatManager.addMessageStatusListener) {
    chatManager.addMessageStatusListener((ack) => {
      const messageStore = useMessageStore();
      const pending = Object.values(messageStore.pendingQueue).find((item) => item.clientSeq === ack.clientSeq || item.clientMsgNo === ack.clientMsgNo);
      if (!pending) return;
      pending.status = ack.reasonCode === 1 ? 'success' : 'failed';
      pending.messageSeq = ack.messageSeq || pending.messageSeq;
      pending.id = String(ack.messageID || pending.id);
      delete messageStore.pendingQueue[pending.clientMsgNo];
    });
  }
  return true;
}

export function registerCMDListeners(sdk) {
  const shared = sdk?.shared ? sdk.shared() : sdk;
  const cmdManager = shared?.cmdManager || shared?.chatManager;
  if (!cmdManager?.addCMDListener) return false;

  cmdManager.addCMDListener((cmd) => {
    const type = cmd?.cmd || cmd?.type;
    const param = cmd?.param || cmd?.data || {};
    const channel = param.channel || cmd?.channel;
    const conversationStore = useConversationStore();
    const messageStore = useMessageStore();

    if (type === 'typing' && channel) {
      messageStore.typingState[`${channel.channelID}-${channel.channelType}`] = param;
      return;
    }
    if (type === 'messageRevoke' && channel) {
      messageStore.applyMessageRevoke(channel.channelID, param.client_msg_no || param.message_id, channel.channelType);
      return;
    }
    if (type === 'unreadClear' && channel) {
      conversationStore.clearUnread(channel.channelID, channel.channelType);
      return;
    }
    if (type === 'channelUpdate' && channel) {
      conversationStore.addOrUpdateConversation(channel.channelID, channel.channelType, param);
      return;
    }
    console.warn('[CMD_UNHANDLED]', type, param);
  });
  return true;
}
