<template>
  <AppSubpageShell>
    <view class="agent-board-page flex-column flex-1">
      <view class="board-header flex-row align-center justify-between">
        <view class="header-left flex-row align-center">
          <view class="back-btn" @click="goBack">
            <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
          </view>
          <view class="title-stack flex-column">
            <text class="title">智能体看板</text>
            <text class="subtitle">按群聊归类查看任务、目标、文档与协作日志</text>
          </view>
        </view>
        <button class="header-action flex-row align-center gap-2" @click="goAgents">
          <AppIcon name="agents" :size="16" color="var(--color-primary)" />
          <text>智能体库</text>
        </button>
      </view>

      <scroll-view scroll-y class="board-scroll flex-1">
        <view class="board-content">
          <scroll-view scroll-x scroll-with-animation class="board-tabs-scroll" :scroll-left="tabsScrollLeft">
            <view class="board-tabs flex-row">
              <view
                v-for="board in boards"
                :key="board.id"
                class="board-tab"
                :class="{ active: activeBoardId === board.id }"
                @click="selectBoard(board.id)"
              >
                <view class="board-tab-icon">
                  <AppIcon name="group" :size="17" color="currentColor" />
                </view>
                <view class="board-tab-text flex-column">
                  <text class="board-tab-name">{{ board.groupName }}</text>
                  <text class="board-tab-meta">{{ board.tasks.length }} 个智能体任务</text>
                </view>
              </view>
            </view>
          </scroll-view>

          <view v-if="activeBoard" class="board-panel flex-column gap-4">
            <view class="board-summary flex-row align-center justify-between">
              <view class="summary-main flex-column">
                <text class="summary-title">{{ activeBoard.groupName }}</text>
                <text class="summary-desc">{{ activeBoard.summary }}</text>
              </view>
              <view class="summary-stats flex-row">
                <view class="stat-item flex-column align-center">
                  <text class="stat-value">{{ activeBoard.tasks.length }}</text>
                  <text class="stat-label">智能体</text>
                </view>
                <view class="stat-item flex-column align-center">
                  <text class="stat-value">{{ activeDocumentCount }}</text>
                  <text class="stat-label">文档</text>
                </view>
                <view class="stat-item flex-column align-center">
                  <text class="stat-value">{{ completedTaskCount }}</text>
                  <text class="stat-label">完成</text>
                </view>
              </view>
            </view>

            <view class="task-grid">
              <view
                v-for="task in activeTasks"
                :key="task.id"
                class="agent-task-card flex-column"
                @click="openLog(task)"
              >
                <view class="task-card-head flex-row align-center justify-between">
                  <view class="agent-meta flex-row align-center">
                    <AppAvatar :text="task.agent?.name || 'AI'" :src="task.agent?.avatar || ''" :size="44" :is-circle="false" />
                    <view class="agent-title flex-column">
                      <text class="agent-name">{{ task.agent?.name || '未知智能体' }}</text>
                      <text class="agent-alias">{{ task.agent?.alias || '@agent' }}</text>
                    </view>
                  </view>
                  <view class="status-pill" :class="task.status">
                    <text>{{ statusText(task.status) }}</text>
                  </view>
                </view>

                <view class="task-body flex-column">
                  <text class="task-title">{{ task.task }}</text>
                  <text class="task-goal">{{ task.goal }}</text>
                </view>

                <view class="progress-block flex-column">
                  <view class="progress-top flex-row align-center justify-between">
                    <text class="progress-label">目标进度</text>
                    <text class="progress-value">{{ task.progress }}%</text>
                  </view>
                  <view class="progress-track">
                    <view class="progress-fill" :class="task.status" :style="{ width: task.progress + '%' }" />
                  </view>
                </view>

                <view class="document-block flex-column">
                  <view class="section-label flex-row align-center gap-1">
                    <AppIcon name="files" :size="14" color="var(--color-text-secondary)" />
                    <text>产出文档</text>
                  </view>
                  <view class="document-list flex-column">
                    <view v-for="doc in task.documents" :key="doc.id" class="document-row flex-row align-center">
                      <view class="doc-type">{{ doc.type.toUpperCase() }}</view>
                      <view class="doc-meta flex-column flex-1">
                        <text class="doc-name">{{ doc.name }}</text>
                        <text class="doc-summary">{{ doc.summary }}</text>
                      </view>
                    </view>
                  </view>
                </view>

                <view class="task-footer flex-row align-center justify-between">
                  <view class="log-hint flex-row align-center gap-1">
                    <AppIcon name="clock" :size="14" color="var(--color-text-muted)" />
                    <text>{{ task.logs.length }} 条日志</text>
                  </view>
                  <button class="btn-at flex-row align-center justify-center gap-2" @click.stop="atModify(task)">
                    <AppIcon name="at" :size="15" color="#ffffff" />
                    <text>@他修改</text>
                  </button>
                </view>
              </view>
            </view>
          </view>

          <view v-else class="clowder-kanban-panel flex-column gap-3">
            <view class="kanban-panel-head flex-row align-center justify-between">
              <view class="flex-column">
                <text class="kanban-panel-title">Clowder 任务看板</text>
                <text class="kanban-panel-desc">{{ kanbanEmptyDescription }}</text>
              </view>
              <button class="header-action kanban-refresh flex-row align-center gap-2" title="刷新" @click="hydrateClowderTasks">
                <AppIcon name="refresh" :size="15" color="var(--color-primary)" />
                <text>刷新</text>
              </button>
            </view>

            <view class="kanban-grid">
              <view v-for="column in kanbanColumns" :key="column.key" class="kanban-column flex-column">
                <view class="kanban-column-head flex-row align-center justify-between">
                  <view class="flex-column">
                    <text class="kanban-column-title">{{ column.label }}</text>
                    <text class="kanban-key">{{ column.key }}</text>
                  </view>
                  <text class="kanban-count">{{ tasksByStatus(column.key).length }}</text>
                </view>
                <view class="kanban-card-list flex-column">
                  <view
                    v-for="task in tasksByStatus(column.key)"
                    :key="task.id"
                    class="kanban-task-card flex-column gap-1"
                  >
                    <text class="kanban-task-title">{{ task.title }}</text>
                    <text class="kanban-task-meta">{{ task.assignee || '未指派' }}</text>
                  </view>
                  <view v-if="tasksByStatus(column.key).length === 0" class="kanban-empty">
                    <text>暂无{{ column.label }}任务</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>

    </view>
  </AppSubpageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useAgentStore } from '@/stores/agent';
