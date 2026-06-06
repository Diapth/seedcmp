<template>
  <view class="app-avatar-container" :style="{ width: sizePx, height: sizePx }">
    <!-- Image Avatar -->
    <image 
      v-if="src && !hasError"
      :src="src" 
      class="avatar-img"
      @error="handleError"
      :style="{ borderRadius: isCircle ? '50%' : '12px' }"
    />
    
    <!-- Fallback Text Avatar -->
    <view 
      v-else
      class="avatar-fallback"
      :style="{ 
        borderRadius: isCircle ? '50%' : '12px',
        background: bgGradient,
        fontSize: fontSize
      }"
    >
      <text class="fallback-text">{{ displayText }}</text>
    </view>
    
    <!-- Status Dot -->
    <view 
      v-if="status"
      class="status-dot"
      :class="['status-' + status]"
      :style="{ width: dotSize, height: dotSize }"
    />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  src: {
    type: String,
    default: ''
  },
  text: {
    type: String,
    default: ''
  },
  size: {
    type: Number,
    default: 40
  },
  isCircle: {
    type: Boolean,
    default: true
  },
  status: {
    type: String, // 'online' | 'offline' | 'busy' | 'away'
    default: ''
  }
});

const hasError = ref(false);

const sizePx = computed(() => `${props.size}px`);
const dotSize = computed(() => `${Math.max(8, props.size * 0.25)}px`);
const fontSize = computed(() => `${Math.max(12, props.size * 0.38)}px`);

const displayText = computed(() => {
  if (!props.text) return '?';
  const cleanText = props.text.trim();
  return cleanText.charAt(0).toUpperCase();
});

const bgGradient = computed(() => {
  if (!props.text) return 'linear-gradient(135deg, #cbd5e1, #94a3b8)';
  let hash = 0;
  for (let i = 0; i < props.text.length; i++) {
    hash = props.text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${h}, 75%, 65%), hsl(${h}, 75%, 50%))`;
});

function handleError() {
  hasError.value = true;
}
</script>

<style scoped>
.app-avatar-container {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
}
.avatar-img {
  width: 100%;
  height: 100%;
  display: block;
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
  user-select: none;
}
.fallback-text {
  line-height: 1;
}
.status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  border-radius: 50%;
  border: 2px solid var(--color-bg-surface);
  box-sizing: border-box;
}
.status-online {
  background-color: var(--color-success);
}
.status-offline {
  background-color: var(--color-text-muted);
}
.status-busy {
  background-color: var(--color-error);
}
.status-away {
  background-color: var(--color-warning);
}
</style>
