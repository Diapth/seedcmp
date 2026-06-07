<template>
  <view class="empty-container">
    <view class="icon-wrapper">
      <AppIcon :name="icon" :size="48" color="var(--color-text-muted)" />
    </view>
    <text class="title">{{ title }}</text>
    <text class="description" v-if="description">{{ description }}</text>
    <view class="action-slot">
      <slot />
    </view>
  </view>
</template>

<script setup>
import AppIcon from './AppIcon.vue';

defineProps({
  icon: {
    type: String,
    default: 'info'
  },
  title: {
    type: String,
    default: '暂无数据'
  },
  description: {
    type: String,
    default: ''
  }
});
</script>

<style scoped>
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}
.icon-wrapper {
  background: var(--color-bg-muted);
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}
.description {
  font-size: 14px;
  color: var(--color-text-muted);
  max-width: 280px;
  line-height: 1.5;
}
.action-slot {
  margin-top: 16px;
}
</style>
