import { defineStore } from 'pinia';

export const useGroupStore = defineStore('group', {
  state: () => ({
    activeGroupId: null,
    groups: [
      {
        id: '2',
        name: 'AgentHub 产品研发群',
        avatar: '',
        memberCount: 4,
        announcement: '欢迎来到 AgentHub 产品研发群，本周目标：完成阶段 9 的所有 PR 🎉',
        creatorId: 'me',
        createTime: 1780300000000
      },
      {
        id: 'agent-review',
        name: '智能体方案评审群',
        avatar: '',
        memberCount: 6,
        announcement: '本群用于多智能体协作评审：任务进展看看板，过程输出看 Console 日志。',
        creatorId: 'me',
        createTime: 1780488000000
      }
    ]
  }),
  actions: {
    setActiveGroupId(id) {
      this.activeGroupId = id;
    },
    addGroup(group) {
      this.groups.push(group);
    },
    removeGroup(id) {
      this.groups = this.groups.filter((g) => g.id !== id);
      if (this.activeGroupId === id) this.activeGroupId = null;
    },
    updateGroup(id, patch) {
      const g = this.groups.find((x) => x.id === id);
      if (g) Object.assign(g, patch);
    },
    exitGroup(id) {
      // 单聊意义上"退出"会清空成员,这里仅从当前用户视角上隐藏
      const g = this.groups.find((x) => x.id === id);
      if (g && g.memberCount > 1) g.memberCount -= 1;
    },
    disbandGroup(id) {
      this.removeGroup(id);
    }
  }
});
