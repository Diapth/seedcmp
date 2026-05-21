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
  ContextMenu 
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

const showMenu = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const selectedMsg = ref<any>(null);

const messages = computed(() => {
  return messageStore.messages[props.channelId] || [];
});

function scrollToBottom(behavior: 'auto' | 'smooth' = 'auto') {
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
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
  const prevMsg = messages.value[index - 1];
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

const menuItems = computed(() => {
  if (!selectedMsg.value) return [];
  const items = [];
  
  const isText = selectedMsg.value.content?.type === 1;
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

  const isMine = isMe(selectedMsg.value);
  const now = Math.floor(Date.now() / 1000);
  const isWithinWindow = (now - selectedMsg.value.timestamp) < remoteConfig.value.revoke_second;
  
  if (isMine && isWithinWindow) {
    items.push({
      label: '撤回消息',
      danger: true,
      action: async () => {
        try {
          await messageStore.revokeMessage(
            props.channelId,
            props.channelType,
            selectedMsg.value.messageID,
            selectedMsg.value.clientMsgNo
          );
          Message.success('已撤回消息');
        } catch (err: any) {
          Message.error(err.msg || '撤回失败');
        }
      }
    });
  items.push({
    label: '回复',
    action: () => {
      messageStore.setReplyTarget(selectedMsg.value);
    }
  });

  return items;
});
</script>

<template>
  <div ref="scrollContainer" class="message-list">
    <div v-for="(msg, idx) in messages" :key="msg.clientMsgNo || msg.messageID" class="message-row-wrapper">
      <TimeCell v-if="shouldShowTime(msg, idx)" :timestamp="msg.timestamp" />

      <div 
        v-if="msg.content?.type === 1000 || msg.isRevoked" 
        class="sys-msg-row"
      >
        <SystemCell :message="msg" />
      </div>

      <div 
        v-else 
        class="msg-row" 
        :class="{ 'is-me': isMe(msg) }"
        @contextmenu="handleRightClick($event, msg)"
      >
        <ChannelAvatar 
          v-if="!isMe(msg)"
          :name="userStore.userCache[msg.fromUID]?.name || '加载中'"
          :avatar="userStore.userCache[msg.fromUID]?.avatar"
          :size="36"
          class="msg-avatar"
        />

        <div class="msg-bubble-container">
          <div 
            v-if="channelType === 2 && !isMe(msg)" 
            class="user-name-label"
          >
            {{ userStore.userCache[msg.fromUID]?.name || msg.fromUID }}
          </div>

          <TextCell 
            v-slot:default
            v-if="msg.content?.type === 1" 
            :message="msg" 
            :is-me="isMe(msg)" 
          />
          <ImageCell 
            v-else-if="msg.content?.type === 2" 
            :message="msg" 
            :is-me="isMe(msg)" 
          />
          <GifCell 
            v-else-if="msg.content?.type === 3" 
            :message="msg" 
            :is-me="isMe(msg)" 
          />
          <VoiceCell 
            v-else-if="msg.content?.type === 4" 
            :message="msg" 
            :is-me="isMe(msg)" 
          />
          <VideoCell 
            v-else-if="msg.content?.type === 5" 
            :message="msg" 
            :is-me="isMe(msg)" 
          />
          <LocationCell 
            v-else-if="msg.content?.type === 6" 
            :message="msg" 
            :is-me="isMe(msg)" 
          />
          <CardCell 
            v-else-if="msg.content?.type === 7" 
            :message="msg" 
            :is-me="isMe(msg)" 
          />
          <FileCell 
            v-else-if="msg.content?.type === 8" 
            :message="msg" 
            :is-me="isMe(msg)" 
          />
          <MergeCell 
            v-else-if="msg.content?.type === 11" 
            :message="msg" 
            :is-me="isMe(msg)" 
          />
          <StickerCell 
            v-else-if="msg.content?.type === 12 || msg.content?.type === 13" 
            :message="msg" 
            :is-me="isMe(msg)" 
          />
          <SystemCell 
            v-else 
            :message="msg" 
          />
        </div>
      </div>
    </div>

    <ContextMenu 
      v-if="showMenu && menuItems.length > 0" 
      :x="menuX" 
      :y="menuY" 
      :items="menuItems" 
      @close="showMenu = false" 
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
  max-width: 70%;
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
</style>
