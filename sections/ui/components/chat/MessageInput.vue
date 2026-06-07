<template>
  <view class="message-input-area pb-safe flex-column">

    <!-- Reply Quote Bar (PR-10) -->
    <view v-if="replyTarget" class="reply-quote-bar flex-row align-center justify-between">
      <view class="reply-quote-content flex-column">
        <text class="reply-quote-sender">回复 {{ replyTarget.senderName }}</text>
        <text class="reply-quote-preview">{{ replyTarget.contentPreview }}</text>
      </view>
      <view class="reply-quote-close" @click="$emit('cancel-reply')">
        <AppIcon name="close" :size="16" color="var(--color-text-secondary)" />
      </view>
    </view>

    <!-- @ Mention Picker (PR-13) -->
    <MentionPicker
      v-if="showMentionPicker"
      :members="mentionMembers"
      :query="mentionQuery"
      :is-desktop="isDesktop"
      @select="handleMentionSelect"
      @close="showMentionPicker = false"
    />

    <!-- Desktop Layout -->
    <view v-if="isDesktop" class="desktop-input-container flex-column w-100">
      <!-- Desktop toolbar keeps quick actions above the larger text box. -->
      <view class="input-toolbar desktop-toolbar flex-row align-center">
        <view class="toolbar-btn" title="表情" @click="handleOpenEmoji">
          <AppIcon name="smile" :size="21" color="var(--color-text-secondary)" />
        </view>
        <view class="toolbar-btn" title="图片" @click="chooseAlbumImage">
          <AppIcon name="image" :size="21" color="var(--color-text-secondary)" />
        </view>
        <view class="toolbar-btn" title="文件" @click="chooseFile">
          <AppIcon name="files" :size="21" color="var(--color-text-secondary)" />
        </view>
        <view class="toolbar-btn" title="语音" @click="sendMockVoice">
          <AppIcon name="mic" :size="21" color="var(--color-text-secondary)" />
        </view>
      </view>

      <!-- Input Form -->
      <view class="input-box-row flex-row">
        <textarea
          ref="textareaRef"
          class="input-textarea flex-1"
          v-model="text"
          placeholder="输入消息..."
          auto-height
          maxlength="1000"
          cursor-spacing="15"
          @input="handleInput"
          @confirm="handleSend"
          @compositionstart="isComposing = true"
          @compositionend="handleCompositionEnd"
          confirm-type="send"
          fixed
        />
        <button
          class="btn-send-msg"
          :disabled="!text.trim()"
          @click="handleSend"
        >
          <AppIcon name="send" :size="18" color="#ffffff" />
        </button>
      </view>
    </view>

    <!-- Mobile Layout (Two-row design) -->
    <view v-else class="mobile-input-container flex-column w-100">
      <!-- Row 1: Textarea/Voice + Send button -->
      <view class="mobile-main-row flex-row align-center">
        <button
          v-if="voiceMode"
          class="voice-hold-btn flex-1"
          :class="{ recording: voiceRecording, canceling: voiceCanceling }"
          @touchstart.prevent="startVoiceCapture"
          @touchmove.prevent="handleVoiceMove"
          @touchend.prevent="finishVoiceCapture"
          @touchcancel.prevent="cancelVoiceCapture"
          @mousedown.prevent="startVoiceCapture"
          @mousemove.prevent="handleVoiceMove"
          @mouseup.prevent="finishVoiceCapture"
          @mouseleave.prevent="cancelVoiceCapture"
        >
          {{ voiceButtonText }}
        </button>
        <textarea
          v-else
          ref="textareaRef"
          class="mobile-textarea flex-1"
          :class="{ multiline: isMobileInputMultiline }"
          v-model="text"
          placeholder="输入消息..."
          auto-height
          maxlength="1000"
          cursor-spacing="15"
          @input="handleInput"
          @focus="handleInputFocus"
          @click="handleInputFocus"
          @blur="handleInputBlur"
          @confirm="handleSend"
          @compositionstart="isComposing = true"
          @compositionend="handleCompositionEnd"
          confirm-type="send"
          fixed
        />
        <button
          v-if="!voiceMode"
          class="mobile-send-btn-new"
          :class="{ active: text.trim() }"
          :disabled="!text.trim()"
          @click="handleSend"
        >
          发送
        </button>
      </view>

      <!-- Row 2: Bottom Toolbar with mobile actions -->
      <view class="mobile-tools-row flex-row align-center justify-between">
        <button class="mobile-tool-btn" :class="{ active: voiceMode }" @click="toggleVoiceMode">
          <AppIcon name="mic" :size="24" color="var(--color-text-primary)" />
        </button>
        <button class="mobile-tool-btn" @click="chooseAlbumImage">
          <AppIcon name="image" :size="24" color="var(--color-text-primary)" />
        </button>
        <button class="mobile-tool-btn" @click="handleOpenCamera">
          <AppIcon name="camera" :size="24" color="var(--color-text-primary)" />
        </button>
        <button class="mobile-tool-btn" @click="handleOpenEmoji">
          <AppIcon name="smile" :size="24" color="var(--color-text-primary)" />
        </button>
        <button class="mobile-tool-btn" @click="chooseFile">
          <AppIcon name="plus-circle" :size="24" color="var(--color-text-primary)" />
        </button>
      </view>
    </view>

  </view>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from '../common/AppIcon.vue';
