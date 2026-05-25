<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue';
import { Message as ArcoMessage } from '@arco-design/web-vue';
import { commonApi, useMessageStore, useConversationStore, useGroupStore, useUserStore } from '@tsdaodao/datasource-vue';
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
const imageInputRef = ref<HTMLInputElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploadHint = ref('');
const robotMenuState = ref<'idle' | 'loading' | 'ready' | 'unavailable' | 'failed'>('idle');
const robotMenus = ref<Array<{ id: string; title: string; command: string }>>([]);
const robotAck = ref('');
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

function getMemberUid(member: any): string {
  return String(member?.member_uid || member?.uid || '');
}

function getMemberDisplayName(member: any): string {
  return String(member?.display_name || member?.member_name || member?.name || getMemberUid(member));
}

const filteredGroupMembers = computed(() => {
  const query = mentionQuery.value.toLowerCase();
  if (!query) return currentGroupMembers.value;
  return currentGroupMembers.value.filter(m => 
    getMemberDisplayName(m).toLowerCase().includes(query) ||
    getMemberUid(m).toLowerCase().includes(query)
  );
});

watch(() => props.channelId, (newId) => {
  const conv = conversationStore.conversations.find(
    c => c.channel_id === newId && c.channel_type === props.channelType
  );
  inputText.value = conv?.draft || '';
  messageStore.setReplyTarget(null);
  showMentionPopup.value = false;
  if (props.channelType === 2 && newId && currentGroupMembers.value.length === 0) {
    void groupStore.fetchGroupMembers(newId);
  }
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
    const uid = getMemberUid(member);
    const name = getMemberDisplayName(member);
    const newText = textBeforeCaret.substring(0, lastAtIdx) + `@${name} ` + textAfterCaret;
    inputText.value = newText;
    if (uid && !mentionedUids.value.includes(uid)) {
      mentionedUids.value.push(uid);
    }
  }
  showMentionPopup.value = false;
  textareaRef.value?.focus();
}

function openImagePicker() {
  imageInputRef.value?.click();
}

function openFilePicker() {
  fileInputRef.value?.click();
}

async function insertMentionTrigger() {
  inputText.value = `${inputText.value}${inputText.value && !inputText.value.endsWith(' ') ? ' ' : ''}@`;
  await nextTick();
  const caretPos = inputText.value.length;
  textareaRef.value?.setSelectionRange(caretPos, caretPos);
  if (props.channelType === 2) {
    mentionQuery.value = '';
    showMentionPopup.value = true;
    if (currentGroupMembers.value.length === 0) {
      void groupStore.fetchGroupMembers(props.channelId);
    }
  }
  textareaRef.value?.focus();
}

async function openRobotMenu() {
  if (robotMenuState.value === 'ready') {
    robotMenuState.value = 'idle';
    return;
  }
  robotMenuState.value = 'loading';
  robotAck.value = '';
  try {
    const res: any = await commonApi.getRobotMenus(props.channelId, props.channelType);
    const list = Array.isArray(res) ? res : (res?.menus || res?.items || []);
    robotMenus.value = list.map((item: any, index: number) => ({
      id: String(item.id || item.command || index),
      title: String(item.title || item.name || item.command || '机器人指令'),
      command: String(item.command || item.payload || item.name || '')
    })).filter((item: any) => item.command);
    robotMenuState.value = robotMenus.value.length ? 'ready' : 'unavailable';
  } catch {
    robotMenuState.value = 'unavailable';
  }
}

async function sendRobotCommand(command: string) {
  robotMenuState.value = 'loading';
  robotAck.value = '';
  try {
    await commonApi.sendRobotCommand({
      channel_id: props.channelId,
      channel_type: props.channelType,
      command
    });
    robotAck.value = 'robot ack';
    robotMenuState.value = 'idle';
    ArcoMessage.success('机器人指令已发送');
  } catch {
    robotMenuState.value = 'failed';
    robotAck.value = '机器人暂不可用';
  }
}

async function sendSelectedFile(file: File) {
  if (!file) return;
  try {
    uploadHint.value = file.type.startsWith('image/') ? `正在发送图片: ${file.name}` : `正在发送文件: ${file.name}`;
    await messageStore.sendMediaMessage(props.channelId, props.channelType, file);
    ArcoMessage.success(file.type.startsWith('image/') ? '图片已发送' : '文件已发送');
  } catch (err) {
    console.error('Failed to send selected file', err);
    ArcoMessage.error(file.type.startsWith('image/') ? '图片发送失败，请稍后重试' : '文件发送失败，请稍后重试');
  } finally {
    uploadHint.value = '';
  }
}

async function handleImageChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    await sendSelectedFile(file);
  }
  target.value = '';
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    await sendSelectedFile(file);
  }
  target.value = '';
}

async function handlePaste(event: ClipboardEvent) {
  const file = Array.from(event.clipboardData?.files || [])[0];
  if (!file) return;
  event.preventDefault();
  await sendSelectedFile(file);
}

