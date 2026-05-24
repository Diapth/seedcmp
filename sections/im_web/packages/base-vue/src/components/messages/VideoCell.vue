<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  message: {
    content?: {
      url?: string;
      cover?: string;
      width?: number;
      height?: number;
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const url = computed(() => props.message.content?.url || props.message.payload?.url || '');
const cover = computed(() => props.message.content?.cover || props.message.payload?.cover || '');
const isAvailable = computed(() => !!url.value);

const showPlayer = ref(false);
</script>

<template>
  <div class="video-cell" :class="{ 'is-me': isMe }">
    <div class="bubble" :class="{ unavailable: !isAvailable }" @click="isAvailable && (showPlayer = true)">
      <img v-if="cover" :src="cover" class="video-thumbnail" alt="Video cover" />
      <div v-else class="video-placeholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="placeholder-icon">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
          <line x1="7" y1="2" x2="7" y2="22" />
          <line x1="17" y1="2" x2="17" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="2" y1="7" x2="7" y2="7" />
          <line x1="2" y1="17" x2="7" y2="17" />
          <line x1="17" y1="17" x2="22" y2="17" />
          <line x1="17" y1="7" x2="22" y2="7" />
        </svg>
      </div>

      <div v-if="isAvailable" class="play-overlay">
        <svg viewBox="0 0 24 24" fill="currentColor" class="play-icon">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </div>
      <div v-else class="video-unavailable">视频不可用</div>
    </div>

    <!-- Video Modal Player -->
    <div v-if="showPlayer && isAvailable" class="player-modal" @click="showPlayer = false">
      <div class="player-container" @click.stop>
        <video :src="url" controls autoplay class="player-video"></video>
        <button class="close-player-btn" @click="showPlayer = false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="close-icon">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-cell {
  display: flex;
  width: 100%;
}

.bubble {
  position: relative;
  max-width: 240px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: var(--border-hairline);
  background-color: var(--bg-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 10;
}

.bubble.unavailable {
  cursor: not-allowed;
  opacity: 0.72;
}

.video-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-placeholder {
  width: 240px;
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background-color: var(--bg-hover);
}

.placeholder-icon {
  width: 48px;
  height: 48px;
}

.play-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  transition: transform 0.2s, background-color 0.2s;
  z-index: 2;
}

.bubble:hover .play-overlay {
  transform: translate(-50%, -50%) scale(1.1);
  background: rgba(0, 0, 0, 0.75);
}

.play-icon {
  width: 16px;
  height: 16px;
  margin-left: 2px;
}

.video-unavailable {
  position: absolute;
  left: 10px;
  bottom: 10px;
  padding: 3px 7px;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.58);
  color: #ffffff;
  font-size: 12px;
}

.video-cell.is-me {
  justify-content: flex-end;
}

/* Modal Player */
.player-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.player-container {
  position: relative;
  max-width: 90vw;
  max-height: 80vh;
  background: #000;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.player-video {
  max-width: 100%;
  max-height: 80vh;
  display: block;
}

.close-player-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  color: #ffffff;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.close-player-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}

.close-icon {
  width: 18px;
  height: 18px;
}
</style>