import MentionPicker from './MentionPicker.vue';

const props = defineProps({
  draft: { type: String, default: '' },
  replyTarget: { type: Object, default: null },
  mentionMembers: { type: Array, default: () => [] },
  isDesktop: { type: Boolean, default: true }
});

const emit = defineEmits(['send', 'draft-change', 'cancel-reply', 'open-emoji', 'keyboard-change']);

const text = ref('');
const isComposing = ref(false);
const showMentionPicker = ref(false);
const mentionQuery = ref('');
const showAttachPanel = ref(false);
const voiceMode = ref(false);
const voiceRecording = ref(false);
const voiceStartAt = ref(0);
const voiceStartY = ref(0);
const voiceCanceling = ref(false);
const keyboardHeight = ref(0);
const voiceCancelThreshold = 46;
const fallbackKeyboardHeight = 280;

const attachActions = [
  { key: 'image', label: '图片', icon: 'image' },
  { key: 'camera', label: '拍摄', icon: 'camera' },
  { key: 'file', label: '文件', icon: 'files' },
  { key: 'call', label: '语音通话', icon: 'phone' },
  { key: 'location', label: '位置', icon: 'location' },
  { key: 'favorite', label: '收藏', icon: 'bookmark' }
];

const voiceButtonText = computed(() => {
  if (voiceCanceling.value) return '上滑取消';
  if (voiceRecording.value) return '松开发送';
  return '按住说话';
});

const isMobileInputMultiline = computed(() => {
  return text.value.includes('\n');
});

watch(() => props.draft, (newDraft) => {
  text.value = newDraft || '';
}, { immediate: true });

watch(text, (val, oldVal) => {
  if (isComposing.value) return;
  const atMatch = val.match(/@(\w*)$/);
  if (atMatch) {
    showMentionPicker.value = true;
    mentionQuery.value = atMatch[1] || '';
  } else {
    showMentionPicker.value = false;
  }
});

onMounted(() => {
  if (typeof uni.onKeyboardHeightChange === 'function') {
    uni.onKeyboardHeightChange(handleKeyboardHeightChange);
  }
});

onBeforeUnmount(() => {
  if (typeof uni.offKeyboardHeightChange === 'function') {
    uni.offKeyboardHeightChange(handleKeyboardHeightChange);
  }
});

function handleInput() {
  if (isComposing.value) return;
  emit('draft-change', text.value);
}

function handleCompositionEnd(event) {
  isComposing.value = false;
  text.value = event.detail.value || text.value;
  emit('draft-change', text.value);
}

function handleSend() {
  if (isComposing.value) return;
  if (!text.value.trim()) return;
  const payload = {
    type: 'text',
    content: text.value,
    replyRef: props.replyTarget
      ? {
          messageId: props.replyTarget.id,
          senderName: props.replyTarget.senderName,
          contentPreview: props.replyTarget.contentPreview
        }
      : null
  };
  emit('send', payload);
  text.value = '';
  showAttachPanel.value = false;
  emit('draft-change', '');
}

function handleMentionSelect(member) {
  // 移除尾部 @query
  const newText = text.value.replace(/@\w*$/, `@${member.nickname} `);
  text.value = newText;
  showMentionPicker.value = false;
  emit('draft-change', text.value);
}

function handleOpenEmoji() {
  showAttachPanel.value = false;
  voiceMode.value = false;
  emit('keyboard-change', { height: 0, focused: false });
  emit('open-emoji');
}

function chooseAlbumImage() {
  chooseImage('album');
}

