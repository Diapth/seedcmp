import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { groupApi, syncApi } from '../api';
import { useChannelStore } from './channelStore';
import { useGroupStore } from './groupStore';
import { useUserStore } from './userStore';
import { buildConversationFromGroup } from './groupChatUtils';
import { useMessageStore } from './messageStore';

export interface Conversation {
  channel_id: string;
  channel_type: number;
  unread: number;
  last_msg_seq: number;
  last_msg_time: number;
  last_message?: any;
  top: number;
  mute: number;
  draft?: string;
  name?: string;
  avatar?: string;
}

const LOCAL_ONLY_DIRECT_CONVERSATION_IDS = new Set(['deepseek_ai_robot', 'clowder_ai']);
const LOCAL_ONLY_DRAFTS_STORAGE_PREFIX = 'im-web:local-only-drafts';
const CLEARED_UNREAD_STORAGE_PREFIX = 'im-web:cleared-unread';

interface ClearedUnreadRecord {
  seq: number;
  lastMsgTime: number;
  clearedAt: number;
}

export const useConversationStore = defineStore('conversation', () => {
  const conversations = ref<Conversation[]>([]);
  const drafts = ref<Record<string, string>>({});
  const syncedDrafts = ref<Record<string, string | undefined>>({});
  const unreadMap = ref<Record<string, number>>({});
  const clearedUnreadSeqs = ref<Record<string, number>>({});
  const lastSyncVersion = ref<number>(0);
  const manuallyDeletedConversationKeys = ref<Record<string, true>>({});
  const draftSyncTimers = ref<Record<string, ReturnType<typeof setTimeout>>>({});
  const recoveryState = ref<'idle' | 'syncing' | 'recovered' | 'failed'>('idle');
  const lastRecoveryAt = ref(0);
  const resetVersion = ref(0);

  const channelStore = useChannelStore();
  const groupStore = useGroupStore();
  const userStore = useUserStore();

  function getConversationKey(channelId: string, channelType: number) {
    return `${String(channelId)}-${Number(channelType)}`;
  }

  function getStorageScope() {
    if (userStore.currentUser?.uid) {
      return String(userStore.currentUser.uid);
    }
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('uid') || 'anonymous';
    }
    return 'anonymous';
  }

  function getScopedStorageKey(prefix: string) {
    return `${prefix}:${getStorageScope()}`;
  }

  function readScopedRecord<T>(prefix: string): Record<string, T> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(getScopedStorageKey(prefix));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeScopedRecord<T>(prefix: string, record: Record<string, T>) {
    if (typeof window === 'undefined') return;
    const storageKey = getScopedStorageKey(prefix);
    const hasValues = Object.keys(record).length > 0;
    try {
      if (hasValues) {
        window.localStorage.setItem(storageKey, JSON.stringify(record));
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      // Storage can be unavailable in private contexts; in-memory state still works.
    }
  }

  function getStoredLocalOnlyDraft(key: string) {
    const record = readScopedRecord<string>(LOCAL_ONLY_DRAFTS_STORAGE_PREFIX);
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      return undefined;
    }
    return String(record[key] || '');
  }

  function setStoredLocalOnlyDraft(key: string, draft: string) {
    const record = readScopedRecord<string>(LOCAL_ONLY_DRAFTS_STORAGE_PREFIX);
    if (draft) {
      record[key] = draft;
    } else {
      delete record[key];
    }
    writeScopedRecord(LOCAL_ONLY_DRAFTS_STORAGE_PREFIX, record);
  }

  function getStoredClearedUnread(key: string): ClearedUnreadRecord | undefined {
    const record = readScopedRecord<ClearedUnreadRecord>(CLEARED_UNREAD_STORAGE_PREFIX);
    const stored = record[key];
    if (!stored || typeof stored !== 'object') return undefined;
    return {
      seq: Number(stored.seq || 0),
      lastMsgTime: Number(stored.lastMsgTime || 0),
      clearedAt: Number(stored.clearedAt || 0)
    };
  }

  function setStoredClearedUnread(key: string, seq: number, lastMsgTime: number) {
    const record = readScopedRecord<ClearedUnreadRecord>(CLEARED_UNREAD_STORAGE_PREFIX);
    const current = getStoredClearedUnread(key);
    record[key] = {
      seq: Math.max(Number(current?.seq || 0), Number(seq || 0)),
      lastMsgTime: Math.max(Number(current?.lastMsgTime || 0), Number(lastMsgTime || 0)),
      clearedAt: Date.now()
    };
    writeScopedRecord(CLEARED_UNREAD_STORAGE_PREFIX, record);
  }

  function removeStoredClearedUnread(key: string) {
    const record = readScopedRecord<ClearedUnreadRecord>(CLEARED_UNREAD_STORAGE_PREFIX);
    delete record[key];
    writeScopedRecord(CLEARED_UNREAD_STORAGE_PREFIX, record);
  }

  function hasDraftInMemory(key: string) {
    return Object.prototype.hasOwnProperty.call(drafts.value, key);
  }

  function resolveDraft(channelId: string, channelType: number, key: string, remoteDraft = '') {
    if (isLocalOnlyDirectConversation(channelId, channelType)) {
      if (hasDraftInMemory(key)) {
        return drafts.value[key] || '';
      }
      return getStoredLocalOnlyDraft(key) ?? '';
    }
    if (hasDraftInMemory(key)) {
      return drafts.value[key] || '';
    }
    return remoteDraft || '';
  }

  function findConversation(channelId: string, channelType: number) {
    channelId = String(channelId);
    channelType = Number(channelType);
    return conversations.value.find(c => String(c.channel_id) === channelId && Number(c.channel_type) === channelType);
  }

  function normalizeMessagePayload(raw: any) {
    const payload = raw.payload ?? raw.content ?? raw.contentObj;
    if (payload === undefined || payload === null) {
      if (raw.text !== undefined) {
        return { type: raw.type || 1, text: raw.text };
      }
      return undefined;
    }

    let content = payload;
    if (typeof payload === 'string') {
      try {
        content = JSON.parse(payload);
      } catch {
        content = { type: 1, text: payload };
      }
    }
    if (content && typeof content === 'object' && content.type === 1 && content.text === undefined && content.content !== undefined) {
      content = { ...content, text: content.content };
    }
    return content;
  }

  function getMessageType(raw: any) {
    const payload = normalizeMessagePayload(raw);
    return Number(payload?.type || raw.type || raw.content_type || raw.contentType || 0);
  }

  function isConversationDigestSource(raw: any) {
    if (raw?.isRevoked || raw?.is_deleted === 1 || raw?.is_revoked === 1 || raw?.revoke === 1) return false;
    return raw && ![99, 1000].includes(getMessageType(raw));
  }

  function isGroupJoinPlaceholder(conv?: Conversation) {
    if (!conv || Number(conv.channel_type) !== 2) return false;
    const type = getMessageType(conv.last_message || {});
    const payload = normalizeMessagePayload(conv.last_message || {});
    const text = String(payload?.text || payload?.content || '');
    return [99, 1000].includes(type) && text.includes('你已加入群聊');
  }

  function getLastMessageSource(item: any) {
    const recents = Array.isArray(item.recents) ? item.recents : [];
    const messages = Array.isArray(item.messages) ? item.messages : [];
    const candidates = [
      item.last_message,
      item.last_msg,
      item.message,
      ...recents,
      ...messages
    ].filter(Boolean);
    return candidates.find(isConversationDigestSource) || item.last_message || item.last_msg || item.message || item.recents?.[0] || item.messages?.[0];
  }

  function normalizeLastMessage(item: any) {
    const raw = getLastMessageSource(item);
    if (!raw) return undefined;

    const content = normalizeMessagePayload(raw);

    return {
      ...raw,
      payload: content,
      content,
      messageSeq: raw.messageSeq || raw.message_seq || item.last_msg_seq || 0,
      timestamp: raw.timestamp || item.timestamp || item.last_msg_time || 0,
      fromUID: raw.fromUID || raw.from_uid || raw.from || ''
    };
  }

  function normalizeSyncedMessage(item: any) {
    return {
      ...item,
      payload: normalizeMessagePayload(item),
      content: normalizeMessagePayload(item),
      messageSeq: item.messageSeq || item.message_seq || 0,
      timestamp: item.timestamp || 0,
      fromUID: item.fromUID || item.from_uid || item.from || ''
    };
  }

  function getLatestConversationMessageFromHistory(list: any[]) {
    const normalized = list
      .filter(item => item && item.is_deleted !== 1 && item.is_revoked !== 1 && item.revoke !== 1)
      .map(normalizeSyncedMessage);
    return [...normalized].reverse().find(isConversationDigestSource) || [...normalized].reverse()[0];
  }

  async function ensureConversationFromSyncedMessages(channelId: string, channelType: number, list: any[]) {
    const lastMessage = getLatestConversationMessageFromHistory(list);
    if (!lastMessage) return;
    await ensureConversation(channelId, channelType, {
      messageSeq: lastMessage.messageSeq,
      timestamp: lastMessage.timestamp,
      fromUID: lastMessage.fromUID,
      payload: lastMessage.content,
      isOwnMessage: lastMessage.fromUID === userStore.currentUser?.uid,
      isUnreadCleared: true
    });
  }

  function normalizeConversationInput(item: any, info: any): Conversation {
    const channelId = String(item.channel_id);
    const channelType = Number(item.channel_type);
    const key = getConversationKey(channelId, channelType);
    const rawLastMessage = getLastMessageSource(item);
    const remoteDraft = item.extra?.draft ?? item.draft ?? '';

    return {
      channel_id: channelId,
      channel_type: channelType,
      unread: Number(item.unread || 0),
      last_msg_seq: Number(item.last_msg_seq || rawLastMessage?.message_seq || rawLastMessage?.messageSeq || 0),
      last_msg_time: Number(item.last_msg_time || item.timestamp || rawLastMessage?.timestamp || 0),
      last_message: normalizeLastMessage(item),
      top: info.top || item.top || item.stick || item.extra?.top || item.extra?.stick || 0,
      mute: info.mute || item.mute || item.extra?.mute || 0,
      draft: resolveDraft(channelId, channelType, key, remoteDraft),
      name: info.name || item.name || item.remark || '',
      avatar: info.avatar || item.logo || item.avatar || ''
    };
  }

  function compactConversations() {
    const merged = new Map<string, Conversation>();
    for (const conv of conversations.value) {
      const key = getConversationKey(conv.channel_id, conv.channel_type);
      const normalized = {
        ...conv,
        channel_id: String(conv.channel_id),
        channel_type: Number(conv.channel_type)
      };
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, normalized);
        continue;
      }
      merged.set(key, {
        ...existing,
        ...normalized,
        unread: Math.max(Number(existing.unread || 0), Number(normalized.unread || 0)),
        last_msg_seq: Math.max(Number(existing.last_msg_seq || 0), Number(normalized.last_msg_seq || 0)),
        last_msg_time: Math.max(Number(existing.last_msg_time || 0), Number(normalized.last_msg_time || 0)),
        last_message: normalized.last_message || existing.last_message,
        draft: resolveDraft(normalized.channel_id, normalized.channel_type, key, normalized.draft || existing.draft || '')
      });
    }
    conversations.value = Array.from(merged.values());
  }

  const uniqueConversations = computed(() => {
    const merged = new Map<string, Conversation>();
    for (const conv of conversations.value) {
      const key = getConversationKey(conv.channel_id, conv.channel_type);
      const existing = merged.get(key);
      if (!existing || Number(conv.last_msg_time || 0) >= Number(existing.last_msg_time || 0)) {
        merged.set(key, {
          ...conv,
          channel_id: String(conv.channel_id),
          channel_type: Number(conv.channel_type)
        });
      }
    }
    return Array.from(merged.values());
  });

  const sortedConversations = computed(() => {
    return [...uniqueConversations.value].sort((a, b) => {
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

  function warnRemoteCommandFailure(action: string, e: unknown) {
    console.warn(`[ConversationStore] Remote ${action} command failed; local state was kept`, e);
  }

  function isLocalOnlyDirectConversation(channelId: string, channelType: number) {
    return Number(channelType) === 1 &&
      (channelId === 'deepseek_ai_robot' ||
        channelId === 'clowder_ai' ||
        LOCAL_ONLY_DIRECT_CONVERSATION_IDS.has(String(channelId)));
  }

  function isBrandNewEmptyConversation(channelId: string, channelType: number, conv?: Conversation) {
    return isLocalOnlyDirectConversation(channelId, channelType) &&
      !conv &&
      Number(unreadMap.value[getConversationKey(channelId, channelType)] || 0) === 0;
  }

  function getEffectiveUnread(item: any, key: string) {
    const unread = Number(item.unread || 0);
    const storedCleared = getStoredClearedUnread(key);
    const clearedSeq = Math.max(Number(clearedUnreadSeqs.value[key] || 0), Number(storedCleared?.seq || 0));
    const itemSeq = Number(item.last_msg_seq || item.message_seq || item.last_message?.message_seq || item.last_message?.messageSeq || 0);
    const itemTime = Number(item.last_msg_time || item.timestamp || item.last_message?.timestamp || 0);
    const lastMessage = getLastMessageSource(item);
    const lastMessageFromUID = String(lastMessage?.fromUID || lastMessage?.from_uid || lastMessage?.from || '');

    if (lastMessageFromUID && lastMessageFromUID === String(userStore.currentUser?.uid || '')) {
      return 0;
    }

    if (clearedSeq > 0 && itemSeq > 0 && itemSeq <= clearedSeq) {
      return 0;
    }
    if (
      storedCleared &&
      isLocalOnlyDirectConversation(String(item.channel_id), Number(item.channel_type)) &&
      itemSeq === 0 &&
      itemTime > 0 &&
      itemTime <= Number(storedCleared.lastMsgTime || 0)
    ) {
      return 0;
    }
    return unread;
  }

  function upsertConversation(next: Conversation) {
    next = {
      ...next,
      channel_id: String(next.channel_id),
      channel_type: Number(next.channel_type)
    };
    const key = getConversationKey(next.channel_id, next.channel_type);
    if (manuallyDeletedConversationKeys.value[key]) return;

    const conv = findConversation(next.channel_id, next.channel_type);
    if (conv) {
      Object.assign(conv, {
        ...next,
        draft: resolveDraft(next.channel_id, next.channel_type, key, next.draft || conv.draft || '')
      });
    } else {
      conversations.value.push(next);
    }
    compactConversations();
  }

  async function syncConversations(options: { throwOnError?: boolean } = {}) {
    const version = resetVersion.value;
    try {
      const res: any = await syncApi.syncConversations({ msg_count: 1 });
      if (version !== resetVersion.value) return;
      // 后端返回 { conversations: [...], users: [...], groups: [...] }
      const rawList = res?.conversations || (Array.isArray(res) ? res : []);

      // 预热 channel 缓存：先将 users/groups 写入 channelStore
      if (res?.users?.length) {
        for (const u of res.users) {
          channelStore.updateChannelInfo(u.uid, 1, {
            name: u.name,
            avatar: u.avatar,
            top: u.top || 0,
            mute: u.mute || 0
          });
        }
      }
      if (res?.groups?.length) {
        for (const g of res.groups) {
          channelStore.updateChannelInfo(g.group_no, 2, {
            name: g.name,
            avatar: g.logo || g.avatar,
            top: g.top || g.stick || 0,
            mute: g.mute || 0
          });
          groupStore.upsertGroup(g);
        }
      }

      for (const item of rawList) {
        const channelId = String(item.channel_id);
        const channelType = Number(item.channel_type);
        const key = getConversationKey(channelId, channelType);
        const info = await channelStore.getChannelInfo(channelId, channelType);
        if (version !== resetVersion.value) return;
        const effectiveUnread = getEffectiveUnread(item, key);

        upsertConversation(normalizeConversationInput({ ...item, unread: effectiveUnread }, info));

        unreadMap.value[key] = effectiveUnread;
      }
      await syncExtra();
      if (version !== resetVersion.value) return;
      ensureGroupConversations();
    } catch (e) {
      console.error('[ConversationStore] Failed to sync conversations', e);
      if (options.throwOnError) {
        throw e;
      }
    }
  }

  function ensureGroupConversations() {
    for (const group of Object.values(groupStore.groups)) {
      const key = getConversationKey(group.group_no, 2);
      if (manuallyDeletedConversationKeys.value[key] || findConversation(group.group_no, 2)) {
        continue;
      }
      channelStore.updateChannelInfo(group.group_no, 2, {
        name: group.name,
        avatar: group.avatar,
        top: group.top || 0,
        mute: group.mute || 0,
        notice: group.notice || ''
      });
      upsertConversation(buildConversationFromGroup(group));
    }
  }

  async function prefetchMissingGroupConversationSummaries() {
    const groups = Object.values(groupStore.groups);
    await Promise.all(groups.map(async (group) => {
      const conv = findConversation(group.group_no, 2);
      if (conv && !isGroupJoinPlaceholder(conv)) return;

      try {
        const res: any = await syncApi.syncMessages({
          channel_id: group.group_no,
          channel_type: 2,
          limit: 30,
          start_message_seq: 0,
          end_message_seq: 0,
          pull_mode: 1
        });
        const list = Array.isArray(res?.messages) ? res.messages : [];
        if (!conv || isGroupJoinPlaceholder(conv)) {
          await ensureConversationFromSyncedMessages(group.group_no, 2, list);
        }
      } catch (e) {
        console.warn(`[ConversationStore] Failed to prefetch group summary for ${group.group_no}`, e);
      }
    }));
  }

  async function syncGroupConversations(options: { throwOnError?: boolean } = {}) {
    const version = resetVersion.value;
    await groupStore.fetchMyGroups({ throwOnError: options.throwOnError });
    if (version !== resetVersion.value) return;
    ensureGroupConversations();
    await prefetchMissingGroupConversationSummaries();
  }

  async function syncExtra() {
    const version = resetVersion.value;
    try {
      const res: any = await syncApi.syncConversationExtra({ version: lastSyncVersion.value });
      if (version !== resetVersion.value) return;
      if (res && Array.isArray(res)) {
        for (const item of res) {
          const channelId = String(item.channel_id);
          const channelType = Number(item.channel_type);
          const key = getConversationKey(channelId, channelType);
          const hasDraft = Object.prototype.hasOwnProperty.call(item, 'draft');
          const nextDraft = hasDraft ? String(item.draft || '') : undefined;
          const isLocalOnly = isLocalOnlyDirectConversation(channelId, channelType);
          if (hasDraft && !isLocalOnly) {
            drafts.value[key] = nextDraft || '';
            syncedDrafts.value[key] = nextDraft || '';
          } else if (hasDraft && isLocalOnly) {
            const localDraft = resolveDraft(channelId, channelType, key, '');
            drafts.value[key] = localDraft;
            syncedDrafts.value[key] = localDraft;
          }
          const conv = findConversation(channelId, channelType);
          if (conv) {
            if (hasDraft) {
              conv.draft = isLocalOnly ? resolveDraft(channelId, channelType, key, '') : nextDraft || '';
            }
            conv.top = item.top || 0;
            conv.mute = item.mute || 0;
          }
          if (item.version > lastSyncVersion.value) {
            lastSyncVersion.value = item.version;
          }
        }
      }
    } catch (e) {
      console.error('[ConversationStore] Failed to sync conversation extra', e);
    }
  }

  async function updateDraft(channelId: string, channelType: number, draftText: string) {
    channelId = String(channelId);
    channelType = Number(channelType);
    draftText = String(draftText || '');
    const key = getConversationKey(channelId, channelType);
    if (drafts.value[key] === draftText) {
      if (isLocalOnlyDirectConversation(channelId, channelType)) {
        setStoredLocalOnlyDraft(key, draftText);
      }
      return;
    }

    drafts.value[key] = draftText;
    const conv = findConversation(channelId, channelType);
    if (conv) {
      conv.draft = draftText;
    }

    if (isLocalOnlyDirectConversation(channelId, channelType)) {
      setStoredLocalOnlyDraft(key, draftText);
      syncedDrafts.value[key] = draftText;
      return;
    }

    if (draftSyncTimers.value[key]) {
      clearTimeout(draftSyncTimers.value[key]);
    }
    draftSyncTimers.value[key] = setTimeout(async () => {
      delete draftSyncTimers.value[key];
      const draft = drafts.value[key] || '';
      if (draft === '' && !syncedDrafts.value[key]) {
        return;
      }
      try {
        await syncApi.updateConversationExtra(channelId, channelType, { draft });
        syncedDrafts.value[key] = draft;
      } catch (e) {
        warnRemoteCommandFailure('update conversation extra', e);
      }
    }, 600);
  }

  async function togglePin(channelId: string, channelType: number, pin: boolean) {
    channelId = String(channelId);
    channelType = Number(channelType);
    const top = pin ? 1 : 0;
    const conv = findConversation(channelId, channelType);
    if (conv) {
      conv.top = top;
    }
    try {
      if (channelType === 2) {
        await groupApi.updateSetting(channelId, { top });
      } else {
        await syncApi.updateConversationExtra(channelId, channelType, { top });
      }
    } catch (e) {
      warnRemoteCommandFailure('update conversation extra', e);
    }
  }

  async function toggleMute(channelId: string, channelType: number, muteOn: boolean) {
    channelId = String(channelId);
    channelType = Number(channelType);
    const mute = muteOn ? 1 : 0;
    const conv = findConversation(channelId, channelType);
    if (conv) {
      conv.mute = mute;
    }
    try {
      if (channelType === 2) {
        await groupApi.updateSetting(channelId, { mute });
      } else {
        await syncApi.updateConversationExtra(channelId, channelType, { mute });
      }
    } catch (e) {
      warnRemoteCommandFailure('update mute setting', e);
    }
  }

  async function clearUnread(channelId: string, channelType: number) {
    channelId = String(channelId);
    channelType = Number(channelType);
    const key = getConversationKey(channelId, channelType);
    unreadMap.value[key] = 0;
    const conv = findConversation(channelId, channelType);
    setStoredClearedUnread(key, Number(conv?.last_msg_seq || 0), Number(conv?.last_msg_time || 0));
    if (isBrandNewEmptyConversation(channelId, channelType, conv)) {
      return;
    }
    if (conv) {
      conv.unread = 0;
      clearedUnreadSeqs.value[key] = Math.max(Number(clearedUnreadSeqs.value[key] || 0), Number(conv.last_msg_seq || 0));
    }
    try {
      await syncApi.clearUnread(channelId, channelType, Number(conv?.last_msg_seq || 0));
    } catch (e) {
      warnRemoteCommandFailure('clear unread', e);
    }
  }

  async function addOrUpdateConversation(channelId: string, channelType: number, message: any) {
    const version = resetVersion.value;
    channelId = String(channelId);
    channelType = Number(channelType);
    const key = getConversationKey(channelId, channelType);
    delete manuallyDeletedConversationKeys.value[key];

    const conv = findConversation(channelId, channelType);
    const info = await channelStore.getChannelInfo(channelId, channelType);
    if (version !== resetVersion.value) return;
    const isOwnMessage = message.isOwnMessage === true || message.fromUID === userStore.currentUser?.uid;
    const isDigest = isConversationDigestSource(message);
    const normalizedMsg = normalizeLastMessage({ last_message: message });
    const messageSeq = Number(message.messageSeq || 0);

    if (message.isUnreadCleared && isDigest) {
      clearedUnreadSeqs.value[key] = Math.max(Number(clearedUnreadSeqs.value[key] || 0), messageSeq);
      setStoredClearedUnread(key, messageSeq, Number(message.timestamp || 0));
    } else if (!isOwnMessage && isDigest) {
      removeStoredClearedUnread(key);
    }

    if (conv) {
      conv.last_msg_seq = message.messageSeq || conv.last_msg_seq;
      conv.last_msg_time = message.timestamp || Math.floor(Date.now() / 1000);
      if (isDigest) {
        conv.last_message = normalizedMsg;
      }
      if (message.isUnreadCleared && isDigest) {
        conv.unread = 0;
        unreadMap.value[key] = 0;
      } else if (!isOwnMessage && isDigest) {
        conv.unread++;
        unreadMap.value[key] = conv.unread;
      }
    } else {
      conversations.value.push({
        channel_id: channelId,
        channel_type: channelType,
        unread: (message.isUnreadCleared || isOwnMessage || !isDigest) ? 0 : 1,
        last_msg_seq: message.messageSeq || 0,
        last_msg_time: message.timestamp || Math.floor(Date.now() / 1000),
        last_message: isDigest ? normalizedMsg : undefined,
        top: info.top || 0,
        mute: info.mute || 0,
        draft: resolveDraft(channelId, channelType, key),
        name: info.name,
        avatar: info.avatar
      });
      unreadMap.value[key] = (message.isUnreadCleared || isOwnMessage || !isDigest) ? 0 : 1;
    }
    compactConversations();
  }

  async function ensureConversation(channelId: string, channelType: number, message?: any) {
    const version = resetVersion.value;
    channelId = String(channelId);
    channelType = Number(channelType);
    const key = getConversationKey(channelId, channelType);
    if (manuallyDeletedConversationKeys.value[key]) return undefined;

    const conv = findConversation(channelId, channelType);
    const isOwnMessage = message?.isOwnMessage === true || message?.fromUID === userStore.currentUser?.uid;
    const isDigest = message ? isConversationDigestSource(message) : false;
    const normalizedMsg = message ? normalizeLastMessage({ last_message: message }) : undefined;

    if (conv) {
      if (message) {
        conv.last_msg_seq = message.messageSeq || conv.last_msg_seq;
        conv.last_msg_time = message.timestamp || conv.last_msg_time || Math.floor(Date.now() / 1000);
        if (isDigest || !conv.last_message) {
          conv.last_message = normalizedMsg;
        }
        if (message.isUnreadCleared && isDigest) {
          conv.unread = 0;
          unreadMap.value[key] = 0;
          setStoredClearedUnread(key, Number(message.messageSeq || 0), Number(message.timestamp || 0));
        } else if (!isOwnMessage && isDigest) {
          removeStoredClearedUnread(key);
          conv.unread = Number(conv.unread || 0) + 1;
          unreadMap.value[key] = conv.unread;
        }
      }
      return conv;
    }

    const next: Conversation = {
      channel_id: channelId,
      channel_type: channelType,
      unread: (message?.isUnreadCleared || isOwnMessage || !isDigest) ? 0 : 1,
      last_msg_seq: message?.messageSeq || 0,
      last_msg_time: message?.timestamp || Math.floor(Date.now() / 1000),
      last_message: isDigest ? normalizedMsg : undefined,
      top: 0,
      mute: 0,
      draft: resolveDraft(channelId, channelType, key),
      name: '',
      avatar: ''
    };
    conversations.value.push(next);
    unreadMap.value[key] = next.unread;
    compactConversations();
    const info = await channelStore.getChannelInfo(channelId, channelType);
    if (version !== resetVersion.value) return undefined;
    const current = findConversation(channelId, channelType);
    if (current) {
      current.top = current.top || info.top || 0;
      current.mute = current.mute || info.mute || 0;
      current.name = current.name || info.name || '';
      current.avatar = current.avatar || info.avatar || '';
    }
    return next;
  }

  async function deleteConversation(channelId: string, channelType: number) {
    channelId = String(channelId);
    channelType = Number(channelType);
    conversations.value = conversations.value.filter(c => !(String(c.channel_id) === channelId && Number(c.channel_type) === channelType));
    const key = getConversationKey(channelId, channelType);
    manuallyDeletedConversationKeys.value[key] = true;
    delete unreadMap.value[key];
    try {
      await syncApi.deleteConversation(channelId, channelType);
    } catch (e) {
      console.error('[ConversationStore] Failed to delete conversation remotely', e);
    }
  }

  async function recoverAfterReconnect() {
    recoveryState.value = 'syncing';
    try {
      await syncConversations({ throwOnError: true });
      await syncGroupConversations({ throwOnError: true });
      const messageStore = useMessageStore();
      const activeConversations = [...uniqueConversations.value];
      await Promise.all(activeConversations.map(async conv => {
        await messageStore.syncMessages(conv.channel_id, conv.channel_type);
        await messageStore.syncPinnedMessages(conv.channel_id, conv.channel_type);
      }));
      await messageStore.syncReminders(activeConversations.map(conv => conv.channel_id));
      await groupStore.fetchMyGroups({ throwOnError: true });
      ensureGroupConversations();
      recoveryState.value = 'recovered';
      lastRecoveryAt.value = Date.now();
    } catch (e) {
      recoveryState.value = 'failed';
      throw e;
    }
  }

  function reset() {
    resetVersion.value++;
    conversations.value = [];
    drafts.value = {};
    syncedDrafts.value = {};
    unreadMap.value = {};
    clearedUnreadSeqs.value = {};
    lastSyncVersion.value = 0;
    manuallyDeletedConversationKeys.value = {};
    recoveryState.value = 'idle';
    lastRecoveryAt.value = 0;
    for (const key of Object.keys(draftSyncTimers.value)) {
      clearTimeout(draftSyncTimers.value[key]);
    }
    draftSyncTimers.value = {};
  }

  return {
    conversations,
    drafts,
    unreadMap,
    clearedUnreadSeqs,
    recoveryState,
    lastRecoveryAt,
    sortedConversations,
    totalUnreadCount,
    uniqueConversations,
    syncConversations,
    syncGroupConversations,
    ensureGroupConversations,
    syncExtra,
    updateDraft,
    togglePin,
    toggleMute,
    clearUnread,
    addOrUpdateConversation,
    ensureConversation,
    deleteConversation,
    recoverAfterReconnect,
    reset
  };
});
