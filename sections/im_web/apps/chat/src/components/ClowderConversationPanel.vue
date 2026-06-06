<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  getClowderCatIdFromContactId,
  isClowderCatContactId,
  useClowderStore,
  useMessageStore,
  type ClowderAgent,
  type ClowderChannelType,
  type ClowderCoordination,
  type ClowderCoordinationSubtask,
  type ClowderGroupAutoReplyMode,
  type CoordinatorKickoff,
} from '@tsdaodao/datasource-vue';
import { useRouter } from 'vue-router';
import CoordinatorKickoffCard from './CoordinatorKickoffCard.vue';
import ProjectKanbanPanel from './ProjectKanbanPanel.vue';
import ProjectArtifactsPanel from './ProjectArtifactsPanel.vue';

defineOptions({ name: 'ClowderConversationPanel' });

const props = defineProps<{
  channelId: string;
  channelType: number;
  visible: boolean;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
}>();

const clowderStore = useClowderStore();
const messageStore = useMessageStore();
const router = useRouter();

type SubTab = 'overview' | 'coordination' | 'kanban' | 'artifacts';
type ProjectKanbanPanelExpose = { refresh: () => Promise<void> | void };
const subTab = ref<SubTab>('overview');
const kanbanPanelRef = ref<ProjectKanbanPanelExpose | null>(null);
const coordinationLoading = ref(false);
const coordinationActionId = ref('');
const coordinationError = ref('');

const stateTokens = 'ready disabled denied loading error';
const KICKOFF_REFRESH_INTERVAL_MS = 30_000;
const KICKOFF_MAX_AGE_MS = 30 * 60_000;
const TASK_ID_PATTERN = /\b\d{16,}-\d{6,}-[0-9a-f]{8,}\b/gi;
const CLOWDER_COORDINATOR_CAT_ID = 'coordinator';
let kickoffRefreshTimer: ReturnType<typeof setInterval> | null = null;

const conversationRef = computed(() => ({
  channelId: props.channelId,
  channelType: props.channelType as ClowderChannelType,
}));

const isCoordinatorDirectConversation = computed(() =>
  props.channelType === 1 &&
  isClowderCatContactId(props.channelId) &&
  getClowderCatIdFromContactId(props.channelId) === CLOWDER_COORDINATOR_CAT_ID,
);
const activeProjectGroupBinding = computed(() => {
  if (!isCoordinatorDirectConversation.value) return undefined;
  return clowderStore.getActiveProjectGroupBindingForDirect({
    pmDirectChannelId: props.channelId,
    pmDirectChannelType: props.channelType,
  });
});
const executionConversationRef = computed(() => {
  const groupNo = activeProjectGroupBinding.value?.projectGroupNo;
  if (groupNo) {
    return {
      channelId: groupNo,
      channelType: 2 as ClowderChannelType,
    };
  }
  return conversationRef.value;
});
const currentConversation = computed(() => clowderStore.getConversation(props.channelId, props.channelType));
const conversation = computed(() =>
  clowderStore.getConversation(executionConversationRef.value.channelId, executionConversationRef.value.channelType) ||
  currentConversation.value,
);
const directory = computed(() =>
  clowderStore.agentDirectories[`${executionConversationRef.value.channelId}-${executionConversationRef.value.channelType}`] ||
  clowderStore.agentDirectories[`${props.channelId}-${props.channelType}`],
);
const groupAgents = computed(() =>
  executionConversationRef.value.channelType === 2 ? clowderStore.groupCatMemberships[executionConversationRef.value.channelId] || [] : [],
);

const autoReplyModes: Array<{ value: ClowderGroupAutoReplyMode; label: string }> = [
  { value: 'mentions_only', label: '仅 @ 时回复' },
  { value: 'soft_mentions', label: '默认协调者' },
  { value: 'off', label: '关闭' },
];

