<template>
  <view class="group-info flex-column">
    <view class="identity-section flex-column align-center">
      <AppAvatar
        :src="group.avatar"
        :text="group.name"
        :size="72"
        :is-circle="false"
        class="group-avatar"
      />
      <text class="group-name">{{ group.name }}</text>
      <text class="group-sub">{{ memberCount }} 位成员 · {{ isCreator ? '我是群主' : '群聊成员' }}</text>
    </view>

    <view class="info-card members-section flex-column">
      <view class="section-title-row flex-row align-center justify-between">
        <text class="section-title">群成员</text>
        <text class="section-link" @click="$emit('open-members')">查看全部 ({{ memberCount }})</text>
      </view>
      <view class="member-preview-grid">
        <view
          v-for="member in previewMembers"
          :key="member.id"
          class="member-preview"
          @click="handleMemberSelect(member)"
          @contextmenu.prevent.stop="handleMemberContextMenu($event, member)"
          @longpress.stop="handleMemberContextMenu($event, member)"
        >
          <AppAvatar :src="member.avatar" :text="memberDisplayName(member)" :size="42" />
          <text class="member-preview-name">{{ memberDisplayName(member) }}</text>
          <text
            v-if="roleLabel(member.role)"
            class="member-role-chip"
            :class="member.role"
          >{{ roleLabel(member.role) }}</text>
        </view>
      </view>
    </view>

    <view class="info-card action-section flex-column">
      <button v-if="agentBoard" class="action-row board-action" @click="$emit('open-board', agentBoard)">
        <AppIcon name="briefcase" :size="18" color="var(--color-primary)" />
        <text class="action-text flex-1">智能体看板</text>
        <text class="count-chip board-chip">{{ agentBoard.tasks.length }}</text>
        <AppIcon name="right" :size="14" color="var(--color-text-muted)" />
      </button>
      <button class="action-row" @click="$emit('open-qrcode')">
        <AppIcon name="grid" :size="18" color="var(--color-text-primary)" />
        <text class="action-text flex-1">群二维码</text>
        <AppIcon name="right" :size="14" color="var(--color-text-muted)" />
      </button>
      <button class="action-row" @click="$emit('open-members')">
        <AppIcon name="group" :size="18" color="var(--color-text-primary)" />
        <text class="action-text flex-1">成员管理</text>
        <AppIcon name="right" :size="14" color="var(--color-text-muted)" />
      </button>
      <button class="action-row" @click="handleSharedFilesClick">
        <AppIcon name="files" :size="18" color="var(--color-text-primary)" />
        <text class="action-text flex-1">共享文件</text>
        <text v-if="sharedFiles.length" class="count-chip">{{ sharedFiles.length }}</text>
        <AppIcon name="right" :size="14" color="var(--color-text-muted)" />
      </button>
    </view>

    <view class="announcement-section flex-column">
      <GroupAnnouncement
        :text="announcementText"
        :can-edit="isCreator"
        @update="handleAnnouncementUpdate"
      />
    </view>

    <view class="info-card danger-section flex-column">
      <button class="action-row danger" @click="handleExit">
        <AppIcon name="exit" :size="18" color="var(--color-error)" />
        <text class="action-text-danger flex-1">退出群聊</text>
      </button>
      <button v-if="isCreator" class="action-row danger" @click="handleDisband">
        <AppIcon name="trash" :size="18" color="var(--color-error)" />
        <text class="action-text-danger flex-1">解散群聊</text>
      </button>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { useConversationStore } from '@/stores/conversation';
import { useGroupStore } from '@/stores/group';
import { useMessageStore } from '@/stores/message';
import { useAgentStore } from '@/stores/agent';
import { useAppStore } from '@/stores/app';
import { useConfirm } from '@/composables/useConfirm';
import { resolveSelfId } from '@/services/native-im/message-state';
import { mergeSharedFilesWithBoardDocuments } from '@/services/native-im/project-board';
import AppAvatar from '../common/AppAvatar.vue';
import AppIcon from '../common/AppIcon.vue';
import GroupAnnouncement from './GroupAnnouncement.vue';

const props = defineProps({
  group: { type: Object, required: true }
});

const emit = defineEmits(['open-members', 'open-qrcode', 'open-board', 'open-files', 'preview-file', 'select-member', 'member-contextmenu']);

const convStore = useConversationStore();
const groupStore = useGroupStore();
const messageStore = useMessageStore();
const agentStore = useAgentStore();
const appStore = useAppStore();
const { confirm } = useConfirm();

const members = computed(() => convStore.groupMembers(props.group.id));
const memberCount = computed(() => members.value.length || props.group.memberCount || 0);
const previewMembers = computed(() => members.value.slice(0, 4));
const currentUserId = computed(() => resolveSelfId(appStore.currentUser || readStoredCurrentUser()));
const isCreator = computed(() => {
  const selfId = currentUserId.value || 'me';
  return convStore.isGroupCreator(props.group.id, selfId)
    || convStore.isGroupCreator(props.group.channelId, selfId)
    || props.group.creatorId === selfId;
});
const agentBoard = computed(() => {
  return agentStore.boards.find((board) => board.groupId === props.group.id) || null;
});
const announcementText = computed(() => {
  return convStore.announcements[props.group.id]?.text || props.group.announcement || '';
});

