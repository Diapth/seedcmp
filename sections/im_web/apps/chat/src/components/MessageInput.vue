<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useMessageStore, useConversationStore, useGroupStore, useUserStore } from '@tsdaodao/datasource-vue';
import WKSDK, { CMDContent } from 'wukongimjssdk';

const props = defineProps<{
  channelId: string;
  channelType: number;
}>();

const messageStore = useMessageStore();
const conversationStore = useConversationStore();
const groupStore = useGroupStore();
const userStore = useUserStore();

const inputText = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);
let typingTimeout: any = null;

// Mention state
const showMentionPopup = ref(false);
const mentionQuery = ref('');
const mentionedUids = ref<string[]>([]);

// Reply targetcomputed fields
const replyUser = computed(() => {
  const target = messageStore.replyTarget;
  if (!target) return '';
  return userStore.userCache[target.fromUID]?.name || target.fromUID;
});

const replyDigest = computed(() => {
  const target = messageStore.replyTarget;
  if (!target) return '';
  return target.content?.text || '[消息]';
});

// Group members list
const currentGroupMembers = computed(() => {
  return groupStore.groupMembers[props.channelId] || [];
});

const filteredGroupMembers = computed(() => {
  const query = mentionQuery.value.toLowerCase();
  if (!query) return currentGroupMembers.value;
  return currentGroupMembers.value.filter(m => 
    (m.member_name || '').toLowerCase().includes(query) ||
    (m.member_uid || '').toLowerCase().includes(query)
  );
});

watch(() => props.channelId, (newId) => {
  const conv = conversationStore.conversations.find(
    c => c.channel_id === newId && c.channel_type === props.channelType
  );
  inputText.value = conv?.draft || '';
  messageStore.setReplyTarget(null);
  showMentionPopup.value = false;
}, { immediate: true });

watch(inputText, (newVal) => {
  conversationStore.updateDraft(props.channelId, props.channelType, newVal);
  triggerTyping();

  if (props.channelType !== 2) return;

  const caretPos = textareaRef.value?.selectionStart || 0;
  const textBeforeCaret = newVal.substring(0, caretPos);
  const lastAtIdx = textBeforeCaret.lastIndexOf('@');

  if (lastAtIdx !== -1 && (lastAtIdx === 0 || textBeforeCaret[lastAtIdx - 1] === ' ' || textBeforeCaret[lastAtIdx - 1] === '\n')) {
    const query = textBeforeCaret.substring(lastAtIdx + 1);
    if (!query.includes(' ')) {
      showMentionPopup.value = true;
      mentionQuery.value = query;
      return;
    }
  }
  showMentionPopup.value = false;
});

function triggerTyping() {
  if (typingTimeout) return;
  
  typingTimeout = setTimeout(() => {
    typingTimeout = null;
  }, 2000);

  const channel = WKSDK.shared().newChannel(props.channelId, props.channelType);
  const cmdContent = new CMDContent();
  cmdContent.cmd = 'typing';
  cmdContent.param = {};
  WKSDK.shared().chatManager.send(cmdContent, channel);
}

