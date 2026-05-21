import { defineStore } from 'pinia';
import { ref } from 'vue';
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

  async function fetchMyGroups() {
    try {
      const res: any = await groupApi.getMyGroups();
      const list = res.data || res || [];
      list.forEach((g: Group) => {
        groups.value[g.group_no] = g;
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function getGroupInfo(groupNo: string) {
    if (groups.value[groupNo]) return groups.value[groupNo];
    try {
      const res: any = await groupApi.getGroupInfo(groupNo);
      const g = res.data || res;
      if (g) {
        groups.value[groupNo] = g;
      }
      return g;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  async function fetchGroupMembers(groupNo: string) {
    try {
      const res: any = await groupApi.getGroupMembers(groupNo, { page: 1, limit: 1000 });
      const members = res.data || res || [];
      groupMembers.value[groupNo] = members;
      return members;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  return {
    groups,
    groupMembers,
    fetchMyGroups,
    getGroupInfo,
    fetchGroupMembers
  };
});
