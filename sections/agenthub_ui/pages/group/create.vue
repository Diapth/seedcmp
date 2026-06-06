<template>
  <AppSubpageShell>
    <view class="create-group-page flex-column flex-1">
      
      <!-- Header -->
      <view class="header flex-row align-center justify-between">
        <view class="header-left flex-row align-center">
          <view class="back-btn" @click="goBack">
            <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
          </view>
          <text class="title">发起群聊</text>
        </view>
        <button 
          class="btn-submit" 
          :disabled="selectedFriends.length === 0 || !groupName.trim()" 
          @click="handleCreate"
        >
          确定({{ selectedFriends.length }})
        </button>
      </view>
      
      <!-- Group Info Form -->
      <view class="form-section glass-panel">
        <view class="input-row flex-row align-center">
          <text class="label">群聊名称</text>
          <input 
            type="text" 
            v-model="groupName" 
            placeholder="请输入群聊名称..." 
            class="group-name-input flex-1"
            placeholder-style="color: var(--color-text-muted)"
          />
        </view>
      </view>
      
      <text class="section-title">选择联系人</text>
      
      <!-- Friends List -->
      <scroll-view scroll-y class="friends-scroll flex-1">
        <view class="friends-list" v-if="contactStore.contacts.length > 0">
          <view 
            v-for="item in contactStore.contacts" 
            :key="item.id"
            class="friend-item flex-row align-center justify-between"
            @click="toggleSelect(item.id)"
          >
            <view class="friend-info flex-row align-center gap-3">
              <AppAvatar :src="item.avatar" :text="item.nickname" :size="40" />
              <text class="nickname">{{ item.nickname }}</text>
            </view>
            <view class="checkbox" :class="{ checked: selectedFriends.includes(item.id) }">
              <AppIcon name="check" :size="14" color="#ffffff" v-if="selectedFriends.includes(item.id)" />
            </view>
          </view>
        </view>
        
        <!-- Empty Contacts -->
        <view class="empty-padding" v-else>
          <AppEmptyState icon="user" title="暂无可选择的好友" />
        </view>
      </scroll-view>
      
    </view>
  </AppSubpageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useContactStore } from '@/stores/contact';
import { useConversationStore } from '@/stores/conversation';
import { useMessageStore } from '@/stores/message';
import { useNavigationStore } from '@/stores/navigation';
import AppSubpageShell from '@/components/layout/AppSubpageShell.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';
import AppEmptyState from '@/components/common/AppEmptyState.vue';

const contactStore = useContactStore();
const convStore = useConversationStore();
const msgStore = useMessageStore();
const navStore = useNavigationStore();

onMounted(() => {
  // Group subpages are currently attached to the contacts module (no group tab in MobileTabBar).
  navStore.setActiveModule('contacts');
});

const groupName = ref('');
const selectedFriends = ref([]);

function goBack() {
  uni.navigateBack();
}

function toggleSelect(id) {
  const index = selectedFriends.value.indexOf(id);
  if (index === -1) {
    selectedFriends.value.push(id);
  } else {
    selectedFriends.value.splice(index, 1);
  }
}

function handleCreate() {
  const name = groupName.value.trim();
  if (!name) {
    uni.showToast({ title: '请输入群聊名称', icon: 'none' });
    return;
  }
  
  if (selectedFriends.value.length === 0) {
    uni.showToast({ title: '请选择群成员', icon: 'none' });
    return;
  }
  
  const newGroupId = 'group_' + Date.now();
  
  // 1. Add to conversation store
  const newConv = {
    id: newGroupId,
    name: name,
    avatar: '',
    type: 'group',
    unread: 0,
    lastMessage: '你创建了群聊',
    lastTime: Date.now(),
    isPinned: false,
    isMuted: false,
    draft: ''
  };
  convStore.conversations.push(newConv);
  
  // 2. Add system welcome message
  msgStore.messages[newGroupId] = [
    {
      id: Date.now().toString(),
      senderId: 'system',
      senderName: '系统',
      content: `你创建了群聊 "${name}"`,
      type: 'system',
      time: Date.now(),
      status: 'success'
    }
  ];
  
  // 3. Set active and jump
  convStore.setActiveId(newGroupId);
  
  uni.showToast({ title: '群聊创建成功', icon: 'success' });
  
  setTimeout(() => {
    uni.redirectTo({
      url: `/pages/chat/detail?id=${newGroupId}`
    });
  }, 800);
}
</script>

<style scoped>
.create-group-page {
  height: 100%;
  background-color: var(--color-bg-base);
}

.header {
  height: 56px;
  padding: 0 16px;
  background-color: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
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
  flex-shrink: 0;
}

.title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.btn-submit {
  min-height: 44px;
  background-color: var(--color-primary);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  border: none;
  cursor: pointer;
}
.btn-submit:disabled {
  background-color: var(--color-bg-muted);
  color: var(--color-text-muted);
  cursor: not-allowed;
}
.btn-submit::after { border: none; }

.form-section {
  margin: 16px;
  padding: 12px 16px;
  border-radius: 12px;
}

.input-row {
  height: 44px;
  gap: 16px;
}

.label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
  width: 70px;
}

.group-name-input {
  height: 100%;
  border: none;
  font-size: 15px;
  color: var(--color-text-primary);
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-left: 20px;
  margin-bottom: 8px;
}

.friends-scroll {
  height: 100%;
}

.friends-list {
  background-color: var(--color-bg-surface);
  border-top: 1px solid var(--color-border);
}

.friend-item {
  height: 56px;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  background-color: var(--color-bg-surface);
  transition: background-color 0.2s ease;
  display: flex;
}
.friend-item:hover {
  background-color: var(--color-bg-hover);
}

.gap-3 {
  gap: 12px;
}

.friend-info {
  display: flex;
  align-items: center;
}

.nickname {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.checkbox.checked {
  border-color: var(--color-primary);
  background-color: var(--color-primary);
}

.empty-padding {
  padding-top: 40px;
}
</style>
