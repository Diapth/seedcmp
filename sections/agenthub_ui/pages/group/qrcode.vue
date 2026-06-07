<template>
  <AppSubpageShell>
    <view class="qr-page flex-column flex-1">
      <view class="qr-header flex-row align-center justify-between">
        <view class="header-left flex-row align-center">
          <view class="back-btn" @click="goBack">
            <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
          </view>
          <text class="title">群二维码</text>
        </view>
      </view>

      <scroll-view scroll-y class="qr-scroll flex-1">
        <view class="qr-container">
          <view class="group-card flex-row align-center">
            <AppAvatar :text="groupInfo.name" :src="groupInfo.avatar" :size="56" :is-circle="false" />
            <view class="group-copy flex-column flex-1">
              <text class="group-name">{{ groupInfo.name }}</text>
              <text class="group-meta">32 人 · 1 个智能体 · 邀请需管理员审批</text>
            </view>
          </view>

          <view class="qr-card">
            <text class="qr-demo-caption">群二维码后端能力待接入</text>
            <view class="qr-box unavailable">
              <AppIcon name="info" :size="32" color="var(--color-text-muted)" />
            </view>
            <text class="qr-title">群二维码暂不可用</text>
            <text class="qr-desc">接入真实群二维码 token 与审批接口后可分享给成员。</text>
            <view class="action-row">
              <button class="btn-primary" @click="showQrUnavailable">暂不可用</button>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </AppSubpageShell>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useNavigationStore } from '@/stores/navigation';
import { useConversationStore } from '@/stores/conversation';
import AppSubpageShell from '@/components/layout/AppSubpageShell.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';

const navStore = useNavigationStore();
const convStore = useConversationStore();

const groupInfo = computed(() => {
  return convStore.activeConversation || convStore.conversations.find(item => item.id === convStore.activeId && item.channelType === 2) || {
    id: convStore.activeId || '',
    name: '群聊',
    avatar: ''
  };
});

onMounted(() => {
  navStore.setActiveModule('contacts');
});

function showQrUnavailable() {
  uni.showToast({ title: '群二维码需接入真实接口', icon: 'none' });
}

function goBack() {
  uni.navigateBack({
    fail: () => uni.redirectTo({ url: '/pages/group/members' })
  });
}
</script>

<style scoped>
.qr-page {
  height: 100%;
  background-color: var(--color-bg-base);
}

.qr-header {
  min-height: 64px;
  padding: 0 32px;
  background-color: var(--color-glass-bg);
  border-bottom: 1px solid var(--color-border);
  backdrop-filter: blur(12px);
  box-sizing: border-box;
}

.header-left {
  gap: 12px;
}

.back-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.back-btn:hover {
  background-color: var(--color-bg-hover);
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.qr-scroll {
  height: 100%;
}

.qr-container {
  width: min(620px, 100%);
  margin: 0 auto;
  padding: 28px 24px 40px;
  box-sizing: border-box;
}

.group-card,
.qr-card {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}

.group-card {
  padding: 18px;
  gap: 14px;
  display: flex;
}

.group-copy {
  gap: 4px;
  min-width: 0;
}

.group-name {
  font-size: 17px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.group-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.status-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 16px 0;
}

.status-tab {
  min-height: 44px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.status-tab.active {
  color: var(--color-primary);
  background-color: var(--color-primary-light);
  border-color: rgba(0, 74, 198, 0.16);
}

.qr-card {
  padding: 24px;
  text-align: center;
}

.qr-demo-caption {
  display: block;
  font-size: 11px;
  color: var(--color-text-muted);
  font-style: italic;
  margin-bottom: 12px;
}

.qr-box {
  width: 252px;
  height: 252px;
  margin: 0 auto 18px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid var(--color-border);
  background-color: var(--qr-surface);
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 4px;
  box-sizing: border-box;
}

.qr-box.disabled {
  opacity: 0.38;
}

.qr-cell {
  border-radius: 3px;
  background-color: var(--color-bg-muted);
}

.qr-cell.active {
  background-color: var(--color-text-primary);
}

.qr-title {
  display: block;
  font-size: 18px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.qr-desc {
  display: block;
  margin: 8px auto 0;
  max-width: 360px;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 20px;
}

.btn-primary,
.btn-secondary {
  min-height: 44px;
  border-radius: 10px;
  margin: 0;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.btn-primary {
  color: #ffffff;
  background-color: var(--color-primary);
}

.btn-secondary {
  color: var(--color-text-primary);
  background-color: var(--color-bg-muted);
  border: 1px solid var(--color-border);
}

.btn-primary::after,
.btn-secondary::after {
  border: none;
}

@media (max-width: 768px) {
  .qr-header {
    min-height: 56px;
    padding: 0 12px;
  }

  .qr-container {
    padding: 16px;
  }

  .action-row {
    grid-template-columns: 1fr;
  }
}
</style>
