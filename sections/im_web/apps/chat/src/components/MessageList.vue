<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed } from 'vue';
import { useMessageStore } from '@tsdaodao/datasource-vue';
import { useUserStore } from '@tsdaodao/datasource-vue';
import { useRemoteConfig } from '@tsdaodao/base-vue';
import {
  TextCell,
  ImageCell,
  SystemCell,
  TimeCell,
  VoiceCell,
  FileCell,
  VideoCell,
  GifCell,
  StickerCell,
  LocationCell,
  CardCell,
  MergeCell,
  ChannelAvatar,
  ContextMenu,
  AppDialog
} from '@tsdaodao/base-vue';
import { Message } from '@arco-design/web-vue';

const props = defineProps<{
  channelId: string;
  channelType: number;
}>();

const messageStore = useMessageStore();
const userStore = useUserStore();
const { remoteConfig } = useRemoteConfig();

const scrollContainer = ref<HTMLDivElement | null>(null);
const scrollTop = ref(0);
const historyWindowSize = ref(300);
const estimatedRowHeight = 72;

const showMenu = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const selectedMsg = ref<any>(null);
const editDialogVisible = ref(false);
const editDialogText = ref('');
const channelKey = computed(() => `${props.channelId}-${props.channelType}`);

const messages = computed(() => {
  return messageStore.messages[channelKey.value] || [];
});

const supportedMessageTypes = new Set([1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 1000]);

function isRenderableMessage(msg: any): boolean {
  if (!msg) return false;
  if (msg.isRevoked) return true;
  const type = Number(msg.content?.type || 0);
  return supportedMessageTypes.has(type);
}

const renderableMessages = computed(() => {
  return messages.value.filter(isRenderableMessage);
});

const visibleStart = computed(() => {
  if (renderableMessages.value.length <= historyWindowSize.value) return 0;
  const estimatedStart = Math.floor(scrollTop.value / estimatedRowHeight) - 20;
  return Math.max(0, Math.min(estimatedStart, renderableMessages.value.length - historyWindowSize.value));
});

const visibleEnd = computed(() => {
  return Math.min(renderableMessages.value.length, visibleStart.value + historyWindowSize.value);
});

const visibleMessages = computed(() => {
  return renderableMessages.value.slice(visibleStart.value, visibleEnd.value).map((msg, index) => ({
    msg,
    index: visibleStart.value + index
  }));
});

const topSpacerHeight = computed(() => visibleStart.value * estimatedRowHeight);
const bottomSpacerHeight = computed(() => Math.max(0, renderableMessages.value.length - visibleEnd.value) * estimatedRowHeight);

function handleScroll() {
  scrollTop.value = scrollContainer.value?.scrollTop || 0;
}

function scrollToBottom(behavior: 'auto' | 'smooth' = 'auto') {
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
      scrollTop.value = scrollContainer.value.scrollTop;
    }
  });
}

watch(() => messages.value.length, () => {
  scrollToBottom('smooth');
}, { immediate: true });

watch(() => props.channelId, () => {
  scrollToBottom('auto');
});

watch(messages, (newMsgs) => {
  const missingUids = newMsgs
    .map(m => m.fromUID)
    .filter(uid => uid && !userStore.userCache[uid]);

  if (missingUids.length > 0) {
    userStore.getUsersByIds([...new Set(missingUids)]);
  }
}, { immediate: true, deep: true });

function shouldShowTime(msg: any, index: number): boolean {
  if (index === 0) return true;
  const prevMsg = renderableMessages.value[index - 1];
  return (msg.timestamp - prevMsg.timestamp) > 300;
}

function isMe(msg: any): boolean {
  return msg.fromUID === userStore.currentUser?.uid;
}

function handleRightClick(e: MouseEvent, msg: any) {
  e.preventDefault();
  selectedMsg.value = msg;
  menuX.value = e.clientX;
  menuY.value = e.clientY;
  showMenu.value = true;
}

const menuReactions = computed(() => {
  if (!selectedMsg.value) return [];
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  return emojis.map(emoji => ({
    emoji,
    action: () => handleSendReaction(selectedMsg.value, emoji)
  }));
});

async function handleSendReaction(msg: any, emoji: string) {
  try {
    await messageStore.toggleReaction(props.channelId, props.channelType, msg, emoji);
  } catch (err: any) {
    Message.error(err.message || err.msg || '回应失败');
  }
}

