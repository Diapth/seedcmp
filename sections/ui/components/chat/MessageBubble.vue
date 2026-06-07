<template>
  <!-- System Message -->
  <view class="system-message-row" v-if="data.type === 'system' || data.status === 'revoked'">
    <view class="system-badge">
      <text class="system-text">{{ data.content }}</text>
    </view>
  </view>

  <!-- Chat Message Bubble -->
  <view
    v-else
    class="message-row"
    :class="{ 'message-me': isMe }"
  >
    <!-- Avatar (only for others) -->
    <view
      v-if="!isMe"
      class="message-avatar-hit"
      @click.stop="handleAvatarSelect"
      @contextmenu.prevent.stop="handleAvatarContextMenu"
      @longpress.stop="handleAvatarContextMenu"
    >
      <AppAvatar
        :src="data.senderAvatar || data.avatar"
        :text="data.senderName"
        :size="38"
        class="message-avatar"
      />
    </view>

    <view class="message-content-wrapper flex-column">
      <!-- Sender Name (Group Chat only) -->
      <text
        class="sender-name"
        v-if="showSenderName"
        @click.stop="handleAvatarSelect"
      >{{ data.senderName }}</text>

      <!-- Reply Reference -->
      <view
        v-if="data.replyRef"
        class="reply-ref"
        :class="{ 'reply-ref-me': isMe }"
        @click="$emit('jump-to', data.replyRef)"
      >
        <text class="reply-ref-sender">{{ data.replyRef.senderName }}:</text>
        <text class="reply-ref-content">{{ data.replyRef.contentPreview }}</text>
      </view>

      <!-- Bubble Layout -->
      <view
        class="bubble-and-status flex-row"
        :class="{ 'bubble-and-status-me': isMe }"
      >

        <!-- Sending / Failed indicators for Self -->
        <view class="status-indicator-left flex-row" v-if="isMe">
          <view class="loading-spin" v-if="data.status === 'sending'" />
          <view class="failed-retry" v-if="data.status === 'failed'" @click="$emit('retry', data)">
            <AppIcon name="info" :size="16" color="var(--color-error)" />
          </view>
        </view>

        <!-- Bubble Card -->
        <view
          class="message-bubble"
          :class="[isMe ? 'bubble-me' : 'bubble-other', 'bubble-' + data.type]"
          @contextmenu.prevent.stop="handleContextMenu"
          @longpress="handleLongPress"
        >
          <!-- Text Message -->
          <text
            v-if="data.type === 'text'"
            class="bubble-text"
            space="emsp"
          ><text
              v-for="(seg, idx) in textSegments"
              :key="idx"
              :class="{ 'mention-highlight': seg.mention }"
            >{{ seg.text }}</text></text>

          <!-- Image Message -->
          <image
            v-else-if="data.type === 'image'"
            :src="data.content"
            mode="widthFix"
            class="bubble-image"
            @click="openLightbox([data.content], 0)"
          />

          <!-- File Message -->
          <FileCard
            v-else-if="data.type === 'file'"
            :file="data"
            :is-me="isMe"
            @open="$emit('open-file', $event)"
            @preview="$emit('preview-file', $event)"
          />

          <!-- Voice Message -->
          <VoiceCard
            v-else-if="data.type === 'voice'"
            :voice="data"
            :is-me="isMe"
          />

        </view>

      </view>

      <!-- Reactions -->
      <MessageReactions
        v-if="data.reactions && data.reactions.length"
        :reactions="data.reactions"
        :align="isMe ? 'right' : 'left'"
        @toggle="(emoji) => $emit('react', { msg: data, emoji })"
        @show-users="(emoji) => $emit('show-reaction-users', { msg: data, emoji })"
      />
    </view>

    <!-- Self Avatar -->
    <view
      v-if="isMe"
      class="message-avatar-hit"
      @click.stop="handleAvatarSelect"
      @contextmenu.prevent.stop="handleAvatarContextMenu"
      @longpress.stop="handleAvatarContextMenu"
    >
      <AppAvatar
        :src="myAvatar"
        :text="myDisplayName"
        :size="38"
        class="message-avatar"
      />
    </view>

  </view>
</template>

<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import AppAvatar from '../common/AppAvatar.vue';
import AppIcon from '../common/AppIcon.vue';
import FileCard from './FileCard.vue';
import VoiceCard from './VoiceCard.vue';
import MessageReactions from './MessageReactions.vue';
import {
  isSelfSender,
  resolveSelfAvatar,
  resolveSelfId,
  resolveSelfName
} from '@/services/native-im/message-state';

const props = defineProps({
  data: {
    type: Object,
    required: true
  },
  showSenderName: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'retry',
  'contextmenu',
  'member-contextmenu',
  'member-select',
  'react',
  'show-reaction-users',
  'open-lightbox',
  'jump-to',
  'open-file',
  'preview-file'
]);

const appStore = useAppStore();