const status = computed(() => {
  if (clowderStore.status.state === 'error' || clowderStore.status.reachable === false) {
    return clowderStore.status;
  }
  return conversation.value?.status || clowderStore.status;
});
const disabledReason = computed(() => conversation.value?.disabledReason || clowderStore.error);
const statusReason = computed(() => {
  const rawStatus = status.value as typeof status.value & { reason?: string; error?: string; message?: string };
  if (disabledReason.value) return disabledReason.value;
  return (
    rawStatus.reason ||
    rawStatus.lastError ||
    rawStatus.error ||
    rawStatus.message ||
    (rawStatus.state === 'error' ? 'clowder_unavailable' : '')
  );
});
const agents = computed<ClowderAgent[]>(
  () => directory.value?.agents || conversation.value?.agents || groupAgents.value,
);
const currentFocus = computed(() => conversation.value?.focusCatId);
const groupAutoReplyMode = computed<ClowderGroupAutoReplyMode>(() => {
  if (props.channelType !== 2) return 'mentions_only';
  return clowderStore.groupAutoReplyModes[props.channelId] || 'soft_mentions';
});

// The clowder-ai `binding` payload exposes threadId but not coordinationId.
// The kickoff store keys on coordinationId, so for now we surface any
// fresh kickoff to the user. Phase 6 will narrow to the channel mapping.
const boundThreadId = computed<string | null>(() => {
  if (activeProjectGroupBinding.value) {
    return activeProjectGroupBinding.value.projectThreadId ||
      clowderStore.getConversation(activeProjectGroupBinding.value.projectGroupNo, 2)?.binding?.threadId ||
      null;
  }
  const binding = conversation.value?.binding;
  if (!binding) return null;
  return binding.threadId || null;
});
const isUsingProjectGroupExecution = computed(() => Boolean(activeProjectGroupBinding.value));
const activeWorkspace = computed(() => clowderStore.getActiveWorkspace(boundThreadId.value));
const workspaceBindingDiagnostics = computed(() =>
  boundThreadId.value ? clowderStore.getWorkspaceBinding(boundThreadId.value)?.diagnostics : undefined,
);
const threadCoordinations = computed<ClowderCoordination[]>(() => {
  const threadId = boundThreadId.value;
  if (!threadId) return [];
  return [...clowderStore.getThreadCoordinations(threadId)].sort((a, b) => b.updatedAt - a.updatedAt);
});
const activeCoordination = computed<ClowderCoordination | null>(() => threadCoordinations.value[0] || null);
const activeCoordinationSubtasks = computed<ClowderCoordinationSubtask[]>(() => activeCoordination.value?.subtasks || []);
const coordinationRefreshToken = computed(() =>
  threadCoordinations.value.map((item) => `${item.coordinationId}:${item.status}:${item.updatedAt}`).join('|'),
);

function textFromMessage(message: { content?: unknown }): string {
  const content = message.content;
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content) as { text?: unknown; content?: unknown };
      return String(parsed.text || parsed.content || content);
    } catch {
      return content;
    }
  }
  if (content && typeof content === 'object') {
    const payload = content as { text?: unknown; content?: unknown; markdown?: unknown };
    return String(payload.text || payload.content || payload.markdown || '');
  }
  return '';
}

const observedTaskIds = computed(() => {
  const ids = new Set<string>();
  const recent = messageStore
    .getChannelMessages(executionConversationRef.value.channelId, executionConversationRef.value.channelType)
    .slice(-80);
  for (const message of recent) {
    const text = textFromMessage(message);
    const matches = text.match(TASK_ID_PATTERN) || [];
    for (const match of matches) ids.add(match);
  }
  return Array.from(ids);
});

const observedTaskIdsKey = computed(() => observedTaskIds.value.join(','));
const deliveryRefreshToken = computed(() => {
  const delivery = conversation.value?.lastDelivery;
  if (!delivery) return '';
  return [
    delivery.state,
    delivery.threadId,
    delivery.invocationId,
    delivery.lastUpdatedAt,
  ].filter(Boolean).join(':');
});

async function refreshKanban() {
  const threadId = boundThreadId.value;
  if (!threadId) return;
  if (kanbanPanelRef.value?.refresh) {
    await kanbanPanelRef.value.refresh();
    return;
  }
  await clowderStore.fetchThreadTasks(threadId, {
    observedTaskIds: observedTaskIds.value.length ? observedTaskIds.value : undefined,
  });
}

