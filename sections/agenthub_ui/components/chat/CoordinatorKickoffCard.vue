<template>
  <view class="coord-card">
    <text class="coord-title">{{ title }}</text>
    <text class="coord-copy">{{ description }}</text>
  </view>
</template>

<script setup>
defineProps({
  title: { type: String, default: '项目群待确认' },
  description: { type: String, default: 'PM/coordinator 将创建项目群并邀请 worker cats。' }
});
</script>

<style scoped>
.coord-card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--color-bg-surface);
}

.coord-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.coord-copy {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
