<template>
  <view class="right-workspace-container flex-column">
    <!-- Header -->
    <view class="workspace-header flex-row align-center justify-between">
      <text class="header-title">{{ headerTitle }}</text>
      <view class="close-btn" @click="$emit('close')">
        <AppIcon name="close" :size="20" />
      </view>
    </view>

    <!-- Scrollable content -->
    <scroll-view scroll-y class="workspace-scroll flex-1">
      <template v-if="conversation.id === 'clowder'">
        <ClowderPanel :conversation-id="conversation.id" />
      </template>
      <template v-else-if="conversation.type === 'group'">
        <view v-if="groupWorkspaceMode === 'project' && projectThreadId" class="project-workspace flex-column">
          <view class="board-topbar flex-row align-center justify-between">
            <button class="board-back flex-row align-center" @click="showGroupInfo">
              <AppIcon name="back" :size="16" color="var(--color-text-primary)" />
              <text>群聊信息</text>
            </button>
            <view class="board-status flex-row align-center">
              <AppIcon name="briefcase" :size="15" color="var(--color-primary)" />
              <text>{{ projectBindingStatus }}</text>
            </view>
          </view>

          <view class="board-summary-card flex-column">
            <text class="board-title">{{ projectWorkspaceTitle }}</text>
            <text class="board-desc">{{ projectThreadId }}</text>
          </view>

          <view class="project-tabs flex-row">
            <button class="project-tab" :class="{ active: projectWorkspaceTab === 'kanban' }" @click="projectWorkspaceTab = 'kanban'">看板</button>
            <button class="project-tab" :class="{ active: projectWorkspaceTab === 'artifacts' }" @click="projectWorkspaceTab = 'artifacts'">产物</button>
          </view>

          <view class="project-panel flex-column">
            <ProjectKanbanPanel v-if="projectWorkspaceTab === 'kanban'" :thread-id="projectThreadId" />
            <ProjectArtifactsPanel v-else :thread-id="projectThreadId" />
          </view>
        </view>
        <GroupInfoPanel
          v-else
          :group="groupData"
          :project-thread-id="projectThreadId"
          :project-workspace-loading="visibleProjectWorkspaceLoading"
          @open-members="openGroupMembers"
          @open-qrcode="openGroupQrcode"
          @open-project-workspace="openProjectWorkspace"
          @preview-file="$emit('preview-file', $event)"
          @select-member="$emit('select-member', $event)"
          @member-contextmenu="$emit('member-contextmenu', $event)"
        />
      </template>
      <template v-else>
        <view class="workspace-section flex-column align-center">
          <!-- Avatar and name -->
          <AppAvatar
            :src="conversation.avatar"
            :text="conversation.name"
            :size="64"
            :is-circle="conversation.type !== 'robot'"
          />
          <text class="section-name">{{ conversation.name }}</text>
          <text class="section-type-badge">{{ convTypeLabel }}</text>
        </view>

        <!-- Settings toggles -->
        <view class="workspace-section flex-column">
          <view class="setting-row flex-row justify-between align-center">
            <text class="setting-label">置顶会话</text>
            <switch :checked="conversation.isPinned" color="var(--color-primary)" @change="togglePinned" />
          </view>
          <view class="setting-row flex-row justify-between align-center">
            <text class="setting-label">消息免打扰</text>
            <switch :checked="conversation.isMuted" color="var(--color-primary)" @change="toggleMuted" />
          </view>
        </view>

        <!-- Shared Files List -->
        <view class="workspace-section flex-column">
          <text class="section-title">共享文件</text>
          <view v-if="sharedFiles.length > 0" class="shared-files-list">
            <view
              v-for="file in sharedFiles"
              :key="file.id"
              class="shared-file-item flex-row align-center"
              @click="$emit('preview-file', file)"
            >
              <AppIcon name="files" :size="18" color="var(--color-primary)" />
              <text class="shared-file-name flex-1">{{ file.fileName || file.content }}</text>
              <text class="shared-file-size">{{ file.fileSize }}</text>
            </view>
          </view>
          <text v-else class="empty-files-text">暂无共享文件</text>
        </view>
      </template>
    </scroll-view>
  </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useMessageStore } from '@/stores/message';
