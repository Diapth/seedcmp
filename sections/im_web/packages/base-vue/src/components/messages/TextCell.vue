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
      [key: string]: any;
    };
    payload?: {
      text?: string;
      content?: string;
      format?: string;
      markdown?: boolean;
      ai?: boolean;
      mention?: { all?: boolean; uids?: string[] };
      [key: string]: any;
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

const messageContent = computed(() => props.message.content || props.message.payload || {});

const isMarkdown = computed(() => {
  const content = messageContent.value;
  return content.format === 'markdown' || content.markdown === true || content.ai === true;
});

const clowderMeta = computed(() => {
  const content = messageContent.value;
  const connectorId = content.connectorId || content.connector_id;
  const catDisplayName = content.catDisplayName || content.cat_display_name;
  const catId = content.catId || content.cat_id;
  if (connectorId !== 'im-web' && !catDisplayName && !catId) return undefined;
  const inferredDisplayName = inferClowderCatDisplayName(displayText.value);
  return {
    connectorId,
    catDisplayName: catDisplayName || inferredDisplayName || catId || 'Clowder',
    catId
  };
});

function inferClowderCatDisplayName(text: string) {
  const value = String(text || '').trim();
  const prefixMatch = value.match(/^【([^】]{1,40}?)】/);
  if (prefixMatch) return prefixMatch[1].replace(/[🐱🐈🐾\s]+$/g, '').trim();

  const inlineSlashMatch = value.match(/(?:^|[\s，。:：])([^\s/［\[\]］，。:：]{1,40})\/[^\s/［\[\]］，。:：]{1,40}(?=[\s，。:：]|已|收|回|确|$)/u);
  if (inlineSlashMatch) return inlineSlashMatch[1].replace(/[🐱🐈🐾\s]+$/g, '').trim();

  const suffixMatch = value.match(/[［\[]([^\]/\]］\n]{1,40})\/[^\]］\n]{1,120}[］\]]\s*$/);
  if (suffixMatch) return suffixMatch[1].replace(/[🐱🐈🐾\s]+$/g, '').trim();

  return '';
}

const unsupportedMedia = computed(() => {
  const content = messageContent.value;
  return content.unsupportedMedia || content.mediaUnavailable || content.deliveryState === 'media_download_failed';
});

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function visibleTextFromItem(item: any): string {
  if (item === undefined || item === null || item === '') return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'number' || typeof item === 'boolean') return String(item);
  return String(
    item.text ||
    item.content ||
    item.body ||
    item.message ||
    item.reasoning ||
    item.thinking ||
    item.summary ||
    ''
  ).trim();
}

function visibleTextsFrom(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(visibleTextFromItem).filter(Boolean);
  }
  const text = visibleTextFromItem(value);
  return text ? [text] : [];
}

function displayJson(value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (_err) {
    return String(value);
  }
}

function toolName(item: any) {
  return String(item?.toolName || item?.name || item?.tool || item?.function?.name || 'tool');
}

function toolInput(item: any) {
  return displayJson(item?.input ?? item?.arguments ?? item?.argumentsJson ?? item?.args);
}

function toolOutput(item: any) {
  return displayJson(item?.output ?? item?.content ?? item?.result ?? item?.error);
}

function richBlockTitle(block: any) {
  return String(block?.title || block?.fileName || block?.kind || '富内容');
}

function richBlockBody(block: any) {
  if (block?.bodyMarkdown) return String(block.bodyMarkdown);
  if (block?.diff) return String(block.diff);
  if (Array.isArray(block?.items)) {
    return block.items
      .map((item: any) => item?.text || item?.caption || item?.alt || item?.url)
      .filter(Boolean)
      .join('\n');
  }
  if (block?.html) return String(block.html);
  if (block?.url) return String(block.url);
  return '';
}

