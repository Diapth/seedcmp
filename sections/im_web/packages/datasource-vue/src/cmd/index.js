import WKSDK from 'wukongimjssdk';
import { useMessageStore } from '../stores/messageStore';
import { useChannelStore } from '../stores/channelStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUserStore } from '../stores/userStore';
import { userApi } from '../api';
export function registerCMDListeners() {
    WKSDK.shared().chatManager.addCMDListener((msg) => {
        const content = msg.content;
        if (!content || !content.cmd)
            return;
        const cmd = content.cmd;
        const param = content.param || {};
        const channel = msg.channel;
        console.log(`[CMD] Received command: ${cmd}`, param, channel);
        const messageStore = useMessageStore();
        const channelStore = useChannelStore();
        const conversationStore = useConversationStore();
        const userStore = useUserStore();
        switch (cmd) {
            case 'channelUpdate':
                if (channel) {
                    const key = `${channel.channelID}-${channel.channelType}`;
                    delete channelStore.channels[key];
                    channelStore.getChannelInfo(channel.channelID, channel.channelType);
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
                break;
            case 'friendAccept':
                break;
            case 'friendDeleted':
                break;
            case 'memberUpdate':
                if (channel && channel.channelType === 2) {
                    channelStore.fetchGroupMembers(channel.channelID);
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
