import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { groupApi } from '../api';
import { normalizeGroup as normalizeGroupInfo, normalizeGroupMember } from './groupChatUtils';

export interface Group {
  group_no: string;
  name: string;
  avatar: string;
  owner: string;
  status: number;
  role: number;
  mute: number;
  top: number;
  save: number;
  [key: string]: any;
}

export const useGroupStore = defineStore('group', () => {
  const groups = ref<{ [key: string]: Group }>({});
  const groupMembers = ref<{ [key: string]: any[] }>({});
  const resetVersion = ref(0);

  function normalizeGroup(input: any): Group | null {
    return normalizeGroupInfo(input) as Group | null;
  }

  function upsertGroup(input: any) {
    const group = normalizeGroup(input);
    if (!group) return null;

    groups.value[group.group_no] = {
      ...(groups.value[group.group_no] || {}),
      ...group
    };
    return groups.value[group.group_no];
  }

  async function fetchMyGroups() {
    const version = resetVersion.value;
    try {
      const res: any = await groupApi.getMyGroups();
      if (version !== resetVersion.value) return;
      const list = Array.isArray(res) ? res : (res?.list || res?.groups || []);
      list.forEach((item: any) => {
        upsertGroup(item);
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function getGroupInfo(groupNo: string) {
    if (groups.value[groupNo]) return groups.value[groupNo];
    const version = resetVersion.value;
    try {
      const res: any = await groupApi.getGroupInfo(groupNo);
      if (version !== resetVersion.value) return null;
      return upsertGroup(res);
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  async function fetchGroupMembers(groupNo: string) {
    const version = resetVersion.value;
    try {
      const res: any = await groupApi.getGroupMembers(groupNo, { page: 1, limit: 1000 });
      if (version !== resetVersion.value) return [];
      const members = Array.isArray(res) ? res : (res?.list || []);
      const normalized = members.map(normalizeGroupMember);
      groupMembers.value[groupNo] = normalized;
      return normalized;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  const savedGroups = computed(() => {
    return Object.values(groups.value).sort((a, b) => {
      if (Number(a.top || 0) !== Number(b.top || 0)) {
        return Number(b.top || 0) - Number(a.top || 0);
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  });

  function reset() {
    resetVersion.value++;
    groups.value = {};
    groupMembers.value = {};
  }

  return {
    groups,
    groupMembers,
    savedGroups,
    upsertGroup,
    fetchMyGroups,
    getGroupInfo,
    fetchGroupMembers,
    reset
  };
});