const sharedFiles = computed(() => {
  const msgs = messageStore.messages[props.group.id] || [];
  return mergeSharedFilesWithBoardDocuments(
    msgs.filter((m) => m.type === 'file'),
    agentBoard.value
  ).slice(0, 4);
});

function handleMemberSelect(member) {
  emit('select-member', member);
}

function handleMemberContextMenu(event, member) {
  emit('member-contextmenu', { event, member });
}

function memberDisplayName(member) {
  return member.remark || member.nickname || member.name || '成员';
}

function roleLabel(role) {
  if (role === 'owner') return '群主';
  if (role === 'admin') return '管理';
  return '';
}

function readStoredCurrentUser() {
  if (typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') return {};
  try {
    const raw = uni.getStorageSync('app_user');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function handleAnnouncementUpdate(text) {
  try {
    await convStore.updateGroupAnnouncement(props.group, text, {
      publisherId: currentUserId.value || 'me'
    });
    uni.showToast({ title: '已更新群公告', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: error?.msg || error?.message || '群公告更新失败', icon: 'none' });
  }
}

function handleSharedFilesClick() {
  emit('open-files');
}

function handleExit() {
  confirm(`确定要退出「${props.group.name}」吗？`, {
    title: '退出群聊',
    destructive: true
  }).then((ok) => {
    if (ok) {
      groupStore.exitGroup(props.group.id);
      convStore.deleteConversation(props.group.id);
      uni.showToast({ title: '已退出群聊', icon: 'success' });
    }
  });
}

function handleDisband() {
  confirm(`确定要解散「${props.group.name}」吗？解散后所有成员将无法查看历史消息。`, {
    title: '解散群聊',
    destructive: true
  }).then((ok) => {
    if (ok) {
      groupStore.disbandGroup(props.group.id);
      convStore.deleteConversation(props.group.id);
      uni.showToast({ title: '已解散群聊', icon: 'success' });
    }
  });
}
</script>

<style scoped>
.group-info {
  width: 100%;
  padding: 22px 20px 28px;
  gap: 16px;
  box-sizing: border-box;
  background-color: var(--color-bg-surface);
}

.info-card {
  display: flex;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background-color: var(--color-bg-surface);
  box-sizing: border-box;
}

.identity-section {
  gap: 10px;
  padding: 8px 0 20px;
  border-bottom: 1px solid var(--color-border);
}

.group-name {
  max-width: 100%;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 8px;
}

.group-avatar {
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1);
}

.group-sub {
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: center;
}

.members-section {
  gap: 14px;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.section-link {
  font-size: 12px;
  color: var(--color-primary);
  font-weight: 600;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
}

.section-link:hover {
  background-color: var(--color-bg-hover);
}

.member-preview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.member-preview {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.member-preview-name {
  max-width: 100%;
  font-size: 12px;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-role-chip,
.count-chip {
  min-height: 18px;
  border-radius: 999px;
  padding: 0 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.member-role-chip.admin {
  color: var(--color-text-secondary);
  background-color: var(--color-bg-muted);
}

.count-chip {
  margin-left: auto;
  color: var(--color-text-secondary);
  background-color: var(--color-bg-muted);
}

.action-section,
.danger-section {
  gap: 0;
  padding: 4px 14px;
}

.danger-section {
  border-color: rgba(239, 68, 68, 0.22);
  background-color: rgba(239, 68, 68, 0.03);
}

.action-row {
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
  margin: 0;
  background-color: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-primary);
}

.action-row:last-child {
  border-bottom: none;
}

.action-row.danger {
  border-color: transparent;
  background-color: transparent;
  color: var(--color-text-secondary);
}

.action-row.board-action {
  color: var(--color-primary);
}

.action-row::after {
  border: none;
}

.action-row:hover,
.action-row:active {
  background-color: var(--color-bg-hover);
}

.action-row.danger:hover,
.action-row.danger:active {
  background-color: rgba(239, 68, 68, 0.08);
  color: var(--color-error);
}

.action-text {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 600;
  text-align: left;
}

.board-chip {
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.action-text-danger {
  font-size: 14px;
  color: var(--color-error);
  font-weight: 600;
  text-align: left;
}

.action-row.danger:hover .action-text-danger,
.action-row.danger:active .action-text-danger {
  color: var(--color-error);
}

.announcement-section {
  padding: 0;
  overflow: hidden;
}

@media (max-width: 768px) {
  .group-info {
    padding: 18px 16px 24px;
    gap: 14px;
    background-color: var(--color-bg-base);
  }

  .identity-section {
    padding: 8px 0 18px;
  }

  .group-name {
    font-size: 20px;
  }

  .info-card {
    border-radius: 14px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  }

  .member-preview-grid {
    gap: 8px;
  }
}
</style>