async function refreshCoordinations() {
  const threadId = boundThreadId.value;
  if (!threadId) return;
  coordinationLoading.value = true;
  coordinationError.value = '';
  try {
    await clowderStore.loadThreadCoordinations(threadId);
  } catch (err: any) {
    coordinationError.value = err?.message || err?.msg || 'coordination_load_failed';
  } finally {
    coordinationLoading.value = false;
  }
}

async function refresh() {
  if (!props.visible || !props.channelId) return;
  const health = await clowderStore.refreshStatus().catch(() => clowderStore.status);
  if (health.state === 'error' || health.reachable === false) return;
  await clowderStore.loadConversation(conversationRef.value).catch(() => undefined);
  if (isCoordinatorDirectConversation.value) {
    await clowderStore.loadActiveProjectGroupBindingForDirect({
      pmDirectChannelId: props.channelId,
      pmDirectChannelType: props.channelType as ClowderChannelType,
    }).catch(() => undefined);
  }
  const executionRef = executionConversationRef.value;
  if (executionRef.channelId !== props.channelId || Number(executionRef.channelType) !== Number(props.channelType)) {
    await clowderStore.loadConversation(executionRef).catch(() => undefined);
  }
  if (boundThreadId.value) {
    await clowderStore.loadWorkspaceBinding(boundThreadId.value).catch(() => undefined);
    await refreshCoordinations();
  }
  if (executionRef.channelType === 2) {
    await clowderStore.loadGroupCats(executionRef.channelId).catch(() => undefined);
  }
  await clowderStore.loadAgentDirectory(executionRef).catch(() => undefined);
}

function statusText(statusValue: string) {
  const labels: Record<string, string> = {
    planning: '规划中',
    dispatching: '派发中',
    running: '执行中',
    aggregating: '汇总中',
    succeeded: '已完成',
    failed: '失败',
    cancelled: '已取消',
    todo: '待办',
    doing: '进行中',
    blocked: '阻塞',
    done: '完成',
  };
  return labels[statusValue] || statusValue;
}

function statusTone(statusValue: string) {
  if (['succeeded', 'done'].includes(statusValue)) return 'success';
  if (['failed', 'blocked', 'cancelled'].includes(statusValue)) return 'danger';
  if (['dispatching', 'running', 'aggregating', 'doing'].includes(statusValue)) return 'active';
  return 'neutral';
}

