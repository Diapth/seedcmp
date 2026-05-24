<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue';

const props = defineProps<{
  message: {
    content?: {
      url?: string;
      time?: number;
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const url = computed(() => props.message.content?.url || props.message.payload?.url || '');
const duration = computed(() => props.message.content?.time || props.message.payload?.time || 0);
const isAvailable = computed(() => !!url.value);

const isPlaying = ref(false);
let audio: HTMLAudioElement | null = null;

function togglePlay() {
  if (!isAvailable.value) return;

  if (isPlaying.value) {
    audio?.pause();
    isPlaying.value = false;
  } else {
    if (!audio) {
      audio = new Audio(url.value);
      audio.addEventListener('ended', () => {
        isPlaying.value = false;
      });
      audio.addEventListener('error', () => {
        isPlaying.value = false;
      });
    }
    audio.play()
      .then(() => {
        isPlaying.value = true;
      })
      .catch((err) => {
        console.error('Audio play failed', err);
      });
  }
}

onBeforeUnmount(() => {
  if (audio) {
    audio.pause();
    audio = null;
  }
});
</script>

<template>
  <div class="voice-cell" :class="{ 'is-me': isMe, unavailable: !isAvailable }" @click="togglePlay">
    <div class="bubble">
      <div class="voice-icon-wrapper">
        <svg v-if="!isPlaying" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="voice-icon">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v4M8 23h8" />
        </svg>
        <div v-else class="wave-animation">
          <span class="bar bar-1"></span>
          <span class="bar bar-2"></span>
          <span class="bar bar-3"></span>
        </div>
      </div>
      <span class="voice-duration">{{ isAvailable ? `${duration}"` : '语音不可用' }}</span>
    </div>
  </div>
</template>

<style scoped>
.voice-cell {
  display: flex;
  width: 100%;
  cursor: pointer;
}

.voice-cell.unavailable {
  cursor: not-allowed;
  opacity: 0.72;
}

.bubble {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 100px;
  max-width: 60%;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: var(--border-hairline);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: opacity 0.2s;
}

.bubble:hover {
  opacity: 0.9;
}

.voice-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.voice-icon {
  width: 18px;
  height: 18px;
}

.voice-duration {
  font-size: 13.5px;
  font-weight: 500;
}

.voice-cell.is-me {
  justify-content: flex-end;
}

.voice-cell.is-me .bubble {
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  border: none;
  flex-direction: row-reverse;
}

.wave-animation {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
}

.bar {
  width: 2.5px;
  background-color: currentColor;
  animation: wave 1s ease-in-out infinite alternate;
}

.bar-1 { height: 4px; animation-delay: 0.1s; }
.bar-2 { height: 12px; animation-delay: 0.3s; }
.bar-3 { height: 8px; animation-delay: 0.5s; }

@keyframes wave {
  0% { height: 4px; }
  100% { height: 14px; }
}
</style>