const transcript = computed(() => {
  const content = messageContent.value;
  const metadata = content.metadata || {};
  const thoughtParts = [
    ...visibleTextsFrom(content.thinking),
    ...visibleTextsFrom(content.thought),
    ...visibleTextsFrom(content.thoughts),
    ...visibleTextsFrom(content.reasoning),
    ...visibleTextsFrom(content.reasoning_content),
    ...visibleTextsFrom(content.transcript),
    ...visibleTextsFrom(content.transcriptBlocks || content.transcript_blocks),
    ...visibleTextsFrom(metadata.thinking),
    ...visibleTextsFrom(metadata.thought),
    ...visibleTextsFrom(metadata.thoughts),
    ...visibleTextsFrom(metadata.reasoning),
    ...visibleTextsFrom(metadata.reasoning_content),
    ...visibleTextsFrom(metadata.transcript),
    ...visibleTextsFrom(metadata.transcriptBlocks || metadata.transcript_blocks)
  ];
  let thinking = [...new Set(thoughtParts)].join('\n').trim();
  const toolCalls = asArray(content.toolCalls || content.tool_calls || metadata.toolCalls || metadata.tool_calls || metadata.toolEvents || metadata.tool_events);
  const toolResults = asArray(content.toolResults || content.tool_results || metadata.toolResults || metadata.tool_results);
  const richBlocks = asArray(content.richBlocks || content.rich_blocks || content.rich?.blocks || metadata.richBlocks || metadata.rich_blocks);
  if (!thinking && clowderMeta.value && content.streaming === true && !toolCalls.length && !toolResults.length && !richBlocks.length) {
    thinking = '等待 Clowder 智能体输出';
  }
  return {
    thinking,
    toolCalls,
    toolResults,
    richBlocks,
    visible: Boolean(thinking || toolCalls.length || toolResults.length || richBlocks.length)
  };
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

function fallbackCopyText(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const copied = document.execCommand('copy');
    if (!copied) throw new Error('复制命令未成功');
  } finally {
    document.body.removeChild(textarea);
  }
}

async function copyCode(code: string) {
  if (navigator?.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(code);
    return;
  }
  fallbackCopyText(code);
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
      <div v-if="clowderMeta" class="clowder-meta">
        <span class="clowder-badge">Clowder</span>
        <span class="clowder-cat">{{ clowderMeta.catDisplayName }}</span>
      </div>
      <div v-if="unsupportedMedia" class="unsupported-media">Unsupported media unavailable</div>
      <div
        v-if="isMarkdown"
        class="markdown-body"
        @click="handleMarkdownClick"
        v-html="markdownHtml"
      ></div>
      <template v-else>{{ displayText }}</template>
      <div v-if="transcript.visible" class="clowder-transcript">
        <section v-if="transcript.thinking" class="clowder-transcript-section clowder-thought">
          <div class="clowder-transcript-label">思考</div>
          <div class="clowder-transcript-text">{{ transcript.thinking }}</div>
        </section>
        <section
          v-for="(call, index) in transcript.toolCalls"
          :key="`call-${index}`"
          class="clowder-transcript-section clowder-tool-call"
        >
          <div class="clowder-transcript-label">工具调用</div>
          <div class="clowder-transcript-title">{{ toolName(call) }}</div>
          <pre v-if="toolInput(call)" class="clowder-transcript-pre">{{ toolInput(call) }}</pre>
        </section>
        <section
          v-for="(result, index) in transcript.toolResults"
          :key="`result-${index}`"
          class="clowder-transcript-section clowder-tool-result"
        >
          <div class="clowder-transcript-label">工具结果</div>
          <div class="clowder-transcript-title">{{ toolName(result) }}</div>
          <pre v-if="toolOutput(result)" class="clowder-transcript-pre">{{ toolOutput(result) }}</pre>
        </section>
        <section
          v-for="(block, index) in transcript.richBlocks"
          :key="`rich-${block?.id || index}`"
          class="clowder-transcript-section clowder-rich-block"
        >
          <div class="clowder-transcript-label">富内容</div>
          <div class="clowder-transcript-title">{{ richBlockTitle(block) }}</div>
          <div v-if="richBlockBody(block)" class="clowder-transcript-text">{{ richBlockBody(block) }}</div>
        </section>
      </div>
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

.clowder-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  margin-bottom: 6px;
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
}

.clowder-badge {
  flex: 0 0 auto;
  padding: 0 5px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: rgba(15, 118, 110, 0.08);
  color: #0f766e;
  font-weight: 600;
}

.clowder-cat {
  min-width: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-weight: 600;
  text-overflow: ellipsis;
}

.unsupported-media {
  margin-bottom: 6px;
  padding: 4px 6px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: #fff7ed;
  color: #9a3412;
  font-size: 12px;
  line-height: 16px;
}

.clowder-transcript {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: var(--border-hairline);
  white-space: normal;
}

.clowder-transcript-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 100%;
  padding: 6px 8px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: rgba(15, 23, 42, 0.04);
  color: var(--text-primary);
}

.text-cell.is-me .clowder-transcript-section {
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
}

.clowder-transcript-label {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
}

.text-cell.is-me .clowder-transcript-label {
  color: rgba(255, 255, 255, 0.72);
}

.clowder-transcript-title {
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
}

.clowder-transcript-text,
.clowder-transcript-pre {
  max-width: 100%;
  margin: 0;
  overflow: auto;
  color: inherit;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
}

.clowder-transcript-pre {
  padding: 6px;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.06);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
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

.markdown-body :deep(table) {
  display: block;
  max-width: 100%;
  margin: 0 0 8px;
  border-collapse: collapse;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.45;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  min-width: 72px;
  padding: 6px 8px;
  border: var(--border-hairline);
  text-align: left;
  vertical-align: top;
  white-space: normal;
  word-break: break-word;
}

.markdown-body :deep(th) {
  background: rgba(0, 0, 0, 0.04);
  font-weight: 600;
}

.text-cell.is-me .markdown-body :deep(th) {
  background: rgba(255, 255, 255, 0.16);
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
