<template>
  <view class="conversation-list-container flex-column">

    <!-- Search Bar -->
    <view class="list-search-bar" v-if="showSearchBar">
      <view class="search-row flex-row align-center">
        <view class="search-input-wrapper flex-1">
        <AppIcon name="search" :size="16" color="var(--color-text-muted)" class="search-icon" />
        <input
          type="text"
          v-model="localSearchQuery"
          placeholder="搜索会话..."
          class="search-input"
          placeholder-style="color: var(--color-text-muted)"
        />
        <view class="clear-icon" v-if="localSearchQuery" @click="localSearchQuery = ''">
          <AppIcon name="close" :size="14" color="var(--color-text-muted)" />
        </view>
        </view>
        <view class="global-search-btn" @click="openGlobalSearch">
          <AppIcon name="search" :size="18" color="var(--color-primary)" />
        </view>
      </view>
    </view>

    <!-- 隐藏会话入口 (PR-10) -->
    <view
      v-if="hiddenCount > 0"
      class="hidden-banner flex-row align-center justify-between"
      @click="showHiddenList = !showHiddenList"
    >
      <view class="flex-row align-center gap-2">
        <AppIcon name="settings" :size="14" color="var(--color-text-secondary)" />
        <text class="hidden-banner-text">已隐藏 {{ hiddenCount }} 个会话</text>
      </view>
      <AppIcon :name="showHiddenList ? 'up' : 'down'" :size="14" color="var(--color-text-secondary)" />
    </view>
    <view v-if="showHiddenList && hiddenList.length > 0" class="hidden-list">
      <view
        v-for="item in hiddenList"
        :key="item.id"
        class="hidden-item flex-row align-center justify-between"
        @click="restoreHidden(item.id)"
      >
        <view class="flex-row align-center gap-2">
          <AppAvatar :src="item.avatar" :text="item.name" :size="32" />
          <text class="hidden-item-name">{{ item.name }}</text>
        </view>
        <text class="hidden-item-action">恢复</text>
      </view>
    </view>

    <!-- List Scroll area -->
    <scroll-view scroll-y class="list-scroll flex-1">
      <view v-if="sortedConversations.length > 0">
        <ConversationItem
          v-for="item in sortedConversations"
          :key="item.key || item.id"
          :data="item"
          :active="convStore.activeKey ? convStore.activeKey === item.key : convStore.activeId === item.id"
          @select="handleSelect"
          @contextmenu="openContextMenu"
        />
      </view>

      <!-- Empty State -->
      <view v-else class="empty-padding">
        <AppEmptyState
          icon="search"
          title="未找到匹配会话"
          description="尝试输入其他关键字重新搜索"
        />
      </view>
    </scroll-view>

    <!-- Context Menu (PR-10) -->
    <AppContextMenu
      v-model:visible="ctxMenu.visible.value"
      :x="ctxMenu.x.value"
      :y="ctxMenu.y.value"
      :is-desktop="ctxMenu.isDesktop.value"
      :items="ctxMenuItems"
      @select="handleContextAction"
    />

  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useConversationStore } from '@/stores/conversation';
import { useContactStore } from '@/stores/contact';
import { useContextMenu } from '@/composables/useContextMenu';
import ConversationItem from './ConversationItem.vue';
import AppEmptyState from '../common/AppEmptyState.vue';
import AppIcon from '../common/AppIcon.vue';
import AppAvatar from '../common/AppAvatar.vue';
import AppContextMenu from '../common/AppContextMenu.vue';

const convStore = useConversationStore();
const contactStore = useContactStore();
const showHiddenList = ref(false);

const props = defineProps({
  searchQuery: { type: String, default: null },
  showSearchBar: { type: Boolean, default: true }
});

const emit = defineEmits(['select', 'update:searchQuery']);
const internalSearchQuery = ref('');

const localSearchQuery = computed({
  get: () => props.searchQuery ?? internalSearchQuery.value,
  set: (value) => {
    internalSearchQuery.value = value;
    emit('update:searchQuery', value);
  }
});

const ctxMenu = useContextMenu();
const ctxTarget = ref(null);

