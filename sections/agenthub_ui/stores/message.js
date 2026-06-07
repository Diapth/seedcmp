import { defineStore } from 'pinia';
import { syncApi } from '@/api/sync.js';
import { AppError } from '@/utils/request.js';
import { channelKey, createInboundMessage, messageSummary, toBackendChannelType } from '@/utils/im-mappers.js';
import { notifyMessage } from '@/composables/useSystemNotification';
import { useAuthStore } from './auth.js';
import { useConversationStore } from './conversation.js';

function newClientMsgNo() {
  return `agenthub-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultMsg(overrides = {}) {
  return {
    reactions: [],
    replyRef: null,
    mentions: [],
    senderAvatar: '',
    status: 'success',
    ...overrides
  };
}

function pickDeploymentRequestId(request = {}) {
  return request.id || request.requestId || request.request_id || request.deploymentRequestId || request.deployment_request_id || '';
}

function deploymentChannelId(request = {}) {
  return request.channelId || request.channel_id || '';
}

function deploymentChannelType(request = {}) {
  return Number(request.channelType || request.channel_type || 0);
}

function deploymentTimestamp(request = {}) {
  const value = Number(request.createdAt || request.created_at || request.updatedAt || request.updated_at || 0);
  if (!Number.isFinite(value) || value <= 0) return Date.now();
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function conversationRecentMessages(conversation = {}) {
  const raw = conversation.raw || {};
  const candidates = [
    raw.last_message,
    raw.lastMessage,
    raw.last_msg,
    raw.message,
    ...(Array.isArray(raw.recents) ? raw.recents : []),
    ...(Array.isArray(raw.messages) ? raw.messages : [])
  ].filter(Boolean);
  return [...candidates]
    .filter((item) => {
      const content = item.payload ?? item.content ?? item.contentObj ?? {};
      const type = Number(item.type ?? content.type ?? item.content_type ?? item.contentType ?? 1);
      return type !== 99 && type !== 1000;
    })
    .sort((a, b) => Number(a.message_seq || a.messageSeq || a.timestamp || 0) - Number(b.message_seq || b.messageSeq || b.timestamp || 0));
}

function conversationSummaryMessage(conversation = {}, channelId = '', channelType = 1) {
  const text = String(conversation.lastMessage || '').trim();
  if (!text) return null;
  const messageSeq = Number(conversation.lastMessageSeq || conversation.raw?.last_msg_seq || 0);
  const timestamp = conversation.lastTime || conversation.raw?.timestamp || Date.now();
  const clientMsgNo = conversation.raw?.last_client_msg_no || `conversation-summary-${channelId}-${messageSeq || timestamp}`;
  return {
    id: `summary-${channelId}-${messageSeq || timestamp}`,
    client_msg_no: clientMsgNo,
    message_seq: messageSeq,
    from_uid: conversation.raw?.last_message?.from_uid || conversation.raw?.lastMessage?.fromUID || '',
    channel_id: channelId,
    channel_type: channelType,
    timestamp,
    payload: { type: 1, text }
  };
}

function conversationPreviewMessages(conversation = {}, channelId = '', channelType = 1) {
  const messages = conversationRecentMessages(conversation).map((item) => createInboundMessage({
    channel_id: channelId,
    channel_type: channelType,
    ...item
  }));
  if (messages.length) return messages;
  const summary = conversationSummaryMessage(conversation, channelId, channelType);
  return summary ? [createInboundMessage(summary)] : [];
}

function isSyntheticSummaryMessage(message = {}) {
  const id = String(message.id || '');
  const clientMsgNo = String(message.clientMsgNo || '');
  return id.startsWith('summary-') || clientMsgNo.startsWith('conversation-summary-');
}

function getLatestPersistedMessageSeq(messages = []) {
  return messages.reduce((max, item) => {
    if (isSyntheticSummaryMessage(item)) return max;
    return Math.max(max, Number(item.messageSeq || 0));
  }, 0);
}

function deploymentCardTitle(request = {}) {
  return request.title || request.originalText || request.original_text || request.statusLabel || request.status_label || '部署请求';
}

async function sendSdkTextMessage() {
  const module = await import('@/utils/wk-sdk.js');
  if (!module?.sendTextMessage) {
    throw new AppError('WKSDK 发送能力不可用', { code: 'SDK_UNAVAILABLE' });
  }
  return module.sendTextMessage(...arguments);
}

async function sendSdkTypingCommand(args) {
  const module = await import('@/utils/wk-sdk.js');
  if (!module?.sendTypingCommand) {
    throw new AppError('WKSDK 输入状态能力不可用', { code: 'SDK_UNAVAILABLE' });
  }
  return module.sendTypingCommand(args);
}

export const useMessageStore = defineStore('message', {
  state: () => ({
    messages: {},
    pendingQueue: {},
    typingState: {},
    reminders: [],
    pinnedMessages: {},
    loading: false,
    lastError: ''
  }),
  actions: {
    getMessages(conversationId, channelType = '') {
      const direct = this.messages[conversationId] || [];
      if (direct.length || !channelType) return direct;
      return this.messages[channelKey(conversationId, channelType)] || [];
    },
    getConversationPreviewMessages(conversation = {}) {
      const channelId = conversation.channelId || conversation.id || conversation.raw?.channel_id || conversation.raw?.channelId || '';
      const channelType = toBackendChannelType(conversation.channelType || conversation.type || conversation.raw?.channel_type || conversation.raw?.channelType || 1);
      if (!channelId || !channelType) return [];
      const hydrated = this.getMessages(channelId, channelType);
      return hydrated.length ? hydrated : conversationPreviewMessages(conversation, channelId, channelType);
    },
    ensureBucket(conversationId, channelType = '') {
      const key = String(conversationId);
      if (!this.messages[key]) this.messages[key] = [];
      if (channelType) {
        const typedKey = channelKey(conversationId, channelType);
        if (!this.messages[typedKey]) this.messages[typedKey] = this.messages[key];
      }
      return this.messages[key];
    },
    addRealtimeMessage(channelId, channelType, rawMessage) {
      const msg = createInboundMessage(rawMessage);
      const list = this.ensureBucket(channelId, channelType);
      const pendingKey = msg.clientMsgNo && this.pendingQueue[msg.clientMsgNo] ? msg.clientMsgNo : '';
      const existingIndex = list.findIndex((item) =>
        item.id === msg.id ||
        (msg.clientMsgNo && item.clientMsgNo === msg.clientMsgNo) ||
        (msg.messageSeq > 0 && item.messageSeq === msg.messageSeq)
      );
      if (existingIndex >= 0) {
        list[existingIndex] = { ...list[existingIndex], ...msg, status: 'success' };
      } else {
        list.push(msg);
      }
      if (pendingKey) delete this.pendingQueue[pendingKey];

      const convStore = useConversationStore();
      const conv = convStore.addOrUpdateConversation(channelId, channelType, {
        lastMessage: messageSummary(msg),
        lastTime: msg.time,
        lastMessageSeq: msg.messageSeq
      });
      if (convStore.activeId !== String(channelId)) {
        conv.unread = (conv.unread || 0) + 1;
      }
      if (!conv.isMuted) {
        notifyMessage({ conversation: conv, message: msg });
      }
      return msg;
    },
    addMessage(conversationId, message, channelType = '') {
      const list = this.ensureBucket(conversationId, channelType);
      const msg = defaultMsg(message);
      if (!list.some((item) => item.id === msg.id || (msg.clientMsgNo && item.clientMsgNo === msg.clientMsgNo))) {
        list.push(msg);
      }
      return msg;
    },
    addDeploymentRequestCard(request = {}) {
      const requestId = pickDeploymentRequestId(request);
      const channelId = deploymentChannelId(request);
      const channelType = deploymentChannelType(request);
      if (!requestId || !channelId || !channelType) return null;

      const clientMsgNo = `deployment-card-${requestId}`;
      const title = deploymentCardTitle(request);
      const card = defaultMsg({
        id: clientMsgNo,
        clientMsgNo,
        senderId: request.senderId || request.sender_id || 'clowder_cat:coordinator',
        senderName: request.senderName || request.sender_name || 'PM / Deployment',
        content: title,
        type: 'deployment',
        time: deploymentTimestamp(request),
        channelId,
        channelType,
        deploymentRequestId: requestId,
        deployment: {
          requestId,
          title,
          status: request.status || 'pending_confirmation',
          target: request.target || '',
          environment: request.environment || '',
          previewUrl: request.previewUrl || request.preview_url || '',
          downloadUrl: request.downloadUrl || request.download_url || '',
          channelId,
          channelType,
          raw: request
        },
        raw: {
          payload: {
            type: 7,
            cardType: 'deployment',
            deploymentRequestId: requestId,
            deploymentRequest: request
          }
        }
      });

      const list = this.ensureBucket(channelId, channelType);
      const existingIndex = list.findIndex((item) =>
        item.id === card.id || item.clientMsgNo === card.clientMsgNo || item.deploymentRequestId === requestId
      );
      if (existingIndex >= 0) {
        list[existingIndex] = { ...list[existingIndex], ...card };
        return list[existingIndex];
      }
      list.push(card);
      return card;
    },
    async sendMessage(conversationId, text, sender = null, type = 'text', extra = {}) {
      if (type !== 'text') {
        throw new AppError('图片、文件和语音发送需先接入真实上传能力', { code: 'MEDIA_SEND_UNAVAILABLE' });
      }
      const convStore = useConversationStore();
      const conv = convStore.conversations.find((item) => item.id === conversationId);
      const channelType = toBackendChannelType(conv?.channelType || conv?.type || extra.channelType || 1);
      const authStore = useAuthStore();
      const clientMsgNo = extra.clientMsgNo || newClientMsgNo();
      const msg = defaultMsg({
        id: clientMsgNo,
        clientMsgNo,
        senderId: sender?.id || authStore.uid || 'me',
        senderName: sender?.name || '我',
        content: text,
        type,
        time: Date.now(),
        status: 'sending',
        ...extra
      });
      this.addMessage(conversationId, msg, channelType);
      this.pendingQueue[clientMsgNo] = msg;
      convStore.addOrUpdateConversation(conversationId, channelType, {
        lastMessage: messageSummary(msg),
        lastTime: msg.time
      });

      try {
        const sent = await sendSdkTextMessage({
          channelId: conversationId,
          channelType,
          text,
          clientMsgNo,
          extra
        });
        msg.status = 'success';
        msg.clientSeq = sent?.clientSeq || msg.clientSeq;
        msg.messageSeq = sent?.messageSeq || msg.messageSeq;
        if (sent?.messageID) {
          msg.id = String(sent.messageID);
        }
        delete this.pendingQueue[clientMsgNo];
        return msg;
      } catch (err) {
        msg.status = 'failed';
        this.lastError = err?.message || '消息发送失败';
        throw err;
      }
    },
    async sendTyping(conversationId, channelType = 1) {
      if (!conversationId) return null;
      return sendSdkTypingCommand({
        channelId: conversationId,
        channelType: toBackendChannelType(channelType)
      });
    },
    receiveMessage(conversationId, msg) {
      return this.addRealtimeMessage(conversationId, msg.channelType || 1, msg);
    },
    hydrateFromConversationRecents(conversation = {}) {
      const channelId = conversation.channelId || conversation.id || conversation.raw?.channel_id || conversation.raw?.channelId || '';
      const channelType = toBackendChannelType(conversation.channelType || conversation.type || conversation.raw?.channel_type || conversation.raw?.channelType || 1);
      if (!channelId || !channelType) return [];
      conversationRecentMessages(conversation).forEach((item) => {
        this.addRealtimeMessage(channelId, channelType, {
          channel_id: channelId,
          channel_type: channelType,
          ...item
        });
      });
      if (!this.getMessages(channelId, channelType).length) {
        const summary = conversationSummaryMessage(conversation, channelId, channelType);
        if (summary) this.addRealtimeMessage(channelId, channelType, summary);
      }
      return this.getMessages(channelId, channelType);
    },
    async syncMessages(channelId, channelType = 1, options = {}) {
      this.loading = true;
      this.lastError = '';
      try {
        const backendType = toBackendChannelType(channelType);
        const convStore = useConversationStore();
        const existingMessages = this.getMessages(channelId, backendType);
        const latestPersistedSeq = getLatestPersistedMessageSeq(existingMessages);
        const conversation = convStore.getConversation(channelId, backendType);
        const latestKnownSeq = Number(options.latestMessageSeq || conversation?.lastMessageSeq || conversation?.raw?.last_msg_seq || 0);
        const hasExplicitWindow = Object.prototype.hasOwnProperty.call(options, 'startMessageSeq') ||
          Object.prototype.hasOwnProperty.call(options, 'pullMode');
        const shouldLoadLatestWindow = options.hydrateVisibleHistory &&
          !hasExplicitWindow &&
          latestKnownSeq > 0 &&
          (latestPersistedSeq <= 0 || latestKnownSeq - latestPersistedSeq > (options.limit || 30));
        const response = await syncApi.syncMessages({
          channel_id: channelId,
          channel_type: backendType,
          limit: options.limit || 30,
          start_message_seq: shouldLoadLatestWindow ? latestKnownSeq : (options.startMessageSeq || 0),
          end_message_seq: options.endMessageSeq || 0,
          pull_mode: shouldLoadLatestWindow ? 0 : (options.pullMode || 1)
        });
        const data = response?.data || response || {};
        const list = data.messages || [];
        list.forEach((item) => this.addRealtimeMessage(channelId, backendType, item));
        return this.getMessages(channelId, backendType);
      } catch (err) {
        this.lastError = err?.message || '同步消息失败';
        throw err;
      } finally {
        this.loading = false;
      }
    },
    async retryPendingQueue() {
      const pending = Object.values(this.pendingQueue);
      return pending;
    },
    reactMessage(conversationId, messageId, emoji, userId = 'me', channelType = '') {
      const msg = this.findMessageByRef(conversationId, messageId, channelType);
      if (!msg) return;
      if (!msg.reactions) msg.reactions = [];
      const existing = msg.reactions.find((r) => r.emoji === emoji);
      if (existing) {
        if (existing.userIds.includes(userId)) {
          existing.userIds = existing.userIds.filter((u) => u !== userId);
          existing.count = Math.max(0, existing.count - 1);
          if (existing.count === 0) msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
        } else {
          existing.userIds.push(userId);
          existing.count += 1;
        }
      } else {
        msg.reactions.push({ emoji, userIds: [userId], count: 1 });
      }
      syncApi.addReaction({
        channel_id: conversationId,
        channel_type: toBackendChannelType(msg.channelType || channelType || 1),
        message_id: msg.messageID || msg.id,
        emoji
      }).catch(() => undefined);
    },
    unreactMessage(conversationId, messageId, emoji, userId = 'me', channelType = '') {
      this.reactMessage(conversationId, messageId, emoji, userId, channelType);
    },
    findMessageByRef(conversationId, messageRef, channelType = '') {
      const ref = String(messageRef || '');
      const list = this.getMessages(conversationId, channelType);
      return list.find((m) =>
        String(m.id || '') === ref ||
        String(m.messageID || '') === ref ||
        String(m.clientMsgNo || '') === ref ||
        (m.messageSeq !== undefined && String(m.messageSeq) === ref)
      );
    },
    applyMessageRevoke(conversationId, messageRef, channelType = '') {
      const msg = this.findMessageByRef(conversationId, messageRef, channelType);
      if (!msg) return false;
      msg.status = 'revoked';
      msg.type = 'system';
      msg.content = '你撤回了一条消息';
      return true;
    },
    async revokeMessage(conversationId, messageRef, channelType = '') {
      const msg = this.findMessageByRef(conversationId, messageRef, channelType);
      if (!msg) return false;
      this.applyMessageRevoke(conversationId, messageRef, channelType);
      await syncApi.revokeMessage({
        channel_id: conversationId,
        channel_type: msg.channelType || channelType || 1,
        message_id: msg.messageID || msg.id,
        client_msg_no: msg.clientMsgNo || ''
      }).catch(() => undefined);
      return true;
    },
    deleteMessage(conversationId, messageId) {
      const list = this.messages[conversationId];
      if (!list) return;
      this.messages[conversationId] = list.filter((m) => m.id !== messageId);
    },
    async editMessage(conversationId, messageId, newContent) {
      const list = this.messages[conversationId];
      if (!list) return;
      const msg = list.find((m) => m.id === messageId);
      if (!msg) return;
      msg.content = newContent;
      msg.status = 'edited';
      await syncApi.editMessage({
        channel_id: conversationId,
        channel_type: msg.channelType || 1,
        message_id: messageId,
        message_seq: msg.messageSeq || 0,
        content_edit: newContent
      }).catch(() => undefined);
    },
    reset() {
      this.messages = {};
      this.pendingQueue = {};
      this.typingState = {};
      this.reminders = [];
      this.pinnedMessages = {};
      this.loading = false;
      this.lastError = '';
    }
  }
});
