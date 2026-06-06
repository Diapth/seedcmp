<template>
  <AppSubpageShell>
    <view class="agent-log-page flex-column flex-1">
      <view class="log-header flex-row align-center justify-between">
        <view class="header-left flex-row align-center">
          <view class="back-btn" @click="goBack">
            <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
          </view>
          <view class="title-stack flex-column">
            <text class="title">{{ pageTitle }}</text>
            <text class="subtitle">{{ pageSubtitle }}</text>
          </view>
        </view>
        <button class="header-action flex-row align-center gap-2" @click="goBoard">
          <AppIcon name="briefcase" :size="16" color="var(--color-primary)" />
          <text>返回看板</text>
        </button>
      </view>

      <scroll-view scroll-y class="log-scroll flex-1">
        <view v-if="taskContext" class="log-content flex-column">
          <view class="overview-panel flex-row align-center justify-between">
            <view class="agent-main flex-row align-center">
              <AppAvatar :text="taskContext.agent?.name || 'AI'" :src="taskContext.agent?.avatar || ''" :size="52" :is-circle="false" />
              <view class="agent-text flex-column">
                <text class="agent-name">{{ taskContext.agent?.name || '未知智能体' }}</text>
                <text class="agent-meta">{{ taskContext.board.groupName }} / {{ taskContext.agent?.alias || '@agent' }}</text>
              </view>
            </view>
            <view class="status-wrap flex-row align-center">
              <view class="status-pill" :class="taskContext.status">
                <text>{{ statusText(taskContext.status) }}</text>
              </view>
              <view class="progress-mini flex-column">
                <text class="progress-value">{{ taskContext.progress }}%</text>
                <view class="progress-track">
                  <view class="progress-fill" :class="taskContext.status" :style="{ width: taskContext.progress + '%' }" />
                </view>
              </view>
            </view>
          </view>

          <view class="context-grid">
            <view class="context-panel flex-column">
              <view class="section-title flex-row align-center gap-2">
                <AppIcon name="flag" :size="16" color="var(--color-primary)" />
                <text>任务目标</text>
              </view>
              <text class="task-title">{{ taskContext.task }}</text>
              <text class="task-goal">{{ taskContext.goal }}</text>
            </view>

            <view class="context-panel flex-column">
              <view class="section-title flex-row align-center gap-2">
                <AppIcon name="files" :size="16" color="var(--color-primary)" />
                <text>产出文档</text>
              </view>
              <view class="doc-list flex-column">
                <view v-for="doc in taskContext.documents" :key="doc.id" class="doc-row flex-row align-center">
                  <view class="doc-type">{{ doc.type.toUpperCase() }}</view>
                  <view class="doc-meta flex-column flex-1">
                    <text class="doc-name">{{ doc.name }}</text>
                    <text class="doc-summary">{{ doc.summary }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>

          <view class="console-panel flex-column">
            <view class="console-toolbar flex-row align-center justify-between">
              <view class="console-title flex-row align-center gap-2">
                <AppIcon name="code" :size="16" color="#e2e8f0" />
                <text>Console</text>
              </view>
              <text class="console-meta">{{ taskContext.id }} · {{ taskContext.logs.length }} entries</text>
            </view>
            <view class="console-output flex-column">
              <view v-for="line in consoleRows" :key="line.id" class="console-line" :class="line.level">
                <text class="console-prefix">{{ line.prefix }}</text>
                <text class="console-message" selectable>{{ line.message }}</text>
              </view>
            </view>
          </view>
        </view>

        <view v-else class="empty-wrap">
          <AppEmptyState
            icon="agents"
            title="未找到日志"
            description="当前任务日志不存在，可能是看板或任务参数已变更"
          >
            <button class="empty-action" @click="goBoard">返回智能体看板</button>
          </AppEmptyState>
        </view>
      </scroll-view>
    </view>
  </AppSubpageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useAgentStore } from '@/stores/agent';
import { useNavigationStore } from '@/stores/navigation';
import AppSubpageShell from '@/components/layout/AppSubpageShell.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';
import AppEmptyState from '@/components/common/AppEmptyState.vue';

const agentStore = useAgentStore();
const navStore = useNavigationStore();

const boardId = ref('');
const taskId = ref('');

const taskContext = computed(() => {
  const board = agentStore.boards.find(item => item.id === boardId.value);
  if (!board) return null;
  const task = board.tasks.find(item => item.id === taskId.value);
  if (!task) return null;
  return {
    ...task,
    board,
    agent: agentStore.agents.find(agent => agent.id === task.agentId) || null
  };
});

const pageTitle = computed(() => {
  if (!taskContext.value) return '智能体日志';
  return `${taskContext.value.agent?.name || '智能体'} · Console 日志`;
});

const pageSubtitle = computed(() => {
  if (!taskContext.value) return '查看智能体在群聊任务中的完整输出';
  return taskContext.value.task;
});

