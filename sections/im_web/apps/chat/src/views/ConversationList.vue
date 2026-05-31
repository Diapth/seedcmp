<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useConversationStore } from '@tsdaodao/datasource-vue';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { ChannelAvatar, ContextMenu, SkeletonScreen } from '@tsdaodao/base-vue';
import {
  getClowderCatDisplayNameFromPayload,
  isClowderPayload
} from '@tsdaodao/base-vue/utils/clowderMessageIdentity';
import { buildDigestPresentation, formatConversationTime } from '../utils/conversationPresentation';

const router = useRouter();
const route = useRoute();
const conversationStore = useConversationStore();
const userStore = useUserStore();

const loading = ref(false);
const syncError = ref('');
const syncRetryCount = ref(0);
const showContextMenu = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const selectedConversation = ref<any>(null);
const notificationPermissionState = ref<'granted' | 'denied' | 'default' | 'unsupported'>('unsupported');

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

let syncRetryTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(async () => {
  syncNotificationPermission();
  await loadConversationList();
});

onBeforeUnmount(() => {
  clearSyncRetryTimer();
});

function syncNotificationPermission() {
  if (typeof Notification === 'undefined') {
    notificationPermissionState.value = 'unsupported';
    return;
  }
  notificationPermissionState.value = Notification.permission;
}

async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') {
    notificationPermissionState.value = 'unsupported';
    return;
  }
  notificationPermissionState.value = await Notification.requestPermission();
}

function formatSyncError(err: any) {
  if (!err) return '请稍后重试';
  if (typeof err === 'string') return err;
  if (err instanceof Error && err.message) return err.message;
  const nested = err.error;
  const message = err.msg || err.message || nested?.msg || nested?.message;
  if (message && typeof message === 'string') return message;
  if (err.status) return `接口返回 ${err.status}`;
  return '请检查后端服务后重试';
}

function clearSyncRetryTimer() {
  if (syncRetryTimer) {
    clearTimeout(syncRetryTimer);
    syncRetryTimer = null;
  }
}

function scheduleSyncRetry() {
  clearSyncRetryTimer();
  if (syncRetryCount.value >= 5) return;
  const delay = Math.min(3000 * (syncRetryCount.value + 1), 15000);
  syncRetryTimer = setTimeout(() => {
    syncRetryTimer = null;
    if (conversationStore.conversations.length === 0) {
      void loadConversationList({ retry: true });
    }
  }, delay);
}

async function loadConversationList(options: { retry?: boolean } = {}) {
  if (loading.value) return;
  if (!options.retry) {
    syncRetryCount.value = 0;
  }
  loading.value = true;
  syncError.value = '';
  clearSyncRetryTimer();
  try {
    await conversationStore.syncGroupConversations({ throwOnError: true });
    await conversationStore.syncConversations({ throwOnError: true });
    syncRetryCount.value = 0;
  } catch (e) {
    console.error(e);
    syncRetryCount.value += 1;
    syncError.value = formatSyncError(e);
    scheduleSyncRetry();
  } finally {
    loading.value = false;
  }
}

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
    label: '置顶 / 取消置顶',
    action: () => {
      if (!selectedConversation.value) return;
      void conversationStore.togglePin(
        selectedConversation.value.channel_id,
        selectedConversation.value.channel_type,
        Number(selectedConversation.value.top || 0) !== 1
      );
      selectedConversation.value = null;
    }
  },
  {
    label: '免打扰 / 取消免打扰',
    action: () => {
      if (!selectedConversation.value) return;
      void conversationStore.toggleMute(
        selectedConversation.value.channel_id,
        selectedConversation.value.channel_type,
        Number(selectedConversation.value.mute || 0) !== 1
      );
      selectedConversation.value = null;
    }
  },
  {
    label: '删除会话',
    danger: true,
    action: handleDeleteConversation
  }
];

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

function getClowderDigestSenderName(lastMessage: any): string {
  const payload = parseDigestContent(lastMessage?.payload ?? lastMessage?.content ?? lastMessage?.contentObj);
  if (!payload || typeof payload !== 'object') return '';
  if (!isClowderPayload(payload)) return '';
  return getClowderCatDisplayNameFromPayload(payload);
}

function getSenderName(lastMessage: any): string {
  const uid = getSenderUid(lastMessage);
  return getClowderDigestSenderName(lastMessage) ||
    lastMessage?.fromName ||
    lastMessage?.from_name ||
    lastMessage?.sender_name ||
    lastMessage?.senderName ||
    userStore.userCache[uid]?.name ||
    (uid && userStore.currentUser?.uid === uid ? userStore.currentUser?.name : '') ||
    uid ||
    '用户';
}

function isSystemDigest(lastMessage: any): boolean {
  if (!lastMessage) return false;
  const payload = parseDigestContent(lastMessage.payload ?? lastMessage.content ?? lastMessage.contentObj);
  const type = Number(payload?.type || lastMessage.type || lastMessage.content_type || lastMessage.contentType || 0);
  return [99, 1000].includes(type);
}

function getMentionPayload(lastMessage: any): any {
  if (!lastMessage) return undefined;
  const payload = parseDigestContent(lastMessage.payload ?? lastMessage.content ?? lastMessage.contentObj);
  return payload?.mention || lastMessage.mention || lastMessage.content?.mention || lastMessage.payload?.mention;
}