import { useClowderStore } from '@/stores/clowder';
import { useConversationStore } from '@/stores/conversation';
import { useMessageStore } from '@/stores/message';
import { useNavigationStore } from '@/stores/navigation';
import AppSubpageShell from '@/components/layout/AppSubpageShell.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';
import AppEmptyState from '@/components/common/AppEmptyState.vue';

const agentStore = useAgentStore();
const clowderStore = useClowderStore();
const convStore = useConversationStore();
const messageStore = useMessageStore();
const navStore = useNavigationStore();

const activeBoardId = ref('');
const activeThreadId = ref('');
const clowderTasks = ref([]);

const kanbanColumns = [
  { key: 'todo', label: '待办' },
  { key: 'doing', label: '进行中' },
  { key: 'blocked', label: '阻塞' },
  { key: 'done', label: '完成' }
];

const boards = computed(() => agentStore.boards || []);

const activeBoard = computed(() => {
  return boards.value.find(board => board.id === activeBoardId.value) || boards.value[0] || null;
});

const activeBoardIndex = computed(() => {
  return Math.max(0, boards.value.findIndex(board => board.id === activeBoardId.value));
});

const tabsScrollLeft = computed(() => {
  return activeBoardIndex.value * 246;
});

const activeTasks = computed(() => {
  if (!activeBoard.value) return [];
  return activeBoard.value.tasks.map(task => ({
    ...task,
    board: activeBoard.value,
    agent: agentStore.agents.find(agent => agent.id === task.agentId) || null
  }));
});

