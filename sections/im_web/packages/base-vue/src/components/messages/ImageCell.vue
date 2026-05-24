<script setup lang="ts">
import { computed, ref, watch } from 'vue';

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

const imageLoadState = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle');

watch(
  imageUrl,
  url => {
    imageLoadState.value = url ? 'loading' : 'idle';
  },
  { immediate: true }
);
</script>

<template>
  <div class="image-cell" :class="{ 'is-me': isMe }">
    <div class="image-wrapper">
      <img
        v-if="imageUrl && imageLoadState !== 'error'"
        :src="imageUrl"
        class="bubble-image"
        alt="Image"
        @load="imageLoadState = 'loaded'"
        @error="imageLoadState = 'error'"
      />
      <div v-else class="image-placeholder">加载中...</div>
      <div v-if="imageLoadState === 'error'" class="image-placeholder">图片不可用</div>
    </div>
  </div>
</template>

<style scoped>
.image-cell {
  display: flex;
  width: 100%;
}

.image-wrapper {
  width: min(240px, 56vw);
  aspect-ratio: 4 / 3;
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
