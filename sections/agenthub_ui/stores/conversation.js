import { defineStore } from 'pinia';
import { syncApi } from '@/api/sync.js';
import { storage } from '@/utils/storage.js';
import { channelKey, toBackendChannelType, toConversationItem } from '@/utils/im-mappers.js';
import { useAuthStore } from './auth.js';

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
        this.conversations = list.map((item) => toConversationItem(item));
        this.restoreDrafts();
        return this.conversations;
      } catch (err) {
        this.lastError = err?.message || '同步会话失败';
        throw err;
      } finally {
        this.loading = false;
      }
    },
    addOrUpdateConversation(channelId, channelType = 1, patch = {}) {
      const backendType = toBackendChannelType(channelType);
      const key = channelKey(channelId, backendType);
      const index = this.conversations.findIndex((item) => item.key === key || (item.id === String(channelId) && item.channelType === backendType));
      const next = {
        id: String(channelId),
        channelId: String(channelId),
        channelType: backendType,
        key,
        name: patch.name || '未命名会话',
        avatar: patch.avatar || '',
        type: patch.type || (backendType === 2 ? 'group' : 'single'),
        unread: Number(patch.unread || 0),
        lastMessage: patch.lastMessage || '',
        lastTime: patch.lastTime || Date.now(),
        lastMessageSeq: Number(patch.lastMessageSeq || 0),
        isPinned: Boolean(patch.isPinned),
        isMuted: Boolean(patch.isMuted),
        draft: patch.draft || this.getDraft(channelId, backendType) || '',
        memberCount: patch.memberCount || 0,
        ...patch
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
      const conv = this.addOrUpdateConversation(channelId, channelType, { draft: draftText });
      conv.draft = draftText;
      this.persistDraft(channelId, channelType, draftText);
      syncApi.updateConversationExtra(channelId, toBackendChannelType(channelType), { draft: draftText }).catch(() => undefined);
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
