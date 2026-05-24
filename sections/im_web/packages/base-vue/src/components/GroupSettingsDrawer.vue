<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useGroupStore } from '@tsdaodao/datasource-vue';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { useConversationStore } from '@tsdaodao/datasource-vue';
import { getMyGroupRole } from '@tsdaodao/datasource-vue';
import { friendApi, groupApi } from '@tsdaodao/datasource-vue';
import ChannelAvatar from './ChannelAvatar.vue';
import AppDialog from './AppDialog.vue';
import { Message } from '@arco-design/web-vue';

const props = defineProps<{
  groupNo: string;
  visible: boolean;
}>();

const emit = defineEmits(['close', 'members-click']);

const groupStore = useGroupStore();
const userStore = useUserStore();
const conversationStore = useConversationStore();

const groupInfo = computed(() => groupStore.groups[props.groupNo]);
const members = computed(() => groupStore.groupMembers[props.groupNo] || []);
const avatarInputRef = ref<HTMLInputElement | null>(null);

const editingName = ref(false);
const newName = ref('');
const editingNotice = ref(false);
const newNotice = ref('');
const showInviteModal = ref(false);
const inviteKeyword = ref('');
const inviteSearchResult = ref<any | null>(null);
const selectedInviteUsers = ref<any[]>([]);
const inviteSearching = ref(false);
const showQrModal = ref(false);
const qrState = ref<'idle' | 'loading' | 'ready' | 'expired' | 'approval' | 'unavailable'>('idle');
const qrCodeUrl = ref('');
const pendingDestructiveAction = ref<null | { title: string; message: string; run: () => Promise<void> }>(null);
const destructiveLoading = ref(false);
const inviteMode = computed(() => Number(groupInfo.value?.invite || 0) === 1);

const currentMember = computed(() => {
  const uid = String(userStore.currentUser?.uid || '');
  if (!uid) return null;
  return members.value.find((member: any) => String(member.uid || member.member_uid || '') === uid) || null;
});

const currentMemberRole = computed(() => Number(currentMember.value?.role || 0));

const isCurrentUserOwner = computed(() => {
  const uid = String(userStore.currentUser?.uid || '');
  const owner = String(groupInfo.value?.owner || groupInfo.value?.creator || '');
  return (!!uid && !!owner && uid === owner) || currentMemberRole.value === 1;
});

const isOwner = computed(() => {
  return isCurrentUserOwner.value || getMyGroupRole(groupInfo.value, userStore.currentUser?.uid) === 1;
});

const canManageGroup = computed(() => {
  return isOwner.value || currentMemberRole.value === 2 || getMyGroupRole(groupInfo.value, userStore.currentUser?.uid) >= 1;
});

const roleSummary = computed(() => {
  return members.value.reduce((acc: Record<string, number>, member: any) => {
    if (Number(member.role || 0) === 1) acc.owner += 1;
    else if (Number(member.role || 0) === 2) acc.admin += 1;
    else acc.member += 1;
    return acc;
  }, { owner: 0, admin: 0, member: 0 });
});

onMounted(async () => {
  if (props.groupNo) {
    await loadGroupDetails();
  }
});

watch(
  () => props.visible,
  async visible => {
    if (visible && props.groupNo) {
      await loadGroupDetails();
    }
  }
);

async function loadGroupDetails() {
  await groupStore.getGroupInfo(props.groupNo);
  await groupStore.fetchGroupMembers(props.groupNo);
}

async function refreshGroupDetails() {
  delete groupStore.groups[props.groupNo];
  await groupStore.getGroupInfo(props.groupNo);
}

async function saveGroupName() {
  if (!newName.value.trim()) return;
  try {
    await groupStore.updateGroupProfile(props.groupNo, { name: newName.value });
    Message.success('群名修改成功');
    await refreshGroupDetails();
    conversationStore.ensureGroupConversations();
    editingName.value = false;
  } catch (err: any) {
    Message.error(err.msg || '修改失败');
  }
}

async function saveGroupNotice() {
  try {
    await groupStore.updateGroupProfile(props.groupNo, { notice: newNotice.value });
    Message.success('公告修改成功');
    await refreshGroupDetails();
    editingNotice.value = false;
  } catch (err: any) {
    Message.error(err.msg || '修改失败');
  }
}

