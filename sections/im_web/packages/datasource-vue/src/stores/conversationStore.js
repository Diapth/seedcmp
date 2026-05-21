import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { syncApi } from '../api';
import { useChannelStore } from './channelStore';
export const useConversationStore = defineStore('conversation', () => {
    const conversations = ref([]);
    const drafts = ref({});
    const unreadMap = ref({});
    const lastSyncVersion = ref(0);
    const channelStore = useChannelStore();
    const sortedConversations = computed(() => {
        return [...conversations.value].sort((a, b) => {
            if (a.top !== b.top) {
                return b.top - a.top;
            }
            return b.last_msg_time - a.last_msg_time;
        });
    });
    const totalUnreadCount = computed(() => {
        return conversations.value.reduce((acc, conv) => {
            return conv.mute ? acc : acc + conv.unread;
        }, 0);
    });
    async function syncConversations() {
        try {
            const res = await syncApi.syncConversations({ msg_count: 1 });
            if (res && Array.isArray(res)) {
                const list = [];
                for (const item of res) {
                    const key = `${item.channel_id}-${item.channel_type}`;
                    const info = await channelStore.getChannelInfo(item.channel_id, item.channel_type);
                    list.push({
                        channel_id: item.channel_id,
                        channel_type: item.channel_type,
                        unread: item.unread || 0,
                        last_msg_seq: item.last_msg_seq || 0,
                        last_msg_time: item.last_msg_time || 0,
                        last_message: item.last_message,
                        top: info.top || 0,
                        mute: info.mute || 0,
                        draft: drafts.value[key] || '',
                        name: info.name,
                        avatar: info.avatar
                    });
                    unreadMap.value[key] = item.unread || 0;
                }
                conversations.value = list;
                await syncExtra();
            }
        }
        catch (e) {
            console.error('[ConversationStore] Failed to sync conversations', e);
        }
    }
    async function syncExtra() {
        try {
            const res = await syncApi.syncConversationExtra({ version: lastSyncVersion.value });
            if (res && Array.isArray(res)) {
                for (const item of res) {
                    const key = `${item.channel_id}-${item.channel_type}`;
                    if (item.draft) {
                        drafts.value[key] = item.draft;
                    }
                    const conv = conversations.value.find(c => c.channel_id === item.channel_id && c.channel_type === item.channel_type);
                    if (conv) {
                        conv.draft = item.draft || '';
                        conv.top = item.top || 0;
                        conv.mute = item.mute || 0;
                    }
                    if (item.version > lastSyncVersion.value) {
                        lastSyncVersion.value = item.version;
                    }
                }
            }
        }
        catch (e) {
            console.error('[ConversationStore] Failed to sync conversation extra', e);
        }
    }
    async function updateDraft(channelId, channelType, draftText) {
        const key = `${channelId}-${channelType}`;
        drafts.value[key] = draftText;
        const conv = conversations.value.find(c => c.channel_id === channelId && c.channel_type === channelType);
        if (conv) {
            conv.draft = draftText;
        }
        try {
            await syncApi.updateConversationExtra(channelId, channelType, { draft: draftText });
        }
        catch (e) {
            console.error('[ConversationStore] Failed to update draft extra', e);
        }
    }
    async function togglePin(channelId, channelType, pin) {
        const top = pin ? 1 : 0;
        const conv = conversations.value.find(c => c.channel_id === channelId && c.channel_type === channelType);
        if (conv) {
            conv.top = top;
        }
        try {
            await syncApi.updateConversationExtra(channelId, channelType, { top });
        }
        catch (e) {
            console.error('[ConversationStore] Failed to update pin extra', e);
        }
    }
    async function clearUnread(channelId, channelType) {
        const key = `${channelId}-${channelType}`;
        unreadMap.value[key] = 0;
        const conv = conversations.value.find(c => c.channel_id === channelId && c.channel_type === channelType);
        if (conv) {
            conv.unread = 0;
        }
        try {
            await syncApi.clearUnread(channelId, channelType);
        }
        catch (e) {
            console.error('[ConversationStore] Failed to clear unread remote count', e);
        }
    }
    async function addOrUpdateConversation(channelId, channelType, message) {
        const key = `${channelId}-${channelType}`;
        const conv = conversations.value.find(c => c.channel_id === channelId && c.channel_type === channelType);
        const info = await channelStore.getChannelInfo(channelId, channelType);
        if (conv) {
            conv.last_msg_seq = message.messageSeq || conv.last_msg_seq;
            conv.last_msg_time = message.timestamp || Math.floor(Date.now() / 1000);
            conv.last_message = message;
            if (message.fromUID !== channelId && !message.isUnreadCleared) {
                conv.unread++;
                unreadMap.value[key] = conv.unread;
            }
        }
        else {
            conversations.value.push({
                channel_id: channelId,
                channel_type: channelType,
                unread: 1,
                last_msg_seq: message.messageSeq || 0,
                last_msg_time: message.timestamp || Math.floor(Date.now() / 1000),
                last_message: message,
                top: info.top || 0,
                mute: info.mute || 0,
                draft: drafts.value[key] || '',
                name: info.name,
                avatar: info.avatar
            });
            unreadMap.value[key] = 1;
        }
    }
    async function deleteConversation(channelId, channelType) {
        conversations.value = conversations.value.filter(c => !(c.channel_id === channelId && c.channel_type === channelType));
        const key = `${channelId}-${channelType}`;
        delete unreadMap.value[key];
        try {
            await syncApi.deleteConversation(channelId, channelType);
        }
        catch (e) {
            console.error('[ConversationStore] Failed to delete conversation remotely', e);
        }
    }
    return {
        conversations,
        drafts,
        unreadMap,
        sortedConversations,
        totalUnreadCount,
        syncConversations,
        syncExtra,
        updateDraft,
        togglePin,
        clearUnread,
        addOrUpdateConversation,
        deleteConversation
    };
});
