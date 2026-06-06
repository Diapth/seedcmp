<template>
  <view v-if="visible" class="lightbox-mask" @click="$emit('close')" @touchmove.stop.prevent="noop">
    <view class="lightbox-top flex-row align-center justify-between">
      <text class="lightbox-counter">{{ index + 1 }} / {{ images.length }}</text>
      <view class="lightbox-close" @click.stop="$emit('close')">
        <AppIcon name="close" :size="20" color="#ffffff" />
      </view>
    </view>

    <view class="lightbox-stage" @click="onStageClick">
      <image
        :src="images[index]"
        mode="aspectFit"
        class="lightbox-image"
        @click.stop
      />
    </view>

    <view class="lightbox-bottom flex-row align-center justify-center">
      <view
        v-if="images.length > 1"
        class="dots flex-row align-center"
      >
        <view
          v-for="(_, i) in images"
          :key="i"
          class="dot"
          :class="{ active: i === index }"
        />
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  images: { type: Array, default: () => [] },
  initialIndex: { type: Number, default: 0 }
});

const emit = defineEmits(['close', 'update:index']);

const index = ref(props.initialIndex || 0);

watch(
  () => props.initialIndex,
  (v) => {
    if (typeof v === 'number') index.value = v;
  }
);

function noop() {}

function onStageClick(e) {
  if (!e || !props.images || props.images.length <= 1) return;
  // 桌面: 点击左半 = 上一张, 右半 = 下一张
  const x = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
  const w = typeof window !== 'undefined' ? window.innerWidth : 375;
  if (x < w / 2) {
    index.value = Math.max(0, index.value - 1);
  } else {
    index.value = Math.min(props.images.length - 1, index.value + 1);
  }
  emit('update:index', index.value);
}
</script>

<style scoped>
.lightbox-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background-color: rgba(0, 0, 0, 0.92);
  display: flex;
  flex-direction: column;
}

.lightbox-top {
  padding: 12px 16px;
  color: #ffffff;
  height: 44px;
  flex-shrink: 0;
  z-index: 2;
}

.lightbox-counter {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 600;
}

.lightbox-close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.lightbox-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  box-sizing: border-box;
  min-height: 0;
}

.lightbox-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  pointer-events: auto;
}

.lightbox-bottom {
  padding: 16px;
  height: 36px;
  flex-shrink: 0;
}

.dots {
  gap: 6px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.4);
}

.dot.active {
  background-color: #ffffff;
}
</style>
