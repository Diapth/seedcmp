<template>
  <view class="file-list-wrapper flex-column">
    <view class="files-container" v-if="files.length > 0">
      <view class="file-table-head">
        <text class="head-name">名称</text>
        <text class="head-type">类型</text>
        <text class="head-size">大小</text>
        <text class="head-time">修改时间</text>
        <text class="head-action">操作</text>
      </view>
      <view 
        v-for="item in files" 
        :key="item.id"
        class="file-item"
      >
        <view class="file-left">
          <view class="file-icon-box" :class="item.type">
            <AppIcon name="files" :size="22" :color="getFileIconColor(item.type)" />
          </view>
          <view class="file-meta flex-column">
            <text class="file-name">{{ item.name }}</text>
            <text class="file-mobile-type">{{ typeLabel(item.type) }}</text>
          </view>
        </view>

        <text class="file-type">{{ typeLabel(item.type) }}</text>
        <text class="file-size">{{ item.size }}</text>
        <text class="file-time">{{ formatTime(item.time) }}</text>

        <view class="file-right">
          <button
            class="btn-action"
            @click="handleAction(item)"
          >
            {{ isPreviewable(item.type) ? '预览' : '下载' }}
          </button>
        </view>
      </view>
    </view>
    
    <view class="empty-list" v-else>
      <AppEmptyState icon="files" title="无匹配的文件" />
    </view>
  </view>
</template>

<script setup>
import AppIcon from '../common/AppIcon.vue';
import AppEmptyState from '../common/AppEmptyState.vue';

const props = defineProps({
  files: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['preview']);

function getFileIconColor(type) {
  if (type === 'pdf') return 'hsl(350, 89%, 60%)';
  if (type === 'docx') return 'hsl(210, 84%, 54%)';
  if (type === 'fig') return 'hsl(280, 84%, 60%)';
  return 'var(--color-text-secondary)';
}

function typeLabel(type) {
  if (type === 'pdf') return 'PDF Document';
  if (type === 'docx') return 'Word Document';
  if (type === 'fig') return 'Design File';
  if (type === 'md') return 'Markdown';
  if (type === 'txt') return 'Text File';
  if (type === 'jpg' || type === 'jpeg' || type === 'png' || type === 'gif' || type === 'webp') return 'Image';
  return type?.toUpperCase() || 'File';
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function handleAction(item) {
  if (isPreviewable(item.type)) {
    emit('preview', item);
    return;
  }
  showDownloadUnavailable();
}

function showDownloadUnavailable() {
  uni.showToast({ title: '文件下载需接入真实下载能力', icon: 'none' });
}

function isPreviewable(type) {
  return ['md', 'markdown', 'txt', 'text', 'html', 'htm', 'json', 'js', 'css', 'vue', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(type);
}
</script>

<style scoped>
.file-list-wrapper {
  width: 100%;
}

.files-container {
  width: 100%;
  overflow: hidden;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}

.file-table-head,
.file-item {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) 150px 110px 140px 96px;
  align-items: center;
}

.file-table-head {
  min-height: 48px;
  background-color: var(--color-bg-hover);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 700;
  padding: 0 16px;
  box-sizing: border-box;
}

.file-item {
  min-height: 72px;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-border);
  box-sizing: border-box;
  background-color: var(--color-bg-surface);
  transition: background-color 0.16s ease;
}

.file-item:last-child {
  border-bottom: none;
}

.file-item:hover {
  background-color: var(--color-bg-muted);
}

.gap-3 {
  gap: 12px;
}

.gap-2 {
  gap: 8px;
}

.file-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.file-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background-color: var(--color-primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-meta {
  min-width: 0;
}

.file-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
  display: flex;
}

.file-type,
.file-size,
.file-time {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.file-mobile-type {
  display: none;
  margin-top: 4px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.file-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.download-progress {
  width: 80px;
  gap: 4px;
  display: flex;
}

.progress-bar {
  width: 100%;
}

.progress-text {
  font-size: 10px;
  color: var(--color-primary);
  font-weight: 600;
}

.btn-action {
  min-height: 44px;
  padding: 0 14px;
  background-color: var(--color-bg-base);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.btn-action::after { border: none; }
.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-list {
  padding-top: 40px;
}

@media (max-width: 768px) {
  .file-table-head {
    display: none;
  }

  .file-item {
    grid-template-columns: 1fr auto;
    min-height: 76px;
  }

  .file-type,
  .file-size,
  .file-time {
    display: none;
  }

  .file-mobile-type {
    display: block;
  }
}
</style>
