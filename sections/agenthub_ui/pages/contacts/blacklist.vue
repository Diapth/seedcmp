<template>
  <AppSubpageShell>
    <view class="blacklist-page flex-column flex-1">
      
      <!-- Header -->
      <view class="header flex-row align-center">
        <view class="back-btn" @click="goBack">
          <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
        </view>
        <text class="title">黑名单管理</text>
      </view>
      
      <!-- Scrollable list -->
      <scroll-view scroll-y class="blacklist-scroll flex-1">
        <view class="list-container flex-column" v-if="contactStore.blacklist.length > 0">
          <view 
            v-for="item in contactStore.blacklist" 
            :key="item.id"
            class="blacklist-item glass-panel flex-row align-center justify-between"
          >
            <view class="user-info flex-row align-center gap-2">
              <AppAvatar :src="item.avatar" :text="item.nickname" :size="40" />
              <text class="nickname">{{ item.nickname }}</text>
            </view>
            <button class="btn-remove" @click="handleRemove(item)">移出</button>
          </view>
        </view>
        
        <!-- Empty state -->
        <view class="empty-container" v-else>
          <AppEmptyState 
            icon="settings" 
            title="黑名单为空" 
            description="您目前没有屏蔽任何联系人" 
          />
        </view>
      </scroll-view>
      
    </view>
  </AppSubpageShell>
</template>

<script setup>
import { onMounted } from 'vue';
import { useContactStore } from '@/stores/contact';
import { useNavigationStore } from '@/stores/navigation';
import { useConfirm } from '@/composables/useConfirm';
import AppSubpageShell from '@/components/layout/AppSubpageShell.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';
import AppEmptyState from '@/components/common/AppEmptyState.vue';

const contactStore = useContactStore();
const navStore = useNavigationStore();
const { confirm } = useConfirm();

onMounted(() => {
  navStore.setActiveModule('contacts');
});

function goBack() {
  uni.navigateBack();
}

function handleRemove(item) {
  confirm(`确定要将 ${item.nickname} 移出黑名单吗？移出后您将恢复接收对方的消息。`, {
    title: '移出黑名单',
    destructive: true
  }).then((ok) => {
    if (ok) {
      contactStore.removeFromBlacklist(item.id);
      uni.showToast({ title: '已移出黑名单', icon: 'success' });
    }
  });
}
</script>

<style scoped>
.blacklist-page {
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

.blacklist-scroll {
  height: 100%;
}

.list-container {
  padding: 16px;
  gap: 12px;
}

.blacklist-item {
  padding: 12px 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
}

.gap-2 {
  gap: 10px;
}

.user-info {
  display: flex;
  align-items: center;
}

.nickname {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.btn-remove {
  min-height: 44px;
  padding: 0 14px;
  background-color: var(--color-bg-base);
  color: var(--color-error);
  border: 1px solid var(--color-error);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.btn-remove::after { border: none; }

.empty-container {
  padding-top: 60px;
}
</style>
