<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  message: {
    content?: {
      url?: string;
      name?: string;
      size?: number;
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const url = computed(() => props.message.content?.url || props.message.payload?.url || '');
const name = computed(() => props.message.content?.name || props.message.payload?.name || '未知文件');
const size = computed(() => props.message.content?.size || props.message.payload?.size || 0);

const sizeStr = computed(() => {
  if (size.value === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(size.value) / Math.log(k));
  return parseFloat((size.value / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

function handleDownload() {
  if (!url.value) return;
  window.open(url.value, '_blank');
}
</script>

<template>
  <div class="file-cell" :class="{ 'is-me': isMe }" @click="handleDownload">
    <div class="bubble">
      <div class="file-details">
        <span class="file-name" :title="name">{{ name }}</span>
        <span class="file-size">{{ sizeStr }}</span>
      </div>
      <div class="file-icon-wrapper">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="file-svg">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-cell {
  display: flex;
  width: 100%;
  cursor: pointer;
}

.bubble {
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: 60%;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  border: var(--border-hairline);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.2s;
}

.bubble:hover {
  background-color: var(--bg-hover);
}

.file-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
  flex: 1;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: 12px;
  color: var(--text-secondary);
}

.file-icon-wrapper {
  width: 40px;
  height: 40px;
  background-color: var(--bg-secondary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color, #165dff);
  flex-shrink: 0;
}

.file-svg {
  width: 24px;
  height: 24px;
}

.file-cell.is-me {
  justify-content: flex-end;
}

.file-cell.is-me .bubble {
  background-color: var(--bg-secondary);
}

.file-cell.is-me .file-icon-wrapper {
  background-color: var(--bg-primary);
}
</style>
