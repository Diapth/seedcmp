import { defineStore } from 'pinia';
import { useConversationStore } from '@/stores/conversation';
import { notifyMessage } from '@/composables/useSystemNotification';
import { nativeImService } from '@/services/native-im/service';
import {
  conversationSummaryForMessage,
  createClowderMarkdownStreamEvents,
  createClientMsgNo,
  enrichNativeMessageSender,
  isClowderDirectCatConversation,
  isVisibleChatMessage,
  isSelfSender,
  mergeNativeMessageIntoList,
  mergeNativeMessageLists,
  mergeAgentReplyEventIntoList,
  resolveClowderDirectCatId,
  resolveOutboundSender,
  resolveLocalSendStatus,
  shouldKeepLocalSendSuccess,
  shouldUseLocalMockMediaSuccess
} from '@/services/native-im/message-state';

function defaultMsg(overrides = {}) {
  return {
    reactions: [], // [{ emoji, userIds: [], count }]
    replyRef: null, // { messageId, senderName, contentPreview }
    mentions: [], // [{ userId, name, offset }]
    senderAvatar: '',
    status: 'success', // 'sending' | 'success' | 'failed' | 'revoked' | 'edited'
    ...overrides
  };
}

function messageSummary(message) {
  if (!isVisibleChatMessage(message)) return '';
  if (message.type === 'system') return message.content || '';
  if (message.type === 'image') return '[图片]';
  if (message.type === 'voice') return '[语音]';
  if (message.type === 'file') return `[文件] ${message.fileName || message.name || message.content || ''}`.trim();
  return message.content || '收到一条新消息';
}

