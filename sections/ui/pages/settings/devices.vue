<template>
  <AppSubpageShell>
    <view class="devices-page flex-column flex-1">
      
      <!-- Header -->
      <view class="header flex-row align-center">
        <view class="back-btn" @click="goBack">
          <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
        </view>
        <text class="title">设备与登录管理</text>
      </view>
      
      <!-- List Scroll -->
      <scroll-view scroll-y class="devices-scroll flex-1">
        <view v-if="settingsStore.deviceSyncState === 'syncing'" class="sync-state">
          <text class="sync-state-text">正在同步设备...</text>
        </view>
        <view v-else-if="settingsStore.deviceSyncError" class="sync-state warning">
          <text class="sync-state-text">{{ settingsStore.deviceSyncError }}</text>
        </view>

        <view class="list-container flex-column" v-if="settingsStore.devices.length > 0">
          <view 
            v-for="item in settingsStore.devices" 
            :key="item.id"
            class="device-item glass-panel flex-row align-center justify-between"
          >
            <view class="device-left flex-row align-center gap-3">
              <view class="device-icon flex-row align-center justify-center">
                <AppIcon :name="getDeviceIcon(item.type)" :size="20" color="var(--color-primary)" />
              </view>
              <view class="device-meta flex-column justify-center">
                <text class="device-name">{{ item.name }}</text>
                <view class="device-sub flex-row gap-2">
                  <text class="sub-text">上次活跃: {{ item.lastActive }}</text>
                  <text class="dot">•</text>
                  <text class="sub-text">地点: {{ item.location }}</text>
                </view>
              </view>
            </view>
            
            <button 
              class="btn-logout-device" 
              v-if="!item.isCurrent"
              :disabled="settingsStore.isDeviceLoggingOut(item.id)"
              @click="handleLogoutDevice(item)"
            >
              {{ settingsStore.isDeviceLoggingOut(item.id) ? '下线中' : '下线' }}
            </button>
            <text class="current-tag" v-else>当前活跃</text>
          </view>
        </view>
        
        <!-- Empty list -->
        <view class="empty-container" v-else>
          <AppEmptyState 
            icon="settings" 
            title="暂无其他活跃设备" 
          />
        </view>
      </scroll-view>
      
    </view>
  </AppSubpageShell>
</template>

<script setup>
import { onMounted } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { useNavigationStore } from '@/stores/navigation';
import { useConfirm } from '@/composables/useConfirm';
import AppSubpageShell from '@/components/layout/AppSubpageShell.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppEmptyState from '@/components/common/AppEmptyState.vue';

const settingsStore = useSettingsStore();
const navStore = useNavigationStore();
const { confirm } = useConfirm();

onMounted(() => {
  navStore.setActiveModule('settings');
  settingsStore.syncDevices({ silent: true });
});

function goBack() {
  uni.navigateBack();
}

function getDeviceIcon(type) {
  if (type === 'mobile') return 'user';
  if (type === 'desktop') return 'settings';
  return 'files';
}

function handleLogoutDevice(device) {
  confirm(`确定要强制下线设备 "${device.name}" 吗？该设备将需要重新登录。`, {
    title: '下线设备',
    destructive: true
  }).then(async (ok) => {
    if (!ok) return;
    try {
      await settingsStore.logoutDevice(device);
      uni.showToast({ title: '设备已强制下线', icon: 'success' });
    } catch (error) {
      uni.showToast({ title: error?.msg || error?.message || '下线失败', icon: 'none' });
    }
  });
}
</script>

<style scoped>
.devices-page {
  height: 100%;
  background-color: var(--color-bg-base);
}

.header {
  height: 56px;
  padding: 0 16px;
  background-color: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  gap: 12px;
  display: flex;
}

.back-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.devices-scroll {
  height: 100%;
}

.list-container {
  padding: 16px;
  gap: 12px;
  display: flex;
  flex-direction: column;
}

.sync-state {
  margin: 16px 16px 0;
  padding: 10px 12px;
  border-radius: 8px;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
}

.sync-state.warning {
  background-color: rgba(245, 158, 11, 0.08);
}

.sync-state-text {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.device-item {
  padding: 14px 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
}

.gap-3 {
  gap: 12px;
}

.gap-2 {
  gap: 8px;
}

.device-left {
  display: flex;
  align-items: center;
}

.device-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background-color: var(--color-primary-light);
  display: flex;
}

.device-meta {
  display: flex;
}

.device-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.device-sub {
  margin-top: 4px;
  font-size: 11px;
  color: var(--color-text-secondary);
  display: flex;
}

.dot {
  color: var(--color-text-muted);
}

.btn-logout-device {
  min-height: 44px;
  padding: 0 14px;
  background-color: var(--color-bg-base);
  color: var(--color-error);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.btn-logout-device[disabled] {
  opacity: 0.55;
}
.btn-logout-device::after { border: none; }

.current-tag {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-success);
}

.empty-container {
  padding-top: 60px;
}
</style>
