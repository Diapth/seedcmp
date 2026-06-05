<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useChannelStore } from '@tsdaodao/datasource-vue';
import { useMessageStore } from '@tsdaodao/datasource-vue';
import { useConversationStore } from '@tsdaodao/datasource-vue';
import { GroupSettingsDrawer } from '@tsdaodao/base-vue';
import MessageList from '../components/MessageList.vue';
import MessageInput from '../components/MessageInput.vue';
import ChatSidePreview, { type ChatSidePreviewKind } from '../components/ChatSidePreview.vue';
import ClowderConversationPanel from '../components/ClowderConversationPanel.vue';
import UserProfileDrawer from './UserProfileDrawer.vue';

const route = useRoute();
const router = useRouter();
const channelStore = useChannelStore();
const messageStore = useMessageStore();
const conversationStore = useConversationStore();

const showGroupSettings = ref(false);
const showUserProfile = ref(false);
const activeUserProfileUid = ref('');
const showClowderPanel = ref(false);
const mentionRequest = ref<{ uid: string; name: string; requestId: number } | null>(null);
const activeRightDockTab = ref<'preview' | 'clowder'>('preview');
const rightDockWidth = ref(Number(window.localStorage.getItem('im-web-right-dock-width') || 420));
const imageLightbox = ref({
  visible: false,
  url: '',
  title: ''
});
const sidePreviewRequestId = ref(0);
let visibleHistoryTimers: number[] = [];
const sidePreview = ref({
  visible: false,
  type: 'file-text' as ChatSidePreviewKind,
  title: '',
  subtitle: '',
  sourceUrl: '',
  sourceText: '',
  extension: '',
  loading: false,
  error: ''
});

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

const rightDockVisible = computed(() => sidePreview.value.visible || showClowderPanel.value);
const rightDockTabs = computed(() => [
  { key: 'preview', label: '预览', visible: sidePreview.value.visible },
  { key: 'clowder', label: 'Clowder', visible: showClowderPanel.value }
].filter(tab => tab.visible));

function isChatViewActive(cid: string, ctype: number) {
  return route.name === 'Conversation' &&
    String(route.params.channelId || '') === String(cid) &&
    Number(route.params.channelType || 0) === Number(ctype);
}

function clearVisibleHistoryTimers() {
  for (const timer of visibleHistoryTimers) window.clearTimeout(timer);
  visibleHistoryTimers = [];
}

function scheduleVisibleHistoryRefresh(cid: string, ctype: number) {
  clearVisibleHistoryTimers();
  visibleHistoryTimers = [2500, 10000, 30000].map(delay =>
    window.setTimeout(() => {
      if (isChatViewActive(cid, ctype)) {
        void messageStore.syncMessages(cid, ctype, { hydrateVisibleHistory: true });
      }
    }, delay),
  );
}

async function loadChannelDetails() {
  const cid = channelId.value;
  const ctype = channelType.value;
  if (!cid) return;

  if (!channelInfo.value) {
    channelStore.getChannelInfo(cid, ctype);
  }

  await messageStore.syncMessages(cid, ctype, { hydrateVisibleHistory: true });
  scheduleVisibleHistoryRefresh(cid, ctype);
  if (isChatViewActive(cid, ctype)) {
    await conversationStore.clearUnread(cid, ctype);
  }
}

onMounted(() => {
  loadChannelDetails();
});

onBeforeUnmount(() => {
  clearVisibleHistoryTimers();
  stopRightDockResize();
});

watch([channelId, channelType], () => {
  closeSidePreview();
  closeImageLightbox();
  loadChannelDetails();
});

watch(() => messageStore.messages[channelKey.value]?.length, () => {
  if (isChatViewActive(channelId.value, channelType.value)) {
    void conversationStore.clearUnread(channelId.value, channelType.value);
  }
});

function handleHeaderClick() {
  if (channelType.value === 1) {
    activeUserProfileUid.value = channelId.value;
    showUserProfile.value = true;
  }
}

function handleGroupSettingsClick() {
  showGroupSettings.value = true;
}

function handleClowderClick() {
  showClowderPanel.value = true;
  activeRightDockTab.value = 'clowder';
}

function handleMembersClick() {
  showGroupSettings.value = false;
  router.push(`/chat/group-members/${channelId.value}`);
}

function handleMentionUser(payload: { uid: string; name: string }) {
  mentionRequest.value = {
    ...payload,
    requestId: Date.now()
  };
}

function handleViewUserProfile(payload: { uid: string }) {
  activeUserProfileUid.value = payload.uid;
  showUserProfile.value = true;
}

function selectRightDockTab(tab: 'preview' | 'clowder') {
  activeRightDockTab.value = tab;
}

