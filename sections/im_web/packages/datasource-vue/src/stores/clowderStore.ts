import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  clowderApi,
  type ClowderAgent,
  type ClowderAgentDirectoryResponse,
  type ClowderConversationRef,
  type ClowderConversationStateResponse,
  type ClowderConnectionStatus,
  type IMConnectorPermission
} from '../api/clowder';

function conversationKey(channelId: string, channelType: number) {
  return `${String(channelId)}-${Number(channelType)}`;
}

function defaultStatus(): ClowderConnectionStatus {
  return {
    enabled: false,
    configured: false,
    reachable: false,
    state: 'disabled'
  };
}

function disabledReasonFromPermission(permission?: IMConnectorPermission) {
  if (!permission) return undefined;
  if (permission.allowed === false) return 'group_not_allowed';
  if (permission.adminOnlyCommands) return 'admin_only_commands';
  return undefined;
}

function disabledReasonFromDelivery(state?: string) {
  if (state === 'media_download_failed') return 'media_download_failed';
  if (state === 'queue_full' || state === 'full') return 'agent_queue_full';
  if (state === 'timeout') return 'clowder_timeout';
  if (state === 'unavailable') return 'clowder_unavailable';
  return undefined;
}

function normalizeConversationState(state: ClowderConversationStateResponse): ClowderConversationStateResponse {
  return {
    ...state,
    disabledReason: state.disabledReason ||
      disabledReasonFromDelivery(state.lastDelivery?.state) ||
      disabledReasonFromPermission(state.permission)
  };
}

interface ClowderAgentDirectoryRuntimeState {
  agents: ClowderAgent[];
  available: ClowderAgent[];
  unavailable: ClowderAgent[];
  preferred: ClowderAgent[];
  lastActive?: ClowderAgent;
}

function normalizeAgentDirectory(response: ClowderAgentDirectoryResponse): ClowderAgentDirectoryRuntimeState {
  const agents = response.agents || [];
  const preferredIds = new Set(response.preferredCatIds || agents.filter(agent => agent.preferred).map(agent => agent.catId));
  return {
    agents,
    available: agents.filter(agent => agent.available),
    unavailable: agents.filter(agent => !agent.available),
    preferred: agents.filter(agent => preferredIds.has(agent.catId)),
    lastActive: agents.find(agent => agent.catId === response.lastActiveCatId) || agents
      .filter(agent => agent.lastActiveAt)
      .sort((a, b) => Number(b.lastActiveAt || 0) - Number(a.lastActiveAt || 0))[0]
  };
}

