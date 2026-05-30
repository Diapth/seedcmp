import { defineStore } from 'pinia';
import { ref } from 'vue';
import WKSDK, { Message as WKMessage, MessageContent, MessageImage } from 'wukongimjssdk';
import { commonApi, resolveApiAssetUrl, syncApi } from '../api';
import { MessageFile, MessageVoice } from '../contentTypes/index';
import { getClowderCatIdFromContactId, isClowderAiContactId, isClowderCatContactId } from './clowderCatContacts';
import { useChannelStore } from './channelStore';
import { useClowderStore } from './clowderStore';
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
  retryable?: boolean;
  retryPayload?: {
    kind: 'text' | 'media' | 'voice';
    text?: string;
    options?: SendMessageOptions;
    file?: File;
    duration?: number;
  };
  reactions?: any[];
  remoteExtra?: any;
  isUnreadCleared?: boolean;
}

interface ConversationSummaryOptions {
  countUnread?: boolean;
}

export interface Reaction {
  emoji: string;
  count: number;
  users?: string[];
  [key: string]: any;
}

const MEDIA_UPLOAD_TYPE = 'chat';
const DEEPSEEK_AI_ROBOT_ID = 'deepseek_ai_robot';
const CLOWDER_CONNECTOR_ID = 'im-web';
const MESSAGE_SYNC_LIMIT = 30;
const VISIBLE_HISTORY_WINDOW_LIMIT = 300;

interface SendMessageOptions {
  mention?: { all?: boolean; uids?: string[] };
  reply?: any;
  robot?: {
    robotId: string;
    command: string;
  };
}

interface SyncMessagesOptions {
  hydrateVisibleHistory?: boolean;
}

export class RobotCommandContent extends MessageContent {
  text: string;
  robotId: string;
  command: string;

  constructor(text: string, robotId: string, command: string) {
    super();
    this.text = text;
    this.robotId = robotId;
    this.command = command;
  }

  get contentType(): number {
    return 1;
  }

  get conversationDigest(): string {
    return this.text;
  }

  encodeJSON() {
    return {
      content: this.text,
      robot_id: this.robotId,
      entities: [{
        type: 'bot_command',
        offset: 0,
        length: [...this.command].length
      }]
    };
  }
}

interface Reminder {
  id: number;
  channel_id: string;
  channel_type: number;
  message_id: string;
  message_seq: number;
  text: string;
  done: number;
  version: number;
  [key: string]: any;
}

function getFileExtension(file: File) {
  const name = file.name || '';
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(dotIndex) : '';
}

function safeUploadSegment(value: string) {
  const normalized = String(value || 'file').trim().replace(/[^\w.-]+/g, '_');
  return normalized || 'file';
}

function buildMediaUploadPath(channelId: string, channelType: number, file: File) {
  const extension = getFileExtension(file);
  const basename = safeUploadSegment(file.name.replace(/\.[^/.]*$/, ''));
  const randomPart = Math.random().toString(16).slice(2);
  return `/${channelType}/${safeUploadSegment(channelId)}/${Date.now()}-${randomPart}-${basename}${extension}`;
}

function extractUploadUrl(response: any) {
  return typeof response === 'string' ? response : response?.url || '';
}

function extractUploadedPath(response: any) {
  if (typeof response === 'string') return response;
  return response?.url || response?.path || response?.file_url || response?.fileURL || '';
}

function normalizeMediaUrl(url: string) {
  return url ? resolveApiAssetUrl(url) : '';
}

