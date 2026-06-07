<template>
  <view class="deployment-card">
    <view class="deployment-main">
      <text class="deployment-title">{{ title }}</text>
      <text class="deployment-status">{{ statusText }}</text>
    </view>
    <view class="deployment-actions">
      <button class="action-btn" :disabled="submitting || terminal" @click="submit">确认</button>
      <button class="action-btn ghost" :disabled="submitting || terminal" @click="cancel">取消</button>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useDeploymentStore } from '@/stores/deployment.js';

const props = defineProps({
  requestId: { type: String, default: '' },
  title: { type: String, default: '部署请求' },
  status: { type: String, default: 'pending_confirmation' },
  channelId: { type: String, default: '' },
  channelType: { type: Number, default: 0 }
});

const deploymentStore = useDeploymentStore();
const submitting = ref(false);
const currentStatus = computed(() => deploymentStore.requests[props.requestId]?.status || props.status);
const terminal = computed(() => ['succeeded', 'failed', 'cancelled'].includes(currentStatus.value));
const statusText = computed(() => {
  const labels = {
    pending_confirmation: '等待确认',
    submitting: '提交中',
    running: '部署中',
    succeeded: '已成功',
    failed: '失败',
    cancelled: '已取消'
  };
  return labels[currentStatus.value] || currentStatus.value;
});

async function submit() {
  if (!props.requestId) return;
  submitting.value = true;
  try {
    await deploymentStore.confirm(props.requestId, {
      channelId: props.channelId,
      channelType: props.channelType
    });
  } finally {
    submitting.value = false;
  }
}

async function cancel() {
  if (!props.requestId) return;
  submitting.value = true;
  try {
    await deploymentStore.cancel(props.requestId, {
      channelId: props.channelId,
      channelType: props.channelType
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.deployment-card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--color-bg-surface);
}

.deployment-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.deployment-title {
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 700;
}

.deployment-status {
  color: var(--color-text-muted);
  font-size: 12px;
}

.deployment-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  min-width: 64px;
  height: 32px;
  border-radius: 8px;
  font-size: 12px;
}

.action-btn.ghost {
  background: var(--color-bg-muted);
  color: var(--color-text-secondary);
}
</style>
