<template>
  <view class="deployment-card" data-testid="deployment-card">
    <view class="deployment-card-head">
      <view class="deployment-title-wrap">
        <text class="deployment-kicker">Deployment</text>
        <text class="deployment-title">确认部署</text>
      </view>
      <text class="deployment-status" :data-status="uiStatus">{{ statusText }}</text>
    </view>

    <view class="deployment-body">
      <view class="deployment-row">
        <text class="deployment-label">目标</text>
        <text class="deployment-value">{{ targetText }}</text>
      </view>
      <view class="deployment-row">
        <text class="deployment-label">环境</text>
        <text class="deployment-value">{{ environmentText }}</text>
      </view>
      <view v-if="downloadUrl" class="deployment-link-row">
        <text class="deployment-url">{{ downloadUrl }}</text>
        <button class="deployment-link-btn" @click.stop="openUrl(downloadUrl)">下载代码</button>
      </view>
      <view v-if="previewUrl" class="deployment-link-row preview">
        <text class="deployment-url">{{ previewUrl }}</text>
        <button class="deployment-link-btn" @click.stop="copyUrl(previewUrl)">复制</button>
      </view>
      <text v-if="isDeploying" class="deployment-note">正在部署中，请稍候。</text>
      <text v-if="errorText" class="deployment-error">{{ errorText }}</text>
    </view>

    <view class="deployment-actions">
      <button
        v-if="isPending"
        class="deployment-btn secondary"
        @click.stop="$emit('cancel', { card, message })"
      >取消</button>
      <button
        v-if="isPending"
        class="deployment-btn primary"
        @click.stop="$emit('confirm', { card, message })"
      >同意部署</button>
      <button
        v-if="isDeploying"
        class="deployment-btn secondary"
        @click.stop="$emit('cancel', { card, message })"
      >取消部署</button>
      <button
        v-if="isSucceeded"
        class="deployment-btn secondary"
        @click.stop="$emit('cancel', { card, message })"
      >取消部署</button>
      <button
        v-if="isSucceeded"
        class="deployment-btn primary"
        @click.stop="openUrl(previewUrl)"
      >打开预览</button>
      <button
        v-if="isFailed"
        class="deployment-btn primary"
        @click.stop="$emit('retry', { card, message })"
      >重试</button>
    </view>
  </view>
</template>

<script setup>
import { computed, nextTick, onMounted, onUpdated } from 'vue';

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

const emit = defineEmits(['confirm', 'cancel', 'retry', 'layout-change']);

const uiStatus = computed(() => props.card.status || 'pending_confirmation');
const targetText = computed(() => props.card.target || '当前项目');
const environmentText = computed(() => props.card.environment || 'preview');
const previewUrl = computed(() => props.card.previewUrl || '');
const downloadUrl = computed(() => props.card.downloadUrl || '');
const errorText = computed(() => props.card.failureReason || props.card.error || '');
const isPending = computed(() => ['pending_confirmation', 'needs_fields'].includes(uiStatus.value));
const isDeploying = computed(() => ['submitting', 'confirmed', 'queued', 'running'].includes(uiStatus.value));
const isSucceeded = computed(() => ['succeeded', 'deployed'].includes(uiStatus.value));
const isFailed = computed(() => uiStatus.value === 'failed');
const statusText = computed(() => {
  if (uiStatus.value === 'submitting') return '提交中';
  if (uiStatus.value === 'confirmed' || uiStatus.value === 'queued') return '已排队';
  if (uiStatus.value === 'running') return '部署中';
  if (isSucceeded.value) return '部署完成';
  if (uiStatus.value === 'cancelled' || uiStatus.value === 'canceled') return '已取消';
  if (isFailed.value) return '失败';
  return '待确认';
});

function emitLayoutChange() {
  nextTick(() => {
    emit('layout-change');
  });
}

onMounted(emitLayoutChange);
onUpdated(emitLayoutChange);

function copyUrl(url) {
  if (!url) return;
  if (typeof uni !== 'undefined' && typeof uni.setClipboardData === 'function') {
    uni.setClipboardData({
      data: url,
      success: () => uni.showToast?.({ title: '已复制预览网址', icon: 'none' })
    });
    return;
  }
  if (globalThis.navigator?.clipboard?.writeText) {
    globalThis.navigator.clipboard.writeText(url);
  }
}

function openUrl(url) {
  if (!url) return;
  // #ifdef H5
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  // #endif
  copyUrl(url);
  uni.showToast?.({ title: '已复制链接', icon: 'none' });
}
</script>

<style scoped>
.deployment-card {
  width: min(100%, 520px);
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-surface);
  overflow: hidden;
}

.deployment-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
}

.deployment-title-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.deployment-kicker {
  font-size: 11px;
  line-height: 16px;
  color: var(--color-text-muted);
}

.deployment-title {
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.deployment-status {
  flex-shrink: 0;
  min-width: 54px;
  text-align: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 18px;
  color: var(--color-primary);
  background: rgba(0, 74, 198, 0.08);
}

.deployment-status[data-status="failed"] {
  color: var(--color-error);
  background: rgba(220, 38, 38, 0.08);
}

.deployment-status[data-status="succeeded"],
.deployment-status[data-status="deployed"] {
  color: var(--color-success);
  background: rgba(22, 163, 74, 0.1);
}

.deployment-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
}

.deployment-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.deployment-label {
  font-size: 12px;
  line-height: 20px;
  color: var(--color-text-muted);
}

.deployment-value,
.deployment-note,
.deployment-error,
.deployment-url {
  min-width: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-primary);
  word-break: break-word;
}

.deployment-note {
  color: var(--color-text-secondary);
}

.deployment-error {
  color: var(--color-error);
}

.deployment-link-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border-radius: 6px;
  background: var(--color-bg-muted);
}

.deployment-link-row.preview {
  background: rgba(0, 74, 198, 0.07);
}

.deployment-link-btn {
  min-height: 34px;
  margin: 0;
  padding: 0 10px;
  border-radius: 6px;
  color: var(--color-primary);
  background: var(--color-bg-surface);
  font-size: 12px;
  line-height: 34px;
  font-weight: 700;
}

.deployment-link-btn::after {
  border: none;
}

.deployment-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 14px 14px;
}

.deployment-btn {
  min-height: 44px;
  min-width: 88px;
  flex: 1 1 88px;
  margin: 0;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 44px;
  white-space: nowrap;
}

.deployment-btn::after {
  border: none;
}

.deployment-btn.primary {
  color: #ffffff;
  background: var(--color-primary);
}

.deployment-btn.secondary {
  color: var(--color-text-primary);
  background: var(--color-bg-muted);
}

@media (max-width: 480px) {
  .deployment-card {
    width: 100%;
  }

  .deployment-link-row,
  .deployment-actions {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .deployment-btn {
    width: 100%;
  }
}
</style>
