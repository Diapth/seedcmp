<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { friendApi } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';

const router = useRouter();

const blacklist = ref<any[]>([]);
const loading = ref(false);

async function loadBlacklist() {
  loading.value = true;
  try {
    const res: any = await friendApi.getBlacklist();
    blacklist.value = Array.isArray(res) ? res : (res?.list || []);
  } catch (err: any) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadBlacklist();
});

async function handleRemove(uid: string) {
  try {
    await friendApi.removeBlacklist(uid);
    Message.success('已解除黑名单');
    blacklist.value = blacklist.value.filter(item => item.uid !== uid);
  } catch (err: any) {
    Message.error(err.msg || '移除失败');
  }
}

function handleGoBack() {
  router.push('/chat');
}
</script>

<template>
  <div class="blacklist-page">
    <div class="page-header">
      <button class="back-btn" @click="handleGoBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="back-icon">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>
      <h3 class="page-title">黑名单管理</h3>
    </div>

    <div class="page-content">
      <div v-if="blacklist.length === 0" class="empty-state">
        <p>暂无被拉黑的用户</p>
      </div>

      <div v-else class="blacklist-list">
        <div v-for="user in blacklist" :key="user.uid" class="blacklist-item">
          <ChannelAvatar 
            :avatar="user.avatar" 
            :name="user.name" 
            :size="36" 
          />
          <div class="item-body">
            <span class="user-name">{{ user.name }}</span>
            <span class="user-phone">UID: {{ user.uid }}</span>
          </div>
          <button class="remove-btn" @click="handleRemove(user.uid)">
            移出
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.blacklist-page {
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
  overflow-y: auto;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.blacklist-list {
  display: flex;
  flex-direction: column;
}

.blacklist-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
  border-bottom: var(--border-hairline);
  background-color: var(--bg-primary);
}

.item-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.user-phone {
  font-size: 11px;
  color: var(--text-secondary);
}

.remove-btn {
  height: 26px;
  padding: 0 12px;
  background-color: var(--bg-secondary);
  border: var(--border-hairline);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.remove-btn:hover {
  background-color: var(--bg-hover);
}
</style>