const menuItems = computed(() => {
  if (!selectedMsg.value) return [];
  const items = [];
  const msg = selectedMsg.value;
  const canUseBackendAction = Boolean(msg.messageID && msg.messageSeq);

  if (msg.status === 'fail' && msg.retryable) {
    items.push({
      label: '重试发送',
      action: async () => {
        try {
          await messageStore.retryMessage(props.channelId, props.channelType, msg.clientMsgNo);
          Message.success('已重新发送');
        } catch (err: any) {
          Message.error(err.message || err.msg || '重试失败');
        }
      }
    });
  }

  const isText = msg.content?.type === 1;
  if (isText) {
    items.push({
      label: '复制文本',
      action: () => {
        const text = selectedMsg.value.content?.text || '';
        navigator.clipboard.writeText(text);
        Message.success('已复制到剪贴板');
      }
    });
  }

  const isMine = isMe(msg);
  const now = Math.floor(Date.now() / 1000);
  const isWithinWindow = (now - msg.timestamp) < remoteConfig.value.revoke_second;

  if (isMine && isText && isWithinWindow) {
    items.push({
      label: '编辑消息',
      disabled: !canUseBackendAction,
      action: () => {
        editDialogText.value = msg.content?.text || '';
        editDialogVisible.value = true;
      }
    });
  }

  if (isMine && isWithinWindow) {
    items.push({
      label: '撤回消息',
      danger: true,
      action: async () => {
        try {
          await messageStore.revokeMessage(
            props.channelId,
            props.channelType,
            selectedMsg.value.clientMsgNo,
            selectedMsg.value.messageID
          );
          Message.success('已撤回消息');
        } catch (err: any) {
          Message.error(err.msg || '撤回失败');
        }
      }
    });
  }

  items.push({
    label: msg.remoteExtra?.isPinned ? '取消置顶' : '设为置顶',
    disabled: !canUseBackendAction,
    action: async () => {
      try {
        await messageStore.togglePinnedMessage(props.channelId, props.channelType, msg);
        Message.success(msg.remoteExtra?.isPinned ? '已置顶消息' : '已取消置顶');
      } catch (err: any) {
        Message.error(err.message || err.msg || '置顶操作失败');
      }
    }
  });

  items.push({
    label: '查看回执',
    disabled: !canUseBackendAction,
    action: async () => {
      try {
        const receipt = await messageStore.fetchReceipt(msg.messageID);
        const readed = receipt.readed?.length || 0;
        const unread = receipt.unread?.length || 0;
        Message.info(`已读 ${readed} 人，未读 ${unread} 人`);
      } catch (err: any) {
        Message.warning(err.message || err.msg || '回执暂不可用');
      }
    }
  });

  items.push({
    label: '提醒暂不可用',
    disabled: true,
    action: () => {}
  });

  items.push({
    label: '回复',
    action: () => {
      messageStore.setReplyTarget(msg);
    }
  });

  items.push({
    label: '本地删除',
    danger: true,
    disabled: !canUseBackendAction,
    action: async () => {
      try {
        await messageStore.deleteLocalMessage(props.channelId, props.channelType, msg);
        Message.success('已在本地删除');
      } catch (err: any) {
        Message.error(err.message || err.msg || '删除失败');
      }
    }
  });

  if (isMine || props.channelType === 2) {
    items.push({
      label: '双向删除',
      danger: true,
      disabled: !canUseBackendAction,
      action: async () => {
        try {
          await messageStore.deleteMutualMessage(props.channelId, props.channelType, msg);
          Message.success('已双向删除');
        } catch (err: any) {
          Message.error(err.message || err.msg || '双向删除失败');
        }
      }
    });
  }

  return items;
});

async function handleConfirmEdit(value?: string) {
  if (!selectedMsg.value) return;
  const nextText = String(value || '').trim();
  if (!nextText || nextText === selectedMsg.value.content?.text) {
    editDialogVisible.value = false;
    return;
  }
  try {
    await messageStore.editMessage(props.channelId, props.channelType, selectedMsg.value, nextText);
    Message.success('已编辑消息');
    editDialogVisible.value = false;
  } catch (err: any) {
    Message.error(err.message || err.msg || '编辑失败');
  }
}
</script>

