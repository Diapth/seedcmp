<template>
  <AppSubpageShell>
    <view class="requests-page flex-column flex-1">
      
      <!-- Top header -->
      <view class="header flex-row align-center">
        <view class="back-btn" @click="goBack">
          <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
        </view>
        <text class="title">新的朋友</text>
      </view>
      
      <!-- List Scroll -->
      <scroll-view scroll-y class="requests-scroll flex-1">
        <view class="requests-list" v-if="contactStore.friendRequests.length > 0">
          <view 
            v-for="req in contactStore.friendRequests" 
            :key="req.id"
            class="request-card flex-row align-center justify-between"
          >
            <view class="req-left flex-row align-center gap-2">
              <AppAvatar :src="req.avatar || ''" :text="req.nickname" :size="44" />
              <view class="req-info flex-column justify-between">
                <text class="req-name">{{ req.nickname }}</text>
                <text class="req-msg">{{ req.message }}</text>
              </view>
            </view>
            
            <view class="req-actions flex-row gap-2">
              <template v-if="req.status === 'pending'">
                <button class="btn-refuse" @click="handleReject(req.id)">拒绝</button>
                <button class="btn-accept" @click="handleAccept(req.id)">同意</button>
              </template>
              <text class="status-text accepted" v-else-if="req.status === 'accepted'">已同意</text>
              <text class="status-text accepted" v-else-if="req.status === 'sent'">已发送</text>
              <text class="status-text rejected" v-else>已拒绝</text>
            </view>
          </view>
        </view>
        
        <!-- Empty -->
        <view class="empty-padding" v-else>
          <AppEmptyState icon="user" title="没有新的好友申请" />
        </view>
      </scroll-view>
      
    </view>
  </AppSubpageShell>
</template>

<script setup>
import { onMounted } from 'vue';
import { useContactStore } from '@/stores/contact';
import { useNavigationStore } from '@/stores/navigation';
import AppSubpageShell from '@/components/layout/AppSubpageShell.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';
import AppEmptyState from '@/components/common/AppEmptyState.vue';
import AppIcon from '@/components/common/AppIcon.vue';

const contactStore = useContactStore();
const navStore = useNavigationStore();

onMounted(() => {
  navStore.setActiveModule('contacts');
  contactStore.fetchNativeFriendRequests({ silent: true });
});

function goBack() {
  uni.navigateBack();
}

async function handleAccept(id) {
  try {
    await contactStore.approveNativeRequest(id);
    uni.showToast({ title: '已添加该好友', icon: 'success' });
  } catch (error) {
    contactStore.acceptRequest(id);
    uni.showToast({ title: error?.msg || '已使用本地通过', icon: 'none' });
  }
}

function handleReject(id) {
  contactStore.rejectRequest(id);
  uni.showToast({ title: '已拒绝申请', icon: 'none' });
}
</script>

<style scoped>
.requests-page {
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

.requests-scroll {
  height: 100%;
}

.requests-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.request-card {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
}

.gap-2 {
  gap: 10px;
}

.req-left {
  max-width: 65%;
  display: flex;
}

.req-info {
  height: 40px;
  display: flex;
}

.req-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.req-msg {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.req-actions {
  align-items: center;
  display: flex;
}

.btn-accept {
  min-height: 44px;
  background-color: var(--color-primary);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  border-radius: 8px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  border: none;
}
.btn-accept::after { border: none; }

.btn-refuse {
  min-height: 44px;
  background-color: var(--color-bg-base);
  color: var(--color-text-secondary);
  font-size: 13px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0 16px;
  display: flex;
  align-items: center;
}
.btn-refuse::after { border: none; }

.status-text {
  font-size: 13px;
  font-weight: 500;
}
.accepted { color: var(--color-text-muted); }
.rejected { color: var(--color-error); }

.empty-padding {
  padding-top: 60px;
}
</style>
