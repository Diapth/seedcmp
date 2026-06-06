<template>
  <view class="mobile-page-header flex-row align-center justify-between" v-if="visible">
    <!-- 左侧: 可选头像 / 返回 / 自定义 -->
    <view class="header-left flex-row align-center">
      <slot name="left">
        <AppAvatar v-if="avatar" :src="avatar" :text="title" :size="36" />
      </slot>
    </view>

    <!-- 中间: title + subtitle -->
    <view class="header-center flex-column align-center">
      <text class="header-title">{{ title }}</text>
      <text v-if="subtitle" class="header-subtitle">{{ subtitle }}</text>
    </view>

    <!-- 右侧: actions slot -->
    <view class="header-right flex-row align-center">
      <slot name="actions" />
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import AppAvatar from '../common/AppAvatar.vue';

const props = defineProps({
  visible: { type: Boolean, default: true },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  avatar: { type: String, default: '' }
});
</script>

<style scoped>
.mobile-page-header {
  min-height: 64px;
  height: 64px;
  padding: 0 16px;
  background-color: var(--color-glass-bg, rgba(255, 255, 255, 0.78));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
  box-sizing: border-box;
  position: relative;
  z-index: 5;
}

.header-left,
.header-right {
  min-width: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.header-center {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.header-subtitle {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}
</style>
