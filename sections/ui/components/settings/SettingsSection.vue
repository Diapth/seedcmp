<template>
  <view class="settings-section flex-column">
    <view class="section-header flex-row align-center gap-2" v-if="title">
      <AppIcon :name="icon" :size="16" color="var(--color-primary)" v-if="icon" />
      <text class="section-title">{{ title }}</text>
    </view>
    <view class="section-content flex-column">
      <slot />
    </view>
  </view>
</template>

<script setup>
import AppIcon from '../common/AppIcon.vue';

defineProps({
  title: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: ''
  }
});
</script>

<style scoped>
.settings-section {
  border-radius: 12px;
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

.section-header {
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 10px;
  margin-bottom: 12px;
  display: flex;
}

.gap-2 {
  gap: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.section-content {
  gap: 12px;
}
</style>