function isLocalMediaUrl(url = '') {
  return /^(blob:|file:|wxfile:|http:\/\/tmp|https:\/\/tmp)/i.test(String(url || ''))
    || (!/^https?:\/\//i.test(String(url || '')) && String(url || '').trim() !== '');
}

function updateConversationSummary(conversation, message, currentUser = {}) {
  if (!conversation || !message) return;
  const summary = conversationSummaryForMessage(message, currentUser, conversation);
  if (!summary) {
    if (!conversation.lastTime && message.time) conversation.lastTime = message.time;
    return;
  }
  conversation.lastMessage = summary;
  conversation.lastTime = message.time || Date.now();
}

function errorText(error) {
  return error?.msg || error?.message || '消息同步失败';
}

function readCurrentUser() {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') return {};
  try {
    const raw = uni.getStorageSync('app_user');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function findConversation(convStore, conversationId) {
  return convStore.conversations.find((item) => item.id === conversationId) || null;
}

export const useMessageStore = defineStore('message', {
  state: () => ({
    syncState: 'idle',
    syncError: '',
    messages: {
      '1': [
        { id: '101', senderId: '1', senderName: '张伟', content: '哈罗，最近项目进展怎么样？', type: 'text', time: 1780485000000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '102', senderId: 'me', senderName: '我', content: '已经在推进UI优化阶段了，本周能做完。', type: 'text', time: 1780486000000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '103', senderId: '1', senderName: '张伟', content: '下午的会议材料准备好了吗？', type: 'text', time: 1780490000000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' }
      ],
      '2': [
        { id: '201', senderId: '5', senderName: '王五', content: '大家把bug提在这里哈。', type: 'text', time: 1780480000000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '202', senderId: '4', senderName: '李四', content: '收到，这个版已经发上去了。', type: 'text', time: 1780489500000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '203', senderId: '5', senderName: '王五', content: '这是刚才整理的测试文档，大家看一下', type: 'text', time: 1780489600000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '204', senderId: '5', senderName: '王五', name: 'test.docx', size: '746 KB', type: 'file', time: 1780489700000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '205', senderId: '4', senderName: '李四', name: 'test.xlsx', size: '12 KB', type: 'file', time: 1780489800000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '206', senderId: '1', senderName: '张伟', name: 'test.pptx', size: '7.5 MB', type: 'file', time: 1780489900000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '207', senderId: 'me', senderName: '我', name: 'test.md', size: '15 KB', type: 'file', time: 1780490000000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '208', senderId: '4', senderName: '李四', name: 'test.html', size: '19 KB', type: 'file', time: 1780490100000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '209', senderId: '1', senderName: '张伟', name: 'test.py', size: '13 KB', type: 'file', time: 1780490200000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: '210', senderId: '5', senderName: '王五', name: 'usv_layout_front_view.png', size: '62 KB', type: 'file', time: 1780490300000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' }
      ],
      'agent-review': [
        { id: 'ar-101', senderId: 'pm-agent', senderName: 'PM 智能体', content: '本轮评审目标：确认看板按群聊归类、日志进入完整 Console 页面、@ 修改仍能写入群聊草稿。', type: 'text', time: 1780490400000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: 'ar-102', senderId: 'codex', senderName: 'Codex', content: 'Console 日志页已经接入，任务卡会跳转到 /pages/agents/log，并保留任务目标、产出文档和完整输出。', type: 'text', time: 1780490500000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: 'ar-103', senderId: 'claude-code', senderName: 'Claude Code', content: '我会重点看群聊信息入口、看板 groupId 预选、移动端 375px 是否有横向溢出。', type: 'text', time: 1780490600000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: 'ar-104', senderId: 'logic-weaver', senderName: '逻辑编织者', content: '同一个智能体跨多个群聊出现时，任务归属以 groupId + taskId 为准，agentId 只表示执行者。', type: 'text', time: 1780490700000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' },
        { id: 'ar-105', senderId: 'clowder', senderName: 'Clowder 协同猫', name: '多智能体协同日志.md', size: '18 KB', type: 'file', time: 1780490800000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' }
      ],
      '3': [
        { id: '301', senderId: 'ds', senderName: 'DeepSeek', content: '你好！我是您的AI小助手，随时为您服务。输入您的问题，我将竭诚为您解答！', type: 'text', time: 1780489000000, status: 'success', reactions: [], replyRef: null, mentions: [], senderAvatar: '' }
      ]
    }
  }),
  actions: {
    appendLocalMessage(conversationId, text, sender = { id: 'me', name: '我' }, type = 'text', extra = {}) {
      if (!this.messages[conversationId]) {
        this.messages[conversationId] = [];
      }
      const clientMsgNo = extra.clientMsgNo || createClientMsgNo();

      const newMsg = defaultMsg({
        id: extra.id || clientMsgNo,
        clientMsgNo,
        senderId: sender.id,
        senderName: sender.name,
        senderAvatar: sender.avatar || '',
        content: text,
        type,
        time: Date.now(),
        status: 'sending',
        ...extra
      });

      this.messages[conversationId].push(newMsg);
      return newMsg;
    },
    sendMessage(conversationId, text, sender = { id: 'me', name: '我' }, type = 'text', extra = {}) {
      const newMsg = this.appendLocalMessage(conversationId, text, sender, type, extra);

      // Simulate sending latency
      setTimeout(() => {
        newMsg.status = 'success';
      }, 500);

      return newMsg;
    },
    async sendNativeMessage(conversationOrId, payload, sender = { id: 'me', name: '我' }) {
      const convStore = useConversationStore();
      const identity = convStore.getConversationIdentity(conversationOrId);
      const conversationId = identity.conversationId;
      const currentUser = readCurrentUser();
      const selfSender = resolveOutboundSender(currentUser, sender);
      const local = this.appendLocalMessage(conversationId, payload.content, selfSender, payload.type, {
        replyRef: payload.replyRef || null,
        mentions: payload.mentions || [],
        fileName: payload.fileName,
        fileSize: payload.fileSize,
        fileSizeBytes: payload.fileSizeBytes || 0,
        previewContent: payload.previewContent || '',
        fileType: payload.fileType || '',
        mimeType: payload.mimeType || '',
        path: payload.path || '',
        file: payload.file,
        url: payload.url || ''
      });

      const conversation = findConversation(convStore, conversationId);
      if (conversation) {
        updateConversationSummary(conversation, local, currentUser);
      }

      if (payload.type !== 'text') {
        if (shouldUseLocalMockMediaSuccess(conversation, payload)) {
          local.status = 'success';
          local.nativeError = '';
          this.syncError = '';
          return local;
        }
        try {
          let remoteUrl = payload.url || payload.content || '';
          const needsUpload = payload.file || payload.path || isLocalMediaUrl(remoteUrl);
          if (needsUpload) {
            const uploaded = await nativeImService.uploadChatFile({
              channelId: identity.channelId,
              channelType: identity.channelType,
              file: {
                ...(payload.file || {}),
                path: payload.path || payload.file?.path || payload.file?.tempFilePath || remoteUrl,
                tempFilePath: payload.path || payload.file?.tempFilePath || remoteUrl,
                name: payload.fileName || payload.file?.name || (payload.type === 'image' ? 'image.png' : 'file'),
                size: payload.fileSizeBytes || payload.file?.size || 0,
                type: payload.mimeType || payload.file?.type || ''
              }
            });
            remoteUrl = uploaded.url;
            local.url = remoteUrl;
            if (payload.type === 'image') local.content = remoteUrl;
            if (payload.type === 'file') {
              local.fileName = uploaded.fileName || uploaded.name || local.fileName;
              local.fileSize = payload.fileSize || local.fileSize;
            }
          }
          const sent = await nativeImService.sendMediaMessage({
            channelId: identity.channelId,
            channelType: identity.channelType,
            mediaType: payload.type,
            url: remoteUrl,
            fileName: payload.fileName || local.fileName,
            fileSize: payload.fileSizeBytes || 0
          });
          const sentMessage = defaultMsg({
            ...sent,
            id: sent.id || local.id,
            senderId: selfSender.id,
            senderName: selfSender.name,
            senderAvatar: selfSender.avatar,
            status: resolveLocalSendStatus(sent, conversation),
            time: sent.time || local.time,
            content: payload.type === 'image' ? (sent.url || remoteUrl) : (payload.content || sent.content || payload.fileName),
            url: sent.url || remoteUrl,
            fileName: payload.fileName || sent.fileName || local.fileName,
            fileSize: payload.fileSize || local.fileSize,
            fileType: payload.fileType || local.fileType,
            previewContent: payload.previewContent || local.previewContent
          });
          this.messages[conversationId] = mergeNativeMessageIntoList(
            this.messages[conversationId] || [],
            sentMessage,
            { currentUser, conversation }
          );
        } catch (error) {
          if (shouldKeepLocalSendSuccess(error, conversation)) {
            local.status = 'success';
            local.nativeError = '';
            this.syncError = '';
          } else {
            local.status = 'failed';
            local.nativeError = errorText(error);
            this.syncError = errorText(error);
          }
        }
        return local;
      }

      try {
        const routeContext = conversation || identity;
        const sent = isClowderDirectCatConversation(routeContext)
          ? await nativeImService.sendClowderConversationMessage({
            channelId: identity.channelId,
            channelType: identity.channelType,
            text: payload.content,
            directCatId: resolveClowderDirectCatId(routeContext),
            promptContext: payload.promptContext
          })
          : await nativeImService.sendTextMessage({
            channelId: identity.channelId,
            channelType: identity.channelType,
            content: payload.content
          });
        const sentMessage = defaultMsg({
          ...sent,
          id: sent.id || local.id,
          senderId: selfSender.id,
          senderName: selfSender.name,
          senderAvatar: selfSender.avatar,
          status: resolveLocalSendStatus(sent, conversation),
          time: sent.time || local.time
        });
        this.messages[conversationId] = mergeNativeMessageIntoList(
          this.messages[conversationId] || [],
          sentMessage,
          { currentUser, conversation }
        );
      } catch (error) {
        if (shouldKeepLocalSendSuccess(error, conversation)) {
          local.status = 'success';
          local.nativeError = '';
          this.syncError = '';
        } else {
          local.status = 'failed';
          local.nativeError = errorText(error);
          this.syncError = errorText(error);
        }
      }
      return local;
    },
    async syncNativeMessages(conversationOrId, options = {}) {
      const convStore = useConversationStore();
      const identity = convStore.getConversationIdentity(conversationOrId);
      if (!identity.channelId) return [];
      if (!options.silent) this.syncState = 'syncing';
      this.syncError = '';
      try {
        const currentUser = readCurrentUser();
        const conversation = findConversation(convStore, identity.conversationId);
        const synced = (await nativeImService.syncMessages(identity.channelId, identity.channelType, {
          limit: options.limit || 30,
          startSeq: options.startSeq || 0,
          endSeq: options.endSeq || 0,
          pullMode: options.pullMode
        })).map((message) => defaultMsg(enrichNativeMessageSender(message, conversation, currentUser)));
        const localPending = (this.messages[identity.conversationId] || []).filter((message) => (
          message.status === 'sending' || message.status === 'failed'
        ));
        this.messages[identity.conversationId] = synced.length
          ? mergeNativeMessageLists(localPending, synced, { currentUser, conversation })
          : this.messages[identity.conversationId] || [];
        const latest = (this.messages[identity.conversationId] || []).filter(isVisibleChatMessage).at(-1);
        updateConversationSummary(conversation, latest, currentUser);
        this.syncState = 'success';
        return this.messages[identity.conversationId];
      } catch (error) {
        this.syncState = 'failed';
        this.syncError = errorText(error);
        if (!options.silent) throw error;
        return this.messages[identity.conversationId] || [];
      }
    },
    receiveNativeMessage(nativeMessage) {
      const convStore = useConversationStore();
      const currentUser = readCurrentUser();
      const channelId = nativeMessage.channelId || nativeMessage.channel_id || nativeMessage.channel?.channelID || nativeMessage.from_uid || nativeMessage.fromUID;
      if (!channelId) return null;
      const channelType = Number(nativeMessage.channelType || nativeMessage.channel_type || nativeMessage.channel?.channelType || 1);
      const existingConversation = convStore.conversations.find((item) => (
        (item.channelId || item.id) === String(channelId)
          && Number(item.channelType || (item.type === 'group' ? 2 : 1)) === channelType
      ));
      const fromSelf = isSelfSender(nativeMessage.senderId || nativeMessage.from_uid || nativeMessage.fromUID, currentUser);
      const conversation = convStore.upsertNativeConversation({
        id: String(channelId),
        channelId: String(channelId),
        channelType,
        type: channelType === 2 ? 'group' : 'single',
        name: existingConversation?.name || (fromSelf ? String(channelId) : nativeMessage.senderName) || String(channelId),
        avatar: existingConversation?.avatar || (fromSelf ? '' : nativeMessage.senderAvatar) || '',
        lastMessage: messageSummary(nativeMessage),
        lastTime: nativeMessage.time || Date.now(),
        unread: 0
      });
      const conversationId = conversation?.id || String(channelId);
      const received = defaultMsg({
        status: 'success',
        ...enrichNativeMessageSender(nativeMessage, conversation, currentUser),
        time: nativeMessage.time || Date.now()
      });
      this.messages[conversationId] = mergeNativeMessageIntoList(
        this.messages[conversationId] || [],
        received,
        { currentUser, conversation }
      );
      const visibleReceived = isVisibleChatMessage(received);
      if (conversation) {
        updateConversationSummary(conversation, received, currentUser);
        if (visibleReceived && convStore.activeId !== conversationId) {
          conversation.unread = (conversation.unread || 0) + 1;
        }
        if (visibleReceived && !conversation.isMuted) {
          notifyMessage({ conversation, message: received });
        }
      }
      return received;
    },
    receiveAgentReplyEvent(conversationId, event = {}) {
      if (!conversationId) return [];
      const convStore = useConversationStore();
      if (!this.messages[conversationId]) this.messages[conversationId] = [];

      this.messages[conversationId] = mergeAgentReplyEventIntoList(this.messages[conversationId], event);
      const conversation = findConversation(convStore, conversationId);
      const latest = this.messages[conversationId]?.at(-1);
      if (conversation && latest) {
        updateConversationSummary(conversation, latest, readCurrentUser());
      }
      return this.messages[conversationId];
    },
    startClowderMarkdownStream(conversationId, prompt = '', options = {}) {
      if (!conversationId) return [];
      const events = createClowderMarkdownStreamEvents(prompt, options);
      const intervalMs = Number(options.intervalMs ?? 120);
      events.forEach((event, index) => {
        const deliver = () => this.receiveAgentReplyEvent(conversationId, event);
        if (options.immediate) {
          deliver();
        } else {
          setTimeout(deliver, Math.max(0, intervalMs) * index);
        }
      });
      return events;
    },
    updateNativeSendStatus(ack = {}) {
      if (!ack.clientSeq) return null;
      const success = Number(ack.reasonCode) === 1;
      for (const [conversationId, list] of Object.entries(this.messages)) {
        const message = list.find((item) => Number(item.clientSeq || 0) === Number(ack.clientSeq));
        if (!message) continue;
        message.status = success ? 'success' : 'failed';
        if (ack.messageId) {
          message.messageId = String(ack.messageId);
          message.id = String(ack.messageId);
        }
        if (ack.messageSeq) message.messageSeq = Number(ack.messageSeq);
        const convStore = useConversationStore();
        const conversation = findConversation(convStore, conversationId);
        if (conversation) {
          updateConversationSummary(conversation, message, readCurrentUser());
        }
        return message;
      }
      return null;
    },
    receiveMessage(conversationId, msg) {
      if (!this.messages[conversationId]) {
        this.messages[conversationId] = [];
      }
      const receivedMsg = defaultMsg({
        time: Date.now(),
        status: 'success',
        ...msg
      });
      this.messages[conversationId].push(receivedMsg);

      const convStore = useConversationStore();
      const conversation = convStore.conversations.find((item) => item.id === conversationId);
      if (conversation) {
        conversation.lastMessage = messageSummary(receivedMsg);
        conversation.lastTime = receivedMsg.time;
        if (convStore.activeId !== conversationId) {
          conversation.unread = (conversation.unread || 0) + 1;
        }
        if (!conversation.isMuted) {
          notifyMessage({ conversation, message: receivedMsg });
        }
      }
      return receivedMsg;
    },
    // PR-9 新增 actions
    reactMessage(conversationId, messageId, emoji, userId = 'me') {
      const list = this.messages[conversationId];
      if (!list) return;
      const msg = list.find((m) => m.id === messageId);
      if (!msg) return;
      if (!msg.reactions) msg.reactions = [];
      const existing = msg.reactions.find((r) => r.emoji === emoji);
      if (existing) {
        if (existing.userIds.includes(userId)) {
          existing.userIds = existing.userIds.filter((u) => u !== userId);
          existing.count = Math.max(0, existing.count - 1);
          if (existing.count === 0) {
            msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
          }
        } else {
          existing.userIds.push(userId);
          existing.count += 1;
        }
      } else {
        msg.reactions.push({ emoji, userIds: [userId], count: 1 });
      }
    },
    unreactMessage(conversationId, messageId, emoji, userId = 'me') {
      this.reactMessage(conversationId, messageId, emoji, userId);
    },
    revokeMessage(conversationId, messageId) {
      const list = this.messages[conversationId];
      if (!list) return;
      const msg = list.find((m) => m.id === messageId);
      if (!msg) return;
      msg.status = 'revoked';
      msg.type = 'system';
      msg.content = '你撤回了一条消息';
    },
    deleteMessage(conversationId, messageId) {
      const list = this.messages[conversationId];
      if (!list) return;
      this.messages[conversationId] = list.filter((m) => m.id !== messageId);
    },
    editMessage(conversationId, messageId, newContent) {
      const list = this.messages[conversationId];
      if (!list) return;
      const msg = list.find((m) => m.id === messageId);
      if (!msg) return;
      msg.content = newContent;
      msg.status = 'edited';
    }
  }
});