function chooseImage(sourceType) {
  showAttachPanel.value = false;
  voiceMode.value = false;
  if (sourceType === 'album' && typeof uni.chooseImage !== 'function' && pickFileWithInput('image/*', handlePickedImageFile)) {
    return;
  }
  if (typeof uni.chooseImage !== 'function') {
    uni.showToast({ title: '当前环境无法选择图片', icon: 'none' });
    return;
  }
  uni.chooseImage({
    count: 1,
    sourceType: [sourceType],
    success: (res) => {
      const path = res.tempFilePaths?.[0] || res.tempFiles?.[0]?.path || '';
      if (!path) return;
      const file = res.tempFiles?.[0] || {};
      emit('send', {
        type: 'image',
        content: path,
        url: path,
        path,
        file,
        fileName: file.name || path.split('/').pop() || 'image',
        fileSize: formatFileSize(file.size),
        fileSizeBytes: file.size || 0,
        mimeType: file.type || 'image/*'
      });
    },
    fail: (error) => {
      if (String(error?.errMsg || '').includes('cancel')) return;
      uni.showToast({ title: sourceType === 'camera' ? '无法打开相机' : '无法选择图片', icon: 'none' });
    }
  });
}

function handlePickedImageFile(file) {
  const url = createObjectUrl(file);
  emit('send', {
    type: 'image',
    content: url,
    url,
    file,
    fileName: file.name || 'image',
    fileSize: formatFileSize(file.size),
    fileSizeBytes: file.size || 0,
    mimeType: file.type || 'image/*'
  });
}

function chooseFile() {
  showAttachPanel.value = false;
  voiceMode.value = false;
  if (typeof uni.chooseFile !== 'function' && pickFileWithInput('*/*', handlePickedGenericFile)) {
    return;
  }
  if (typeof uni.chooseFile !== 'function') {
    uni.showToast({ title: '当前环境无法选择文件', icon: 'none' });
    return;
  }
  uni.chooseFile({
    count: 1,
    success: (res) => {
      const file = res.tempFiles?.[0];
      if (!file) return;
      const path = file.path || file.tempFilePath || '';
      emit('send', {
        type: 'file',
        content: file.name || '未命名文件',
        fileName: file.name || '未命名文件',
        fileSize: formatFileSize(file.size),
        fileSizeBytes: file.size || 0,
        fileType: getFileType(file.name),
        mimeType: file.type || '',
        path,
        file,
        url: path,
        previewContent: ''
      });
    },
    fail: (error) => {
      if (String(error?.errMsg || '').includes('cancel')) return;
      uni.showToast({ title: '无法选择文件', icon: 'none' });
    }
  });
}

function handlePickedGenericFile(file) {
  const url = createObjectUrl(file);
  emit('send', {
    type: 'file',
    content: file.name || '未命名文件',
    fileName: file.name || '未命名文件',
    fileSize: formatFileSize(file.size),
    fileSizeBytes: file.size || 0,
    fileType: getFileType(file.name),
    mimeType: file.type || '',
    file,
    url,
    previewContent: ''
  });
}

function toggleVoiceMode() {
  voiceMode.value = !voiceMode.value;
  showAttachPanel.value = false;
  emit('keyboard-change', { height: 0, focused: false });
}

function startVoiceCapture(event) {
  if (!voiceMode.value || voiceRecording.value) return;
  voiceRecording.value = true;
  voiceCanceling.value = false;
  voiceStartAt.value = Date.now();
  voiceStartY.value = getPointerY(event);
}

function handleVoiceMove(event) {
  if (!voiceRecording.value) return;
  const currentY = getPointerY(event);
  if (!voiceStartY.value || !currentY) return;
  voiceCanceling.value = voiceStartY.value - currentY > voiceCancelThreshold;
}

function finishVoiceCapture() {
  if (!voiceRecording.value) return;
  const duration = Math.max(1, Math.min(60, Math.round((Date.now() - voiceStartAt.value) / 1000)));
  const shouldCancel = voiceCanceling.value;
  resetVoiceCapture();
  if (shouldCancel) {
    uni.showToast({ title: '已取消发送', icon: 'none' });
    return;
  }
  sendVoice(duration);
}

function cancelVoiceCapture() {
  if (!voiceRecording.value) return;
  resetVoiceCapture();
}

function resetVoiceCapture() {
  voiceRecording.value = false;
  voiceCanceling.value = false;
  voiceStartAt.value = 0;
  voiceStartY.value = 0;
}

