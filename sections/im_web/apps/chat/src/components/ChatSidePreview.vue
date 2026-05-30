<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from '@tsdaodao/base-vue';

export type ChatSidePreviewKind = 'file-markdown' | 'file-text' | 'file-html' | 'file-pdf' | 'file-office' | 'ai-html';

const props = defineProps<{
  visible: boolean;
  type: ChatSidePreviewKind;
  title: string;
  subtitle?: string;
  sourceUrl?: string;
  sourceText?: string;
  extension?: string;
  loading?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
}>();

const htmlPreviewSandbox = 'allow-scripts';
const markdownHtml = computed(() => renderMarkdown(props.sourceText || ''));
const htmlSrcDoc = computed(() => props.sourceText || '');
const canOpenExternal = computed(() => Boolean(props.sourceUrl));

function openExternal() {
  if (!props.sourceUrl) return;
  window.open(props.sourceUrl, '_blank');
}
</script>

<template>
  <section v-if="visible" class="chat-side-preview" aria-label="右侧预览">
    <div class="preview-panel">
      <header class="preview-header">
        <div class="preview-title">
          <span>{{ title }}</span>
          <strong v-if="subtitle" :title="subtitle">{{ subtitle }}</strong>
        </div>
        <button class="preview-close" title="关闭预览" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="preview-close-icon">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <main class="preview-body">
        <div v-if="loading" class="preview-state">正在加载预览...</div>
        <div v-else-if="error" class="preview-state is-error">{{ error }}</div>
        <div v-else-if="type === 'file-markdown'" class="markdown-preview" v-html="markdownHtml"></div>
        <pre v-else-if="type === 'file-text'" class="text-preview">{{ sourceText }}</pre>
        <iframe
          v-else-if="type === 'file-html' || type === 'ai-html'"
          class="html-preview"
          :srcdoc="htmlSrcDoc"
          :sandbox="htmlPreviewSandbox"
          title="HTML 预览"
        ></iframe>
        <iframe
          v-else-if="type === 'file-pdf'"
          class="pdf-preview"
          :src="sourceUrl"
          title="PDF 文件预览"
        ></iframe>
        <div v-else-if="type === 'file-office'" class="office-preview">
          <div class="office-preview-icon">{{ (extension || 'DOC').slice(0, 3).toUpperCase() }}</div>
          <div class="office-preview-copy">
            <strong>浏览器无法直接解析 Office 内容</strong>
            <span>可以下载或在系统应用中打开 {{ (extension || 'Office').toUpperCase() }} 文件。</span>
          </div>
        </div>
        <div v-else class="preview-state">暂无可预览内容</div>
      </main>

      <footer v-if="canOpenExternal" class="preview-footer">
        <button class="preview-secondary" @click="openExternal">打开/下载</button>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.chat-side-preview {
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
  overflow: hidden;
}

.preview-panel {
  display: grid;
  grid-template-rows: 56px minmax(0, 1fr) auto;
  height: 100%;
  min-width: 0;
  color: var(--text-primary);
}

.preview-header,
.preview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 14px;
  border-bottom: var(--border-hairline);
}

.preview-footer {
  min-height: 48px;
  border-top: var(--border-hairline);
  border-bottom: 0;
  justify-content: flex-end;
}

.preview-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.preview-title span {
  font-size: 13px;
  font-weight: 600;
}

.preview-title strong {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
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
  flex-shrink: 0;
}

.preview-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.preview-close-icon {
  width: 16px;
  height: 16px;
}

.preview-body {
  min-height: 0;
  overflow: auto;
  padding: 16px;
  background: var(--bg-secondary);
}

.preview-state {
  padding: 8px 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.preview-state.is-error {
  color: #d93026;
}

.text-preview,
.markdown-preview {
  max-width: 100%;
  margin: 0;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.65;
  word-break: break-word;
}

.text-preview {
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.markdown-preview {
  padding: 14px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
}

.markdown-preview :deep(p),
.markdown-preview :deep(ul),
.markdown-preview :deep(ol),
.markdown-preview :deep(pre),
.markdown-preview :deep(blockquote) {
  margin: 0 0 10px;
}

.markdown-preview :deep(p:last-child),
.markdown-preview :deep(ul:last-child),
.markdown-preview :deep(ol:last-child),
.markdown-preview :deep(pre:last-child),
.markdown-preview :deep(blockquote:last-child) {
  margin-bottom: 0;
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  padding-left: 20px;
}

.markdown-preview :deep(pre) {
  overflow-x: auto;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.06);
}

.markdown-preview :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.html-preview,
.pdf-preview {
  width: 100%;
  height: 100%;
  min-height: 520px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: #ffffff;
}

.office-preview {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 128px;
  padding: 16px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
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
  flex-shrink: 0;
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
  line-height: 1.45;
}

.preview-secondary {
  height: 32px;
  padding: 0 14px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
}

@media (max-width: 760px) {
  .chat-side-preview {
    min-width: 0;
    max-width: none;
    width: 100%;
  }

  .preview-body {
    padding: 12px;
  }
}
</style>
