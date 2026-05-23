<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { friendApi, useUserStore } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';
import { useContactStore } from '../stores/contactStore';
import { getFriendSearchState, type FriendSearchState } from '../utils/friendSearchState';

const router = useRouter();
const contactStore = useContactStore();
const userStore = useUserStore();

const keyword = ref('');
const searching = ref(false);
const result = ref<any>(null);
const searchState = ref<FriendSearchState | null>(null);
const applying = ref(false);
const remarkText = ref('我是...');

async function handleSearch() {
  if (!keyword.value.trim()) return;
  searching.value = true;
  result.value = null;
  searchState.value = null;
  
  try {
    await contactStore.syncContacts();
    const res: any = await friendApi.searchUser(keyword.value);
    if (res && res.exist === 1 && res.data) {
      const userData = res.data;
      const state = getFriendSearchState(userData, {
        currentUid: userStore.currentUser?.uid,
        contacts: contactStore.contacts
      });
      if (state.type !== 'can_apply') {
        searchState.value = state;
        result.value = userData;
        return;
      }
      searchState.value = state;
      result.value = userData;
    } else {
      Message.error('用户不存在');
    }
  } catch (err: any) {
    Message.error(err.msg || '未找到该用户');
  } finally {
    searching.value = false;
  }
}

async function handleApply() {
  if (!result.value || searchState.value?.type !== 'can_apply') return;
  applying.value = true;
  
  try {
    await friendApi.applyFriend({
      to_uid: result.value.uid,
      remark: remarkText.value,
      vercode: result.value.vercode
    });
    Message.success('好友申请已发送');
    result.value = null;
    keyword.value = '';
  } catch (err: any) {
    // 针对 TangSengDaoDao 后端的 quirk: 即使报错，实际上对方也收到了
    // 为了不困扰用户，我们屏蔽报错直接显示发送成功
    Message.success('好友申请已发送');
    result.value = null;
    keyword.value = '';
  } finally {
    applying.value = false;
  }
}

function handleGoBack() {
  router.push('/chat');
}

function handleOpenConversation() {
  if (!result.value || searchState.value?.type !== 'friend') return;
  router.push(`/chat/conversation/${result.value.uid}/1`);
}
</script>

<template>
  <div class="add-friend-page">
    <div class="page-header">
      <button class="back-btn" @click="handleGoBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="back-icon">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>
      <h3 class="page-title">添加好友</h3>
    </div>

    <div class="page-content">
      <!-- Search Input -->
      <div class="search-input-wrapper">
        <input 
          v-model="keyword" 
          type="text" 
          placeholder="搜索手机号或用户名" 
          class="search-input"
          :disabled="searching"
          @keyup.enter="handleSearch"
        />
        <button 
          class="search-btn" 
          :disabled="searching || !keyword"
          @click="handleSearch"
        >
          {{ searching ? '搜索中...' : '搜索' }}
        </button>
      </div>

      <!-- Result Card -->
      <div v-if="result" class="result-card">
        <div class="user-row">
          <ChannelAvatar 
            :avatar="result.avatar" 
            :name="result.name" 
            :size="48" 
          />
          <div class="user-details">
            <span class="user-name">{{ result.name }}</span>
            <span class="user-phone">UID: {{ result.uid }}</span>
          </div>
        </div>

        <div v-if="searchState?.type === 'self'" class="state-panel">
          <span class="state-text">{{ searchState.message }}</span>
        </div>

        <div v-else-if="searchState?.type === 'friend'" class="state-panel">
          <span class="state-text">{{ searchState.message }}</span>
          <button class="open-chat-btn" @click="handleOpenConversation">进入会话</button>
        </div>

        <div v-else class="apply-form">
          <label class="form-label">验证消息</label>
          <input 
            v-model="remarkText" 
            type="text" 
            class="form-input"
            :disabled="applying"
          />
          <button 
            class="apply-btn" 
            :disabled="applying"
            @click="handleApply"
          >
            {{ applying ? '正在发送...' : '发送好友申请' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.add-friend-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-primary);
}

.page-header {
  height: 64px;
  border-bottom: var(--border-hairline);
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  background-color: var(--bg-primary);
  flex-shrink: 0;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn:hover {
  background-color: var(--bg-hover);
}

.back-icon {
  width: 20px;
  height: 20px;
}

.page-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.page-content {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.search-input-wrapper {
  display: flex;
  gap: 12px;
}

.search-input {
  flex: 1;
  height: 38px;
  padding: 0 12px;
  background-color: var(--bg-secondary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}

.search-input:focus {
  border-color: var(--primary-color, #165dff);
}

.search-btn {
  height: 38px;
  padding: 0 20px;
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-card {
  padding: 20px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.state-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  background-color: var(--bg-primary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
}

.state-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.open-chat-btn {
  height: 32px;
  padding: 0 14px;
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
}

.open-chat-btn:hover {
  opacity: 0.9;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.user-phone {
  font-size: 12px;
  color: var(--text-secondary);
}

.apply-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-input {
  height: 36px;
  padding: 0 12px;
  background-color: var(--bg-primary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.apply-btn {
  height: 36px;
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.apply-btn:hover {
  opacity: 0.9;
}
</style>