function openAvatarPicker() {
  if (!isOwner.value) return;
  avatarInputRef.value?.click();
}

async function handleAvatarChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  try {
    await groupApi.uploadAvatar(props.groupNo, formData);
    Message.success('群头像已更新');
    await refreshGroupDetails();
  } catch (err: any) {
    Message.error(err.msg || '头像上传失败');
  } finally {
    target.value = '';
  }
}

async function togglePin() {
  await conversationStore.togglePin(props.groupNo, 2, Number(groupInfo.value?.top || 0) !== 1);
  if (groupInfo.value) groupInfo.value.top = Number(groupInfo.value.top || 0) === 1 ? 0 : 1;
}

async function toggleMute() {
  await conversationStore.toggleMute(props.groupNo, 2, Number(groupInfo.value?.mute || 0) !== 1);
  if (groupInfo.value) groupInfo.value.mute = Number(groupInfo.value.mute || 0) === 1 ? 0 : 1;
}

async function toggleInviteApproval() {
  if (!canManageGroup.value) {
    Message.warning('普通成员不允许修改邀请确认');
    return;
  }
  const next = inviteMode.value ? 0 : 1;
  await groupStore.updateGroupSetting(props.groupNo, { invite: next });
  Message.success(next === 1 ? '已开启邀请确认' : '已关闭邀请确认');
}

async function toggleMuteAll() {
  if (!canManageGroup.value) {
    Message.warning('普通成员不允许修改全员禁言');
    return;
  }
  const next = Number(groupInfo.value?.forbidden || 0) !== 1;
  await groupStore.muteAll(props.groupNo, next);
  Message.success(next ? '已开启全员禁言' : '已关闭全员禁言');
}

async function loadQRCode() {
  showQrModal.value = true;
  qrState.value = inviteMode.value ? 'approval' : 'loading';
  qrCodeUrl.value = '';
  if (inviteMode.value) return;

  try {
    const res: any = await groupStore.getGroupQRCode(props.groupNo);
    qrCodeUrl.value = res?.qrcode || res?.url || '';
    qrState.value = qrCodeUrl.value ? 'ready' : 'unavailable';
  } catch {
    qrState.value = 'unavailable';
  }
}

function openInviteModal() {
  inviteKeyword.value = '';
  inviteSearchResult.value = null;
  selectedInviteUsers.value = [];
  showInviteModal.value = true;
}

async function searchInviteUser() {
  const keyword = inviteKeyword.value.trim();
  if (!keyword) {
    Message.warning('请输入用户 UID、手机号或短编号');
    return;
  }
  inviteSearching.value = true;
  try {
    const res: any = await friendApi.searchUser(keyword);
    const user = res?.data || res?.user || res;
    if (!user || res?.exist === 0) {
      inviteSearchResult.value = null;
      Message.warning('未找到该用户');
      return;
    }
    inviteSearchResult.value = user;
  } catch (err: any) {
    Message.error(err.msg || '搜索失败');
  } finally {
    inviteSearching.value = false;
  }
}

function addInviteUser(user: any) {
  const uid = String(user?.uid || '');
  if (!uid) return;
  if (members.value.some((member: any) => String(member.uid || member.member_uid) === uid)) {
    Message.warning('该用户已在群内');
    return;
  }
  if (selectedInviteUsers.value.some(item => String(item.uid) === uid)) {
    Message.warning('该用户已添加');
    return;
  }
  selectedInviteUsers.value.push(user);
  inviteKeyword.value = '';
  inviteSearchResult.value = null;
}

function removeInviteUser(uid: string) {
  selectedInviteUsers.value = selectedInviteUsers.value.filter(user => String(user.uid) !== String(uid));
}

async function submitInviteMembers() {
  const manualUids = inviteKeyword.value.split(',').map(item => item.trim()).filter(Boolean);
  const selectedUids = selectedInviteUsers.value.map(user => String(user.uid)).filter(Boolean);
  const membersToInvite = [...new Set([...selectedUids, ...manualUids])];
  if (membersToInvite.length === 0) return;

  try {
    await groupStore.inviteMembers(props.groupNo, membersToInvite, { approval: inviteMode.value });
    Message.success(inviteMode.value ? '邀请确认已提交，待审批' : '邀请已发送');
    await groupStore.fetchGroupMembers(props.groupNo);
    showInviteModal.value = false;
    inviteKeyword.value = '';
    inviteSearchResult.value = null;
    selectedInviteUsers.value = [];
  } catch (err: any) {
    Message.error(err.msg || '邀请失败');
  }
}

