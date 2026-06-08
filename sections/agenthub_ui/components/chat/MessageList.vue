<template>
  <scroll-view 
    scroll-y 
    class="message-list-scroll"
    :scroll-into-view="scrollToId"
    scroll-with-animation
  >
    <view class="message-list-inner">
      <template v-for="(msg, index) in list" :key="msg.id">
        <view :id="messageDomId(msg)" class="message-list-item">
        <view v-if="shouldShowTime(index)" class="message-time-row">
          <text class="message-time-text">{{ displayTime(msg) }}</text>
        </view>
        <MessageBubble
          :data="msg"
          :show-sender-name="isGroup"
          @contextmenu="$emit('message-contextmenu', $event)"
          @member-contextmenu="$emit('member-contextmenu', $event)"
          @member-select="$emit('member-select', $event)"
          @retry="$emit('message-retry', $event)"
          @react="$emit('message-react', $event)"
          @show-reaction-users="$emit('message-show-reaction-users', $event)"
          @open-lightbox="$emit('message-open-lightbox', $event)"
          @jump-to="$emit('message-jump-to', $event)"
          @open-file="$emit('message-open-file', $event)"
          @preview-file="$emit('message-preview-file', $event)"
        />
        </view>
      </template>
      <!-- Bottom Anchor to auto scroll to -->
      <view id="bottom-anchor" class="bottom-anchor-element" />
    </view>
  </scroll-view>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import MessageBubble from './MessageBubble.vue';
import { formatChatTime, shouldShowMessageTime } from '@/utils/formatMessage';

const props = defineProps({
  list: {
    type: Array,
    default: () => []
  },
  isGroup: {
    type: Boolean,
    default: false
  },
  bottomAnchorKey: {
    type: [String, Number],
    default: ''
  }
});

defineEmits([
  'message-contextmenu',
  'member-contextmenu',
  'member-select',
  'message-retry',
  'message-react',
  'message-show-reaction-users',
  'message-open-lightbox',
  'message-jump-to',
  'message-open-file',
  'message-preview-file'
]);

const scrollToId = ref('');

watch(() => props.list, () => {
  scrollToBottom();
}, { deep: true, immediate: true });

watch(() => props.bottomAnchorKey, () => {
  scrollToBottom();
}, { flush: 'post' });

function scrollToBottom() {
  nextTick(() => {
    scrollToId.value = '';
    nextTick(() => {
      scrollToId.value = 'bottom-anchor';
    });
  });
}

function shouldShowTime(index) {
  return shouldShowMessageTime(props.list[index], props.list[index - 1]);
}

function displayTime(msg) {
  return formatChatTime(msg?.time);
}

function messageDomId(msg = {}) {
  const ref = String(msg.messageID || msg.messageId || msg.id || msg.clientMsgNo || '');
  return `message-${ref.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function scrollToMessage(messageRef) {
  const ref = String(messageRef || '');
  const message = props.list.find((msg) =>
    String(msg.id || '') === ref ||
    String(msg.messageID || '') === ref ||
    String(msg.messageId || '') === ref ||
    String(msg.clientMsgNo || '') === ref ||
    (msg.messageSeq !== undefined && String(msg.messageSeq) === ref)
  );
  if (!message) return false;
  scrollToId.value = '';
  nextTick(() => {
    scrollToId.value = messageDomId(message);
  });
  return true;
}

defineExpose({ scrollToMessage });
</script>

<style scoped>
.message-list-scroll {
  width: 100%;
  height: 100%;
  background-color: var(--color-bg-base);
}
.message-list-inner {
  padding-top: 18px;
  padding-bottom: 20px;
}
.message-list-item {
  min-height: 1px;
}
.message-time-row {
  display: flex;
  justify-content: center;
  padding: 2px 16px;
  margin: 10px 0 2px;
  box-sizing: border-box;
}
.message-time-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: calc(100vw - 48px);
  min-height: 24px;
  padding: 0 10px;
  border-radius: 12px;
  background-color: rgba(148, 163, 184, 0.16);
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}
.bottom-anchor-element {
  height: 1px;
  width: 100%;
}
</style>
