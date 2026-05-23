<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  canAppointGroupAdmin,
  canManageGroupMember,
  canRemoveGroupAdmin,
  getMyGroupRole,
  useGroupStore
} from '@tsdaodao/datasource-vue';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { groupApi } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';

const route = useRoute();
const router = useRouter();
const groupStore = useGroupStore();
const userStore = useUserStore();

const groupNo = computed(() => route.params.groupNo as string);

const groupInfo = computed(() => groupStore.groups[groupNo.value]);
const members = computed(() => groupStore.groupMembers[groupNo.value] || []);
const memberKeyword = ref('');

const filteredMembers = computed(() => {
  const keyword = memberKeyword.value.trim().toLowerCase();
  if (!keyword) return members.value;
  return members.value.filter((member: any) => {
    return [
      member.display_name,
      member.name,
      member.member_name,
      member.uid,
      member.member_uid
    ].some(value => String(value || '').toLowerCase().includes(keyword));
  });
});

const isOwner = computed(() => {
  return getMyGroupRole(groupInfo.value, userStore.currentUser?.uid) === 1;
});

const canManage = computed(() => {
  return getMyGroupRole(groupInfo.value, userStore.currentUser?.uid) >= 1;
});

onMounted(async () => {
  if (groupNo.value) {
    await groupStore.getGroupInfo(groupNo.value);
    await groupStore.fetchGroupMembers(groupNo.value);
  }
});

async function handleRemoveMember(uid: string) {
  try {
    await groupApi.removeMembers(groupNo.value, [uid]);
    Message.success('已移出该成员');
    await groupStore.fetchGroupMembers(groupNo.value);
  } catch (err: any) {
    Message.error(err.msg || '操作失败');
  }
}

async function handleAppointManager(uid: string) {
  try {
    await groupApi.appointManager(groupNo.value, [uid]);
    Message.success('已设为管理员');
    await groupStore.fetchGroupMembers(groupNo.value);
  } catch (err: any) {
    Message.error(err.msg || '操作失败');
  }
}

async function handleRemoveManager(uid: string) {
  try {
    await groupApi.removeManager(groupNo.value, [uid]);
    Message.success('已取消管理员');
    await groupStore.fetchGroupMembers(groupNo.value);
  } catch (err: any) {
    Message.error(err.msg || '操作失败');
  }
}

async function handleMuteMember(uid: string, action: number) {
  try {
    // action: 1 to mute, 0 to unmute
    await groupApi.muteMember(groupNo.value, { member_uid: uid, action, key: 1 });
    Message.success(action === 1 ? '已禁言该成员' : '已解除禁言');
    await groupStore.fetchGroupMembers(groupNo.value);
  } catch (err: any) {
    Message.error(err.msg || '操作失败');
  }
}

function handleGoBack() {
  router.push(`/chat/conversation/${groupNo.value}/2`);
}
</script>

<template>
  <div class="members-page">
    <div class="page-header">
      <button class="back-btn" @click="handleGoBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="back-icon">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>
      <h3 class="page-title">群成员列表 ({{ members.length }}人)</h3>
    </div>

    <div class="page-content">
      <div class="member-search">
        <input
          v-model="memberKeyword"
          type="text"
          class="member-search-input"
          placeholder="搜索成员昵称或 UID"
        />
      </div>

      <div class="members-list">
        <div v-for="m in filteredMembers" :key="m.uid" class="member-row">
          <ChannelAvatar :avatar="m.avatar" :name="m.name" :size="36" />
          <div class="member-body">
            <span class="member-name">{{ m.display_name || m.name }}</span>
            <span v-if="Number(m.role || 0) === 1" class="role-badge owner">群主</span>
            <span v-else-if="Number(m.role || 0) === 2" class="role-badge admin">管理员</span>
            <span v-if="m.is_mute === 1" class="role-badge muted">禁言中</span>
          </div>

          <div class="member-actions">
            <button
              v-if="canAppointGroupAdmin(groupInfo, m)"
              class="action-btn"
              @click="handleAppointManager(m.uid)"
            >
              设管理员
            </button>

            <button
              v-if="canRemoveGroupAdmin(groupInfo, m)"
              class="action-btn"
              @click="handleRemoveManager(m.uid)"
            >
              取消管理员
            </button>

            <!-- Mute buttons -->
            <button 
              v-if="canManage && canManageGroupMember(groupInfo, m)" 
              class="action-btn"
              :class="{ muted: m.is_mute === 1 }"
              @click="handleMuteMember(m.uid, m.is_mute === 1 ? 0 : 1)"
            >
              {{ m.is_mute === 1 ? '解禁' : '禁言' }}
            </button>

            <!-- Kick button -->
            <button 
              v-if="canManage && canManageGroupMember(groupInfo, m)" 
              class="action-btn kick-btn"
              @click="handleRemoveMember(m.uid)"
            >
              移出
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.members-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-primary);
}

.page-header {
  height: 64px;
  border-bottom: var(--border-hairline);
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  background-color: var(--bg-primary);
  flex-shrink: 0;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn:hover {
  background-color: var(--bg-hover);
}

.back-icon {
  width: 20px;
  height: 20px;
}

.page-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.page-content {
  flex: 1;
  overflow-y: auto;
}

.member-search {
  padding: 12px 16px;
  border-bottom: var(--border-hairline);
  background-color: var(--bg-primary);
}

.member-search-input {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  background-color: var(--bg-secondary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  outline: none;
  font-size: 13px;
}

.members-list {
  display: flex;
  flex-direction: column;
}

.member-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
  border-bottom: var(--border-hairline);
  background-color: var(--bg-primary);
}

.member-body {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-name {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
}

.role-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.role-badge.owner {
  background-color: #ff9c6e30;
  color: #d4380d;
}

.role-badge.admin {
  background-color: #69c0ff30;
  color: #096dd9;
}

.role-badge.muted {
  background-color: #ff4d4f15;
  color: #ff4d4f;
}

.member-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  height: 26px;
  padding: 0 10px;
  background-color: var(--bg-secondary);
  border: var(--border-hairline);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}

.action-btn:hover {
  background-color: var(--bg-hover);
}

.action-btn.muted {
  background-color: #ff4d4f15;
  color: #ff4d4f;
  border-color: #ff4d4f40;
}

.kick-btn {
  background-color: #ff4d4f15;
  color: #ff4d4f;
  border-color: #ff4d4f40;
}
</style>
