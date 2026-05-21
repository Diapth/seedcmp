<script setup lang="ts">
import { computed } from 'vue';
import ChannelAvatar from '../ChannelAvatar.vue';

const props = defineProps<{
  message: {
    content?: {
      uid?: string;
      name?: string;
      avatar?: string;
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const name = computed(() => props.message.content?.name || props.message.payload?.name || '未知用户');
const avatar = computed(() => props.message.content?.avatar || props.message.payload?.avatar || '');
const cardUid = computed(() => props.message.content?.uid || props.message.payload?.uid || '');
</script>

<template>
  <div class="card-cell" :class="{ 'is-me': isMe }">
    <div class="bubble">
      <div class="card-header">
        <ChannelAvatar :avatar="avatar" :name="name" :size="38" />
        <span class="card-name">{{ name }}</span>
      </div>
      <div class="card-footer">
        <span class="footer-label">个人名片</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-cell {
  display: flex;
  width: 100%;
}

.bubble {
  width: 220px;
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

.card-header {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: var(--border-hairline);
}

.card-name {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-footer {
  padding: 6px 14px;
  background-color: var(--bg-secondary);
}

.footer-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.card-cell.is-me {
  justify-content: flex-end;
}
</style>
