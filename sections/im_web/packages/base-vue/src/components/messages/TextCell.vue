<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  message: {
    fromUID: string;
    content?: {
      text?: string;
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const displayText = computed(() => {
  return props.message.content?.text || props.message.payload?.text || '';
});
</script>

<template>
  <div class="text-cell" :class="{ 'is-me': isMe }">
    <div class="bubble">
      {{ displayText }}
    </div>
  </div>
</template>

<style scoped>
.text-cell {
  display: flex;
  width: 100%;
}

.bubble {
  max-width: 60%;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
  border: var(--border-hairline);
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.text-cell.is-me {
  justify-content: flex-end;
}

.text-cell.is-me .bubble {
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  border: none;
}
</style>
