<template>
  <view class="pinned-context-panel flex-column">
    <view class="pinned-context-header flex-row align-center justify-between">
      <view class="header-copy flex-column">
        <text class="panel-title">长期上下文</text>
        <text class="panel-subtitle">{{ subtitle }}</text>
      </view>
      <view class="pin-count flex-row align-center">
        <AppIcon name="pin" :size="14" color="var(--color-primary)" />
        <text>{{ pins.length }}</text>
      </view>
    </view>

    <view v-if="pins.length && !threadId" class="unbound-note">
      <text>未绑定 Clowder thread，不进入长期上下文</text>
    </view>

    <view v-if="!pins.length" class="pin-empty">
      <text>暂无长期上下文 pin</text>
    </view>

    <view v-else class="pin-list flex-column">
      <view
        v-for="pin in pins"
        :key="pinKey(pin)"
        class="pin-row flex-column"
        :class="{ degraded: isDegraded(pin) }"
      >
        <view class="pin-row-top flex-row align-center justify-between">
          <text class="pin-sender">{{ pin.senderName || pin.senderId || '未知用户' }}</text>
          <text class="pin-state">{{ stateLabel(pin) }}</text>
        </view>
        <text class="pin-excerpt" @click="$emit('jump-message', messageRef(pin))">{{ excerpt(pin) }}</text>
        <view class="pin-actions flex-row align-center">
          <button class="pin-action" :disabled="isDegraded(pin)" @click="$emit('jump-message', messageRef(pin))">定位</button>
          <button class="pin-action danger" @click="$emit('unpin', pin)">取消 pin</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { useMessageStore } from '@/stores/message';
import AppIcon from '../common/AppIcon.vue';

const props = defineProps({
  channelId: { type: String, required: true },
  channelType: { type: Number, required: true },
  threadId: { type: String, default: '' }
});

defineEmits(['jump-message', 'unpin']);

const messageStore = useMessageStore();

const pins = computed(() => messageStore.getPinnedMessages(props.channelId, props.channelType));
const subtitle = computed(() => {
  if (!pins.value.length) return '从消息菜单 pin 关键约束';
  if (!props.threadId) return '已保存到 IM，未注入 Clowder';
  return '将优先进入 Clowder 上下文';
});

function messageRef(pin = {}) {
  return String(pin.messageID || pin.messageId || pin.id || pin.clientMsgNo || '');
}

function pinKey(pin = {}) {
  return `${messageRef(pin)}:${pin.messageSeq || pin.clientMsgNo || 'pin'}`;
}

function isDegraded(pin = {}) {
  return Boolean(pin.remoteExtra?.unavailable || pin.remoteExtra?.pinStatus === 'source_deleted' || pin.remoteExtra?.pinStatus === 'permission_denied');
}

function stateLabel(pin = {}) {
  const status = pin.remoteExtra?.pinStatus || 'active';
  if (status === 'source_deleted') return '来源已删除';
  if (status === 'permission_denied') return '无权限';
  if (pin.remoteExtra?.unavailable) return '不可预览';
  if (!props.threadId) return '未绑定';
  return '已注入';
}

function excerpt(pin = {}) {
  return String(pin.content || pin.text || '置顶消息暂不可预览').slice(0, 96);
}
</script>

<style scoped>
.pinned-context-panel {
  padding: 18px 20px;
  gap: 12px;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-bg-surface);
}

.pinned-context-header {
  gap: 12px;
}

.header-copy {
  min-width: 0;
  gap: 3px;
}

.panel-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.panel-subtitle {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.pin-count {
  min-width: 36px;
  min-height: 28px;
  padding: 0 8px;
  gap: 4px;
  border-radius: 8px;
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 800;
  box-sizing: border-box;
}

.unbound-note,
.pin-empty {
  padding: 10px 12px;
  border-radius: 8px;
  background-color: var(--color-bg-muted);
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.pin-list {
  gap: 10px;
}

.pin-row {
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-bg-base);
  box-sizing: border-box;
}

.pin-row.degraded {
  border-style: dashed;
}

.pin-row-top {
  gap: 8px;
}

.pin-sender,
.pin-state {
  font-size: 12px;
  line-height: 1.4;
}

.pin-sender {
  min-width: 0;
  flex: 1;
  font-weight: 800;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pin-state {
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.pin-excerpt {
  font-size: 13px;
  line-height: 1.55;
  color: var(--color-text-primary);
  cursor: pointer;
  word-break: break-word;
}

.pin-actions {
  gap: 8px;
}

.pin-action {
  margin: 0;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-bg-surface);
  color: var(--color-text-primary);
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.pin-action::after {
  border: none;
}

.pin-action[disabled] {
  opacity: 0.45;
}

.pin-action.danger {
  color: var(--color-error);
}
</style>