async function handleDrop(event: DragEvent) {
  const file = Array.from(event.dataTransfer?.files || [])[0];
  if (!file) return;
  event.preventDefault();
  await sendSelectedFile(file);
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
        const member = currentGroupMembers.value.find(m => getMemberUid(m) === uid);
        const name = member ? getMemberDisplayName(member) : uid;
        return text.includes(`@${name}`) || text.includes(`@${uid}`);
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
  if (e.isComposing) return;
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
        :key="getMemberUid(member)" 
        class="mention-item"
        @click="selectMember(member)"
      >
        <span class="mention-name">{{ getMemberDisplayName(member) }}</span>
        <span v-if="member.role_label !== '成员'" class="mention-role">{{ member.role_label }}</span>
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
      <button class="action-btn" title="机器人菜单" @click="openRobotMenu">
        Bot
      </button>
      <button class="action-btn" title="选择图片" @click="openImagePicker">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="action-svg">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </button>
      <button class="action-btn" title="选择文件" @click="openFilePicker">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="action-svg">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </button>
      <button v-if="channelType === 2" class="action-btn" title="插入@成员" @click="insertMentionTrigger">
        @
      </button>
    </div>

    <div v-if="robotMenuState !== 'idle'" class="robot-panel">
      <div class="robot-panel-header">
        <span class="robot-panel-title">机器人菜单</span>
        <span v-if="robotMenuState === 'ready'" class="robot-panel-hint">点击菜单即可发送指令</span>
      </div>
      <div v-if="robotMenuState === 'loading'" class="robot-state">机器人响应中...</div>
      <div v-else-if="robotMenuState === 'unavailable' || robotMenuState === 'failed'" class="robot-state">
        <span class="robot-state-title">机器人未配置</span>
        <span>请在服务端机器人管理中配置后使用</span>
      </div>
      <template v-else>
        <div class="robot-menu">
          <button
            v-for="item in robotMenus"
            :key="item.id"
            class="robot-command"
            @click="sendRobotCommand(item.command)"
          >
            {{ item.title }}
          </button>
        </div>
      </template>
      <div v-if="robotAck" class="robot-ack">{{ robotAck }}</div>
    </div>

    <div class="input-area-wrapper">
      <input
        ref="imageInputRef"
        type="file"
        accept="image/*"
        class="hidden-input"
        @change="handleImageChange"
      />
      <input
        ref="fileInputRef"
        type="file"
        class="hidden-input"
        @change="handleFileChange"
      />
      <textarea
        ref="textareaRef"
        v-model="inputText"
        placeholder="输入消息，Enter 发送，Ctrl+Enter 换行"
        class="input-textarea"
        rows="3"
        @keydown="handleKeyDown"
        @paste="handlePaste"
        @drop="handleDrop"
        @dragover.prevent
      ></textarea>
    </div>

    <div class="input-footer">
      <div class="input-hint">
        {{ uploadHint || '输入自动同步草稿，Enter 发送，Ctrl+Enter 换行' }}
      </div>
      <button 
        class="send-btn" 
        :disabled="!inputText.trim()"
        aria-label="发送消息"
        title="发送消息"
        @click="handleSend"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="send-btn-icon">
          <path d="M22 2 11 13" />
          <path d="m22 2-7 20-4-9-9-4 20-7Z" />
        </svg>
        <span class="send-btn-text">发送</span>
        <span class="send-btn-shortcut">Enter</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.message-input-container {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background-color: var(--bg-primary);
  border-top: var(--border-hairline);
  padding: 12px 16px;
  position: relative;
  z-index: 30;
  /* In the grid layout this cell is 'auto' sized — content determines height.
     max-height caps it so robot-panel or reply-bar cannot push it too tall. */
  max-height: 40vh;
  overflow: visible;
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
  z-index: 3200;
  margin-bottom: 8px;
}

.mention-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mention-item:hover {
  background-color: var(--bg-hover);
}

.mention-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mention-role {
  color: var(--text-secondary);
  font-size: 11px;
  flex-shrink: 0;
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
  flex-wrap: wrap;
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

.robot-panel {
  margin-bottom: 8px;
  padding: 8px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.robot-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.robot-panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.robot-panel-hint {
  font-size: 11px;
  color: var(--text-secondary);
}

.robot-state,
.robot-ack {
  font-size: 12px;
  color: var(--text-secondary);
}

.robot-state {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.robot-state-title {
  color: var(--text-primary);
  font-weight: 600;
}

.robot-menu {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.robot-command {
  height: 28px;
  padding: 0 10px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}

.hidden-input {
  display: none;
}

.input-area-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
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
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 8px;
}

.input-hint {
  min-width: 0;
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.send-btn {
  min-width: 116px;
  height: 36px;
  padding: 0 14px;
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.2s, transform 0.2s, background-color 0.2s;
}

.send-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.send-btn-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.send-btn-text {
  line-height: 1;
}

.send-btn-shortcut {
  font-size: 10px;
  line-height: 1;
  opacity: 0.78;
  padding-left: 2px;
}
</style>
