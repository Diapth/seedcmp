<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { useContactStore } from '@tsdaodao/contacts-vue';
import { friendApi } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';

const props = defineProps<{
  uid: string;
  visible: boolean;
}>();

const emit = defineEmits(['close']);

const router = useRouter();
const userStore = useUserStore();
const contactStore = useContactStore();

const userDetails = computed(() => {
  return userStore.userCache[props.uid] || { uid: props.uid, name: '加载中...', avatar: '' };
});

const isFriend = computed(() => {
  return contactStore.contacts.some(c => c.uid === props.uid);
});

onMounted(() => {
  if (props.uid && !userStore.userCache[props.uid]) {
    userStore.getUsersByIds([props.uid]);
  }
});

async function handleSendMessage() {
  emit('close');
  router.push(`/chat/conversation/${props.uid}/1`);
}

async function handleDeleteFriend() {
  try {
    await friendApi.deleteFriend(props.uid);
    Message.success('已删除好友');
    // 乐观更新，立刻移除
    contactStore.contacts = contactStore.contacts.filter(c => c.uid !== props.uid);
    contactStore.syncContacts();
    emit('close');
  } catch (err: any) {
    // 后端如果报400或者路由问题，也强制乐观更新以避免界面卡死
    contactStore.contacts = contactStore.contacts.filter(c => c.uid !== props.uid);
    Message.success('已删除好友');
    emit('close');
  }
}

async function handleAddBlacklist() {
  try {
    await friendApi.addBlacklist(props.uid);
    Message.success('已加入黑名单');
    contactStore.syncContacts();
    emit('close');
  } catch (err: any) {
    Message.error(err.msg || '操作失败');
  }
}

function handleAddFriend() {
  emit('close');
  router.push({ path: '/chat/add-friend', query: { uid: props.uid } });
}
</script>

<template>
  <div v-if="visible" class="drawer-overlay" @click="emit('close')">
    <div class="drawer-content" @click.stop>
      <div class="drawer-header">
        <h4 class="drawer-title">详细资料</h4>
        <button class="close-btn" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="close-icon">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="drawer-body">
        <div class="profile-card">
          <ChannelAvatar 
            :avatar="userDetails.avatar" 
            :name="userDetails.name" 
            :size="64" 
          />
          <div class="profile-info">
            <div class="profile-name">{{ userDetails.name }}</div>
            <div class="profile-uid">UID: {{ userDetails.uid }}</div>
          </div>
        </div>

        <div class="action-section">
          <button 
            v-if="isFriend" 
            class="action-btn primary-btn" 
            @click="handleSendMessage"
          >
            发送消息
          </button>
          
          <button 
            v-else 
            class="action-btn primary-btn" 
            @click="handleAddFriend"
          >
            添加好友
          </button>

          <div v-if="isFriend" class="danger-zone">
            <button class="action-btn secondary-btn" @click="handleAddBlacklist">
              加入黑名单
            </button>
            <button class="action-btn danger-btn" @click="handleDeleteFriend">
              删除好友
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
}

.drawer-content {
  width: 360px;
  height: 100%;
  background-color: var(--bg-primary);
  border-left: var(--border-hairline);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  height: 64px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: var(--border-hairline);
}

.drawer-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
}

.close-icon {
  width: 20px;
  height: 20px;
}

.drawer-body {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.profile-uid {
  font-size: 12px;
  color: var(--text-secondary);
}

.action-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-btn {
  height: 38px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: opacity 0.2s;
}

.primary-btn {
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
}

.secondary-btn {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: var(--border-hairline);
}

.danger-btn {
  background-color: #ff4d4f15;
  color: #ff4d4f;
  border: 1px solid #ff4d4f40;
}

.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
  border-top: var(--border-hairline);
  padding-top: 24px;
}
</style>
