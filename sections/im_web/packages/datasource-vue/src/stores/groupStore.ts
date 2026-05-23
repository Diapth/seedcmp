import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { groupApi } from '../api';

export interface Group {
  group_no: string;
  name: string;
  avatar: string;
  owner: string;
  status: number;
  [key: string]: any;
}

export const useGroupStore = defineStore('group', () => {
  const groups = ref<{ [key: string]: Group }>({});
  const groupMembers = ref<{ [key: string]: any[] }>({});

  function normalizeGroup(input: any): Group | null {
    const groupNo = String(input.group_no || input.groupNo || input.channel_id || '');
    if (!groupNo) return null;

    return {
      ...input,
      group_no: groupNo,
      name: input.remark || input.name || '群聊',
      avatar: input.logo || input.avatar || '',
      owner: input.owner || input.owner_uid || '',
      status: Number(input.status || 0),
      mute: Number(input.mute || 0),
      top: Number(input.top || input.stick || 0),
      save: Number(input.save || input.saved || 0) || 1
    };
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
    try {
      const res: any = await groupApi.getMyGroups();
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
    try {
      const res: any = await groupApi.getGroupInfo(groupNo);
      return upsertGroup(res);
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  async function fetchGroupMembers(groupNo: string) {
    try {
      const res: any = await groupApi.getGroupMembers(groupNo, { page: 1, limit: 1000 });
      const members = Array.isArray(res) ? res : (res?.list || []);
      groupMembers.value[groupNo] = members;
      return members;
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

  return {
    groups,
    groupMembers,
    savedGroups,
    upsertGroup,
    fetchMyGroups,
    getGroupInfo,
    fetchGroupMembers
  };
});
