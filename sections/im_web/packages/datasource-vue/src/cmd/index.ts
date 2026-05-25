import WKSDK, { Message, SendackPacket } from 'wukongimjssdk';
import { useMessageStore } from '../stores/messageStore';
import { useChannelStore } from '../stores/channelStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUserStore } from '../stores/userStore';
import { useGroupStore } from '../stores/groupStore';
import { userApi } from '../api';

const pendingClientMsgNoBySeq = new Map<number, string>();

export function registerCMDListeners() {
  WKSDK.shared().chatManager.addCMDListener((msg: Message) => {
    const content = msg.content;
    if (!content || !content.cmd) return;

    const cmd = content.cmd;
    const param = content.param || {};
    const channel = msg.channel;

    console.log(`[CMD] Received command: ${cmd}`, param, channel);

    const messageStore = useMessageStore();
    const channelStore = useChannelStore();
    const conversationStore = useConversationStore();
    const userStore = useUserStore();
    const groupStore = useGroupStore();

    switch (cmd) {
      case 'channelUpdate':
        if (channel) {
          const key = `${channel.channelID}-${channel.channelType}`;
          delete channelStore.channels[key];
          channelStore.getChannelInfo(channel.channelID, channel.channelType);
          if (channel.channelType === 2) {
            delete groupStore.groups[channel.channelID];
            groupStore.getGroupInfo(channel.channelID);
          }
        }
        break;

      case 'typing':
        if (channel) {
          messageStore.setTyping(channel.channelID, channel.channelType);
        }
        break;

      case 'groupAvatarUpdate':
        if (channel) {
          const key = `${channel.channelID}-${channel.channelType}`;
          delete channelStore.channels[key];
          channelStore.getChannelInfo(channel.channelID, channel.channelType);
          delete groupStore.groups[channel.channelID];
          groupStore.getGroupInfo(channel.channelID);
        }
        break;

      case 'unreadClear':
        if (channel) {
          const key = `${channel.channelID}-${channel.channelType}`;
          conversationStore.unreadMap[key] = 0;
          const conv = conversationStore.conversations.find(c => c.channel_id === channel.channelID && c.channel_type === channel.channelType);
          if (conv) {
            conv.unread = 0;
          }
        }
        break;

      case 'conversationDeleted':
        if (channel) {
          conversationStore.deleteConversation(channel.channelID, channel.channelType);
        }
        break;

      case 'friendRequest':
        userApi.getReddot('friendApply');
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('wksdk:friendRequest'));
        break;

      case 'friendAccept':
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('wksdk:friendAccept'));
        break;

      case 'friendDeleted':
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('wksdk:friendDeleted'));
        break;

      case 'memberUpdate':
        if (channel && channel.channelType === 2) {
          channelStore.fetchGroupMembers(channel.channelID);
          groupStore.fetchGroupMembers(channel.channelID);
        }
        break;

      case 'onlineStatus':
        if (param.uid && param.online !== undefined) {
          if (userStore.userCache[param.uid]) {
            userStore.userCache[param.uid].online = param.online;
          }
        }
        break;

      case 'syncConversationExtra':
        conversationStore.syncExtra();
        break;

      case 'syncReminders':
        break;

      case 'groupMemberAdd':
      case 'groupMemberRemove':
      case 'groupMemberUpdate':
      case 'groupManagerUpdate':
      case 'groupTransferOwner':
      case 'groupBlacklistUpdate':
      case 'groupForbiddenUpdate':
        if (channel && channel.channelType === 2) {
          delete groupStore.groups[channel.channelID];
          groupStore.getGroupInfo(channel.channelID);
          groupStore.fetchGroupMembers(channel.channelID);
          channelStore.fetchGroupMembers(channel.channelID);
          conversationStore.ensureGroupConversations();
        }
        break;

      case 'messageRevoke':
        if (channel && param.client_msg_no) {
          messageStore.handleMessageRevoked(channel.channelID, channel.channelType, param.client_msg_no);
        }
        break;

      case 'userAvatarUpdate':
        if (param.uid) {
          delete userStore.userCache[param.uid];
          userStore.getUsersByIds([param.uid]);
        }
        break;

      default:
        console.warn(`[CMD] Unhandled command type: ${cmd}`);
    }
  });
}

export function registerMessageListeners() {
  WKSDK.shared().chatManager.addMessageListener((message: Message) => {
    if (!message?.channel) return;
    if (message.header?.noPersist) return;

    const messageStore = useMessageStore();
    const conversationStore = useConversationStore();
    const userStore = useUserStore();

    const channelId = message.channel.channelID;
    const channelType = message.channel.channelType;
    const currentUid = String(userStore.currentUser?.uid || '');
    const isOwnMessage = String(message.fromUID || '') === currentUid;
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const isViewingChannel = currentPath.includes(`/chat/conversation/${channelId}/${channelType}`);

    if (message.clientSeq && message.clientMsgNo) {
      pendingClientMsgNoBySeq.set(message.clientSeq, message.clientMsgNo);
    }

    // Own messages are skipped here entirely.
    // sendMessage / sendMediaMessage call addRealtimeMessage themselves after
    // WKSDK.send() resolves, merging the pending entry via our clientMsgNo.
    // The SDK also pushes the same message back through this listener, but with
    // a different clientMsgNo, which would create a duplicate — so we skip it.
    // Multi-device sync is handled by syncMessages on reconnect, not this path.
    if (isOwnMessage) return;

    messageStore.addRealtimeMessage(channelId, channelType, message, {
      isUnreadCleared: isViewingChannel
    });

    if (isViewingChannel) {
      conversationStore.clearUnread(channelId, channelType);
    }
  });

  WKSDK.shared().chatManager.addMessageStatusListener((ack: SendackPacket) => {
    const clientMsgNo = pendingClientMsgNoBySeq.get(ack.clientSeq);
    if (!clientMsgNo) return;
    pendingClientMsgNoBySeq.delete(ack.clientSeq);

    const messageStore = useMessageStore();
    messageStore.updateMessageStatus(clientMsgNo, {
      messageID: String(ack.messageID || ''),
      messageSeq: ack.messageSeq || 0,
      status: ack.reasonCode === 1 ? 'success' : 'fail'
    });
  });
}