async function handleDisband() {
  pendingDestructiveAction.value = {
    title: '解散群组',
    message: '确认解散群组？该操作会影响所有成员。',
    run: async () => {
      await groupStore.disbandGroup(props.groupNo);
      Message.success('群组已解散');
      await conversationStore.deleteConversation(props.groupNo, 2);
      emit('close');
    }
  };
}

async function handleExit() {
  pendingDestructiveAction.value = {
    title: '退出群聊',
    message: '确认退出群聊？',
    run: async () => {
      await groupStore.exitGroup(props.groupNo);
      Message.success('已退出群聊');
      await conversationStore.deleteConversation(props.groupNo, 2);
      emit('close');
    }
  };
}

async function confirmDestructiveAction() {
  if (!pendingDestructiveAction.value) return;
  destructiveLoading.value = true;
  try {
    await pendingDestructiveAction.value.run();
    pendingDestructiveAction.value = null;
  } catch (err: any) {
    Message.error(err.msg || '操作失败');
  } finally {
    destructiveLoading.value = false;
  }
}
</script>

<template>
  <div v-if="visible" class="drawer-overlay" @click="emit('close')">
    <div class="drawer-content" @click.stop>
      <div class="drawer-header">
        <h4 class="drawer-title">群聊信息</h4>
        <button class="close-btn" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="close-icon">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="drawer-body">
        <!-- Group Avatar & Metadata -->
        <div class="group-profile-section">
          <div class="avatar-wrap">
            <ChannelAvatar
              :avatar="groupInfo?.avatar"
              :name="groupInfo?.name"
              :is-group="true"
              :size="64"
            />
            <button v-if="isOwner" class="avatar-edit-overlay" @click="openAvatarPicker">编辑</button>
          </div>
          <input
            ref="avatarInputRef"
            type="file"
            accept="image/*"
            class="hidden-input"
            @change="handleAvatarChange"
          />
          <button v-if="isOwner" class="avatar-btn" @click="openAvatarPicker">更换头像</button>
          
          <div class="info-fields">
            <!-- Group Name -->
            <div class="info-field">
              <span class="field-label">群名称</span>
              <div v-if="!editingName" class="field-value-row">
                <span class="field-value">{{ groupInfo?.name }}</span>
                <button v-if="canManageGroup" class="edit-btn" @click="editingName = true; newName = groupInfo?.name || ''">
                  修改
                </button>
              </div>
              <div v-else class="edit-row">
                <input v-model="newName" type="text" class="edit-input" />
                <button class="save-btn" @click="saveGroupName">保存</button>
              </div>
            </div>

            <!-- Group Notice -->
            <div class="info-field">
              <span class="field-label">群公告</span>
              <div v-if="!editingNotice" class="field-value-row">
                <span class="field-value empty-notice">{{ groupInfo?.notice || '未设置群公告' }}</span>
                <button v-if="canManageGroup" class="edit-btn" @click="editingNotice = true; newNotice = groupInfo?.notice || ''">
                  修改
                </button>
              </div>
              <div v-else class="edit-row notice-edit">
                <textarea v-model="newNotice" class="edit-textarea" rows="3"></textarea>
                <button class="save-btn" @click="saveGroupNotice">保存</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Members Summary -->
        <div class="members-summary-section">
          <div class="section-title-row" @click="emit('members-click')">
            <span>群成员 ({{ members.length }}人)</span>
            <button class="view-all-btn">查看全部</button>
          </div>
          <div class="role-summary">
            <span>群主 {{ roleSummary.owner }}</span>
            <span>管理员 {{ roleSummary.admin }}</span>
            <span>成员 {{ roleSummary.member }}</span>
          </div>
          <div class="members-grid">
            <div v-for="m in members.slice(0, 8)" :key="m.uid" class="member-item">
              <ChannelAvatar :avatar="m.avatar" :name="m.name" :size="32" />
              <span class="member-name">{{ m.display_name || m.name }}</span>
              <span v-if="m.role_label !== '成员'" class="member-role">{{ m.role_label }}</span>
            </div>
          </div>
        </div>

        <div class="quick-actions">
          <button class="secondary-action-btn icon-action-btn" @click="togglePin">
            <span class="action-icon pin-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M14 3l7 7-2 2-1.5-1.5-4.5 4.5v4l-1 1-3.5-3.5-4 4-1.5-1.5 4-4L3 11.5l1-1h4L12.5 6 11 4.5 14 3z" /></svg>
            </span>
            {{ Number(groupInfo?.top || 0) === 1 ? '取消置顶' : '置顶群聊' }}
          </button>
          <button class="secondary-action-btn icon-action-btn" @click="toggleMute">
            <span class="action-icon mute-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 4.8L5.2 3.6 20.4 18.8 19.2 20l-2.5-2.5H8.8L5 21.2V8.8L4 4.8zM7 8.4v7.6l1.1-1.1h5.2L7 8.4zM9.6 5h6.9A2.5 2.5 0 0 1 19 7.5v7.1l-2-2V7.5a.5.5 0 0 0-.5-.5h-4.9l-2-2z" /></svg>
            </span>
            {{ Number(groupInfo?.mute || 0) === 1 ? '关闭免打扰' : '消息免打扰' }}
          </button>
          <button class="secondary-action-btn" @click="openInviteModal">
            邀请成员
          </button>
          <button class="secondary-action-btn" @click="loadQRCode">
            群二维码
          </button>
          <button class="secondary-action-btn" @click="toggleInviteApproval">
            {{ inviteMode ? '关闭邀请确认' : '邀请确认' }}
          </button>
          <button class="secondary-action-btn" @click="toggleMuteAll">
            {{ Number(groupInfo?.forbidden || 0) === 1 ? '关闭全员禁言' : '全员禁言' }}
          </button>
          <button class="secondary-action-btn disabled-action" disabled>
            黑名单暂不可用
          </button>
        </div>

        <!-- Group Actions -->
        <div class="danger-zone">
          <button v-if="isOwner" class="action-btn disband-btn" @click="handleDisband">
            解散群组
          </button>
          <button v-else class="action-btn exit-btn" @click="handleExit">
            退出群聊
          </button>
        </div>
      </div>
    </div>
    <div v-if="showInviteModal" class="modal-mask">
      <div class="invite-modal" @click.stop>
        <div class="invite-title">邀请成员</div>
        <div class="invite-desc">搜索用户后添加到邀请列表，也可以输入多个 UID 后直接确认</div>
        <div class="invite-search-row">
          <input
            v-model="inviteKeyword"
            class="invite-input"
            type="text"
            placeholder="输入 UID、手机号或短编号"
            @keydown.enter.prevent="searchInviteUser"
          />
          <button class="modal-btn secondary" :disabled="inviteSearching" @click="searchInviteUser">
            {{ inviteSearching ? '搜索中' : '搜索' }}
          </button>
        </div>
        <div v-if="inviteSearchResult" class="invite-result">
          <ChannelAvatar :avatar="inviteSearchResult.avatar" :name="inviteSearchResult.name || inviteSearchResult.uid" :size="32" />
          <span class="invite-result-name">{{ inviteSearchResult.name || inviteSearchResult.uid }}</span>
          <button class="small-link-btn" @click="addInviteUser(inviteSearchResult)">添加</button>
        </div>
        <div v-if="selectedInviteUsers.length > 0" class="selected-users">
          <span
            v-for="user in selectedInviteUsers"
            :key="user.uid"
            class="selected-user-chip"
          >
            {{ user.name || user.uid }}
            <button @click="removeInviteUser(user.uid)">×</button>
          </span>
        </div>
        <div class="invite-actions">
          <button class="modal-btn secondary" @click="showInviteModal = false">取消</button>
          <button class="modal-btn primary" @click="submitInviteMembers">确认邀请</button>
        </div>
      </div>
    </div>
    <div v-if="showQrModal" class="modal-mask">
      <div class="invite-modal" @click.stop>
        <div class="invite-title">群二维码</div>
        <div v-if="qrState === 'loading'" class="invite-desc">正在加载群二维码</div>
        <div v-else-if="qrState === 'ready'" class="qr-box">{{ qrCodeUrl }}</div>
        <div v-else-if="qrState === 'approval'" class="invite-desc">邀请确认已开启，扫码入群待审批</div>
        <div v-else-if="qrState === 'expired'" class="invite-desc">群二维码已过期</div>
        <div v-else class="invite-desc">群二维码暂不可用</div>
        <div class="invite-actions">
          <button class="modal-btn secondary" @click="showQrModal = false">关闭</button>
        </div>
      </div>
    </div>
    <AppDialog
      :visible="!!pendingDestructiveAction"
      :title="pendingDestructiveAction?.title || ''"
      :message="pendingDestructiveAction?.message || ''"
      :loading="destructiveLoading"
      danger
      confirm-text="确认"
      @confirm="confirmDestructiveAction"
      @close="pendingDestructiveAction = null"
    />
  </div>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
}

