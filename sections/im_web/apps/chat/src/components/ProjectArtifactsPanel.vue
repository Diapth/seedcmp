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

type ArtifactKind = 'code' | 'doc' | 'image' | 'preview' | 'file' | 'patch' | 'workspace' | 'other';
type ArtifactStatus = 'available' | 'missing' | 'outside_project' | 'forbidden' | 'undeclared';

interface ThreadArtifact {
  path: string;
  absolutePath: string;
  kind: ArtifactKind;
  description?: string;
  ownerCatId: string;
  taskId: string;
  createdAt: number;
  source?: 'declared' | 'task_ref' | 'chat_file' | 'workspace_scan' | 'patch_staging';
  status?: ArtifactStatus;
  reason?: string;
}

interface RuntimeWorkspaceRecord {
  id: string;
  type: string;
  path: string;
  runtimeRoot: string;
  projectRoot: string;
  ownerCatId?: string;
  invocationId?: string;
  dirtyStatus: 'clean' | 'dirty' | 'unknown';
  changedFiles?: string[];
  sizeBytes?: number;
  cleanupPolicy: string;
  exists?: boolean;
  projectScoped?: boolean;
}

const artifacts = ref<ThreadArtifact[]>([]);
const workspaces = ref<RuntimeWorkspaceRecord[]>([]);
const diagnostics = ref<Record<string, number>>({});
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
  if ((artifact.status || 'available') !== 'available') return;
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

function artifactStatus(artifact: ThreadArtifact): ArtifactStatus {
  return artifact.status || 'available';
}

function artifactStatusText(status: ArtifactStatus) {
  if (status === 'available') return '可用';
  if (status === 'missing') return '文件缺失';
  if (status === 'outside_project') return '项目外';
  if (status === 'forbidden') return '无权限';
  if (status === 'undeclared') return '未登记';
  return status;
}

function artifactStatusReason(artifact: ThreadArtifact) {
  if (artifact.reason) return artifact.reason;
  const status = artifactStatus(artifact);
  if (status === 'missing') return '产物引用存在，但当前磁盘上找不到该文件。';
  if (status === 'outside_project') return '产物位于绑定项目目录之外，需要登记为 workspace 产物或导出补丁。';
  if (status === 'undeclared') return '聊天中可能有附件，但还没有结构化产物声明。';
  return '';
}

function hasDiagnosticArtifacts() {
  return artifacts.value.some((artifact) => artifactStatus(artifact) !== 'available');
}

function formatWorkspaceType(type: string) {
  if (type === 'agent_workspace') return 'Agent';
  if (type === 'patch_staging') return 'Patch';
  if (type === 'verification_checkout') return '验证';
  if (type === 'qa_workspace') return 'QA';
  if (type === 'cache') return '缓存';
  return type;
}

function workspaceOwner(workspace: RuntimeWorkspaceRecord) {
  return workspace.ownerCatId || 'unknown';
}