function shortId(value: string) {
  if (!value) return '';
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function lookupAgentName(catId?: string) {
  if (!catId) return '未分配';
  return agents.value.find((agent) => agent.catId === catId)?.displayName || `@${catId}`;
}

function canCancelCoordination(coordination?: ClowderCoordination | null) {
  return Boolean(coordination && !['succeeded', 'failed', 'cancelled'].includes(coordination.status));
}

function locateCoordinationSubtask(subtask: ClowderCoordinationSubtask, coordination?: ClowderCoordination | null) {
  window.dispatchEvent(new CustomEvent('clowder:locate-message', {
    detail: {
      taskId: subtask.id,
      coordinationId: coordination?.coordinationId,
      sourceMessageId: coordination?.sourceMessageId,
    },
  }));
}

async function handleCancelCoordination(coordination: ClowderCoordination) {
  if (!canCancelCoordination(coordination) || coordinationActionId.value) return;
  coordinationActionId.value = coordination.coordinationId;
  coordinationError.value = '';
  try {
    await clowderStore.cancelCoordination(coordination.coordinationId, 'cancelled from IM Web coordination panel');
  } catch (err: any) {
    coordinationError.value = err?.message || err?.msg || 'coordination_cancel_failed';
  } finally {
    coordinationActionId.value = '';
  }
}

async function handleFocus(catId: string) {
  await clowderStore.setFocus(conversationRef.value, catId);
}

async function handleClearFocus() {
  await clowderStore.clearFocus(conversationRef.value);
}

async function handleAutoReplyMode(mode: ClowderGroupAutoReplyMode) {
  if (props.channelType !== 2 || mode === groupAutoReplyMode.value) return;
  await clowderStore.setGroupAutoReplyMode(props.channelId, mode, props.channelId);
}

async function refreshKickoffs() {
  try {
    await clowderStore.loadRecentKickoffs(KICKOFF_MAX_AGE_MS);
  } catch {
    /* keep last known state on failure */
  }
}

function startKickoffPolling() {
  if (kickoffRefreshTimer !== null) return;
  kickoffRefreshTimer = setInterval(() => {
    void refreshKickoffs();
  }, KICKOFF_REFRESH_INTERVAL_MS);
}

function stopKickoffPolling() {
  if (kickoffRefreshTimer !== null) {
    clearInterval(kickoffRefreshTimer);
    kickoffRefreshTimer = null;
  }
}

const activeKickoff = computed<CoordinatorKickoff | null>(() => {
  const now = Date.now();
  let best: CoordinatorKickoff | null = null;
  for (const k of Object.values(clowderStore.kickoffs)) {
    if (!k || now - k.createdAt > KICKOFF_MAX_AGE_MS) continue;
    if (!best || k.createdAt > best.createdAt) {
      best = k;
    }
  }
  return best;
});

async function handleKickoffCreated(threadId: string) {
  if (!threadId) return;
  try {
    await router.push({
      name: 'Conversation',
      params: {
        channelID: threadId,
        channelType: '2',
      },
    });
  } catch (err) {
    console.warn('[ClowderConversationPanel] router push failed', err);
  }
}

async function openProjectGroup() {
  const binding = activeProjectGroupBinding.value;
  if (!binding?.projectGroupNo) return;
  try {
    await router.push({
      name: 'Conversation',
      params: {
        channelID: binding.projectGroupNo,
        channelType: '2',
      },
    });
  } catch (err) {
    console.warn('[ClowderConversationPanel] project group push failed', err);
  }
}

onMounted(() => {
  refresh();
  void refreshKickoffs();
  startKickoffPolling();
});

onUnmounted(stopKickoffPolling);

watch(() => [props.visible, props.channelId, props.channelType], refresh);

watch(subTab, (next) => {
  if (next === 'kanban') void refreshKanban();
  if (next === 'coordination') void refreshCoordinations();
});

watch(boundThreadId, () => {
  if (boundThreadId.value) void clowderStore.loadWorkspaceBinding(boundThreadId.value);
  if (subTab.value === 'kanban') void refreshKanban();
  if (subTab.value === 'coordination') void refreshCoordinations();
});

watch(observedTaskIdsKey, () => {
  if (subTab.value === 'kanban') void refreshKanban();
});

watch(deliveryRefreshToken, (token) => {
  if (!token || subTab.value !== 'kanban') return;
  const state = conversation.value?.lastDelivery?.state;
  if (state === 'delivered' || state === 'failed' || state === 'skipped' || state === 'duplicate') {
    void refreshKanban();
  }
});

watch(coordinationRefreshToken, () => {
  if (subTab.value === 'kanban') void refreshKanban();
});
</script>

<template>
  <section v-if="visible" class="clowder-panel" :data-states="stateTokens">
    <div class="panel-header">
      <div>
        <h3>Clowder</h3>
        <span>{{ status.state }}</span>
      </div>
      <button class="icon-btn" type="button" title="关闭" @click="emit('close')">x</button>
    </div>

    <div class="panel-tabs" role="tablist">
      <button
        type="button"
        class="panel-tab"
        :class="{ active: subTab === 'overview' }"
        :aria-selected="subTab === 'overview'"
        role="tab"
        @click="subTab = 'overview'"
      >
        概览
      </button>
      <button
        type="button"
        class="panel-tab"
        :class="{ active: subTab === 'coordination' }"
        :aria-selected="subTab === 'coordination'"
        role="tab"
        :disabled="!boundThreadId"
        @click="subTab = 'coordination'"
      >
        协调任务
      </button>
      <button
        type="button"
        class="panel-tab"
        :class="{ active: subTab === 'kanban' }"
        :aria-selected="subTab === 'kanban'"
        role="tab"
        :disabled="!boundThreadId"
        @click="subTab = 'kanban'"
      >
        看板
      </button>
      <button
        type="button"
        class="panel-tab"
        :class="{ active: subTab === 'artifacts' }"
        :aria-selected="subTab === 'artifacts'"
        role="tab"
        :disabled="!boundThreadId"
        @click="subTab = 'artifacts'"
      >
        产物
      </button>
    </div>

    <CoordinatorKickoffCard
      v-if="activeKickoff"
      :kickoff="activeKickoff"
      :channel-id="channelId"
      :channel-type="channelType"
      @created="handleKickoffCreated"
    />

    <div v-if="subTab === 'overview'" class="panel-body">
      <section class="panel-section">
        <div class="section-label">{{ isUsingProjectGroupExecution ? 'Project Thread' : 'Thread' }}</div>
        <div class="thread-id">{{ boundThreadId || 'Not bound' }}</div>
        <div v-if="statusReason" class="error-text">error: {{ statusReason }}</div>
        <div v-if="conversation?.lastDelivery" class="muted">
          Delivery: {{ conversation.lastDelivery.state }}
        </div>
      </section>

      <section v-if="activeProjectGroupBinding" class="panel-section">
        <div class="section-label">Project Group</div>
        <div class="workspace-summary">
          <strong>{{ activeProjectGroupBinding.projectName }}</strong>
          <span>{{ activeProjectGroupBinding.projectGroupNo }}</span>
          <small>{{ activeProjectGroupBinding.projectThreadId ? 'execution bound' : 'waiting for project thread' }}</small>
        </div>
        <button type="button" class="project-group-link" @click="openProjectGroup">
          打开项目群
        </button>
      </section>

      <section class="panel-section">
        <div class="section-label">Workspace</div>
        <div v-if="activeWorkspace" class="workspace-summary">
          <strong>{{ activeWorkspace.displayName }}</strong>
          <span>{{ activeWorkspace.relativePath }}</span>
          <small>{{ activeWorkspace.linkedThreadIds.length }} threads · {{ activeWorkspace.linkedTaskIds.length }} tasks</small>
        </div>
        <div v-else class="muted">No active workspace</div>
        <div v-if="workspaceBindingDiagnostics?.state === 'project_path_mismatch'" class="error-text">
          projectPath mismatch: {{ workspaceBindingDiagnostics.threadProjectPath }}
        </div>
      </section>

      <section class="panel-section">
        <div class="section-label">Focus</div>
        <div class="focus-row">
          <span>{{ currentFocus || 'Default routing' }}</span>
          <button
            type="button"
            :disabled="!currentFocus || clowderStore.loading"
            @click="handleClearFocus"
          >
            Clear
          </button>
        </div>
      </section>

      <section v-if="channelType === 2" class="panel-section">
        <div class="section-label">Auto Reply</div>
        <div class="mode-row" role="group" aria-label="群聊自动回复模式">
          <button
            v-for="mode in autoReplyModes"
            :key="mode.value"
            type="button"
            class="mode-btn"
            :class="{ active: groupAutoReplyMode === mode.value }"
            :disabled="clowderStore.loading"
            @click="handleAutoReplyMode(mode.value)"
          >
            {{ mode.label }}
          </button>
        </div>
      </section>

      <section class="panel-section">
        <div class="section-label">Agents</div>
        <div v-if="clowderStore.loading && agents.length === 0" class="muted">loading</div>
        <div v-else-if="clowderStore.error && agents.length === 0" class="error-text">
          error: {{ clowderStore.error }}
        </div>
        <div v-else-if="disabledReason && agents.length === 0" class="muted">
          disabled: {{ disabledReason }}
        </div>
        <button
          v-for="agent in agents"
          :key="agent.catId"
          type="button"
          class="agent-row"
          :disabled="!agent.available || clowderStore.loading"
          @click="handleFocus(agent.catId)"
        >
          <span class="agent-name">{{ agent.displayName }}</span>
          <span class="agent-state">{{ agent.available ? 'ready' : 'disabled' }}</span>
        </button>
        <div v-if="clowderStore.error && agents.length > 0" class="muted">
          directory fallback: {{ clowderStore.error }}
        </div>
      </section>
    </div>

    <div v-else-if="subTab === 'kanban' && boundThreadId" class="panel-body panel-body--scrollable">
      <ProjectKanbanPanel
        ref="kanbanPanelRef"
        :thread-id="boundThreadId"
        :agent-directory="agents"
        :observed-task-ids="observedTaskIds"
        :coordination-subtasks="activeCoordinationSubtasks"
        :active-workspace="activeWorkspace"
      />
    </div>

    <div v-else-if="subTab === 'coordination' && boundThreadId" class="panel-body panel-body--scrollable">
      <section class="coordination-pane">
        <header class="coordination-head">
          <div>
            <div class="section-label">Current Coordination</div>
            <h4>{{ activeCoordination ? shortId(activeCoordination.coordinationId) : '暂无协调任务' }}</h4>
          </div>
          <button
            type="button"
            class="coordination-refresh"
            :disabled="coordinationLoading"
            @click="refreshCoordinations"
          >
            {{ coordinationLoading ? '刷新中…' : '刷新' }}
          </button>
        </header>

        <p v-if="coordinationError" class="error-text">{{ coordinationError }}</p>
        <p v-else-if="coordinationLoading && !activeCoordination" class="muted">正在加载协调状态…</p>
        <p v-else-if="!activeCoordination" class="muted">让协调者拆解并派发任务后，这里会显示状态、分工和结果。</p>

        <template v-if="activeCoordination">
          <div class="coordination-summary">
            <span class="status-pill" :data-tone="statusTone(activeCoordination.status)">
              {{ statusText(activeCoordination.status) }}
            </span>
            <span>{{ activeCoordination.dispatchMode }}</span>
            <span>{{ activeCoordination.subtasks.length }} subtasks</span>
          </div>
          <p class="coordination-goal">{{ activeCoordination.goal }}</p>
          <p v-if="activeCoordination.failureReason" class="error-text">
            {{ activeCoordination.failureReason }}
          </p>
          <p v-if="activeCoordination.aggregateSummary" class="coordination-result">
            {{ activeCoordination.aggregateSummary }}
          </p>
          <div v-if="activeCoordination.assumptions.length" class="coordination-notes">
            <span v-for="assumption in activeCoordination.assumptions" :key="assumption">
              {{ assumption }}
            </span>
          </div>
          <div v-if="activeCoordination.targetCatIds.length" class="coordination-targets">
            <span
              v-for="catId in activeCoordination.targetCatIds"
              :key="catId"
              class="target-chip"
            >
              {{ lookupAgentName(catId) }}
            </span>
          </div>
          <button
            type="button"
            class="coordination-cancel"
            :disabled="!canCancelCoordination(activeCoordination) || coordinationActionId === activeCoordination.coordinationId"
            @click="handleCancelCoordination(activeCoordination)"
          >
            {{ coordinationActionId === activeCoordination.coordinationId ? '取消中…' : '取消任务' }}
          </button>

          <ol class="coordination-subtasks">
            <li
              v-for="subtask in activeCoordination.subtasks"
              :key="subtask.id"
              class="coordination-subtask"
            >
              <button
                type="button"
                class="coordination-subtask-main"
                @click="locateCoordinationSubtask(subtask, activeCoordination)"
              >
                <span class="coordination-subtask-title">{{ subtask.title }}</span>
                <span class="coordination-subtask-meta">
                  {{ lookupAgentName(subtask.targetCatId) }}
                  <span class="status-pill" :data-tone="statusTone(subtask.status)">
                    {{ statusText(subtask.status) }}
                  </span>
                </span>
              </button>
              <p v-if="subtask.description" class="coordination-subtask-text">{{ subtask.description }}</p>
              <p v-if="subtask.result" class="coordination-subtask-text">{{ subtask.result }}</p>
              <p v-if="subtask.failureReason" class="error-text">{{ subtask.failureReason }}</p>
              <div v-if="subtask.artifactRefs.length" class="coordination-artifacts">
                <span v-for="artifactRef in subtask.artifactRefs" :key="artifactRef">
                  {{ artifactRef }}
                </span>
              </div>
            </li>
          </ol>
        </template>
      </section>
    </div>

    <div v-else-if="subTab === 'artifacts' && boundThreadId" class="panel-body panel-body--scrollable">
      <ProjectArtifactsPanel :thread-id="boundThreadId" :agent-directory="agents" :active-workspace="activeWorkspace" />
    </div>

    <div v-else class="panel-body">
      <p class="muted">等待 conversation 与 Clowder thread 绑定…</p>
    </div>
  </section>
</template>

<style scoped>
.clowder-panel {
  width: 100%;
  min-width: 264px;
  height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 0 16px;
  border-bottom: var(--border-hairline);
}

.panel-header h3 {
  margin: 0;
  font-size: 15px;
}

.panel-header span,
.muted {
  color: var(--text-secondary);
  font-size: 12px;
}

.icon-btn {
  width: 28px;
  height: 28px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  cursor: pointer;
}

.panel-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 16px 0;
  border-bottom: var(--border-hairline);
}