const activeDocumentCount = computed(() => {
  return activeTasks.value.reduce((total, task) => total + task.documents.length, 0);
});

const completedTaskCount = computed(() => {
  return activeTasks.value.filter(task => task.status === 'done').length;
});

const clowderKanbanTasks = computed(() => clowderTasks.value.map(normalizeTaskForKanban));

const kanbanTasks = computed(() => {
  if (activeTasks.value.length > 0) return activeTasks.value.map(normalizeTaskForKanban);
  return clowderKanbanTasks.value;
});

const kanbanEmptyDescription = computed(() => {
  if (activeThreadId.value) return `thread ${activeThreadId.value} 当前暂无任务，四态列已就绪`;
  return '尚未绑定 Clowder thread，四态列保持可见以等待任务同步';
});

onMounted(() => {
  navStore.setActiveModule('agents');
  activeBoardId.value = resolveInitialBoardId();
  hydrateClowderTasks();
});

function selectBoard(id) {
  activeBoardId.value = id;
}

function statusText(status) {
  const map = {
    todo: '待办',
    doing: '进行中',
    review: '进行中',
    blocked: '阻塞',
    done: '已完成'
  };
  return map[status] || '进行中';
}

function normalizeTaskForKanban(task = {}) {
  const rawStatus = String(task.status || task.state || 'todo').toLowerCase();
  const status = ['todo', 'doing', 'blocked', 'done'].includes(rawStatus)
    ? rawStatus
    : rawStatus === 'review'
      ? 'doing'
      : 'todo';
  return {
    id: task.id || task.taskId || task.task_id || `${status}-${task.title || task.task || task.goal || 'unnamed-task'}`,
    title: task.title || task.task || task.goal || '未命名任务',
    assignee: task.assignee || task.assigneeName || task.agent?.name || task.agentName || task.agentId || '',
    status
  };
}

function tasksByStatus(status) {
  return kanbanTasks.value.filter(task => task.status === status);
}

async function hydrateClowderTasks() {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage?.$page?.options || {};
  const explicitThreadId = safeDecode(options.threadId || options.thread_id || '');

  try {
    let threadId = explicitThreadId;
    if (!threadId) {
      const activeGroup = await clowderStore.fetchActiveProjectGroup({}).catch(() => null);
      threadId = activeGroup?.projectThreadId || activeGroup?.project_thread_id || activeGroup?.threadId || activeGroup?.thread_id || '';
    }
    activeThreadId.value = threadId || '';
    if (!threadId) {
      clowderTasks.value = [];
      return;
    }
    clowderTasks.value = await clowderStore.fetchThreadTasks(threadId);
  } catch (err) {
    clowderTasks.value = [];
  }
}

function resolveInitialBoardId() {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const options = currentPage?.$page?.options || {};
  const boardId = safeDecode(options.boardId || '');
  if (boardId && boards.value.some(board => board.id === boardId)) return boardId;
  const groupId = safeDecode(options.groupId || '');
  const boardByGroup = boards.value.find(board => board.groupId === groupId);
  return boardByGroup?.id || boards.value[0]?.id || '';
}