function getMentionReminder(lastMessage: any): string {
  const mention = getMentionPayload(lastMessage);
  if (!mention) return '';
  if (mention.all === true) return '[有人@我]';
  const currentUid = String(userStore.currentUser?.uid || '');
  const uids = Array.isArray(mention.uids) ? mention.uids.map((uid: any) => String(uid)) : [];
  return currentUid && uids.includes(currentUid) ? '[有人@我]' : '';
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

function getDigestPresentation(conv: any) {
  if (conv.draft) {
    return buildDigestPresentation({
      channelType: conv.channel_type,
      isSystem: false,
      senderName: '',
      text: `[草稿] ${conv.draft}`
    });
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
        return buildDigestPresentation({
          channelType: conv.channel_type,
          isSystem: isSystemDigest(lastMessage),
          senderName: getSenderName(lastMessage),
          mentionReminder: getMentionReminder(lastMessage),
          text: `${prefix} ${text}`
        });
      }
      if ((type === 6 || type === 7) && prefix && !String(text).startsWith(prefix)) {
        return buildDigestPresentation({
          channelType: conv.channel_type,
          isSystem: isSystemDigest(lastMessage),
          senderName: getSenderName(lastMessage),
          mentionReminder: getMentionReminder(lastMessage),
          text: `${prefix} ${text}`
        });
      }
      return buildDigestPresentation({
        channelType: conv.channel_type,
        isSystem: isSystemDigest(lastMessage),
        senderName: getSenderName(lastMessage),
        mentionReminder: getMentionReminder(lastMessage),
        text: String(text)
      });
    }

    return buildDigestPresentation({
      channelType: conv.channel_type,
      isSystem: isSystemDigest(lastMessage),
      senderName: getSenderName(lastMessage),
      mentionReminder: getMentionReminder(lastMessage),
      text: digestFallbackByType[type] || '[未知类型]'
    });
  }
  return buildDigestPresentation({
    channelType: conv.channel_type,
    isSystem: false,
    senderName: '',
    text: '暂无消息'
  });
}
</script>

<template>
  <div class="conversation-list-container">
    <SkeletonScreen 
      v-if="loading && conversationStore.conversations.length === 0" 
      type="conversation-item" 
      :count="6" 
    />
    
    <div v-else-if="conversationStore.conversations.length === 0 && syncError" class="empty-conversations sync-error">
      <p>会话同步失败</p>
      <span>{{ syncError }}</span>
      <button @click="loadConversationList()">重试</button>
    </div>

    <div v-else-if="conversationStore.conversations.length === 0" class="empty-conversations">
      <p>暂无聊天会话</p>
    </div>

    <div v-else class="list-wrapper">
      <div v-if="notificationPermissionState !== 'granted'" class="notification-hint">
        <span v-if="notificationPermissionState === 'unsupported'">当前浏览器不支持桌面通知</span>
        <span v-else-if="notificationPermissionState === 'denied'">桌面通知已被浏览器拒绝</span>
        <span v-else>开启桌面通知以便接收未读提醒</span>
        <button v-if="notificationPermissionState === 'default'" @click="requestNotificationPermission">开启</button>
      </div>

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
            <span class="item-time">{{ formatConversationTime(conv.last_msg_time) }}</span>
          </div>
          
          <div class="item-footer">
            <span 
              class="item-digest" 
              :class="{ 'item-draft': !!conv.draft }"
            >
              <span v-if="getDigestPresentation(conv).mentionReminder" class="mention-prefix">
                {{ getDigestPresentation(conv).mentionReminder }}
              </span>
              <span v-if="getDigestPresentation(conv).senderName" class="digest-sender">
                {{ getDigestPresentation(conv).senderName }}：
              </span>
              <span class="digest-text">{{ getDigestPresentation(conv).text }}</span>
            </span>
            
            <div class="item-status">
              <span v-if="conv.top === 1" class="status-icon pin-icon" title="已置顶">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 3l7 7-2 2-1.5-1.5-4.5 4.5v4l-1 1-3.5-3.5-4 4-1.5-1.5 4-4L3 11.5l1-1h4L12.5 6 11 4.5 14 3z" />
                </svg>
              </span>
              <span v-if="conv.mute === 1" class="status-icon mute-icon" title="免打扰">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 4.8L5.2 3.6 20.4 18.8 19.2 20l-2.5-2.5H8.8L5 21.2V8.8L4 4.8zM7 8.4v7.6l1.1-1.1h5.2L7 8.4zM9.6 5h6.9A2.5 2.5 0 0 1 19 7.5v7.1l-2-2V7.5a.5.5 0 0 0-.5-.5h-4.9l-2-2z" />
                </svg>
              </span>
              <span v-if="getUnreadCount(conv) > 0" class="unread-badge" :class="{ 'muted-unread': conv.mute === 1 }">
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

.sync-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.sync-error p {
  margin: 0;
  color: var(--text-primary);
  font-weight: 500;
}

.sync-error span {
  max-width: 220px;
  line-height: 1.5;
}

.sync-error button {
  height: 28px;
  padding: 0 12px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}

.list-wrapper {
  display: flex;
  flex-direction: column;
}

.notification-hint {
  min-height: 32px;
  padding: 0 12px;
  border-bottom: var(--border-hairline);
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.notification-hint button {
  height: 24px;
  padding: 0 8px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
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

.status-icon {
  width: 12px;
  height: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.status-icon svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
}

.pin-icon {
  color: #f59e0b;
}

.mute-icon {
  color: #60a5fa;
}

.mention-prefix {
  color: #e11d48;
  font-weight: 600;
  margin-right: 4px;
}

.digest-sender {
  color: var(--text-secondary);
}

.digest-text {
  color: var(--text-secondary);
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

.unread-badge.muted-unread {
  background-color: var(--text-muted);
}
</style>