<template>
  <div ref="scrollContainer" class="message-list" @scroll="handleScroll">
    <div v-if="topSpacerHeight > 0" class="history-spacer" :style="{ height: `${topSpacerHeight}px` }"></div>

    <div v-for="item in visibleMessages" :key="item.msg.clientMsgNo || item.msg.messageID" class="message-row-wrapper">
      <TimeCell v-if="shouldShowTime(item.msg, item.index)" :timestamp="item.msg.timestamp" />

      <div
        v-if="item.msg.content?.type === 1000 || item.msg.isRevoked"
        class="sys-msg-row"
      >
        <SystemCell :message="item.msg" />
      </div>

      <div
        v-else
        class="msg-row"
        :class="{ 'is-me': isMe(item.msg) }"
        @contextmenu="handleRightClick($event, item.msg)"
      >
        <ChannelAvatar
          v-if="!isMe(item.msg)"
          :name="userStore.userCache[item.msg.fromUID]?.name || '加载中'"
          :avatar="userStore.userCache[item.msg.fromUID]?.avatar"
          :size="36"
          class="msg-avatar"
        />

        <div class="msg-bubble-container">
          <div
            v-if="channelType === 2 && !isMe(item.msg)"
            class="user-name-label"
          >
            {{ userStore.userCache[item.msg.fromUID]?.name || item.msg.fromUID }}
          </div>

          <!-- Quote / Reply Reference Box -->
          <div v-if="item.msg.content?.reply" class="quote-reference-box" :class="{ 'is-me': isMe(item.msg) }">
            <span class="quote-author">@{{ item.msg.content.reply.fromName || item.msg.content.reply.fromUID }}:</span>
            <span class="quote-text">{{ item.msg.content.reply.content?.text || '[消息]' }}</span>
          </div>

          <TextCell
            v-if="item.msg.content?.type === 1"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <ImageCell
            v-else-if="item.msg.content?.type === 2"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <GifCell
            v-else-if="item.msg.content?.type === 3"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <VoiceCell
            v-else-if="item.msg.content?.type === 4"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <VideoCell
            v-else-if="item.msg.content?.type === 5"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <LocationCell
            v-else-if="item.msg.content?.type === 6"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <CardCell
            v-else-if="item.msg.content?.type === 7"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <FileCell
            v-else-if="item.msg.content?.type === 8"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <MergeCell
            v-else-if="item.msg.content?.type === 11"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <StickerCell
            v-else-if="item.msg.content?.type === 12 || item.msg.content?.type === 13"
            :message="item.msg"
            :is-me="isMe(item.msg)"
          />
          <!-- Reactions Bar -->
          <div v-if="item.msg.reactions && item.msg.reactions.length > 0" class="reactions-bar">
            <div
              v-for="reaction in item.msg.reactions"
              :key="reaction.emoji"
              class="reaction-badge"
              @click="handleSendReaction(item.msg, reaction.emoji)"
            >
              <span class="reaction-emoji">{{ reaction.emoji }}</span>
              <span class="reaction-count">{{ reaction.count }}</span>
            </div>
          </div>

        </div>
      </div>
    </div>

    <div v-if="bottomSpacerHeight > 0" class="history-spacer" :style="{ height: `${bottomSpacerHeight}px` }"></div>

    <ContextMenu
      v-if="showMenu && menuItems.length > 0"
      :x="menuX"
      :y="menuY"
      :items="menuItems"
      :reactions="menuReactions"
      @close="showMenu = false"
    />

    <AppDialog
      v-model="editDialogText"
      :visible="editDialogVisible"
      title="编辑消息"
      mode="input"
      placeholder="输入新的消息内容"
      confirm-text="保存"
      @confirm="handleConfirmEdit"
      @close="editDialogVisible = false"
    />
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background-color: var(--bg-primary);
}

.message-row-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 32px;
  overflow-anchor: none;
}

.history-spacer {
  flex: 0 0 auto;
  pointer-events: none;
}

.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
}

.msg-row.is-me {
  flex-direction: row-reverse;
}

.msg-avatar {
  margin-top: 4px;
}

.msg-bubble-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  max-width: min(70%, 720px);
  overflow-wrap: anywhere;
}

.msg-row.is-me .msg-bubble-container {
  align-items: flex-end;
}

.user-name-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: 4px;
  margin-bottom: 2px;
}

.sys-msg-row {
  width: 100%;
  display: flex;
  justify-content: center;
}

/* Quote Reference */
.quote-reference-box {
  background-color: var(--bg-secondary);
  border-left: 2px solid var(--primary-color, #165dff);
  padding: 4px 8px;
  border-radius: 2px;
  font-size: 11px;
  max-width: 100%;
  display: flex;
  gap: 4px;
  margin-bottom: 2px;
}

.quote-reference-box.is-me {
  border-left: none;
  border-right: 2px solid var(--primary-color, #165dff);
}

.quote-author {
  font-weight: 500;
  color: var(--text-secondary);
}

.quote-text {
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Reactions Bar */
.reactions-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.reaction-badge {
  display: flex;
  align-items: center;
  gap: 3px;
  background-color: var(--bg-secondary);
  border: var(--border-hairline);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  cursor: pointer;
  user-select: none;
  transition: transform 0.1s, background-color 0.2s;
}

.reaction-badge:hover {
  background-color: var(--bg-hover);
  transform: scale(1.05);
}

.reaction-emoji {
  font-size: 12px;
}

.reaction-count {
  color: var(--text-secondary);
  font-weight: 500;
}

</style>
