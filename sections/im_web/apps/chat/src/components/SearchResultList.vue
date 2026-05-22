<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useContactStore } from '@tsdaodao/contacts-vue';
import { useGroupStore, useMessageStore, useUserStore } from '@tsdaodao/datasource-vue';
import { ChannelAvatar } from '@tsdaodao/base-vue';

const props = defineProps<{
  query: string;
}>();

const emit = defineEmits(['select']);

const router = useRouter();
const contactStore = useContactStore();
const groupStore = useGroupStore();
const messageStore = useMessageStore();
const userStore = useUserStore();

const searchQuery = computed(() => props.query.trim().toLowerCase());

// Filter Contacts
const filteredContacts = computed(() => {
  if (!searchQuery.value) return [];
  return contactStore.contacts.filter(c => 
    (c.name || '').toLowerCase().includes(searchQuery.value) ||
    (c.uid || '').toLowerCase().includes(searchQuery.value)
  );
});

// Filter Groups
const filteredGroups = computed(() => {
  if (!searchQuery.value) return [];
  // Standard groups
  const groupsList = Object.values(groupStore.groups) || [];
  return groupsList.filter(g => 
    (g.name || '').toLowerCase().includes(searchQuery.value) ||
    (g.group_id || '').toLowerCase().includes(searchQuery.value)
  );
});

// Filter Messages (Chat History)
const filteredMessages = computed(() => {
  if (!searchQuery.value) return [];
  const results: any[] = [];
  
  Object.entries(messageStore.messages).forEach(([channelKey, msgList]) => {
    const parts = channelKey.split('-');
    const channelId = parts[0];
    const channelType = parseInt(parts[1] || '1');
    
    msgList.forEach(m => {
      if (m.content?.type === 1 && (m.content?.text || '').toLowerCase().includes(searchQuery.value)) {
        results.push({
          message: m,
          channelId,
          channelType,
          senderName: userStore.userCache[m.fromUID]?.name || m.fromUID
        });
      }
    });
  });
  
  return results.slice(0, 10); // Limit to 10 matching messages for preview
});

const hasResults = computed(() => {
  return filteredContacts.value.length > 0 || 
         filteredGroups.value.length > 0 || 
         filteredMessages.value.length > 0;
});

function handleOpenChat(channelId: string, channelType: number) {
  router.push(`/chat/conversation/${channelId}/${channelType}`);
  emit('select');
}
</script>

<template>
  <div class="search-result-list">
    <div v-if="!hasResults" class="search-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="empty-icon">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <p class="empty-text">未找到相关结果</p>
    </div>

    <div v-else class="results-container">
      <!-- Contacts Section -->
      <div v-if="filteredContacts.length > 0" class="result-section">
        <h4 class="section-title">联系人</h4>
        <div class="section-items">
          <div 
            v-for="c in filteredContacts" 
            :key="c.uid" 
            class="result-item"
            @click="handleOpenChat(c.uid, 1)"
          >
            <ChannelAvatar :avatar="c.avatar" :name="c.name" :size="34" />
            <div class="item-info">
              <span class="item-name">{{ c.name }}</span>
              <span class="item-sub">UID: {{ c.uid }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Groups Section -->
      <div v-if="filteredGroups.length > 0" class="result-section">
        <h4 class="section-title">群组</h4>
        <div class="section-items">
          <div 
            v-for="g in filteredGroups" 
            :key="g.group_id" 
            class="result-item"
            @click="handleOpenChat(g.group_id, 2)"
          >
            <ChannelAvatar :avatar="g.avatar" :name="g.name" :size="34" />
            <div class="item-info">
              <span class="item-name">{{ g.name }}</span>
              <span class="item-sub">{{ g.group_id }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Message History Section -->
      <div v-if="filteredMessages.length > 0" class="result-section">
        <h4 class="section-title">聊天记录</h4>
        <div class="section-items">
          <div 
            v-for="m in filteredMessages" 
            :key="m.message?.messageID || m.message?.clientMsgNo" 
            class="result-item text-item"
            @click="handleOpenChat(m.channelId, m.channelType)"
          >
            <div class="item-info full-width">
              <div class="msg-header">
                <span class="sender-name">{{ m.senderName }}</span>
                <span class="msg-time">{{ new Date((m.message?.timestamp || 0) * 1000).toLocaleDateString() }}</span>
              </div>
              <p class="msg-preview">{{ m.message?.content?.text }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-result-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  background-color: var(--bg-primary);
}

.search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  color: var(--text-secondary);
}

.empty-icon {
  width: 32px;
  height: 32px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-text {
  font-size: 13px;
  margin: 0;
}

.results-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 12px 0;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  padding: 0 16px;
  margin: 0;
  letter-spacing: 0.5px;
}

.section-items {
  display: flex;
  flex-direction: column;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.result-item:hover {
  background-color: var(--bg-hover);
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow: hidden;
}

.item-info.full-width {
  width: 100%;
}

.item-name {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-sub {
  font-size: 11px;
  color: var(--text-secondary);
}

.text-item {
  align-items: flex-start;
}

.msg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.sender-name {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-primary);
}

.msg-time {
  font-size: 10.5px;
  color: var(--text-secondary);
}

.msg-preview {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 4px 0 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
