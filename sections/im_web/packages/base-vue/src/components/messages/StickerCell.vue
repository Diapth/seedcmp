<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  message: {
    content?: {
      category?: string;
      placeholder?: string;
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const category = computed(() => props.message.content?.category || props.message.payload?.category || '');
const placeholder = computed(() => props.message.content?.placeholder || props.message.payload?.placeholder || '');

// Resolve static assets or external emoji links based on categories/placeholders
const stickerUrl = computed(() => {
  // If the placeholder looks like an url, use it directly
  if (placeholder.value.startsWith('http') || placeholder.value.startsWith('data:')) {
    return placeholder.value;
  }
  // Otherwise resolve from a fallback asset pipeline or return an elegant standard system emoji/default image
  return `https://api.iconify.design/twemoji:party-popper.svg`;
});
</script>

<template>
  <div class="sticker-cell" :class="{ 'is-me': isMe }">
    <div class="sticker-wrapper">
      <img :src="stickerUrl" class="sticker-image" :alt="category" loading="lazy" />
    </div>
  </div>
</template>

<style scoped>
.sticker-cell {
  display: flex;
  width: 100%;
}

.sticker-wrapper {
  max-width: 120px;
  max-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sticker-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.sticker-cell.is-me {
  justify-content: flex-end;
}
</style>
