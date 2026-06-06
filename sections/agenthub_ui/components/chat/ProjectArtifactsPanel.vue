<template>
  <view class="artifacts-panel">
    <view v-if="items.length" class="artifact-list">
      <view v-for="item in items" :key="item.id" class="artifact-row">
        <view class="artifact-main">
          <text class="artifact-name">{{ item.name }}</text>
          <text class="artifact-meta">{{ item.type || 'artifact' }}</text>
        </view>
        <button class="artifact-action" :disabled="!item.url" @click="openArtifact(item)">打开</button>
      </view>
    </view>
    <text v-else class="empty-copy">暂无真实产物</text>
  </view>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useClowderStore } from '@/stores/clowder.js';

const props = defineProps({
  coordinationId: {
    type: String,
    default: ''
  }
});

const clowderStore = useClowderStore();
const items = computed(() => (clowderStore.artifacts[props.coordinationId] || []).map((item) => ({
  id: item.id || item.artifact_id || item.url || item.name,
  name: item.name || item.title || '未命名产物',
  type: item.type || item.kind || '',
  url: item.url || item.download_url || ''
})));

function openArtifact(item) {
  if (!item.url) return;
  // #ifdef H5
  if (typeof window !== 'undefined') window.open(item.url, '_blank');
  // #endif
  // #ifndef H5
  uni.showToast({ title: '请在 Web 端打开产物链接', icon: 'none' });
  // #endif
}

onMounted(() => {
  if (props.coordinationId) clowderStore.fetchArtifacts(props.coordinationId).catch(() => undefined);
});
</script>

<style scoped>
.artifacts-panel,
.artifact-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.artifact-row {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.artifact-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.artifact-name {
  font-size: 13px;
  color: var(--color-text-primary);
}

.artifact-meta,
.empty-copy {
  font-size: 12px;
  color: var(--color-text-muted);
}

.artifact-action {
  min-width: 64px;
  height: 32px;
  border-radius: 8px;
  font-size: 12px;
}
</style>
