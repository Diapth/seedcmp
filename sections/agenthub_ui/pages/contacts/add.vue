<template>
  <AppSubpageShell>
    <view class="add-friend-page flex-column flex-1">
      
      <!-- Header -->
      <view class="header flex-row align-center">
        <view class="back-btn" @click="goBack">
          <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
        </view>
        <text class="title">添加朋友</text>
      </view>
      
      <!-- Content Area -->
      <view class="content-box flex-column">
        <!-- Search input -->
        <view class="search-section glass-panel">
          <view class="search-bar flex-row align-center">
            <AppIcon name="search" :size="18" color="var(--color-text-muted)" class="search-icon" />
            <input 
              type="text" 
              v-model="searchQuery" 
              placeholder="请输入手机号/昵称/ID 搜索..." 
              class="search-input flex-1"
              confirm-type="search"
              @confirm="handleSearch"
            />
            <button class="btn-search" @click="handleSearch">搜索</button>
          </view>
        </view>
        
        <!-- Search Result -->
        <view class="result-section flex-column" v-if="searchResult">
          <view class="result-card glass-panel flex-row align-center gap-3">
            <AppAvatar :src="searchResult.avatar" :text="searchResult.nickname" :size="56" />
            <view class="user-meta flex-column justify-center flex-1">
              <text class="user-name">{{ searchResult.nickname }}</text>
              <text class="user-desc" v-if="searchResult.phone">手机号: {{ searchResult.phone }}</text>
            </view>
          </view>
          
          <!-- Actions depending on relationship status -->
          <view class="action-panel flex-column">
            <!-- Already friend -->
            <view class="status-tip flex-row align-center gap-2" v-if="searchResult.relationship === 'friend'">
              <AppIcon name="check" :size="16" color="var(--color-success)" />
              <text class="tip-text success">已是好友，可以直接发送消息</text>
              <button class="btn-primary-action" @click="goChat">发送消息</button>
            </view>
            
            <!-- In Blacklist -->
            <view class="status-tip flex-row align-center gap-2" v-else-if="searchResult.relationship === 'blacklist'">
              <AppIcon name="info" :size="16" color="var(--color-error)" />
              <text class="tip-text error">该用户已在您的黑名单中</text>
              <button class="btn-secondary-action" @click="unblock">移出黑名单</button>
            </view>
            
            <!-- Request pending -->
            <view class="status-tip flex-row align-center gap-2" v-else-if="searchResult.relationship === 'pending_received'">
              <AppIcon name="info" :size="16" color="var(--color-warning)" />
              <text class="tip-text warning">对方已向您发送好友申请，请在“新的朋友”中处理</text>
              <button class="btn-primary-action" @click="goRequests">去处理</button>
            </view>
            
            <!-- Can add -->
            <view class="add-flow-section flex-column" v-else>
              <view class="verification-box flex-column">
                <text class="box-label">填写验证消息</text>
                <textarea 
                  v-model="verificationMsg" 
                  placeholder="我是..." 
                  class="verification-input"
                  maxlength="50"
                />
              </view>
              <button class="btn-send-request" :loading="sending" @click="sendRequest">发送申请</button>
            </view>
          </view>
        </view>
        
        <!-- Empty or error state -->
        <view class="empty-state-container" v-if="searched && !searchResult">
          <AppEmptyState 
            icon="search" 
            title="未找到相关用户" 
            description="请检查输入的手机号或昵称是否正确，或尝试其他搜索词" 
          />
        </view>
      </view>
      
    </view>
  </AppSubpageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useContactStore } from '@/stores/contact';
import { useConversationStore } from '@/stores/conversation';
import { useNavigationStore } from '@/stores/navigation';
import AppSubpageShell from '@/components/layout/AppSubpageShell.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';
import AppEmptyState from '@/components/common/AppEmptyState.vue';

const contactStore = useContactStore();
const convStore = useConversationStore();
const navStore = useNavigationStore();

onMounted(() => {
  navStore.setActiveModule('contacts');
});

const searchQuery = ref('');
const searched = ref(false);
const searchResult = ref(null);
const verificationMsg = ref('你好，我想添加你为好友');
const sending = ref(false);

function goBack() {
  uni.navigateBack();
}

