<template>
  <AppShell>
    <!-- Mobile Page Header (PR-14) -->
    <MobilePageHeader
      v-if="!isDesktop"
      title="设置与安全"
    />

    <view class="settings-page flex-column flex-1">

      <!-- Top header -->
      <view class="header flex-row align-center justify-between" v-if="isDesktop">
        <text class="title">设置与安全</text>
      </view>
      
      <!-- Scrollable Settings -->
      <scroll-view scroll-y class="settings-scroll flex-1">
        <view class="settings-container flex-column gap-4">
          
          <!-- User Profile Card -->
          <view class="profile-card flex-row align-center gap-3">
            <AppAvatar :src="appStore.currentUser?.avatar || ''" :text="userName" :size="80" />
            <view class="profile-meta flex-column justify-center flex-1">
              <text class="user-name">{{ userName }}</text>
              <text class="user-phone">{{ userPhone }}</text>
              <button class="btn-edit-profile" @click="editProfile">编辑资料</button>
            </view>
          </view>
          
          <!-- Notifications Settings -->
          <SettingsSection title="通知设置" icon="chat">
            <view class="setting-item flex-row align-center justify-between">
              <view class="setting-copy">
                <view class="label-row flex-row align-center">
                  <text class="item-label">系统通知</text>
                  <text class="status-chip" :class="notificationStatusClass">{{ notificationStatusText }}</text>
                </view>
                <text class="item-desc">浏览器或手机后台收到新消息时显示系统通知。</text>
              </view>
              <switch
                :checked="settingsStore.notificationSettings.enableSystemNotifications"
                @change="toggleSystemNotifications"
                color="var(--color-primary)"
              />
            </view>
            <view class="setting-item flex-row align-center justify-between">
              <view class="setting-copy">
                <text class="item-label">声音提醒</text>
                <text class="item-desc">系统通知允许声音时，播放默认提示音。</text>
              </view>
              <switch 
                :checked="settingsStore.notificationSettings.enableSound" 
                @change="toggleSound" 
                color="var(--color-primary)" 
              />
            </view>
            <view class="setting-item flex-row align-center justify-between">
              <view class="setting-copy">
                <text class="item-label">移动端振动</text>
                <text class="item-desc">App 端收到本地通知时短振动提醒。</text>
              </view>
              <switch
                :checked="settingsStore.notificationSettings.enableVibrate"
                @change="toggleVibrate"
                color="var(--color-primary)"
              />
            </view>
            <view class="setting-item flex-row align-center justify-between">
              <view class="setting-copy">
                <text class="item-label">勿扰模式</text>
                <text class="item-desc">在专注时段静音通知和声音。</text>
              </view>
              <switch 
                :checked="settingsStore.notificationSettings.doNotDisturb"
                @change="toggleDoNotDisturb" 
                color="var(--color-primary)" 
              />
            </view>
            <view class="setting-item flex-row align-center justify-between">
              <view class="setting-copy">
                <text class="item-label">通知显示消息预览</text>
                <text class="item-desc">通知中展示发送人和消息摘要。</text>
              </view>
              <switch 
                :checked="settingsStore.notificationSettings.showPreview" 
                @change="togglePreview" 
                color="var(--color-primary)" 
              />
            </view>
          </SettingsSection>

          <SettingsSection title="语言和外观" icon="settings">
            <view class="setting-item flex-row align-center justify-between">
              <view class="setting-copy">
                <text class="item-label">系统语言</text>
                <text class="item-desc">选择界面的显示语言。</text>
              </view>
              <picker :range="languageOptions" :value="languageIndex" @change="changeLanguage">
                <view class="select-pill">{{ languageOptions[languageIndex] }}</view>
              </picker>
            </view>
            <view class="setting-item flex-row align-center justify-between">
              <view class="setting-copy">
                <text class="item-label">深色模式</text>
                <text class="item-desc">调整界面的主题配色。</text>
              </view>
              <switch 
                :checked="appStore.theme === 'dark'" 
                @change="toggleTheme" 
                color="var(--color-primary)" 
              />
            </view>
          </SettingsSection>
          
          <!-- Privacy & Safety -->
          <SettingsSection title="隐私与安全" icon="lock">
            <view class="setting-item flex-row align-center justify-between clickable" @click="navigate('/pages/settings/devices')">
              <text class="item-label">设备与登录管理</text>
              <AppIcon name="chevron-right" :size="14" color="var(--color-text-secondary)" />
            </view>
            <view class="setting-item flex-row align-center justify-between clickable" @click="navigate('/pages/contacts/blacklist')">
              <text class="item-label">黑名单管理</text>
              <AppIcon name="chevron-right" :size="14" color="var(--color-text-secondary)" />
            </view>
          </SettingsSection>
          
          <!-- Logout Button -->
          <button class="btn-logout" @click="handleLogout">退出登录</button>
          
        </view>
      </scroll-view>
      
    </view>
  </AppShell>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { useNavigationStore } from '@/stores/navigation';
import { useSettingsStore } from '@/stores/settings';
import { useResponsiveLayout } from '@/composables/useResponsiveLayout';
import { useConfirm } from '@/composables/useConfirm';
import { getNotificationPermissionState, requestNotificationPermission } from '@/composables/useSystemNotification';
import AppShell from '@/components/layout/AppShell.vue';
import MobilePageHeader from '@/components/layout/MobilePageHeader.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';
import SettingsSection from '@/components/settings/SettingsSection.vue';

