<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  avatar?: string;
  name?: string;
  size?: number;
  isGroup?: boolean;
}>(), {
  avatar: '',
  name: '',
  size: 40,
  isGroup: false
});

const gradientBg = computed(() => {
  const text = props.name || '?';
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 80%, 65%), hsl(${h2}, 85%, 50%))`;
});

const initialLetter = computed(() => {
  if (!props.name) return '?';
  const trimmed = props.name.trim();
  if (trimmed.length === 0) return '?';
  return trimmed.substring(0, 1).toUpperCase();
});
</script>

<template>
  <div class="channel-avatar" :style="{ width: size + 'px', height: size + 'px' }">
    <img 
      v-if="avatar" 
      :src="avatar" 
      class="avatar-image" 
      alt="Avatar" 
    />
    <div 
      v-else-if="isGroup" 
      class="avatar-fallback group-bg" 
      :style="{ fontSize: (size * 0.45) + 'px' }"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="group-svg">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    </div>
    <div 
      v-else 
      class="avatar-fallback letter-bg" 
      :style="{ background: gradientBg, fontSize: (size * 0.5) + 'px' }"
    >
      {{ initialLetter }}
    </div>
  </div>
</template>

<style scoped>
.channel-avatar {
  position: relative;
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  flex-shrink: 0;
  border: var(--border-hairline);
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 600;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
}

.group-bg {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.group-svg {
  width: 55%;
  height: 55%;
}
</style>
