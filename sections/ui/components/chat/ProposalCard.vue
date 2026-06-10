<template>
  <view class="proposal-card" data-testid="proposal-card">
    <view class="proposal-head">
      <view class="proposal-title-wrap">
        <text class="proposal-kicker">Thread Proposal</text>
        <text class="proposal-title">{{ card.title || '提议新建 thread' }}</text>
      </view>
      <text class="proposal-status" :data-status="status">{{ statusText }}</text>
    </view>

    <view class="proposal-body">
      <text v-if="card.bodyMarkdown" class="proposal-reason">{{ card.bodyMarkdown }}</text>
      <view v-if="fields.length" class="proposal-fields">
        <view v-for="field in fields" :key="field.label || field.value" class="proposal-field">
          <text class="proposal-label">{{ field.label }}</text>
          <text class="proposal-value">{{ field.value }}</text>
        </view>
      </view>
      <text v-if="errorText" class="proposal-error">{{ errorText }}</text>
    </view>

    <view class="proposal-actions">
      <button
        v-if="canSubmit"
        class="proposal-btn secondary"
        :disabled="submitting"
        @click.stop="handleReject"
      >驳回</button>
      <button
        v-if="canSubmit"
        class="proposal-btn primary"
        :disabled="submitting"
        @click.stop="handleApprove"
      >{{ status === 'failed' ? '重试创建' : '批准并创建' }}</button>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { nativeImService } from '@/services/native-im/service';

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

const status = ref(props.card.status || 'pending');
const submitting = ref(false);
const errorText = ref('');

const fields = computed(() => props.card.fields || []);
const canSubmit = computed(() => status.value === 'pending' || status.value === 'failed');
const statusText = computed(() => {
  if (status.value === 'approved') return '已批准';
  if (status.value === 'rejected') return '已驳回';
  if (status.value === 'failed') return '失败';
  if (submitting.value) return '处理中';
  return '待审批';
});

async function handleApprove() {
  if (!props.card.proposalId || submitting.value) return;
  submitting.value = true;
  errorText.value = '';
  try {
    await nativeImService.approveThreadProposal(props.card.proposalId);
    status.value = 'approved';
    uni.showToast({ title: '已批准提议', icon: 'success' });
  } catch (error) {
    status.value = 'failed';
    errorText.value = error?.msg || error?.message || '批准失败';
    uni.showToast({ title: errorText.value, icon: 'none' });
  } finally {
    submitting.value = false;
  }
}

async function handleReject() {
  if (!props.card.proposalId || submitting.value) return;
  submitting.value = true;
  errorText.value = '';
  try {
    await nativeImService.rejectThreadProposal(props.card.proposalId);
    status.value = 'rejected';
    uni.showToast({ title: '已驳回提议', icon: 'none' });
  } catch (error) {
    status.value = 'failed';
    errorText.value = error?.msg || error?.message || '驳回失败';
    uni.showToast({ title: errorText.value, icon: 'none' });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.proposal-card {
  width: min(100%, 520px);
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-surface);
  overflow: hidden;
}

.proposal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
}

.proposal-title-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.proposal-kicker {
  font-size: 11px;
  line-height: 16px;
  color: var(--color-text-muted);
}

.proposal-title {
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
  color: var(--color-text-primary);
  word-break: break-word;
}

.proposal-status {
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

.proposal-status[data-status="approved"] {
  color: var(--color-success);
  background: rgba(22, 163, 74, 0.1);
}

.proposal-status[data-status="rejected"],
.proposal-status[data-status="failed"] {
  color: var(--color-error);
  background: rgba(220, 38, 38, 0.1);
}

.proposal-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
}

.proposal-reason,
.proposal-value {
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.proposal-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.proposal-field {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 10px;
}

.proposal-label {
  font-size: 12px;
  line-height: 20px;
  color: var(--color-text-muted);
}

.proposal-error {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-error);
}

.proposal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px 12px;
}

.proposal-btn {
  margin: 0;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 7px;
  font-size: 13px;
  line-height: 34px;
}

.proposal-btn.secondary {
  color: var(--color-text-secondary);
  background: var(--color-bg-muted);
}

.proposal-btn.primary {
  color: #fff;
  background: var(--color-primary);
}
</style>
