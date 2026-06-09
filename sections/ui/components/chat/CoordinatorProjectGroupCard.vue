<template>
  <view class="project-card" data-testid="project-group-confirmation-card">
    <view class="project-card-head">
      <view class="project-card-title-wrap">
        <text class="project-card-kicker">Coordinator</text>
        <text class="project-card-title">建议创建项目群</text>
      </view>
      <text class="project-card-status" :data-status="cardStatus">{{ statusText }}</text>
    </view>

    <view class="project-card-body">
      <view class="project-card-row">
        <text class="project-card-label">项目</text>
        <text class="project-card-value">{{ projectName }}</text>
      </view>
      <view class="project-card-row">
        <text class="project-card-label">成员</text>
        <text class="project-card-value">{{ memberSummary }}</text>
      </view>
      <text class="project-card-note">仅把当前任务说明和明确项目上下文带入项目群。</text>
      <text v-if="cardStatus === 'failed'" class="project-card-error">{{ errorText }}</text>
    </view>

    <view class="project-card-actions">
      <button
        v-if="cardStatus === 'pending_confirmation'"
        class="project-card-btn secondary"
        @click.stop="$emit('cancel', { card, message })"
      >取消</button>
      <button
        v-if="cardStatus === 'pending_confirmation'"
        class="project-card-btn primary"
        @click.stop="$emit('confirm', { card, message })"
      >确认创建</button>
      <button
        v-if="cardStatus === 'failed'"
        class="project-card-btn primary"
        @click.stop="$emit('retry', { card, message })"
      >重试</button>
      <button
        v-if="cardStatus === 'created'"
        class="project-card-btn primary"
        @click.stop="$emit('open', { card, message })"
      >打开项目群</button>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  card: {
    type: Object,
    required: true
  },
  message: {
    type: Object,
    default: () => ({})
  }
});

defineEmits(['confirm', 'cancel', 'retry', 'open']);

const cardStatus = computed(() => props.card.status || 'pending_confirmation');
const projectName = computed(() => props.card.projectName || props.card.projectGroupName || 'Clowder 项目群');
const memberSummary = computed(() => {
  const cats = props.card.workerCatIds || props.card.targetCatIds || [];
  const names = cats.length ? cats.join('、') : '暂无可用执行智能体';
  return `你、${props.card.coordinator?.name || 'PM'}、${names}`;
});
const statusText = computed(() => {
  if (cardStatus.value === 'creating') return '创建中';
  if (cardStatus.value === 'created') return props.card.reused ? '已复用' : '已创建';
  if (cardStatus.value === 'cancelled') return '已取消';
  if (cardStatus.value === 'failed') return '失败';
  return '待确认';
});
const errorText = computed(() => props.card.error || '创建项目群失败，请重试。');
</script>

<style scoped>
.project-card {
  width: min(100%, 520px);
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-surface);
  overflow: hidden;
}

.project-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
}

.project-card-title-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.project-card-kicker {
  font-size: 11px;
  line-height: 16px;
  color: var(--color-text-muted);
}

.project-card-title {
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.project-card-status {
  flex-shrink: 0;
  min-width: 48px;
  text-align: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 18px;
  color: var(--color-primary);
  background: rgba(0, 74, 198, 0.08);
}

.project-card-status[data-status="failed"] {
  color: var(--color-error);
  background: rgba(220, 38, 38, 0.08);
}

.project-card-status[data-status="created"] {
  color: var(--color-success);
  background: rgba(22, 163, 74, 0.1);
}

.project-card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
}

.project-card-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.project-card-label {
  font-size: 12px;
  line-height: 20px;
  color: var(--color-text-muted);
}

.project-card-value,
.project-card-note,
.project-card-error {
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-primary);
  min-width: 0;
  word-break: break-word;
}

.project-card-note {
  color: var(--color-text-secondary);
}

.project-card-error {
  color: var(--color-error);
}

.project-card-actions {
  display: flex;
  gap: 8px;
  padding: 0 14px 14px;
}

.project-card-btn {
  min-height: 44px;
  flex: 1;
  margin: 0;
  border-radius: 6px;
  font-size: 14px;
  line-height: 44px;
}

.project-card-btn::after {
  border: none;
}

.project-card-btn.primary {
  color: #ffffff;
  background: var(--color-primary);
}

.project-card-btn.secondary {
  color: var(--color-text-primary);
  background: var(--color-bg-muted);
}

@media (max-width: 480px) {
  .project-card {
    width: 100%;
  }

  .project-card-actions {
    flex-direction: column;
  }
}
</style>