function getPointerY(event) {
  const touch = event?.touches?.[0] || event?.changedTouches?.[0];
  return Number(touch?.clientY ?? event?.clientY ?? 0);
}

function sendVoice(duration = 5) {
  showAttachPanel.value = false;
  emit('send', {
    type: 'voice',
    content: '',
    duration
  });
}

function sendMockVoice() {
  sendVoice(5);
}

function handleOpenCamera() {
  chooseImage('camera');
}

function handleAttachAction(key) {
  if (key === 'image') {
    chooseAlbumImage();
    return;
  }
  if (key === 'file') {
    chooseFile();
    return;
  }
  if (key === 'camera') {
    handleOpenCamera();
  } else if (key === 'call') {
    uni.showToast({ title: '语音通话待接入', icon: 'none' });
  } else if (key === 'location') {
    uni.showToast({ title: '位置入口待接入', icon: 'none' });
  } else if (key === 'favorite') {
    uni.showToast({ title: '收藏入口待接入', icon: 'none' });
  }
}

function handleInputFocus() {
  voiceMode.value = false;
  emit('keyboard-change', { height: keyboardHeight.value || fallbackKeyboardHeight, focused: true });
}

function handleInputBlur() {
  setTimeout(() => {
    emit('keyboard-change', { height: 0, focused: false });
  }, 80);
}

function handleKeyboardHeightChange(event) {
  const height = Math.max(0, Number(event?.height || 0));
  keyboardHeight.value = height;
  emit('keyboard-change', { height, focused: height > 0 });
}

function formatFileSize(size) {
  const bytes = Number(size || 0);
  if (!bytes) return '未知大小';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileType(name) {
  const match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

function pickFileWithInput(accept, onPick) {
  // #ifdef H5
  if (typeof document === 'undefined') return false;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept || '';
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.remove();
    if (file) onPick(file);
  }, { once: true });
  document.body.appendChild(input);
  input.click();
  return true;
  // #endif
  return false;
}

function createObjectUrl(file) {
  // #ifdef H5
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && file) {
    return URL.createObjectURL(file);
  }
  // #endif
  return file?.path || file?.tempFilePath || '';
}

</script>

<style scoped>
.message-input-area {
  background-color: var(--color-bg-surface);
  border-top: 1px solid var(--color-border);
  padding: 12px 16px 10px;
  box-sizing: border-box;
  gap: 6px;
}

.input-toolbar {
  order: 1;
  gap: 6px;
  padding: 0 2px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background-color: transparent;
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease, transform 0.16s ease;
}
.toolbar-btn:hover {
  background-color: var(--color-bg-hover);
}
.toolbar-btn:active {
  transform: scale(0.96);
}

.input-box-row {
  order: 2;
  gap: 10px;
  align-items: flex-end;
  min-height: 80px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background-color: var(--input-surface);
  padding: 10px 10px 10px 16px;
  box-sizing: border-box;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03), 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.input-box-row:focus-within {
  border-color: rgba(0, 74, 198, 0.32);
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03), 0 0 0 3px rgba(0, 74, 198, 0.08);
}

.input-textarea {
  --textarea-inner-min-height: 40px;
  --textarea-inner-max-height: 144px;
  min-height: 56px;
  max-height: 160px;
  overflow: hidden;
  background-color: transparent;
  border: none;
  border-radius: 0;
  padding: 8px 0;
  box-sizing: border-box;
  font-size: 15px;
  color: var(--color-text-primary);
  line-height: 1.4;
  box-shadow: none;
  outline: none;
}

.input-textarea :deep(.uni-textarea-wrapper),
.mobile-textarea :deep(.uni-textarea-wrapper) {
  min-height: var(--textarea-inner-min-height);
  max-height: var(--textarea-inner-max-height);
  overflow: hidden;
}

.input-textarea :deep(.uni-textarea-textarea),
.mobile-textarea :deep(.uni-textarea-textarea) {
  width: 100%;
  min-height: var(--textarea-inner-min-height);
  max-height: var(--textarea-inner-max-height);
  box-sizing: border-box;
  line-height: 1.4;
  white-space: pre-wrap;
  overflow-y: auto !important;
  overflow-x: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
  resize: none;
}

.btn-send-msg {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background-color: var(--color-primary);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  margin: 0;
  box-shadow: 0 4px 10px rgba(0, 74, 198, 0.16);
  transition: background-color 0.18s ease, opacity 0.18s ease, transform 0.16s ease;
}
.btn-send-msg:active:not([disabled]) {
  transform: scale(0.96);
}
.btn-send-msg[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--color-text-muted);
}
.btn-send-msg::after {
  border: none;
}