const isMe = computed(() => {
  return isSelfSender(props.data.senderId, appStore.currentUser);
});

const myAvatar = computed(() => {
  return resolveSelfAvatar(appStore.currentUser || {});
});

const myDisplayName = computed(() => {
  return resolveSelfName(appStore.currentUser || {}, props.data.senderName || '我');
});

// 拆分文本为 mention 段(高亮) + 普通段
const textSegments = computed(() => {
  const text = props.data.content || '';
  const mentions = props.data.mentions || [];
  if (!mentions.length) return [{ text, mention: false }];
  // 简单策略: 扫描 @昵称 字符串, 命中 mentions 则标记 mention=true
  const segments = [];
  let cursor = 0;
  const sorted = [...mentions].sort((a, b) => a.offset - b.offset);
  for (const m of sorted) {
    const start = m.offset;
    const matchText = `@${m.name}`;
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), mention: false });
    }
    segments.push({ text: text.slice(start, start + matchText.length), mention: true });
    cursor = start + matchText.length;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), mention: false });
  }
  return segments;
});

function handleContextMenu(e) {
  emit('contextmenu', { event: e, msg: props.data });
}

function handleLongPress(e) {
  handleContextMenu(e);
}

function handleAvatarContextMenu(e) {
  emit('member-contextmenu', {
    event: e,
    member: senderMember()
  });
}

function handleAvatarSelect() {
  emit('member-select', { member: senderMember() });
}

function senderMember() {
  if (isMe.value) {
    return {
      id: resolveSelfId(appStore.currentUser || {}),
      nickname: myDisplayName.value,
      avatar: myAvatar.value,
      role: props.data.senderRole || 'member'
    };
  }
  return {
    id: props.data.senderId,
    nickname: props.data.senderName,
    avatar: props.data.senderAvatar || props.data.avatar || '',
    role: props.data.senderRole || 'member'
  };
}

function openLightbox(images, index) {
  emit('open-lightbox', { images, index });
}
</script>

<style scoped>
.system-message-row {
  display: flex;
  justify-content: center;
  margin: 16px 0;
}

.system-badge {
  background-color: var(--color-bg-hover);
  padding: 4px 10px;
  border-radius: 6px;
}

.system-text {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.message-row {
  display: flex;
  flex-direction: row;
  margin: 16px 0;
  gap: 10px;
  align-items: flex-start;
  padding: 0 16px;
}

.message-me {
  justify-content: flex-end;
}

.message-avatar-hit,
.message-avatar {
  flex-shrink: 0;
}

.message-avatar-hit {
  cursor: pointer;
}

.message-content-wrapper {
  max-width: min(70%, 640px);
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.message-me .message-content-wrapper {
  align-items: flex-end;
}

.sender-name {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
  margin-left: 4px;
  align-self: flex-start;
  cursor: pointer;
}

.message-me .sender-name {
  text-align: right;
  margin-right: 4px;
  margin-left: 0;
  align-self: flex-end;
}

.bubble-and-status {
  gap: 8px;
  align-items: center;
}

.bubble-and-status-me {
  justify-content: flex-end;
}

.message-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  word-break: break-word;
  max-width: 100%;
}

.bubble-me {
  background-color: var(--color-primary);
  color: #ffffff;
  border-top-right-radius: 2px;
}

.bubble-other {
  background-color: var(--color-bg-surface);
  color: var(--color-text-primary);
  border-top-left-radius: 2px;
  border: 1px solid var(--color-border);
}

.bubble-image {
  max-width: 200px;
  border-radius: 8px;
  display: block;
}

.bubble-image-only,
.bubble-file,
.bubble-file-only,
.bubble-voice-only {
  background-color: transparent !important;
  border: none !important;
  padding: 0 !important;
  box-shadow: none !important;
}

.bubble-file.bubble-me,
.bubble-file-only.bubble-me,
.bubble-voice-only.bubble-me,
.bubble-image-only.bubble-me {
  background-color: transparent !important;
}

.voice-duration {
  font-weight: 600;
  margin-left: 8px;
}

.loading-spin {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

.failed-retry {
  cursor: pointer;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.reply-ref {
  font-size: 12px;
  padding: 6px 10px;
  border-left: 2px solid var(--color-primary);
  background-color: var(--color-bg-muted);
  border-radius: 4px;
  margin-bottom: 6px;
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  cursor: pointer;
  align-self: flex-start;
  box-sizing: border-box;
  width: fit-content;
}
.reply-ref-me {
  align-self: flex-end;
  border-left: none;
  border-right: 2px solid var(--color-primary);
  background-color: rgba(0, 74, 198, 0.08);
}
.reply-ref-sender {
  font-weight: 600;
  color: var(--color-primary);
  flex-shrink: 0;
}
.reply-ref-content {
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  max-width: 240px;
}

.mention-highlight {
  color: var(--color-primary);
  font-weight: 600;
}
</style>
