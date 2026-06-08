import { defineStore } from 'pinia';
import { nativeImService } from '@/services/native-im/service';
import { isAuthExpiredError } from '@/services/native-im/api-client';
import {
  applyDraftToConversationList,
  conversationDraftKey,
  dropMockConversations,
  mergeRemoteDrafts,
  shouldPersistConversationDraft,
  upsertGroupConversation
} from '@/services/native-im/conversation-state';
import {
  createAgentConversation,
  createAgentMember,
  shouldPreserveClowderAgentDisplayName
} from '@/services/native-im/agent-state';

function channelTypeFromConversation(conversation = {}) {
  if (conversation.channelType) return Number(conversation.channelType);
  if (conversation.type === 'group') return 2;
  return 1;
}

function sortConversations(list) {
  return [...list].sort((a, b) => {
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
    return (b.lastTime || 0) - (a.lastTime || 0);
  });
}

function errorText(error) {
  return error?.msg || error?.message || '同步失败';
}

function readCurrentUserId() {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') return 'anonymous';
  try {
    const raw = uni.getStorageSync('app_user');
    const user = raw ? JSON.parse(raw) : {};
    return String(user.id || user.uid || user.raw?.uid || uni.getStorageSync('app_user_uid') || 'anonymous');
  } catch {
    return 'anonymous';
  }
}

function draftStorageKey() {
  return `agenthub:conversation-drafts:${readCurrentUserId()}`;
}