function filePreviewType(kind: string): ChatSidePreviewKind {
  const map: Record<string, ChatSidePreviewKind> = {
    markdown: 'file-markdown',
    text: 'file-text',
    html: 'file-html',
    pdf: 'file-pdf',
    office: 'file-office'
  };
  return map[kind] || 'file-text';
}

function filePreviewTitle(kind: string) {
  const labels: Record<string, string> = {
    markdown: 'Markdown 预览',
    text: '文本预览',
    html: 'HTML 预览',
    pdf: 'PDF 预览',
    office: 'Office 文件预览'
  };
  return labels[kind] || '文件预览';
}

function closeSidePreview() {
  sidePreviewRequestId.value += 1;
  sidePreview.value.visible = false;
  sidePreview.value.loading = false;
  sidePreview.value.error = '';
  if (activeRightDockTab.value === 'preview') {
    activeRightDockTab.value = showClowderPanel.value ? 'clowder' : 'preview';
  }
}

function closeClowderPanel() {
  showClowderPanel.value = false;
  if (activeRightDockTab.value === 'clowder') {
    activeRightDockTab.value = sidePreview.value.visible ? 'preview' : 'clowder';
  }
}

function closeImageLightbox() {
  imageLightbox.value = {
    visible: false,
    url: '',
    title: ''
  };
}

