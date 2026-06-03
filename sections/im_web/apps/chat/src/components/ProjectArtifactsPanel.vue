<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { apiClient } from '@tsdaodao/base-vue';
import type { ClowderAgent } from '@tsdaodao/datasource-vue';
import CatWorkBadge from './CatWorkBadge.vue';

defineOptions({ name: 'ProjectArtifactsPanel' });

interface Props {
  threadId: string;
  agentDirectory?: ClowderAgent[];
}

const props = defineProps<Props>();

type ArtifactKind = 'code' | 'doc' | 'image' | 'preview' | 'other';

interface ThreadArtifact {
  path: string;
  absolutePath: string;
  kind: ArtifactKind;
  description?: string;
  ownerCatId: string;
  taskId: string;
  createdAt: number;
}

const artifacts = ref<ThreadArtifact[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const artifactsByOwner = computed(() => {
  const map = new Map<string, ThreadArtifact[]>();
  for (const a of artifacts.value) {
    const list = map.get(a.ownerCatId) ?? [];
    list.push(a);
    map.set(a.ownerCatId, list);
  }
  return Array.from(map.entries()).map(([ownerCatId, items]) => ({
    ownerCatId,
    items: items.sort((a, b) => b.createdAt - a.createdAt),
  }));
});

function lookupAgent(catId: string): ClowderAgent | undefined {
  return props.agentDirectory?.find((a) => a.catId === catId);
}

function openArtifact(artifact: ThreadArtifact) {
  // Code files go through vscode:// (fallback to file:// if VS Code is not
  // installed). Documents and images open with the OS default handler.
  const url =
    artifact.kind === 'code'
      ? `vscode://file/${artifact.absolutePath}`
      : `file://${artifact.absolutePath}`;
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.warn('[ProjectArtifactsPanel] open failed', err);
  }
}

async function refresh() {
  if (!props.threadId) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await apiClient.get<{ artifacts?: ThreadArtifact[] }>(
      `clowder/thread/${encodeURIComponent(props.threadId)}/artifacts`,
    );
    const list = response.data?.artifacts ?? [];
    artifacts.value = Array.isArray(list) ? list : [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载产物失败';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void refresh();
  pollTimer = setInterval(() => {
    void refresh();
  }, 15_000);
});

watch(
  () => props.threadId,
  () => {
    artifacts.value = [];
    void refresh();
  },
);

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (pollTimer !== null) clearInterval(pollTimer);
  });
}
</script>

<template>
  <div class="artifacts-panel" data-testid="project-artifacts-panel">
    <div class="artifacts-panel__header">
      <h4>产物</h4>
      <button
        type="button"
        class="artifacts-panel__refresh"
        :disabled="loading"
        @click="refresh"
      >
        {{ loading ? '刷新中…' : '刷新' }}
      </button>
    </div>

    <p v-if="error" class="artifacts-panel__error">{{ error }}</p>
    <p
      v-else-if="!loading && artifacts.length === 0"
      class="artifacts-panel__empty"
    >
      还没有产物。猫猫完成文件后,会通过
      <code>cat_cafe_declare_artifact</code> 工具自动出现在这里。
    </p>

    <div v-else class="artifacts-panel__groups">
      <section
        v-for="group in artifactsByOwner"
        :key="group.ownerCatId"
        class="artifacts-panel__group"
      >
        <header class="artifacts-panel__group-header">
          <CatWorkBadge
            v-if="lookupAgent(group.ownerCatId)"
            :cat="lookupAgent(group.ownerCatId)!"
            :available="true"
            :selected="false"
            compact
          />
          <span v-else class="artifacts-panel__owner-name">
            @{{ group.ownerCatId }}
          </span>
        </header>
        <ul class="artifacts-panel__list">
          <li
            v-for="artifact in group.items"
            :key="artifact.taskId + ':' + artifact.path"
            class="artifacts-panel__item"
          >
            <button
              type="button"
              class="artifacts-panel__item-btn"
              @click="openArtifact(artifact)"
            >
              <span class="artifacts-panel__filename">{{ artifact.path.split('/').pop() }}</span>
              <span class="artifacts-panel__kind artifacts-panel__kind--{{ artifact.kind }}">
                {{ artifact.kind }}
              </span>
              <span v-if="artifact.description" class="artifacts-panel__desc">
                {{ artifact.description }}
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.artifacts-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--color-bg-1, #fdf8f3);
  border: 1px solid var(--color-border-2, #e5e0d8);
  border-radius: 14px;
}

.artifacts-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.artifacts-panel__header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.artifacts-panel__refresh {
  font-size: 12px;
  padding: 4px 10px;
  border: 1px solid var(--color-border-2, #d8d2c7);
  background: var(--color-bg-2, #fff);
  border-radius: 6px;
  cursor: pointer;
}

.artifacts-panel__refresh:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.artifacts-panel__empty,
.artifacts-panel__error {
  font-size: 12px;
  color: var(--color-text-3, #6b6b6b);
  margin: 0;
}

.artifacts-panel__error {
  color: #c2410c;
}

.artifacts-panel__groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.artifacts-panel__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.artifacts-panel__group-header {
  display: flex;
  align-items: center;
}

.artifacts-panel__owner-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-2, #3a3a3a);
}

.artifacts-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.artifacts-panel__item-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  background: var(--color-bg-2, #fff);
  border: 1px solid var(--color-border-2, #e5e0d8);
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
}

.artifacts-panel__item-btn:hover {
  border-color: var(--color-primary, #6b8afd);
}

.artifacts-panel__filename {
  flex: 1;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artifacts-panel__kind {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--color-fill-2, #f2efe9);
  border-radius: 999px;
  color: var(--color-text-2, #3a3a3a);
  text-transform: uppercase;
}

.artifacts-panel__desc {
  font-size: 11px;
  color: var(--color-text-3, #6b6b6b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 30%;
}
</style>