const appStore = useAppStore();
const navStore = useNavigationStore();
const settingsStore = useSettingsStore();
const { isDesktop } = useResponsiveLayout();
const { confirm } = useConfirm();
const languageOptions = ['简体中文', 'English', '日本語'];
const languageIndex = ref(0);

onMounted(() => {
  navStore.setActiveModule('settings');
});

const userName = computed(() => {
  return appStore.currentUser?.nickname || '我';
});

const userPhone = computed(() => {
  return appStore.currentUser?.phone || '13800000000';
});

const notificationStatus = computed(() => {
  settingsStore.notificationSettings.permissionStatus;
  return getNotificationPermissionState();
});

const notificationStatusText = computed(() => {
  if (notificationStatus.value === 'granted') return '已授权';
  if (notificationStatus.value === 'denied') return '已拒绝';
  if (notificationStatus.value === 'unsupported') return '不支持';
  return '未授权';
});

const notificationStatusClass = computed(() => {
  if (notificationStatus.value === 'granted') return 'granted';
  if (notificationStatus.value === 'denied') return 'denied';
  if (notificationStatus.value === 'unsupported') return 'unsupported';
  return 'default';
});

function toggleTheme(e) {
  const nextTheme = e.detail.value ? 'dark' : 'light';
  appStore.setTheme(nextTheme);
}

async function toggleSystemNotifications(e) {
  if (!e.detail.value) {
    settingsStore.updateNotificationSettings({ enableSystemNotifications: false });
    return;
  }

  const { status } = await requestNotificationPermission();
  const enabled = status === 'granted';
  settingsStore.updateNotificationSettings({ enableSystemNotifications: enabled });
  if (enabled) {
    uni.showToast({ title: '通知权限已开启', icon: 'success' });
    return;
  }
  const title = status === 'denied' ? '请在系统设置中开启通知权限' : '当前环境不支持系统通知';
  uni.showToast({ title, icon: 'none' });
}

function toggleSound(e) {
  settingsStore.updateNotificationSettings({ enableSound: e.detail.value });
}

function toggleVibrate(e) {
  settingsStore.updateNotificationSettings({ enableVibrate: e.detail.value });
}

function toggleDoNotDisturb(e) {
  settingsStore.updateNotificationSettings({ doNotDisturb: e.detail.value });
}

function togglePreview(e) {
  settingsStore.updateNotificationSettings({ showPreview: e.detail.value });
}

function navigate(url) {
  uni.navigateTo({ url });
}

function changeLanguage(e) {
  languageIndex.value = Number(e.detail.value);
  uni.showToast({ title: `已切换为 ${languageOptions[languageIndex.value]}`, icon: 'none' });
}

function editProfile() {
  uni.navigateTo({ url: '/pages/profile/index' });
}

function handleLogout() {
  // PR-15: 替换为 useConfirm
  confirm('确定要退出当前账号吗？', {
    title: '退出登录',
    destructive: true
  }).then((ok) => {
    if (ok) {
      appStore.logout();
      uni.reLaunch({ url: '/pages/login/index' });
    }
  });
}
</script>

<style scoped>
.settings-page {
  height: 100%;
  background-color: var(--color-bg-surface);
}

.header {
  min-height: 64px;
  padding: 0 32px;
  background-color: var(--color-glass-bg);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  backdrop-filter: blur(10px);
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.settings-scroll {
  height: 100%;
}

.settings-container {
  padding: 28px 32px 40px;
  display: flex;
  flex-direction: column;
  width: min(760px, 100%);
  margin: 0 auto;
  box-sizing: border-box;
}

.gap-4 {
  gap: 16px;
}

.profile-card {
  padding: 24px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

.gap-3 {
  gap: 16px;
}

.user-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.user-phone {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.btn-edit-profile {
  margin: 12px 0 0;
  align-self: flex-start;
  width: auto;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--color-border-hover);
  border-radius: 10px;
  background-color: var(--color-bg-muted);
  color: var(--color-text-primary);
  font-size: 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.btn-edit-profile::after { border: none; }

.setting-item {
  min-height: 58px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 16px;
}
.setting-item:last-child {
  border-bottom: none;
}
.setting-item.clickable {
  cursor: pointer;
}

.item-label {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 700;
}

.setting-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.label-row {
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.status-chip {
  min-height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 22px;
  font-weight: 700;
  color: var(--color-text-secondary);
  background-color: var(--color-bg-muted);
  border: 1px solid var(--color-border);
  box-sizing: border-box;
}

.status-chip.granted {
  color: var(--color-success);
  background-color: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.22);
}

.status-chip.denied {
  color: var(--color-error);
  background-color: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
}

.status-chip.unsupported {
  color: var(--color-warning);
  background-color: rgba(249, 115, 22, 0.1);
  border-color: rgba(249, 115, 22, 0.2);
}

.item-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.select-pill {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-muted);
  display: flex;
  align-items: center;
  color: var(--color-text-primary);
  font-size: 13px;
}

.btn-logout {
  height: 44px;
  background-color: var(--color-bg-surface);
  color: var(--color-error);
  border: 1px solid var(--color-error);
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 10px;
}
.btn-logout::after { border: none; }

@media (max-width: 768px) {
  .header {
    padding: 0 16px;
  }

  .settings-container {
    padding: 16px;
  }

  .profile-card {
    align-items: flex-start;
  }
}
</style>