const sortedConversations = computed(() => {
  let filtered = convStore.visibleConversations;
  if (localSearchQuery.value.trim()) {
    const query = localSearchQuery.value.toLowerCase().trim();
    filtered = filtered.filter((c) => c.name.toLowerCase().includes(query));
  }
  return [...filtered].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.lastTime - a.lastTime;
  });
});

const hiddenList = computed(() => convStore.hiddenConversations);
const hiddenCount = computed(() => hiddenList.value.length);

const ctxMenuItems = computed(() => {
  const c = ctxTarget.value;
  if (!c) return [];
  const isGroup = c.type === 'group';
  const isCreator = c.id === '2' && convStore.isGroupCreator('2', 'me');
  return [
    {
      label: c.isPinned ? '取消置顶' : '置顶会话',
      icon: 'pin',
      onClick: () => convStore.pinConversation(c.id, !c.isPinned)
    },
    { divider: true },
    {
      label: '标为已读',
      icon: 'check',
      onClick: () => convStore.clearUnread(c.id)
    },
    {
      label: c.isMuted ? '取消免打扰' : '消息免打扰',
      icon: 'mute',
      onClick: () => convStore.muteConversation(c.id, !c.isMuted)
    },
    { divider: true },
    {
      label: '隐藏会话',
      icon: 'hide',
      onClick: () => convStore.hideConversation(c.id)
    },
    ...(isGroup
      ? [
          {
            label: isCreator ? '解散群聊' : '退出群聊',
            icon: 'exit',
            danger: true,
            onClick: () => exitOrDisband(c, isCreator)
          }
        ]
      : [
          {
            label: '加黑名单',
            icon: 'block',
            danger: true,
            onClick: () => contactStore.addToBlacklist(c.id)
          },
          {
            label: '硬删除',
            icon: 'trash',
            danger: true,
            onClick: () => convStore.deleteConversation(c.id)
          }
        ])
  ];
});

function exitOrDisband(conv, isCreator) {
  convStore.deleteConversation(conv.id);
  uni.showToast({
    title: isCreator ? '已解散群聊' : '已退出群聊',
    icon: 'success'
  });
}

function handleSelect(conversation) {
  convStore.setActiveId(conversation.id, conversation.channelType || conversation.type);
  emit('select', conversation);
}

function openContextMenu(payload) {
  ctxTarget.value = payload.conv;
  ctxMenu.show(payload.event, payload.conv);
}

function handleContextAction(item) {
  if (item.onClick) item.onClick();
}

function restoreHidden(id) {
  convStore.unhideConversation(id);
  convStore.setActiveId(id);
  emit('select', id);
  showHiddenList.value = false;
}

function openGlobalSearch() {
  uni.navigateTo({ url: '/pages/search/index' });
}
</script>

<style scoped>
.conversation-list-container {
  width: 100%;
  height: 100%;
  background-color: var(--color-bg-surface);
}

.list-search-bar {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.search-row {
  gap: 8px;
  display: flex;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}

.search-icon {
  position: absolute;
  left: 12px;
}

.search-input {
  width: 100%;
  height: 36px;
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding-left: 36px;
  padding-right: 32px;
  box-sizing: border-box;
  font-size: 14px;
  color: var(--color-text-primary);
}

.clear-icon {
  position: absolute;
  right: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.global-search-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background-color: var(--color-primary-light);
  border: 1px solid rgba(0, 74, 198, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.global-search-btn:hover {
  background-color: var(--color-bg-hover);
}

.list-scroll {
  height: 100%;
}

.empty-padding {
  padding-top: 40px;
}

.hidden-banner {
  padding: 10px 16px;
  background-color: var(--color-bg-base);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
}

.hidden-banner-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 600;
}

.hidden-list {
  background-color: var(--color-bg-base);
  border-bottom: 1px solid var(--color-border);
}

.hidden-item {
  padding: 8px 16px;
  border-top: 1px solid var(--color-border);
  cursor: pointer;
}

.hidden-item-name {
  font-size: 13px;
  color: var(--color-text-primary);
}

.hidden-item-action {
  font-size: 12px;
  color: var(--color-primary);
  font-weight: 600;
}

.gap-2 {
  gap: 8px;
}
</style>