export const useClowderStore = defineStore('clowder', () => {
  const status = ref<ClowderConnectionStatus>(defaultStatus());
  const conversations = ref<Record<string, ClowderConversationStateResponse>>({});
  const agentDirectories = ref<Record<string, ClowderAgentDirectoryRuntimeState>>({});
  const loading = ref(false);
  const error = ref<string | undefined>();

  const isReady = computed(() => status.value.enabled && status.value.configured && status.value.reachable);

  async function refreshStatus() {
    loading.value = true;
    error.value = undefined;
    try {
      status.value = await clowderApi.getStatus() as unknown as ClowderConnectionStatus;
      return status.value;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clowder unavailable';
      status.value = {
        ...status.value,
        reachable: false,
        state: 'error',
        lastError: error.value
      };
      return status.value;
    } finally {
      loading.value = false;
    }
  }

  async function loadConversation(refInput: ClowderConversationRef) {
    loading.value = true;
    error.value = undefined;
    try {
      const next = normalizeConversationState(await clowderApi.getConversationState(refInput) as unknown as ClowderConversationStateResponse);
      conversations.value[conversationKey(refInput.channelId, refInput.channelType)] = next;
      status.value = next.status;
      return next;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clowder conversation unavailable';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function bindConversation(refInput: ClowderConversationRef & { threadId?: string; title?: string }) {
    loading.value = true;
    error.value = undefined;
    try {
      const binding = await clowderApi.bindConversation(refInput) as unknown as NonNullable<ClowderConversationStateResponse['binding']>;
      const key = conversationKey(refInput.channelId, refInput.channelType);
      const current = conversations.value[key];
      conversations.value[key] = normalizeConversationState({
        status: current?.status || status.value,
        binding,
        agents: current?.agents || [],
        permission: current?.permission,
        focusCatId: current?.focusCatId,
        lastDelivery: current?.lastDelivery,
        disabledReason: current?.disabledReason
      } as ClowderConversationStateResponse);
      return binding;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clowder thread binding failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function getConversation(channelId: string, channelType: number) {
    return conversations.value[conversationKey(channelId, channelType)];
  }

  async function loadAgentDirectory(refInput: ClowderConversationRef) {
    loading.value = true;
    error.value = undefined;
    try {
      const directory = normalizeAgentDirectory(await clowderApi.getAgentDirectory(refInput) as unknown as ClowderAgentDirectoryResponse);
      const key = conversationKey(refInput.channelId, refInput.channelType);
      agentDirectories.value[key] = directory;
      const current = conversations.value[key];
      conversations.value[key] = normalizeConversationState({
        status: current?.status || status.value,
        binding: current?.binding,
        agents: directory.agents,
        permission: current?.permission,
        focusCatId: current?.focusCatId,
        lastDelivery: current?.lastDelivery,
        disabledReason: current?.disabledReason
      });
      return directory;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clowder agent directory unavailable';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function applyConversationState(refInput: ClowderConversationRef, state: ClowderConversationStateResponse) {
    const key = conversationKey(refInput.channelId, refInput.channelType);
    const next = normalizeConversationState(state);
    conversations.value[key] = next;
    status.value = next.status;
    agentDirectories.value[key] = normalizeAgentDirectory({
      agents: next.agents || [],
      preferredCatIds: next.focusCatId ? [next.focusCatId] : undefined,
      lastActiveCatId: next.focusCatId
    });
    return next;
  }

  function applyPermission(refInput: ClowderConversationRef, permission: IMConnectorPermission) {
    const key = conversationKey(refInput.channelId, refInput.channelType);
    const current = conversations.value[key];
    conversations.value[key] = normalizeConversationState({
      status: current?.status || status.value,
      binding: current?.binding,
      agents: current?.agents || [],
      permission,
      focusCatId: current?.focusCatId,
      lastDelivery: current?.lastDelivery
    });
    return conversations.value[key].permission;
  }

  async function allowGroup(refInput: ClowderConversationRef) {
    loading.value = true;
    error.value = undefined;
    try {
      const permission = await clowderApi.allowGroup(refInput) as unknown as IMConnectorPermission;
      return applyPermission(refInput, permission);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clowder group authorization failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function denyGroup(refInput: ClowderConversationRef) {
    loading.value = true;
    error.value = undefined;
    try {
      const permission = await clowderApi.denyGroup(refInput) as unknown as IMConnectorPermission;
      return applyPermission(refInput, permission);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clowder group authorization failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function setFocus(refInput: ClowderConversationRef, catId: string) {
    loading.value = true;
    error.value = undefined;
    try {
      return applyConversationState(
        refInput,
        await clowderApi.setFocus({ ...refInput, catId }) as unknown as ClowderConversationStateResponse
      );
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clowder focus update failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function clearFocus(refInput: ClowderConversationRef) {
    loading.value = true;
    error.value = undefined;
    try {
      return applyConversationState(
        refInput,
        await clowderApi.clearFocus(refInput) as unknown as ClowderConversationStateResponse
      );
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clowder focus update failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function sendConversationMessage(refInput: ClowderConversationRef, text: string) {
    return clowderApi.sendConversationMessage({ ...refInput, text });
  }

  function reset() {
    status.value = defaultStatus();
    conversations.value = {};
    agentDirectories.value = {};
    loading.value = false;
    error.value = undefined;
  }

  return {
    status,
    conversations,
    agentDirectories,
    loading,
    error,
    isReady,
    refreshStatus,
    loadConversation,
    bindConversation,
    loadAgentDirectory,
    getConversation,
    allowGroup,
    denyGroup,
    setFocus,
    clearFocus,
    sendConversationMessage,
    reset
  };
});
