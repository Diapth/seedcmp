<script setup lang="ts">
defineOptions({ name: 'CoordinatorSummaryCard' });

interface CoordinatorSummarySubtaskView {
  id: string;
  title: string;
  targetCatId?: string;
  targetName?: string;
  status: string;
  result?: string;
  failureReason?: string;
  artifactRefs?: readonly string[];
}

interface CoordinatorSummaryView {
  coordinationId?: string;
  status: string;
  goal?: string;
  aggregateSummary?: string;
  failureReason?: string;
  conflict?: boolean;
  targetCatIds?: readonly string[];
  subtasks?: readonly CoordinatorSummarySubtaskView[];
}

const props = defineProps<{
  summary: CoordinatorSummaryView;
  busyAction?: 'redispatch' | 'cancel' | '';
}>();

const emit = defineEmits<{
  (event: 'redispatch', summary: CoordinatorSummaryView): void;
  (event: 'cancel', summary: CoordinatorSummaryView): void;
}>();

function statusText(statusValue: string) {
  const labels: Record<string, string> = {
    planning: '规划中',
    dispatching: '派发中',
    running: '执行中',
    aggregating: '汇总中',
    succeeded: '已完成',
    failed: '失败',
    cancelled: '已取消',
    timeout: '超时',
    partial: '部分完成',
    todo: '待办',
    doing: '进行中',
    blocked: '阻塞',
    done: '完成',
  };
  return labels[statusValue] || statusValue;
}

function statusTone(statusValue: string) {
  if (['succeeded', 'done'].includes(statusValue)) return 'success';
  if (['failed', 'blocked', 'cancelled', 'timeout'].includes(statusValue)) return 'danger';
  if (['dispatching', 'running', 'aggregating', 'doing', 'partial'].includes(statusValue)) return 'active';
  return 'neutral';
}

function shortId(value?: string) {
  if (!value) return '未绑定';
  return value.length > 20 ? `${value.slice(0, 9)}…${value.slice(-6)}` : value;
}

function canCancel() {
  return Boolean(props.summary.coordinationId && !['succeeded', 'failed', 'cancelled'].includes(props.summary.status));
}
</script>

<template>
  <section class="coordinator-summary" data-testid="coordinator-summary-card">
    <header class="coordinator-summary__head">
      <div class="coordinator-summary__title">
        <span class="coordinator-summary__eyebrow">Coordinator</span>
        <strong>{{ shortId(summary.coordinationId) }}</strong>
      </div>
      <span class="coordinator-summary__status" :data-tone="statusTone(summary.status)">
        {{ statusText(summary.status) }}
      </span>
    </header>

    <p v-if="summary.goal" class="coordinator-summary__goal">{{ summary.goal }}</p>
    <p v-if="summary.aggregateSummary" class="coordinator-summary__result">{{ summary.aggregateSummary }}</p>
    <p v-if="summary.failureReason" class="coordinator-summary__warning">{{ summary.failureReason }}</p>
    <p v-if="summary.conflict" class="coordinator-summary__warning">检测到可能的产物或路径冲突，请先查看分工结果。</p>

    <ul v-if="summary.subtasks?.length" class="coordinator-summary__subtasks">
      <li
        v-for="subtask in summary.subtasks"
        :key="subtask.id"
        class="coordinator-summary__subtask"
      >
        <div class="coordinator-summary__subtask-line">
          <span class="coordinator-summary__subtask-title">{{ subtask.title }}</span>
          <span class="coordinator-summary__status" :data-tone="statusTone(subtask.status)">
            {{ statusText(subtask.status) }}
          </span>
        </div>
        <div class="coordinator-summary__meta">
          <span>{{ subtask.targetName || subtask.targetCatId || '未分配' }}</span>
          <span v-if="subtask.artifactRefs?.length">artifacts {{ subtask.artifactRefs.length }}</span>
        </div>
        <p v-if="subtask.result" class="coordinator-summary__subtask-text">{{ subtask.result }}</p>
        <p v-if="subtask.failureReason" class="coordinator-summary__warning">{{ subtask.failureReason }}</p>
      </li>
    </ul>

    <footer class="coordinator-summary__actions">
      <button
        type="button"
        class="coordinator-summary__action"
        :disabled="!summary.coordinationId || busyAction === 'redispatch'"
        @click="emit('redispatch', summary)"
      >
        {{ busyAction === 'redispatch' ? '派发中…' : '重新派发' }}
      </button>
      <button
        type="button"
        class="coordinator-summary__action coordinator-summary__action--danger"
        :disabled="!canCancel() || busyAction === 'cancel'"
        @click="emit('cancel', summary)"
      >
        {{ busyAction === 'cancel' ? '取消中…' : '取消' }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.coordinator-summary {
  width: min(560px, 100%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.coordinator-summary__head,
.coordinator-summary__subtask-line,
.coordinator-summary__actions,
.coordinator-summary__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.coordinator-summary__head,
.coordinator-summary__subtask-line {
  justify-content: space-between;
}

.coordinator-summary__title {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.coordinator-summary__title strong,
.coordinator-summary__subtask-title {
  min-width: 0;
  overflow-wrap: anywhere;
}

.coordinator-summary__eyebrow,
.coordinator-summary__meta {
  color: var(--text-secondary);
  font-size: 11px;
}

.coordinator-summary__status {
  flex-shrink: 0;
  min-height: 22px;
  display: inline-flex;
  align-items: center;
  padding: 0 7px;
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1;
}

.coordinator-summary__status[data-tone='active'] {
  background: rgba(22, 93, 255, 0.1);
  color: var(--primary-color, #165dff);
}

.coordinator-summary__status[data-tone='success'] {
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
}

.coordinator-summary__status[data-tone='danger'] {
  background: rgba(180, 35, 24, 0.1);
  color: #b42318;
}

.coordinator-summary__goal,
.coordinator-summary__result,
.coordinator-summary__subtask-text,
.coordinator-summary__warning {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.coordinator-summary__result,
.coordinator-summary__subtask-text {
  color: var(--text-secondary);
}

.coordinator-summary__warning {
  color: #b42318;
}

.coordinator-summary__subtasks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.coordinator-summary__subtask {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
}

.coordinator-summary__subtask-title {
  font-size: 12px;
  font-weight: 600;
}

.coordinator-summary__actions {
  flex-wrap: wrap;
}

.coordinator-summary__action {
  min-height: 30px;
  padding: 0 10px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
}

.coordinator-summary__action--danger {
  color: #b42318;
}

.coordinator-summary__action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
