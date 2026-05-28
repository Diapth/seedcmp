import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  clowderApi,
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

function normalizeConversationState(state: ClowderConversationStateResponse): ClowderConversationStateResponse {
  return {
    ...state,
    disabledReason: state.disabledReason || disabledReasonFromPermission(state.permission)
  };
}

export const useClowderStore = defineStore('clowder', () => {
  const status = ref<ClowderConnectionStatus>(defaultStatus());
  const conversations = ref<Record<string, ClowderConversationStateResponse>>({});
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

  function getConversation(channelId: string, channelType: number) {
    return conversations.value[conversationKey(channelId, channelType)];
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

  function reset() {
    status.value = defaultStatus();
    conversations.value = {};
    loading.value = false;
    error.value = undefined;
  }

  return {
    status,
    conversations,
    loading,
    error,
    isReady,
    refreshStatus,
    loadConversation,
    getConversation,
    allowGroup,
    denyGroup,
    reset
  };
});
