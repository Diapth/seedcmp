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

  function patchMembers(groupNo: string, patcher: (member: any) => any | null) {
    groupMembers.value[groupNo] = (groupMembers.value[groupNo] || [])
      .map(member => {
        const next = patcher(member);
        return next === null ? null : (next || member);
      })
      .filter(Boolean);
  }

  async function updateGroupProfile(groupNo: string, data: { name?: string; notice?: string }) {
    await groupApi.updateGroupInfo(groupNo, data);
    groups.value[groupNo] = {
      ...(groups.value[groupNo] || { group_no: groupNo }),
      ...data
    } as Group;
    return groups.value[groupNo];
  }

  async function updateGroupSetting(groupNo: string, data: Record<string, any>) {
    await groupApi.updateSetting(groupNo, data);
    groups.value[groupNo] = {
      ...(groups.value[groupNo] || { group_no: groupNo }),
      ...data
    } as Group;
    return groups.value[groupNo];
  }

  async function inviteMembers(groupNo: string, members: string[], options?: { approval?: boolean; remark?: string }) {
    if (options?.approval) {
      return groupApi.inviteMembersForApproval(groupNo, members, options.remark || '');
    }
    return groupApi.inviteMembers(groupNo, members);
  }

  async function removeMembers(groupNo: string, members: string[]) {
    await groupApi.removeMembers(groupNo, members);
    const removeSet = new Set(members.map(String));
    patchMembers(groupNo, member => removeSet.has(String(member.uid || member.member_uid)) ? null : member);
  }

  async function appointManager(groupNo: string, uid: string) {
    await groupApi.appointManager(groupNo, [uid]);
    patchMembers(groupNo, member => String(member.uid || member.member_uid) === String(uid)
      ? normalizeGroupMember({ ...member, role: 2 })
      : member);
  }

  async function removeManager(groupNo: string, uid: string) {
    await groupApi.removeManager(groupNo, [uid]);
    patchMembers(groupNo, member => String(member.uid || member.member_uid) === String(uid)
      ? normalizeGroupMember({ ...member, role: 0 })
      : member);
  }

  async function muteMember(groupNo: string, uid: string, mute: boolean) {
    await groupApi.muteMember(groupNo, { member_uid: uid, action: mute ? 1 : 0, key: 1 });
    patchMembers(groupNo, member => String(member.uid || member.member_uid) === String(uid)
      ? { ...member, is_mute: mute ? 1 : 0, forbidden_expir_time: mute ? Math.floor(Date.now() / 1000) + 86400 : 0 }
      : member);
  }

  async function muteAll(groupNo: string, mute: boolean) {
    await groupApi.muteAll(groupNo, mute ? 1 : 0);
    groups.value[groupNo] = {
      ...(groups.value[groupNo] || { group_no: groupNo }),
      forbidden: mute ? 1 : 0
    } as Group;
  }

  async function blacklistMembers(groupNo: string, uids: string[], add: boolean) {
    await groupApi.blacklistMember(groupNo, add ? 1 : 0, uids);
    const uidSet = new Set(uids.map(String));
    patchMembers(groupNo, member => uidSet.has(String(member.uid || member.member_uid))
      ? { ...member, status: add ? 'blacklisted' : 1 }
      : member);
  }

  async function transferOwner(groupNo: string, toUid: string) {
    await groupApi.transferOwner(groupNo, toUid);
    if (groups.value[groupNo]) {
      groups.value[groupNo].owner = toUid;
      groups.value[groupNo].creator = toUid;
    }
    patchMembers(groupNo, member => {
      const uid = String(member.uid || member.member_uid);
      if (uid === String(toUid)) return normalizeGroupMember({ ...member, role: 1 });
      if (Number(member.role || 0) === 1) return normalizeGroupMember({ ...member, role: 0 });
      return member;
    });
  }

  async function exitGroup(groupNo: string) {
    await groupApi.exitGroup(groupNo);
    if (groups.value[groupNo]) {
      groups.value[groupNo].status = 0;
    }
  }

  async function disbandGroup(groupNo: string) {
    await groupApi.disbandGroup(groupNo);
    if (groups.value[groupNo]) {
      groups.value[groupNo].status = 0;
      groups.value[groupNo].lifecycleState = 'disbanded';
    }
  }

  async function getGroupQRCode(groupNo: string) {
    return groupApi.getGroupQRCode(groupNo);
  }

  async function getInviteDetail(inviteNo: string) {
    return groupApi.getInviteDetail(inviteNo);
  }

  async function confirmInvite(authCode: string) {
    return groupApi.confirmInvite(authCode);
  }

  async function scanJoinGroup(groupNo: string, authCode: string) {
    return groupApi.scanJoinGroup(groupNo, authCode);
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
    updateGroupProfile,
    updateGroupSetting,
    inviteMembers,
    removeMembers,
    appointManager,
    removeManager,
    muteMember,
    muteAll,
    blacklistMembers,
    transferOwner,
    exitGroup,
    disbandGroup,
    getGroupQRCode,
    getInviteDetail,
    confirmInvite,
    scanJoinGroup,
    reset
  };
});
