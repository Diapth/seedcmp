<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  message: {
    fromUID: string;
    content?: {
      url?: string;
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const imageUrl = computed(() => {
  return props.message.content?.url || props.message.payload?.url || '';
});
</script>

<template>
  <div class="image-cell" :class="{ 'is-me': isMe }">
    <div class="image-wrapper">
      <img v-if="imageUrl" :src="imageUrl" class="bubble-image" alt="Image" />
      <div v-else class="image-placeholder">加载中...</div>
    </div>
  </div>
</template>

<style scoped>
.image-cell {
  display: flex;
  width: 100%;
}

.image-wrapper {
  max-width: 240px;
  max-height: 320px;
  overflow: hidden;
  border-radius: var(--radius-sm);
  border: var(--border-hairline);
  background-color: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bubble-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder {
  padding: 24px;
  color: var(--text-secondary);
  font-size: 12px;
}

.image-cell.is-me {
  justify-content: flex-end;
}
</style>
