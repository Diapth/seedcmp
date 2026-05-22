<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useConversationStore } from '@tsdaodao/datasource-vue';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { ChannelAvatar, ContextMenu, SkeletonScreen } from '@tsdaodao/base-vue';

const router = useRouter();
const route = useRoute();
const conversationStore = useConversationStore();
const userStore = useUserStore();

const loading = ref(false);
const showContextMenu = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const selectedConversation = ref<any>(null);

const digestFallbackByType: Record<number, string> = {
  2: '[图片]',
  3: '[动图]',
  4: '[语音]',
  5: '[视频]',
  6: '[位置]',
  7: '[名片]',
  8: '[文件]',
  11: '[聊天记录]',
  12: '[贴图]',
  13: '[贴图]',
  99: '[系统消息]',
  1000: '[系统消息]'
};

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

watch(
  () => conversationStore.sortedConversations.map(conv => {
    const lastMessage = getConversationLastMessage(conv);
    return `${conv.channel_id}-${conv.channel_type}-${getSenderUid(lastMessage)}`;
  }).join('|'),
  () => {
    void syncGroupDigestSenders();
  },
  { immediate: true }
);

function isActiveConversation(conv: any): boolean {
  return route.params.channelId === String(conv.channel_id) &&
    Number(route.params.channelType) === Number(conv.channel_type);
}

function getUnreadCount(conv: any): number {
  if (isActiveConversation(conv)) {
    return 0;
  }
  return Number(conv.unread || 0);
}

function handleSelect(channelId: string, channelType: number) {
  void conversationStore.clearUnread(channelId, channelType);
  router.push(`/chat/conversation/${channelId}/${channelType}`);
}

function handleConversationContextMenu(event: MouseEvent, conv: any) {
  selectedConversation.value = conv;
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
  showContextMenu.value = true;
}

async function handleDeleteConversation() {
  if (!selectedConversation.value) return;
  await conversationStore.deleteConversation(selectedConversation.value.channel_id, selectedConversation.value.channel_type);
  if (
    route.params.channelId === selectedConversation.value.channel_id &&
    Number(route.params.channelType) === selectedConversation.value.channel_type
  ) {
    router.push('/chat');
  }
  selectedConversation.value = null;
}

const contextMenuItems = [
  {
    label: '删除会话',
    danger: true,
    action: handleDeleteConversation
  }
];

function formatTime(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function parseDigestContent(content: any): any {
  if (typeof content !== 'string') {
    return content;
  }
  try {
    return JSON.parse(content);
  } catch (e) {
    return content;
  }
}

function resolveNestedDigestText(value: any): string {
  const parsed = parseDigestContent(value);
  if (!parsed) return '';
  if (typeof parsed === 'string') return parsed;
  if (typeof parsed !== 'object') return '';
  return resolveDigestText(parsed);
}

function resolveDigestText(content: any): string {
  content = parseDigestContent(content);
  if (!content) return '';
  if (typeof content === 'string') return content;

  const nestedText = resolveNestedDigestText(content.contentObj) ||
    resolveNestedDigestText(content.payload) ||
    (typeof content.content === 'object' ? resolveNestedDigestText(content.content) : '');
  if (nestedText) return nestedText;

  return content.text ||
    content.content ||
    content.title ||
    content.name ||
    content.file_name ||
    content.filename ||
    '';
}

function getConversationLastMessage(conv: any): any {
  return conv.last_message || conv.last_msg;
}

function getSenderUid(lastMessage: any): string {
  return String(lastMessage?.fromUID || lastMessage?.from_uid || lastMessage?.from || '');
}

function getSenderName(lastMessage: any): string {
  const uid = getSenderUid(lastMessage);
  return lastMessage?.fromName ||
    lastMessage?.from_name ||
    lastMessage?.sender_name ||
    lastMessage?.senderName ||
    userStore.userCache[uid]?.name ||
    (uid && userStore.currentUser?.uid === uid ? userStore.currentUser?.name : '') ||
    uid ||
    '用户';
}

async function syncGroupDigestSenders() {
  const uids = conversationStore.sortedConversations
    .filter(conv => Number(conv.channel_type) === 2)
    .map(conv => getSenderUid(getConversationLastMessage(conv)))
    .filter(uid => uid && !userStore.userCache[uid]);

  if (uids.length > 0) {
    await userStore.getUsersByIds([...new Set(uids)]);
  }
}

function formatGroupDigest(conv: any, lastMessage: any, digest: string): string {
  if (Number(conv.channel_type) !== 2 || !lastMessage) {
    return digest;
  }
  const senderName = getSenderName(lastMessage);
  if (!senderName || digest.startsWith(`${senderName}：`)) {
    return digest;
  }
  return `${senderName}：${digest}`;
}

function getDigest(conv: any): string {
  if (conv.draft) {
    return `[草稿] ${conv.draft}`;
  }
  const lastMessage = getConversationLastMessage(conv);
  if (lastMessage) {
    const payload = parseDigestContent(lastMessage.payload ?? lastMessage.content ?? lastMessage.contentObj);
    const type = Number(payload?.type || lastMessage.type || lastMessage.content_type || lastMessage.contentType || 0);
    const text = resolveDigestText(payload) ||
      resolveDigestText(lastMessage.text) ||
      resolveDigestText(lastMessage.content);

    if (text) {
      const prefix = digestFallbackByType[type];
      if (type === 8 && !String(text).startsWith('[文件]')) {
        return formatGroupDigest(conv, lastMessage, `${prefix} ${text}`);
      }
      if ((type === 6 || type === 7) && prefix && !String(text).startsWith(prefix)) {
        return formatGroupDigest(conv, lastMessage, `${prefix} ${text}`);
      }
      return formatGroupDigest(conv, lastMessage, String(text));
    }

    return formatGroupDigest(conv, lastMessage, digestFallbackByType[type] || '[未知类型]');
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
          active: isActiveConversation(conv)
        }"
        @click="handleSelect(conv.channel_id, conv.channel_type)"
        @contextmenu.prevent="handleConversationContextMenu($event, conv)"
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
              <span v-if="getUnreadCount(conv) > 0" class="unread-badge">
                {{ getUnreadCount(conv) > 99 ? '99+' : getUnreadCount(conv) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ContextMenu
      v-if="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :items="contextMenuItems"
      @close="showContextMenu = false"
    />
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