export const useMessageStore = defineStore('message', () => {
  const messages = ref<Record<string, Message[]>>({});
  const typingState = ref<Record<string, { timer: any; isTyping: boolean }>>({});
  const receipts = ref<Record<string, { readed: any[]; unread: any[]; unavailable?: boolean }>>({});
  const pinnedMessages = ref<Record<string, Message[]>>({});
  const pinnedVersions = ref<Record<string, number>>({});
  const reminders = ref<Reminder[]>([]);
  const reminderVersion = ref(0);
  const pendingQueue = ref<Array<{ channelId: string; channelType: number; clientMsgNo: string }>>([]);
  const resetVersion = ref(0);
  const summaryVersions = ref<Record<string, number>>({});
  // Tracks clientMsgNos currently being sent from THIS browser tab.
  // Used by the global messageListener to skip own-message duplicates.
  const sendingFromThisTab = new Set<string>();

  const conversationStore = useConversationStore();
  const channelStore = useChannelStore();
  const clowderStore = useClowderStore();
  const userStore = useUserStore();

  function getChannelMessages(channelId: string, channelType: number): Message[] {
    const key = getChannelKey(channelId, channelType);
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
      isPinned: extra.is_pinned === 1 || extra.isPinned === true,
      isMutualDeleted: extra.is_mutual_deleted === 1 || extra.isMutualDeleted === true,
      contentEdit: extra.content_edit || extra.contentEdit,
      editedAt: extra.edited_at || extra.editedAt,
      revoker: extra.revoker
    };
  }

  function normalizeMessageContent(content: any) {
    if (!content || typeof content !== 'object') return {};

    const normalized = { ...content };
    if (normalized.type === 1 && normalized.text === undefined && normalized.content !== undefined) {
      normalized.text = normalized.content;
    }
    if (typeof normalized.url === 'string') {
      normalized.url = normalizeMediaUrl(normalized.url);
    }
    if (normalized.connectorId === undefined && normalized.connector_id !== undefined) {
      normalized.connectorId = normalized.connector_id;
    }
    if (normalized.catId === undefined && normalized.cat_id !== undefined) {
      normalized.catId = normalized.cat_id;
    }
    if (normalized.catDisplayName === undefined && normalized.cat_display_name !== undefined) {
      normalized.catDisplayName = normalized.cat_display_name;
    }
    if (normalized.threadId === undefined && normalized.thread_id !== undefined) {
      normalized.threadId = normalized.thread_id;
    }
    if (normalized.invocationId === undefined && normalized.invocation_id !== undefined) {
      normalized.invocationId = normalized.invocation_id;
    }
    if (normalized.platformMessageId === undefined && normalized.platform_message_id !== undefined) {
      normalized.platformMessageId = normalized.platform_message_id;
    }
    if (normalized.richBlocks === undefined) {
      normalized.richBlocks = normalized.rich_blocks || normalized.rich?.blocks || normalized.metadata?.richBlocks || normalized.metadata?.rich_blocks;
    }
    if (normalized.metadata && typeof normalized.metadata === 'object') {
      const metadata = { ...normalized.metadata };
      if (metadata.thinking === undefined) {
        metadata.thinking = metadata.thought || metadata.reasoning || metadata.reasoning_content;
      }
      if (metadata.toolCalls === undefined) {
        metadata.toolCalls = metadata.tool_calls || metadata.toolEvents || metadata.tool_events;
      }
      if (metadata.toolResults === undefined) {
        metadata.toolResults = metadata.tool_results;
      }
      normalized.metadata = metadata;
    }

    return normalized;
  }

  function normalizeAiRobotMessageContent(fromUID: string, content: any, streaming = false) {
    const normalized = normalizeMessageContent(content);
    if (!isAiAssistantSource(fromUID, normalized) || Number(normalized.type || 0) !== 1) {
      return normalized;
    }
    return normalizeMessageContent({
      ...normalized,
      format: normalized.format || 'markdown',
      markdown: normalized.markdown ?? true,
      ai: normalized.ai ?? true,
      streaming: streaming || normalized.streaming === true || normalized.stream?.state === 'placeholder'
    });
  }

  function isAiAssistantSource(fromUID: string, content?: any) {
    const uid = String(fromUID || '');
    return uid === DEEPSEEK_AI_ROBOT_ID ||
      uid.startsWith('clowder:') ||
      String(content?.connectorId || content?.connector_id || '') === CLOWDER_CONNECTOR_ID;
  }

  function clowderStreamState(content?: any) {
    return String(content?.stream?.state || content?.stream_state || '').trim();
  }

  function isClowderStreamingPlaceholder(msg: Message) {
    if (!isAiAssistantSource(msg.fromUID, msg.content)) return false;
    if (String(msg.content?.connectorId || msg.content?.connector_id || '') !== CLOWDER_CONNECTOR_ID) return false;
    const state = clowderStreamState(msg.content);
    return msg.content?.streaming === true && (state === 'placeholder' || state === 'chunk');
  }

  function extractClowderPlaceholderNames(msg: Message) {
    const content = msg.content || {};
    const names = [
      content.catDisplayName,
      content.cat_display_name,
      content.catId,
      content.cat_id
    ].map(value => String(value || '').replace(/[🐱🐈🐾\s]+$/g, '').trim()).filter(Boolean);
    const text = getMessageText(msg);
    const prefixMatch = text.match(/^【([^】]{1,40}?)】/);
    if (prefixMatch) {
      const prefixName = prefixMatch[1].replace(/[🐱🐈🐾\s]+$/g, '').trim();
      if (prefixName) names.push(prefixName);
    }
    return [...new Set(names)];
  }

  function isLikelyPromptForClowderPlaceholder(prompt: Message, placeholder: Message) {
    const text = getMessageText(prompt).toLowerCase();
    if (!text.includes('@')) return false;
    const names = extractClowderPlaceholderNames(placeholder)
      .map(name => name.toLowerCase())
      .filter(Boolean);
    if (!names.length) return true;
    return names.some(name => text.includes(`@${name}`));
  }

  function isLocalStreamingAiMessage(msg: Message) {
    const clientMsgNo = String(msg.clientMsgNo || '');
    const messageID = String(msg.messageID || '');
    const isLocalStreamKey = clientMsgNo.startsWith('ai-stream-') ||
      clientMsgNo.startsWith('clowder-stream-') ||
      messageID.startsWith('ai-stream-') ||
      messageID.startsWith('clowder-stream-');
    return (isLocalStreamKey || isClowderStreamingPlaceholder(msg)) &&
      isAiAssistantSource(msg.fromUID, msg.content) &&
      (
        msg.content?.streaming === true ||
        msg.status === 'sending' ||
        Number(msg.messageSeq || 0) === 0
      );
  }

  function findMergeableLocalAiStream(list: Message[], incoming: Message, options?: { protectHistory?: boolean }) {
    if (!isAiAssistantSource(incoming.fromUID, incoming.content)) return undefined;
    const candidates = list.filter(isLocalStreamingAiMessage);
    if (!candidates.length) return undefined;
    const incomingSeq = Number(incoming.messageSeq || 0);
    const maxConfirmedSeq = list.reduce((max, item) => {
      if (isLocalStreamingAiMessage(item)) return max;
      return Math.max(max, Number(item.messageSeq || 0));
    }, 0);
    if (options?.protectHistory === true && incomingSeq > 0 && maxConfirmedSeq > 0 && incomingSeq <= maxConfirmedSeq) {
      const newestStream = candidates.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))[0];
      if (Number(incoming.timestamp || 0) + 5 < Number(newestStream.timestamp || 0)) {
        return undefined;
      }
    }
    return candidates.sort((a, b) => {
      const timeDiff = Number(b.timestamp || 0) - Number(a.timestamp || 0);
      if (timeDiff !== 0) return timeDiff;
      return String(b.clientMsgNo || '').localeCompare(String(a.clientMsgNo || ''));
    })[0];
  }

  function mergePersistedAiIntoLocal(local: Message, incoming: Message): Message {
    return {
      ...local,
      ...incoming,
      clientMsgNo: local.clientMsgNo,
      content: normalizeAiRobotMessageContent(incoming.fromUID, incoming.content, false),
      status: 'success'
    };
  }

  function isLocalPendingMessageFromSender(msg: Message, fromUID: string) {
    if (!fromUID || String(msg.fromUID || '') !== fromUID) return false;
    if (Number(msg.messageSeq || 0) > 0) return false;
    if (String(msg.messageID || '')) return false;
    return !!String(msg.clientMsgNo || '') && !!getMessageText(msg);
  }

  function findMergeableLocalOwnMessage(list: Message[], incoming: Message) {
    const incomingFromUID = String(incoming.fromUID || '');
    if (!incomingFromUID) return undefined;
    if (Number(incoming.messageSeq || 0) <= 0 && !String(incoming.messageID || '')) return undefined;
    const incomingText = getMessageText(incoming);
    if (!incomingText) return undefined;

    const incomingTs = Number(incoming.timestamp || 0);
    const candidates = list.filter(item =>
      isLocalPendingMessageFromSender(item, incomingFromUID) &&
      getMessageText(item) === incomingText &&
      Math.abs(Number(item.timestamp || 0) - incomingTs) <= 600
    );
    if (!candidates.length) return undefined;

    return candidates.sort((a, b) => {
      const aDiff = Math.abs(Number(a.timestamp || 0) - incomingTs);
      const bDiff = Math.abs(Number(b.timestamp || 0) - incomingTs);
      if (aDiff !== bDiff) return aDiff - bDiff;
      return Number(b.timestamp || 0) - Number(a.timestamp || 0);
    })[0];
  }

  function mergePersistedOwnMessageIntoLocal(local: Message, incoming: Message): Message {
    return {
      ...local,
      ...incoming,
      clientMsgNo: local.clientMsgNo,
      status: 'success',
      retryable: false
    };
  }

  function getMessageText(msg: Message) {
    return String(msg.content?.text || msg.content?.content || '');
  }

  function getMessageMergeKey(msg: Message) {
    const clientMsgNo = String(msg.clientMsgNo || '');
    if (clientMsgNo) return `client:${clientMsgNo}`;

    const messageID = String(msg.messageID || '');
    if (messageID) return `id:${messageID}`;

    const messageSeq = Number(msg.messageSeq || 0);
    if (messageSeq > 0) {
      return `seq:${String(msg.fromUID || '')}:${messageSeq}`;
    }

    return `fallback:${String(msg.fromUID || '')}:${Number(msg.timestamp || 0)}:${getMessageText(msg)}`;
  }

  function pruneDuplicateAiStreams(list: Message[]) {
    const persistedAiText = new Set(
      list
        .filter(item =>
          isAiAssistantSource(item.fromUID, item.content) &&
          !isLocalStreamingAiMessage(item) &&
          Number(item.messageSeq || 0) > 0
        )
        .map(getMessageText)
        .filter(Boolean)
    );
    if (!persistedAiText.size) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const item = list[i];
      if (
        isLocalStreamingAiMessage(item) &&
        persistedAiText.has(getMessageText(item))
      ) {
        list.splice(i, 1);
      }
    }
  }

  function isAiDirectChannel(channelId: string, channelType: number) {
    if (Number(channelType) !== 1) return false;
    const id = String(channelId || '');
    return id === DEEPSEEK_AI_ROBOT_ID || isClowderAiContactId(id) || isClowderCatContactId(id);
  }

  function sortMessagesForChannel(list: Message[], channelId: string, channelType: number) {
    list.sort((a, b) => {
      if (Number(channelType) === 2) {
        const aPlaceholder = isClowderStreamingPlaceholder(a);
        const bPlaceholder = isClowderStreamingPlaceholder(b);
        if (aPlaceholder !== bPlaceholder) {
          const aAssistant = isAiAssistantSource(a.fromUID, a.content);
          const bAssistant = isAiAssistantSource(b.fromUID, b.content);
          const nearSameTurn = Math.abs(Number(a.timestamp || 0) - Number(b.timestamp || 0)) <= 120;
          const prompt = aPlaceholder ? b : a;
          const placeholder = aPlaceholder ? a : b;
          if (
            nearSameTurn &&
            aAssistant !== bAssistant &&
            isLikelyPromptForClowderPlaceholder(prompt, placeholder)
          ) {
            return aPlaceholder ? 1 : -1;
          }
        }
      }

      if (isAiDirectChannel(channelId, channelType)) {
        const timeDiff = Number(a.timestamp || 0) - Number(b.timestamp || 0);
        if (timeDiff !== 0) return timeDiff;

        const aIsAi = isAiAssistantSource(a.fromUID, a.content);
        const bIsAi = isAiAssistantSource(b.fromUID, b.content);
        if (aIsAi !== bIsAi) return aIsAi ? 1 : -1;
      }

      const seqA = a.messageSeq > 0 ? a.messageSeq : Infinity;
      const seqB = b.messageSeq > 0 ? b.messageSeq : Infinity;
      if (seqA !== seqB) return seqA - seqB;
      return a.timestamp - b.timestamp;
    });
  }

  function createClientMsgNo() {
    return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getChannelKey(channelId: string, channelType: number) {
    return `${channelId}-${channelType}`;
  }

  function applyMessageExtra(msg: Message, remoteExtra: any) {
    const normalizedExtra = normalizeRemoteExtra(remoteExtra) || {};
    msg.remoteExtra = {
      ...(msg.remoteExtra || {}),
      ...normalizedExtra
    };
    if (normalizedExtra.revoke) {
      msg.isRevoked = true;
    }
    if (normalizedExtra.contentEdit) {
      msg.content = normalizeMessageContent(normalizedExtra.contentEdit);
    }
  }

  function queuePendingMessage(channelId: string, channelType: number, clientMsgNo: string) {
    if (!clientMsgNo) return;
    const exists = pendingQueue.value.some(item =>
      item.channelId === channelId &&
      item.channelType === channelType &&
      item.clientMsgNo === clientMsgNo
    );
    if (!exists) {
      pendingQueue.value.push({ channelId, channelType, clientMsgNo });
    }
  }

  function removePendingMessage(clientMsgNo: string) {
    pendingQueue.value = pendingQueue.value.filter(item => item.clientMsgNo !== clientMsgNo);
    sendingFromThisTab.delete(clientMsgNo);
  }

  function markPendingFailed(clientMsgNo: string) {
    for (const key of Object.keys(messages.value)) {
      const msg = messages.value[key]?.find(item => item.clientMsgNo === clientMsgNo);
      if (msg && msg.status === 'sending') {
        msg.status = 'fail';
        msg.retryable = true;
      }
    }
  }

  function isConversationDigestMessage(msg: Message) {
    if (!msg || msg.isRevoked) return false;
    const type = Number(msg.content?.type || 0);
    return [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13].includes(type);
  }

  function getLatestConversationDigestMessage(list: Message[]) {
    return [...list].reverse().find(isConversationDigestMessage);
  }

  function getLatestConversationMessage(list: Message[]) {
    return getLatestConversationDigestMessage(list) || [...list].reverse().find(msg => msg && !msg.isRevoked);
  }

  function extractClowderCatDisplayNameFromText(text: string) {
    const value = String(text || '').trim();
    const prefixMatch = value.match(/^【([^】]{1,40}?)】/);
    if (prefixMatch) return prefixMatch[1].replace(/[🐱🐈🐾\s]+$/g, '').trim();

    const inlineSlashMatch = value.match(/(?:^|[\s，。:：])([^\s/［\[\]］，。:：]{1,40})\/[^\s/［\[\]］，。:：]{1,40}(?=[\s，。:：]|已|收|回|确|$)/u);
    if (inlineSlashMatch) return inlineSlashMatch[1].replace(/[🐱🐈🐾\s]+$/g, '').trim();

    const suffixMatch = value.match(/[［\[]([^\]/\]］\n]{1,40})\/[^\]］\n]{1,120}[］\]]\s*$/);
    if (suffixMatch) return suffixMatch[1].replace(/[🐱🐈🐾\s]+$/g, '').trim();

    return '';
  }

  function getClowderDisplayNameFromMessage(message?: Message) {
    const content = message?.content || {};
    const metadataName = String(content.catDisplayName || content.cat_display_name || '').trim();
    if (metadataName) return metadataName;
    return extractClowderCatDisplayNameFromText(String(content.text || content.content || ''));
  }

  function isClowderMessageContent(content: any) {
    if (!content || typeof content !== 'object') return false;
    return content.connectorId === CLOWDER_CONNECTOR_ID ||
      content.connector_id === CLOWDER_CONNECTOR_ID ||
      content.ai === true ||
      !!content.catDisplayName ||
      !!content.cat_display_name;
  }

  function getClowderDisplayNameFromMessageList(channelId: string, channelType: number, list: Message[]) {
    const canUseHistory = !!getClowderCatIdFromContactId(channelId) || Number(channelType) === 2;
    if (!canUseHistory) return '';
    for (const message of [...list].reverse()) {
      if (Number(channelType) === 2 && !isClowderMessageContent(message.content)) continue;
      const name = getClowderDisplayNameFromMessage(message);
      if (name) return name;
    }
    return '';
  }

  function resolveClowderConversationName(channelId: string, currentName: string, lastMessage: Message, fallbackName = '') {
    const catId = getClowderCatIdFromContactId(channelId);
    if (!catId) return currentName;
    const catName = getClowderDisplayNameFromMessage(lastMessage) || fallbackName;
    if (catName) return catName;
    const catContactName = String(clowderStore.getCatContactById(channelId)?.displayName || '').trim();
    if (catContactName) return catContactName;
    if (currentName && currentName !== catId) return currentName;
    return catId;
  }

  function updateExistingConversationSummary(channelId: string, channelType: number, lastMessage: Message, options: ConversationSummaryOptions = {}) {
    const key = getChannelKey(channelId, channelType);
    const historyName = getClowderDisplayNameFromMessageList(channelId, channelType, messages.value[key] || []);
    const matching = conversationStore.conversations.filter(item =>
      String(item.channel_id) === String(channelId) &&
      Number(item.channel_type) === Number(channelType)
    );
    const conv = matching[0];
    if (!conv) return false;

    const lastContent = lastMessage.content || {};
    const shouldBackfillClowderName = historyName &&
      isClowderMessageContent(lastContent) &&
      !getClowderDisplayNameFromMessage(lastMessage);
    const summaryContent = shouldBackfillClowderName
      ? {
          ...lastContent,
          catDisplayName: lastContent.catDisplayName || historyName,
          cat_display_name: lastContent.cat_display_name || historyName
        }
      : lastContent;
    const summary = {
      ...lastMessage,
      payload: summaryContent,
      content: summaryContent,
      messageSeq: lastMessage.messageSeq,
      timestamp: lastMessage.timestamp,
      fromUID: lastMessage.fromUID
    };
    for (const item of matching) {
      item.name = resolveClowderConversationName(channelId, item.name || '', lastMessage, historyName);
      if (Number(channelType) === 1 && isClowderCatContactId(channelId) && item.name) {
        channelStore.updateChannelInfo(channelId, channelType, { name: item.name });
      }
      item.last_msg_seq = lastMessage.messageSeq || item.last_msg_seq;
      item.last_msg_time = lastMessage.timestamp || item.last_msg_time;
      item.last_message = summary;
      if (lastMessage.isUnreadCleared) {
        item.unread = 0;
      } else if (options.countUnread === true && lastMessage.fromUID !== userStore.currentUser?.uid) {
        item.unread = Number(item.unread || 0) + 1;
      }
    }
    if (lastMessage.isUnreadCleared) {
      conversationStore.unreadMap[key] = 0;
    } else if (options.countUnread === true && lastMessage.fromUID !== userStore.currentUser?.uid) {
      conversationStore.unreadMap[key] = Number(matching[0]?.unread || 0);
    } else {
      conversationStore.unreadMap[key] = Number(matching[0]?.unread || 0);
    }

    return true;
  }

  async function ensureConversationFromMessages(channelId: string, channelType: number, options: ConversationSummaryOptions = {}) {
    const key = getChannelKey(channelId, channelType);
    const version = (summaryVersions.value[key] || 0) + 1;
    summaryVersions.value[key] = version;
    const list = messages.value[key] || [];
    const lastMessage = getLatestConversationMessage(list);
    if (!lastMessage) return;
    if (summaryVersions.value[key] !== version) return;
    if (updateExistingConversationSummary(channelId, channelType, lastMessage, options)) {
      return;
    }
    await conversationStore.ensureConversation(channelId, channelType, {
      messageSeq: lastMessage.messageSeq,
      timestamp: lastMessage.timestamp,
      fromUID: lastMessage.fromUID,
      payload: lastMessage.content,
      isOwnMessage: lastMessage.fromUID === userStore.currentUser?.uid,
      isUnreadCleared: lastMessage.isUnreadCleared === true || options.countUnread !== true
    });
  }

  function normalizeSyncedMessage(item: any): Message {
    const remoteExtra = normalizeRemoteExtra(item.message_extra);
    const fromUID = item.from_uid;

    const message: Message = {
      messageID: String(item.message_idstr || item.message_id || ''),
      messageSeq: item.message_seq,
      clientMsgNo: String(item.client_msg_no || ''),
      fromUID,
      timestamp: item.timestamp,
      content: normalizeAiRobotMessageContent(fromUID, normalizeSyncedPayload(item.payload), false),
      isRevoked: item.revoke === 1 || item.is_revoked === 1 || remoteExtra?.revoke === true,
      revokeUID: remoteExtra?.revoker,
      status: 'success',
      reactions: item.reactions || [],
      remoteExtra
    };
    if (remoteExtra?.contentEdit) {
      message.content = normalizeMessageContent(remoteExtra.contentEdit);
    }
    return message;
  }

  async function mergeSyncedMessages(channelId: string, channelType: number, key: string, rawMessages: any[]) {
    const synced: Message[] = rawMessages.filter((item: any) => item.is_deleted !== 1).map(normalizeSyncedMessage);
    const currentList = messages.value[key] || [];
    const mergedMap = new Map<string, Message>();
    currentList.forEach(m => mergedMap.set(getMessageMergeKey(m), m));

    // Build a messageID -> local merge-key index for deduplication.
    // When the server returns a message whose messageID already exists locally
    // (but with a different clientMsgNo, e.g. our web-xxx vs SDK's wk-xxx),
    // update the local entry in-place instead of adding a duplicate.
    const localByMsgId = new Map<string, string>(); // messageID -> merge key
    currentList.forEach(m => {
      const messageID = String(m.messageID || '');
      if (messageID) localByMsgId.set(messageID, getMessageMergeKey(m));
    });

    synced.forEach(m => {
      if (m.messageID && localByMsgId.has(m.messageID)) {
        const localKey = localByMsgId.get(m.messageID)!;
        const existing = mergedMap.get(localKey);
        if (existing) {
          mergedMap.set(localKey, { ...existing, ...m, clientMsgNo: existing.clientMsgNo || m.clientMsgNo });
          return;
        }
      }
      const localOwn = findMergeableLocalOwnMessage(Array.from(mergedMap.values()), m);
      if (localOwn) {
        const localKey = getMessageMergeKey(localOwn);
        mergedMap.set(localKey, mergePersistedOwnMessageIntoLocal(localOwn, m));
        removePendingMessage(localOwn.clientMsgNo);
        return;
      }
      const localStreamingAi = findMergeableLocalAiStream(Array.from(mergedMap.values()), m, { protectHistory: true });
      if (localStreamingAi) {
        mergedMap.set(getMessageMergeKey(localStreamingAi), mergePersistedAiIntoLocal(localStreamingAi, m));
        return;
      }
      mergedMap.set(getMessageMergeKey(m), m);
    });

    const nextList = Array.from(mergedMap.values());
    sortMessagesForChannel(nextList, channelId, channelType);
    messages.value[key] = nextList;
    await ensureConversationFromMessages(channelId, channelType, { countUnread: false });
  }

  async function fetchMessageWindow(channelId: string, channelType: number, startSeq: number) {
    return syncApi.syncMessages({
      channel_id: channelId,
      channel_type: channelType,
      limit: MESSAGE_SYNC_LIMIT,
      start_message_seq: startSeq,
      end_message_seq: 0,
      pull_mode: 1
    });
  }

  function getPositiveMessageSeqs(list: Message[]) {
    return list
      .map(item => Number(item.messageSeq || 0))
      .filter(seq => seq > 0);
  }

  async function backfillVisibleHistoryWindow(channelId: string, channelType: number, key: string, version: number) {
    let guard = 0;
    let nextStart = 0;

    while (version === resetVersion.value && guard < Math.ceil(VISIBLE_HISTORY_WINDOW_LIMIT / MESSAGE_SYNC_LIMIT) + 2) {
      guard++;
      const list = messages.value[key] || [];
      const seqs = getPositiveMessageSeqs(list);
      if (!seqs.length) return;

      const maxSeq = Math.max(...seqs);
      const minSeq = Math.min(...seqs);
      const targetStart = Math.max(1, maxSeq - VISIBLE_HISTORY_WINDOW_LIMIT + 1);
      const targetCount = Math.min(VISIBLE_HISTORY_WINDOW_LIMIT, maxSeq - targetStart + 1);

      if (seqs.length >= targetCount && minSeq <= targetStart) return;

      if (nextStart <= 0 || nextStart < targetStart) {
        nextStart = targetStart;
      }
      if (nextStart > maxSeq) return;

      const res: any = await fetchMessageWindow(channelId, channelType, nextStart);
      if (version !== resetVersion.value) return;
      const rawMessages = Array.isArray(res?.messages) ? res.messages : [];
      if (!rawMessages.length) return;

      await mergeSyncedMessages(channelId, channelType, key, rawMessages);
      const returnedSeqs = rawMessages
        .map((item: any) => Number(item.message_seq || item.messageSeq || 0))
        .filter((seq: number) => seq > 0);
      const maxReturnedSeq = returnedSeqs.length ? Math.max(...returnedSeqs) : 0;
      if (maxReturnedSeq < nextStart) return;
      nextStart = maxReturnedSeq + 1;
    }
  }

  async function syncMessages(channelId: string, channelType: number, options: SyncMessagesOptions = {}) {
    const version = resetVersion.value;
    const key = `${channelId}-${channelType}`;
    const list = messages.value[key] || [];
    const startSeq = list.reduce((max, item) => Math.max(max, Number(item.messageSeq || 0)), 0);

    try {
      const res: any = await fetchMessageWindow(channelId, channelType, startSeq);

      if (version !== resetVersion.value) return;
      if (res && Array.isArray(res.messages)) {
        await mergeSyncedMessages(channelId, channelType, key, res.messages);
      }

      if (options.hydrateVisibleHistory) {
        await backfillVisibleHistoryWindow(channelId, channelType, key, version);
      }
    } catch (e) {
      console.error(`[MessageStore] Failed to sync messages for channel ${key}`, e);
    }
  }

  function addMessage(channelId: string, channelType: number, msg: Message, options: ConversationSummaryOptions = { countUnread: true }) {
    const key = getChannelKey(channelId, channelType);
    if (!messages.value[key]) {
      messages.value[key] = [];
    }

    const list = messages.value[key];

    const normalizedMsg: Message = {
      ...msg,
      messageID: String(msg.messageID || ''),
      clientMsgNo: String(msg.clientMsgNo || ''),
      fromUID: String(msg.fromUID || ''),
      content: normalizeAiRobotMessageContent(String(msg.fromUID || ''), msg.content, msg.content?.streaming === true)
    };

    // Deduplicate: match by non-empty clientMsgNo first, then by messageID.
    // Backend robot messages may have an empty client_msg_no; treating '' as a
    // real dedupe key collapses historical AI replies into the latest one.
    let idx = -1;
    if (normalizedMsg.clientMsgNo) {
      idx = list.findIndex(m => String(m.clientMsgNo || '') === normalizedMsg.clientMsgNo);
    }
    if (idx === -1 && normalizedMsg.messageID) {
      idx = list.findIndex(m => m.messageID && String(m.messageID) === normalizedMsg.messageID);
    }

    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        ...normalizedMsg,
        clientMsgNo: list[idx].clientMsgNo || normalizedMsg.clientMsgNo
      };
    } else {
      const localStreamingAi = findMergeableLocalAiStream(list, normalizedMsg);
      if (localStreamingAi) {
        const localIdx = list.findIndex(m => m.clientMsgNo === localStreamingAi.clientMsgNo);
        if (localIdx !== -1) {
          list[localIdx] = mergePersistedAiIntoLocal(localStreamingAi, normalizedMsg);
        }
      } else {
        list.push(normalizedMsg);
      }
    }
    pruneDuplicateAiStreams(list);

    sortMessagesForChannel(list, channelId, channelType);

    if (isConversationDigestMessage(msg)) {
      ensureConversationFromMessages(channelId, channelType, options);
    }
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

  function addRealtimeMessage(channelId: string, channelType: number, rawMessage: WKMessage, options?: { isUnreadCleared?: boolean }) {
    const normalized: Message = {
      messageID: String(rawMessage.messageID || ''),
      messageSeq: Number(rawMessage.messageSeq || 0),
      clientMsgNo: String(rawMessage.clientMsgNo || ''),
      fromUID: String(rawMessage.fromUID || ''),
      timestamp: Number(rawMessage.timestamp || Math.floor(Date.now() / 1000)),
      content: normalizeAiRobotMessageContent(String(rawMessage.fromUID || ''), normalizeContent(rawMessage.content), false),
      isRevoked: rawMessage.remoteExtra?.revoke === true || rawMessage.isDeleted === true,
      revokeUID: rawMessage.remoteExtra?.revoker,
      status: rawMessage.status === 2 ? 'fail' : (rawMessage.status === 0 ? 'sending' : 'success'),
      reactions: rawMessage.reactions || [],
      remoteExtra: rawMessage.remoteExtra,
      isUnreadCleared: options?.isUnreadCleared === true
    };
    addMessage(channelId, channelType, normalized);
  }

  function updateMessageStatus(clientMsgNo: string, patch: Partial<Message>) {
    if (!clientMsgNo) return;

    for (const key of Object.keys(messages.value)) {
      const list = messages.value[key] || [];
      const idx = list.findIndex(m => m.clientMsgNo === clientMsgNo);
      if (idx === -1) continue;

      const current = list[idx];
      const next: Message = {
        ...current,
        ...patch,
        messageID: patch.messageID === undefined ? current.messageID : String(patch.messageID || ''),
        clientMsgNo: current.clientMsgNo,
        fromUID: patch.fromUID === undefined ? current.fromUID : String(patch.fromUID || ''),
        content: patch.content === undefined
          ? current.content
          : normalizeAiRobotMessageContent(patch.fromUID === undefined ? current.fromUID : String(patch.fromUID || ''), patch.content, patch.content?.streaming === true)
      };
      list[idx] = next;

      if (next.messageID) {
        for (let i = list.length - 1; i >= 0; i--) {
          if (i === idx) continue;
          if (String(list[i].messageID || '') === String(next.messageID)) {
            list.splice(i, 1);
          }
        }
      }
      const [channelId, channelType] = key.split('-');
      sortMessagesForChannel(list, channelId, Number(channelType));

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

  function removeMessageByClientMsgNo(clientMsgNo: string) {
    if (!clientMsgNo) return false;
    for (const key of Object.keys(messages.value)) {
      const list = messages.value[key] || [];
      const next = list.filter(item => item.clientMsgNo !== clientMsgNo);
      if (next.length === list.length) continue;
      messages.value[key] = next;
      const [channelId, channelType] = key.split('-');
      void ensureConversationFromMessages(channelId, Number(channelType), { countUnread: false });
      return true;
    }
    return false;
  }

  function addClowderCommandResponse(channelId: string, channelType: number, response: {
    text: string;
    command?: string;
    clientMsgNo?: string;
    timestamp?: number;
  }) {
    const clientMsgNo = response.clientMsgNo || `clowder-command-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const msg: Message = {
      messageID: '',
      messageSeq: 0,
      clientMsgNo,
      fromUID: 'clowder:command',
      timestamp: response.timestamp || Math.floor(Date.now() / 1000),
      content: {
        type: 1000,
        text: response.text,
        connectorId: CLOWDER_CONNECTOR_ID,
        connectorCommand: response.command || true
      },
      isRevoked: false,
      status: 'success'
    };
    addMessage(channelId, channelType, msg);
    return msg;
  }

  async function revokeMessage(channelId: string, channelType: number, clientMsgNo: string, messageId: string) {
    const version = resetVersion.value;
    try {
      await syncApi.revokeMessage({
        channel_id: channelId,
        channel_type: channelType,
        message_id: messageId,
        client_msg_no: clientMsgNo
      });

      if (version !== resetVersion.value) return;
      await handleMessageRevoked(channelId, channelType, clientMsgNo);
    } catch (e) {
      console.error('[MessageStore] Failed to revoke message', e);
    }
  }

  async function handleMessageRevoked(channelId: string, channelType: number, clientMsgNo: string) {
    const key = getChannelKey(channelId, channelType);
    summaryVersions.value[key] = (summaryVersions.value[key] || 0) + 1;
    const list = messages.value[key] || [];
    const msg = list.find(m => m.clientMsgNo === clientMsgNo);
    if (msg) {
      msg.isRevoked = true;
      const lastMessage = getLatestConversationMessage(list);
      if (lastMessage) {
        updateExistingConversationSummary(channelId, channelType, lastMessage, { countUnread: false });
      }
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

    const version = resetVersion.value;
    await syncApi.addReaction({
      channel_id: channelId,
      channel_type: channelType,
      message_id: msg.messageID,
      emoji
    });

    if (version !== resetVersion.value) return;
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

  function buildTextContent(text: string, options?: SendMessageOptions) {
    const content = normalizeMessageContent({ type: 1, text, content: text });
    if (options?.robot) {
      content.robot_id = options.robot.robotId;
      content.entities = [{
        type: 'bot_command',
        offset: 0,
        length: [...options.robot.command].length
      }];
    }
    if (options?.mention) {
      content.mention = options.mention;
    }
    if (options?.reply) {
      content.reply = options.reply;
    }
    return content;
  }

  function buildPendingTextMessage(text: string, options?: SendMessageOptions, clientMsgNo = createClientMsgNo()): Message {
    return {
      messageID: '',
      messageSeq: 0,
      clientMsgNo,
      fromUID: userStore.currentUser?.uid || '',
      timestamp: Math.floor(Date.now() / 1000),
      content: buildTextContent(text, options),
      isRevoked: false,
      status: 'sending',
      retryable: false,
      retryPayload: { kind: 'text', text, options }
    };
  }

  async function sendMessage(
    channelId: string,
    channelType: number,
    text: string,
    options?: SendMessageOptions,
    retryClientMsgNo?: string
  ) {
    const version = resetVersion.value;
    const pending = buildPendingTextMessage(text, options, retryClientMsgNo);
    addMessage(channelId, channelType, pending);
    queuePendingMessage(channelId, channelType, pending.clientMsgNo);
    sendingFromThisTab.add(pending.clientMsgNo);
    try {
      const channel = WKSDK.shared().newChannel(channelId, channelType);
      const textMsg = options?.robot
        ? new RobotCommandContent(text, options.robot.robotId, options.robot.command)
        : WKSDK.shared().newMessageText(text);
      if (options?.mention) {
        textMsg.mention = options.mention;
      }
      if (options?.reply) {
        textMsg.reply = options.reply;
      }

      const res = await WKSDK.shared().chatManager.send(textMsg, channel);
      if (version !== resetVersion.value) return;
      if (res) {
        // Update the pending message in-place using our own clientMsgNo.
        // Do NOT call addRealtimeMessage(res) — the SDK's res.clientMsgNo is
        // SDK-internal and differs from ours; feeding it into addMessage would
        // create a second entry that conflicts with what syncMessages pulls from
        // the server (which also stores the SDK clientMsgNo).
        updateMessageStatus(pending.clientMsgNo, {
          messageID: String(res.messageID || ''),
          messageSeq: res.messageSeq || 0,
          status: 'success'
        });
        removePendingMessage(pending.clientMsgNo);
      }
    } catch (err) {
      sendingFromThisTab.delete(pending.clientMsgNo);
      addMessage(channelId, channelType, {
        ...pending,
        status: 'fail',
        retryable: true
      });
      queuePendingMessage(channelId, channelType, pending.clientMsgNo);
      throw err;
    }
  }

  async function retryMessage(channelId: string, channelType: number, clientMsgNo: string) {
    const msg = getChannelMessages(channelId, channelType).find(item => item.clientMsgNo === clientMsgNo);
    if (!msg?.retryPayload) {
      throw new Error('This message cannot be retried.');
    }
    if (msg.retryPayload.kind === 'text') {
      await sendMessage(channelId, channelType, msg.retryPayload.text || '', msg.retryPayload.options, clientMsgNo);
      return;
    }
    if (msg.retryPayload.kind === 'media' && msg.retryPayload.file) {
      await sendMediaMessage(channelId, channelType, msg.retryPayload.file, clientMsgNo);
      return;
    }
    if (msg.retryPayload.kind === 'voice' && msg.retryPayload.file) {
      await sendVoiceMessage(channelId, channelType, msg.retryPayload.file, msg.retryPayload.duration || 0, clientMsgNo);
      return;
    }
    throw new Error('This message cannot be retried.');
  }

  async function uploadChatFile(channelId: string, channelType: number, file: File) {
    const uploadPath = buildMediaUploadPath(channelId, channelType, file);
    const uploadUrl = resolveApiAssetUrl(extractUploadUrl(await commonApi.getUploadUrl(uploadPath, MEDIA_UPLOAD_TYPE)));
    if (!uploadUrl) {
      throw new Error('Upload URL is empty.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('contenttype', file.type || 'application/octet-stream');

    const uploadResult = await commonApi.uploadFile(uploadUrl, formData);
    const uploadedPath = extractUploadedPath(uploadResult);
    if (!uploadedPath) {
      throw new Error('Uploaded file path is empty.');
    }

    return resolveApiAssetUrl(uploadedPath, uploadUrl);
  }

  async function sendMediaMessage(channelId: string, channelType: number, file: File, retryClientMsgNo?: string) {
    let sentMessage: WKMessage | undefined;
    const version = resetVersion.value;
    const clientMsgNo = retryClientMsgNo || createClientMsgNo();
    queuePendingMessage(channelId, channelType, clientMsgNo);
    sendingFromThisTab.add(clientMsgNo);
    const pendingMedia: Message = {
      messageID: '',
      messageSeq: 0,
      clientMsgNo,
      fromUID: userStore.currentUser?.uid || '',
      timestamp: Math.floor(Date.now() / 1000),
      content: {
        type: file.type.startsWith('image/') ? 2 : 8,
        name: file.name,
        size: file.size,
        url: '',
        unavailable: false
      },
      isRevoked: false,
      status: 'sending',
      retryable: false,
      retryPayload: { kind: 'media', file }
    };
    addMessage(channelId, channelType, pendingMedia);

    try {
      const url = await uploadChatFile(channelId, channelType, file);
      const channel = WKSDK.shared().newChannel(channelId, channelType);
      const content = file.type.startsWith('image/')
        ? new MessageImage(undefined, 0, 0)
        : new MessageFile(url, file.name, file.size);

      if (file.type.startsWith('image/')) {
        (content as MessageImage).url = url;
      }
      const res = await WKSDK.shared().chatManager.send(content, channel);
      if (version !== resetVersion.value) return;
      if (res) {
        sentMessage = res;
        // Update the pending message in-place: preserve our clientMsgNo so that
        // syncMessages (which sees the SDK's clientMsgNo from the server) doesn't
        // create a second entry for the same message.
        updateMessageStatus(clientMsgNo, {
          messageID: String(res.messageID || ''),
          messageSeq: res.messageSeq || 0,
          status: 'success',
          // Patch the content url so the file/image card shows the real url
          content: {
            type: file.type.startsWith('image/') ? 2 : 8,
            name: file.name,
            size: file.size,
            url
          }
        });
        removePendingMessage(clientMsgNo);
      }
    } catch (err) {
      sendingFromThisTab.delete(clientMsgNo);
      addMessage(channelId, channelType, {
        messageID: sentMessage?.messageID || '',
        messageSeq: sentMessage?.messageSeq || 0,
        clientMsgNo,
        fromUID: sentMessage?.fromUID || userStore.currentUser?.uid || '',
        timestamp: sentMessage?.timestamp || Math.floor(Date.now() / 1000),
        content: {
          type: file.type.startsWith('image/') ? 2 : 8,
          name: file.name,
          size: file.size,
          url: '',
          unavailable: true
        },
        isRevoked: false,
        status: 'fail',
        retryable: true,
        retryPayload: { kind: 'media', file }
      });
      queuePendingMessage(channelId, channelType, clientMsgNo);
      throw err;
    }
  }

  async function sendVoiceMessage(channelId: string, channelType: number, file: File, duration: number, retryClientMsgNo?: string) {
    let sentMessage: WKMessage | undefined;
    const version = resetVersion.value;
    const clientMsgNo = retryClientMsgNo || createClientMsgNo();
    const normalizedDuration = Math.max(1, Math.round(duration || 1));
    queuePendingMessage(channelId, channelType, clientMsgNo);
    sendingFromThisTab.add(clientMsgNo);
    const pendingVoice: Message = {
      messageID: '',
      messageSeq: 0,
      clientMsgNo,
      fromUID: userStore.currentUser?.uid || '',
      timestamp: Math.floor(Date.now() / 1000),
      content: {
        type: 4,
        url: '',
        time: normalizedDuration,
        unavailable: false
      },
      isRevoked: false,
      status: 'sending',
      retryable: false,
      retryPayload: { kind: 'voice', file, duration: normalizedDuration }
    };
    addMessage(channelId, channelType, pendingVoice);

    try {
      const url = await uploadChatFile(channelId, channelType, file);
      const channel = WKSDK.shared().newChannel(channelId, channelType);
      const content = new MessageVoice(url, normalizedDuration);
      const res = await WKSDK.shared().chatManager.send(content, channel);
      if (version !== resetVersion.value) return;
      if (res) {
        sentMessage = res;
        updateMessageStatus(clientMsgNo, {
          messageID: String(res.messageID || ''),
          messageSeq: res.messageSeq || 0,
          status: 'success',
          content: {
            type: 4,
            url,
            time: normalizedDuration
          }
        });
        removePendingMessage(clientMsgNo);
      }
    } catch (err) {
      sendingFromThisTab.delete(clientMsgNo);
      addMessage(channelId, channelType, {
        messageID: sentMessage?.messageID || '',
        messageSeq: sentMessage?.messageSeq || 0,
        clientMsgNo,
        fromUID: sentMessage?.fromUID || userStore.currentUser?.uid || '',
        timestamp: sentMessage?.timestamp || Math.floor(Date.now() / 1000),
        content: {
          type: 4,
          url: '',
          time: normalizedDuration,
          unavailable: true
        },
        isRevoked: false,
        status: 'fail',
        retryable: true,
        retryPayload: { kind: 'voice', file, duration: normalizedDuration }
      });
      queuePendingMessage(channelId, channelType, clientMsgNo);
      throw err;
    }
  }

  async function retryPendingQueue() {
    const queued = [...pendingQueue.value];
    for (const item of queued) {
      const msg = getChannelMessages(item.channelId, item.channelType).find(message => message.clientMsgNo === item.clientMsgNo);
      if (!msg) {
        removePendingMessage(item.clientMsgNo);
        continue;
      }
      if (msg.status === 'sending') {
        markPendingFailed(item.clientMsgNo);
      }
      if (msg.retryable) {
        try {
          await retryMessage(item.channelId, item.channelType, item.clientMsgNo);
        } catch {
          markPendingFailed(item.clientMsgNo);
        }
      }
    }
  }

  async function editMessage(channelId: string, channelType: number, msg: Message, text: string) {
    if (!msg.messageID || !msg.messageSeq) {
      throw new Error('Only sent messages can be edited.');
    }
    const nextContent = buildTextContent(text);
    await syncApi.editMessage({
      channel_id: channelId,
      channel_type: channelType,
      message_id: msg.messageID,
      message_seq: msg.messageSeq,
      content_edit: JSON.stringify(nextContent)
    });
    msg.content = nextContent;
    msg.remoteExtra = {
      ...(msg.remoteExtra || {}),
      contentEdit: nextContent,
      editedAt: Math.floor(Date.now() / 1000)
    };
    await ensureConversationFromMessages(channelId, channelType, { countUnread: false });
  }

  async function deleteLocalMessage(channelId: string, channelType: number, msg: Message) {
    await syncApi.deleteMessage([{
      channel_id: channelId,
      channel_type: channelType,
      message_id: msg.messageID,
      message_seq: msg.messageSeq
    }]);
    const key = getChannelKey(channelId, channelType);
    messages.value[key] = (messages.value[key] || []).filter(item => item.clientMsgNo !== msg.clientMsgNo);
    await ensureConversationFromMessages(channelId, channelType, { countUnread: false });
  }

  async function deleteMutualMessage(channelId: string, channelType: number, msg: Message) {
    await syncApi.mutualDeleteMessage({
      channel_id: channelId,
      channel_type: channelType,
      message_id: msg.messageID,
      message_seq: msg.messageSeq
    });
    msg.remoteExtra = {
      ...(msg.remoteExtra || {}),
      isMutualDeleted: true
    };
    msg.content = {
      type: 1000,
      text: '消息已删除'
    };
    await ensureConversationFromMessages(channelId, channelType, { countUnread: false });
  }

  async function markMessagesRead(channelId: string, channelType: number, messageIds: string[]) {
    await syncApi.markReaded({ channel_id: channelId, channel_type: channelType, message_ids: messageIds });
    const idSet = new Set(messageIds.map(String));
    for (const msg of getChannelMessages(channelId, channelType)) {
      if (idSet.has(String(msg.messageID))) {
        msg.remoteExtra = {
          ...(msg.remoteExtra || {}),
          readed: true
        };
      }
    }
  }

  async function fetchReceipt(messageId: string) {
    try {
      const res: any = await syncApi.getMessageReceipt(messageId);
      const normalized = Array.isArray(res)
        ? { readed: res, unread: [], unavailable: false }
        : {
            readed: res?.readed || res?.read || [],
            unread: res?.unread || res?.unreaded || [],
            unavailable: false
          };
      receipts.value[messageId] = normalized;
      return normalized;
    } catch (e) {
      receipts.value[messageId] = { readed: [], unread: [], unavailable: true };
      throw e;
    }
  }

  async function togglePinnedMessage(channelId: string, channelType: number, msg: Message) {
    await syncApi.pinMessage({
      channel_id: channelId,
      channel_type: channelType,
      message_id: msg.messageID,
      message_seq: msg.messageSeq
    });
    msg.remoteExtra = {
      ...(msg.remoteExtra || {}),
      isPinned: !msg.remoteExtra?.isPinned
    };
    const key = getChannelKey(channelId, channelType);
    const current = pinnedMessages.value[key] || [];
    if (msg.remoteExtra.isPinned) {
      pinnedMessages.value[key] = current.some(item => item.messageID === msg.messageID) ? current : [...current, msg];
    } else {
      pinnedMessages.value[key] = current.filter(item => item.messageID !== msg.messageID);
    }
  }

  async function syncPinnedMessages(channelId: string, channelType: number) {
    const key = getChannelKey(channelId, channelType);
    const res: any = await syncApi.syncPinnedMessages({
      channel_id: channelId,
      channel_type: channelType,
      version: pinnedVersions.value[key] || 0
    });
    const pinnedList = res?.pinned_messages || [];
    const messagesById = new Map<string, Message>();
    for (const msg of getChannelMessages(channelId, channelType)) {
      messagesById.set(String(msg.messageID), msg);
    }
    for (const raw of res?.messages || []) {
      const remoteExtra = normalizeRemoteExtra(raw.message_extra);
      const msg: Message = {
        messageID: String(raw.message_idstr || raw.message_id || ''),
        messageSeq: raw.message_seq,
        clientMsgNo: raw.client_msg_no,
        fromUID: raw.from_uid,
        timestamp: raw.timestamp,
        content: normalizeSyncedPayload(raw.payload),
        isRevoked: raw.revoke === 1 || raw.is_revoked === 1 || remoteExtra?.revoke === true,
        revokeUID: remoteExtra?.revoker,
        status: 'success',
        reactions: raw.reactions || [],
        remoteExtra
      };
      messagesById.set(msg.messageID, msg);
      addMessage(channelId, channelType, msg, { countUnread: false });
    }
    pinnedMessages.value[key] = pinnedList
      .filter((item: any) => item.is_deleted !== 1)
      .map((item: any) => {
        pinnedVersions.value[key] = Math.max(pinnedVersions.value[key] || 0, Number(item.version || 0));
        const existing = messagesById.get(String(item.message_id));
        if (existing) {
          existing.remoteExtra = { ...(existing.remoteExtra || {}), isPinned: true };
          return existing;
        }
        return {
          messageID: String(item.message_id),
          messageSeq: item.message_seq,
          clientMsgNo: `pinned-${item.message_id}`,
          fromUID: '',
          timestamp: 0,
          content: { type: 1000, text: '置顶消息暂不可预览' },
          isRevoked: false,
          status: 'success',
          remoteExtra: { isPinned: true, unavailable: true }
        } as Message;
      });
    return pinnedMessages.value[key];
  }

  async function syncReminders(channelIds?: string[]) {
    const res: any = await syncApi.syncReminders({
      version: reminderVersion.value,
      limit: 100,
      channel_ids: channelIds
    });
    const list = Array.isArray(res) ? res : [];
    for (const item of list) {
      reminderVersion.value = Math.max(reminderVersion.value, Number(item.version || 0));
      const existingIndex = reminders.value.findIndex(reminder => Number(reminder.id) === Number(item.id));
      if (existingIndex >= 0) {
        reminders.value[existingIndex] = { ...reminders.value[existingIndex], ...item };
      } else {
        reminders.value.push(item);
      }
    }
    reminders.value = reminders.value.filter(item => item.done !== 1);
    return reminders.value;
  }

  async function doneReminders(ids: number[]) {
    await syncApi.doneReminders(ids);
    const idSet = new Set(ids.map(Number));
    for (const reminder of reminders.value) {
      if (idSet.has(Number(reminder.id))) {
        reminder.done = 1;
      }
    }
  }

  const replyTarget = ref<Message | null>(null);

  function setReplyTarget(msg: Message | null) {
    replyTarget.value = msg;
  }

  function reset() {
    resetVersion.value++;
    summaryVersions.value = {};
    messages.value = {};
    receipts.value = {};
    pinnedMessages.value = {};
    pinnedVersions.value = {};
    reminders.value = [];
    reminderVersion.value = 0;
    pendingQueue.value = [];
    for (const key of Object.keys(typingState.value)) {
      if (typingState.value[key]?.timer) {
        clearTimeout(typingState.value[key].timer);
      }
    }
    typingState.value = {};
    replyTarget.value = null;
    sendingFromThisTab.clear();
  }

  function isFromThisTabSend(clientMsgNo: string): boolean {
    return sendingFromThisTab.has(clientMsgNo);
  }

  return {
    messages,
    typingState,
    receipts,
    pinnedMessages,
    reminders,
    pendingQueue,
    replyTarget,
    getChannelMessages,
    syncMessages,
    addMessage,
    revokeMessage,
    handleMessageRevoked,
    toggleReaction,
    editMessage,
    deleteLocalMessage,
    deleteMutualMessage,
    markMessagesRead,
    fetchReceipt,
    togglePinnedMessage,
    syncPinnedMessages,
    syncReminders,
    doneReminders,
    setTyping,
    sendMessage,
    retryMessage,
    retryPendingQueue,
    queuePendingMessage,
    markPendingFailed,
    sendMediaMessage,
    sendVoiceMessage,
    addRealtimeMessage,
    updateMessageStatus,
    removeMessageByClientMsgNo,
    addClowderCommandResponse,
    setReplyTarget,
    isFromThisTabSend,
    reset
  };
});
