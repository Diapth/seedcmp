<template>
  <AppShell>
    <view class="group-landing flex-column flex-1">
      
      <!-- Header -->
      <view class="group-header flex-row justify-between align-center">
        <text class="group-title">群聊列表</text>
        <button class="btn-create-group" @click="createGroup">
          <AppIcon name="plus" :size="16" color="#ffffff" />
          <text class="btn-text">创建群组</text>
        </button>
      </view>
      
      <!-- Content scroll list -->
      <scroll-view scroll-y class="group-scroll flex-1">
        <view class="group-list" v-if="groupChats.length > 0">
          <view 
            v-for="chat in groupChats" 
            :key="chat.id" 
            class="group-card flex-row align-center"
            @click="enterGroup(chat.id)"
          >
            <AppAvatar :src="chat.avatar" :text="chat.name" :size="48" :is-circle="false" />
            <view class="group-info flex-1 flex-column justify-between">
              <text class="group-name">{{ chat.name }}</text>
              <text class="group-last-msg">{{ chat.lastMessage }}</text>
            </view>
            <AppIcon name="chevron-right" :size="16" color="var(--color-text-secondary)" />
          </view>
        </view>
        
        <!-- Empty Placeholder -->
        <view v-else class="empty-padding">
          <AppEmptyState 
            icon="group" 
            title="暂无群聊" 
            description="您还没有加入任何群组。可以点击右上角新建群聊！" 
          />
        </view>
      </scroll-view>
      
    </view>
  </AppShell>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useNavigationStore } from '@/stores/navigation';
import { useConversationStore } from '@/stores/conversation';
import { useGroupStore } from '@/stores/group';
import AppShell from '@/components/layout/AppShell.vue';
import AppEmptyState from '@/components/common/AppEmptyState.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';
import AppIcon from '@/components/common/AppIcon.vue';

const navStore = useNavigationStore();
const convStore = useConversationStore();
const groupStore = useGroupStore();

onMounted(() => {
  navStore.setActiveModule('group');
  groupStore.syncNativeGroups({ silent: true });
});

const groupChats = computed(() => {
  return convStore.conversations.filter(c => c.type === 'group');
});

function createGroup() {
  uni.navigateTo({
    url: '/pages/group/create'
  });
}

function enterGroup(id) {
  uni.navigateTo({
    url: `/pages/chat/detail?id=${id}`
  });
}
</script>

<style scoped>
.group-landing {
  height: 100%;
  background-color: var(--color-bg-base);
}

.group-header {
  padding: 16px 20px;
  background-color: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
}

.group-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.btn-create-group {
  background-color: var(--color-primary);
  color: #ffffff;
  padding: 0 16px;
  height: 36px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-create-group::after {
  border: none;
}
.btn-text {
  color: #ffffff;
}

.group-scroll {
  height: 100%;
}

.group-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-card {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 14px 16px;
  gap: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  &:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }
}

.group-info {
  height: 44px;
}

.group-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.group-last-msg {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.empty-padding {
  padding-top: 60px;
}
</style>
