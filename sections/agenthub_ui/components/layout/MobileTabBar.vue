<template>
  <view class="mobile-tab-bar" :style="{ paddingBottom: safeAreaInsets.bottom + 'px' }">
    <view 
      v-for="item in tabItems" 
      :key="item.id"
      class="tab-item"
      :class="{ active: navStore.activeModule === item.id }"
      @click="switchModule(item)"
    >
      <view class="tab-icon-wrapper">
        <AppIcon 
          :name="item.icon" 
          :size="22" 
          :color="navStore.activeModule === item.id ? 'var(--color-primary)' : 'var(--color-text-secondary)'" 
        />
        <!-- Badge -->
        <view class="tab-badge" v-if="item.id === 'chat' && totalUnread > 0">
          <text class="badge-text">{{ formatUnread(totalUnread) }}</text>
        </view>
      </view>
      <text class="tab-label">{{ item.label }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { useNavigationStore } from '@/stores/navigation';
import { useConversationStore } from '@/stores/conversation';
import { useSafeArea } from '@/composables/useSafeArea';
import { formatUnread } from '@/utils/formatConversation';
import AppIcon from '../common/AppIcon.vue';

const navStore = useNavigationStore();
const convStore = useConversationStore();
const { safeAreaInsets } = useSafeArea();

const totalUnread = computed(() => {
  return convStore.conversations.reduce((acc, c) => acc + (c.unread || 0), 0);
});

const tabItems = computed(() => {
  const allowed = ['chat', 'contacts', 'agents', 'files'];
  return [
    ...navStore.modules.filter(item => allowed.includes(item.id)),
    navStore.settingsItem
  ];
});

function switchModule(item) {
  navStore.setActiveModule(item.id);
  uni.redirectTo({
    url: item.path
  });
}
</script>

<style scoped>
.mobile-tab-bar {
  width: 100%;
  background-color: var(--color-bg-surface);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  padding-top: 8px;
  padding-bottom: 8px;
  box-sizing: border-box;
  z-index: 99;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 4px 0;
  cursor: pointer;
}

.tab-icon-wrapper {
  position: relative;
  display: inline-flex;
  margin-bottom: 4px;
}

.tab-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  font-weight: 500;
  transition: color 0.15s ease;
}

.tab-item.active .tab-label {
  color: var(--color-primary);
  font-weight: 600;
}

.tab-badge {
  position: absolute;
  top: -6px;
  right: -10px;
  background-color: var(--color-error);
  border-radius: 8px;
  min-width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  box-shadow: 0 0 0 2px var(--color-bg-surface);
}

.badge-text {
  color: #ffffff;
  font-size: 8px;
  font-weight: 600;
  line-height: 1;
}
</style>