function safeDecode(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function openLog(task) {
  const board = task.board || activeBoard.value;
  if (!board) return;
  uni.navigateTo({
    url: `/pages/agents/log?boardId=${encodeURIComponent(board.id)}&taskId=${encodeURIComponent(task.id)}`
  });
}

function atModify(task) {
  const board = task.board || activeBoard.value;
  if (!board) return;
  ensureGroupConversation(board, task);
  const alias = task.agent?.alias || `@${task.agent?.name || '智能体'}`;
  const mentionText = `${alias} 请修改「${task.task}」：${task.modifyHint}`;
  const currentDraft = convStore.conversations.find(conv => conv.id === board.groupId)?.draft || '';
  const spacer = currentDraft && !currentDraft.endsWith('\n') ? '\n' : '';
  convStore.updateConversationDraft(board.groupId, `${currentDraft}${spacer}${mentionText}`);
  convStore.setActiveId(board.groupId);
  uni.setStorageSync('active_conversation_id', board.groupId);
  uni.navigateTo({
    url: `/pages/chat/detail?id=${encodeURIComponent(board.groupId)}`
  });
}

function ensureGroupConversation(board, task) {
  let conv = convStore.conversations.find(item => item.id === board.groupId);
  if (!conv) {
    conv = {
      id: board.groupId,
      name: board.groupName,
      avatar: '',
      type: 'group',
      unread: 0,
      memberCount: board.memberCount,
      lastMessage: `${task.agent?.name || '智能体'} 需要修改：${task.task}`,
      lastTime: Date.now(),
      isPinned: false,
      isMuted: false,
      draft: ''
    };
    convStore.conversations.unshift(conv);
  } else {
    conv.type = 'group';
    conv.memberCount = conv.memberCount || board.memberCount;
    conv.lastMessage = `${task.agent?.name || '智能体'} 需要修改：${task.task}`;
    conv.lastTime = Date.now();
  }

  if (!messageStore.messages[board.groupId]) {
    messageStore.messages[board.groupId] = [];
  }
}

function goBack() {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
    return;
  }
  uni.redirectTo({ url: '/pages/agents/index' });
}

function goAgents() {
  uni.redirectTo({ url: '/pages/agents/index' });
}
</script>

<style scoped>
.agent-board-page {
  height: 100%;
  background-color: var(--color-bg-base);
}

.board-header {
  min-height: 64px;
  padding: 0 24px;
  background-color: var(--color-glass-bg);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--color-border);
  box-sizing: border-box;
  flex-shrink: 0;
}

.header-left {
  min-width: 0;
  gap: 14px;
}

.back-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background-color: var(--color-bg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.back-btn:hover,
.back-btn:active {
  background-color: var(--color-bg-hover);
}

.title-stack {
  min-width: 0;
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.25;
}

.subtitle {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.header-action {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  margin: 0;
  cursor: pointer;
}

.header-action::after,
.btn-at::after {
  border: none;
}

.board-scroll {
  height: 100%;
}

.board-content {
  padding: 20px 32px 32px;
  box-sizing: border-box;
  min-height: 100%;
}

.board-tabs-scroll {
  width: 100%;
  white-space: nowrap;
  margin-bottom: 18px;
}

.board-tabs {
  display: inline-flex;
  gap: 10px;
  min-width: 100%;
}

.board-tab {
  min-width: 240px;
  min-height: 64px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  cursor: pointer;
}

.board-tab.active {
  border-color: rgba(0, 74, 198, 0.26);
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}

.board-tab-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-muted);
  flex-shrink: 0;
}

.board-tab.active .board-tab-icon {
  background-color: rgba(255, 255, 255, 0.72);
}

.board-tab-text {
  min-width: 0;
}

.board-tab-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.board-tab-meta {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.board-panel {
  display: flex;
}

.board-summary {
  min-height: 96px;
  padding: 18px 20px;
  border-radius: 8px;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  box-sizing: border-box;
  display: flex;
  gap: 18px;
}

.summary-main {
  min-width: 0;
  flex: 1;
}

.summary-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.summary-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-top: 6px;
}