async function refresh() {
  if (!props.threadId) return;
  loading.value = true;
  error.value = null;
  try {
    const [response, workspaceResponse] = await Promise.all([
      apiClient.get<{ artifacts?: ThreadArtifact[]; diagnostics?: Record<string, number> }>(
        `clowder/thread/${encodeURIComponent(props.threadId)}/artifacts`,
      ),
      apiClient.get<{ workspaces?: RuntimeWorkspaceRecord[] }>(
        `clowder/thread/${encodeURIComponent(props.threadId)}/workspaces`,
      ).catch(() => ({ data: { workspaces: [] } })),
    ]);
    const list = response.data?.artifacts ?? [];
    artifacts.value = Array.isArray(list) ? list : [];
    const workspaceList = workspaceResponse.data?.workspaces ?? [];
    workspaces.value = Array.isArray(workspaceList) ? workspaceList : [];
    diagnostics.value = response.data?.diagnostics || {};
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
    workspaces.value = [];
    diagnostics.value = {};
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
    <div v-else-if="!loading && artifacts.length === 0 && workspaces.length === 0" class="artifacts-panel__empty">
      <p>还没有已登记产物。</p>
      <p>
        猫猫需要调用 <code>cat_cafe_declare_artifact</code>；如果聊天里有附件但这里为空，
        说明产物声明链路没有写入。
      </p>
    </div>

    <div v-else class="artifacts-panel__groups">
      <section v-if="workspaces.length > 0" class="artifacts-panel__workspace-section">
        <header class="artifacts-panel__group-header">
          <span class="artifacts-panel__owner-name">Runtime Workspaces</span>
        </header>
        <ul class="artifacts-panel__list">
          <li
            v-for="workspace in workspaces"
            :key="workspace.id"
            class="artifacts-panel__item"
          >
            <div class="artifacts-panel__workspace">
              <div class="artifacts-panel__workspace-main">
                <span class="artifacts-panel__filename">{{ workspace.path.split('/').pop() }}</span>
                <span class="artifacts-panel__kind">{{ formatWorkspaceType(workspace.type) }}</span>
                <span
                  class="artifacts-panel__status"
                  :class="workspace.projectScoped ? 'artifacts-panel__status--available' : 'artifacts-panel__status--outside_project'"
                >
                  {{ workspace.projectScoped ? '项目内' : '待检查' }}
                </span>
              </div>
              <div class="artifacts-panel__desc">
                @{{ workspaceOwner(workspace) }} · {{ workspace.dirtyStatus }} · {{ workspace.cleanupPolicy }}
              </div>
              <div class="artifacts-panel__reason">
                {{ workspace.path }}
              </div>
            </div>
          </li>
        </ul>
      </section>

      <div v-if="hasDiagnosticArtifacts()" class="artifacts-panel__diagnostic">
        <span>诊断</span>
        <span v-if="diagnostics.missing">缺失 {{ diagnostics.missing }}</span>
        <span v-if="diagnostics.outside_project">项目外 {{ diagnostics.outside_project }}</span>
        <span v-if="diagnostics.forbidden">无权限 {{ diagnostics.forbidden }}</span>
      </div>
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
              :class="{ 'is-unavailable': artifactStatus(artifact) !== 'available' }"
              :disabled="artifactStatus(artifact) !== 'available'"
              @click="openArtifact(artifact)"
            >
              <span class="artifacts-panel__filename">{{ artifact.path.split('/').pop() }}</span>
              <span class="artifacts-panel__kind">
                {{ artifact.kind }}
              </span>
              <span
                class="artifacts-panel__status"
                :class="`artifacts-panel__status--${artifactStatus(artifact)}`"
              >
                {{ artifactStatusText(artifactStatus(artifact)) }}
              </span>
              <span v-if="artifact.description" class="artifacts-panel__desc">
                {{ artifact.description }}
              </span>
            </button>
            <div v-if="artifactStatusReason(artifact)" class="artifacts-panel__reason">
              {{ artifactStatusReason(artifact) }}
            </div>
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

.artifacts-panel__empty {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.artifacts-panel__empty p {
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

.artifacts-panel__diagnostic {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border: 1px solid #f59e0b;
  border-radius: 6px;
  background: #fff7ed;
  color: #92400e;
  font-size: 12px;
}

.artifacts-panel__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.artifacts-panel__workspace-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.artifacts-panel__workspace {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--color-border-2, #e5e0d8);
  border-radius: 6px;
  background: var(--color-bg-2, #fff);
}

.artifacts-panel__workspace-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
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

.artifacts-panel__item-btn.is-unavailable {
  cursor: not-allowed;
  opacity: 0.8;
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

.artifacts-panel__status {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  white-space: nowrap;
}

.artifacts-panel__status--missing,
.artifacts-panel__status--outside_project,
.artifacts-panel__status--forbidden,
.artifacts-panel__status--undeclared {
  background: #fee2e2;
  color: #991b1b;
}

.artifacts-panel__reason {
  padding: 2px 8px 0;
  color: #92400e;
  font-size: 11px;
  line-height: 16px;
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
