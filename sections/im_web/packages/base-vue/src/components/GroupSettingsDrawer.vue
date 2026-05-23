<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useGroupStore } from '@tsdaodao/datasource-vue';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { useConversationStore } from '@tsdaodao/datasource-vue';
import { getMyGroupRole } from '@tsdaodao/datasource-vue';
import { groupApi } from '@tsdaodao/datasource-vue';
import ChannelAvatar from './ChannelAvatar.vue';
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

const isOwner = computed(() => {
  return getMyGroupRole(groupInfo.value, userStore.currentUser?.uid) === 1;
});

const canManageGroup = computed(() => {
  return getMyGroupRole(groupInfo.value, userStore.currentUser?.uid) >= 1;
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
    await groupStore.getGroupInfo(props.groupNo);
    await groupStore.fetchGroupMembers(props.groupNo);
  }
});

async function saveGroupName() {
  if (!newName.value.trim()) return;
  try {
    await groupApi.updateGroupInfo(props.groupNo, { name: newName.value });
    Message.success('群名修改成功');
    if (groupInfo.value) groupInfo.value.name = newName.value;
    conversationStore.ensureGroupConversations();
    editingName.value = false;
  } catch (err: any) {
    Message.error(err.msg || '修改失败');
  }
}

async function saveGroupNotice() {
  try {
    await groupApi.updateGroupInfo(props.groupNo, { notice: newNotice.value });
    Message.success('公告修改成功');
    if (groupInfo.value) groupInfo.value.notice = newNotice.value;
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
    await groupStore.getGroupInfo(props.groupNo);
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

async function inviteMembersPrompt() {
  const raw = window.prompt('输入要邀请的用户 UID，多个 UID 用英文逗号分隔');
  const membersToInvite = raw?.split(',').map(item => item.trim()).filter(Boolean) || [];
  if (membersToInvite.length === 0) return;

  try {
    await groupApi.inviteMembers(props.groupNo, membersToInvite);
    Message.success('邀请已发送');
    await groupStore.fetchGroupMembers(props.groupNo);
  } catch (err: any) {
    Message.error(err.msg || '邀请失败');
  }
}

async function handleDisband() {
  try {
    await groupApi.disbandGroup(props.groupNo);
    Message.success('群组已解散');
    await conversationStore.deleteConversation(props.groupNo, 2);
    emit('close');
  } catch (err: any) {
    Message.error(err.msg || '操作失败');
  }
}

async function handleExit() {
  try {
    await groupApi.exitGroup(props.groupNo);
    Message.success('已退出群聊');
    await conversationStore.deleteConversation(props.groupNo, 2);
    emit('close');
  } catch (err: any) {
    Message.error(err.msg || '操作失败');
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
          <ChannelAvatar 
            :avatar="groupInfo?.avatar" 
            :name="groupInfo?.name" 
            :is-group="true" 
            :size="64" 
          />
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
          <button class="secondary-action-btn" @click="togglePin">
            {{ Number(groupInfo?.top || 0) === 1 ? '取消置顶' : '置顶群聊' }}
          </button>
          <button class="secondary-action-btn" @click="toggleMute">
            {{ Number(groupInfo?.mute || 0) === 1 ? '关闭免打扰' : '消息免打扰' }}
          </button>
          <button class="secondary-action-btn" @click="inviteMembersPrompt">
            邀请成员
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
</style>