import { useGroupStore } from '@/stores/group';
import { useConversationStore } from '@/stores/conversation';
import { useClowderStore } from '@/stores/clowder.js';
import { isClowderConversation, shouldShowProjectWorkspaceLoading } from '@/utils/clowder-conversation.js';
import AppAvatar from '../common/AppAvatar.vue';
import AppIcon from '../common/AppIcon.vue';
import ClowderPanel from './ClowderPanel.vue';
import GroupInfoPanel from './GroupInfoPanel.vue';
import ProjectArtifactsPanel from './ProjectArtifactsPanel.vue';
import ProjectKanbanPanel from './ProjectKanbanPanel.vue';

const props = defineProps({
  conversation: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close', 'update-conversation', 'preview-file', 'member-contextmenu', 'select-member']);

const messageStore = useMessageStore();
const groupStore = useGroupStore();
const convStore = useConversationStore();
const clowderStore = useClowderStore();
const groupWorkspaceMode = ref('info');
const projectWorkspaceTab = ref('kanban');
const projectWorkspaceLoading = ref(false);

const headerTitle = computed(() => {
  if (props.conversation.id === 'clowder') return 'Clowder AI 详情';
  if (props.conversation.type === 'group' && groupWorkspaceMode.value === 'project') return '项目工作台';
  if (props.conversation.type === 'group') return '群聊信息';
  return '会话详情';
});

const convTypeLabel = computed(() => {
  if (props.conversation.type === 'single') return '单聊好友';
  if (props.conversation.type === 'group') return '群聊成员';
  return '智能体/机器人';
});

// PR-11: 群数据从 groupStore 读取, 缺省用 conversation 字段
const groupData = computed(() => {
  if (props.conversation.type !== 'group') return null;
  const groupId = props.conversation.id;
  const members = groupStore.members[groupId] || convStore.groupMembers(groupId) || [];
  const storeGroup = groupStore.groups.find((g) => g.id === groupId);
  const fallback = {
    id: props.conversation.id,
    name: props.conversation.name,
    avatar: props.conversation.avatar,
    memberCount: props.conversation.memberCount || 0,
    announcement: '',
    creatorId: 'me',
    createTime: 0
  };
  return {
    ...fallback,
    ...(storeGroup || {}),
    memberCount: members.length || storeGroup?.memberCount || props.conversation.memberCount || 0
  };
});

const sharedFiles = computed(() => {
  const channelType = props.conversation?.channelType || props.conversation?.type || 1;
  const msgs = messageStore.getMessages(props.conversation.id, channelType);
  return msgs.filter((m) => m.type === 'file');
});

const groupChannelId = computed(() => String(props.conversation?.channelId || props.conversation?.id || ''));
const groupChannelType = computed(() => Number(props.conversation?.channelType || 2));
const groupConversationKey = computed(() => `${groupChannelId.value}-${groupChannelType.value}`);
const clowderConversation = computed(() => clowderStore.conversations[groupConversationKey.value] || null);
const channelBinding = computed(() => clowderStore.bindings[groupConversationKey.value] || clowderConversation.value?.binding || null);

function matchesGroup(binding = {}) {
  const groupId = groupChannelId.value;
  return [
    binding.projectGroupNo,
    binding.project_group_no,
    binding.projectGroupId,
    binding.project_group_id,
    binding.groupNo,
    binding.group_no,
    binding.channelId,
    binding.channel_id
  ].some((value) => String(value || '') === groupId);
}

function bindingThreadId(binding = {}) {
  return String(binding.threadId || binding.thread_id || binding.projectThreadId || binding.project_thread_id || '');
}

const projectGroupBinding = computed(() => {
  return Object.values(clowderStore.projectGroups).find((binding) => matchesGroup(binding)) || null;
});

const projectBinding = computed(() => {
  const candidates = [
    channelBinding.value,
    clowderConversation.value?.projectGroup,
    clowderConversation.value?.project_group,
    projectGroupBinding.value
  ].filter(Boolean);
  return candidates.find((binding) => bindingThreadId(binding)) || candidates[0] || null;
});

const projectThreadId = computed(() => bindingThreadId(projectBinding.value || {}));
const visibleProjectWorkspaceLoading = computed(() => shouldShowProjectWorkspaceLoading(
  props.conversation,
  {
    loading: projectWorkspaceLoading.value,
    state: clowderConversation.value,
    binding: channelBinding.value,
    projectBinding: projectBinding.value,
    projectThreadId: projectThreadId.value
  }
));
const projectWorkspaceTitle = computed(() => (
  projectBinding.value?.projectName ||
  projectBinding.value?.project_name ||
  props.conversation.name ||
  'Clowder 项目'
));
const projectBindingStatus = computed(() => {
  if (projectWorkspaceLoading.value) return '同步中';
  return projectBinding.value?.status || 'active';
});

watch(() => props.conversation.id, () => {
  groupWorkspaceMode.value = 'info';
  projectWorkspaceTab.value = 'kanban';
});

watch(
  () => [props.conversation.id, props.conversation.channelId, props.conversation.channelType, props.conversation.type],
  () => {
    groupWorkspaceMode.value = 'info';
    projectWorkspaceTab.value = 'kanban';
    hydrateGroupMembers();
    hydrateGroupProjectWorkspace();
  },
  { immediate: true }
);

function togglePinned(e) {
  emit('update-conversation', { isPinned: e.detail.value });
}

function toggleMuted(e) {
  emit('update-conversation', { isMuted: e.detail.value });
}

function openGroupMembers() {
  uni.navigateTo({ url: '/pages/group/members' });
}

function openGroupQrcode() {
  uni.navigateTo({ url: '/pages/group/qrcode' });
}

async function hydrateGroupProjectWorkspace() {
  if (props.conversation.type !== 'group' || !groupChannelId.value) return;
  projectWorkspaceLoading.value = true;
  try {
    const state = await clowderStore.fetchBinding(groupChannelId.value, groupChannelType.value);
    let threadId = bindingThreadId(state?.binding || state || projectBinding.value || {});
    const canDiscoverProjectGroup = isClowderConversation(props.conversation) ||
      isClowderConversation(state) ||
      isClowderConversation(state?.binding) ||
      isClowderConversation(projectBinding.value);
    if (!threadId && canDiscoverProjectGroup) {
      const activeBinding = await clowderStore.fetchActiveProjectGroup({
        projectGroupNo: groupChannelId.value
      }).catch((err) => {
        if (err?.status === 404) return null;
        throw err;
      });
      threadId = bindingThreadId(activeBinding || projectBinding.value || {});
    }
    if (threadId) {
      await Promise.all([
        clowderStore.fetchThreadTasks(threadId).catch(() => undefined),
        clowderStore.fetchThreadArtifacts(threadId).catch(() => undefined)
      ]);
    }
  } catch (err) {
    if (err?.status && err.status !== 404) {
      console.warn('[RightWorkspace] project workspace hydration failed', err);
    }
  } finally {
    projectWorkspaceLoading.value = false;
  }
}

async function hydrateGroupMembers() {
  if (props.conversation.type !== 'group' || !groupChannelId.value) return;
  try {
    const members = await groupStore.fetchMembers(groupChannelId.value);
    if (members.length) {
      convStore.initFromGroupMembers(groupChannelId.value, members, groupData.value?.creatorId);
      convStore.addOrUpdateConversation(groupChannelId.value, 2, { memberCount: members.length });
    }
  } catch (err) {
    console.warn('[RightWorkspace] group member hydration failed', err);
  }
}

async function openProjectWorkspace() {
  if (!projectThreadId.value) await hydrateGroupProjectWorkspace();
  if (projectThreadId.value) {
    groupWorkspaceMode.value = 'project';
    projectWorkspaceTab.value = 'kanban';
  }
}

function showGroupInfo() {
  groupWorkspaceMode.value = 'info';
}

</script>

<style scoped>
.right-workspace-container {
  width: 100%;
  height: 100%;
  background-color: var(--color-bg-surface);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.workspace-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.close-btn {
  cursor: pointer;
  display: flex;
  align-items: center;
}

.workspace-scroll {
  flex: 1;
  min-height: 0;
  height: 0;
}

.workspace-section {
  padding: 20px 22px;
  border-bottom: 1px solid var(--color-border);
}

.project-workspace,
.inline-board {
  width: 100%;
  min-height: 100%;
  padding: 16px 18px 24px;
  gap: 14px;
  box-sizing: border-box;
  background-color: var(--color-bg-base);
}

.project-tabs {
  min-height: 40px;
  padding: 4px;
  gap: 4px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-bg-surface);
  box-sizing: border-box;
}

.project-tab {
  flex: 1;
  min-width: 0;
  height: 32px;
  margin: 0;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background-color: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.project-tab::after {
  border: none;
}

.project-tab.active {
  background-color: var(--color-primary);
  color: #ffffff;
}

.project-panel {
  min-height: 220px;
  gap: 12px;
  overflow: hidden;
}

.board-topbar {
  gap: 10px;
}

.board-back,
.at-modify-btn {
  margin: 0;
  border: none;
  cursor: pointer;
}

.board-back {
  min-height: 44px;
  padding: 0 10px;
  gap: 6px;
  border-radius: 8px;
  background-color: var(--color-bg-surface);
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 700;
}

.board-back::after,
.at-modify-btn::after {
  border: none;
}

.board-back:hover,
.board-back:active {
  background-color: var(--color-bg-hover);
}

.board-status {
  min-height: 30px;
  padding: 0 9px;
  gap: 5px;
  border-radius: 999px;
  color: var(--color-primary);
  background-color: var(--color-primary-light);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.board-summary-card,
.inline-task-card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-bg-surface);
  box-sizing: border-box;
}

.board-summary-card {
  padding: 16px;
  gap: 10px;
}

.board-title {
  font-size: 17px;
  font-weight: 800;
  line-height: 1.35;
  color: var(--color-text-primary);
}

.board-desc {
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.board-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.board-stat {
  min-height: 56px;
  justify-content: center;
  align-items: center;
  border-radius: 8px;
  background-color: var(--color-bg-muted);
}

.stat-value {
  font-size: 18px;
  line-height: 1.2;
  font-weight: 800;
  color: var(--color-text-primary);
}

.stat-label {
  margin-top: 2px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.inline-task-list {
  gap: 12px;
}

.inline-task-card {
  padding: 14px;
  gap: 14px;
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.inline-task-card:hover,
.inline-task-card:active {
  border-color: var(--color-border-hover);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.07);
}

.task-head,
.task-footer {
  gap: 10px;
}

.agent-meta {
  min-width: 0;
  gap: 10px;
}

.agent-title {
  min-width: 0;
}

.agent-name {
  max-width: 150px;
  font-size: 14px;
  font-weight: 800;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-alias {
  margin-top: 2px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.task-status {
  min-height: 26px;
  padding: 0 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 800;
}

.task-status.doing {
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.task-status.review {
  color: #7c3aed;
  background-color: rgba(124, 58, 237, 0.1);
}

.task-status.blocked {
  color: var(--color-warning);
  background-color: rgba(249, 115, 22, 0.12);
}

.task-status.done {
  color: var(--color-success);
  background-color: rgba(16, 185, 129, 0.12);
}

.task-main {
  gap: 7px;
}

.task-title {
  font-size: 15px;
  font-weight: 800;
  line-height: 1.45;
  color: var(--color-text-primary);
}

.task-goal {
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.progress-block {
  gap: 7px;
}

.progress-top {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.progress-track {
  height: 7px;
  border-radius: 999px;
  overflow: hidden;
  background-color: var(--color-bg-muted);
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background-color: var(--color-primary);
}

.progress-fill.review {
  background-color: #7c3aed;
}

.progress-fill.blocked {
  background-color: var(--color-warning);
}

.progress-fill.done {
  background-color: var(--color-success);
}

.document-block {
  gap: 8px;
}

.document-title,
.log-count {
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.document-list {
  gap: 7px;
}

.document-row {
  min-height: 46px;
  gap: 8px;
  padding: 7px;
  border-radius: 8px;
  background-color: var(--color-bg-muted);
  box-sizing: border-box;
}

.doc-type {
  width: 40px;
  min-height: 24px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background-color: var(--color-bg-surface);
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 800;
}

.doc-meta {
  min-width: 0;
}

.doc-name,
.doc-summary {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-name {
  font-size: 12px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.doc-summary {
  margin-top: 2px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.empty-docs {
  font-size: 12px;
  color: var(--color-text-muted);
}

.task-footer {
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.log-count {
  min-width: 0;
  flex: 1;
}

.at-modify-btn {
  min-height: 44px;
  padding: 0 11px;
  gap: 5px;
  border-radius: 8px;
  background-color: var(--color-primary);
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.section-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-top: 12px;
  margin-bottom: 4px;
}

.section-type-badge {
  font-size: 11px;
  color: var(--color-text-secondary);
  background-color: var(--color-bg-base);
  padding: 2px 6px;
  border-radius: 4px;
}

.setting-row {
  margin-bottom: 16px;
}
.setting-row:last-child {
  margin-bottom: 0;
}

.setting-label {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 14px;
}

.shared-files-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shared-file-item {
  gap: 8px;
  cursor: pointer;
  padding: 4px 0;
}

.shared-file-name {
  font-size: 13px;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shared-file-size {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.empty-files-text {
  font-size: 13px;
  color: var(--color-text-muted);
}
</style>
