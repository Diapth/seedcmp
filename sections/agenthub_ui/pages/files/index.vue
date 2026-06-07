<template>
  <AppShell>
    <!-- Mobile Page Header (PR-14) -->
    <MobilePageHeader
      v-if="!isDesktop"
      title="文件空间"
      subtitle="管理与预览所有文件"
    >
      <template #actions>
        <view class="header-icon-btn" @click="focusSearch">
          <AppIcon name="search" :size="20" color="var(--color-text-secondary)" />
        </view>
        <view class="header-icon-btn" @click="handleUpload">
          <AppIcon name="plus" :size="20" color="var(--color-primary)" />
        </view>
      </template>
    </MobilePageHeader>

    <view class="files-page flex-column flex-1">

      <!-- Header -->
      <view class="header flex-row align-center justify-between" v-if="isDesktop">
        <text class="title">文件空间</text>
        <view class="header-actions">
          <view class="header-icon-btn" @click="focusSearch">
            <AppIcon name="search" :size="20" color="var(--color-text-secondary)" />
          </view>
          <button class="btn-upload flex-row align-center gap-2" @click="handleUpload">
            <AppIcon name="plus" :size="16" color="#ffffff" />
            <text class="btn-text">上传文件</text>
          </button>
        </view>
      </view>
      
      <!-- Search Box -->
      <view class="search-box glass-panel">
        <view class="search-inner flex-row align-center">
          <AppIcon name="search" :size="16" color="var(--color-text-muted)" class="search-icon" />
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="搜索文件名称..." 
            class="search-input flex-1"
            :focus="searchFocused"
            @blur="searchFocused = false"
          />
        </view>
      </view>
      
      <!-- Scrollable list -->
      <scroll-view scroll-y class="files-scroll flex-1">
        <view class="content-container">
          <FileList :files="filteredFiles" @preview="openPreview" />
        </view>
      </scroll-view>
      
      <FilePreviewPanel
        v-if="showPreview"
        :visible="showPreview"
        :file="previewFile"
        @close="showPreview = false"
      />

      <!-- PR-15: 上传 action-sheet -->
      <AppDialog
        v-model:visible="uploadSheetVisible"
        variant="action-sheet"
        :action-items="uploadSheetItems"
      />

    </view>
  </AppShell>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useNavigationStore } from '@/stores/navigation';
import { useFileStore } from '@/stores/file';
import { useResponsiveLayout } from '@/composables/useResponsiveLayout';
import AppShell from '@/components/layout/AppShell.vue';
import MobilePageHeader from '@/components/layout/MobilePageHeader.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppDialog from '@/components/common/AppDialog.vue';
import FileList from '@/components/files/FileList.vue';
import FilePreviewPanel from '@/components/chat/FilePreviewPanel.vue';

const navStore = useNavigationStore();
const fileStore = useFileStore();
const { isDesktop } = useResponsiveLayout();

const searchQuery = ref('');
const searchFocused = ref(false);
const showPreview = ref(false);
const previewFile = ref(null);

onMounted(() => {
  navStore.setActiveModule('files');
});

const filteredFiles = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return fileStore.files;
  return fileStore.files.filter(f => f.name.toLowerCase().includes(query));
});

function openPreview(item) {
  previewFile.value = item;
  showPreview.value = true;
}

function focusSearch() {
  searchFocused.value = true;
}

const uploadSheetVisible = ref(false);
const uploadSheetItems = [
  { label: '上传图片', onClick: markUnavailable },
  { label: '上传PDF文档', onClick: markUnavailable },
  { label: '上传Word文件', onClick: markUnavailable }
];

function markUnavailable() {
  const reason = '文件上传需接入真实选择与上传能力';
  uploadSheetVisible.value = false;
  fileStore.markUnavailable(reason);
  uni.showToast({ title: reason, icon: 'none' });
}

function handleUpload() {
  // PR-15: 替换为 AppDialog action-sheet
  uploadSheetVisible.value = true;
}
</script>

<style scoped>
.files-page {
  height: 100%;
  background-color: var(--color-bg-surface);
}

.header {
  min-height: 64px;
  padding: 0 32px;
  background-color: var(--color-glass-bg);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  backdrop-filter: blur(10px);
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.btn-upload {
  min-height: 40px;
  background-color: var(--color-primary);
  border-radius: 10px;
  padding: 0 16px;
  border: none;
  display: flex;
  align-items: center;
  cursor: pointer;
}
.btn-upload::after { border: none; }

.btn-text {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
}

.gap-2 {
  gap: 6px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.header-icon-btn:hover {
  background-color: var(--color-bg-hover);
}

.search-box {
  margin: 16px 32px 0;
  padding: 8px 12px;
  border-radius: 10px;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border);
}

.search-inner {
  gap: 8px;
}

.search-input {
  height: 24px;
  font-size: 14px;
  color: var(--color-text-primary);
  border: none;
}

.files-scroll {
  height: 100%;
}

.content-container {
  padding: 16px 32px 32px;
  background-color: rgba(243, 243, 254, 0.45);
  min-height: 100%;
  box-sizing: border-box;
}

@media (max-width: 768px) {
  .header {
    padding: 0 16px;
  }

  .search-box {
    margin: 12px 16px 0;
  }

  .content-container {
    padding: 16px;
  }
}
</style>
