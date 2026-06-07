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

      <view v-if="appStore.kickout.visible" class="kickout-overlay">
        <view class="kickout-dialog">
          <view class="kickout-icon">
            <AppIcon name="shield" :size="22" color="var(--color-error)" />
          </view>
          <text class="kickout-title">账号已在其他设备登录</text>
          <text class="kickout-desc">{{ appStore.kickout.reason || '当前会话已失效，请重新登录以继续使用。' }}</text>
          <button class="kickout-action" @click="handleKickoutConfirm">重新登录</button>
        </view>
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

function handleKickoutConfirm() {
  appStore.acknowledgeKickout();
  uni.redirectTo({ url: '/pages/login/index' });
}
</script>

<style scoped>
.app-shell {
  width: 100vw;
  height: 100vh;
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
  overflow: hidden;
}

.status-bar-placeholder {
  width: 100%;
  background-color: var(--color-bg-surface);
}

.kickout-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: rgba(15, 23, 42, 0.42);
  box-sizing: border-box;
}

.kickout-dialog {
  width: min(360px, 100%);
  padding: 24px;
  border-radius: 8px;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  box-sizing: border-box;
}

.kickout-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(239, 68, 68, 0.1);
}

.kickout-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.kickout-desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.kickout-action {
  width: 100%;
  min-height: 44px;
  margin-top: 4px;
  border-radius: 8px;
  border: none;
  background-color: var(--color-primary);
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
}

.kickout-action::after {
  border: none;
}
</style>
