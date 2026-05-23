import {
  buildConversationFromGroup,
  canManageGroupMember,
  getMyGroupRole,
  getGroupRoleLabel,
  isGroupAdmin,
  isGroupOwner,
  normalizeGroup,
  normalizeGroupMember,
} from '../src/stores/groupChatUtils';

function assertEqual(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const ownerGroup = normalizeGroup({
  group_no: 'g1',
  name: 'Seed 群',
  logo: '/avatar.png',
  creator: 'u1',
  role: 1,
  mute: 1,
  top: 1,
  notice: 'hello',
});

assertEqual(ownerGroup?.group_no, 'g1');
assertEqual(ownerGroup?.avatar, '/avatar.png');
assertEqual(ownerGroup?.owner, 'u1');
assertEqual(ownerGroup?.role, 1);
assertEqual(ownerGroup?.notice, 'hello');
assertEqual(isGroupOwner(ownerGroup, 'u1'), true);
assertEqual(getMyGroupRole(ownerGroup, 'u1'), 1);
assertEqual(isGroupAdmin(ownerGroup), false);

const member = normalizeGroupMember({
  uid: 'u2',
  name: 'Alice',
  remark: '群昵称',
  role: 2,
  forbidden_expir_time: 4102444800,
});

assertEqual(member.uid, 'u2');
assertEqual(member.member_uid, 'u2');
assertEqual(member.display_name, '群昵称');
assertEqual(member.role_label, '管理员');
assertEqual(member.is_mute, 1);
assertEqual(getGroupRoleLabel(member), '管理员');
assertEqual(canManageGroupMember(ownerGroup, member), true);

const conv = buildConversationFromGroup(ownerGroup);
assertEqual(conv.channel_id, 'g1');
assertEqual(conv.channel_type, 2);
assertEqual(conv.name, 'Seed 群');
assertEqual(conv.avatar, '/avatar.png');
assertEqual(conv.mute, 1);
assertEqual(conv.top, 1);
assertEqual(conv.last_message.content.text, '你已加入群聊 Seed 群');

console.log('groupChatUtils.test.ts passed');
