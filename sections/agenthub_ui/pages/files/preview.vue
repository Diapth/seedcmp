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
import { ref, onMounted } from 'vue';
import AppShell from '@/components/layout/AppShell.vue';
import MobilePageHeader from '@/components/layout/MobilePageHeader.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import FilePreviewPanel from '@/components/chat/FilePreviewPanel.vue';

const fileData = ref({
  name: '未命名文件',
  fileName: '未命名文件',
  fileSize: '未知大小'
});

onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const rawFile = currentPage?.$page?.options?.file || '';

  if (!rawFile) return;

  try {
    fileData.value = JSON.parse(decodeURIComponent(rawFile));
  } catch (error) {
    uni.showToast({ title: '文件预览参数无效', icon: 'none' });
  }
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
