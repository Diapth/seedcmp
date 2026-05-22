import { defineStore } from 'pinia';
import { ref } from 'vue';
import WKSDK from 'wukongimjssdk';
import { syncApi } from '../api';
import { useConversationStore } from './conversationStore';
import { useUserStore } from './userStore';
export const useMessageStore = defineStore('message', () => {
    const messages = ref({});
    const typingState = ref({});
    const conversationStore = useConversationStore();
    const userStore = useUserStore();
    function getChannelMessages(channelId, channelType) {
        const key = `${channelId}-${channelType}`;
        return messages.value[key] || [];
    }
    function normalizeSyncedPayload(payload) {
        if (!payload)
            return {};
        if (typeof payload === 'object')
            return normalizeMessageContent(payload);
        if (typeof payload !== 'string')
            return {};
        try {
            return normalizeMessageContent(JSON.parse(payload));
        }
        catch (plainErr) {
            try {
                return normalizeMessageContent(JSON.parse(atob(payload)));
            }
            catch (base64Err) {
                console.warn('[MessageStore] Failed to decode synced message payload', base64Err || plainErr);
                return {};
            }
        }
    }
    function normalizeRemoteExtra(extra) {
        if (!extra)
            return undefined;
        return {
            ...extra,
            readed: extra.readed === 1 || extra.readed === true,
            revoke: extra.revoke === 1 || extra.revoke === true,
            readedCount: extra.readed_count || extra.readedCount || 0,
            unreadCount: extra.unread_count || extra.unreadCount || 0,
            revoker: extra.revoker
        };
    }
    function normalizeMessageContent(content) {
        if (!content || typeof content !== 'object')
            return {};
        const normalized = { ...content };
        if (normalized.type === 1 && normalized.text === undefined && normalized.content !== undefined) {
            normalized.text = normalized.content;
        }
        return normalized;
    }
    function isConversationDigestMessage(msg) {
        if (!msg || msg.isRevoked)
            return false;
        const type = Number(msg.content?.type || 0);
        return ![99, 1000].includes(type);
    }
    function getLatestConversationDigestMessage(list) {
        return [...list].reverse().find(isConversationDigestMessage);
    }
    async function ensureConversationFromMessages(channelId, channelType) {
        const list = messages.value[`${channelId}-${channelType}`] || [];
        const lastMessage = getLatestConversationDigestMessage(list);
        if (!lastMessage)
            return;
        await conversationStore.ensureConversation(channelId, channelType, {
            messageSeq: lastMessage.messageSeq,
            timestamp: lastMessage.timestamp,
            fromUID: lastMessage.fromUID,
            payload: lastMessage.content,
            isOwnMessage: lastMessage.fromUID === userStore.currentUser?.uid,
            isUnreadCleared: true
        });
    }
    async function syncMessages(channelId, channelType) {
        const key = `${channelId}-${channelType}`;
        const list = messages.value[key] || [];
        const startSeq = list.length > 0 ? list[list.length - 1].messageSeq : 0;
        try {
            const res = await syncApi.syncMessages({
                channel_id: channelId,
                channel_type: channelType,
                limit: 30,
                start_message_seq: startSeq,
                end_message_seq: 0,
                pull_mode: 1
            });
            if (res && Array.isArray(res.messages)) {
                const synced = res.messages.filter((item) => item.is_deleted !== 1).map((item) => {
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
                const mergedMap = new Map();
                currentList.forEach(m => mergedMap.set(m.clientMsgNo, m));
                synced.forEach(m => mergedMap.set(m.clientMsgNo, m));
                messages.value[key] = Array.from(mergedMap.values()).sort((a, b) => a.messageSeq - b.messageSeq);
                await ensureConversationFromMessages(channelId, channelType);
            }
        }
        catch (e) {
            console.error(`[MessageStore] Failed to sync messages for channel ${key}`, e);
        }
    }
    function addMessage(channelId, channelType, msg) {
        const key = `${channelId}-${channelType}`;
        if (!messages.value[key]) {
            messages.value[key] = [];
        }
        const idx = messages.value[key].findIndex(m => m.clientMsgNo === msg.clientMsgNo);
        if (idx !== -1) {
            messages.value[key][idx] = { ...messages.value[key][idx], ...msg };
        }
        else {
            messages.value[key].push(msg);
        }
        messages.value[key].sort((a, b) => a.messageSeq - b.messageSeq || a.timestamp - b.timestamp);
        if (isConversationDigestMessage(msg)) {
            conversationStore.addOrUpdateConversation(channelId, channelType, {
                messageSeq: msg.messageSeq,
                timestamp: msg.timestamp,
                fromUID: msg.fromUID,
                payload: msg.content,
                isOwnMessage: msg.fromUID === userStore.currentUser?.uid
            });
        }
    }
    function normalizeContent(content) {
        if (!content)
            return {};
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
    function addRealtimeMessage(channelId, channelType, rawMessage) {
        const normalized = {
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
    function updateMessageStatus(clientMsgNo, patch) {
        if (!clientMsgNo)
            return;
        for (const key of Object.keys(messages.value)) {
            const list = messages.value[key] || [];
            const idx = list.findIndex(m => m.clientMsgNo === clientMsgNo);
            if (idx === -1)
                continue;
            const next = { ...list[idx], ...patch };
            list[idx] = next;
            const [channelId, channelType] = key.split('-');
            conversationStore.addOrUpdateConversation(channelId, Number(channelType), {
                messageSeq: next.messageSeq,
                timestamp: next.timestamp,
                fromUID: next.fromUID,
                payload: next.content,
                isOwnMessage: next.fromUID === userStore.currentUser?.uid,
                isUnreadCleared: true
            });
            return;
        }
    }
    async function revokeMessage(channelId, channelType, clientMsgNo, messageId) {
        try {
            await syncApi.revokeMessage({
                channel_id: channelId,
                channel_type: channelType,
                message_id: messageId,
                client_msg_no: clientMsgNo
            });
            handleMessageRevoked(channelId, channelType, clientMsgNo);
        }
        catch (e) {
            console.error('[MessageStore] Failed to revoke message', e);
        }
    }
    function handleMessageRevoked(channelId, channelType, clientMsgNo) {
        const key = `${channelId}-${channelType}`;
        const list = messages.value[key] || [];
        const msg = list.find(m => m.clientMsgNo === clientMsgNo);
        if (msg) {
            msg.isRevoked = true;
        }
    }
    function applyReactionToggle(msg, emoji, uid) {
        if (!msg.reactions) {
            msg.reactions = [];
        }
        const reactions = msg.reactions;
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
        }
        else {
            existing.users = uid ? [...users, uid] : users;
            existing.count = Number(existing.count || 0) + 1;
        }
        msg.reactions = reactions.filter(reaction => Number(reaction.count || 0) > 0);
    }
    async function toggleReaction(channelId, channelType, msg, emoji) {
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
    function setTyping(channelId, channelType) {
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
    async function sendMessage(channelId, channelType, text, options) {
        let sentMessage;
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
                sentMessage = res;
                addRealtimeMessage(channelId, channelType, res);
            }
        }
        catch (err) {
            if (sentMessage) {
                sentMessage.status = 2;
                addRealtimeMessage(channelId, channelType, sentMessage);
            }
            throw err;
        }
    }
    const replyTarget = ref(null);
    function setReplyTarget(msg) {
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
        updateMessageStatus,
        setReplyTarget
    };
});
