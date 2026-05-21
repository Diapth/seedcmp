<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useConversationStore } from '@tsdaodao/datasource-vue';
import { ChannelAvatar, SkeletonScreen } from '@tsdaodao/base-vue';

const router = useRouter();
const route = useRoute();
const conversationStore = useConversationStore();

const loading = ref(false);

onMounted(async () => {
  if (conversationStore.conversations.length === 0) {
    loading.value = true;
    try {
      await conversationStore.syncConversations();
    } catch (e) {
      console.error(e);
    } finally {
      loading.value = false;
    }
  }
});

function handleSelect(channelId: string, channelType: number) {
  router.push(`/chat/conversation/${channelId}/${channelType}`);
}

function formatTime(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getDigest(conv: any): string {
  if (conv.draft) {
    return `[草稿] ${conv.draft}`;
  }
  if (conv.last_message) {
    const payload = conv.last_message.payload || conv.last_message.content;
    if (payload) {
      if (typeof payload === 'string') {
        try {
          const parsed = JSON.parse(payload);
          return parsed.text || '[消息]';
        } catch (e) {
          return payload;
        }
      }
      return payload.text || payload.content || '[消息]';
    }
  }
  return '暂无消息';
}
</script>

<template>
  <div class="conversation-list-container">
    <SkeletonScreen 
      v-if="loading && conversationStore.conversations.length === 0" 
      type="conversation-item" 
      :count="6" 
    />
    
    <div v-else-if="conversationStore.conversations.length === 0" class="empty-conversations">
      <p>暂无聊天会话</p>
    </div>

    <div v-else class="list-wrapper">
      <div 
        v-for="conv in conversationStore.sortedConversations" 
        :key="conv.channel_id + '-' + conv.channel_type"
        class="conversation-item"
        :class="{ 
          pinned: conv.top === 1,
          active: route.params.channelId === conv.channel_id && Number(route.params.channelType) === conv.channel_type
        }"
        @click="handleSelect(conv.channel_id, conv.channel_type)"
      >
        <ChannelAvatar 
          :avatar="conv.avatar" 
          :name="conv.name" 
          :is-group="conv.channel_type === 2"
          :size="42" 
        />
        
        <div class="item-body">
          <div class="item-header">
            <span class="item-name">{{ conv.name }}</span>
            <span class="item-time">{{ formatTime(conv.last_msg_time) }}</span>
          </div>
          
          <div class="item-footer">
            <span 
              class="item-digest" 
              :class="{ 'item-draft': !!conv.draft }"
            >
              {{ getDigest(conv) }}
            </span>
            
            <div class="item-status">
              <span v-if="conv.top === 1" class="pin-dot" title="已置顶"></span>
              <span v-if="conv.unread > 0" class="unread-badge">
                {{ conv.unread > 99 ? '99+' : conv.unread }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.conversation-list-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.empty-conversations {
  padding: 40px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.list-wrapper {
  display: flex;
  flex-direction: column;
}

.conversation-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
  cursor: pointer;
  user-select: none;
  border-bottom: var(--border-hairline);
  background-color: var(--bg-primary);
  transition: background-color 0.2s;
}

.conversation-item:hover {
  background-color: var(--bg-hover);
}

.conversation-item.active {
  background-color: var(--bg-hover);
}

.conversation-item.pinned {
  background-color: var(--bg-secondary);
}

.conversation-item.pinned:hover,
.conversation-item.pinned.active {
  background-color: var(--bg-hover);
}

.item-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-time {
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.item-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.item-digest {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.item-draft {
  color: #ff4d4f;
}

.item-status {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.pin-dot {
  width: 6px;
  height: 6px;
  background-color: var(--text-secondary);
  border-radius: 50%;
}

.unread-badge {
  background-color: #ff4d4f;
  color: #ffffff;
  font-size: 10px;
  font-weight: 600;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
