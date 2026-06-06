<template>
  <view class="desktop-sidebar">
    <!-- Top user profile -->
    <view class="sidebar-avatar-section" @click="navigateTo('/pages/profile/index', 'settings')">
      <AppAvatar
        :src="currentUser?.avatar || ''"
        :text="currentUser?.nickname || '我'"
        :size="40"
        status="online"
      />
    </view>
    
    <!-- Middle Navigation Items -->
    <view class="sidebar-nav-items">
      <view 
        v-for="item in primaryNavItems" 
        :key="item.id"
        class="nav-item-wrapper"
        :class="{ active: navStore.activeModule === item.id }"
        @click="switchModule(item)"
      >
        <!-- Icon Backplate Hover Effect -->
        <view class="nav-icon-bg">
          <AppIcon 
            :name="item.icon" 
            :size="22" 
            :color="navStore.activeModule === item.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'" 
          />
          <text class="nav-label">{{ item.label }}</text>
        </view>
        
        <!-- Unread Badge on Chat icon -->
        <view class="nav-badge" v-if="item.id === 'chat' && totalUnread > 0">
          <text class="badge-text">{{ formatUnread(totalUnread) }}</text>
        </view>
      </view>
    </view>
    
    <!-- Bottom Settings -->
    <view class="sidebar-bottom-actions">
      <view
        class="nav-item-wrapper settings-wrapper"
        :class="{ active: navStore.activeModule === navStore.settingsItem.id }"
        @click="navigateTo(navStore.settingsItem.path, navStore.settingsItem.id)"
      >
        <view class="nav-icon-bg">
          <AppIcon
            :name="navStore.settingsItem.icon"
            :size="22"
            :color="navStore.activeModule === navStore.settingsItem.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'"
          />
          <text class="nav-label">{{ navStore.settingsItem.label }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useNavigationStore } from '@/stores/navigation';
import { useConversationStore } from '@/stores/conversation';
import { formatUnread } from '@/utils/formatConversation';
import AppAvatar from '../common/AppAvatar.vue';
import AppIcon from '../common/AppIcon.vue';

const appStore = useAppStore();
const navStore = useNavigationStore();
const convStore = useConversationStore();

const currentUser = computed(() => appStore.currentUser || { nickname: '我' });

const totalUnread = computed(() => {
  return convStore.conversations.reduce((acc, c) => acc + (c.unread || 0), 0);
});

const primaryNavItems = computed(() => {
  const allowed = ['chat', 'contacts', 'agents', 'files'];
  return navStore.modules.filter(item => allowed.includes(item.id));
});

function switchModule(item) {
  navStore.setActiveModule(item.id);
  navigateTo(item.path, item.id);
}

function navigateTo(url, moduleId) {
  if (moduleId) {
    navStore.setActiveModule(moduleId);
  }
  uni.redirectTo({
    url
  });
}
</script>

<style scoped>
.desktop-sidebar {
  width: 80px;
  height: 100%;
  background-color: var(--color-bg-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 8px;
  box-sizing: border-box;
}

.sidebar-avatar-section {
  width: 64px;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  cursor: pointer;
}

.sidebar-nav-items {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  align-items: center;
}

.nav-item-wrapper {
  position: relative;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.nav-icon-bg {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: background-color 0.16s ease, color 0.16s ease;
  background-color: transparent;
}

.nav-item-wrapper:hover .nav-icon-bg {
  border-radius: 14px;
  background-color: var(--color-bg-hover);
}

.nav-item-wrapper.active .nav-icon-bg {
  border-radius: 14px;
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.nav-badge {
  position: absolute;
  top: 5px;
  right: 4px;
  background-color: var(--color-error);
  border-radius: 10px;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  box-shadow: 0 0 0 2px var(--color-bg-surface);
}

.nav-label {
  font-size: 11px;
  line-height: 1;
  color: var(--color-text-secondary);
  font-weight: 600;
  white-space: nowrap;
}

.nav-item-wrapper.active .nav-label {
  color: var(--color-text-primary);
  font-weight: 700;
}

.badge-text {
  color: #ffffff;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
}

.sidebar-bottom-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.settings-wrapper {
  flex: none;
}
</style>
