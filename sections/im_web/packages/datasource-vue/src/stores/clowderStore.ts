import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { apiClient } from '@tsdaodao/base-vue';
import {
  getClowderCatDisplayNameFromPayload,
  isClowderPayload,
  stripClowderCatDecorations
} from '@tsdaodao/base-vue/utils/clowderMessageIdentity';
import { syncApi } from '../api';
import {
  clowderApi,
  type ClowderAgent,
  type ClowderAgentDirectoryResponse,
  type ClowderCatContactResponse,
  type ClowderCatDirectoryResponse,
  type ClowderClientDefaultModels,
  type ClowderCatRoleTemplate,
  type ClowderCreateCatRequest,
  type ClowderDeleteCatResponse,
  type ClowderLocalOAuthCapabilitiesResponse,
  type ClowderLocalOAuthConfigSummary,
  type ClowderLocalOAuthProvider,
  type ClowderPlatformModelOption,
  type ClowderConversationRef,
  type ClowderConversationStateResponse,
  type ClowderConnectionStatus,
  type ClowderCoordination,
  type ClowderCreateCoordinationRequest,
  type ClowderCreateDeploymentRequest,
  type ClowderDeploymentActionRequest,
  type ClowderDeploymentActionResponse,
  type ClowderDeploymentRequest,
  type ClowderUpdateCoordinationRequest,
  type ClowderUpdateDeploymentRequest,
  type ClowderGroupAutoReplyMode,
  type ClowderGroupCatStateResponse,
  type ClowderEnsureProjectGroupRequest,
  type ClowderMaomiWorkspace,
  type ClowderProjectGroupBinding,
  type ClowderThreadTask,
  type ClowderThreadTaskDiagnostics,
  type ClowderThreadTasksRequestOptions,
  type ClowderThreadTasksResponse,
  type ClowderWorkspaceBindingResponse,
  type ClowderWorkspaceProposal,
  type ClowderWorkspaceRootResponse,
  type IMConnectorPermission
} from '../api/clowder';
import {
  buildClowderGroupPrompt,
  isClowderCatContactId,
  toClowderCatContact,
  type ClowderCatContact,
  type ClowderGroupPromptInput
} from './clowderCatContacts';
import type { CoordinatorKickoff } from './clowderTypes';

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

export type ThreadTaskLoadState =
  | { state: 'not_bound' }
  | { state: 'loading'; threadId: string; tasks: ClowderThreadTask[]; diagnostics?: ClowderThreadTaskDiagnostics; lastRefreshAt?: number }
  | { state: 'success'; threadId: string; tasks: ClowderThreadTask[]; diagnostics?: ClowderThreadTaskDiagnostics; lastRefreshAt: number }
  | { state: 'success_empty'; threadId: string; tasks: ClowderThreadTask[]; diagnostics?: ClowderThreadTaskDiagnostics; lastRefreshAt: number }
  | { state: 'route_failed'; threadId: string; tasks: ClowderThreadTask[]; status?: number; error: string; lastRefreshAt?: number }
  | {
      state: 'thread_binding_mismatch';
      threadId: string;
      tasks: ClowderThreadTask[];
      expectedTaskId?: string;
      actualThreadId?: string;
      diagnostics: ClowderThreadTaskDiagnostics;
      lastRefreshAt: number;
    };

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

function normalizeHistoryPayload(raw: any) {
  const payload = raw?.payload ?? raw?.content ?? raw?.contentObj;
  if (payload === undefined || payload === null) return undefined;
  if (typeof payload !== 'string') return payload;
  try {
    return JSON.parse(payload);
  } catch {
    return { type: 1, text: payload };
  }
}

function normalizeLookupToken(value: string) {
  return stripClowderCatDecorations(value)
    .replace(/^@/, '')
    .trim()
    .toLocaleLowerCase();
}

function contactMatchesDisplayName(contact: ClowderCatContact, displayName: string) {
  const needle = normalizeLookupToken(displayName);
  if (!needle) return false;
  const tokens = [
    contact.catId,
    contact.displayName,
    contact.name,
    ...contact.aliases,
    ...contact.mentionNames
  ].map(normalizeLookupToken);
  return tokens.includes(needle);
}

function buildStaleHistoryContact(displayName: string) {
  const normalized = normalizeLookupToken(displayName) || 'history-cat';
  const catId = normalized.replace(/[^a-z0-9_-]+/gi, '-') || 'history-cat';
  return toClowderCatContact({
    catId,
    displayName,
    aliases: [`@${displayName}`],
    mentionPatterns: [`@${displayName}`],
    available: false,
    availabilityState: 'stale',
    source: 'stale',
    connected: true
  }, {
    connected: true,
    source: 'stale',
    availabilityState: 'stale',
    available: false
  });
}

function uniqueNonEmptyStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values
    .map(value => String(value || '').trim())
    .filter(Boolean)));
}

function mergeClowderCatContacts(existing: ClowderCatContact[], additions: ClowderCatContact[]) {
  const next = [...existing];
  for (const contact of additions) {
    const index = next.findIndex(item => item.catId === contact.catId);
    if (index === -1) {
      next.push(contact);
      continue;
    }
    const current = next[index];
    next[index] = {
      ...current,
      ...contact,
      aliases: uniqueNonEmptyStrings([...current.aliases, ...contact.aliases]),
      mentionNames: uniqueNonEmptyStrings([...current.mentionNames, ...contact.mentionNames]),
      connected: current.connected || contact.connected
    };
  }
  return next;
}

function normalizeGroupAutoReplyMode(mode?: string, proactiveReplies?: boolean): ClowderGroupAutoReplyMode {
  if (mode === 'off' || mode === 'mentions_only' || mode === 'soft_mentions') return mode;
  return proactiveReplies === false ? 'mentions_only' : 'soft_mentions';
}

function normalizeThreadTasksResponse(threadId: string, response: ClowderThreadTasksResponse): ClowderThreadTasksResponse {
  const tasks = Array.isArray(response?.tasks) ? response.tasks : [];
  return {
    ...response,
    threadId: response?.threadId || threadId,
    tasks,
    diagnostics: response?.diagnostics || {
      state: tasks.length > 0 ? 'ok' : 'success_empty',
      taskCount: tasks.length,
      queryThreadId: response?.threadId || threadId,
      activeWorkspaceId: undefined,
      observedTaskIds: [],
      missingTaskIds: [],
      mismatchedTasks: [],
      workspaceMismatchedTaskIds: []
    }
  };
}

function taskErrorMessage(err: unknown) {
  const shaped = err as { msg?: string; message?: string; error?: { message?: string; msg?: string }; status?: number };
  return shaped?.msg || shaped?.message || shaped?.error?.message || shaped?.error?.msg || '加载任务失败';
}

function taskErrorStatus(err: unknown) {
  const shaped = err as { status?: number; error?: { response?: { status?: number } }; response?: { status?: number } };
  return shaped?.status || shaped?.response?.status || shaped?.error?.response?.status;
}

