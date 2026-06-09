<template>
  <view class="file-card flex-row" :class="[themeName, { 'is-me': isMe }]">
    <!-- 左侧列：图标 + 位于其下的文件类型标签 -->
    <view class="file-left-col flex-column align-center">
      <view class="file-icon-box">
        <image :src="iconSrc" class="file-svg" mode="aspectFit" />
      </view>
      <!-- 文件后缀简写标签 -->
      <text class="file-type-badge">{{ isArchive ? 'ZIP' : (extension.toUpperCase() || 'FILE') }}</text>
    </view>

    <!-- 右侧列：文件名 + 文件大小 + 按钮组 -->
    <view class="file-details flex-1 flex-column justify-between">
      <text class="file-name" :title="fileName">{{ fileName }}</text>
      <text class="file-size">{{ fileSize }}</text>

      <view class="file-actions flex-row align-center">
        <button class="file-action-btn btn-open" @click.stop="openFile">
          <AppIcon name="download" :size="12" class="btn-icon" />
          <text class="btn-text">下载</text>
        </button>
        <button
          class="file-action-btn btn-preview"
          :disabled="!canPreview"
          :title="canPreview ? '预览文件' : '该格式仅支持下载'"
          @click.stop="previewFile"
        >
          <AppIcon name="eye" :size="12" class="btn-icon" />
          <text class="btn-text">预览</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import AppIcon from '../common/AppIcon.vue';

// 引用导入 SVG 图标静态资源
import wordIcon from '@/assets/icons/file-word.svg';
import excelIcon from '@/assets/icons/file-excel.svg';
import pptIcon from '@/assets/icons/file-ppt.svg';
import pdfIcon from '@/assets/icons/file-pdf.svg';
import zipIcon from '@/assets/icons/file-zip.svg';
import imageIcon from '@/assets/icons/file-image.svg';
import markdownIcon from '@/assets/icons/file-markdown.svg';
import defaultIcon from '@/assets/icons/file-default.svg';

const props = defineProps({
  file: { type: Object, required: true },
  isMe: { type: Boolean, default: false }
});

const emit = defineEmits(['open', 'preview']);

const fileName = computed(() => props.file.fileName || props.file.name || props.file.content || '未命名文件');
const fileSize = computed(() => props.file.fileSize || props.file.size || '未知大小');
const extension = computed(() => {
  const match = String(fileName.value).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
});

const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'];
const previewExtensions = [
  'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv',
  'md', 'markdown', 'html', 'htm', 'txt', 'json',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'pdf',
  'js', 'ts', 'jsx', 'tsx', 'css', 'less', 'scss', 'vue',
  'py', 'java', 'cpp', 'c', 'go', 'sql', 'sh', 'xml', 'yaml', 'yml'
];

const isArchive = computed(() => archiveExtensions.includes(extension.value));
const canPreview = computed(() => previewExtensions.includes(extension.value) && !isArchive.value);

const themeName = computed(() => {
  const ext = extension.value;
  if (['doc', 'docx'].includes(ext)) return 'theme-word';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'theme-excel';
  if (['ppt', 'pptx'].includes(ext)) return 'theme-ppt';
  if (['pdf'].includes(ext)) return 'theme-pdf';
  if (archiveExtensions.includes(ext)) return 'theme-zip';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'theme-image';
  if (['md', 'markdown'].includes(ext)) return 'theme-markdown';
  return 'theme-default';
});

// 根据文件扩展名映射对应的 SVG 引用
const iconSrc = computed(() => {
  const ext = extension.value;
  if (['doc', 'docx'].includes(ext)) return wordIcon;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return excelIcon;
  if (['ppt', 'pptx'].includes(ext)) return pptIcon;
  if (['pdf'].includes(ext)) return pdfIcon;
  if (archiveExtensions.includes(ext)) return zipIcon;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return imageIcon;
  if (['md', 'markdown'].includes(ext)) return markdownIcon;
  return defaultIcon;
});

function openFile() {
  emit('open', props.file);
}

function previewFile() {
  if (!canPreview.value) return;
  emit('preview', props.file);
}
</script>

<style scoped>
.file-card {
  width: 290px;
  gap: 14px;
  align-items: stretch;
  background: linear-gradient(135deg, #ffffff 0%, #fbfcfd 100%);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 14px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.03), 0 1px 2px rgba(15, 23, 42, 0.01);
  padding: 12px 14px;
  box-sizing: border-box;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.file-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.03);
  border-color: rgba(203, 213, 225, 0.8);
}

.file-left-col {
  flex-shrink: 0;
  gap: 10px;
}

.file-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.file-card:hover .file-icon-box {
  transform: scale(1.06) rotate(-3deg);
}

.file-svg {
  width: 26px;
  height: 26px;
  display: block;
}

.file-type-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 5px;
  text-align: center;
  line-height: 1.2;
  letter-spacing: 0.5px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-details {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-top: 2px;
}

