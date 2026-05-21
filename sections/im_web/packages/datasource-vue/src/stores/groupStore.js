import { defineStore } from 'pinia';
import { ref } from 'vue';
import { groupApi } from '../api';
export const useGroupStore = defineStore('group', () => {
    const groups = ref({});
    const groupMembers = ref({});
    async function fetchMyGroups() {
        try {
            const res = await groupApi.getMyGroups();
            const list = res.data || res || [];
            list.forEach((g) => {
                groups.value[g.group_no] = g;
            });
        }
        catch (e) {
            console.error(e);
        }
    }
    async function getGroupInfo(groupNo) {
        if (groups.value[groupNo])
            return groups.value[groupNo];
        try {
            const res = await groupApi.getGroupInfo(groupNo);
            const g = res.data || res;
            if (g) {
                groups.value[groupNo] = g;
            }
            return g;
        }
        catch (e) {
            console.error(e);
            return null;
        }
    }
    async function fetchGroupMembers(groupNo) {
        try {
            const res = await groupApi.getGroupMembers(groupNo, { page: 1, limit: 1000 });
            const members = res.data || res || [];
            groupMembers.value[groupNo] = members;
            return members;
        }
        catch (e) {
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
