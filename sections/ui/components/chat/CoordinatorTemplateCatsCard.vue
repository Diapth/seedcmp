<template>
  <view class="tc-card" data-testid="coordinator-template-cats-card">
    <view class="tc-card-head">
      <view class="tc-card-title-wrap">
        <text class="tc-card-kicker">Coordinator</text>
        <text class="tc-card-title">缺失模板猫猫盘点</text>
        <text class="tc-card-subtitle">{{ profileLabel }}</text>
      </view>
      <text class="tc-card-status" :data-status="cardStatus">{{ statusText }}</text>
    </view>

    <view class="tc-card-body">
      <view v-if="reusable.length" class="tc-card-row">
        <text class="tc-card-label">已有可复用</text>
        <text class="tc-card-value">{{ reusableSummary }}</text>
      </view>
      <view class="tc-card-row">
        <text class="tc-card-label">缺失模板</text>
        <text class="tc-card-value">{{ missingSummary }}</text>
      </view>
      <view class="tc-card-row">
        <text class="tc-card-label">认证继承</text>
        <text class="tc-card-value">{{ authSummary }}</text>
      </view>

      <view class="tc-item-list">
        <view
          v-for="item in items"
          :key="item.templateId"
          class="tc-item"
          :data-status="item.status"
        >
          <view class="tc-item-head">
            <text class="tc-item-name">{{ item.name || item.templateId }}</text>
            <text class="tc-item-status">{{ itemStatusText(item) }}</text>
          </view>
          <text v-if="item.reason" class="tc-item-reason">{{ item.reason }}</text>
          <text v-if="item.error" class="tc-item-error">{{ item.error }}</text>
        </view>
      </view>

      <text v-if="cardStatus === 'failed' && card.error" class="tc-card-error">{{ card.error }}</text>
    </view>

    <view class="tc-card-actions">
      <button
        v-if="cardStatus === 'pending_confirmation'"
        class="tc-card-btn secondary"
        @click.stop="$emit('cancel', { card, message })"
      >取消</button>
      <button
        v-if="cardStatus === 'pending_confirmation'"
        class="tc-card-btn primary"
        @click.stop="$emit('confirm', { card, message })"
      >确认创建</button>
      <button
        v-if="cardStatus === 'failed' || cardStatus === 'partial'"
        class="tc-card-btn primary"
        @click.stop="$emit('retry', { card, message })"
      >重试</button>
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

defineEmits(['confirm', 'cancel', 'retry']);

const cardStatus = computed(() => props.card.status || 'pending_confirmation');
const profileLabel = computed(() => props.card.requiredProfile?.label || props.card.requiredProfile?.id || '协调者能力盘点');
const items = computed(() => props.card.items || []);
const reusable = computed(() => props.card.reusableCats || []);
const reusableSummary = computed(() => reusable.value.map((cat) => cat.name).filter(Boolean).join('、') || '无');
const missingSummary = computed(() => {
  const total = items.value.length;
  if (!total) return '当前可用智能体已覆盖所需角色';
  const created = items.value.filter((item) => item.status === 'created').length;
  const failed = items.value.filter((item) => item.status === 'failed').length;
  if (cardStatus.value === 'created') return `已创建 ${created}/${total}`;
  if (cardStatus.value === 'partial') return `部分创建：${created}/${total}（失败 ${failed}）`;
  return `${total} 个角色待创建`;
});
const authSummary = computed(() => {
  const profile = props.card.coordinatorProfile;
  if (!profile) return '继承协调者凭证';
  if (profile.accessMode === 'oauth') return `OAuth · ${profile.providerLabel || profile.provider || 'Codex'}`;
  if (profile.accessMode === 'api-key') return `API Key · ${profile.platform || 'codex'} · ${profile.defaultModel || '默认模型'}`;
  return '继承协调者凭证';
});

const statusText = computed(() => {
  if (cardStatus.value === 'creating') return '创建中';
  if (cardStatus.value === 'created') return '已创建';
  if (cardStatus.value === 'partial') return '部分成功';
  if (cardStatus.value === 'cancelled') return '已取消';
  if (cardStatus.value === 'failed') return '失败';
  return '待确认';
});

function itemStatusText(item) {
  if (item.status === 'created') return '已创建';
  if (item.status === 'creating') return '创建中';
  if (item.status === 'failed') return '失败';
  return '待创建';
}
</script>

<style scoped>
.tc-card {
  width: min(100%, 520px);
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-surface);
  overflow: hidden;
}

.tc-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
}

.tc-card-title-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tc-card-kicker {
  font-size: 11px;
  line-height: 16px;
  color: var(--color-text-muted);
}

.tc-card-title {
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tc-card-subtitle {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-text-secondary);
}

.tc-card-status {
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

.tc-card-status[data-status="failed"],
.tc-card-status[data-status="partial"] {
  color: var(--color-error);
  background: rgba(220, 38, 38, 0.08);
}

.tc-card-status[data-status="created"] {
  color: var(--color-success);
  background: rgba(22, 163, 74, 0.1);
}

.tc-card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
}

.tc-card-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.tc-card-label {
  font-size: 12px;
  line-height: 20px;
  color: var(--color-text-muted);
}

.tc-card-value {
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-primary);
  min-width: 0;
  word-break: break-word;
}

.tc-item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.tc-item {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tc-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tc-item-name {
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-primary);
  font-weight: 600;
}

.tc-item-status {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-text-muted);
}

.tc-item[data-status="created"] .tc-item-status {
  color: var(--color-success);
}

.tc-item[data-status="failed"] .tc-item-status {
  color: var(--color-error);
}

.tc-item-reason {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-text-secondary);
}

.tc-item-error {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-error);
}

.tc-card-error {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-error);
}

.tc-card-actions {
  display: flex;
  gap: 8px;
  padding: 0 14px 14px;
}

.tc-card-btn {
  min-height: 44px;
  flex: 1;
  margin: 0;
  border-radius: 6px;
  font-size: 14px;
  line-height: 44px;
}

.tc-card-btn::after {
  border: none;
}

.tc-card-btn.primary {
  color: #ffffff;
  background: var(--color-primary);
}

.tc-card-btn.secondary {
  color: var(--color-text-primary);
  background: var(--color-bg-muted);
}

@media (max-width: 480px) {
  .tc-card {
    width: 100%;
  }

  .tc-card-actions {
    flex-direction: column;
  }
}
</style>
