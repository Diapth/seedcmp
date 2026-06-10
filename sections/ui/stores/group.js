import { defineStore } from 'pinia';
import { nativeImService } from '@/services/native-im/service';
import { mergeGroupMembersWithAgentMembers } from '@/services/native-im/agent-state';
import { useConversationStore } from '@/stores/conversation';

export const useGroupStore = defineStore('group', {
  state: () => ({
    activeGroupId: null,
    syncState: 'idle',
    syncError: '',
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
      const id = group.id || group.groupNo || group.group_no;
      if (!id) return;
      const existing = this.groups.find((item) => item.id === id);
      if (existing) {
        Object.assign(existing, { ...group, id });
        return;
      }
      this.groups.push({ ...group, id });
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
    },
    async syncNativeGroups(options = {}) {
      this.syncState = 'syncing';
      this.syncError = '';
      try {
        const groups = await nativeImService.syncMyGroups();
        groups.forEach((group) => this.addGroup(group));
        useConversationStore().applyNativeGroups(groups);
        this.syncState = 'success';
        return groups;
      } catch (error) {
        this.syncState = 'failed';
        this.syncError = error?.msg || error?.message || '群聊同步失败';
        if (!options.silent) throw error;
        return [];
      }
    },
    async createNativeGroup({ name, memberIds = [] }) {
      const group = await nativeImService.createGroup({ name, members: memberIds });
      this.addGroup(group);
      const conversation = useConversationStore().upsertGroupConversation(group);
      return { group, conversation };
    },
    async syncGroupCatsForGroup({ groupId, groupName, agents = [] } = {}) {
      if (!groupId || agents.length === 0) return null;
      return nativeImService.syncGroupCats({
        groupId,
        groupName,
        agents
      });
    },
    async syncNativeGroupMembers(groupId, options = {}) {
      if (!groupId) return [];
      try {
        const members = await nativeImService.syncGroupMembers(groupId, options);
        let groupCats = [];
        try {
          groupCats = await nativeImService.fetchGroupCats({ groupId });
        } catch {
          groupCats = [];
        }
        const convStore = useConversationStore();
        const existingAgentMembers = (convStore.members[groupId] || []).filter(
          (member) => member?.isAgent || member?.source === 'clowder' || member?.catId || member?.directCatId
        );
        const mergedMembers = mergeGroupMembersWithAgentMembers(members, [...existingAgentMembers, ...groupCats]);
        convStore.initFromGroupMembers(groupId, mergedMembers, mergedMembers.find((item) => item.role === 'owner')?.id);
        const group = this.groups.find((item) => item.id === groupId);
        if (group) group.memberCount = mergedMembers.length || group.memberCount || 0;
        return mergedMembers;
      } catch (error) {
        this.syncError = error?.msg || error?.message || '群成员同步失败';
        if (!options.silent) throw error;
        return [];
      }
    }
  }
});
