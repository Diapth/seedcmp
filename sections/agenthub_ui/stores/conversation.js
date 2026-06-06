import { defineStore } from 'pinia';

export const useConversationStore = defineStore('conversation', {
  state: () => ({
    activeId: '',
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
        draft: ''
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
        draft: ''
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
        draft: ''
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
        draft: ''
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
    updateConversationDraft(id, draftText) {
      const conv = this.conversations.find((c) => c.id === id);
      if (conv) {
        conv.draft = draftText;
      }
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
    removeMember(convId, memberId) {
      if (!this.members[convId]) return;
      this.members[convId] = this.members[convId].filter((m) => m.id !== memberId);
    },
    initFromGroupMembers(convId, members, creatorId) {
      this.members[convId] = members.map((m) => ({ isMuted: false, role: 'member', ...m }));
      if (creatorId) this.creatorIds[convId] = creatorId;
    }
  }
});
