<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  timestamp: number;
}>();

const displayTime = computed(() => {
  if (!props.timestamp) return '';
  const date = new Date(props.timestamp * 1000);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return `今天 ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
});
</script>

<template>
  <div class="time-cell">
    <span class="time-label">{{ displayTime }}</span>
  </div>
</template>

<style scoped>
.time-cell {
  display: flex;
  justify-content: center;
  width: 100%;
  margin: 16px 0 8px;
  user-select: none;
}

.time-label {
  font-size: 11px;
  color: var(--text-secondary);
  background-color: transparent;
  padding: 2px 8px;
}
</style>
