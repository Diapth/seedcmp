<template>
  <view :class="['app-shell', appStore.theme]">
    <view class="app-container">
      
      <!-- Network Disconnected Banner -->
      <view class="offline-banner" v-if="!isOnline">
        <AppIcon name="info" :size="16" />
        <text class="offline-text">当前网络连接已断开，请检查网络设置</text>
      </view>
      
      <!-- Desktop Layout -->
      <view class="desktop-layout" v-if="isDesktop">
        <!-- Persistent Sidebar Navigation -->
        <DesktopSidebar v-if="!hideDesktopSidebar" />
        <!-- Sidebar spacer to keep layout balance when hidden -->
        <view v-else class="desktop-sidebar-spacer" />

        <!-- Main Workspace (e.g. List + Detail inside workbench) -->
        <view class="desktop-main flex-1 flex-row">
          <slot />
        </view>
      </view>
      
      <!-- Mobile Layout -->
      <view class="mobile-layout" v-else>
        <!-- Top Status Bar Spacing for Android/iOS App -->
        <view class="status-bar-placeholder" :style="{ height: statusBarHeight + 'px' }" />
        
        <!-- Main Content Area -->
        <view class="mobile-main flex-1">
          <slot />
        </view>
        
        <!-- Bottom Tab Bar Navigation -->
        <MobileTabBar v-if="!hideMobileTabBar" />
      </view>
      
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useResponsiveLayout } from '@/composables/useResponsiveLayout';
import { useSafeArea } from '@/composables/useSafeArea';
import { useVisualState } from '@/composables/useVisualState';
import DesktopSidebar from './DesktopSidebar.vue';
import MobileTabBar from './MobileTabBar.vue';
import AppIcon from '../common/AppIcon.vue';

defineProps({
  hideMobileTabBar: {
    type: Boolean,
    default: false
  },
  hideDesktopSidebar: {
    type: Boolean,
    default: false
  }
});

const appStore = useAppStore();
const { isDesktop } = useResponsiveLayout();
const { safeAreaInsets } = useSafeArea();
const { isOnline } = useVisualState();

// Android/iOS statusBarHeight fallback
const statusBarHeight = computed(() => {
  // #ifdef APP-PLUS
  return safeAreaInsets.value.top;
  // #endif
  // #ifndef APP-PLUS
  return 0;
  // #endif
});
</script>

<style scoped>
.app-shell {
  width: 100vw;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
}

.app-container,
.desktop-layout,
.mobile-layout,
.desktop-main {
  min-height: 0;
  overflow: hidden;
}

.offline-banner {
  background-color: var(--color-error);
  color: #ffffff;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  gap: 8px;
  z-index: 100;
  position: relative;
}

.offline-text {
  font-weight: 500;
}

.desktop-main {
  height: 100%;
}

.desktop-sidebar-spacer {
  width: 64px;
  flex-shrink: 0;
  background-color: var(--color-bg-surface);
  border-right: 1px solid var(--color-border);
}

.mobile-main {
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.status-bar-placeholder {
  width: 100%;
  background-color: var(--color-bg-surface);
}
</style>
