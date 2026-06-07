<template>
  <AppShell :hide-mobile-tab-bar="true" :hide-desktop-sidebar="true">
    <view class="file-preview-page flex-column flex-1">
      <MobilePageHeader title="文件预览">
        <template #left>
          <view class="mobile-back-btn" title="返回" @click="goBack">
            <AppIcon name="back" :size="20" color="var(--color-text-primary)" />
          </view>
        </template>
      </MobilePageHeader>

      <view class="preview-main flex-1">
        <FilePreviewPanel
          :key="filePreviewKey"
          :visible="true"
          :file="fileData"
          embedded
          @close="goBack"
        />
      </view>
    </view>
  </AppShell>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import AppShell from '@/components/layout/AppShell.vue';
import MobilePageHeader from '@/components/layout/MobilePageHeader.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import FilePreviewPanel from '@/components/chat/FilePreviewPanel.vue';

const fileData = ref({
  name: '未命名文件',
  fileName: '未命名文件',
  fileSize: '未知大小'
});
let lastRawFile = '';
let routeSyncTimer = null;

const filePreviewKey = computed(() => {
  const file = fileData.value || {};
  return `${file.id || ''}:${file.name || file.fileName || ''}:${file.ext || file.fileType || file.type || ''}`;
});

function readFileParamFromCurrentPage() {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  return currentPage?.$page?.options?.file || '';
}

function readFileParamFromHash() {
  if (typeof window === 'undefined') return '';
  const hash = window.location?.hash || '';
  const queryStart = hash.indexOf('?');
  if (queryStart < 0) return '';
  const params = new URLSearchParams(hash.slice(queryStart + 1));
  return params.get('file') || '';
}

function applyFileParam(rawFile) {
  if (!rawFile) return;
  if (rawFile === lastRawFile) return;

  const decoded = decodeURIComponent(rawFile);
  const currentKey = JSON.stringify(fileData.value || {});
  if (decoded === currentKey) {
    lastRawFile = rawFile;
    return;
  }

  try {
    fileData.value = JSON.parse(decoded);
    lastRawFile = rawFile;
  } catch (error) {
    uni.showToast({ title: '文件预览参数无效', icon: 'none' });
  }
}

function syncFileParam(rawOptions = {}) {
  applyFileParam(rawOptions.file || readFileParamFromHash() || readFileParamFromCurrentPage());
}

function handleHashChange() {
  syncFileParam();
}

onLoad((options) => {
  syncFileParam(options);
});

onShow(() => {
  syncFileParam();
});

onMounted(() => {
  syncFileParam();
  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', handleHashChange);
    routeSyncTimer = window.setInterval(syncFileParam, 250);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('hashchange', handleHashChange);
    if (routeSyncTimer) window.clearInterval(routeSyncTimer);
  }
  routeSyncTimer = null;
});

function goBack() {
  uni.navigateBack({
    fail: () => {
      uni.redirectTo({ url: '/pages/chat/index' });
    }
  });
}
</script>

<style scoped>
.file-preview-page {
  width: 100%;
  height: 100%;
  background-color: var(--color-bg-surface);
  display: flex;
  flex-direction: column;
}

.preview-main {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mobile-back-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  cursor: pointer;
  margin-left: -12px;
}

.mobile-back-btn:active {
  background-color: var(--color-bg-hover);
}
</style>