.file-name {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  font-size: 13.5px;
  font-weight: 600;
  color: #1e293b; /* Slate 800 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  overflow-wrap: anywhere;
  line-height: 1.4;
  margin-bottom: 2px;
  transition: color 0.2s ease;
}

.file-name :deep(span) {
  display: block;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-card:hover .file-name {
  color: #0f172a; /* Slate 900 */
}

.file-size {
  font-size: 11px;
  color: #64748b; /* Slate 500 */
  font-weight: 500;
  margin-bottom: 6px;
}

/* 各主题配色 */
/* Word 主题 */
.theme-word .file-icon-box {
  background-color: rgba(37, 99, 235, 0.07);
}
.theme-word .file-type-badge {
  background-color: rgba(37, 99, 235, 0.05);
  color: #2563eb;
}

/* Excel 主题 */
.theme-excel .file-icon-box {
  background-color: rgba(22, 163, 74, 0.07);
}
.theme-excel .file-type-badge {
  background-color: rgba(22, 163, 74, 0.05);
  color: #16a34a;
}

/* PPT 主题 */
.theme-ppt .file-icon-box {
  background-color: rgba(234, 88, 12, 0.07);
}
.theme-ppt .file-type-badge {
  background-color: rgba(234, 88, 12, 0.05);
  color: #ea580c;
}

/* PDF 主题 */
.theme-pdf .file-icon-box {
  background-color: rgba(220, 38, 38, 0.07);
}
.theme-pdf .file-type-badge {
  background-color: rgba(220, 38, 38, 0.05);
  color: #dc2626;
}

/* ZIP 主题 */
.theme-zip .file-icon-box {
  background-color: rgba(168, 85, 247, 0.07);
}
.theme-zip .file-type-badge {
  background-color: rgba(168, 85, 247, 0.05);
  color: #a855f7;
}

/* Image 主题 */
.theme-image .file-icon-box {
  background-color: rgba(6, 182, 212, 0.07);
}
.theme-image .file-type-badge {
  background-color: rgba(6, 182, 212, 0.05);
  color: #06b6d4;
}

/* Markdown 主题 */
.theme-markdown .file-icon-box {
  background-color: rgba(15, 23, 42, 0.07);
}
.theme-markdown .file-type-badge {
  background-color: rgba(15, 23, 42, 0.05);
  color: #1e293b;
}

/* 默认主题 */
.theme-default .file-icon-box {
  background-color: rgba(100, 116, 139, 0.07);
}
.theme-default .file-type-badge {
  background-color: rgba(100, 116, 139, 0.05);
  color: #475569;
}

.file-actions {
  gap: 8px;
  width: 100%;
}

.file-action-btn {
  flex: 1;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(226, 232, 240, 0.8);
  background-color: #ffffff;
  color: #475569; /* Slate 600 */
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  margin: 0;
  padding: 0 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.file-action-btn::after {
  border: none;
}

.btn-open:hover:not([disabled]) {
  background-color: #f8fafc;
  border-color: #cbd5e1;
  color: #0f172a; /* Slate 900 */
  transform: translateY(-0.5px);
}

.btn-open:active:not([disabled]) {
  transform: scale(0.97);
}

.file-action-btn.btn-preview {
  background-color: rgba(37, 99, 235, 0.05);
  border-color: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.file-action-btn.btn-preview:hover:not([disabled]) {
  background-color: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
  transform: translateY(-0.5px);
}

.file-action-btn.btn-preview:active:not([disabled]) {
  transform: scale(0.97);
}

.file-action-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
  color: #94a3b8;
  background-color: #f8fafc;
  border-color: rgba(226, 232, 240, 0.6);
  box-shadow: none;
}

.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.file-action-btn:hover:not([disabled]) .btn-icon {
  transform: scale(1.1);
}

.btn-text {
  line-height: 1;
}

@media (max-width: 768px) {
  .file-card {
    width: min(240px, calc(100vw - 118px));
    gap: 10px;
    padding: 10px 12px;
    border-radius: 12px;
  }

  .file-left-col {
    gap: 7px;
  }

  .file-icon-box {
    width: 38px;
    height: 38px;
    border-radius: 9px;
  }

  .file-svg {
    width: 23px;
    height: 23px;
  }

  .file-type-badge {
    font-size: 9px;
    padding: 2px 5px;
    border-radius: 4px;
    letter-spacing: 0;
  }

  .file-details {
    padding-top: 0;
  }

  .file-name {
    font-size: 12.5px;
    line-height: 1.35;
    margin-bottom: 1px;
  }

  .file-size {
    font-size: 10.5px;
    margin-bottom: 5px;
  }

  .file-actions {
    gap: 6px;
  }

  .file-action-btn {
    height: 26px;
    min-height: 26px;
    border-radius: 7px;
    font-size: 11px;
    padding: 0 6px;
    gap: 3px;
  }
}
</style>
