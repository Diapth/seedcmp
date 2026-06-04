<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useClowderStore, useMessageStore, type ClowderAgent, type ClowderChannelType, type ClowderGroupAutoReplyMode, type CoordinatorKickoff } from '@tsdaodao/datasource-vue';
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

type SubTab = 'overview' | 'kanban' | 'artifacts';
type ProjectKanbanPanelExpose = { refresh: () => Promise<void> | void };
const subTab = ref<SubTab>('overview');
const kanbanPanelRef = ref<ProjectKanbanPanelExpose | null>(null);

const stateTokens = 'ready disabled denied loading error';
const KICKOFF_REFRESH_INTERVAL_MS = 30_000;
const KICKOFF_MAX_AGE_MS = 30 * 60_000;
const TASK_ID_PATTERN = /\b\d{16,}-\d{6,}-[0-9a-f]{8,}\b/gi;
let kickoffRefreshTimer: ReturnType<typeof setInterval> | null = null;

const conversationRef = computed(() => ({
  channelId: props.channelId,
  channelType: props.channelType as ClowderChannelType,
}));

const conversation = computed(() => clowderStore.getConversation(props.channelId, props.channelType));
const directory = computed(() => clowderStore.agentDirectories[`${props.channelId}-${props.channelType}`]);
const groupAgents = computed(() =>
  props.channelType === 2 ? clowderStore.groupCatMemberships[props.channelId] || [] : [],
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
  const binding = conversation.value?.binding;
  if (!binding) return null;
  return binding.threadId || null;
});
const activeWorkspace = computed(() => clowderStore.getActiveWorkspace(boundThreadId.value));
const workspaceBindingDiagnostics = computed(() =>
  boundThreadId.value ? clowderStore.getWorkspaceBinding(boundThreadId.value)?.diagnostics : undefined,
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
  const recent = messageStore.getChannelMessages(props.channelId, props.channelType).slice(-80);
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

async function refresh() {
  if (!props.visible || !props.channelId) return;
  const health = await clowderStore.refreshStatus().catch(() => clowderStore.status);
  if (health.state === 'error' || health.reachable === false) return;
  await clowderStore.loadConversation(conversationRef.value).catch(() => undefined);
  if (boundThreadId.value) {
    await clowderStore.loadWorkspaceBinding(boundThreadId.value).catch(() => undefined);
  }
  if (props.channelType === 2) {
    await clowderStore.loadGroupCats(props.channelId).catch(() => undefined);
  }
  await clowderStore.loadAgentDirectory(conversationRef.value).catch(() => undefined);
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

onMounted(() => {
  refresh();
  void refreshKickoffs();
  startKickoffPolling();
});

onUnmounted(stopKickoffPolling);

watch(() => [props.visible, props.channelId, props.channelType], refresh);

watch(subTab, (next) => {
  if (next === 'kanban') void refreshKanban();
});

watch(boundThreadId, () => {
  if (boundThreadId.value) void clowderStore.loadWorkspaceBinding(boundThreadId.value);
  if (subTab.value === 'kanban') void refreshKanban();
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
        <div class="section-label">Thread</div>
        <div class="thread-id">{{ boundThreadId || 'Not bound' }}</div>
        <div v-if="statusReason" class="error-text">error: {{ statusReason }}</div>
        <div v-if="conversation?.lastDelivery" class="muted">
          Delivery: {{ conversation.lastDelivery.state }}
        </div>
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
        :active-workspace="activeWorkspace"
      />
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
</style>
