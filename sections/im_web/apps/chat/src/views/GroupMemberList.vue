<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  canAppointGroupAdmin,
  canManageGroupMember,
  canRemoveGroupAdmin,
  getMyGroupRole,
  useClowderStore,
  useGroupStore
} from '@tsdaodao/datasource-vue';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { AppDialog, ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';

const route = useRoute();
const router = useRouter();
const groupStore = useGroupStore();
const userStore = useUserStore();
const clowderStore = useClowderStore();

const groupNo = computed(() => route.params.groupNo as string);

const groupInfo = computed(() => groupStore.groups[groupNo.value]);
const members = computed(() => groupStore.groupMembers[groupNo.value] || []);
const catMembers = computed(() => clowderStore.groupCatMemberships[groupNo.value] || []);
const memberKeyword = ref('');
const selectedCatId = ref('');
const pendingAction = ref<null | { title: string; message: string; danger?: boolean; run: () => Promise<void> }>(null);
const pendingActionLoading = ref(false);

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

const filteredCatMembers = computed(() => {
  const keyword = memberKeyword.value.trim().toLowerCase();
  if (!keyword) return catMembers.value;
  return catMembers.value.filter(cat => {
    return [
      cat.displayName,
      cat.catId,
      ...cat.aliases
    ].some(value => String(value || '').toLowerCase().includes(keyword));
  });
});

const availableCatsForGroup = computed(() => {
  const currentCatIds = new Set(catMembers.value.map(cat => cat.catId));
  return clowderStore.connectedCatContacts.filter(cat => !currentCatIds.has(cat.catId));
});

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

const canManage = computed(() => {
  return isOwner.value || currentMemberRole.value === 2 || getMyGroupRole(groupInfo.value, userStore.currentUser?.uid) >= 1;
});

onMounted(async () => {
  if (groupNo.value) {
    await groupStore.getGroupInfo(groupNo.value);
    await groupStore.fetchGroupMembers(groupNo.value);
    await clowderStore.loadCatContactDirectory({ includeUnavailable: true }).catch(() => undefined);
    await clowderStore.loadGroupCats(groupNo.value).catch(() => undefined);
  }
});

async function handleRemoveMember(uid: string) {
  pendingAction.value = {
    title: '移出成员',
    message: '确认移出该成员？',
    danger: true,
    run: async () => {
      await groupStore.removeMembers(groupNo.value, [uid]);
      Message.success('已移出该成员');
    }
  };
}

async function handleRemoveCatMember(catId: string) {
  pendingAction.value = {
    title: '移出猫猫成员',
    message: '确认从群里移出该猫猫？',
    danger: true,
    run: async () => {
      await clowderStore.removeGroupCat(groupNo.value, catId, groupInfo.value?.name || groupNo.value);
      Message.success('已移出猫猫成员');
    }
  };
}

async function handleAddCatMember() {
  const catId = selectedCatId.value;
  if (!catId) return;
  try {
    await clowderStore.addGroupCat(groupNo.value, catId, groupInfo.value?.name || groupNo.value);
    selectedCatId.value = '';
    Message.success('已添加猫猫成员');
  } catch (err: any) {
    Message.error(err.message || err.msg || '添加猫猫失败');
  }
}

async function handleAppointManager(uid: string) {
  try {
    await groupStore.appointManager(groupNo.value, uid);
    Message.success('已设为管理员');
  } catch (err: any) {
    Message.error(err.msg || '操作失败');
  }
}

async function handleRemoveManager(uid: string) {
  try {
    await groupStore.removeManager(groupNo.value, uid);
    Message.success('已取消管理员');
  } catch (err: any) {
    Message.error(err.msg || '操作失败');
  }
}

async function handleMuteMember(uid: string, action: number) {
  try {
    // action: 1 to mute, 0 to unmute
    await groupStore.muteMember(groupNo.value, uid, action === 1);
    Message.success(action === 1 ? '已禁言该成员' : '已解除禁言');
  } catch (err: any) {
    Message.error(err.msg || '操作失败');
  }
}

async function handleTransferOwner(uid: string) {
  pendingAction.value = {
    title: '转让群主',
    message: '确认转让群主？',
    danger: true,
    run: async () => {
      await groupStore.transferOwner(groupNo.value, uid);
      Message.success('群主已转让');
    }
  };
}

async function handleBlacklistMember(uid: string) {
  pendingAction.value = {
    title: '加入黑名单',
    message: '确认加入黑名单？',
    danger: true,
    run: async () => {
      await groupStore.blacklistMembers(groupNo.value, [uid], true);
      Message.success('已加入黑名单');
    }
  };
}

async function confirmPendingAction() {
  if (!pendingAction.value) return;
  pendingActionLoading.value = true;
  try {
    await pendingAction.value.run();
    pendingAction.value = null;
  } catch (err: any) {
    Message.error(err.msg || '操作失败');
  } finally {
    pendingActionLoading.value = false;
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
      <h3 class="page-title">群成员列表 ({{ members.length + catMembers.length }}人)</h3>
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
        <div v-if="canManage" class="cat-add-row">
          <select v-model="selectedCatId" class="cat-add-select">
            <option value="">添加猫猫</option>
            <option
              v-for="cat in availableCatsForGroup"
              :key="cat.id"
              :value="cat.catId"
            >
              {{ cat.displayName }}
            </option>
          </select>
          <button
            class="action-btn"
            :disabled="!selectedCatId"
            @click="handleAddCatMember"
          >
            添加
          </button>
        </div>

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

            <button
              v-if="isOwner && Number(m.role || 0) !== 1"
              class="action-btn"
              @click="handleTransferOwner(m.uid)"
            >
              转让群主
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

            <button
              v-if="canManage && canManageGroupMember(groupInfo, m)"
              class="action-btn blacklist-btn"
              @click="handleBlacklistMember(m.uid)"
            >
              黑名单
            </button>
          </div>
        </div>

        <div v-if="filteredCatMembers.length > 0" class="cat-section-title">猫猫成员</div>
        <div
          v-for="cat in filteredCatMembers"
          :key="cat.id"
          class="member-row clowder-cat-member"
        >
          <ChannelAvatar :avatar="cat.avatar" :name="cat.displayName" :size="36" />
          <div class="member-body">
            <span class="member-name">{{ cat.displayName }}</span>
            <span class="role-badge cat">猫猫</span>
            <span class="cat-alias">{{ cat.aliases.join(', ') }}</span>
          </div>

          <div class="member-actions">
            <button
              v-if="canManage"
              class="action-btn kick-btn"
              @click="handleRemoveCatMember(cat.catId)"
            >
              移出
            </button>
          </div>
        </div>
      </div>
    </div>

    <AppDialog
      :visible="!!pendingAction"
      :title="pendingAction?.title || ''"
      :message="pendingAction?.message || ''"
      :danger="pendingAction?.danger"
      :loading="pendingActionLoading"
      confirm-text="确认"
      @confirm="confirmPendingAction"
      @close="pendingAction = null"
    />
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

.cat-add-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px 12px;
  border-bottom: var(--border-hairline);
  background-color: var(--bg-primary);
}

.cat-add-select {
  flex: 1;
  height: 34px;
  padding: 0 10px;
  background-color: var(--bg-primary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
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

.role-badge.cat {
  color: #0f766e;
  background: rgba(15, 118, 110, 0.1);
}

.cat-section-title {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: var(--border-hairline);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.clowder-cat-member {
  background: rgba(15, 118, 110, 0.04);
}

.cat-alias {
  color: var(--text-secondary);
  font-size: 12px;
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

.kick-btn,
.blacklist-btn {
  background-color: #ff4d4f15;
  color: #ff4d4f;
  border-color: #ff4d4f40;
}
</style>
