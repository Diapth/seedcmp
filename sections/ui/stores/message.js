import { defineStore } from 'pinia';
import { useConversationStore } from '@/stores/conversation';
import { useGroupStore } from '@/stores/group';
import { notifyMessage } from '@/composables/useSystemNotification';
import { nativeImService } from '@/services/native-im/service';
import {
  deploymentFailedPatch,
  isDeploymentCardMessage,
  shouldCreateDeploymentCard,
  updateDeploymentCardMessage,
  upsertDeploymentCardMessage,
  deploymentCardId,
  normalizeDeploymentRequest,
  buildDeploymentCardMessage
} from '@/services/native-im/deployment';
import {
  buildProjectGroupConfirmationInput,
  buildProjectGroupEnsurePayload,
  isProjectGroupConfirmationMessage,
  projectGroupCreatedPatch,
  projectGroupFailedPatch,
  resolveProjectGroupTextConfirmation,
  updateProjectGroupConfirmationMessage,
  updateProjectGroupProposalMessage,
  upsertProjectGroupConfirmationMessage
} from '@/services/native-im/project-group';
import {
  buildAgentPayloadFromTemplate,
  buildCoordinatorTemplateCatsRequestInput,
  isCoordinatorTemplateCatsConfirmationMessage,
  shouldCreateCoordinatorTemplateCatsRequest,
  updateCoordinatorTemplateCatsMessage,
  upsertCoordinatorTemplateCatsMessage
} from '@/services/native-im/coordinator-template-cats';
import {
  applyManualContextPinsToMessages,
  buildManualContextPinPayload,
  normalizeManualContextPin,
  resolveConversationThreadId
} from '@/services/native-im/manual-context-pins';
import {
  conversationSummaryForMessage,
  createClowderMarkdownStreamEvents,
  createClientMsgNo,
  enrichNativeMessageSender,
  isClowderConversation,
  isClowderDirectCatConversation,
  isVisibleChatMessage,
  isSelfSender,
  applyAgentPendingFeedbackIntoList,
  clearAgentPendingFeedbackFromList,
  mergeNativeMessageIntoList,
  mergeSyncedMessagesPreservingLocalContext,
  mergeAgentReplyEventIntoList,
  readClowderPromptContext,
  rememberClowderPromptContext,
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
  if (isDeploymentCardMessage(message)) return message.content || '部署确认卡';
  if (isProjectGroupConfirmationMessage(message)) return message.content || '项目群确认卡';
  if (isCoordinatorTemplateCatsConfirmationMessage(message)) return message.content || '缺失模板猫猫确认卡';
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

function storageRuntime() {
  return typeof uni === 'undefined' ? null : uni;
}

function findConversation(convStore, conversationId) {
  return convStore.conversations.find((item) => item.id === conversationId) || null;
}

function cleanCatId(value = '') {
  return String(value || '').trim().replace(/^clowder_cat:/, '');
}

function firstText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function matchingAgentsForCatIds(agents = [], catIds = []) {
  const wanted = new Set((catIds || []).map(cleanCatId).filter(Boolean));
  if (!wanted.size) return [];
  return agents.filter((agent) => {
    const ids = [
      agent.id,
      agent.uid,
      agent.catId,
      agent.cat_id,
      agent.directCatId,
      agent.direct_cat_id,
      agent.agentId,
      agent.agent_id
    ].map(cleanCatId).filter(Boolean);
    return ids.some((id) => wanted.has(id));
  });
}

function shouldCacheClowderPrompt(conversation = {}) {
  return isClowderConversation(conversation) || isClowderDirectCatConversation(conversation);
}

function rememberPromptContext(conversationId, message, currentUser, conversation) {
  if (!conversationId || !message || !shouldCacheClowderPrompt(conversation)) return;
  rememberClowderPromptContext(storageRuntime(), conversationId, message, currentUser);
}

function readPromptContext(conversationId, currentUser, conversation) {
  if (!conversationId || !shouldCacheClowderPrompt(conversation)) return [];
  return readClowderPromptContext(storageRuntime(), conversationId, currentUser);
}

function messageTargetId(message = {}) {
  return firstText(message.messageId, message.id, message.clientMsgNo, message.client_msg_no);
}

function messageTargetIds(message = {}) {
  return new Set([
    message.messageId,
    message.id,
    message.clientMsgNo,
    message.client_msg_no
  ].map((value) => firstText(value)).filter(Boolean));
}

function agentFeedbackId(agent = {}, conversation = {}) {
  const id = firstText(
    agent.directCatId,
    agent.direct_cat_id,
    agent.catId,
    agent.cat_id,
    agent.agentId,
    agent.agent_id,
    agent.id,
    agent.uid,
    conversation.directCatId,
    conversation.direct_cat_id,
    conversation.catId,
    conversation.cat_id,
    resolveClowderDirectCatId(conversation),
    conversation.id,
    conversation.channelId,
    'clowder'
  );
  return cleanCatId(id);
}

function resolveConversationForPins(convStore, conversationOrId) {
  if (!conversationOrId) return null;
  if (typeof conversationOrId === 'string') {
    return findConversation(convStore, conversationOrId) || {
      id: conversationOrId,
      channelId: conversationOrId,
      channelType: 1
    };
  }
  return conversationOrId;
}

function conversationMessageListId(conversation = {}, fallback = '') {
  return firstText(conversation.id, conversation.conversationId, conversation.channelId, fallback);
}

function activeManualContextPins(pins = []) {
  return (pins || []).map(normalizeManualContextPin).filter((pin) => pin.status === 'active');
}

function messagePinIdFromPins(message = {}, pins = []) {
  const ids = new Set([
    message.messageId,
    message.message_id,
    message.id,
    message.clientMsgNo,
    message.client_msg_no
  ].map((value) => firstText(value)).filter(Boolean));
  const pin = activeManualContextPins(pins).find((item) => ids.has(item.messageId));
  return pin?.id || '';
}

export const useMessageStore = defineStore('message', {
  state: () => ({
    syncState: 'idle',
    syncError: '',
    manualContextPinsByThread: {},
    manualContextPinSyncStateByThread: {},
    manualContextPinErrorsByThread: {},
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
    manualContextThreadId(conversationOrId) {
      const convStore = useConversationStore();
      const conversation = resolveConversationForPins(convStore, conversationOrId);
      return resolveConversationThreadId(conversation || {});
    },
    applyManualContextPinMarks(conversationOrId) {
      const convStore = useConversationStore();
      const conversation = resolveConversationForPins(convStore, conversationOrId);
      const conversationId = conversationMessageListId(conversation, typeof conversationOrId === 'string' ? conversationOrId : '');
      const threadId = resolveConversationThreadId(conversation || {});
      if (!conversationId || !this.messages[conversationId]) return [];
      const pins = threadId ? activeManualContextPins(this.manualContextPinsByThread[threadId] || []) : [];
      this.messages[conversationId] = applyManualContextPinsToMessages(this.messages[conversationId] || [], pins);
      return this.messages[conversationId];
    },
    async syncManualContextPins(conversationOrId, options = {}) {
      const convStore = useConversationStore();
      const conversation = resolveConversationForPins(convStore, conversationOrId);
      const conversationId = conversationMessageListId(conversation, typeof conversationOrId === 'string' ? conversationOrId : '');
      const threadId = resolveConversationThreadId(conversation || {});
      if (!threadId) return [];
      this.manualContextPinSyncStateByThread[threadId] = 'syncing';
      this.manualContextPinErrorsByThread[threadId] = '';
      try {
        const pins = await nativeImService.listManualContextPins(threadId, {
          limit: options.limit || 5,
          includeInactive: Boolean(options.includeInactive)
        });
        this.manualContextPinsByThread[threadId] = activeManualContextPins(pins);
        if (conversationId) this.applyManualContextPinMarks(conversation || conversationId);
        this.manualContextPinSyncStateByThread[threadId] = 'success';
        return this.manualContextPinsByThread[threadId];
      } catch (error) {
        this.manualContextPinSyncStateByThread[threadId] = 'failed';
        this.manualContextPinErrorsByThread[threadId] = errorText(error);
        if (!options.silent) throw error;
        return this.manualContextPinsByThread[threadId] || [];
      }
    },
    async pinMessageAsContext(conversationOrId, message = {}) {
      const convStore = useConversationStore();
      const conversation = resolveConversationForPins(convStore, conversationOrId);
      const conversationId = conversationMessageListId(conversation, typeof conversationOrId === 'string' ? conversationOrId : '');
      const threadId = resolveConversationThreadId(conversation || {});
      if (!threadId) throw { msg: '当前会话未绑定Clowder thread，无法设为长期上下文' };
      const payload = buildManualContextPinPayload(message, conversation || {});
      if (!payload) throw { msg: '这条消息没有可保存的长期上下文内容' };
      const pin = normalizeManualContextPin(await nativeImService.upsertManualContextPin(threadId, payload));
      const existing = activeManualContextPins(this.manualContextPinsByThread[threadId] || [])
        .filter((item) => item.id !== pin.id && item.messageId !== pin.messageId);
      this.manualContextPinsByThread[threadId] = [pin, ...existing].slice(0, 5);
      if (conversationId) this.applyManualContextPinMarks(conversation || conversationId);
      return pin;
    },
    async unpinMessageAsContext(conversationOrId, messageOrPinId = {}) {
      const convStore = useConversationStore();
      const conversation = resolveConversationForPins(convStore, conversationOrId);
      const conversationId = conversationMessageListId(conversation, typeof conversationOrId === 'string' ? conversationOrId : '');
      const threadId = resolveConversationThreadId(conversation || {});
      if (!threadId) throw { msg: '当前会话未绑定Clowder thread，无法取消长期上下文' };
      const pins = activeManualContextPins(this.manualContextPinsByThread[threadId] || []);
      const pinId = typeof messageOrPinId === 'string'
        ? messageOrPinId
        : firstText(messageOrPinId.manualContextPinId, messagePinIdFromPins(messageOrPinId, pins));
      if (!pinId) throw { msg: '未找到长期上下文记录' };
      await nativeImService.removeManualContextPin(threadId, pinId);
      this.manualContextPinsByThread[threadId] = pins.filter((pin) => pin.id !== pinId);
      if (conversationId) this.applyManualContextPinMarks(conversation || conversationId);
      return { removed: true, pinId };
    },
    async markManualContextSourceDeleted(conversationOrId, message = {}) {
      const convStore = useConversationStore();
      const conversation = resolveConversationForPins(convStore, conversationOrId);
      const conversationId = conversationMessageListId(conversation, typeof conversationOrId === 'string' ? conversationOrId : '');
      const threadId = resolveConversationThreadId(conversation || {});
      if (!threadId) return [];
      const pins = activeManualContextPins(this.manualContextPinsByThread[threadId] || []);
      const pinId = firstText(message.manualContextPinId, messagePinIdFromPins(message, pins));
      if (!pinId) return pins;
      const messageId = firstText(message.messageId, message.message_id, message.id, message.clientMsgNo, message.client_msg_no);
      if (!messageId) return pins;
      try {
        const nextPins = await nativeImService.markManualContextPinSourceStatus(threadId, {
          messageId,
          status: 'source_deleted'
        });
        this.manualContextPinsByThread[threadId] = activeManualContextPins(nextPins);
      } catch {
        this.manualContextPinsByThread[threadId] = pins.filter((pin) => pin.id !== pinId);
      }
      if (conversationId) this.applyManualContextPinMarks(conversation || conversationId);
      return this.manualContextPinsByThread[threadId] || [];
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
          this.applyManualContextPinMarks(conversation || identity);
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
        if (sentMessage.status === 'success') {
          rememberPromptContext(conversationId, sentMessage, currentUser, routeContext);
        }
        this.messages[conversationId] = mergeNativeMessageIntoList(
          this.messages[conversationId] || [],
          sentMessage,
          { currentUser, conversation }
        );
        this.applyManualContextPinMarks(routeContext);
        if (sentMessage.status === 'success' && isClowderDirectCatConversation(routeContext)) {
          this.startAgentPendingFeedback(conversationId, sentMessage, {
            id: agentFeedbackId(routeContext, routeContext),
            name: routeContext.name || 'Clowder AI'
          });
        }
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
    startAgentPendingFeedback(conversationId, sourceMessage = {}, agent = {}, options = {}) {
      if (!conversationId || !sourceMessage || sourceMessage.status === 'failed') return null;
      const targetMessageId = messageTargetId(sourceMessage);
      if (!targetMessageId) return null;
      const conversation = findConversation(useConversationStore(), conversationId) || {};
      const agentId = agentFeedbackId(agent, conversation);
      const streamKey = firstText(options.streamKey, `pending:${conversationId}:${targetMessageId}:${agentId}`);
      this.messages[conversationId] = applyAgentPendingFeedbackIntoList(this.messages[conversationId] || [], {
        targetMessageId,
        agentId,
        emoji: options.emoji || '👀',
        streamKey,
        expiresAt: options.expiresAt || Date.now() + Number(options.timeoutMs || 60000)
      });
      return (this.messages[conversationId] || []).find((message) => (
        messageTargetIds(message).has(targetMessageId)
      )) || null;
    },
    clearAgentPendingFeedback(conversationId, targetMessageId, agentId = '') {
      if (!conversationId || !targetMessageId) return null;
      this.messages[conversationId] = clearAgentPendingFeedbackFromList(this.messages[conversationId] || [], {
        targetMessageId,
        agentId
      });
      return (this.messages[conversationId] || []).find((message) => messageTargetIds(message).has(targetMessageId)) || null;
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
        const routeContext = conversation || identity;
        const synced = (await nativeImService.syncMessages(identity.channelId, identity.channelType, {
          limit: options.limit || 30,
          startSeq: options.startSeq || 0,
          endSeq: options.endSeq || 0,
          pullMode: options.pullMode
        })).map((message) => defaultMsg(enrichNativeMessageSender(message, conversation, currentUser)));
        const preservedContextMessages = readPromptContext(identity.conversationId, currentUser, routeContext);
        this.messages[identity.conversationId] = synced.length
          ? mergeSyncedMessagesPreservingLocalContext(this.messages[identity.conversationId] || [], synced, { currentUser, conversation: routeContext, preservedContextMessages })
          : this.messages[identity.conversationId] || [];
        this.applyManualContextPinMarks(routeContext);
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
      this.applyManualContextPinMarks(conversation);
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
      this.applyManualContextPinMarks(conversation || conversationId);
      const latest = this.messages[conversationId]?.at(-1);
      if (conversation && latest) {
        updateConversationSummary(conversation, latest, readCurrentUser());
      }
      return this.messages[conversationId];
    },
    createProjectGroupConfirmation(conversationId, card = {}) {
      if (!conversationId) return null;
      this.messages[conversationId] = upsertProjectGroupConfirmationMessage(this.messages[conversationId] || [], card);
      return this.messages[conversationId].find(isProjectGroupConfirmationMessage) || null;
    },
    updateProjectGroupConfirmation(conversationId, cardId, patch = {}) {
      if (!conversationId || !cardId) return null;
      this.messages[conversationId] = updateProjectGroupConfirmationMessage(this.messages[conversationId] || [], cardId, patch);
      return (this.messages[conversationId] || []).find((message) => (
        message.id === cardId || message.projectGroupCard?.cardId === cardId
      )) || null;
    },
    updateProjectGroupProposal(conversationId, proposalId, patch = {}) {
      if (!conversationId || !proposalId) return null;
      this.messages[conversationId] = updateProjectGroupProposalMessage(this.messages[conversationId] || [], proposalId, patch);
      return (this.messages[conversationId] || []).find((message) => (
        message.id === proposalId || message.proposalCard?.proposalId === proposalId || message.proposalCard?.id === proposalId
      )) || null;
    },
    createCoordinatorTemplateCatsRequest(conversationId, input = {}) {
      if (!conversationId) return null;
      this.messages[conversationId] = upsertCoordinatorTemplateCatsMessage(this.messages[conversationId] || [], input);
      return (this.messages[conversationId] || []).find(isCoordinatorTemplateCatsConfirmationMessage) || null;
    },
    updateCoordinatorTemplateCatsRequest(conversationId, cardId, patch = {}) {
      if (!conversationId || !cardId) return null;
      this.messages[conversationId] = updateCoordinatorTemplateCatsMessage(this.messages[conversationId] || [], cardId, patch);
      return (this.messages[conversationId] || []).find((message) => (
        message.id === cardId || message.coordinatorTemplateCatsCard?.cardId === cardId
      )) || null;
    },
    async maybeCreateCoordinatorTemplateCatsRequest(conversation = {}, text = '', sourceMessage = {}, options = {}) {
      const conversationId = conversation?.id || conversation?.conversationId || '';
      if (!conversationId || sourceMessage?.status === 'failed') return null;
      const agent = options.agent || conversation;
      if (!shouldCreateCoordinatorTemplateCatsRequest({ conversation, agent, text })) return null;

      const availableAgents = Array.isArray(options.availableAgents) ? options.availableAgents : [];
      let templates = Array.isArray(options.templates) ? options.templates : [];
      if (!templates.length) {
        try {
          templates = await nativeImService.fetchClowderCatTemplates();
        } catch {
          templates = [];
        }
      }

      const cardInput = buildCoordinatorTemplateCatsRequestInput({
        conversation,
        coordinator: agent,
        sourceMessage,
        text,
        availableAgents,
        templates
      });

      if (!cardInput.items.length) return null;
      return this.createCoordinatorTemplateCatsRequest(conversationId, cardInput);
    },
    async confirmCoordinatorTemplateCatsRequest(conversationId, cardId, options = {}) {
      const list = this.messages[conversationId] || [];
      const message = list.find((item) => item.id === cardId || item.coordinatorTemplateCatsCard?.cardId === cardId);
      const card = message?.coordinatorTemplateCatsCard;
      if (!card) return null;
      if (card.status === 'creating' || card.status === 'created') return message;

      const baseItems = (card.items || []).map((item) => ({ ...item, status: 'creating', error: '' }));
      this.updateCoordinatorTemplateCatsRequest(conversationId, cardId, {
        status: 'creating',
        error: '',
        items: baseItems
      });

      const profile = card.coordinatorProfile || {};
      const onCreateAgent = typeof options.createAgent === 'function' ? options.createAgent : null;
      const results = [];
      let createdCount = 0;
      let failedCount = 0;

      for (const item of baseItems) {
        const template = item.template
          || item
          || { id: item.templateId, roleTemplateId: item.roleTemplateId, name: item.name };
        const payload = buildAgentPayloadFromTemplate(template, profile, options.payloadOverrides || {});
        try {
          let createdId = '';
          if (onCreateAgent) {
            createdId = await onCreateAgent(payload, template);
          } else {
            const created = await nativeImService.createClowderCat(payload);
            createdId = created?.id || created?.catId || '';
          }
          if (!createdId) throw { msg: '未返回猫猫 ID' };
          createdCount += 1;
          results.push({ ...item, status: 'created', agentId: String(createdId), error: '' });
        } catch (error) {
          failedCount += 1;
          const errorText = error?.msg || error?.message || error?.error || '创建模板猫猫失败';
          results.push({ ...item, status: 'failed', agentId: '', error: errorText });
        }
      }

      const finalStatus = failedCount === 0
        ? 'created'
        : (createdCount === 0 ? 'failed' : 'partial');
      return this.updateCoordinatorTemplateCatsRequest(conversationId, cardId, {
        status: finalStatus,
        items: results,
        error: failedCount && createdCount === 0 ? '所有缺失模板猫猫创建失败' : ''
      });
    },
    cancelCoordinatorTemplateCatsRequest(conversationId, cardId) {
      return this.updateCoordinatorTemplateCatsRequest(conversationId, cardId, {
        status: 'cancelled',
        error: ''
      });
    },
    createDeploymentCard(conversationId, input = {}) {
      if (!conversationId) return null;
      this.messages[conversationId] = upsertDeploymentCardMessage(this.messages[conversationId] || [], input);
      return (this.messages[conversationId] || []).find((message) => (
        isDeploymentCardMessage(message)
        && message.deploymentCard?.deploymentRequestId === normalizeDeploymentRequest(input.deploymentRequest || input).id
      )) || null;
    },
    updateDeploymentCard(conversationId, cardId, patch = {}) {
      if (!conversationId || !cardId) return null;
      this.messages[conversationId] = updateDeploymentCardMessage(this.messages[conversationId] || [], cardId, patch);
      return (this.messages[conversationId] || []).find((message) => (
        message.id === cardId || message.deploymentCard?.cardId === cardId || message.deploymentCard?.deploymentRequestId === cardId
      )) || null;
    },
    async createDeploymentCardFromPrompt(conversation = {}, text = '', sourceMessage = {}, options = {}) {
      const conversationId = conversation?.id || conversation?.conversationId || '';
      if (!conversationId || sourceMessage?.status === 'failed') return null;
      if (!shouldCreateDeploymentCard({ conversation, text })) return null;
      const agent = options.agent || conversation;
      try {
        const sourceMessageId = firstText(sourceMessage.messageId, sourceMessage.id, sourceMessage.clientMsgNo);
        const payload = {
          channelId: firstText(conversation.channelId, conversation.id),
          channelType: Number(conversation.channelType || conversation.channel_type || 1),
          sourceMessageId,
          cardMessageId: deploymentCardId(sourceMessageId || sourceMessage.clientMsgNo),
          originalText: String(text || '').trim(),
          target: options.target || '当前项目',
          environment: options.environment || 'preview',
          directCatId: cleanCatId(firstText(agent.directCatId, agent.catId, agent.id, conversation.directCatId, conversation.catId, conversation.id))
        };
        Object.keys(payload).forEach((key) => {
          if (payload[key] === '' || payload[key] === undefined || payload[key] === null) delete payload[key];
        });
        const deploymentRequest = await nativeImService.createDeploymentRequest(payload);
        return this.createDeploymentCard(conversationId, {
          deploymentRequest,
          sourceMessage,
          conversation,
          agent
        });
      } catch (error) {
        const fallbackId = deploymentCardId(firstText(sourceMessage.messageId, sourceMessage.id, sourceMessage.clientMsgNo, Date.now()));
        const fallbackMessage = buildDeploymentCardMessage({
          id: fallbackId.replace(/^deployment-card-/, ''),
          target: '当前项目',
          environment: 'preview',
          missingFields: [],
          status: 'failed',
          originalText: text,
          failureReason: errorText(error)
        }, { sourceMessage, conversation, agent });
        this.messages[conversationId] = upsertDeploymentCardMessage(this.messages[conversationId] || [], {
          deploymentRequest: fallbackMessage.deploymentCard.deploymentRequest,
          sourceMessage,
          conversation,
          agent
        });
        return this.updateDeploymentCard(conversationId, fallbackMessage.id, deploymentFailedPatch(error));
      }
    },
    async handleDeploymentAction(conversationId, cardId, action = 'confirm') {
      const list = this.messages[conversationId] || [];
      const message = list.find((item) => item.id === cardId || item.deploymentCard?.cardId === cardId);
      const card = message?.deploymentCard;
      if (!card) return null;
      if (['running', 'queued', 'confirmed', 'submitting'].includes(card.status) && action === 'confirm') return message;

      this.updateDeploymentCard(conversationId, cardId, { status: 'submitting', failureReason: '' });
      try {
        const response = await nativeImService.sendDeploymentAction({
          deploymentRequestId: card.deploymentRequestId,
          channelId: card.directChannelId,
          channelType: Number(card.directChannelType || 1),
          action,
          actionId: `${card.deploymentRequestId}:${action}:${Date.now()}`,
          cardMessageId: card.cardId,
          sourceMessageId: card.sourceMessageId,
          target: card.target === '待确认目标' ? '' : card.target,
          environment: card.environment === '待确认环境' ? '' : card.environment,
          directCatId: card.catId
        });
        const deploymentRequest = response.deploymentRequest
          ? response.deploymentRequest
          : normalizeDeploymentRequest({ ...card.deploymentRequest, status: response.status || (action === 'cancel' ? 'cancelled' : 'queued') });
        const updated = this.createDeploymentCard(conversationId, {
          deploymentRequest,
          sourceMessage: { id: card.sourceMessageId, clientMsgNo: card.sourceClientMsgNo, content: card.originalText },
          conversation: {
            id: card.directChannelId,
            channelId: card.directChannelId,
            channelType: card.directChannelType,
            directCatId: card.catId,
            source: 'clowder',
            type: 'robot'
          },
          agent: { id: card.catId, name: card.catDisplayName }
        });
        if (deploymentRequest.id && ['confirmed', 'queued', 'running'].includes(deploymentRequest.status)) {
          try {
            const latest = await nativeImService.fetchDeploymentRequest(deploymentRequest.id);
            return this.createDeploymentCard(conversationId, {
              deploymentRequest: latest,
              sourceMessage: { id: card.sourceMessageId, clientMsgNo: card.sourceClientMsgNo, content: card.originalText },
              conversation: {
                id: card.directChannelId,
                channelId: card.directChannelId,
                channelType: card.directChannelType,
                directCatId: card.catId,
                source: 'clowder',
                type: 'robot'
              },
              agent: { id: card.catId, name: card.catDisplayName }
            });
          } catch {
            return updated;
          }
        }
        return updated;
      } catch (error) {
        return this.updateDeploymentCard(conversationId, cardId, deploymentFailedPatch(error));
      }
    },
    async confirmProjectGroupFromCard(conversationId, cardId, options = {}) {
      const list = this.messages[conversationId] || [];
      const message = list.find((item) => item.id === cardId || item.projectGroupCard?.cardId === cardId);
      const card = message?.projectGroupCard;
      if (!card) return null;
      if (card.status === 'creating' || card.status === 'created') return message;

      this.updateProjectGroupConfirmation(conversationId, cardId, { status: 'creating' });
      try {
        const ensurePayload = buildProjectGroupEnsurePayload(card, {
          currentUser: options.currentUser || readCurrentUser()
        });
        const ensured = await nativeImService.ensureProjectGroup(ensurePayload);
        const createdPatch = projectGroupCreatedPatch(ensured, card);
        const groupId = createdPatch.projectGroupNo;
        if (!groupId) throw { msg: '项目群编号缺失' };

        const groupName = createdPatch.projectGroupName || card.projectName || 'Clowder 项目群';
        const catIds = createdPatch.catMemberIds?.length
          ? createdPatch.catMemberIds
          : (card.catMemberIds || card.targetCatIds || card.workerCatIds || []);
        const agents = matchingAgentsForCatIds(options.agents || [], catIds);

        await nativeImService.syncGroupCats({
          groupId,
          groupName,
          catIds,
          agents,
          prompt: `项目群「${groupName}」已创建，请按用户原始任务协作执行。`,
          proactiveReplies: true,
          autoReplyMode: 'auto',
          projectThreadId: createdPatch.projectThreadId,
          projectBindingId: createdPatch.projectBindingId
        });

        const memberCount = new Set([...(ensurePayload.userMemberIds || []), ...catIds]).size || undefined;
        const group = {
          id: groupId,
          group_no: groupId,
          name: groupName,
          member_count: memberCount,
          source: 'clowder',
          isProjectGroup: true
        };
        const convStore = useConversationStore();
        const groupStore = useGroupStore();
        groupStore.addGroup(group);
        convStore.upsertGroupConversation(group);
        agents.forEach((agent) => convStore.addAgentMember(groupId, agent));
        groupStore.syncNativeGroupMembers(groupId, { silent: true }).catch(() => {});

        if (card.sourceText) {
          await nativeImService.sendClowderConversationMessage({
            channelId: groupId,
            channelType: 2,
            text: card.sourceText,
            targetCatIds: card.targetCatIds || card.workerCatIds || [],
            promptContext: `项目群：${groupName}`,
            threadId: createdPatch.projectThreadId
          });
        }

        return this.updateProjectGroupConfirmation(conversationId, cardId, createdPatch);
      } catch (error) {
        return this.updateProjectGroupConfirmation(conversationId, cardId, projectGroupFailedPatch(error));
      }
    },
    async handleProjectGroupTextFallback(conversation = {}, text = '', options = {}) {
      const conversationId = firstText(conversation?.id, conversation?.conversationId, conversation?.channelId, options.conversationId);
      if (!conversationId || !text) return null;
      const resolution = resolveProjectGroupTextConfirmation({
        text,
        messages: this.messages[conversationId] || [],
        conversation,
        agent: options.agent || conversation
      });
      if (!resolution) return null;

      if (resolution.action === 'cancel') {
        return this.updateProjectGroupConfirmation(conversationId, resolution.cardId, { status: 'cancelled' });
      }
      if (resolution.action === 'confirm') {
        return this.confirmProjectGroupFromCard(conversationId, resolution.cardId, options);
      }
      if (resolution.action === 'approve_proposal') {
        this.updateProjectGroupProposal(conversationId, resolution.proposalId, { status: 'submitting', error: '' });
        try {
          await nativeImService.approveThreadProposal(resolution.proposalId, {
            userId: options.currentUser?.id || options.currentUser?.uid || options.currentUser?.userId
          });
          return this.updateProjectGroupProposal(conversationId, resolution.proposalId, { status: 'approved', error: '' });
        } catch (error) {
          return this.updateProjectGroupProposal(conversationId, resolution.proposalId, { status: 'failed', error });
        }
      }
      if (resolution.action === 'reject_proposal') {
        this.updateProjectGroupProposal(conversationId, resolution.proposalId, { status: 'submitting', error: '' });
        try {
          await nativeImService.rejectThreadProposal(resolution.proposalId, {
            userId: options.currentUser?.id || options.currentUser?.uid || options.currentUser?.userId,
            reason: text
          });
          return this.updateProjectGroupProposal(conversationId, resolution.proposalId, { status: 'rejected', error: '' });
        } catch (error) {
          return this.updateProjectGroupProposal(conversationId, resolution.proposalId, { status: 'failed', error });
        }
      }
      if (resolution.action === 'cancel_context') {
        const card = this.createProjectGroupConfirmation(conversationId, buildProjectGroupConfirmationInput({
          conversation,
          agent: options.agent || conversation,
          sourceMessage: resolution.sourceMessage,
          text: resolution.sourceText,
          currentUser: options.currentUser || {},
          availableAgents: options.availableAgents || []
        }));
        return this.updateProjectGroupConfirmation(conversationId, card?.projectGroupCard?.cardId || card?.id, { status: 'cancelled' });
      }
      if (resolution.action === 'create_and_confirm') {
        const card = this.createProjectGroupConfirmation(conversationId, buildProjectGroupConfirmationInput({
          conversation,
          agent: options.agent || conversation,
          sourceMessage: resolution.sourceMessage,
          text: resolution.sourceText,
          currentUser: options.currentUser || {},
          availableAgents: options.availableAgents || []
        }));
        const cardId = card?.projectGroupCard?.cardId || card?.id;
        return cardId ? this.confirmProjectGroupFromCard(conversationId, cardId, options) : null;
      }
      return null;
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
      if (msg.manualContextPinned) {
        this.markManualContextSourceDeleted(conversationId, msg).catch(() => {});
      }
      msg.status = 'revoked';
      msg.type = 'system';
      msg.content = '你撤回了一条消息';
      msg.manualContextPinned = false;
      msg.manualContextPinId = '';
    },
    deleteMessage(conversationId, messageId) {
      const list = this.messages[conversationId];
      if (!list) return;
      const msg = list.find((m) => m.id === messageId);
      if (msg?.manualContextPinned) {
        this.markManualContextSourceDeleted(conversationId, msg).catch(() => {});
      }
      this.messages[conversationId] = list.filter((m) => m.id !== messageId);
    },
    clearConversationMessages(conversationId) {
      if (!conversationId) return;
      delete this.messages[conversationId];
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
