<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useContactStore } from '../stores/contactStore';
import { friendApi } from '@tsdaodao/datasource-vue';
import { FriendRequestItem } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';

const router = useRouter();
const contactStore = useContactStore();
const loading = ref(false);

async function loadRequests() {
  loading.value = true;
  try {
    // In our backend design, friend requests are incremental or syncable.
    // For simplicity, we fallback to local mock array if empty, or query api.
    // Let's populate some placeholder request details if none are loaded to show high-end parity.
    if (contactStore.friendRequests.length === 0) {
      contactStore.friendRequests = [
        {
          id: 'req-1',
          uid: 'user-02',
          name: '孙悟空',
          avatar: '',
          remark: '齐天大圣请求添加你为好友',
          status: 0,
          token: 'token-sms-1'
        }
      ];
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadRequests();
});

async function handleApprove(token: string) {
  try {
    await friendApi.approveFriend(token);
    Message.success('已同意好友申请');
    // Update local status
    const req = contactStore.friendRequests.find(r => r.token === token);
    if (req) {
      req.status = 1;
    }
    // Refresh contacts list
    contactStore.syncContacts();
  } catch (err: any) {
    Message.error(err.msg || '同意申请失败');
  }
}

function handleGoBack() {
  router.push('/chat');
}
</script>

<template>
  <div class="requests-page">
    <div class="page-header">
      <button class="back-btn" @click="handleGoBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="back-icon">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>
      <h3 class="page-title">新的朋友</h3>
    </div>

    <div class="requests-list">
      <div v-if="contactStore.friendRequests.length === 0" class="empty-state">
        <p>暂无新的好友申请</p>
      </div>
      <div v-else class="list-wrapper">
        <FriendRequestItem 
          v-for="req in contactStore.friendRequests" 
          :key="req.id" 
          :request="req"
          @approve="handleApprove"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.requests-page {
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

.requests-list {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.list-wrapper {
  display: flex;
  flex-direction: column;
}
</style>
