<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useChannelStore } from '@tsdaodao/datasource-vue';
import { useMessageStore } from '@tsdaodao/datasource-vue';
import { useConversationStore } from '@tsdaodao/datasource-vue';
import { GroupSettingsDrawer } from '@tsdaodao/base-vue';
import MessageList from '../components/MessageList.vue';
import MessageInput from '../components/MessageInput.vue';
import UserProfileDrawer from './UserProfileDrawer.vue';

const route = useRoute();
const router = useRouter();
const channelStore = useChannelStore();
const messageStore = useMessageStore();
const conversationStore = useConversationStore();

const showGroupSettings = ref(false);
const showUserProfile = ref(false);

const channelId = computed(() => route.params.channelId as string);
const channelType = computed(() => Number(route.params.channelType || 1));

const channelKey = computed(() => `${channelId.value}-${channelType.value}`);

const channelInfo = computed(() => {
  return channelStore.channels[channelKey.value];
});

const isTyping = computed(() => {
  const key = `${channelId.value}-${channelType.value}`;
  return messageStore.typingState[key]?.isTyping === true;
});

async function loadChannelDetails() {
  const cid = channelId.value;
  const ctype = channelType.value;
  if (!cid) return;

  if (!channelInfo.value) {
    channelStore.getChannelInfo(cid, ctype);
  }

  await messageStore.syncMessages(cid, ctype);
  await conversationStore.clearUnread(cid, ctype);
}

onMounted(() => {
  loadChannelDetails();
});

watch([channelId, channelType], () => {
  loadChannelDetails();
});

watch(() => messageStore.messages[channelKey.value]?.length, () => {
  void conversationStore.clearUnread(channelId.value, channelType.value);
});

function handleHeaderClick() {
  if (channelType.value === 1) {
    showUserProfile.value = true;
  }
}

function handleGroupSettingsClick() {
  showGroupSettings.value = true;
}

function handleMembersClick() {
  showGroupSettings.value = false;
  router.push(`/chat/group-members/${channelId.value}`);
}
</script>

<template>
  <div class="chat-view-container">
    <div class="chat-header">
      <div class="header-left" @click="handleHeaderClick" :style="{ cursor: channelType === 1 ? 'pointer' : 'default' }">
        <h3 class="channel-name">{{ channelInfo?.name || '正在加载...' }}</h3>
        <span v-if="isTyping" class="typing-indicator">对方正在输入...</span>
        <span v-else class="status-indicator">{{ channelType === 2 ? '群聊' : '在线' }}</span>
      </div>

      <div class="header-right">
        <button v-if="channelType === 2" class="settings-btn" @click="handleGroupSettingsClick" title="群聊设置">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="settings-icon">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>

    <MessageList 
      :channel-id="channelId" 
      :channel-type="channelType" 
    />

    <MessageInput 
      :channel-id="channelId" 
      :channel-type="channelType" 
    />

    <GroupSettingsDrawer 
      v-if="channelType === 2"
      :group-no="channelId"
      :visible="showGroupSettings"
      @close="showGroupSettings = false"
      @members-click="handleMembersClick"
    />

    <UserProfileDrawer 
      v-if="channelType === 1"
      :uid="channelId"
      :visible="showUserProfile"
      @close="showUserProfile = false"
    />
  </div>
</template>

<style scoped>
.chat-view-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-primary);
}

.chat-header {
  height: 64px;
  border-bottom: var(--border-hairline);
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--bg-primary);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.channel-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.status-indicator {
  font-size: 11px;
  color: var(--text-secondary);
}

.typing-indicator {
  font-size: 11px;
  color: var(--primary-color, #165dff);
  font-weight: 500;
  animation: pulse 1.5s infinite ease-in-out;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.settings-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s;
}

.settings-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.settings-icon {
  width: 20px;
  height: 20px;
}
</style>
