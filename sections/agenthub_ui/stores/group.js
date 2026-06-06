import { defineStore } from 'pinia';
import { groupApi } from '@/api/group.js';

function normalizeGroup(input = {}) {
  return {
    id: input.group_no || input.groupNo || input.id || '',
    name: input.name || input.group_name || '未命名群聊',
    avatar: input.avatar || input.logo || '',
    memberCount: Number(input.member_count || input.memberCount || 0),
    announcement: input.notice || input.announcement || '',
    creatorId: input.creator || input.creatorId || input.created_by || '',
    createTime: Number(input.created_at || input.createTime || Date.now()),
    raw: input
  };
}

export const useGroupStore = defineStore('group', {
  state: () => ({
    activeGroupId: null,
    groups: [],
    members: {},
    loading: false,
    lastError: ''
  }),
  actions: {
    setActiveGroupId(id) {
      this.activeGroupId = id;
    },
    async fetchMyGroups() {
      const response = await groupApi.getMyGroups();
      const data = response?.data || response || {};
      this.groups = (data.groups || data.items || []).map(normalizeGroup);
      return this.groups;
    },
    async createGroup({ name, members }) {
      const response = await groupApi.createGroup({ name, members });
      const data = response?.data || response || {};
      const group = normalizeGroup(data.group || data);
      if (group.id) this.addGroup(group);
      return group;
    },
    addGroup(group) {
      const normalized = normalizeGroup(group);
      if (!this.groups.some((item) => item.id === normalized.id)) this.groups.push(normalized);
      return normalized;
    },
    removeGroup(id) {
      this.groups = this.groups.filter((g) => g.id !== id);
      if (this.activeGroupId === id) this.activeGroupId = null;
    },
    updateGroup(id, patch) {
      const group = this.groups.find((item) => item.id === id);
      if (group) Object.assign(group, patch);
    },
    async exitGroup(id) {
      await groupApi.exitGroup(id);
      this.removeGroup(id);
    },
    async disbandGroup(id) {
      await groupApi.disbandGroup(id);
      this.removeGroup(id);
    },
    async fetchMembers(groupNo) {
      const response = await groupApi.getGroupMembers(groupNo, { page: 1, limit: 200 });
      const data = response?.data || response || {};
      this.members[groupNo] = data.members || data.items || [];
      return this.members[groupNo];
    },
    reset() {
      this.activeGroupId = null;
      this.groups = [];
      this.members = {};
      this.loading = false;
      this.lastError = '';
    }
  }
});
