<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from '../../utils/markdown';

const props = defineProps<{
  message: {
    fromUID: string;
    content?: {
      text?: string;
      content?: string;
      format?: string;
      markdown?: boolean;
      ai?: boolean;
      mention?: { all?: boolean; uids?: string[] };
    };
    payload?: {
      text?: string;
      content?: string;
      format?: string;
      markdown?: boolean;
      ai?: boolean;
      mention?: { all?: boolean; uids?: string[] };
    };
    [key: string]: any;
  };
  isMe: boolean;
}>();

const emit = defineEmits<{
  (event: 'preview-code', payload: { language: string; code: string; message: any }): void;
}>();

const displayText = computed(() => {
  return props.message.content?.text || props.message.content?.content || props.message.payload?.text || props.message.payload?.content || '';
});

const isMarkdown = computed(() => {
  const content = props.message.content || props.message.payload || {};
  return content.format === 'markdown' || content.markdown === true || content.ai === true;
});

const markdownHtml = computed(() => {
  return renderMarkdown(displayText.value);
});

const mentionUids = computed(() => {
  const mention = props.message.content?.mention || props.message.payload?.mention;
  return mention?.uids || [];
});

const mentionAll = computed(() => {
  const mention = props.message.content?.mention || props.message.payload?.mention;
  return mention?.all === true;
});

async function copyCode(code: string) {
  if (!navigator?.clipboard?.writeText) {
    throw new Error('当前浏览器不支持剪贴板复制');
  }
  await navigator.clipboard.writeText(code);
}

async function handleMarkdownClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const actionButton = target?.closest<HTMLButtonElement>('[data-code-action]');
  if (!actionButton) return;

  const block = actionButton.closest<HTMLElement>('.markdown-code-block');
  const codeEl = block?.querySelector<HTMLElement>('code[data-code-index]');
  const code = codeEl?.textContent || '';
  const language = block?.dataset.codeLanguage || '';
  const action = actionButton.dataset.codeAction;

  if (action === 'copy') {
    try {
      await copyCode(code);
      actionButton.textContent = '已复制';
    } catch (_err) {
      actionButton.textContent = '复制失败';
    }
    window.setTimeout(() => {
      actionButton.textContent = '复制';
    }, 1200);
    return;
  }

  if (action === 'preview-html') {
    emit('preview-code', {
      language,
      code,
      message: props.message
    });
  }
}
</script>

<template>
  <div class="text-cell" :class="{ 'is-me': isMe }">
    <div class="bubble">
      <div
        v-if="isMarkdown"
        class="markdown-body"
        @click="handleMarkdownClick"
        v-html="markdownHtml"
      ></div>
      <template v-else>{{ displayText }}</template>
      <span v-if="mentionAll" class="mention-chip">@所有人</span>
      <span v-else-if="mentionUids.length > 0" class="mention-chip">@{{ mentionUids.length }}人</span>
    </div>
  </div>
</template>

<style scoped>
.text-cell {
  display: flex;
  width: 100%;
}

.bubble {
  display: inline-block;
  width: fit-content;
  max-width: min(520px, 100%);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
  border: var(--border-hairline);
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.text-cell.is-me {
  justify-content: flex-end;
}

.text-cell.is-me .bubble {
  background-color: var(--primary-color, #165dff);
  color: #ffffff;
  border: none;
}

.mention-chip {
  display: inline-flex;
  margin-left: 6px;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  background-color: rgba(22, 93, 255, 0.12);
  color: var(--primary-color, #165dff);
  font-size: 11px;
  font-weight: 600;
  vertical-align: baseline;
}

.markdown-body {
  white-space: normal;
}

.markdown-body :deep(p) {
  margin: 0 0 8px;
}

.markdown-body :deep(p:last-child),
.markdown-body :deep(ul:last-child),
.markdown-body :deep(ol:last-child),
.markdown-body :deep(pre:last-child),
.markdown-body :deep(blockquote:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 2px 0 8px;
  font-size: 15px;
  line-height: 1.35;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 8px 18px;
}

.markdown-body :deep(li) {
  margin: 2px 0;
}

.markdown-body :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  margin: 0 0 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background-color: rgba(0, 0, 0, 0.06);
}

.markdown-body :deep(code) {
  padding: 1px 4px;
  border-radius: 3px;
  background-color: rgba(0, 0, 0, 0.06);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: transparent;
}

.markdown-body :deep(.markdown-code-block) {
  max-width: 100%;
  overflow: hidden;
  margin: 0 0 8px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background-color: rgba(0, 0, 0, 0.04);
}

.markdown-body :deep(.markdown-code-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 32px;
  padding: 5px 8px;
  border-bottom: var(--border-hairline);
  background-color: rgba(0, 0, 0, 0.04);
}

.markdown-body :deep(.markdown-code-lang) {
  min-width: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.markdown-body :deep(.markdown-code-actions) {
  display: inline-flex;
  gap: 6px;
  flex-shrink: 0;
}

.markdown-body :deep(.markdown-code-action) {
  height: 22px;
  padding: 0 7px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 11px;
  line-height: 20px;
}

.markdown-body :deep(.markdown-code-block pre) {
  margin: 0;
  border-radius: 0;
  background: transparent;
}

.markdown-body :deep(blockquote) {
  margin: 0 0 8px;
  padding-left: 10px;
  border-left: 2px solid currentColor;
  opacity: 0.78;
}

.markdown-body :deep(a) {
  color: var(--primary-color, #165dff);
  text-decoration: none;
}

.text-cell.is-me .markdown-body :deep(a) {
  color: #ffffff;
  text-decoration: underline;
}

.text-cell.is-me .mention-chip {
  background-color: rgba(255, 255, 255, 0.18);
  color: #ffffff;
}
</style>