.drawer-content {
  width: 360px;
  height: 100%;
  background-color: var(--bg-primary);
  border-left: var(--border-hairline);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  height: 64px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: var(--border-hairline);
}

.drawer-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
}

.close-icon {
  width: 20px;
  height: 20px;
}

.drawer-body {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
}

.group-profile-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  border-bottom: var(--border-hairline);
  padding-bottom: 24px;
}

.avatar-wrap {
  position: relative;
}

.group-profile-section :deep(.channel-avatar) {
  position: relative;
}

.avatar-edit-overlay {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.34);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  border: none;
  cursor: pointer;
}

.hidden-input {
  display: none;
}

.avatar-btn {
  height: 28px;
  padding: 0 10px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
}

.info-fields {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.field-value-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.field-value {
  font-size: 13.5px;
  color: var(--text-primary);
  font-weight: 500;
}

.empty-notice {
  font-style: italic;
  color: var(--text-secondary);
}

.edit-btn {
  background: none;
  border: none;
  color: var(--primary-color, #165dff);
  font-size: 12px;
  cursor: pointer;
}

.edit-row {
  display: flex;
  gap: 8px;
}

.notice-edit {
  flex-direction: column;
  align-items: flex-end;
}

.edit-input {
  flex: 1;
  height: 32px;
  padding: 0 8px;
  background-color: var(--bg-secondary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.edit-textarea {
  width: 100%;
  padding: 8px;
  background-color: var(--bg-secondary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  resize: none;
}

.save-btn {
  height: 32px;
  padding: 0 12px;
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.members-summary-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-bottom: var(--border-hairline);
  padding-bottom: 24px;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
}

.view-all-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
}

.members-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.role-summary {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--text-secondary);
}

.member-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.member-name {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: center;
}

.member-role {
  font-size: 10px;
  color: var(--primary-color, #165dff);
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  border-bottom: var(--border-hairline);
  padding-bottom: 24px;
}

.secondary-action-btn {
  height: 34px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
}

.secondary-action-btn:disabled,
.disabled-action {
  color: var(--text-disabled, #9ca3af);
  cursor: not-allowed;
  opacity: 0.7;
}

.icon-action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.action-icon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  color: var(--text-secondary);
}

.action-icon svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
}

.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-btn {
  height: 38px;
  width: 100%;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.disband-btn {
  background-color: #ff4d4f15;
  color: #ff4d4f;
  border: 1px solid #ff4d4f40;
}

.exit-btn {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: var(--border-hairline);
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.36);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3200;
  padding: 24px;
}

.invite-modal {
  width: 420px;
  max-width: min(420px, calc(100vw - 32px));
  max-height: min(560px, calc(100vh - 48px));
  overflow: auto;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  padding: 20px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.invite-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.invite-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.qr-box {
  min-height: 88px;
  padding: 12px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
  word-break: break-all;
}

.invite-search-row {
  display: flex;
  gap: 10px;
}

.invite-input {
  width: 100%;
  height: 34px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  padding: 0 10px;
  outline: none;
}

.invite-result {
  height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
}

.invite-result-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
}

.small-link-btn {
  border: none;
  background: none;
  color: var(--primary-color, #165dff);
  cursor: pointer;
}

.selected-users {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selected-user-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 8px;
  background: var(--bg-secondary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.selected-user-chip button {
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
}

.invite-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.modal-btn {
  height: 34px;
  min-width: 84px;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
}

.modal-btn.secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: var(--border-hairline);
}

.modal-btn.primary {
  background: var(--primary-color, #165dff);
  color: #fff;
}
</style>
