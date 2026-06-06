<template>
  <view class="coord-card summary">
    <text class="coord-title">{{ title }}</text>
    <text class="coord-copy">{{ summary || '暂无 coordinator 总结' }}</text>
  </view>
</template>

<script setup>
defineProps({
  title: { type: String, default: '协作总结' },
  summary: { type: String, default: '' }
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

.coord-card.summary {
  border-color: var(--color-primary-light);
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