const AGENT_DIRECTORY_CACHE_MS = 5_000;
const CAT_DIRECTORY_CACHE_MS = 10_000;
const ACTIVE_DEPLOYMENT_CACHE_MS = 5_000;
const MISSING_ACTIVE_DEPLOYMENT_CACHE_MS = 15_000;

function isFresh(cache: Map<string, number>, key: string, ttlMs: number) {
  const loadedAt = cache.get(key);
  return loadedAt !== undefined && Date.now() - loadedAt < ttlMs;
}

function catDirectoryRequestKey(params?: { query?: string; includeUnavailable?: boolean }) {
  const query = String(params?.query || '').trim();
  return JSON.stringify({
    query,
    includeUnavailable: params?.includeUnavailable === true
  });
}

export const useClowderStore = defineStore('clowder', () => {
  const status = ref<ClowderConnectionStatus>(defaultStatus());
  const conversations = ref<Record<string, ClowderConversationStateResponse>>({});
  const agentDirectories = ref<Record<string, ClowderAgentDirectoryRuntimeState>>({});
  const catContactDirectory = ref<ClowderCatContact[]>([]);
  const catRoleTemplates = ref<ClowderCatRoleTemplate[]>([]);
  const platformModelOptions = ref<Record<string, ClowderPlatformModelOption[]>>({});
  const localOAuthCapabilities = ref<Partial<Record<ClowderLocalOAuthProvider, ClowderLocalOAuthConfigSummary>>>({});
  const localOAuthLoading = ref(false);
  const localOAuthError = ref<string | undefined>();
  const connectedCatContacts = ref<ClowderCatContact[]>([]);
  const groupCatMemberships = ref<Record<string, ClowderCatContact[]>>({});
  const groupPrompts = ref<Record<string, string>>({});
  const groupAutoReplyModes = ref<Record<string, ClowderGroupAutoReplyMode>>({});
  const projectGroupBindings = ref<Record<string, ClowderProjectGroupBinding>>({});
  const threadTaskStates = ref<Record<string, ThreadTaskLoadState>>({});
  const workspaceRoot = ref<ClowderWorkspaceRootResponse | undefined>();
  const workspaces = ref<ClowderMaomiWorkspace[]>([]);
  const workspaceBindings = ref<Record<string, ClowderWorkspaceBindingResponse>>({});
  const workspaceLoading = ref(false);
  const workspaceError = ref<string | undefined>();
  const deploymentRequests = ref<Record<string, ClowderDeploymentRequest>>({});
  const coordinations = ref<Record<string, ClowderCoordination>>({});
  const threadCoordinationIds = ref<Record<string, string[]>>({});
  // Phase 2.2: coordinator project group chat kickoff records (one per coordinationId).
  // Surfaced as a "Create Project Group Chat?" card in ClowderConversationPanel.
  const kickoffs = ref<Record<string, CoordinatorKickoff>>({});
  const loading = ref(false);
  const error = ref<string | undefined>();
  const agentDirectoryRequests = new Map<string, Promise<ClowderAgentDirectoryRuntimeState>>();
  const agentDirectoryLoadedAt = new Map<string, number>();
  const catDirectoryRequests = new Map<string, Promise<ClowderCatContact[]>>();
  const catDirectoryLoadedAt = new Map<string, number>();
  const activeDeploymentRequests = new Map<string, Promise<ClowderDeploymentRequest | null>>();
  const activeDeploymentLoadedAt = new Map<string, number>();
  const missingActiveDeploymentUntil = new Map<string, number>();

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

  function previousTasksForThread(threadId: string): ClowderThreadTask[] {
    const current = threadTaskStates.value[threadId];
    return current && 'tasks' in current ? current.tasks : [];
  }

  function getThreadTasksState(threadId?: string | null): ThreadTaskLoadState {
    const trimmed = String(threadId || '').trim();
    if (!trimmed) return { state: 'not_bound' };
    return threadTaskStates.value[trimmed] || { state: 'loading', threadId: trimmed, tasks: [] };
  }

  function getWorkspaceBinding(threadId?: string | null) {
    const trimmed = String(threadId || '').trim();
    return trimmed ? workspaceBindings.value[trimmed] : undefined;
  }

  function getActiveWorkspace(threadId?: string | null) {
    return getWorkspaceBinding(threadId)?.activeWorkspace || undefined;
  }

  function projectGroupBindingKey(input: {
    userId?: string | null;
    pmDirectChannelId: string;
    pmDirectChannelType: number;
    projectName: string;
  }) {
    return [
      String(input.userId || '').trim(),
      conversationKey(input.pmDirectChannelId, input.pmDirectChannelType),
      String(input.projectName || '').trim().toLocaleLowerCase()
    ].join('|');
  }

  function setProjectGroupBinding(binding: ClowderProjectGroupBinding) {
    const key = projectGroupBindingKey({
      userId: binding.userId,
      pmDirectChannelId: binding.pmDirectChannelId,
      pmDirectChannelType: binding.pmDirectChannelType,
      projectName: binding.projectName
    });
    projectGroupBindings.value = {
      ...projectGroupBindings.value,
      [key]: binding
    };
    return binding;
  }

  function getProjectGroupBinding(input: {
    userId?: string | null;
    pmDirectChannelId: string;
    pmDirectChannelType: number;
    projectName: string;
  }) {
    return projectGroupBindings.value[projectGroupBindingKey(input)];
  }

  async function ensureProjectGroup(input: ClowderEnsureProjectGroupRequest) {
    loading.value = true;
    error.value = undefined;
    try {
      const response = await clowderApi.ensureProjectGroup(input);
      if (response.binding) {
        setProjectGroupBinding(response.binding);
      }
      return response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clowder project group create failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function loadWorkspaceRoot() {
    workspaceLoading.value = true;
    workspaceError.value = undefined;
    try {
      workspaceRoot.value = await clowderApi.getWorkspaceRoot();
      return workspaceRoot.value;
    } catch (err) {
      workspaceError.value = err instanceof Error ? err.message : 'Maomi workspace root unavailable';
      throw err;
    } finally {
      workspaceLoading.value = false;
    }
  }

  async function loadWorkspaces() {
    workspaceLoading.value = true;
    workspaceError.value = undefined;
    try {
      const response = await clowderApi.listWorkspaces({ status: 'active' });
      workspaces.value = response.workspaces || [];
      return workspaces.value;
    } catch (err) {
      workspaceError.value = err instanceof Error ? err.message : 'Maomi workspaces unavailable';
      throw err;
    } finally {
      workspaceLoading.value = false;
    }
  }

  async function loadWorkspaceBinding(threadId: string) {
    const trimmed = String(threadId || '').trim();
    if (!trimmed) return undefined;
    workspaceLoading.value = true;
    workspaceError.value = undefined;
    try {
      const binding = await clowderApi.getWorkspaceBinding(trimmed);
      workspaceBindings.value = { ...workspaceBindings.value, [trimmed]: binding };
      return binding;
    } catch (err) {
      workspaceError.value = err instanceof Error ? err.message : 'Maomi workspace binding unavailable';
      throw err;
    } finally {
      workspaceLoading.value = false;
    }
  }

  async function proposeWorkspace(input: { intentText: string; threadId?: string }): Promise<ClowderWorkspaceProposal> {
    const response = await clowderApi.proposeWorkspace(input);
    return response.proposal;
  }

  async function createWorkspace(input: {
    slug: string;
    displayName: string;
    sourceIntent?: string;
    createdBy?: 'user' | 'coordinator' | 'cat' | 'system';
    threadId?: string;
  }) {
    workspaceLoading.value = true;
    workspaceError.value = undefined;
    try {
      const response = await clowderApi.createWorkspace(input);
      const workspace = response.workspace;
      workspaces.value = [
        workspace,
        ...workspaces.value.filter(item => item.workspaceId !== workspace.workspaceId && item.id !== workspace.id)
      ];
      if (input.threadId) {
        await loadWorkspaceBinding(input.threadId);
      }
      return workspace;
    } catch (err) {
      workspaceError.value = err instanceof Error ? err.message : 'Maomi workspace create failed';
      throw err;
    } finally {
      workspaceLoading.value = false;
    }
  }

  async function setWorkspaceBinding(threadId: string, workspaceId: string | null) {
    const trimmed = String(threadId || '').trim();
    if (!trimmed) throw new Error('threadId is required');
    workspaceLoading.value = true;
    workspaceError.value = undefined;
    try {
      const binding = await clowderApi.setWorkspaceBinding(trimmed, { workspaceId });
      workspaceBindings.value = { ...workspaceBindings.value, [trimmed]: binding };
      return binding;
    } catch (err) {
      workspaceError.value = err instanceof Error ? err.message : 'Maomi workspace binding failed';
      throw err;
    } finally {
      workspaceLoading.value = false;
    }
  }

  async function fetchThreadTasks(
    threadId: string,
    options: ClowderThreadTasksRequestOptions = {}
  ): Promise<ThreadTaskLoadState> {
    const trimmed = String(threadId || '').trim();
    if (!trimmed) return { state: 'not_bound' };

    const previous = previousTasksForThread(trimmed);
    const current = threadTaskStates.value[trimmed];
    threadTaskStates.value[trimmed] = {
      state: 'loading',
      threadId: trimmed,
      tasks: previous,
      diagnostics: current && 'diagnostics' in current
        ? current.diagnostics
        : undefined,
      lastRefreshAt: current && 'lastRefreshAt' in current
        ? current.lastRefreshAt
        : undefined
    };

    try {
      const response = normalizeThreadTasksResponse(trimmed, await clowderApi.getThreadTasks(trimmed, options));
      const now = Date.now();
      const diagnostics = response.diagnostics;
      let next: ThreadTaskLoadState;
      if (diagnostics?.state === 'thread_binding_mismatch') {
        const mismatch = diagnostics.mismatchedTasks[0];
        next = {
          state: 'thread_binding_mismatch',
          threadId: response.threadId,
          tasks: response.tasks,
          expectedTaskId: mismatch?.taskId || options.expectedTaskId || options.observedTaskIds?.[0],
          actualThreadId: mismatch?.actualThreadId,
          diagnostics,
          lastRefreshAt: now
        };
      } else if (response.tasks.length === 0) {
        next = {
          state: 'success_empty',
          threadId: response.threadId,
          tasks: [],
          diagnostics,
          lastRefreshAt: now
        };
      } else {
        next = {
          state: 'success',
          threadId: response.threadId,
          tasks: response.tasks,
          diagnostics,
          lastRefreshAt: now
        };
      }
      threadTaskStates.value[trimmed] = next;
      return next;
    } catch (err) {
      const next: ThreadTaskLoadState = {
        state: 'route_failed',
        threadId: trimmed,
        tasks: previous,
        status: taskErrorStatus(err),
        error: taskErrorMessage(err),
        lastRefreshAt: Date.now()
      };
      threadTaskStates.value[trimmed] = next;
      return next;
    }
  }

  async function loadAgentDirectory(refInput: ClowderConversationRef) {
    const key = conversationKey(refInput.channelId, refInput.channelType);
    const cached = agentDirectories.value[key];
    if (cached && isFresh(agentDirectoryLoadedAt, key, AGENT_DIRECTORY_CACHE_MS)) {
      return cached;
    }
    const existingRequest = agentDirectoryRequests.get(key);
    if (existingRequest) return existingRequest;

    loading.value = true;
    error.value = undefined;
    const request = (async () => {
      const directory = normalizeAgentDirectory(await clowderApi.getAgentDirectory(refInput) as unknown as ClowderAgentDirectoryResponse);
      agentDirectories.value[key] = directory;
      agentDirectoryLoadedAt.set(key, Date.now());
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
    })();
    agentDirectoryRequests.set(key, request);
    try {
      return await request;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clowder agent directory unavailable';
      throw err;
    } finally {
      if (agentDirectoryRequests.get(key) === request) {
        agentDirectoryRequests.delete(key);
      }
      loading.value = false;
    }
  }

  function normalizeCatDirectory(response?: ClowderCatDirectoryResponse) {
    return (response?.agents || []).map(agent => toClowderCatContact(agent, {
      connected: agent.connected === true
    }));
  }

  const fallbackClientDefaults: Record<string, ClowderClientDefaultModels> = {
    openai: {
      defaultModel: 'gpt-5.4',
      models: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex']
    },
    codex: {
      defaultModel: 'gpt-5.4',
      models: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex']
    },
    anthropic: {
      defaultModel: 'claude-sonnet-4-6',
      models: ['claude-sonnet-4-6', 'claude-opus-4-6']
    },
    claude: {
      defaultModel: 'claude-sonnet-4-6',
      models: ['claude-sonnet-4-6', 'claude-opus-4-6']
    }
  };

  function templateLogicalTokens(template: ClowderCatRoleTemplate) {
    return [
      template.logicalKey,
      template.roleTemplateId,
      template.catId,
      ...(template.aliases || []),
      ...(template.mentionPatterns || [])
    ].map(value => normalizeLookupToken(String(value || ''))).filter(Boolean);
  }

  function templateLogicalKey(template: ClowderCatRoleTemplate) {
    const explicit = String(template.logicalKey || template.roleTemplateId || '').trim();
    if (explicit) return normalizeLookupToken(explicit);
    const catId = String(template.catId || '').trim();
    if (catId) return `cat:${normalizeLookupToken(catId)}`;
    const platform = String((template as any).clientId || (template as any).platform || '').trim();
    if (platform && template.displayName) {
      return `${normalizeLookupToken(platform)}:${normalizeLookupToken(template.displayName)}`;
    }
    return normalizeLookupToken(template.displayName);
  }

  function uniqueTemplates(templates: ClowderCatRoleTemplate[]) {
    const seen = new Set<string>();
    const next: ClowderCatRoleTemplate[] = [];
    for (const template of templates) {
      const key = templateLogicalKey(template);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      for (const token of templateLogicalTokens(template)) {
        seen.add(token);
      }
      next.push(template);
    }
    return next;
  }

  function roleTemplateFromAgent(agent: ClowderAgent): ClowderCatRoleTemplate {
    return {
      roleTemplateId: String(agent.catId),
      catId: String(agent.catId),
      logicalKey: String(agent.catId),
      displayName: String(agent.displayName || agent.catId),
      aliases: agent.aliases || [],
      mentionPatterns: agent.mentionPatterns || [],
      avatar: agent.avatar || '',
      personalitySummary: agent.personalitySummary || '',
      capabilitySummary: agent.capabilitySummary || '',
      cloneable: agent.available !== false,
      unavailableReason: agent.available === false ? agent.availabilityState || 'unavailable' : undefined,
      source: agent.source || 'role-template'
    };
  }

  function normalizeRoleTemplates(response?: ClowderCatDirectoryResponse, directory: ClowderCatContact[] = []) {
    const explicitTemplates = (response?.templates || []).map(template => ({
      ...template,
      roleTemplateId: String(template.roleTemplateId || template.catId),
      catId: String(template.catId || template.roleTemplateId),
      logicalKey: String(template.logicalKey || template.roleTemplateId || template.catId),
      displayName: String(template.displayName || template.catId || template.roleTemplateId),
      aliases: template.aliases || [],
      mentionPatterns: template.mentionPatterns || template.aliases || [],
      cloneable: template.cloneable !== false,
      source: template.source || 'role-template'
    }));
    // 如果 API 已返回 roleTemplates，不再混入 breeds 的 legacy candidates
    if (explicitTemplates.length > 0) {
      return uniqueTemplates(explicitTemplates);
    }
    const legacyTemplateCandidates = directory
      .filter(cat => cat.source === 'disconnected')
      .map(cat => ({
        roleTemplateId: cat.catId,
        catId: cat.catId,
        logicalKey: cat.catId,
        displayName: cat.displayName,
        aliases: cat.aliases,
        mentionPatterns: cat.mentionNames,
        avatar: cat.avatar,
        personalitySummary: cat.personalitySummary,
        capabilitySummary: cat.capabilitySummary,
        cloneable: cat.available !== false,
        unavailableReason: cat.available === false ? cat.availabilityState : undefined,
        source: cat.source
      } satisfies ClowderCatRoleTemplate));
    return uniqueTemplates([...explicitTemplates, ...legacyTemplateCandidates]);
  }

  function normalizePlatformKey(value: string) {
    const normalized = String(value || '').trim().toLowerCase().replace(/_/g, '-');
    if (normalized === 'codex') return 'openai';
    if (normalized === 'claude' || normalized === 'claude-code') return 'anthropic';
    return normalized;
  }

  function normalizePlatformModelOptions(defaults?: Record<string, ClowderClientDefaultModels>) {
    const merged = { ...fallbackClientDefaults, ...(defaults || {}) };
    const result: Record<string, ClowderPlatformModelOption[]> = {};
    for (const [rawKey, entry] of Object.entries(merged)) {
      const key = normalizePlatformKey(rawKey);
      if (!key) continue;
      const defaultModel = String(entry?.defaultModel || fallbackClientDefaults[key]?.defaultModel || '').trim();
      const models = Array.from(new Set([
        defaultModel,
        ...(entry?.models || []),
        ...(fallbackClientDefaults[key]?.models || [])
      ].map(model => String(model || '').trim()).filter(Boolean)));
      if (!models.length) continue;
      result[key] = models.map(model => ({
        id: model,
        label: model,
        default: model === defaultModel
      }));
    }
    return result;
  }

  function applyCatDirectoryRefresh(directory: ClowderCatContact[]) {
    const directoryIds = new Set(directory.map(cat => cat.catId));
    const retainedConnectedContacts = connectedCatContacts.value.filter(cat =>
      directoryIds.has(cat.catId) || cat.source !== 'existing'
    );
    const connectedFromDirectory = directory.filter(cat => cat.connected);
    const nextConnected = mergeClowderCatContacts(retainedConnectedContacts, connectedFromDirectory);
    connectedCatContacts.value = nextConnected;
    catContactDirectory.value = mergeClowderCatContacts(directory, nextConnected);
    return catContactDirectory.value;
  }

  function upsertConnectedCatContact(contact: ClowderCatContact) {
    const idx = connectedCatContacts.value.findIndex(item => item.catId === contact.catId);
    const next = {
      ...contact,
      connected: true
    };
    if (idx >= 0) {
      connectedCatContacts.value[idx] = next;
    } else {
      connectedCatContacts.value.push(next);
    }
    const directoryIdx = catContactDirectory.value.findIndex(item => item.catId === contact.catId);
    if (directoryIdx >= 0) {
      catContactDirectory.value[directoryIdx] = next;
    } else {
      catContactDirectory.value = mergeClowderCatContacts(catContactDirectory.value, [next]);
    }
    return next;
  }

  function getCatContactById(contactIdOrCatId: string) {
    const catId = isClowderCatContactId(contactIdOrCatId)
      ? String(contactIdOrCatId).slice('clowder_cat:'.length)
      : String(contactIdOrCatId || '');
    return connectedCatContacts.value.find(item => item.catId === catId) ||
      catContactDirectory.value.find(item => item.catId === catId);
  }

  async function loadCatContactDirectory(params?: { query?: string; includeUnavailable?: boolean }) {
    const key = catDirectoryRequestKey(params);
    if (isFresh(catDirectoryLoadedAt, key, CAT_DIRECTORY_CACHE_MS)) {
      return catContactDirectory.value;
    }
    const existingRequest = catDirectoryRequests.get(key);
    if (existingRequest) return existingRequest;

    loading.value = true;
    error.value = undefined;
    const request = (async () => {
      const response = await clowderApi.getCatDirectory(params) as unknown as ClowderCatDirectoryResponse;
      const directory = normalizeCatDirectory(response);
      catRoleTemplates.value = normalizeRoleTemplates(response, directory);
      platformModelOptions.value = normalizePlatformModelOptions(response?.clientDefaults);
      catDirectoryLoadedAt.set(key, Date.now());
      return applyCatDirectoryRefresh(directory);
    })();
    catDirectoryRequests.set(key, request);
    try {
      return await request;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clowder cat directory unavailable';
      throw err;
    } finally {
      if (catDirectoryRequests.get(key) === request) {
        catDirectoryRequests.delete(key);
      }
      loading.value = false;
    }
  }

  async function loadLocalOAuthCapabilities() {
    localOAuthLoading.value = true;
    localOAuthError.value = undefined;
    try {
      const response = await clowderApi.getLocalAuthCapabilities() as unknown;
      const payload = ((response as { data?: ClowderLocalOAuthCapabilitiesResponse }).data || response) as ClowderLocalOAuthCapabilitiesResponse;
      const providers = Array.isArray(payload?.providers) ? payload.providers : [];
      const next: Partial<Record<ClowderLocalOAuthProvider, ClowderLocalOAuthConfigSummary>> = {};
      for (const provider of providers) {
        const key = provider.provider;
        if (key === 'codex' || key === 'claude') {
          next[key] = provider;
        }
      }
      localOAuthCapabilities.value = next;
      return next;
    } catch (err) {
      localOAuthError.value = err instanceof Error ? err.message : '本机 OAuth 配置检查失败';
      throw err;
    } finally {
      localOAuthLoading.value = false;
    }
  }

  function contactFromCatResponse(response: ClowderCatContactResponse) {
    return toClowderCatContact(response.agent, {
      connected: response.contact?.connected !== false,
      source: response.contact?.source || response.agent.source || 'existing'
    });
  }

  async function connectExistingCat(catId: string) {
    loading.value = true;
    error.value = undefined;
    try {
      const contact = contactFromCatResponse(await clowderApi.connectCatContact({ catId }) as unknown as ClowderCatContactResponse);
      return upsertConnectedCatContact(contact);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clowder cat connect failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createCatAndConnect(input: ClowderCreateCatRequest) {
    loading.value = true;
    error.value = undefined;
    try {
      const contact = contactFromCatResponse(await clowderApi.createCatAndConnect(input) as unknown as ClowderCatContactResponse);
      return upsertConnectedCatContact(contact);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clowder cat creation failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function catIdMatches(value: string | undefined | null, catId: string) {
    return normalizeLookupToken(String(value || '')) === normalizeLookupToken(catId);
  }

  function pruneDeletedCatFromLocalState(catId: string) {
    connectedCatContacts.value = connectedCatContacts.value.filter(cat => !catIdMatches(cat.catId, catId));
    catContactDirectory.value = catContactDirectory.value.filter(cat => !catIdMatches(cat.catId, catId));

    for (const [groupId, cats] of Object.entries(groupCatMemberships.value)) {
      const nextCats = cats.filter(cat => !catIdMatches(cat.catId, catId));
      if (nextCats.length === cats.length) continue;
      groupCatMemberships.value[groupId] = nextCats;
      if (nextCats.length > 0) {
        buildCurrentGroupPrompt(groupId, groupId, nextCats, groupAutoReplyModes.value[groupId] || 'soft_mentions');
      } else {
        delete groupPrompts.value[groupId];
      }
    }

    for (const [key, state] of Object.entries(conversations.value)) {
      const nextAgents = (state.agents || []).filter(agent => !catIdMatches(agent.catId, catId));
      const focusCatId = state.focusCatId && catIdMatches(state.focusCatId, catId) ? undefined : state.focusCatId;
      if (nextAgents.length === (state.agents || []).length && focusCatId === state.focusCatId) continue;
      conversations.value[key] = normalizeConversationState({
        ...state,
        agents: nextAgents,
        focusCatId
      });
    }

    for (const [key, directory] of Object.entries(agentDirectories.value)) {
      const nextAgents = directory.agents.filter(agent => !catIdMatches(agent.catId, catId));
      if (nextAgents.length === directory.agents.length) continue;
      agentDirectories.value[key] = normalizeAgentDirectory({
        agents: nextAgents
      });
    }
  }

  async function deleteCatContact(catId: string) {
    const trimmed = String(catId || '').trim();
    if (!trimmed) {
      throw new Error('Clowder cat id is required');
    }
    loading.value = true;
    error.value = undefined;
    try {
      const response = await clowderApi.deleteCatContact(trimmed) as unknown as ClowderDeleteCatResponse;
      pruneDeletedCatFromLocalState(trimmed);
      return response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clowder cat delete failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function syncMixedGroupCats(input: ClowderGroupPromptInput) {
    const prompt = buildClowderGroupPrompt(input);
    const autoReplyMode = normalizeGroupAutoReplyMode(undefined, input.rules?.proactiveReplies === true);
    groupAutoReplyModes.value[input.groupId] = autoReplyMode;
    const catMembers = input.catMembers.map(cat => 'id' in cat
      ? cat as ClowderCatContact
      : toClowderCatContact(cat));
    groupCatMemberships.value[input.groupId] = catMembers;
    groupPrompts.value[input.groupId] = prompt;
    await clowderApi.syncGroupCats({
      groupId: input.groupId,
      groupName: input.groupName,
      catIds: catMembers.map(cat => cat.catId),
      cats: catMembers.map(cat => ({
        catId: cat.catId,
        displayName: cat.displayName,
        aliases: cat.aliases,
        mentionPatterns: cat.mentionNames,
        avatar: cat.avatar,
        personalitySummary: cat.personalitySummary,
        capabilitySummary: cat.capabilitySummary,
        available: cat.available,
        availabilityState: cat.availabilityState,
        source: cat.source,
        connected: true
      })),
      proactiveReplies: input.rules?.proactiveReplies === true,
      autoReplyMode,
      prompt
    });
    return prompt;
  }

  function serializeGroupCatsForSync(cats: ClowderCatContact[]) {
    return cats.map(cat => ({
      catId: cat.catId,
      displayName: cat.displayName,
      aliases: cat.aliases,
      mentionPatterns: cat.mentionNames,
      avatar: cat.avatar,
      personalitySummary: cat.personalitySummary,
      capabilitySummary: cat.capabilitySummary,
      available: cat.available,
      availabilityState: cat.availabilityState,
      source: cat.source,
      connected: true
    }));
  }

  function buildCurrentGroupPrompt(
    groupId: string,
    groupName: string,
    cats: ClowderCatContact[],
    autoReplyMode: ClowderGroupAutoReplyMode = 'soft_mentions'
  ) {
    const prompt = buildClowderGroupPrompt({
      groupId,
      groupName,
      humanMembers: [],
      catMembers: cats,
      rules: {
        proactiveReplies: autoReplyMode === 'soft_mentions',
        privacy: 'Cats can see display names, roles, and mention handles only.'
      }
    });
    groupPrompts.value[groupId] = prompt;
    return prompt;
  }

  async function ensureCatDirectoryForHistoryLookup() {
    if (catContactDirectory.value.length > 0 || connectedCatContacts.value.length > 0) return;
    try {
      await loadCatContactDirectory({ includeUnavailable: true });
    } catch (e) {
      console.warn('[ClowderStore] Failed to load cat directory for group history recovery', e);
    }
  }

  async function inferGroupCatsFromMessageHistory(groupId: string) {
    let list: any[] = [];
    try {
      const res: any = await syncApi.syncMessages({
        channel_id: groupId,
        channel_type: 2,
        limit: 30,
        start_message_seq: 0,
        end_message_seq: 0,
        pull_mode: 1
      });
      list = Array.isArray(res?.messages) ? res.messages : [];
    } catch (e) {
      console.warn(`[ClowderStore] Failed to inspect group history for ${groupId}`, e);
      return [];
    }

    const displayNames = Array.from(new Set(list
      .map(normalizeHistoryPayload)
      .filter(isClowderPayload)
      .map(getClowderCatDisplayNameFromPayload)
      .map(name => String(name || '').trim())
      .filter(Boolean)));

    if (displayNames.length === 0) return [];

    await ensureCatDirectoryForHistoryLookup();

    const knownContacts = [
      ...connectedCatContacts.value,
      ...catContactDirectory.value
    ];
    const nextCats: ClowderCatContact[] = [];
    for (const displayName of displayNames) {
      const matched = knownContacts.find(contact => contactMatchesDisplayName(contact, displayName));
      const contact = matched
        ? { ...matched, connected: true }
        : buildStaleHistoryContact(displayName);
      if (!nextCats.some(cat => cat.catId === contact.catId)) {
        nextCats.push(contact);
      }
    }
    return nextCats;
  }

  async function persistRecoveredGroupCats(groupId: string, groupName: string, cats: ClowderCatContact[]) {
    if (cats.length === 0) return;
    const prompt = buildCurrentGroupPrompt(groupId, groupName || groupId, cats, 'soft_mentions');
    groupAutoReplyModes.value[groupId] = 'soft_mentions';
    try {
      await clowderApi.syncGroupCats({
        groupId,
        groupName: groupName || groupId,
        catIds: cats.map(cat => cat.catId),
        cats: serializeGroupCatsForSync(cats),
        proactiveReplies: true,
        autoReplyMode: 'soft_mentions',
        prompt
      });
    } catch (e) {
      console.warn(`[ClowderStore] Failed to persist recovered group cats for ${groupId}`, e);
    }
  }

  async function loadGroupCats(groupId: string) {
    const response = await clowderApi.getGroupCats({ groupId }) as unknown as ClowderGroupCatStateResponse;
    const autoReplyMode = normalizeGroupAutoReplyMode(response.autoReplyMode, response.proactiveReplies);
    groupAutoReplyModes.value[groupId] = autoReplyMode;
    let cats = (response.cats || []).map(agent => toClowderCatContact(agent, {
      connected: true
    }));
    let conversationDirectoryCats: ClowderCatContact[] = [];
    try {
      const directory = await clowderApi.getAgentDirectory({
        channelId: groupId,
        channelType: 2
      }) as unknown as ClowderAgentDirectoryResponse | undefined;
      conversationDirectoryCats = (directory?.agents || []).map(agent => toClowderCatContact(agent, {
        connected: true
      }));
    } catch (_err) {
      conversationDirectoryCats = [];
    }
    if (conversationDirectoryCats.length === 0) {
      try {
        const directory = await clowderApi.getCatDirectory({ includeUnavailable: true }) as unknown as ClowderCatDirectoryResponse | undefined;
        applyCatDirectoryRefresh((directory?.agents || []).map(agent => toClowderCatContact(agent, {
          connected: agent.connected === true
        })));
      } catch (_err) {
        // The history recovery path can still fall back to its own directory lookup.
      }
    }
    cats = mergeClowderCatContacts(cats, conversationDirectoryCats);
    if (cats.length === 0) {
      cats = await inferGroupCatsFromMessageHistory(groupId);
      if (cats.length > 0) {
        await persistRecoveredGroupCats(groupId, response.groupName || groupId, cats);
      }
    }
    groupCatMemberships.value[groupId] = cats;
    if (cats.length > 0) {
      buildCurrentGroupPrompt(groupId, response.groupName || groupId, cats, autoReplyMode);
    } else if (response.prompt) {
      groupPrompts.value[groupId] = response.prompt;
    }
    return cats;
  }

  async function addGroupCat(groupId: string, catId: string, groupName?: string) {
    const contact = getCatContactById(catId);
    if (!contact) {
      throw new Error('Clowder cat contact is not connected');
    }
    const current = groupCatMemberships.value[groupId] || [];
    const nextCats = current.some(cat => cat.catId === contact.catId)
      ? current
      : [...current, contact];
    groupCatMemberships.value[groupId] = nextCats;
    const nextPrompt = buildCurrentGroupPrompt(groupId, groupName || groupId, nextCats, 'soft_mentions');
    groupAutoReplyModes.value[groupId] = 'soft_mentions';
    await clowderApi.syncGroupCats({
      groupId,
      groupName: groupName || groupId,
      catIds: nextCats.map(cat => cat.catId),
      cats: serializeGroupCatsForSync(nextCats),
      proactiveReplies: true,
      autoReplyMode: 'soft_mentions',
      prompt: nextPrompt
    });
    return nextCats;
  }

  async function removeGroupCat(groupId: string, catId: string, groupName?: string) {
    const nextCats = (groupCatMemberships.value[groupId] || []).filter(cat => cat.catId !== catId);
    groupCatMemberships.value[groupId] = nextCats;
    const nextPrompt = buildCurrentGroupPrompt(groupId, groupName || groupId, nextCats, 'soft_mentions');
    groupAutoReplyModes.value[groupId] = 'soft_mentions';
    await clowderApi.syncGroupCats({
      groupId,
      groupName: groupName || groupId,
      catIds: nextCats.map(cat => cat.catId),
      cats: serializeGroupCatsForSync(nextCats),
      proactiveReplies: true,
      autoReplyMode: 'soft_mentions',
      prompt: nextPrompt
    });
    return nextCats;
  }

  async function setGroupAutoReplyMode(groupId: string, mode: ClowderGroupAutoReplyMode, groupName?: string) {
    const nextMode = normalizeGroupAutoReplyMode(mode);
    const hadPreviousMode = Object.prototype.hasOwnProperty.call(groupAutoReplyModes.value, groupId);
    const previousMode = groupAutoReplyModes.value[groupId] || 'mentions_only';
    const hadPreviousPrompt = Object.prototype.hasOwnProperty.call(groupPrompts.value, groupId);
    const previousPrompt = groupPrompts.value[groupId];
    const cats = groupCatMemberships.value[groupId] || [];
    const resolvedGroupName = groupName || groupId;
    loading.value = true;
    error.value = undefined;
    try {
      groupAutoReplyModes.value[groupId] = nextMode;
      const nextPrompt = buildCurrentGroupPrompt(groupId, resolvedGroupName, cats, nextMode);
      await clowderApi.syncGroupCats({
        groupId,
        groupName: resolvedGroupName,
        catIds: cats.map(cat => cat.catId),
        cats: serializeGroupCatsForSync(cats),
        proactiveReplies: nextMode === 'soft_mentions',
        autoReplyMode: nextMode,
        prompt: nextPrompt
      });
      return nextMode;
    } catch (err) {
      if (hadPreviousMode) {
        groupAutoReplyModes.value[groupId] = previousMode;
      } else {
        delete groupAutoReplyModes.value[groupId];
      }
      if (hadPreviousPrompt) {
        groupPrompts.value[groupId] = previousPrompt;
      } else {
        delete groupPrompts.value[groupId];
      }
      error.value = err instanceof Error ? err.message : 'Clowder auto reply mode update failed';
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

  async function sendConversationMessage(refInput: ClowderConversationRef & {
    directCatId?: string;
    targetCatIds?: string[];
    promptContext?: string;
  }, text: string) {
    return clowderApi.sendConversationMessage({ ...refInput, text });
  }

  async function sendDeploymentAction(input: ClowderDeploymentActionRequest): Promise<ClowderDeploymentActionResponse> {
    const response = await clowderApi.sendDeploymentAction(input);
    const deploymentRequest = (response as any)?.deploymentRequest as ClowderDeploymentRequest | undefined;
    if (deploymentRequest) {
      setDeploymentRequest(deploymentRequest);
    }
    return response as unknown as ClowderDeploymentActionResponse;
  }

  function deploymentRequestKey(channelId: string, channelType: number) {
    return conversationKey(channelId, channelType);
  }

  function setDeploymentRequest(request: ClowderDeploymentRequest) {
    const key = deploymentRequestKey(request.channelId, request.channelType);
    missingActiveDeploymentUntil.delete(key);
    activeDeploymentLoadedAt.set(key, Date.now());
    deploymentRequests.value = {
      ...deploymentRequests.value,
      [key]: request,
    };
    return request;
  }

  function clearDeploymentRequest(channelId: string, channelType: number) {
    const key = deploymentRequestKey(channelId, channelType);
    activeDeploymentLoadedAt.delete(key);
    if (!(key in deploymentRequests.value)) return;
    const next = { ...deploymentRequests.value };
    delete next[key];
    deploymentRequests.value = next;
  }

  function getDeploymentRequest(channelId: string, channelType: number): ClowderDeploymentRequest | undefined {
    return deploymentRequests.value[deploymentRequestKey(channelId, channelType)];
  }

  async function createDeploymentRequest(input: ClowderCreateDeploymentRequest): Promise<ClowderDeploymentRequest> {
    const response = await clowderApi.createDeploymentRequest(input);
    const deploymentRequest = response.deploymentRequest;
    if (!deploymentRequest) {
      throw new Error('Clowder deployment request create failed');
    }
    return setDeploymentRequest(deploymentRequest);
  }

  async function updateDeploymentRequestFields(
    deploymentRequestId: string,
    input: ClowderUpdateDeploymentRequest,
  ): Promise<ClowderDeploymentRequest> {
    const response = await clowderApi.updateDeploymentRequest(deploymentRequestId, input);
    const deploymentRequest = response.deploymentRequest;
    if (!deploymentRequest) {
      throw new Error('Clowder deployment request update failed');
    }
    return setDeploymentRequest(deploymentRequest);
  }

  async function loadActiveDeploymentRequest(refInput: ClowderConversationRef): Promise<ClowderDeploymentRequest | null> {
    const key = deploymentRequestKey(refInput.channelId, refInput.channelType);
    const cached = deploymentRequests.value[key];
    if (cached && isFresh(activeDeploymentLoadedAt, key, ACTIVE_DEPLOYMENT_CACHE_MS)) {
      return cached;
    }
    if (!cached && Date.now() < (missingActiveDeploymentUntil.get(key) || 0)) {
      return null;
    }
    const existingRequest = activeDeploymentRequests.get(key);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      const response = await clowderApi.getActiveDeploymentRequest(refInput);
      const deploymentRequest = response?.deploymentRequest;
      if (!deploymentRequest) {
        clearDeploymentRequest(refInput.channelId, refInput.channelType);
        missingActiveDeploymentUntil.set(key, Date.now() + MISSING_ACTIVE_DEPLOYMENT_CACHE_MS);
        return null;
      }
      return setDeploymentRequest(deploymentRequest);
    })();
    activeDeploymentRequests.set(key, request);
    try {
      return await request;
    } catch (err: any) {
      const status = err?.response?.status || err?.status;
      if (status === 404) {
        clearDeploymentRequest(refInput.channelId, refInput.channelType);
        missingActiveDeploymentUntil.set(key, Date.now() + MISSING_ACTIVE_DEPLOYMENT_CACHE_MS);
        return null;
      }
      throw err;
    } finally {
      if (activeDeploymentRequests.get(key) === request) {
        activeDeploymentRequests.delete(key);
      }
    }
  }

  async function loadDeploymentRequest(deploymentRequestId: string): Promise<ClowderDeploymentRequest | null> {
    const trimmed = String(deploymentRequestId || '').trim();
    if (!trimmed) return null;
    try {
      const response = await clowderApi.getDeploymentRequest(trimmed);
      const deploymentRequest = response?.deploymentRequest;
      if (!deploymentRequest) return null;
      return setDeploymentRequest(deploymentRequest);
    } catch (err: any) {
      const status = err?.response?.status || err?.status;
      if (status === 404) return null;
      throw err;
    }
  }

  function setCoordination(coordination: ClowderCoordination) {
    coordinations.value = {
      ...coordinations.value,
      [coordination.coordinationId]: coordination,
    };
    const current = threadCoordinationIds.value[coordination.threadId] || [];
    const nextIds = [coordination.coordinationId, ...current.filter(id => id !== coordination.coordinationId)];
    threadCoordinationIds.value = {
      ...threadCoordinationIds.value,
      [coordination.threadId]: nextIds,
    };
    return coordination;
  }

  function getCoordination(coordinationId: string): ClowderCoordination | undefined {
    return coordinations.value[coordinationId];
  }

  function getThreadCoordinations(threadId: string): ClowderCoordination[] {
    return (threadCoordinationIds.value[threadId] || [])
      .map(id => coordinations.value[id])
      .filter((coordination): coordination is ClowderCoordination => !!coordination);
  }

  async function createCoordination(input: ClowderCreateCoordinationRequest): Promise<ClowderCoordination> {
    const response = await clowderApi.createCoordination(input);
    if (!response.coordination) {
      throw new Error('Clowder coordination create failed');
    }
    return setCoordination(response.coordination);
  }

  async function updateCoordination(
    coordinationId: string,
    input: ClowderUpdateCoordinationRequest,
  ): Promise<ClowderCoordination> {
    const response = await clowderApi.updateCoordination(coordinationId, input);
    if (!response.coordination) {
      throw new Error('Clowder coordination update failed');
    }
    return setCoordination(response.coordination);
  }

  async function loadCoordination(coordinationId: string): Promise<ClowderCoordination | null> {
    const trimmed = String(coordinationId || '').trim();
    if (!trimmed) return null;
    const response = await clowderApi.getCoordination(trimmed);
    if (!response.coordination) return null;
    return setCoordination(response.coordination);
  }

  async function loadThreadCoordinations(threadId: string): Promise<ClowderCoordination[]> {
    const trimmed = String(threadId || '').trim();
    if (!trimmed) return [];
    const response = await clowderApi.listThreadCoordinations(trimmed);
    const list = Array.isArray(response.coordinations) ? response.coordinations : [];
    for (const coordination of list) {
      setCoordination(coordination);
    }
    threadCoordinationIds.value = {
      ...threadCoordinationIds.value,
      [trimmed]: list.map(coordination => coordination.coordinationId),
    };
    return list;
  }

  async function cancelCoordination(coordinationId: string, reason?: string): Promise<ClowderCoordination> {
    const response = await clowderApi.cancelCoordination(coordinationId, reason);
    if (!response.coordination) {
      throw new Error('Clowder coordination cancel failed');
    }
    return setCoordination(response.coordination);
  }

  // Phase 2.2: kickoff actions. kickoffs come from the Clowder API either
  // pushed over WebSocket (`coordinator_kickoff`) or pulled on demand
  // (`GET /v1/clowder/coordinator/kickoff/:id` — proxied through WuKongIM
  // bridge to Clowder 3004). UI shows the card via `getKickoff(coordinationId)`;
  // users dismiss via `dismissKickoff(id)`.

  function setKickoff(kickoff: CoordinatorKickoff) {
    kickoffs.value = { ...kickoffs.value, [kickoff.coordinationId]: kickoff };
  }

  function removeKickoff(coordinationId: string) {
    if (!(coordinationId in kickoffs.value)) return;
    const next = { ...kickoffs.value };
    delete next[coordinationId];
    kickoffs.value = next;
  }

  function getKickoff(coordinationId: string): CoordinatorKickoff | undefined {
    return kickoffs.value[coordinationId];
  }

  async function loadKickoff(coordinationId: string): Promise<CoordinatorKickoff | null> {
    const trimmed = String(coordinationId ?? '').trim();
    if (!trimmed) return null;
    try {
      const response = await apiClient.get<{ kickoff?: CoordinatorKickoff } | CoordinatorKickoff>(
        `clowder/coordinator/kickoff/${encodeURIComponent(trimmed)}`,
      );
      // Bridge may return the record directly or wrap in { kickoff }
      const payload = response.data;
      const data = (payload as { kickoff?: CoordinatorKickoff })?.kickoff
        ?? (payload as CoordinatorKickoff);
      if (!data || typeof data !== 'object' || !('coordinationId' in data)) {
        removeKickoff(trimmed);
        return null;
      }
      setKickoff(data);
      return data;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        removeKickoff(trimmed);
        return null;
      }
      console.warn('[clowderStore] loadKickoff failed', err);
      return null;
    }
  }

  async function dismissKickoff(coordinationId: string): Promise<boolean> {
    const trimmed = String(coordinationId ?? '').trim();
    if (!trimmed) return false;
    // Optimistic: remove locally first, then ask server.
    const previous = kickoffs.value[trimmed];
    removeKickoff(trimmed);
    try {
      await apiClient.post(
        `clowder/coordinator/kickoff/${encodeURIComponent(trimmed)}/dismiss`,
      );
      return true;
    } catch (err) {
      console.warn('[clowderStore] dismissKickoff failed — rolling back local removal', err);
      if (previous) setKickoff(previous);
      return false;
    }
  }

  /**
   * Pull all recent kickoffs (since `maxAgeMs` ago) and merge into the local
   * store. Used by ClowderConversationPanel on mount to surface a
   * "Create Project Group Chat?" card without needing WS plumbing across
   * the clowder-ai / im_web sub-project boundary.
   */
  async function loadRecentKickoffs(maxAgeMs = 60 * 60 * 1000): Promise<CoordinatorKickoff[]> {
    try {
      const response = await apiClient.get<{ kickoffs?: CoordinatorKickoff[] } | CoordinatorKickoff[]>(
        `clowder/coordinator/kickoffs`,
        { params: { maxAgeMs: String(maxAgeMs) } },
      );
      const payload = response.data;
      const list = Array.isArray(payload)
        ? payload
        : (payload?.kickoffs ?? []);
      if (!Array.isArray(list)) return [];
      for (const k of list) {
        if (k && typeof k === 'object' && 'coordinationId' in k) {
          setKickoff(k);
        }
      }
      return list;
    } catch (err) {
      console.warn('[clowderStore] loadRecentKickoffs failed', err);
      return [];
    }
  }

  function reset() {
    status.value = defaultStatus();
    conversations.value = {};
    agentDirectories.value = {};
    catContactDirectory.value = [];
    catRoleTemplates.value = [];
    platformModelOptions.value = {};
    localOAuthCapabilities.value = {};
    localOAuthLoading.value = false;
    localOAuthError.value = undefined;
    connectedCatContacts.value = [];
    groupCatMemberships.value = {};
    groupPrompts.value = {};
    groupAutoReplyModes.value = {};
    projectGroupBindings.value = {};
    threadTaskStates.value = {};
    workspaceRoot.value = undefined;
    workspaces.value = [];
    workspaceBindings.value = {};
    workspaceLoading.value = false;
    workspaceError.value = undefined;
    deploymentRequests.value = {};
    coordinations.value = {};
    threadCoordinationIds.value = {};
    kickoffs.value = {};
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
    loadCatContactDirectory,
    getConversation,
    catContactDirectory,
    catRoleTemplates,
    platformModelOptions,
    localOAuthCapabilities,
    localOAuthLoading,
    localOAuthError,
    loadLocalOAuthCapabilities,
    connectedCatContacts,
    groupCatMemberships,
    groupPrompts,
    groupAutoReplyModes,
    projectGroupBindings,
    threadTaskStates,
    workspaceRoot,
    workspaces,
    workspaceBindings,
    workspaceLoading,
    workspaceError,
    deploymentRequests,
    coordinations,
    threadCoordinationIds,
    getDeploymentRequest,
    getCoordination,
    getThreadCoordinations,
    getWorkspaceBinding,
    getActiveWorkspace,
    getProjectGroupBinding,
    ensureProjectGroup,
    loadWorkspaceRoot,
    loadWorkspaces,
    loadWorkspaceBinding,
    proposeWorkspace,
    createWorkspace,
    setWorkspaceBinding,
    getThreadTasksState,
    fetchThreadTasks,
    loadActiveDeploymentRequest,
    loadDeploymentRequest,
    createDeploymentRequest,
    updateDeploymentRequestFields,
    createCoordination,
    updateCoordination,
    loadCoordination,
    loadThreadCoordinations,
    cancelCoordination,
    getCatContactById,
    connectExistingCat,
    createCatAndConnect,
    deleteCatContact,
    syncMixedGroupCats,
    loadGroupCats,
    addGroupCat,
    removeGroupCat,
    setGroupAutoReplyMode,
    allowGroup,
    denyGroup,
    setFocus,
    clearFocus,
    sendConversationMessage,
    sendDeploymentAction,
    setDeploymentRequest,
    clearDeploymentRequest,
    kickoffs,
    setKickoff,
    removeKickoff,
    getKickoff,
    loadKickoff,
    loadRecentKickoffs,
    dismissKickoff,
    reset
  };
});
