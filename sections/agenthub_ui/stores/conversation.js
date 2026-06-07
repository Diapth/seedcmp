import { defineStore } from 'pinia';
import { syncApi } from '@/api/sync.js';
import { storage } from '@/utils/storage.js';
import { buildConversationChannelCache, buildConversationUserCache, channelKey, toBackendChannelType, toConversationItem, toGroupConversationInput } from '@/utils/im-mappers.js';
import { useAppStore } from './app.js';
import { useAuthStore } from './auth.js';
import { useContactStore } from './contact.js';
import { useGroupStore } from './group.js';
import { useUserStore } from './user.js';

function sortConversations(list) {
  return [...list].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return Number(b.lastTime || 0) - Number(a.lastTime || 0);
  });
}

function draftsKey(uid) {
  return `conversationDrafts:${uid || 'anonymous'}`;
}

function hiddenKey(uid) {
  return `conversationHidden:${uid || 'anonymous'}`;
}

function isLocalOnlyDirectConversation(channelId, channelType) {
  const id = String(channelId || '');
  return toBackendChannelType(channelType) === 1 &&
    (id === 'deepseek_ai_robot' ||
      id === 'clowder_ai' ||
      id.startsWith('clowder:') ||
      id.startsWith('clowder_cat:'));
}

function mergeConversations(primary = [], secondary = []) {
  const merged = new Map();
  [...primary, ...secondary].forEach((item) => {
    if (!item?.key) return;
    const existing = merged.get(item.key);
    if (!existing || Number(item.lastTime || 0) >= Number(existing.lastTime || 0)) {
      merged.set(item.key, existing ? { ...existing, ...item } : item);
    }
  });
  return Array.from(merged.values());
}

function buildContactChannelCache(contacts = []) {
  return contacts.reduce((cache, contact) => {
    if (!contact?.id) return cache;
    cache[channelKey(contact.id, 1)] = {
      name: contact.remark || contact.nickname || contact.name || contact.id,
      avatar: contact.avatar || '',
      raw: contact.raw || contact
    };
    return cache;
  }, {});
}

function buildContactUserCache(contacts = []) {
  return contacts.reduce((cache, contact) => {
    if (!contact?.id) return cache;
    cache[contact.id] = {
      id: contact.id,
      uid: contact.id,
      name: contact.remark || contact.nickname || contact.name || contact.id,
      nickname: contact.nickname || contact.name || contact.remark || contact.id,
      avatar: contact.avatar || '',
      raw: contact.raw || contact
    };
    return cache;
  }, {});
}

function buildCurrentUserCache() {
  const authStore = useAuthStore();
  const currentUser = useAppStore().currentUser || {};
  const uid = String(authStore.uid || currentUser.uid || currentUser.id || currentUser.user_id || currentUser.username || '');
  if (!uid) return {};
  const name = currentUser.nickname || currentUser.name || currentUser.displayName || currentUser.username || uid;
  return {
    [uid]: {
      id: uid,
      uid,
      name,
      nickname: currentUser.nickname || name,
      avatar: currentUser.avatar || currentUser.logo || '',
      raw: currentUser
    }
  };
}

function buildMemberUserCache(members = []) {
  return members.reduce((cache, member) => {
    const id = member.id || member.uid || member.user_id || member.userId || member.member_uid || member.memberUid || member.username || '';
    if (!id) return cache;
    cache[id] = {
      id,
      uid: id,
      name: member.remark || member.nickname || member.name || member.username || id,
      nickname: member.nickname || member.name || member.remark || id,
      avatar: member.avatar || member.logo || '',
      raw: member.raw || member
    };
    return cache;
  }, {});
}

function isPlaceholderConversationName(name = '') {
  const value = String(name || '').trim();
  return !value || value === '未命名会话' || value === '用户';
}

