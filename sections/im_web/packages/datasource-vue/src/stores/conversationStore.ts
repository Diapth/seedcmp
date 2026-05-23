import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { syncApi } from '../api';
import { useChannelStore } from './channelStore';
import { useGroupStore } from './groupStore';
import { useUserStore } from './userStore';

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

export const useConversationStore = defineStore('conversation', () => {
  const conversations = ref<Conversation[]>([]);
  const drafts = ref<Record<string, string>>({});
  const unreadMap = ref<Record<string, number>>({});
  const clearedUnreadSeqs = ref<Record<string, number>>({});
  const lastSyncVersion = ref<number>(0);
  const manuallyDeletedConversationKeys = ref<Record<string, true>>({});
  const draftSyncTimers = ref<Record<string, ReturnType<typeof setTimeout>>>({});

  const channelStore = useChannelStore();
  const groupStore = useGroupStore();
  const userStore = useUserStore();

  function getConversationKey(channelId: string, channelType: number) {
    return `${String(channelId)}-${Number(channelType)}`;
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
    return raw && ![99, 1000].includes(getMessageType(raw));
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

  function normalizeConversationInput(item: any, info: any): Conversation {
    const channelId = String(item.channel_id);
    const channelType = Number(item.channel_type);
    const key = getConversationKey(channelId, channelType);
    const rawLastMessage = getLastMessageSource(item);

    return {
      channel_id: channelId,
      channel_type: channelType,
      unread: Number(item.unread || 0),
      last_msg_seq: Number(item.last_msg_seq || rawLastMessage?.message_seq || rawLastMessage?.messageSeq || 0),
      last_msg_time: Number(item.last_msg_time || item.timestamp || rawLastMessage?.timestamp || 0),
      last_message: normalizeLastMessage(item),
      top: info.top || item.top || item.stick || item.extra?.top || item.extra?.stick || 0,
      mute: info.mute || item.mute || item.extra?.mute || 0,
      draft: drafts.value[key] || item.extra?.draft || item.draft || '',
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
        draft: drafts.value[key] || normalized.draft || existing.draft || ''
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

  function getEffectiveUnread(item: any, key: string) {
    const unread = Number(item.unread || 0);
    const clearedSeq = Number(clearedUnreadSeqs.value[key] || 0);
    const itemSeq = Number(item.last_msg_seq || item.message_seq || item.last_message?.message_seq || item.last_message?.messageSeq || 0);

    if (clearedSeq > 0 && itemSeq > 0 && itemSeq <= clearedSeq) {
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
        draft: drafts.value[key] || next.draft || conv.draft || ''
      });
    } else {
      conversations.value.push(next);
    }
    compactConversations();
  }

  async function syncConversations() {
    try {
      const res: any = await syncApi.syncConversations({ msg_count: 1 });
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
        const effectiveUnread = getEffectiveUnread(item, key);

        upsertConversation(normalizeConversationInput({ ...item, unread: effectiveUnread }, info));

        unreadMap.value[key] = effectiveUnread;
      }
      await syncExtra();
    } catch (e) {
      console.error('[ConversationStore] Failed to sync conversations', e);
    }
  }

  async function syncExtra() {
    try {
      const res: any = await syncApi.syncConversationExtra({ version: lastSyncVersion.value });
      if (res && Array.isArray(res)) {
        for (const item of res) {
          const channelId = String(item.channel_id);
          const channelType = Number(item.channel_type);
          const key = getConversationKey(channelId, channelType);
          if (item.draft) {
            drafts.value[key] = item.draft;
          }
          const conv = findConversation(channelId, channelType);
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
    } catch (e) {
      console.error('[ConversationStore] Failed to sync conversation extra', e);
    }
  }

  async function updateDraft(channelId: string, channelType: number, draftText: string) {
    channelId = String(channelId);
    channelType = Number(channelType);
    const key = getConversationKey(channelId, channelType);
    if (drafts.value[key] === draftText) {
      return;
    }

    drafts.value[key] = draftText;
    const conv = findConversation(channelId, channelType);
    if (conv) {
      conv.draft = draftText;
    }

    if (draftSyncTimers.value[key]) {
      clearTimeout(draftSyncTimers.value[key]);
    }
    draftSyncTimers.value[key] = setTimeout(async () => {
      delete draftSyncTimers.value[key];
      try {
        await syncApi.updateConversationExtra(channelId, channelType, { draft: drafts.value[key] || '' });
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
      await syncApi.updateConversationExtra(channelId, channelType, { top });
    } catch (e) {
      warnRemoteCommandFailure('update conversation extra', e);
    }
  }

  async function clearUnread(channelId: string, channelType: number) {
    channelId = String(channelId);
    channelType = Number(channelType);
    const key = getConversationKey(channelId, channelType);
    unreadMap.value[key] = 0;
    const conv = findConversation(channelId, channelType);
    if (conv) {
      conv.unread = 0;
      clearedUnreadSeqs.value[key] = Math.max(Number(clearedUnreadSeqs.value[key] || 0), Number(conv.last_msg_seq || 0));
    }
    try {
      await syncApi.clearUnread(channelId, channelType);
    } catch (e) {
      warnRemoteCommandFailure('clear unread', e);
    }
  }

  async function addOrUpdateConversation(channelId: string, channelType: number, message: any) {
    channelId = String(channelId);
    channelType = Number(channelType);
    const key = getConversationKey(channelId, channelType);
    delete manuallyDeletedConversationKeys.value[key];

    const conv = findConversation(channelId, channelType);
    const info = await channelStore.getChannelInfo(channelId, channelType);
    const isOwnMessage = message.isOwnMessage === true || message.fromUID === userStore.currentUser?.uid;
    const isDigest = isConversationDigestSource(message);
    const normalizedMsg = normalizeLastMessage({ last_message: message });
    const messageSeq = Number(message.messageSeq || 0);

    if (message.isUnreadCleared && isDigest) {
      clearedUnreadSeqs.value[key] = Math.max(Number(clearedUnreadSeqs.value[key] || 0), messageSeq);
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
        unread: (isOwnMessage || !isDigest) ? 0 : 1,
        last_msg_seq: message.messageSeq || 0,
        last_msg_time: message.timestamp || Math.floor(Date.now() / 1000),
        last_message: isDigest ? normalizedMsg : undefined,
        top: info.top || 0,
        mute: info.mute || 0,
        draft: drafts.value[key] || '',
        name: info.name,
        avatar: info.avatar
      });
      unreadMap.value[key] = (isOwnMessage || !isDigest) ? 0 : 1;
    }
    compactConversations();
  }

  async function ensureConversation(channelId: string, channelType: number, message?: any) {
    channelId = String(channelId);
    channelType = Number(channelType);
    const key = getConversationKey(channelId, channelType);
    if (manuallyDeletedConversationKeys.value[key]) return undefined;

    const conv = findConversation(channelId, channelType);
    const isDigest = message ? isConversationDigestSource(message) : false;
    const normalizedMsg = message ? normalizeLastMessage({ last_message: message }) : undefined;

    if (conv) {
      if (message) {
        conv.last_msg_seq = message.messageSeq || conv.last_msg_seq;
        conv.last_msg_time = message.timestamp || conv.last_msg_time || Math.floor(Date.now() / 1000);
        if (isDigest) {
          conv.last_message = normalizedMsg;
        }
      }
      return conv;
    }

    const info = await channelStore.getChannelInfo(channelId, channelType);
    const next: Conversation = {
      channel_id: channelId,
      channel_type: channelType,
      unread: 0,
      last_msg_seq: message?.messageSeq || 0,
      last_msg_time: message?.timestamp || Math.floor(Date.now() / 1000),
      last_message: isDigest ? normalizedMsg : undefined,
      top: info.top || 0,
      mute: info.mute || 0,
      draft: drafts.value[key] || '',
      name: info.name,
      avatar: info.avatar
    };
    conversations.value.push(next);
    unreadMap.value[key] = 0;
    compactConversations();
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

  return {
    conversations,
    drafts,
    unreadMap,
    clearedUnreadSeqs,
    sortedConversations,
    totalUnreadCount,
    uniqueConversations,
    syncConversations,
    syncExtra,
    updateDraft,
    togglePin,
    clearUnread,
    addOrUpdateConversation,
    ensureConversation,
    deleteConversation
  };
});