async function handleOpenPreview(payload: any) {
  const requestId = sidePreviewRequestId.value + 1;
  sidePreviewRequestId.value = requestId;

  if (payload?.source === 'ai-code') {
    activeRightDockTab.value = 'preview';
    sidePreview.value = {
      visible: true,
      type: 'ai-html',
      title: 'AI HTML 预览',
      subtitle: payload.language ? `${payload.language} 代码块` : 'HTML 代码块',
      sourceUrl: '',
      sourceText: payload.code || '',
      extension: 'html',
      loading: false,
      error: payload.code ? '' : '代码块内容为空'
    };
    return;
  }

  if (payload?.source === 'image') {
    if (!payload?.url) return;
    imageLightbox.value = {
      visible: true,
      url: payload.url,
      title: payload?.name || '图片预览'
    };
    return;
  }

  activeRightDockTab.value = 'preview';
  const type = filePreviewType(payload?.kind || '');
  sidePreview.value = {
    visible: true,
    type,
    title: filePreviewTitle(payload?.kind || ''),
    subtitle: payload?.name || '',
    sourceUrl: payload?.url || '',
    sourceText: '',
    extension: payload?.extension || '',
    loading: ['file-markdown', 'file-text', 'file-html'].includes(type),
    error: ''
  };

  if (!['file-markdown', 'file-text', 'file-html'].includes(type)) return;

  try {
    const res = await fetch(payload.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (sidePreviewRequestId.value !== requestId) return;
    sidePreview.value.sourceText = await res.text();
  } catch (err: any) {
    if (sidePreviewRequestId.value !== requestId) return;
    sidePreview.value.error = err?.message || '预览加载失败';
  } finally {
    if (sidePreviewRequestId.value !== requestId) return;
    sidePreview.value.loading = false;
  }
}

function setRightDockWidth(width: number) {
  const maxWidth = Math.max(420, Math.floor(window.innerWidth * 0.75));
  const next = Math.min(maxWidth, Math.max(360, Math.floor(width)));
  rightDockWidth.value = next;
  window.localStorage.setItem('im-web-right-dock-width', String(next));
}

function handleRightDockResize(event: MouseEvent) {
  setRightDockWidth(window.innerWidth - event.clientX);
}

function stopRightDockResize() {
  window.removeEventListener('mousemove', handleRightDockResize);
  window.removeEventListener('mouseup', stopRightDockResize);
  document.body.classList.remove('is-resizing-right-dock');
}

function startRightDockResize(event: MouseEvent) {
  event.preventDefault();
  document.body.classList.add('is-resizing-right-dock');
  window.addEventListener('mousemove', handleRightDockResize);
  window.addEventListener('mouseup', stopRightDockResize);
}
</script>

<template>
  <div class="chat-view-container">
    <div class="chat-main-column">
      <div class="chat-header">
        <div class="header-left" @click="handleHeaderClick" :style="{ cursor: channelType === 1 ? 'pointer' : 'default' }">
          <h3 class="channel-name">{{ channelInfo?.name || '正在加载...' }}</h3>
          <span v-if="isTyping" class="typing-indicator">对方正在输入...</span>
          <span v-else class="status-indicator">{{ channelType === 2 ? '群聊' : '在线' }}</span>
        </div>

        <div class="header-right">
          <button class="settings-btn" @click="handleClowderClick" title="Clowder">
            C
          </button>
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
        @open-preview="handleOpenPreview"
        @mention-user="handleMentionUser"
        @view-user-profile="handleViewUserProfile"
      />

      <MessageInput
        :channel-id="channelId"
        :channel-type="channelType"
        :mention-request="mentionRequest"
      />
    </div>

    <aside
      v-if="rightDockVisible"
      class="right-dock"
      :style="{ width: `${rightDockWidth}px` }"
      aria-label="右侧工作区"
    >
      <div class="right-dock-resizer" title="拖动调整宽度" @mousedown="startRightDockResize"></div>
      <header v-if="rightDockTabs.length > 1" class="right-dock-tabs">
        <button
          v-for="tab in rightDockTabs"
          :key="tab.key"
          type="button"
          class="dock-tab"
          :class="{ active: activeRightDockTab === tab.key }"
          @click="selectRightDockTab(tab.key as 'preview' | 'clowder')"
        >
          {{ tab.label }}
        </button>
      </header>
      <div class="right-dock-body">
        <ChatSidePreview
          v-show="sidePreview.visible && activeRightDockTab === 'preview'"
          :visible="sidePreview.visible"
          :type="sidePreview.type"
          :title="sidePreview.title"
          :subtitle="sidePreview.subtitle"
          :source-url="sidePreview.sourceUrl"
          :source-text="sidePreview.sourceText"
          :extension="sidePreview.extension"
          :loading="sidePreview.loading"
          :error="sidePreview.error"
          @close="closeSidePreview"
        />

        <ClowderConversationPanel
          v-show="showClowderPanel && activeRightDockTab === 'clowder'"
          :visible="showClowderPanel"
          :channel-id="channelId"
          :channel-type="channelType"
          @close="closeClowderPanel"
        />
      </div>
    </aside>

    <GroupSettingsDrawer
      v-if="channelType === 2"
      :group-no="channelId"
      :visible="showGroupSettings"
      @close="showGroupSettings = false"
      @members-click="handleMembersClick"
    />

    <UserProfileDrawer
      v-if="showUserProfile"
      :uid="activeUserProfileUid || channelId"
      :visible="showUserProfile"
      @close="showUserProfile = false"
    />

    <div
      v-if="imageLightbox.visible"
      class="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      @click.self="closeImageLightbox"
    >
      <button class="image-lightbox-close" type="button" title="关闭预览" @click="closeImageLightbox">×</button>
      <img class="image-lightbox-img" :src="imageLightbox.url" :alt="imageLightbox.title" />
    </div>
  </div>
</template>

<style scoped>
.chat-view-container {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  height: 100%;
  width: 100%;
  position: relative;
  overflow: hidden;
  background-color: var(--bg-primary);
}

.chat-main-column {
  display: grid;
  grid-template-rows: 64px minmax(0, 1fr) auto;
  min-width: 0;
  height: 100%;
  overflow: hidden;
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

.right-dock {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 280px;
  max-width: max(280px, 75vw);
  height: 100%;
  border-left: var(--border-hairline);
  background: var(--bg-primary);
  overflow: hidden;
}

.right-dock-resizer {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -3px;
  z-index: 3;
  width: 7px;
  cursor: col-resize;
}

.right-dock-resizer:hover {
  background: rgba(22, 93, 255, 0.16);
}

.right-dock-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 10px;
  border-bottom: var(--border-hairline);
  background: var(--bg-primary);
}

.dock-tab {
  height: 28px;
  padding: 0 10px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
}

.dock-tab.active {
  background: var(--primary-color, #165dff);
  color: #ffffff;
  border-color: var(--primary-color, #165dff);
}

.right-dock-body {
  min-height: 0;
  overflow: hidden;
}

.image-lightbox {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: rgba(15, 23, 42, 0.72);
}

.image-lightbox-img {
  max-width: min(92vw, 1280px);
  max-height: 90vh;
  object-fit: contain;
  border-radius: var(--radius-sm);
  background: #ffffff;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.32);
}

.image-lightbox-close {
  position: fixed;
  top: 18px;
  right: 22px;
  width: 36px;
  height: 36px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.96);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
}

@media (max-width: 760px) {
  .chat-view-container {
    grid-template-columns: minmax(0, 1fr);
  }

  .right-dock {
    position: absolute;
    top: 0;
    right: 0;
    bottom: var(--mobile-composer-reserve, clamp(176px, 28vh, 240px));
    left: 0;
    z-index: 20;
    width: 100% !important;
    min-width: 0;
    max-width: none;
    height: auto;
    border-left: 0;
    border-bottom: var(--border-hairline);
  }

  .right-dock-resizer {
    display: none;
  }
}
</style>