.reply-quote-bar {
  background-color: var(--color-bg-muted);
  border-left: 3px solid var(--color-primary);
  border-radius: 6px;
  padding: 6px 10px;
  gap: 8px;
  order: 0;
}

.reply-quote-sender {
  display: block;
  max-width: 100%;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reply-quote-preview {
  display: block;
  max-width: 100%;
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reply-quote-content {
  min-width: 0;
  flex: 1;
}

.reply-quote-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

@media (max-width: 768px) {
  .message-input-area {
    padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
    gap: 8px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    background-color: #f7f7f8;
    box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.015);
  }

  .mobile-input-container {
    width: 100%;
    gap: 8px;
  }

  .mobile-main-row {
    width: 100%;
    gap: 8px;
    align-items: flex-end;
  }

  .mobile-textarea {
    --textarea-inner-min-height: 30px;
    --textarea-inner-max-height: 74px;
    --textarea-inner-line-height: 30px;
    height: auto;
    min-height: 44px;
    max-height: 88px;
    overflow: hidden;
    background-color: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.05);
    border-radius: 22px;
    padding: 6px 14px;
    box-sizing: border-box;
    font-size: 15px;
    color: var(--color-text-primary);
    line-height: 1.4;
    outline: none;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
  }

  .mobile-textarea.multiline {
    --textarea-inner-line-height: 21px;
  }

  .mobile-textarea :deep(.uni-textarea-placeholder) {
    line-height: var(--textarea-inner-line-height);
  }

  .mobile-textarea :deep(.uni-textarea-textarea) {
    line-height: var(--textarea-inner-line-height);
  }

  .voice-hold-btn {
    height: 42px;
    min-height: 42px;
    border-radius: 21px;
    border: 1px solid rgba(0, 0, 0, 0.06);
    background-color: #ffffff;
    color: var(--color-text-primary);
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    margin: 0;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
    transition: background-color 0.16s ease, transform 0.16s ease, border-color 0.16s ease;
  }

  .voice-hold-btn::after {
    border: none;
  }

  .voice-hold-btn.recording,
  .voice-hold-btn:active {
    background-color: rgba(0, 74, 198, 0.08);
    border-color: rgba(0, 74, 198, 0.22);
    transform: scale(0.99);
  }

  .voice-hold-btn.canceling {
    background-color: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.28);
    color: #dc2626;
  }

  .mobile-send-btn-new {
    height: 44px;
    min-width: 68px;
    border-radius: 16px;
    background-color: #eef4ff;
    color: #5f6f8f;
    font-size: 14px;
    font-weight: 700;
    border: 1px solid rgba(0, 74, 198, 0.14);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 12px;
    margin: 0;
    cursor: not-allowed;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .mobile-send-btn-new::after {
    border: none;
  }

  .mobile-send-btn-new[disabled],
  .mobile-send-btn-new:disabled {
    opacity: 1;
    background-color: #eef4ff;
    color: #5f6f8f;
    border-color: rgba(0, 74, 198, 0.14);
  }

  .mobile-send-btn-new.active {
    background-color: var(--color-primary);
    color: #ffffff;
    border-color: var(--color-primary);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 74, 198, 0.22);
  }

  .mobile-send-btn-new:active:not([disabled]) {
    transform: scale(0.96);
  }

  .mobile-tools-row {
    width: 100%;
    padding: 4px 6px 0;
    box-sizing: border-box;
    gap: 10px;
  }

  .mobile-tool-btn {
    width: 44px;
    height: 44px;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    border-radius: 50%;
    transition: background-color 0.16s ease;
  }

  .mobile-tool-btn::after {
    border: none;
  }

  .mobile-tool-btn.active,
  .mobile-tool-btn:active {
    background-color: rgba(0, 0, 0, 0.06);
  }

  .reply-quote-bar {
    border-radius: 16px;
    padding: 12px 14px;
    border-left-width: 5px;
    background-color: rgba(248, 250, 252, 0.96);
    border-top: 1px solid rgba(226, 232, 240, 0.8);
    border-right: 1px solid rgba(226, 232, 240, 0.8);
    border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  }

  .reply-quote-sender {
    font-size: 15px;
  }

  .reply-quote-preview {
    max-width: calc(100vw - 86px);
    font-size: 14px;
  }

  .reply-quote-close {
    width: 44px;
    height: 44px;
  }
}
</style>
