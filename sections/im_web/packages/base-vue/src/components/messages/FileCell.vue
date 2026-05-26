<script setup lang="ts">
import { computed, ref } from 'vue';
import { normalizeMediaUrl } from '../../service/mediaUrl';
import { renderMarkdown } from '../../utils/markdown';

const props = defineProps<{
  message: {
    content?: {
      url?: string;
      name?: string;
      size?: number;
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const url = computed(() => normalizeMediaUrl(props.message.content?.url || props.message.payload?.url || ''));
const name = computed(() => props.message.content?.name || props.message.payload?.name || '未知文件');
const size = computed(() => props.message.content?.size || props.message.payload?.size || 0);
const isAvailable = computed(() => !!url.value);
const previewVisible = ref(false);
const previewLoading = ref(false);
const previewError = ref('');
const previewText = ref('');

const sizeStr = computed(() => {
  if (size.value === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(size.value) / Math.log(k));
  return parseFloat((size.value / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

const extension = computed(() => {
  const cleanName = name.value.split('?')[0].toLowerCase();
  const dot = cleanName.lastIndexOf('.');
  return dot >= 0 ? cleanName.slice(dot + 1) : '';
});

const previewKind = computed<'markdown' | 'text' | 'html' | 'pdf' | 'office' | 'unsupported'>(() => {
  const ext = extension.value;
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (['txt', 'log', 'json', 'csv', 'xml', 'yml', 'yaml'].includes(ext)) return 'text';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'office';
  return 'unsupported';
});

const canPreview = computed(() => isAvailable.value && previewKind.value !== 'unsupported');

const previewTitle = computed(() => {
  const labels: Record<string, string> = {
    markdown: 'Markdown 预览',
    text: '文本预览',
    html: 'HTML 预览',
    pdf: 'PDF 预览',
    office: 'Office 文件预览'
  };
  return labels[previewKind.value] || '文件预览';
});

const previewHtml = computed(() => {
  if (previewKind.value === 'markdown') return renderMarkdown(previewText.value);
  return '';
});

const htmlSrcDoc = computed(() => {
  return previewKind.value === 'html' ? previewText.value : '';
});

function handleDownload() {
  if (!isAvailable.value) return;
  window.open(url.value, '_blank');
}

async function openPreview() {
  if (!canPreview.value) {
    handleDownload();
    return;
  }
  previewVisible.value = true;
  previewError.value = '';
  if (!['markdown', 'text', 'html'].includes(previewKind.value) || previewText.value) return;

  previewLoading.value = true;
  try {
    const res = await fetch(url.value);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    previewText.value = await res.text();
  } catch (err: any) {
    previewError.value = err?.message || '预览加载失败';
  } finally {
    previewLoading.value = false;
  }
}

function closePreview() {
  previewVisible.value = false;
}
</script>

<template>
  <div class="file-cell" :class="{ 'is-me': isMe, unavailable: !isAvailable }">
    <div v-if="previewVisible" class="preview-dialog" role="dialog" aria-modal="true">
      <div class="preview-backdrop" @click="closePreview"></div>
      <div class="preview-panel">
        <div class="preview-header">
          <div class="preview-title">
            <span>{{ previewTitle }}</span>
            <strong :title="name">{{ name }}</strong>
          </div>
          <button class="preview-close" title="关闭预览" @click="closePreview">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="preview-close-icon">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div class="preview-body">
          <div v-if="previewLoading" class="preview-state">正在加载预览...</div>
          <div v-else-if="previewError" class="preview-state">{{ previewError }}</div>
          <div v-else-if="previewKind === 'markdown'" class="markdown-preview" v-html="previewHtml"></div>
          <pre v-else-if="previewKind === 'text'" class="text-preview">{{ previewText }}</pre>
          <iframe
            v-else-if="previewKind === 'html'"
            class="html-preview"
            :srcdoc="htmlSrcDoc"
            sandbox=""
            title="HTML 文件预览"
          ></iframe>
          <iframe
            v-else-if="previewKind === 'pdf'"
            class="pdf-preview"
            :src="url"
            title="PDF 文件预览"
          ></iframe>
          <div v-else-if="previewKind === 'office'" class="office-preview">
            <div class="office-preview-icon">DOC</div>
            <div class="office-preview-copy">
              <strong>浏览器无法直接解析 Office 内容</strong>
              <span>可以下载或在系统应用中打开 {{ extension.toUpperCase() }} 文件。</span>
            </div>
          </div>
        </div>
        <div class="preview-footer">
          <button class="preview-secondary" @click="handleDownload">打开/下载</button>
          <button class="preview-primary" @click="closePreview">完成</button>
        </div>
      </div>
    </div>

    <div class="bubble">
      <div class="file-details">
        <span class="file-name" :title="name">{{ name }}</span>
        <span class="file-size">{{ isAvailable ? `${sizeStr} · ${canPreview ? '可预览' : '点击打开'}` : '下载不可用' }}</span>
      </div>
      <div class="file-icon-wrapper">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="file-svg">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </div>
      <div class="file-actions">
        <button class="file-action" :disabled="!isAvailable" title="预览文件" @click.stop="openPreview">预览</button>
        <button class="file-action" :disabled="!isAvailable" title="打开或下载文件" @click.stop="handleDownload">打开</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-cell {
  display: flex;
  width: clamp(240px, 34vw, 320px);
  max-width: 100%;
  cursor: pointer;
}

.file-cell.unavailable {
  cursor: not-allowed;
}

.bubble {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  border: var(--border-hairline);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.2s;
}

.bubble:hover {
  background-color: var(--bg-hover);
}

.file-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
  min-width: 0;
  flex: 1;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: 12px;
  color: var(--text-secondary);
}

.file-icon-wrapper {
  width: 40px;
  height: 40px;
  background-color: var(--bg-secondary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color, #165dff);
  flex-shrink: 0;
}

.file-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.file-action {
  min-width: 44px;
  height: 24px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}

.file-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.file-svg {
  width: 24px;
  height: 24px;
}

.file-cell.is-me {
  justify-content: flex-end;
}

.file-cell.is-me .bubble {
  background-color: var(--bg-secondary);
}

.file-cell.is-me .file-icon-wrapper {
  background-color: var(--bg-primary);
}

.preview-dialog {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.preview-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.34);
}

.preview-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(880px, calc(100vw - 32px));
  height: min(720px, calc(100vh - 48px));
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
}

.preview-header,
.preview-footer {
  min-height: 52px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: var(--border-hairline);
}

.preview-footer {
  border-top: var(--border-hairline);
  border-bottom: 0;
  justify-content: flex-end;
}

.preview-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview-title span {
  font-size: 12px;
  color: var(--text-secondary);
}

.preview-title strong {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-close {
  width: 32px;
  height: 32px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.preview-close-icon {
  width: 16px;
  height: 16px;
}

.preview-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.preview-state {
  color: var(--text-secondary);
  font-size: 13px;
}

.text-preview,
.markdown-preview {
  max-width: 100%;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.6;
}

.text-preview {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.markdown-preview :deep(p),
.markdown-preview :deep(ul),
.markdown-preview :deep(ol),
.markdown-preview :deep(pre),
.markdown-preview :deep(blockquote) {
  margin: 0 0 10px;
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  padding-left: 20px;
}

.markdown-preview :deep(pre) {
  overflow-x: auto;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
}

.markdown-preview :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.html-preview,
.pdf-preview {
  width: 100%;
  height: 100%;
  min-height: 420px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: #ffffff;
}

.office-preview {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 120px;
  padding: 16px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
}

.office-preview-icon {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-sm);
  background: var(--primary-color, #165dff);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.office-preview-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.office-preview-copy strong {
  font-size: 14px;
}

.office-preview-copy span {
  color: var(--text-secondary);
  font-size: 13px;
}

.preview-primary,
.preview-secondary {
  height: 32px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
}

.preview-primary {
  border: none;
  background: var(--primary-color, #165dff);
  color: #ffffff;
}

.preview-secondary {
  border: var(--border-hairline);
  background: var(--bg-secondary);
  color: var(--text-primary);
}

@media (max-width: 640px) {
  .preview-dialog {
    padding: 8px;
  }

  .preview-panel {
    width: calc(100vw - 16px);
    height: calc(100vh - 16px);
  }

  .file-cell {
    width: min(100%, 320px);
  }
}
</style>