function selectMember(member: any) {
  const caretPos = textareaRef.value?.selectionStart || 0;
  const textBeforeCaret = inputText.value.substring(0, caretPos);
  const textAfterCaret = inputText.value.substring(caretPos);
  const lastAtIdx = textBeforeCaret.lastIndexOf('@');

  if (lastAtIdx !== -1) {
    const name = member.member_name || member.member_uid;
    const newText = textBeforeCaret.substring(0, lastAtIdx) + `@${name} ` + textAfterCaret;
    inputText.value = newText;
    if (!mentionedUids.value.includes(member.member_uid)) {
      mentionedUids.value.push(member.member_uid);
    }
  }
  showMentionPopup.value = false;
  textareaRef.value?.focus();
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text) return;

  inputText.value = '';
  conversationStore.updateDraft(props.channelId, props.channelType, '');

  const options: any = {};
  
  // Build Mention
  if (props.channelType === 2) {
    if (text.includes('@所有人') || text.includes('@all')) {
      options.mention = { all: true, uids: [] };
    } else if (mentionedUids.value.length > 0) {
      const activeMentions = mentionedUids.value.filter(uid => {
        const member = currentGroupMembers.value.find(m => m.member_uid === uid);
        const name = member?.member_name || uid;
        return text.includes(`@${name}`);
      });
      if (activeMentions.length > 0) {
        options.mention = { all: false, uids: activeMentions };
      }
    }
  }

  // Build Reply / Quote
  if (messageStore.replyTarget) {
    const target = messageStore.replyTarget;
    options.reply = {
      messageID: target.messageID,
      messageSeq: target.messageSeq,
      fromUID: target.fromUID,
      fromName: userStore.userCache[target.fromUID]?.name || target.fromUID,
      content: target.content
    };
  }

  try {
    await messageStore.sendMessage(props.channelId, props.channelType, text, options);
    messageStore.setReplyTarget(null);
    mentionedUids.value = [];
  } catch (err) {
    console.error('Failed to send message', err);
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    if (!e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }
}

onBeforeUnmount(() => {
  if (typingTimeout) clearTimeout(typingTimeout);
});
</script>

<template>
  <div class="message-input-container">
    <!-- Mention Selector popup -->
    <div v-if="showMentionPopup && filteredGroupMembers.length > 0" class="mention-popup">
      <div 
        v-for="member in filteredGroupMembers" 
        :key="member.member_uid" 
        class="mention-item"
        @click="selectMember(member)"
      >
        <span class="mention-name">{{ member.member_name || member.member_uid }}</span>
      </div>
    </div>

    <!-- Reply target indicator bar -->
    <div v-if="messageStore.replyTarget" class="reply-preview-bar">
      <span class="reply-text">
        回复 {{ replyUser }}: {{ replyDigest }}
      </span>
      <button class="reply-close-btn" @click="messageStore.setReplyTarget(null)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="close-svg">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <div class="input-actions">
      <button class="action-btn" title="发送图片">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="action-svg">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </button>
    </div>

    <div class="input-area-wrapper">
      <textarea
        ref="textareaRef"
        v-model="inputText"
        placeholder="输入消息，Enter 发送，Ctrl+Enter 换行"
        class="input-textarea"
        rows="3"
        @keydown="handleKeyDown"
      ></textarea>
    </div>

    <div class="input-footer">
      <div class="input-hint">输入自动同步草稿</div>
      <button 
        class="send-btn" 
        :disabled="!inputText.trim()"
        @click="handleSend"
      >
        发送
      </button>
    </div>
  </div>
</template>

<style scoped>
.message-input-container {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  border-top: var(--border-hairline);
  padding: 12px 16px;
  position: relative;
}

/* Mention Popup */
.mention-popup {
  position: absolute;
  bottom: 100%;
  left: 16px;
  width: 200px;
  max-height: 200px;
  overflow-y: auto;
  background-color: var(--bg-primary);
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
  z-index: 100;
  margin-bottom: 8px;
}

.mention-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: background-color 0.2s;
}

.mention-item:hover {
  background-color: var(--bg-hover);
}

/* Reply Preview Bar */
.reply-preview-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  margin-bottom: 10px;
  border-left: 3px solid var(--primary-color, #165dff);
}

.reply-text {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.reply-close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.reply-close-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.close-svg {
  width: 14px;
  height: 14px;
}

.input-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.action-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s;
}

.action-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.action-svg {
  width: 20px;
  height: 20px;
}

.input-area-wrapper {
  flex: 1;
}

.input-textarea {
  width: 100%;
  border: none;
  background: none;
  outline: none;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  font-family: inherit;
  padding: 0;
}

.input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.input-hint {
  font-size: 11px;
  color: var(--text-secondary);
}

.send-btn {
  height: 28px;
  padding: 0 16px;
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.send-btn:hover {
  opacity: 0.9;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