.summary-stats {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.stat-item {
  width: 72px;
  min-height: 58px;
  border-radius: 8px;
  background-color: var(--color-bg-muted);
  display: flex;
  justify-content: center;
}

.stat-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.stat-label {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.agent-task-card {
  min-height: 360px;
  padding: 18px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.agent-task-card:hover {
  border-color: var(--color-border-hover);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.clowder-kanban-panel {
  padding: 18px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  box-sizing: border-box;
}

.kanban-panel-head {
  gap: 12px;
}

.kanban-panel-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.kanban-panel-desc {
  margin-top: 3px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.45;
}

.kanban-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.kanban-column {
  min-height: 260px;
  min-width: 0;
  padding: 12px;
  border-radius: 8px;
  background-color: var(--color-bg-muted);
  border: 1px solid var(--color-border);
  box-sizing: border-box;
}

.kanban-column-head {
  gap: 8px;
  margin-bottom: 10px;
}

.kanban-column-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.kanban-key {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.kanban-count {
  min-width: 26px;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background-color: var(--color-bg-surface);
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  box-sizing: border-box;
}

.kanban-card-list {
  gap: 8px;
}

.kanban-task-card,
.kanban-empty {
  min-height: 68px;
  padding: 10px;
  border-radius: 8px;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  box-sizing: border-box;
}

.kanban-task-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.4;
  word-break: break-word;
}

.kanban-task-meta,
.kanban-empty {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.task-card-head {
  display: flex;
  gap: 12px;
}

.agent-meta {
  min-width: 0;
  gap: 10px;
}

.agent-title {
  min-width: 0;
}

.agent-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-alias {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.status-pill {
  min-height: 26px;
  padding: 0 9px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.status-pill.doing {
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.status-pill.review {
  color: #7c3aed;
  background-color: rgba(124, 58, 237, 0.1);
}

.status-pill.blocked {
  color: var(--color-warning);
  background-color: rgba(249, 115, 22, 0.12);
}

.status-pill.done {
  color: var(--color-success);
  background-color: rgba(16, 185, 129, 0.12);
}

.task-body {
  margin-top: 18px;
  gap: 8px;
}

.task-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.4;
}

.task-goal {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}

.progress-block {
  margin-top: 16px;
  gap: 8px;
}

.progress-label,
.progress-value {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 700;
}

.progress-track {
  height: 8px;
  border-radius: 999px;
  background-color: var(--color-bg-muted);
  overflow: hidden;
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
  margin-top: 18px;
  gap: 8px;
  flex: 1;
}

.section-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 700;
  display: flex;
}

.document-list {
  gap: 8px;
}

.document-row {
  min-height: 48px;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  background-color: var(--color-bg-muted);
  box-sizing: border-box;
}

.doc-type {
  width: 42px;
  min-height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-surface);
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 800;
  flex-shrink: 0;
}

.doc-meta {
  min-width: 0;
}

.doc-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-summary {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-footer {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border);
  display: flex;
  gap: 12px;
}

.log-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 700;
  display: flex;
}

.btn-at {
  min-height: 44px;
  padding: 0 13px;
  border-radius: 8px;
  border: none;
  background-color: var(--color-primary);
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  margin: 0;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 74, 198, 0.16);
}

.gap-1 {
  gap: 4px;
}

.gap-2 {
  gap: 6px;
}

.gap-4 {
  gap: 16px;
}

@media (max-width: 1280px) {
  .task-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .board-header {
    min-height: 64px;
    padding: 0 16px;
  }

  .subtitle {
    display: none;
  }

  .header-action {
    width: 44px;
    min-width: 44px;
    padding: 0;
    justify-content: center;
  }

  .header-action text {
    display: none;
  }

  .board-content {
    padding: 14px;
  }

  .board-tab {
    min-width: 236px;
  }

  .board-summary {
    flex-direction: column;
    align-items: stretch;
    padding: 16px;
  }

  .summary-stats {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .stat-item {
    width: auto;
  }

  .task-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .kanban-panel-head {
    align-items: flex-start;
  }

  .kanban-panel-head > .flex-column {
    min-width: 0;
  }

  .kanban-refresh {
    flex-shrink: 0;
  }

  .kanban-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .kanban-column {
    min-height: 176px;
    padding: 10px;
  }

  .kanban-empty {
    min-height: 56px;
  }

  .agent-task-card {
    min-height: 0;
    padding: 16px;
  }

  .task-footer {
    align-items: stretch;
  }

  .btn-at {
    flex: 0 0 auto;
  }
}

@media (max-width: 420px) {
  .summary-title {
    font-size: 17px;
  }

  .task-card-head,
  .task-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .status-pill {
    align-self: flex-start;
  }

  .btn-at {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 360px) {
  .kanban-grid {
    grid-template-columns: 1fr;
  }
}
</style>