export const useConversationStore = defineStore('conversation', {
  state: () => ({
    activeId: '',
    currentUid: storage.get('auth.uid') || '',
    conversations: [],
    members: {},
    announcements: {},
    creatorIds: {},
    isHidden: storage.get(hiddenKey(storage.get('auth.uid'))) || [],
    loading: false,
    lastError: ''
  }),
  getters: {
    visibleConversations(state) {
      return sortConversations(state.conversations.filter((c) => !state.isHidden.includes(c.id)));
    },
    hiddenConversations(state) {
      return state.conversations.filter((c) => state.isHidden.includes(c.id));
    },
    groupMembers(state) {
      return (convId) => state.members[convId] || [];
    },
    isGroupCreator(state) {
      return (convId, userId) => state.creatorIds[convId] === userId;
    }
  },
  actions: {
    setCurrentUid(uid) {
      this.currentUid = uid || '';
      this.isHidden = storage.get(hiddenKey(this.currentUid)) || [];
      this.restoreDrafts();
    },
    getConversation(id, channelType = '') {
      const type = channelType ? toBackendChannelType(channelType) : null;
      return this.conversations.find((item) => item.id === id && (!type || item.channelType === type));
    },
    async fetchConversations() {
      this.loading = true;
      this.lastError = '';
      try {
        const response = await syncApi.syncConversations({ msg_count: 30 });
        const data = response?.data || response || {};
        const list = data.conversations || data.conversation_list || [];
        const contactStore = useContactStore();
        const contacts = await contactStore.fetchContacts().catch(() => contactStore.contacts);
        const channelCache = {
          ...buildContactChannelCache(contacts),
          ...buildConversationChannelCache(data)
        };
        const userCache = {
          ...buildContactUserCache(contacts),
          ...buildConversationUserCache(data),
          ...buildCurrentUserCache()
        };
        const directConversations = list.map((item) => toConversationItem(item, channelCache, userCache));
        const groupConversations = await this.fetchGroupConversations(channelCache, userCache);
        this.conversations = mergeConversations(directConversations, groupConversations);
        await this.resolveMissingDirectConversationIdentities();
        this.restoreDrafts();
        return this.conversations;
      } catch (err) {
        this.lastError = err?.message || '同步会话失败';
        throw err;
      } finally {
        this.loading = false;
      }
    },
    async fetchGroupConversations(channelCache = {}, baseUserCache = {}) {
      const groupStore = useGroupStore();
      try {
        const groups = await groupStore.fetchMyGroups();
        const conversations = await Promise.all(groups.map(async (group) => {
          let messages = [];
          let members = [];
          try {
            members = await groupStore.fetchMembers(group.id);
            if (members.length) {
              this.initFromGroupMembers(group.id, members, group.creatorId);
            }
          } catch {
            members = [];
          }
          try {
            const response = await syncApi.syncMessages({
              channel_id: group.id,
              channel_type: 2,
              limit: 10,
              start_message_seq: 0,
              end_message_seq: 0,
              pull_mode: 1
            });
            const data = response?.data || response || {};
            messages = data.messages || [];
          } catch {
            messages = [];
          }
          const groupWithCount = {
            ...group,
            memberCount: Math.max(group.memberCount || 0, members.length)
          };
          return toConversationItem(
            toGroupConversationInput(groupWithCount, messages),
            channelCache,
            { ...baseUserCache, ...buildMemberUserCache(members) }
          );
        }));
        return conversations;
      } catch {
        return [];
      }
    },
    async resolveMissingDirectConversationIdentities(conversations = this.conversations) {
      const userStore = useUserStore();
      const missing = conversations.filter((item) => {
        return item?.channelType === 1 &&
          !isLocalOnlyDirectConversation(item.id, item.channelType) &&
          isPlaceholderConversationName(item.name);
      });
      await Promise.all(missing.map(async (conversation) => {
        try {
          const user = await userStore.fetchUser(conversation.id);
          if (!user?.uid) return;
          this.addOrUpdateConversation(conversation.id, 1, {
            name: user.name || user.nickname || conversation.name,
            avatar: user.avatar || conversation.avatar
          });
        } catch {
          // A missing user profile must not block message history display.
        }
      }));
    },
    addOrUpdateConversation(channelId, channelType = 1, patch = {}) {
      const backendType = toBackendChannelType(channelType);
      const key = channelKey(channelId, backendType);
      const index = this.conversations.findIndex((item) => item.key === key || (item.id === String(channelId) && item.channelType === backendType));
      const existing = index >= 0 ? this.conversations[index] : {};
      const hasPatch = (field) => Object.prototype.hasOwnProperty.call(patch, field);
      const defaultType = backendType === 2 ? 'group' : 'single';
      const next = {
        ...existing,
        ...patch,
        id: String(channelId),
        channelId: String(channelId),
        channelType: backendType,
        key,
        name: hasPatch('name') ? (patch.name || existing.name || '未命名会话') : (existing.name || '未命名会话'),
        avatar: hasPatch('avatar') ? (patch.avatar || existing.avatar || '') : (existing.avatar || ''),
        type: hasPatch('type') ? (patch.type || existing.type || defaultType) : (existing.type || defaultType),
        unread: hasPatch('unread') ? Number(patch.unread || 0) : Number(existing.unread || 0),
        lastMessage: hasPatch('lastMessage') ? (patch.lastMessage ?? '') : (existing.lastMessage || ''),
        lastTime: hasPatch('lastTime') ? (patch.lastTime || Date.now()) : (existing.lastTime || Date.now()),
        lastMessageSeq: hasPatch('lastMessageSeq') ? Number(patch.lastMessageSeq || 0) : Number(existing.lastMessageSeq || 0),
        isPinned: hasPatch('isPinned') ? Boolean(patch.isPinned) : Boolean(existing.isPinned),
        isMuted: hasPatch('isMuted') ? Boolean(patch.isMuted) : Boolean(existing.isMuted),
        draft: hasPatch('draft') ? (patch.draft ?? '') : (existing.draft || this.getDraft(channelId, backendType) || ''),
        memberCount: hasPatch('memberCount') ? (patch.memberCount || 0) : (existing.memberCount || 0)
      };
      if (index >= 0) {
        this.conversations[index] = { ...this.conversations[index], ...next };
      } else {
        this.conversations.unshift(next);
      }
      return next;
    },
    setActiveId(id) {
      this.activeId = id;
      this.clearUnread(id);
      storage.set('active_conversation_id', id);
    },
    async clearUnread(id, channelType = '') {
      const conv = this.getConversation(id, channelType) || this.conversations.find((c) => c.id === id);
      if (conv) {
        conv.unread = 0;
        try {
          await syncApi.clearUnread(conv.channelId || conv.id, conv.channelType || toBackendChannelType(conv.type), conv.lastMessageSeq || 0);
        } catch {
          // Local clear is allowed to stay; backend will re-sync if rejected.
        }
      }
    },
    getDraft(channelId, channelType = 1) {
      const drafts = storage.get(draftsKey(this.currentUid || useAuthStore().uid)) || {};
      return drafts[channelKey(channelId, channelType)] || '';
    },
    persistDraft(channelId, channelType, draftText) {
      const key = draftsKey(this.currentUid || useAuthStore().uid);
      const drafts = storage.get(key) || {};
      drafts[channelKey(channelId, channelType)] = draftText;
      storage.set(key, drafts);
    },
    restoreDrafts() {
      const drafts = storage.get(draftsKey(this.currentUid || useAuthStore().uid)) || {};
      this.conversations.forEach((conv) => {
        conv.draft = drafts[channelKey(conv.channelId || conv.id, conv.channelType || conv.type)] || conv.draft || '';
      });
    },
    setDraft(channelId, channelType, draftText) {
      const backendType = toBackendChannelType(channelType);
      const normalizedDraft = String(draftText || '');
      const existing = this.getConversation(channelId, backendType) || this.conversations.find((c) => c.id === String(channelId));
      const previousDraft = existing?.draft ?? this.getDraft(channelId, backendType) ?? '';
      if (String(previousDraft || '') === normalizedDraft) {
        return existing || null;
      }

      const conv = this.addOrUpdateConversation(channelId, backendType, { draft: normalizedDraft });
      conv.draft = normalizedDraft;
      this.persistDraft(channelId, backendType, normalizedDraft);
      if (isLocalOnlyDirectConversation(channelId, backendType)) {
        return conv;
      }
      if (normalizedDraft === '' && !previousDraft) {
        return conv;
      }
      syncApi.updateConversationExtra(channelId, backendType, { draft: normalizedDraft }).catch(() => undefined);
      return conv;
    },
    updateConversationDraft(id, draftText) {
      const conv = this.conversations.find((item) => item.id === id);
      this.setDraft(id, conv?.channelType || conv?.type || 1, draftText);
    },
    async pinConversation(id, pinned) {
      const conv = this.conversations.find((c) => c.id === id);
      if (!conv) return;
      conv.isPinned = Boolean(pinned);
      await syncApi.updateConversationExtra(conv.id, conv.channelType, { top: pinned ? 1 : 0 }).catch(() => undefined);
    },
    async muteConversation(id, muted) {
      const conv = this.conversations.find((c) => c.id === id);
      if (!conv) return;
      conv.isMuted = Boolean(muted);
      await syncApi.updateConversationExtra(conv.id, conv.channelType, { mute: muted ? 1 : 0 }).catch(() => undefined);
    },
    hideConversation(id) {
      if (!this.isHidden.includes(id)) {
        this.isHidden.push(id);
        storage.set(hiddenKey(this.currentUid || useAuthStore().uid), this.isHidden);
      }
    },
    unhideConversation(id) {
      this.isHidden = this.isHidden.filter((x) => x !== id);
      storage.set(hiddenKey(this.currentUid || useAuthStore().uid), this.isHidden);
    },
    async deleteConversation(id) {
      const conv = this.conversations.find((c) => c.id === id);
      this.conversations = this.conversations.filter((c) => c.id !== id);
      this.isHidden = this.isHidden.filter((x) => x !== id);
      if (this.activeId === id) this.activeId = '';
      if (conv) {
        await syncApi.deleteConversation(conv.id, conv.channelType).catch(() => undefined);
      }
    },
    setAnnouncement(convId, text) {
      this.announcements[convId] = {
        text,
        publisherId: this.currentUid || useAuthStore().uid,
        publishTime: Date.now()
      };
    },
    updateMemberRole(convId, memberId, role) {
      const member = this.members[convId]?.find((item) => item.id === memberId);
      if (member) member.role = role;
    },
    updateMemberRemark(convId, memberId, remark) {
      const member = this.members[convId]?.find((item) => item.id === memberId);
      if (member) member.remark = remark;
    },
    upsertDirectConversation(member) {
      if (!member?.id || member.id === (this.currentUid || useAuthStore().uid)) return null;
      return this.addOrUpdateConversation(member.id, 1, {
        name: member.remark || member.nickname || member.name || '用户',
        avatar: member.avatar || '',
        type: 'single',
        lastMessage: '可以开始聊天了',
        lastTime: Date.now()
      });
    },
    addMember(convId, member) {
      if (!this.members[convId]) this.members[convId] = [];
      if (!this.members[convId].some((m) => m.id === member.id)) {
        this.members[convId].push({ isMuted: false, role: 'member', ...member });
      }
    },
    removeMember(convId, memberId) {
      if (!this.members[convId]) return;
      this.members[convId] = this.members[convId].filter((m) => m.id !== memberId);
    },
    initFromGroupMembers(convId, members, creatorId) {
      this.members[convId] = members.map((m) => ({ isMuted: false, role: 'member', ...m }));
      if (creatorId) this.creatorIds[convId] = creatorId;
      if (this.members[convId].length) {
        this.addOrUpdateConversation(convId, 2, { memberCount: this.members[convId].length });
      }
    },
    async recoverAfterReconnect() {
      await this.fetchConversations();
    },
    reset() {
      this.activeId = '';
      this.conversations = [];
      this.members = {};
      this.announcements = {};
      this.creatorIds = {};
      this.isHidden = [];
      this.loading = false;
      this.lastError = '';
    }
  }
});
