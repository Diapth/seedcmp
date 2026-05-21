<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  message: {
    content?: {
      title?: string;
      users?: string[];
      messages?: any[];
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const title = computed(() => props.message.content?.title || props.message.payload?.title || '聊天记录');
const previews = computed(() => {
  const list = props.message.content?.messages || props.message.payload?.messages || [];
  return list.slice(0, 3).map((m: any) => {
    const text = m.content?.text || m.payload?.text || '[消息]';
    return `${m.from_name || '用户'}: ${text}`;
  });
});
</script>

<template>
  <div class="merge-cell" :class="{ 'is-me': isMe }">
    <div class="bubble">
      <div class="merge-header">
        <span class="merge-title">{{ title }}</span>
      </div>
      <div class="merge-body">
        <p v-for="(p, i) in previews" :key="i" class="preview-line">{{ p }}</p>
      </div>
      <div class="merge-footer">
        <span class="footer-label">群聊的聊天记录</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.merge-cell {
  display: flex;
  width: 100%;
}

.bubble {
  width: 240px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: var(--border-hairline);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: background-color 0.2s;
}

.bubble:hover {
  background-color: var(--bg-hover);
}

.merge-header {
  padding: 10px 14px 6px;
}

.merge-title {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
}

.merge-body {
  padding: 4px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-bottom: var(--border-hairline);
}

.preview-line {
  font-size: 11.5px;
  color: var(--text-secondary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.merge-footer {
  padding: 6px 14px;
  background-color: var(--bg-secondary);
}

.footer-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.merge-cell.is-me {
  justify-content: flex-end;
}
</style>
