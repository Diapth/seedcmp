import { defineStore } from 'pinia';
import { ref } from 'vue';
import WKSDK, { Message as WKMessage, MessageImage } from 'wukongimjssdk';
import { commonApi, resolveApiAssetUrl, syncApi } from '../api';
import { MessageFile } from '../contentTypes';
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
    kind: 'text' | 'media';
    text?: string;
    options?: SendMessageOptions;
    file?: File;
  };
  reactions?: any[];
  remoteExtra?: any;
  isUnreadCleared?: boolean;
}

export interface Reaction {
  emoji: string;
  count: number;
  users?: string[];
  [key: string]: any;
}

const MEDIA_UPLOAD_TYPE = 'chat';

interface SendMessageOptions {
  mention?: { all?: boolean; uids?: string[] };
  reply?: any;
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

  const conversationStore = useConversationStore();
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

    return normalized;
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

  function updateExistingConversationSummary(channelId: string, channelType: number, lastMessage: Message) {
    const key = getChannelKey(channelId, channelType);
    const matching = conversationStore.conversations.filter(item =>
      String(item.channel_id) === String(channelId) &&
      Number(item.channel_type) === Number(channelType)
    );
    const conv = matching[0];
    if (!conv) return false;

    const summary = {
      ...lastMessage,
      payload: lastMessage.content,
      content: lastMessage.content,
      messageSeq: lastMessage.messageSeq,
      timestamp: lastMessage.timestamp,
      fromUID: lastMessage.fromUID
    };
    for (const item of matching) {
      item.last_msg_seq = lastMessage.messageSeq || item.last_msg_seq;
      item.last_msg_time = lastMessage.timestamp || item.last_msg_time;
      item.last_message = summary;
      if (lastMessage.isUnreadCleared) {
        item.unread = 0;
      }
    }
    if (lastMessage.isUnreadCleared) {
      conversationStore.unreadMap[key] = 0;
    }

    return true;
  }

  async function ensureConversationFromMessages(channelId: string, channelType: number) {
    const key = getChannelKey(channelId, channelType);
    const version = (summaryVersions.value[key] || 0) + 1;
    summaryVersions.value[key] = version;
    const list = messages.value[key] || [];
    const lastMessage = getLatestConversationMessage(list);
    if (!lastMessage) return;
    if (summaryVersions.value[key] !== version) return;
    if (updateExistingConversationSummary(channelId, channelType, lastMessage)) {
      return;
    }
    await conversationStore.ensureConversation(channelId, channelType, {
      messageSeq: lastMessage.messageSeq,
      timestamp: lastMessage.timestamp,
      fromUID: lastMessage.fromUID,
      payload: lastMessage.content,
      isOwnMessage: lastMessage.fromUID === userStore.currentUser?.uid,
      isUnreadCleared: true
    });
  }

  async function syncMessages(channelId: string, channelType: number) {
    const version = resetVersion.value;
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

      if (version !== resetVersion.value) return;
      if (res && Array.isArray(res.messages)) {
        const synced: Message[] = res.messages.filter((item: any) => item.is_deleted !== 1).map((item: any) => {
          const remoteExtra = normalizeRemoteExtra(item.message_extra);

          const message: Message = {
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
          if (remoteExtra?.contentEdit) {
            message.content = normalizeMessageContent(remoteExtra.contentEdit);
          }
          return message;
        });

        const currentList = messages.value[key] || [];
        const mergedMap = new Map<string, Message>();
        currentList.forEach(m => mergedMap.set(m.clientMsgNo, m));
        synced.forEach(m => mergedMap.set(m.clientMsgNo, m));

        messages.value[key] = Array.from(mergedMap.values()).sort((a, b) => a.messageSeq - b.messageSeq);
        await ensureConversationFromMessages(channelId, channelType);
      }
    } catch (e) {
      console.error(`[MessageStore] Failed to sync messages for channel ${key}`, e);
    }
  }

  function addMessage(channelId: string, channelType: number, msg: Message) {
    const key = getChannelKey(channelId, channelType);
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

    if (isConversationDigestMessage(msg)) {
      ensureConversationFromMessages(channelId, channelType);
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
        updateExistingConversationSummary(channelId, channelType, lastMessage);
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
      if (version !== resetVersion.value) return;
      if (res) {
        res.clientMsgNo = pending.clientMsgNo;
        if (!res.content) {
          res.content = textMsg;
        }
        addRealtimeMessage(channelId, channelType, res);
        removePendingMessage(pending.clientMsgNo);
      }
    } catch (err) {
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
    throw new Error('This message cannot be retried.');
  }

  async function uploadChatFile(channelId: string, channelType: number, file: File) {
    const uploadPath = buildMediaUploadPath(channelId, channelType, file);
    const uploadUrl = extractUploadUrl(await commonApi.getUploadUrl(uploadPath, MEDIA_UPLOAD_TYPE));
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
    addMessage(channelId, channelType, {
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
    });

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
        sentMessage.clientMsgNo = clientMsgNo;
        sentMessage.content = content;
        addRealtimeMessage(channelId, channelType, sentMessage);
        removePendingMessage(clientMsgNo);
      }
    } catch (err) {
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
    await ensureConversationFromMessages(channelId, channelType);
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
    await ensureConversationFromMessages(channelId, channelType);
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
    await ensureConversationFromMessages(channelId, channelType);
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
      addMessage(channelId, channelType, msg);
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
    addRealtimeMessage,
    updateMessageStatus,
    setReplyTarget,
    reset
  };
});