function handleSearch() {
  const query = searchQuery.value.trim();
  if (!query) {
    uni.showToast({ title: '请输入搜索内容', icon: 'none' });
    return;
  }
  
  searched.value = true;
  
  // 1. Check existing friends
  const friend = contactStore.contacts.find(
    c => c.nickname === query || c.phone === query || c.id === query
  );
  if (friend) {
    searchResult.value = {
      id: friend.id,
      nickname: friend.nickname,
      phone: friend.phone,
      avatar: friend.avatar,
      relationship: 'friend'
    };
    return;
  }
  
  // 2. Check blacklist
  const black = contactStore.blacklist.find(
    b => b.nickname === query || b.phone === query || b.id === query
  );
  if (black) {
    searchResult.value = {
      id: black.id,
      nickname: black.nickname,
      phone: black.phone || '',
      avatar: black.avatar,
      relationship: 'blacklist'
    };
    return;
  }
  
  // 3. Check received pending requests
  const pending = contactStore.friendRequests.find(
    r => (r.nickname === query || r.id === query) && r.status === 'pending'
  );
  if (pending) {
    searchResult.value = {
      id: pending.id,
      nickname: pending.nickname,
      phone: '',
      avatar: '',
      relationship: 'pending_received'
    };
    return;
  }
  
  // 4. Mock a new user if search string matches some criteria
  // If query length >= 2, we let them search and add
  if (query.length >= 2) {
    searchResult.value = {
      id: String(Date.now()),
      nickname: query,
      phone: query.match(/^\d+$/) ? query : '139' + Math.floor(Math.random() * 90000000 + 10000000),
      avatar: '',
      relationship: 'stranger'
    };
  } else {
    searchResult.value = null;
  }
}

function goChat() {
  if (!searchResult.value) return;
  
  let conv = convStore.conversations.find(c => c.id === searchResult.value.id);
  if (!conv) {
    conv = {
      id: searchResult.value.id,
      name: searchResult.value.nickname,
      avatar: searchResult.value.avatar,
      type: 'single',
      unread: 0,
      lastMessage: '已添加您为好友，现在可以开始聊天了。',
      lastTime: Date.now(),
      isPinned: false,
      isMuted: false,
      draft: ''
    };
    convStore.conversations.push(conv);
  }
  convStore.setActiveId(searchResult.value.id);
  uni.setStorageSync('active_conversation_id', searchResult.value.id);
  uni.redirectTo({
    url: '/pages/chat/index'
  });
}

function unblock() {
  if (!searchResult.value) return;
  contactStore.removeFromBlacklist(searchResult.value.id);
  uni.showToast({ title: '已移出黑名单', icon: 'success' });
  searchResult.value.relationship = 'friend';
}

function goRequests() {
  uni.navigateTo({
    url: '/pages/contacts/friend-requests'
  });
}

async function sendRequest() {
  if (!searchResult.value) return;
  sending.value = true;

  try {
    await contactStore.sendFriendRequest(searchResult.value.id || searchResult.value.nickname, verificationMsg.value);
    sending.value = false;
    uni.showToast({ title: '好友申请已发送', icon: 'success' });
    uni.navigateBack();
  } catch (err) {
    sending.value = false;
    uni.showToast({ title: err?.message || '好友申请发送失败', icon: 'none' });
  }
}
</script>

<style scoped>
.add-friend-page {
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

.content-box {
  padding: 16px;
  gap: 16px;
}

.search-section {
  padding: 12px;
  border-radius: 12px;
}

.search-bar {
  position: relative;
  gap: 12px;
}

.search-input {
  height: 40px;
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding-left: 12px;
  padding-right: 12px;
  font-size: 14px;
  color: var(--color-text-primary);
}

.btn-search {
  height: 40px;
  padding: 0 16px;
  background-color: var(--color-primary);
  color: #ffffff;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.btn-search::after { border: none; }

.result-section {
  gap: 16px;
}

.result-card {
  padding: 16px;
  border-radius: 12px;
}

.gap-3 {
  gap: 16px;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.user-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.action-panel {
  padding: 16px;
  border-radius: 12px;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  gap: 16px;
}

.status-tip {
  padding: 12px;
  border-radius: 8px;
  background-color: var(--color-bg-base);
  align-items: center;
}

.tip-text {
  font-size: 13px;
  font-weight: 500;
}
.tip-text.success { color: var(--color-success); }
.tip-text.error { color: var(--color-error); }
.tip-text.warning { color: var(--color-warning); }

.btn-primary-action {
  margin-top: 12px;
  height: 42px;
  background-color: var(--color-primary);
  color: #ffffff;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  width: 100%;
}
.btn-primary-action::after { border: none; }

.btn-secondary-action {
  margin-top: 12px;
  height: 42px;
  background-color: var(--color-bg-base);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 14px;
  width: 100%;
}
.btn-secondary-action::after { border: none; }

.add-flow-section {
  gap: 16px;
}

.verification-box {
  gap: 8px;
}

.box-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.verification-input {
  width: 100%;
  height: 80px;
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  color: var(--color-text-primary);
  box-sizing: border-box;
}

.btn-send-request {
  height: 44px;
  background-color: var(--color-primary);
  color: #ffffff;
  border-radius: 8px;
  border: none;
  font-size: 15px;
  font-weight: 600;
  width: 100%;
}
.btn-send-request::after { border: none; }

.empty-state-container {
  padding-top: 40px;
}
</style>
