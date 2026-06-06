<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { normalizeMediaUrl } from '../../service/mediaUrl';

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

const emit = defineEmits<{
  (event: 'preview', payload: {
    kind: 'markdown' | 'text' | 'html' | 'pdf' | 'office' | 'unsupported';
    url: string;
    name: string;
    size: number;
    extension: string;
  }): void;
}>();

const url = computed(() => normalizeMediaUrl(props.message.content?.url || props.message.payload?.url || ''));
const name = computed(() => props.message.content?.name || props.message.payload?.name || '未知文件');
const isAvailable = computed(() => !!url.value);
const fetchedSize = ref<number | undefined>(undefined);

const declaredSize = computed(() => {
  const raw = props.message.content?.size ?? props.message.payload?.size;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
});

const displaySize = computed(() => declaredSize.value ?? fetchedSize.value);

const sizeStr = computed(() => {
  if (displaySize.value === undefined) return '大小未知';
  if (displaySize.value === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(displaySize.value) / Math.log(k)), sizes.length - 1);
  return parseFloat((displaySize.value / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
const fileHint = computed(() => canPreview.value ? '可预览' : '点击下载');

watch([url, declaredSize], async ([nextUrl, nextDeclaredSize]) => {
  fetchedSize.value = undefined;
  if (!nextUrl || nextDeclaredSize !== undefined || typeof fetch !== 'function') return;
  try {
    const response = await fetch(nextUrl, { method: 'HEAD', cache: 'no-store' });
    if (!response.ok) return;
    const contentLength = response.headers.get('content-length');
    const numeric = Number(contentLength);
    if (Number.isFinite(numeric) && numeric >= 0 && url.value === nextUrl) {
      fetchedSize.value = numeric;
    }
  } catch {
    // Cross-origin file hosts may block HEAD; keep the UI honest with "大小未知".
  }
}, { immediate: true });

function handleDownload() {
  if (!isAvailable.value) return;
  const link = document.createElement('a');
  link.href = url.value;
  link.download = name.value;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function openPreview() {
  if (!canPreview.value) {
    handleDownload();
    return;
  }
  emit('preview', {
    kind: previewKind.value,
    url: url.value,
    name: name.value,
    size: displaySize.value ?? 0,
    extension: extension.value
  });
}
</script>

<template>
  <div class="file-cell" :class="{ 'is-me': isMe, unavailable: !isAvailable }">
    <div class="bubble">
      <div class="file-details">
        <span class="file-name" :title="name">{{ name }}</span>
        <span class="file-size">{{ isAvailable ? `${sizeStr} · ${fileHint}` : '下载不可用' }}</span>
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
        <button class="file-action" :disabled="!isAvailable" title="下载文件" @click.stop="handleDownload">下载</button>
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

@media (max-width: 640px) {
  .file-cell {
    width: min(100%, 320px);
  }
}
</style>
