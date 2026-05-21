<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  message: {
    content?: {
      url?: string;
      width?: number;
      height?: number;
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const url = computed(() => props.message.content?.url || props.message.payload?.url || '');
</script>

<template>
  <div class="gif-cell" :class="{ 'is-me': isMe }">
    <div class="bubble">
      <img v-if="url" :src="url" class="gif-image" alt="Dynamic GIF" loading="lazy" />
    </div>
  </div>
</template>

<style scoped>
.gif-cell {
  display: flex;
  width: 100%;
}

.bubble {
  max-width: 200px;
  max-height: 200px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: var(--border-hairline);
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gif-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.gif-cell.is-me {
  justify-content: flex-end;
}
</style>
