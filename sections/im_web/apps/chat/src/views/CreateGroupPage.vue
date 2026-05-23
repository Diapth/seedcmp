<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useContactStore } from '@tsdaodao/contacts-vue';
import { groupApi, useGroupStore } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';

const router = useRouter();
const contactStore = useContactStore();
const groupStore = useGroupStore();

const groupName = ref('');
const selectedUids = ref<string[]>([]);
const creating = ref(false);

onMounted(() => {
  contactStore.syncContacts();
});

function toggleSelect(uid: string) {
  const idx = selectedUids.value.indexOf(uid);
  if (idx > -1) {
    selectedUids.value.splice(idx, 1);
  } else {
    selectedUids.value.push(uid);
  }
}

async function handleCreate() {
  const name = groupName.value.trim();
  if (!name) {
    Message.warning('请输入群聊名称');
    return;
  }
  if (selectedUids.value.length === 0) {
    Message.warning('请选择至少一个群成员');
    return;
  }

  creating.value = true;
  try {
    const res: any = await groupApi.createGroup({
      name,
      members: selectedUids.value
    });
    
    const groupNo = res.data?.group_no || res.group_no;
    if (groupNo) {
      groupStore.upsertGroup(res.data || res);
      Message.success('群组创建成功');
      router.push(`/chat/conversation/${groupNo}/2`);
    } else {
      throw new Error('No group_no returned');
    }
  } catch (err: any) {
    Message.error(err.msg || '群组创建失败');
  } finally {
    creating.value = false;
  }
}

function handleGoBack() {
  router.push('/chat');
}
</script>

<template>
  <div class="create-group-page">
    <div class="page-header">
      <button class="back-btn" @click="handleGoBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="back-icon">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>
      <h3 class="page-title">发起群聊</h3>
    </div>

    <div class="page-content">
      <!-- Input Group Name -->
      <div class="input-section">
        <label class="section-label">群聊名称</label>
        <input 
          v-model="groupName" 
          type="text" 
          placeholder="请输入群聊名称..." 
          class="name-input"
          :disabled="creating"
        />
      </div>

      <!-- Friend Selector -->
      <div class="selector-section">
        <label class="section-label">选择联系人 (已选 {{ selectedUids.length }}人)</label>
        
        <div class="friends-list-wrapper">
          <div v-if="contactStore.contacts.length === 0" class="empty-state">
            <p>暂无联系人可选择</p>
          </div>
          
          <div v-else class="friends-list">
            <div 
              v-for="friend in contactStore.contacts" 
              :key="friend.uid" 
              class="selector-item"
              :class="{ selected: selectedUids.includes(friend.uid) }"
              @click="toggleSelect(friend.uid)"
            >
              <div class="checkbox-wrapper">
                <div class="custom-checkbox"></div>
              </div>
              
              <ChannelAvatar 
                :avatar="friend.avatar" 
                :name="friend.remark || friend.name" 
                :size="36" 
              />
              
              <span class="friend-name">{{ friend.remark || friend.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <button 
        class="create-btn" 
        :disabled="creating || !groupName.trim() || selectedUids.length === 0"
        @click="handleCreate"
      >
        {{ creating ? '正在创建...' : '立即创建' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.create-group-page {
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
  overflow-y: auto;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.name-input {
  height: 38px;
  padding: 0 12px;
  background-color: var(--bg-secondary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}

.name-input:focus {
  border-color: var(--primary-color, #165dff);
}

.selector-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 200px;
}

.friends-list-wrapper {
  flex: 1;
  overflow-y: auto;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-secondary);
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.friends-list {
  display: flex;
  flex-direction: column;
}

.selector-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  gap: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: var(--border-hairline);
}

.selector-item:hover {
  background-color: var(--bg-hover);
}

.checkbox-wrapper {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-checkbox {
  width: 16px;
  height: 16px;
  border: 1px solid var(--text-secondary);
  border-radius: 2px;
  position: relative;
  transition: border-color 0.2s, background-color 0.2s;
}

.selector-item.selected .custom-checkbox {
  border-color: var(--primary-color, #165dff);
  background-color: var(--primary-color, #165dff);
}

.selector-item.selected .custom-checkbox::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid #ffffff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.friend-name {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
}

.create-btn {
  height: 40px;
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.create-btn:hover {
  opacity: 0.9;
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
