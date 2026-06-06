<template>
  <view class="voice-card flex-row align-center" :class="{ 'voice-me': isMe }" @click="togglePlay">
    <view class="waveform flex-row align-center">
      <view
        v-for="(b, i) in bars"
        :key="i"
        class="wave-bar"
        :class="{ played: i < playedBars, active: playing && i === playedBars }"
        :style="{ height: b + 'px' }"
      />
    </view>
    <text class="voice-duration">{{ voice.duration || 3 }}s</text>
    <view v-if="!isMe && !played" class="unread-dot" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import AppIcon from '../common/AppIcon.vue';

const props = defineProps({
  voice: { type: Object, required: true },
  isMe: { type: Boolean, default: false }
});

const playing = ref(false);
const played = ref(false);
const playedBars = ref(0);

const total = computed(() => Math.max(1, props.voice.duration || 3));
const bars = computed(() => {
  const arr = [];
  const count = 12;
  for (let i = 0; i < count; i++) {
    const base = 6 + Math.abs(Math.sin((i + 1) * 1.3)) * 14;
    arr.push(Math.round(base));
  }
  return arr;
});

let timer = null;

function togglePlay() {
  if (playing.value) {
    playing.value = false;
    if (timer) clearInterval(timer);
    return;
  }
  playing.value = true;
  played.value = true;
  let elapsed = 0;
  const stepMs = (total.value * 1000) / 12;
  timer = setInterval(() => {
    elapsed += stepMs;
    playedBars.value = Math.min(12, Math.floor((elapsed / 1000) / total.value * 12));
    if (elapsed >= total.value * 1000) {
      playing.value = false;
      playedBars.value = 12;
      clearInterval(timer);
    }
  }, stepMs);
}
</script>

<style scoped>
.voice-card {
  gap: 8px;
  align-items: center;
  min-width: 140px;
}

.waveform {
  gap: 2px;
  height: 20px;
  align-items: center;
}

.wave-bar {
  width: 2px;
  background-color: var(--color-text-secondary);
  border-radius: 1px;
  transition: background-color 0.2s ease;
}

.voice-me .wave-bar {
  background-color: rgba(255, 255, 255, 0.85);
}

.wave-bar.played {
  background-color: var(--color-primary);
}

.voice-me .wave-bar.played {
  background-color: #ffffff;
}

.wave-bar.active {
  animation: wave 0.6s ease-in-out infinite alternate;
}

@keyframes wave {
  from { transform: scaleY(0.85); }
  to { transform: scaleY(1.18); }
}

.voice-duration {
  font-weight: 600;
  font-size: 12px;
}

.voice-me .voice-duration {
  color: #ffffff;
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-error);
  margin-left: 2px;
}
</style>
