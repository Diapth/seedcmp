<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { normalizeMediaUrl } from '../../service/mediaUrl';

const props = defineProps<{
  message: {
    fromUID: string;
    content?: {
      url?: string;
      name?: string;
      size?: number;
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const emit = defineEmits<{
  (event: 'preview', payload: {
    kind: 'image';
    url: string;
    name: string;
    size: number;
    extension: string;
  }): void;
}>();

const imageUrl = computed(() => {
  return normalizeMediaUrl(props.message.content?.url || props.message.payload?.url || '');
});
const imageName = computed(() => props.message.content?.name || props.message.payload?.name || '图片');
const imageSize = computed(() => props.message.content?.size || props.message.payload?.size || 0);
const imageExtension = computed(() => {
  const name = imageName.value.split('?')[0].toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1) : 'image';
});

const imageLoadState = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle');

watch(
  imageUrl,
  url => {
    imageLoadState.value = url ? 'loading' : 'idle';
  },
  { immediate: true }
);

function openPreview() {
  if (!imageUrl.value || imageLoadState.value === 'error') return;
  emit('preview', {
    kind: 'image',
    url: imageUrl.value,
    name: imageName.value,
    size: imageSize.value,
    extension: imageExtension.value
  });
}
</script>

<template>
  <div class="image-cell" :class="{ 'is-me': isMe }">
    <button class="image-wrapper" type="button" title="预览图片" @click="openPreview">
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
    </button>
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
  padding: 0;
  cursor: zoom-in;
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
