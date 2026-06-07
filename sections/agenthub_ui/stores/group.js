import { defineStore } from 'pinia';
import { groupApi } from '@/api/group.js';

function parseGroupTime(value) {
  if (!value) return Date.now();
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(String(value).replace(' ', 'T'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
}

function normalizeGroup(input = {}) {
  return {
    id: input.group_no || input.groupNo || input.id || '',
    name: input.name || input.group_name || '未命名群聊',
    avatar: input.avatar || input.logo || '',
    memberCount: Number(input.member_count || input.memberCount || 0),
    announcement: input.notice || input.announcement || '',
    creatorId: input.creator || input.creatorId || input.created_by || '',
    createTime: parseGroupTime(input.createTime || input.created_at),
    top: Number(input.top || input.stick || 0),
    mute: Number(input.mute || 0),
    raw: input
  };
}

function normalizeRole(input = {}) {
  if (input.role === 'owner' || input.role === 'admin' || input.role === 'member') return input.role;
  if (input.is_creator || input.isCreator || input.creator === 1) return 'owner';
  if (Number(input.member_role || input.memberRole || 0) === 1) return 'owner';
  if (Number(input.member_role || input.memberRole || 0) === 2) return 'admin';
  return 'member';
}

function normalizeGroupMember(input = {}) {
  const id = input.uid || input.id || input.user_id || input.userId || input.member_uid || input.memberUid || input.username || '';
  const nickname = input.remark || input.name || input.nickname || input.display_name || input.displayName || input.username || id;
  return {
    id,
    uid: id,
    nickname,
    name: input.name || nickname,
    remark: input.remark || '',
    avatar: input.avatar || input.logo || input.face || input.face_url || input.faceUrl || '',
    role: normalizeRole(input),
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
      const list = Array.isArray(data) ? data : (data.groups || data.items || data.list || []);
      this.groups = list.map(normalizeGroup).filter((group) => group.id);
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
      const index = this.groups.findIndex((item) => item.id === normalized.id);
      if (index >= 0) {
        this.groups[index] = {
          ...this.groups[index],
          ...normalized,
          memberCount: normalized.memberCount || this.groups[index].memberCount || 0
        };
        return this.groups[index];
      }
      if (normalized.id) this.groups.push(normalized);
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
      const list = Array.isArray(data) ? data : (data.members || data.items || data.list || data.users || []);
      this.members[groupNo] = list.map(normalizeGroupMember).filter((member) => member.id);
      const group = this.groups.find((item) => item.id === groupNo);
      if (group) group.memberCount = Math.max(group.memberCount || 0, this.members[groupNo].length);
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
