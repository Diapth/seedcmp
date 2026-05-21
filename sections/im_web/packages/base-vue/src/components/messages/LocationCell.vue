<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  message: {
    content?: {
      title?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const title = computed(() => props.message.content?.title || props.message.payload?.title || '未知位置');
const address = computed(() => props.message.content?.address || props.message.payload?.address || '未知地址');
</script>

<template>
  <div class="location-cell" :class="{ 'is-me': isMe }">
    <div class="bubble">
      <div class="location-info">
        <h4 class="location-title">{{ title }}</h4>
        <p class="location-address">{{ address }}</p>
      </div>
      
      <!-- Static map mock placeholder -->
      <div class="map-placeholder">
        <div class="map-grid"></div>
        <div class="pin-marker">
          <svg viewBox="0 0 24 24" fill="currentColor" class="pin-svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.location-cell {
  display: flex;
  width: 100%;
}

.bubble {
  max-width: 240px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: var(--border-hairline);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
}

.location-info {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.location-title {
  font-size: 13.5px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.location-address {
  font-size: 11.5px;
  color: var(--text-secondary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.map-placeholder {
  position: relative;
  height: 110px;
  background-color: #e3e6e8;
  overflow: hidden;
}

.map-grid {
  width: 100%;
  height: 100%;
  background-image: 
    linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px);
  background-size: 20px 20px;
}

.pin-marker {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -100%);
  color: #ff4d4f;
  animation: bounce 1s ease-in-out infinite alternate;
}

.pin-svg {
  width: 32px;
  height: 32px;
}

@keyframes bounce {
  0% { transform: translate(-50%, -100%); }
  100% { transform: translate(-50%, -115%); }
}

.location-cell.is-me {
  justify-content: flex-end;
}
</style>