.panel-tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  font-weight: 500;
}

.panel-tab.active {
  color: var(--primary-color, #165dff);
  border-bottom-color: var(--primary-color, #165dff);
}

.panel-tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.project-group-link {
  width: fit-content;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.panel-body--scrollable {
  overflow-y: auto;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.thread-id,
.focus-row,
.workspace-summary {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  white-space: normal;
}

.workspace-summary span,
.workspace-summary small {
  color: var(--text-secondary);
}

.focus-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mode-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mode-btn {
  min-height: 30px;
  padding: 0 10px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
}

.mode-btn.active {
  border-color: var(--primary-color, #165dff);
  background: rgba(59, 130, 246, 0.12);
  color: var(--primary-color, #165dff);
  font-weight: 600;
}

.mode-btn:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.agent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 34px;
  padding: 0 10px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  cursor: pointer;
}

.agent-row:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.agent-name,
.agent-state {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-name {
  font-weight: 600;
}

.agent-state {
  color: var(--text-secondary);
  font-size: 12px;
}

.error-text {
  color: #b42318;
  font-size: 12px;
}

.coordination-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.coordination-head,
.coordination-summary,
.coordination-targets,
.coordination-subtask-meta,
.coordination-artifacts,
.coordination-notes {
  display: flex;
  align-items: center;
  gap: 8px;
}

.coordination-head {
  justify-content: space-between;
}

.coordination-head h4 {
  margin: 2px 0 0;
  font-size: 14px;
}

.coordination-refresh,
.coordination-cancel {
  min-height: 30px;
  padding: 0 10px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
}

.coordination-cancel {
  align-self: flex-start;
  color: #b42318;
}

.coordination-refresh:disabled,
.coordination-cancel:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.coordination-summary,
.coordination-targets,
.coordination-artifacts,
.coordination-notes {
  flex-wrap: wrap;
  color: var(--text-secondary);
  font-size: 12px;
}

.coordination-goal,
.coordination-result,
.coordination-subtask-text {
  margin: 0;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.coordination-result {
  color: var(--text-secondary);
}

.coordination-notes span,
.coordination-artifacts span,
.target-chip,
.status-pill {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 22px;
  padding: 0 7px;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1;
}

.status-pill[data-tone='active'] {
  background: rgba(22, 93, 255, 0.1);
  color: var(--primary-color, #165dff);
}

.status-pill[data-tone='success'] {
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
}

.status-pill[data-tone='danger'] {
  background: rgba(180, 35, 24, 0.1);
  color: #b42318;
}

.coordination-subtasks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.coordination-subtask {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border: var(--border-hairline);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
}

.coordination-subtask-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.coordination-subtask-title {
  min-width: 0;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.coordination-subtask-meta {
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  color: var(--text-secondary);
  font-size: 11px;
}
</style>
