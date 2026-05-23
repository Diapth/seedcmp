export const GROUP_ROLE_OWNER = 1;
export const GROUP_ROLE_ADMIN = 2;
export const GROUP_ROLE_MEMBER = 0;

export interface NormalizedGroup {
  group_no: string;
  name: string;
  avatar: string;
  owner: string;
  status: number;
  role: number;
  mute: number;
  top: number;
  save: number;
  notice?: string;
  [key: string]: any;
}

export interface NormalizedGroupMember {
  uid: string;
  member_uid: string;
  name: string;
  member_name: string;
  display_name: string;
  avatar: string;
  role: number;
  role_label: string;
  is_mute: number;
  forbidden_expir_time: number;
  [key: string]: any;
}

export function normalizeGroup(input: any): NormalizedGroup | null {
  const groupNo = String(input?.group_no || input?.groupNo || input?.channel_id || '');
  if (!groupNo) return null;

  const owner = String(input.owner || input.creator || input.owner_uid || '');

  return {
    ...input,
    group_no: groupNo,
    name: input.remark || input.name || '群聊',
    avatar: input.logo || input.avatar || '',
    owner,
    creator: input.creator || owner,
    status: Number(input.status || 0),
    role: Number(input.role ?? input.my_role ?? GROUP_ROLE_MEMBER),
    mute: Number(input.mute || 0),
    top: Number(input.top || input.stick || 0),
    save: Number(input.save || input.saved || 0) || 1,
    notice: input.notice || '',
  };
}

export function getGroupRoleLabel(value: any): string {
  const role = Number(value?.role ?? value ?? GROUP_ROLE_MEMBER);
  if (role === GROUP_ROLE_OWNER) return '群主';
  if (role === GROUP_ROLE_ADMIN) return '管理员';
  return '成员';
}

export function normalizeGroupMember(input: any): NormalizedGroupMember {
  const uid = String(input.uid || input.member_uid || input.memberUID || '');
  const name = input.remark || input.member_name || input.name || uid;
  const forbiddenExpirTime = Number(input.forbidden_expir_time || input.forbiddenExpirTime || 0);

  return {
    ...input,
    uid,
    member_uid: uid,
    name: input.name || input.member_name || uid,
    member_name: input.member_name || input.name || uid,
    display_name: name,
    avatar: input.avatar || '',
    role: Number(input.role ?? GROUP_ROLE_MEMBER),
    role_label: getGroupRoleLabel(input),
    forbidden_expir_time: forbiddenExpirTime,
    is_mute: forbiddenExpirTime > Math.floor(Date.now() / 1000) ? 1 : 0,
  };
}

export function isGroupOwner(group: any, uid?: string): boolean {
  if (!group) return false;
  if (uid && String(group.owner || group.creator || '') === String(uid)) return true;
  return Number(group.role || 0) === GROUP_ROLE_OWNER;
}

export function getMyGroupRole(group: any, uid?: string): number {
  if (!group) return GROUP_ROLE_MEMBER;
  if (uid && String(group.owner || group.creator || '') === String(uid)) return GROUP_ROLE_OWNER;
  return Number(group.role || GROUP_ROLE_MEMBER);
}

export function isGroupAdmin(group: any): boolean {
  return Number(group?.role || 0) === GROUP_ROLE_ADMIN;
}

export function canManageGroup(group: any): boolean {
  return isGroupOwner(group) || isGroupAdmin(group);
}

export function canManageGroupMember(group: any, member: any): boolean {
  const myRole = getMyGroupRole(group);
  const memberRole = Number(member?.role || 0);
  if (myRole === GROUP_ROLE_OWNER) {
    return memberRole !== GROUP_ROLE_OWNER;
  }
  if (myRole === GROUP_ROLE_ADMIN) {
    return memberRole === GROUP_ROLE_MEMBER;
  }
  return false;
}

export function canAppointGroupAdmin(group: any, member: any): boolean {
  return getMyGroupRole(group) === GROUP_ROLE_OWNER && Number(member?.role || 0) === GROUP_ROLE_MEMBER;
}

export function canRemoveGroupAdmin(group: any, member: any): boolean {
  return getMyGroupRole(group) === GROUP_ROLE_OWNER && Number(member?.role || 0) === GROUP_ROLE_ADMIN;
}

export function buildConversationFromGroup(group: NormalizedGroup) {
  const lastMessageTime = Number(group.last_msg_time || group.lastMsgTime || group.updated_at_time || group.updatedAtTime || group.updated_at || group.updatedAt || group.created_at_time || group.createdAtTime || 0) || 0;
  return {
    channel_id: group.group_no,
    channel_type: 2,
    unread: 0,
    last_msg_seq: 0,
    last_msg_time: lastMessageTime,
    last_message: {
      payload: { type: 1000, text: `你已加入群聊 ${group.name}` },
      content: { type: 1000, text: `你已加入群聊 ${group.name}` },
      messageSeq: 0,
      timestamp: lastMessageTime,
      fromUID: '',
    },
    top: Number(group.top || 0),
    mute: Number(group.mute || 0),
    draft: '',
    name: group.name,
    avatar: group.avatar,
  };
}
