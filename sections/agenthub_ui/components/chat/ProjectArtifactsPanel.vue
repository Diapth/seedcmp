<template>
  <view class="artifacts-panel">
    <view v-if="items.length" class="artifact-list">
      <view v-for="item in items" :key="item.id" class="artifact-row">
        <view class="artifact-main">
          <text class="artifact-name">{{ item.name }}</text>
          <text class="artifact-meta">{{ item.meta }}</text>
          <text v-if="item.reason" class="artifact-reason">{{ item.reason }}</text>
        </view>
        <button class="artifact-action" :disabled="!item.url || item.status !== 'available'" @click="openArtifact(item)">打开</button>
      </view>
    </view>
    <text v-else class="empty-copy">暂无真实产物</text>
  </view>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { useClowderStore } from '@/stores/clowder.js';

const props = defineProps({
  threadId: {
    type: String,
    default: ''
  },
  coordinationId: {
    type: String,
    default: ''
  }
});

const clowderStore = useClowderStore();
const artifactKey = computed(() => props.threadId || props.coordinationId || '');
const sourceItems = computed(() => {
  if (props.threadId) return clowderStore.threadArtifacts[props.threadId] || [];
  return clowderStore.artifacts[props.coordinationId] || [];
});
const items = computed(() => sourceItems.value.map((item) => ({
  id: item.id || item.artifact_id || item.url || item.name || `${item.taskId || item.task_id || 'artifact'}:${item.path || item.absolutePath || ''}`,
  name: item.name || item.title || item.workspaceRelativePath || item.workspace_relative_path || item.path || '未命名产物',
  meta: [
    item.kind || item.type || 'artifact',
    item.ownerCatId || item.owner_cat_id || item.owner || '',
    item.status || ''
  ].filter(Boolean).join(' · '),
  status: item.status || 'available',
  reason: item.reason || '',
  url: item.url || item.download_url || (item.absolutePath ? `file://${item.absolutePath}` : '')
})));

function openArtifact(item) {
  if (!item.url || item.status !== 'available') return;
  // #ifdef H5
  if (typeof window !== 'undefined') window.open(item.url, '_blank');
  // #endif
  // #ifndef H5
  uni.showToast({ title: '请在 Web 端打开产物链接', icon: 'none' });
  // #endif
}

function refresh() {
  if (!artifactKey.value) return Promise.resolve([]);
  if (props.threadId) return clowderStore.fetchThreadArtifacts(props.threadId).catch(() => []);
  const coordination = props.coordinationId;
  return clowderStore.fetchArtifacts(coordination).catch(() => []);
}

onMounted(() => {
  refresh();
});

watch(artifactKey, () => {
  refresh();
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
.artifact-reason,
.empty-copy {
  font-size: 12px;
  color: var(--color-text-muted);
}

.artifact-reason {
  color: var(--color-warning);
}

.artifact-action {
  min-width: 64px;
  height: 32px;
  border-radius: 8px;
  font-size: 12px;
}
</style>
