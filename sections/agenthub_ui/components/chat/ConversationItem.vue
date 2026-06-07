<template>
  <view
    class="conversation-item"
    :class="{ active: active, pinned: data.isPinned }"
    @click="$emit('select', data)"
    @contextmenu.prevent="$emit('contextmenu', { event: $event, conv: data })"
    @longpress="$emit('contextmenu', { event: $event, conv: data })"
  >
    <!-- Avatar with online dot -->
    <AppAvatar
      :src="data.avatar"
      :text="data.name"
      :size="46"
      :status="data.type === 'single' ? 'online' : ''"
      :is-circle="data.type !== 'robot'"
    />

    <!-- Info -->
    <view class="item-info flex-1 flex-column justify-between">
      <view class="info-top flex-row justify-between align-center">
        <text class="item-name">{{ data.name }}</text>
        <text class="item-time">{{ formatTime(data.lastTime) }}</text>
      </view>

      <view class="info-bottom flex-row justify-between align-center">
        <!-- Draft or LastMessage -->
        <text class="item-msg-draft" v-if="data.draft">
          {{ formatDraftPreview(data.draft) }}
        </text>
        <text class="item-msg-text" v-else>
          {{ data.lastMessage }}
        </text>

        <!-- Icons/Badges -->
        <view class="item-badge-section flex-row align-center">
          <AppIcon name="settings" :size="14" color="var(--color-text-muted)" v-if="data.isMuted" class="mute-icon" />
          <view class="unread-badge" v-if="data.unread > 0">
            <text class="badge-text">{{ formatUnread(data.unread) }}</text>
          </view>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup>
import { formatTime, formatUnread } from '@/utils/formatConversation';
import AppAvatar from '../common/AppAvatar.vue';
import AppIcon from '../common/AppIcon.vue';

defineProps({
  data: {
    type: Object,
    required: true
  },
  active: {
    type: Boolean,
    default: false
  }
});

defineEmits(['select', 'contextmenu']);

function formatDraftPreview(value, maxLength = 80) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  const prefix = '[草稿] ';
  if (!normalized) return prefix.trim();
  if (normalized.length <= maxLength) return `${prefix}${normalized}`;
  return `${prefix}${normalized.slice(0, maxLength - 3)}...`;
}
</script>

<style scoped>
.conversation-item {
  display: flex;
  flex-direction: row;
  padding: 12px 16px;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  user-select: none;
  background-color: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  min-width: 0;
  overflow: hidden;
}

.conversation-item:hover {
  background-color: var(--color-bg-hover);
}

.conversation-item.active {
  background-color: var(--color-primary-light);
}

.conversation-item.pinned {
  background-color: rgba(241, 245, 249, 0.35);
}

.conversation-item.pinned.active {
  background-color: var(--color-primary-light);
}

.item-info {
  height: 44px;
  min-width: 0;
  overflow: hidden;
}

.info-top {
  width: 100%;
  min-width: 0;
  gap: 8px;
}

.item-name {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.item-time {
  font-size: 11px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.info-bottom {
  width: 100%;
  min-width: 0;
  gap: 6px;
  overflow: hidden;
}

.item-msg-text {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
  line-height: 18px;
}

.item-msg-draft {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  color: var(--color-error);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
  line-height: 18px;
}

.item-msg-text :deep(span),
.item-msg-draft :deep(span),
.item-name :deep(span) {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-badge-section {
  gap: 6px;
  flex-shrink: 0;
}

.mute-icon {
  opacity: 0.6;
}

.unread-badge {
  background-color: var(--color-error);
  border-radius: 10px;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.badge-text {
  color: #ffffff;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}
</style>
