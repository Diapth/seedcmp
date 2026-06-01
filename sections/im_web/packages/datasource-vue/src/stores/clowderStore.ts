import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
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
  type ClowderCreateCatRequest,
  type ClowderConversationRef,
  type ClowderConversationStateResponse,
  type ClowderConnectionStatus,
  type ClowderGroupCatStateResponse,
  type IMConnectorPermission
} from '../api/clowder';
import {
  buildClowderGroupPrompt,
  isClowderCatContactId,
  toClowderCatContact,
  type ClowderCatContact,
  type ClowderGroupPromptInput
} from './clowderCatContacts';

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

export const useClowderStore = defineStore('clowder', () => {
  const status = ref<ClowderConnectionStatus>(defaultStatus());
  const conversations = ref<Record<string, ClowderConversationStateResponse>>({});
  const agentDirectories = ref<Record<string, ClowderAgentDirectoryRuntimeState>>({});
  const catContactDirectory = ref<ClowderCatContact[]>([]);
  const connectedCatContacts = ref<ClowderCatContact[]>([]);
  const groupCatMemberships = ref<Record<string, ClowderCatContact[]>>({});
  const groupPrompts = ref<Record<string, string>>({});
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

  function normalizeCatDirectory(response?: ClowderCatDirectoryResponse) {
    return (response?.agents || []).map(agent => toClowderCatContact(agent, {
      connected: agent.connected === true
    }));
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
    loading.value = true;
    error.value = undefined;
    try {
      const directory = normalizeCatDirectory(await clowderApi.getCatDirectory(params) as unknown as ClowderCatDirectoryResponse);
      catContactDirectory.value = directory;
      connectedCatContacts.value = directory.filter(cat => cat.connected);
      return directory;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Clowder cat directory unavailable';
      throw err;
    } finally {
      loading.value = false;
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

  async function syncMixedGroupCats(input: ClowderGroupPromptInput) {
    const prompt = buildClowderGroupPrompt(input);
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

  function buildCurrentGroupPrompt(groupId: string, groupName: string, cats: ClowderCatContact[]) {
    const prompt = buildClowderGroupPrompt({
      groupId,
      groupName,
      humanMembers: [],
      catMembers: cats,
      rules: {
        proactiveReplies: false,
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
    const prompt = buildCurrentGroupPrompt(groupId, groupName || groupId, cats);
    try {
      await clowderApi.syncGroupCats({
        groupId,
        groupName: groupName || groupId,
        catIds: cats.map(cat => cat.catId),
        cats: serializeGroupCatsForSync(cats),
        proactiveReplies: false,
        prompt
      });
    } catch (e) {
      console.warn(`[ClowderStore] Failed to persist recovered group cats for ${groupId}`, e);
    }
  }

  async function loadGroupCats(groupId: string) {
    const response = await clowderApi.getGroupCats({ groupId }) as unknown as ClowderGroupCatStateResponse;
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
        catContactDirectory.value = (directory?.agents || []).map(agent => toClowderCatContact(agent, {
          connected: agent.connected === true
        }));
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
      buildCurrentGroupPrompt(groupId, response.groupName || groupId, cats);
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
    const nextPrompt = buildCurrentGroupPrompt(groupId, groupName || groupId, nextCats);
    await clowderApi.syncGroupCats({
      groupId,
      groupName: groupName || groupId,
      catIds: nextCats.map(cat => cat.catId),
      cats: serializeGroupCatsForSync(nextCats),
      proactiveReplies: false,
      prompt: nextPrompt
    });
    return nextCats;
  }

  async function removeGroupCat(groupId: string, catId: string, groupName?: string) {
    const nextCats = (groupCatMemberships.value[groupId] || []).filter(cat => cat.catId !== catId);
    groupCatMemberships.value[groupId] = nextCats;
    const nextPrompt = buildCurrentGroupPrompt(groupId, groupName || groupId, nextCats);
    await clowderApi.syncGroupCats({
      groupId,
      groupName: groupName || groupId,
      catIds: nextCats.map(cat => cat.catId),
      cats: serializeGroupCatsForSync(nextCats),
      proactiveReplies: false,
      prompt: nextPrompt
    });
    return nextCats;
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

  function reset() {
    status.value = defaultStatus();
    conversations.value = {};
    agentDirectories.value = {};
    catContactDirectory.value = [];
    connectedCatContacts.value = [];
    groupCatMemberships.value = {};
    groupPrompts.value = {};
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
    connectedCatContacts,
    groupCatMemberships,
    groupPrompts,
    getCatContactById,
    connectExistingCat,
    createCatAndConnect,
    syncMixedGroupCats,
    loadGroupCats,
    addGroupCat,
    removeGroupCat,
    allowGroup,
    denyGroup,
    setFocus,
    clearFocus,
    sendConversationMessage,
    reset
  };
});