const consoleRows = computed(() => {
  if (!taskContext.value) return [];
  const task = taskContext.value;
  const agentName = task.agent?.name || 'unknown-agent';
  const alias = task.agent?.alias || '@agent';
  const rows = [
    {
      id: 'boot',
      level: 'system',
      prefix: 'agenthub$',
      message: `open --board "${task.board.groupName}" --task "${task.id}"`
    },
    {
      id: 'attach',
      level: 'info',
      prefix: '[system] INFO',
      message: `attached ${agentName} ${alias}; status=${statusText(task.status)}; progress=${task.progress}%`
    },
    {
      id: 'goal',
      level: 'info',
      prefix: '[goal] INFO',
      message: task.goal
    }
  ];

  task.documents.forEach((doc, index) => {
    rows.push({
      id: `doc-${doc.id || index}`,
      level: 'doc',
      prefix: '[doc] INFO',
      message: `${doc.type.toUpperCase()} ${doc.name} - ${doc.summary}`
    });
  });

  task.logs.forEach((log, index) => {
    rows.push({
      id: `log-${index}-${log.time}`,
      level: task.status === 'blocked' && index === task.logs.length - 1 ? 'warn' : 'info',
      prefix: `[${log.time}] ${task.status === 'blocked' && index === task.logs.length - 1 ? 'WARN' : 'INFO'}`,
      message: `${log.title}\n${log.detail}`
    });
  });

  rows.push({
    id: 'summary',
    level: task.status === 'done' ? 'success' : 'system',
    prefix: '[summary]',
    message: `console output loaded: ${task.logs.length} logs, ${task.documents.length} documents`
  });

  return rows;
});

onMounted(() => {
  navStore.setActiveModule('agents');
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  boardId.value = decodeURIComponent(currentPage?.$page?.options?.boardId || '');
  taskId.value = decodeURIComponent(currentPage?.$page?.options?.taskId || '');
});

function statusText(status) {
  const map = {
    doing: '进行中',
    review: '待验收',
    blocked: '需修改',
    done: '已完成'
  };
  return map[status] || '进行中';
}

function goBack() {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
    return;
  }
  goBoard();
}

function goBoard() {
  uni.redirectTo({ url: '/pages/agents/board' });
}
</script>

<style scoped>
.agent-log-page {
  height: 100%;
  background-color: var(--color-bg-base);
}

.log-header {
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  flex-shrink: 0;
}

.header-action::after,
.empty-action::after {
  border: none;
}

.log-scroll {
  height: 100%;
}

.log-content {
  padding: 20px 32px 32px;
  box-sizing: border-box;
  gap: 16px;
}

.overview-panel,
.context-panel,
.console-panel {
  border-radius: 8px;
  border: 1px solid var(--color-border);
  box-sizing: border-box;
}

.overview-panel {
  min-height: 96px;
  padding: 18px 20px;
  background-color: var(--color-bg-surface);
  display: flex;
  gap: 18px;
}

.agent-main {
  gap: 12px;
  min-width: 0;
}

.agent-text {
  min-width: 0;
}

.agent-name {
  font-size: 17px;
  font-weight: 800;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-wrap {
  gap: 14px;
  flex-shrink: 0;
}

.status-pill {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
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

.progress-mini {
  width: 120px;
  gap: 6px;
}

.progress-value {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 800;
  text-align: right;
}

.progress-track {
  height: 7px;
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

.context-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr);
  gap: 16px;
}

.context-panel {
  padding: 18px;
  background-color: var(--color-bg-surface);
  gap: 10px;
}

.section-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--color-text-primary);
  display: flex;
}

.task-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-text-primary);
  line-height: 1.4;
}

.task-goal {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.doc-list {
  gap: 8px;
}

.doc-row {
  min-height: 48px;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  background-color: var(--color-bg-muted);
  box-sizing: border-box;
}

.doc-type {
  width: 46px;
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
  font-weight: 800;
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

.console-panel {
  background-color: #0f172a;
  border-color: rgba(15, 23, 42, 0.92);
  overflow: hidden;
}

.console-toolbar {
  min-height: 48px;
  padding: 0 16px;
  background-color: #111827;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  box-sizing: border-box;
  display: flex;
  gap: 12px;
}

.console-title {
  display: flex;
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 800;
}

.console-meta {
  color: #94a3b8;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
}

.console-output {
  padding: 16px;
  gap: 10px;
}

.console-line {
  display: grid;
  grid-template-columns: 148px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
}

.console-prefix {
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.55;
  white-space: nowrap;
}

.console-message {
  color: #dbeafe;
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.console-line.system .console-message,
.console-line.system .console-prefix {
  color: #cbd5e1;
}

.console-line.doc .console-prefix {
  color: #93c5fd;
}

.console-line.warn .console-prefix,
.console-line.warn .console-message {
  color: #fdba74;
}

.console-line.success .console-prefix,
.console-line.success .console-message {
  color: #86efac;
}

.empty-wrap {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-action {
  min-height: 44px;
  padding: 0 16px;
  border-radius: 8px;
  background-color: var(--color-primary);
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
}

.gap-2 {
  gap: 6px;
}

@media (max-width: 960px) {
  .context-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .log-header {
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

  .log-content {
    padding: 14px;
  }

  .overview-panel {
    flex-direction: column;
    align-items: stretch;
    padding: 16px;
  }

  .status-wrap {
    width: 100%;
    justify-content: space-between;
  }

  .progress-mini {
    flex: 1;
  }

  .context-panel {
    padding: 16px;
  }

  .console-toolbar {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
    padding: 10px 14px;
    gap: 4px;
  }

  .console-output {
    padding: 14px;
  }

  .console-line {
    grid-template-columns: 1fr;
    gap: 2px;
  }

  .console-prefix {
    white-space: normal;
  }
}

@media (max-width: 420px) {
  .agent-main {
    align-items: flex-start;
  }

  .agent-name {
    white-space: normal;
  }

  .status-wrap {
    flex-direction: column;
    align-items: stretch;
  }

  .status-pill {
    align-self: flex-start;
  }
}
</style>