function readDraftCache() {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') return {};
  try {
    const raw = uni.getStorageSync(draftStorageKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeDraftCache(cache) {
  if (typeof uni === 'undefined' || typeof uni.setStorageSync !== 'function') return;
  try {
    uni.setStorageSync(draftStorageKey(), JSON.stringify(cache || {}));
  } catch {
    // local draft storage must never block typing
  }
}

export const useConversationStore = defineStore('conversation', {
  state: () => ({
    activeId: '',
    syncState: 'idle',
    syncError: '',
    lastNativeSyncAt: 0,
    draftDirtyKeys: {},
    draftSyncTimers: {},
    conversations: [
      {
        id: '1',
        name: '张伟',
        avatar: '',
        type: 'single',
        unread: 2,
        lastMessage: '下午的会议材料准备好了吗？',
        lastTime: 1780490000000,
        isPinned: false,
        isMuted: false,
        draft: '',
        source: 'mock'
      },
      {
        id: '2',
        name: 'AgentHub 产品研发群',
        avatar: '',
        type: 'group',
        unread: 0,
        lastMessage: '王五: [文件] usv_layout_front_view.png',
        lastTime: 1780490300000,
        isPinned: true,
        isMuted: true,
        draft: '',
        source: 'mock'
      },
      {
        id: 'agent-review',
        name: '智能体方案评审群',
        avatar: '',
        type: 'group',
        unread: 1,
        lastMessage: 'Codex: Console 日志页已经切换为完整页面',
        lastTime: 1780490800000,
        memberCount: 6,
        isPinned: true,
        isMuted: false,
        draft: '',
        source: 'mock'
      },
      {
        id: '3',
        name: 'DeepSeek 智能体',
        avatar: '',
        type: 'robot',
        unread: 0,
        lastMessage: '我是您的AI小助手，随时为您服务',
        lastTime: 1780489000000,
        isPinned: false,
        isMuted: false,
        draft: '',
        source: 'mock'
      }
    ],
    // PR-9 新增: 群成员/公告/创建者/隐藏
    members: {
      // 群 id '2' (AgentHub 产品研发群) 默认成员
      '2': [
        { id: 'me', nickname: '我', avatar: '', role: 'owner', isMuted: false },
        { id: '1', nickname: '张伟', avatar: '', role: 'admin', isMuted: false },
        { id: '4', nickname: '李四', avatar: '', role: 'member', isMuted: false },
        { id: '5', nickname: '王五', avatar: '', role: 'member', isMuted: true }
      ],
      'agent-review': [
        { id: 'me', nickname: '我', avatar: '', role: 'owner', isMuted: false },
        { id: 'pm-agent', nickname: 'PM 智能体', avatar: '', role: 'admin', isMuted: false },
        { id: 'codex', nickname: 'Codex', avatar: '', role: 'member', isMuted: false },
        { id: 'claude-code', nickname: 'Claude Code', avatar: '', role: 'member', isMuted: false },
        { id: 'logic-weaver', nickname: '逻辑编织者', avatar: '', role: 'member', isMuted: false },
        { id: 'clowder', nickname: 'Clowder 协同猫', avatar: '', role: 'member', isMuted: false }
      ]
    },
    announcements: {
      '2': {
        text: '欢迎来到 AgentHub 产品研发群，本周目标：完成阶段 9 的所有 PR 🎉',
        publisherId: 'me',
        publishTime: 1780400000000
      },
      'agent-review': {
        text: '本群用于多智能体协作评审：任务进展看看板，过程输出看 Console 日志。',
        publisherId: 'me',
        publishTime: 1780490400000
      }
    },
    creatorIds: {
      '2': 'me',
      'agent-review': 'me'
    },
    isHidden: []
  }),
  getters: {
    visibleConversations(state) {
      return state.conversations.filter((c) => !state.isHidden.includes(c.id));
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
    setActiveId(id) {
      this.activeId = id;
      this.clearUnread(id);
    },
    clearUnread(id) {
      const conv = this.conversations.find((c) => c.id === id);
      if (conv) {
        conv.unread = 0;
      }
    },
    async markConversationRead(conversationOrId, options = {}) {
      const identity = this.getConversationIdentity(conversationOrId);
      const conversationId = identity.conversationId || identity.channelId;
      if (conversationId) this.clearUnread(conversationId);
      if (options.persist === false || !identity.channelId) return null;
      try {
        return await nativeImService.clearConversationUnread({
          channelId: identity.channelId,
          channelType: identity.channelType,
          messageSeq: options.messageSeq || 0
        });
      } catch (error) {
        this.syncError = errorText(error);
        if (!options.silent) throw error;
        return null;
      }
    },
    updateConversationDraft(id, draftText, options = {}) {
      const conversation = typeof id === 'string'
        ? this.conversations.find((item) => item.id === id)
        : id;
      const identity = this.getConversationIdentity(id);
      const key = conversationDraftKey(identity.channelId, identity.channelType);
      const normalizedDraft = String(draftText || '');
      this.conversations = applyDraftToConversationList(
        this.conversations,
        identity.channelId,
        identity.channelType,
        normalizedDraft
      );

      const cache = readDraftCache();
      if (normalizedDraft) {
        cache[key] = normalizedDraft;
      } else {
        delete cache[key];
      }
      writeDraftCache(cache);

      if (
        options.persist === false
        || !identity.channelId
        || !shouldPersistConversationDraft(conversation, identity)
      ) return;
      this.draftDirtyKeys[key] = true;
      if (this.draftSyncTimers[key]) {
        clearTimeout(this.draftSyncTimers[key]);
      }
      this.draftSyncTimers[key] = setTimeout(async () => {
        delete this.draftSyncTimers[key];
        try {
          await nativeImService.updateConversationExtra({
            channelId: identity.channelId,
            channelType: identity.channelType,
            draft: normalizedDraft
          });
          delete this.draftDirtyKeys[key];
        } catch (error) {
          this.syncError = errorText(error);
        }
      }, options.delayMs ?? 600);
    },
    // PR-9 新增 actions
    pinConversation(id, pinned) {
      const conv = this.conversations.find((c) => c.id === id);
      if (conv) conv.isPinned = !!pinned;
    },
    muteConversation(id, muted) {
      const conv = this.conversations.find((c) => c.id === id);
      if (conv) conv.isMuted = !!muted;
    },
    async updateNativeConversationSettings(conversationOrId, fields = {}, options = {}) {
      const conversation = typeof conversationOrId === 'string'
        ? this.conversations.find((item) => item.id === conversationOrId)
        : conversationOrId;
      if (!conversation) return null;

      const previous = {
        isPinned: conversation.isPinned,
        isMuted: conversation.isMuted
      };

      if (Object.prototype.hasOwnProperty.call(fields, 'isPinned')) {
        this.pinConversation(conversation.id, fields.isPinned);
      }
      if (Object.prototype.hasOwnProperty.call(fields, 'isMuted')) {
        this.muteConversation(conversation.id, fields.isMuted);
      }

      const settingFields = {};
      if (Object.prototype.hasOwnProperty.call(fields, 'isPinned')) {
        settingFields.isPinned = conversation.isPinned;
      }
      if (Object.prototype.hasOwnProperty.call(fields, 'isMuted')) {
        settingFields.isMuted = conversation.isMuted;
      }

      if (!Object.keys(settingFields).length || options.persist === false) {
        return conversation;
      }

      try {
        const identity = this.getConversationIdentity(conversation);
        await nativeImService.updateConversationSettings({
          channelId: identity.channelId,
          channelType: identity.channelType,
          ...settingFields
        });
        return conversation;
      } catch (error) {
        if (Object.prototype.hasOwnProperty.call(fields, 'isPinned')) {
          this.pinConversation(conversation.id, previous.isPinned);
        }
        if (Object.prototype.hasOwnProperty.call(fields, 'isMuted')) {
          this.muteConversation(conversation.id, previous.isMuted);
        }
        this.syncError = errorText(error);
        if (!options.silent) throw error;
        return conversation;
      }
    },
    hideConversation(id) {
      if (!this.isHidden.includes(id)) this.isHidden.push(id);
    },
    unhideConversation(id) {
      this.isHidden = this.isHidden.filter((x) => x !== id);
    },
    deleteConversation(id) {
      this.conversations = this.conversations.filter((c) => c.id !== id);
      this.isHidden = this.isHidden.filter((x) => x !== id);
      if (this.activeId === id) this.activeId = '';
    },
    setAnnouncement(convId, text) {
      this.announcements[convId] = {
        text,
        publisherId: 'me',
        publishTime: Date.now()
      };
    },
    updateMemberRole(convId, memberId, role) {
      const list = this.members[convId];
      if (!list) return;
      const m = list.find((x) => x.id === memberId);
      if (m) m.role = role;
    },
    updateMemberRemark(convId, memberId, remark) {
      const list = this.members[convId];
      if (!list) return;
      const m = list.find((x) => x.id === memberId);
      if (m) m.remark = remark;
    },
    upsertDirectConversation(member) {
      if (!member?.id || member.id === 'me') return null;
      let conv = this.conversations.find((c) => c.id === member.id);
      if (!conv) {
        conv = {
          id: member.id,
          name: member.remark || member.nickname || member.name || '用户',
          avatar: member.avatar || '',
          type: 'single',
          unread: 0,
          lastMessage: '可以开始聊天了',
          lastTime: Date.now(),
          isPinned: false,
          isMuted: false,
          draft: ''
        };
        this.conversations.unshift(conv);
      }
      return conv;
    },
    addMember(convId, member) {
      if (!this.members[convId]) this.members[convId] = [];
      if (!this.members[convId].some((m) => m.id === member.id)) {
        this.members[convId].push({ isMuted: false, role: 'member', ...member });
      }
    },
    addAgentMember(convId, agent) {
      const member = createAgentMember(agent);
      if (!member.id) return null;
      this.addMember(convId, member);
      return this.members[convId].find((item) => item.id === member.id) || null;
    },
    removeMember(convId, memberId) {
      if (!this.members[convId]) return;
      this.members[convId] = this.members[convId].filter((m) => m.id !== memberId);
    },
    initFromGroupMembers(convId, members, creatorId) {
      this.members[convId] = members.map((m) => ({ isMuted: false, role: 'member', ...m }));
      if (creatorId) this.creatorIds[convId] = creatorId;
    },
    applyNativeConversations(list = [], options = {}) {
      if (options.replaceMock || list.length > 0) {
        this.conversations = dropMockConversations(this.conversations);
      }
      const draftCache = readDraftCache();
      list.forEach((nativeConversation) => {
        const existing = this.conversations.find((item) => {
          if (nativeConversation.key && item.key === nativeConversation.key) return true;
          return item.id === nativeConversation.id && channelTypeFromConversation(item) === nativeConversation.channelType;
        });
        if (existing) {
          const preservedAgentDisplay = shouldPreserveClowderAgentDisplayName(existing, nativeConversation)
            ? {
              name: existing.name,
              avatar: existing.avatar,
              type: existing.type,
              source: existing.source,
              isAgent: existing.isAgent,
              agentId: existing.agentId,
              directCatId: existing.directCatId
            }
            : {};
          const key = conversationDraftKey(
            nativeConversation.channelId || nativeConversation.id,
            nativeConversation.channelType || channelTypeFromConversation(nativeConversation)
          );
          const hasRemoteDraft = Object.prototype.hasOwnProperty.call(nativeConversation, 'draft');
          const draft = this.draftDirtyKeys[key]
            ? existing.draft || ''
            : hasRemoteDraft
              ? String(nativeConversation.draft || '')
              : (draftCache[key] || existing.draft || '');
          const localHidden = this.isHidden.includes(existing.id);
          Object.assign(existing, nativeConversation, {
            draft,
            isPinned: existing.isPinned || nativeConversation.isPinned,
            isMuted: existing.isMuted || nativeConversation.isMuted,
            ...preservedAgentDisplay
          });
          if (existing.id === this.activeId) {
            existing.unread = 0;
          }
          if (localHidden && !this.isHidden.includes(existing.id)) this.isHidden.push(existing.id);
        } else {
          this.conversations.push({
            unread: 0,
            isPinned: false,
            isMuted: false,
            draft: draftCache[conversationDraftKey(nativeConversation.channelId || nativeConversation.id, nativeConversation.channelType)] || nativeConversation.draft || '',
            ...nativeConversation
          });
        }
      });
      this.conversations = mergeRemoteDrafts(this.conversations, list, {
        dirtyKeys: new Set(Object.keys(this.draftDirtyKeys))
      });
      this.conversations = sortConversations(this.conversations);
      this.lastNativeSyncAt = Date.now();
    },
    async syncNativeConversations(options = {}) {
      if (!options.silent) this.syncState = 'syncing';
      this.syncError = '';
      try {
        const conversations = await nativeImService.syncConversations();
        this.applyNativeConversations(conversations, { replaceMock: true });
        this.syncState = 'success';
        return conversations;
      } catch (error) {
        this.syncState = 'failed';
        this.syncError = errorText(error);
        if (options.throwOnAuthError && isAuthExpiredError(error)) throw error;
        if (!options.silent) throw error;
        return [];
      }
    },
    upsertNativeConversation(conversation) {
      if (!conversation?.id && !conversation?.channelId) return null;
      const normalized = {
        id: conversation.id || conversation.channelId,
        channelId: conversation.channelId || conversation.id,
        channelType: conversation.channelType || channelTypeFromConversation(conversation),
        type: conversation.type || (conversation.channelType === 2 ? 'group' : 'single'),
        unread: 0,
        lastTime: Date.now(),
        isPinned: false,
        isMuted: false,
        draft: '',
        ...conversation
      };
      this.applyNativeConversations([normalized]);
      return this.conversations.find((item) => item.id === normalized.id) || null;
    },
    upsertGroupConversation(group) {
      this.conversations = upsertGroupConversation(this.conversations, group);
      return this.conversations.find((item) => item.id === (group.id || group.groupNo || group.group_no)) || null;
    },
    upsertAgentConversation(agent) {
      const nextConversation = createAgentConversation(agent);
      if (!nextConversation.id) return null;
      const existing = this.conversations.find((item) => item.id === nextConversation.id);
      if (existing) {
        Object.assign(existing, {
          ...nextConversation,
          draft: existing.draft || nextConversation.draft,
          unread: existing.unread || 0,
          isPinned: existing.isPinned || nextConversation.isPinned,
          isMuted: existing.isMuted || nextConversation.isMuted
        });
      } else {
        this.conversations.unshift(nextConversation);
      }
      return this.conversations.find((item) => item.id === nextConversation.id) || null;
    },
    applyNativeGroups(groups = []) {
      groups.forEach((group) => {
        this.conversations = upsertGroupConversation(this.conversations, group);
      });
      this.conversations = sortConversations(this.conversations);
    },
    async syncNativeGroups(options = {}) {
      try {
        const groups = await nativeImService.syncMyGroups();
        this.applyNativeGroups(groups);
        return groups;
      } catch (error) {
        this.syncError = errorText(error);
        if (!options.silent) throw error;
        return [];
      }
    },
    getConversationIdentity(conversationOrId) {
      const conversation = typeof conversationOrId === 'string'
        ? this.conversations.find((item) => item.id === conversationOrId)
        : conversationOrId;
      if (!conversation) {
        return { channelId: String(conversationOrId || ''), channelType: 1, conversationId: String(conversationOrId || '') };
      }
      return {
        channelId: conversation.channelId || conversation.id,
        channelType: channelTypeFromConversation(conversation),
        conversationId: conversation.id
      };
    }
  }
});
