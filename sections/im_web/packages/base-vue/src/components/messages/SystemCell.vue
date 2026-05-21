<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  message: {
    content?: {
      text?: string;
    };
    [key: string]: any;
  };
}>();

const displayText = computed(() => {
  return props.message.content?.text || props.message.payload?.text || '系统通知';
});
</script>

<template>
  <div class="system-cell">
    <div class="system-bubble">
      {{ displayText }}
    </div>
  </div>
</template>

<style scoped>
.system-cell {
  display: flex;
  justify-content: center;
  width: 100%;
  margin: 8px 0;
}

.system-bubble {
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 11px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: var(--border-hairline);
  max-width: 80%;
  text-align: center;
  word-break: break-all;
}
</style>
