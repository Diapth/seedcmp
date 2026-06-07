<template>
  <view class="announcement-box glass-panel flex-column">
    <view class="ann-header flex-row align-center justify-between">
      <text class="ann-title">群公告</text>
      <text v-if="canEdit" class="ann-edit-link" @click="openEditor">编辑</text>
    </view>
    <view class="ann-body">
      <text class="ann-text" v-if="text">{{ text }}</text>
      <text v-else class="ann-text-placeholder">暂无公告</text>
    </view>
  </view>

  <AppDialog
    v-model:visible="editorVisible"
    title="编辑群公告"
    @confirm="saveAnnouncement"
  >
    <view class="flex-column" style="gap: 8px;">
      <text class="ann-editor-tip">支持纯文本与 AppIcon 表情字符</text>
      <textarea
        v-model="editorValue"
        class="ann-textarea"
        placeholder="请输入群公告内容"
        maxlength="200"
      />
    </view>
  </AppDialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import AppDialog from '../common/AppDialog.vue';

const props = defineProps({
  text: { type: String, default: '' },
  canEdit: { type: Boolean, default: false }
});

const emit = defineEmits(['update']);

const editorVisible = ref(false);
const editorValue = ref(props.text || '');

watch(() => props.text, (v) => {
  editorValue.value = v || '';
});

function openEditor() {
  editorValue.value = props.text || '';
  editorVisible.value = true;
}

function saveAnnouncement() {
  emit('update', editorValue.value);
  editorVisible.value = false;
}
</script>

<style scoped>
.announcement-box {
  padding: 12px 14px;
  border-radius: 10px;
  gap: 6px;
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border);
}

.ann-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ann-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-secondary);
  letter-spacing: 0.5px;
}

.ann-edit-link {
  font-size: 12px;
  color: var(--color-primary);
  font-weight: 600;
  cursor: pointer;
}

.ann-body {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 4px;
  flex-wrap: wrap;
}

.ann-text {
  font-size: 13px;
  color: var(--color-text-primary);
  line-height: 1.5;
  word-break: break-all;
}

.ann-text-placeholder {
  font-size: 13px;
  color: var(--color-text-muted);
}

.ann-editor-tip {
  font-size: 12px;
  color: var(--color-text-muted);
}

.ann-textarea {
  width: 100%;
  height: 96px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px 10px;
  box-sizing: border-box;
  font-size: 13px;
  background-color: var(--color-bg-base);
  color: var(--color-text-primary);
}
</style>
