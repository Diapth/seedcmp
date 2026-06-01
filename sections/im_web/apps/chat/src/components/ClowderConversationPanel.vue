<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useClowderStore } from '@tsdaodao/datasource-vue';
import type { ClowderChannelType } from '@tsdaodao/datasource-vue';

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
const stateTokens = 'ready disabled denied loading error';
const conversationRef = computed(() => ({
  channelId: props.channelId,
  channelType: props.channelType as ClowderChannelType
}));

const conversation = computed(() => clowderStore.getConversation(props.channelId, props.channelType));
const directory = computed(() => clowderStore.agentDirectories[`${props.channelId}-${props.channelType}`]);
const groupAgents = computed(() => props.channelType === 2 ? clowderStore.groupCatMemberships[props.channelId] || [] : []);
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
  return rawStatus.reason || rawStatus.lastError || rawStatus.error || rawStatus.message ||
    (rawStatus.state === 'error' ? 'clowder_unavailable' : '');
});
const agents = computed(() => directory.value?.agents || conversation.value?.agents || groupAgents.value);
const currentFocus = computed(() => conversation.value?.focusCatId);

async function refresh() {
  if (!props.visible || !props.channelId) return;
  const health = await clowderStore.refreshStatus().catch(() => clowderStore.status);
  if (health.state === 'error' || health.reachable === false) return;
  await clowderStore.loadConversation(conversationRef.value).catch(() => undefined);
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

onMounted(refresh);

watch(() => [props.visible, props.channelId, props.channelType], refresh);
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

    <div class="panel-body">
      <section class="panel-section">
        <div class="section-label">Thread</div>
        <div class="thread-id">{{ conversation?.binding?.threadId || 'Not bound' }}</div>
        <div v-if="statusReason" class="error-text">error: {{ statusReason }}</div>
        <div v-if="conversation?.lastDelivery" class="muted">Delivery: {{ conversation.lastDelivery.state }}</div>
      </section>

      <section class="panel-section">
        <div class="section-label">Focus</div>
        <div class="focus-row">
          <span>{{ currentFocus || 'Default routing' }}</span>
          <button type="button" :disabled="!currentFocus || clowderStore.loading" @click="handleClearFocus">Clear</button>
        </div>
      </section>

      <section class="panel-section">
        <div class="section-label">Agents</div>
        <div v-if="clowderStore.loading && agents.length === 0" class="muted">loading</div>
        <div v-else-if="clowderStore.error && agents.length === 0" class="error-text">error: {{ clowderStore.error }}</div>
        <div v-else-if="disabledReason && agents.length === 0" class="muted">disabled: {{ disabledReason }}</div>
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
        <div v-if="clowderStore.error && agents.length > 0" class="muted">directory fallback: {{ clowderStore.error }}</div>
      </section>
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

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
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
.focus-row {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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
