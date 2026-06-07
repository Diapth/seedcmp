<template>
  <view
    v-if="visible"
    class="msg-ctx-mask"
    @click="close"
    @touchmove.stop.prevent="noop"
  >
    <view
      class="msg-ctx-menu glass-panel"
      :class="{ 'msg-ctx-menu-mobile': !isDesktopMode }"
      :style="{ top: yPx, left: xPx }"
      @click.stop
    >
      <view v-if="canReact" class="quick-reaction-row">
        <view
          v-for="emoji in quickEmojis"
          :key="emoji"
          class="quick-reaction"
          :title="`添加 ${emoji}`"
          @click="emitAction('react-emoji', { emoji })"
        >
          <text class="quick-reaction-text">{{ emoji }}</text>
        </view>
      </view>

      <view v-if="canReact" class="msg-ctx-divider" />

      <view
        v-for="item in menuItems"
        :key="item.action"
        class="msg-ctx-item"
        :class="{ destructive: item.danger, disabled: item.disabled }"
        @click="!item.disabled && emitAction(item.action)"
      >
        <AppIcon
          v-if="item.icon"
          :name="item.icon"
          :size="16"
          :color="item.danger ? 'var(--color-error)' : 'var(--color-text-primary)'"
        />
        <text class="msg-ctx-text" :class="{ 'text-error': item.danger }">{{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import AppIcon from '../common/AppIcon.vue';
import { useAppStore } from '@/stores/app';
import { isSelfSender } from '@/services/native-im/message-state';

const props = defineProps({
  visible: { type: Boolean, default: false },
  msg: { type: Object, default: null },
  x: { type: Number, default: 100 },
  y: { type: Number, default: 100 },
  isDesktop: { type: Boolean, default: true }
});

const emit = defineEmits(['update:visible', 'action']);
const appStore = useAppStore();

const quickEmojis = ['👍', '❤️', '😂', '😮', '🙏', '🎉'];

function noop() {}

const isDesktopMode = computed(() => props.isDesktop);
const isMyMsg = computed(() => props.msg && isSelfSender(props.msg.senderId, appStore.currentUser));
const isRevoked = computed(() => props.msg?.status === 'revoked' || props.msg?.type === 'system');
const canReact = computed(() => !!props.msg && !isRevoked.value);

const xPx = computed(() => {
  const w = typeof window !== 'undefined' ? window.innerWidth : 375;
  return `${Math.min(Math.max(props.x, 8), w - 220)}px`;
});

const yPx = computed(() => {
  const h = typeof window !== 'undefined' ? window.innerHeight : 600;
  return `${Math.min(Math.max(props.y, 8), h - 280)}px`;
});

const menuItems = computed(() => {
  if (!props.msg) return [];

  const items = [
    {
      action: 'reply',
      label: '引用消息',
      icon: 'quote',
      disabled: isRevoked.value
    },
    {
      action: 'react',
      label: '添加表情状态',
      icon: 'smile',
      disabled: isRevoked.value
    }
  ];

  if (isMyMsg.value && !isRevoked.value) {
    items.push({
      action: 'revoke',
      label: '撤回消息',
      icon: 'undo',
      danger: true
    });
  }

  items.push({
    action: 'delete',
    label: '删除消息',
    icon: 'trash',
    danger: true
  });

  return items;
});

function emitAction(action, extra = {}) {
  emit('action', { action, msg: props.msg, ...extra });
  close();
}

function close() {
  emit('update:visible', false);
}
</script>

<style scoped>
.msg-ctx-mask {
  position: fixed;
  inset: 0;
  z-index: 1001;
  background-color: transparent;
}

.msg-ctx-menu {
  position: absolute;
  border-radius: 12px;
  padding: 6px 0;
  min-width: 188px;
  max-width: 240px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
}

.msg-ctx-menu-mobile {
  min-width: 196px;
  border-radius: 12px;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.18);
}

.quick-reaction-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
  padding: 8px;
}

.quick-reaction {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.16s ease, transform 0.16s ease;
}

.quick-reaction:hover,
.quick-reaction:active {
  background-color: var(--color-bg-hover);
}

.quick-reaction:active {
  transform: scale(0.94);
}

.quick-reaction-text {
  font-size: 18px;
  line-height: 1;
}

.msg-ctx-divider {
  height: 1px;
  background-color: var(--color-border);
  margin: 2px 0;
}

.msg-ctx-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  min-height: 40px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  box-sizing: border-box;
}

.msg-ctx-item:hover,
.msg-ctx-item:active {
  background-color: var(--color-bg-hover);
}

.msg-ctx-item.disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.msg-ctx-item.destructive .msg-ctx-text {
  color: var(--color-error);
}

.msg-ctx-text {
  font-size: 14px;
  color: var(--color-text-primary);
}

.text-error {
  color: var(--color-error);
}
</style>
