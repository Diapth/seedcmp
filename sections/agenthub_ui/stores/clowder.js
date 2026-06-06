import { defineStore } from 'pinia';
import { clowderApi } from '@/api/clowder.js';
import { channelKey } from '@/utils/im-mappers.js';

function normalizeCapabilities(input = {}) {
  return {
    oauthEnabled: input.oauthEnabled ?? input.oauth_enabled ?? true,
    runtimeAvailable: input.runtimeAvailable ?? input.runtime_available ?? true,
    queueFull: input.queueFull ?? input.queue_full ?? false,
    groupDenied: input.groupDenied ?? input.group_denied ?? false,
    raw: input
  };
}

function capabilityReason(capabilities) {
  if (!capabilities.oauthEnabled) return 'OAuth 登录能力不可用，请使用 Codex 或在 im_web 完成授权';
  if (!capabilities.runtimeAvailable) return '本机 Clowder runtime 不可用';
  if (capabilities.queueFull) return 'Clowder 任务队列已满';
  if (capabilities.groupDenied) return '当前群聊未授权 Clowder 访问';
  return '';
}

function unwrapData(response) {
  return response?.data || response || {};
}

function pickBinding(response) {
  const data = unwrapData(response);
  return data.binding || data.projectGroup || data.project_group || data;
}

function bindingKey(binding = {}, fallback = '') {
  return binding.bindingId || binding.binding_id || binding.id || binding.projectGroupId || binding.project_group_id || fallback;
}

function pickDeploymentRequest(response) {
  const data = unwrapData(response);
  return data.deploymentRequest || data.deployment_request || data.request || data;
}

function deploymentId(request = {}, fallback = '') {
  return request.id || request.requestId || request.request_id || request.deploymentRequestId || request.deployment_request_id || fallback;
}

function normalizeCatPlatform(platform) {
  const value = String(platform || '').trim().toLowerCase().replace(/_/g, '-');
  if (value === 'openai' || value === 'codex') return 'codex';
  if (value === 'anthropic' || value === 'claude' || value === 'claude-code') return 'claude-code';
  return value;
}

function normalizeCatAuthType(accessMode) {
  const value = String(accessMode || '').trim().toLowerCase();
  if (value === 'api_key' || value === 'api-key' || value === 'apikey') return 'api-key';
  if (value === 'oauth' || value === 'subscription') return 'oauth';
  return value;
}

function createCatRequestPayload(payload = {}) {
  const platform = normalizeCatPlatform(payload.clientId || payload.platform);
  const data = {
    name: payload.name,
    alias: payload.alias,
    roleTemplateId: payload.roleTemplateId || payload.roleTemplateID || payload.templateId || payload.roleTemplate,
    clientId: platform,
    platform,
    authType: normalizeCatAuthType(payload.authType || payload.accessMode || payload.access_mode),
    accountRef: payload.accountRef || payload.account_ref,
    defaultModel: payload.defaultModel || payload.model || payload.customModel,
    personality: payload.personality || payload.systemPrompt || payload.desc,
    capabilities: payload.capabilities || payload.capabilityTags || []
  };
  return Object.fromEntries(Object.entries(data).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== '';
  }));
}

export const useClowderStore = defineStore('clowder', {
  state: () => ({
    status: 'unknown',
    error: '',
    agentDirectory: {},
    bindings: {},
    conversations: {},
    threads: {},
    tasks: {},
    artifacts: {},
    deployments: {},
    projectGroups: {},
    groupCats: {},
    capabilities: normalizeCapabilities(),
    kickoffPollings: {},
    loading: false
  }),
  getters: {
    disabledReason(state) {
      return capabilityReason(state.capabilities) || state.error || '';
    }
  },
  actions: {
    async refreshStatus() {
      const response = await clowderApi.getStatus();
      const data = unwrapData(response);
      this.status = data.status || data.state || 'unknown';
      this.error = data.error || '';
      return data;
    },
    async fetchCapabilities() {
      const response = await clowderApi.getLocalAuthCapabilities();
      const data = unwrapData(response);
      this.capabilities = normalizeCapabilities(data);
      return this.capabilities;
    },
    async fetchAgentDirectory(params = {}) {
      const response = await clowderApi.getCatDirectory(params);
      const data = unwrapData(response);
      const list = data.cats || data.agents || [];
      this.agentDirectory = Object.fromEntries(list.map((cat) => [cat.cat_id || cat.catId || cat.id, cat]));
      return list;
    },
    async createCat(payload) {
      const response = await clowderApi.createCatAndConnect(createCatRequestPayload(payload));
      const data = unwrapData(response);
      const cat = data.cat || data.agent || data;
      const id = cat?.cat_id || cat?.catId || cat?.id;
      if (id) this.agentDirectory[id] = cat;
      return cat;
    },
    async connectCat(catId) {
      const response = await clowderApi.connectCatContact({ catId });
      const data = unwrapData(response);
      const cat = data.cat || data.agent || data;
      const id = cat?.cat_id || cat?.catId || cat?.id;
      if (id) this.agentDirectory[id] = cat;
      return cat;
    },
    async disconnectCat(catId) {
      await clowderApi.deleteCatContact(catId);
      if (this.agentDirectory[catId]) this.agentDirectory[catId].status = 'inactive';
    },
    async fetchBinding(channelId, channelType) {
      const response = await clowderApi.getConversationState({ channelId, channelType });
      const data = unwrapData(response);
      const key = channelKey(channelId, channelType);
      this.conversations[key] = data;
      this.bindings[key] = data.binding || null;
      return data;
    },
    async bindConversation(data) {
      const response = await clowderApi.bindConversation(data);
      const binding = unwrapData(response);
      this.bindings[channelKey(data.channelId, data.channelType)] = binding;
      return binding;
    },
    async setFocus(conversationRef, catId) {
      const response = await clowderApi.setFocus({ ...conversationRef, catId });
      const data = unwrapData(response);
      this.conversations[channelKey(conversationRef.channelId, conversationRef.channelType)] = data;
      return data;
    },
    async clearFocus(conversationRef) {
      const response = await clowderApi.clearFocus(conversationRef);
      const data = unwrapData(response);
      this.conversations[channelKey(conversationRef.channelId, conversationRef.channelType)] = data;
      return data;
    },
    async listGroupCats(groupId) {
      const response = await clowderApi.getGroupCats({ groupId });
      const data = unwrapData(response);
      this.groupCats[groupId] = data.cats || data.agents || [];
      return data;
    },
    async addGroupCat(groupId, catId) {
      return clowderApi.syncGroupCats({ groupId, addCatIds: [catId], removeCatIds: [] });
    },
    async removeGroupCat(groupId, catId) {
      return clowderApi.syncGroupCats({ groupId, addCatIds: [], removeCatIds: [catId] });
    },
    async sendConversationMessage(payload) {
      const response = await clowderApi.sendConversationMessage(payload);
      return unwrapData(response);
    },
    async fetchThreadTasks(threadId, options = {}) {
      const response = await clowderApi.getThreadTasks(threadId, options);
      const data = unwrapData(response);
      this.tasks[threadId] = data.tasks || [];
      return this.tasks[threadId];
    },
    async fetchArtifacts(coordinationId) {
      const response = await clowderApi.getCoordination(coordinationId);
      const data = unwrapData(response);
      this.artifacts[coordinationId] = data.artifacts || [];
      return this.artifacts[coordinationId];
    },
    async confirmProjectGroup(payload) {
      const response = await clowderApi.ensureProjectGroup(payload);
      const binding = pickBinding(response);
      if (bindingKey(binding)) this.projectGroups[bindingKey(binding)] = binding;
      return binding;
    },
    async cancelProjectGroup(bindingId, reason = '用户取消') {
      this.projectGroups[bindingId] = { ...(this.projectGroups[bindingId] || {}), status: 'cancelled', reason };
    },
    async submitDeployment(payload) {
      const response = await clowderApi.createDeploymentRequest(payload);
      const request = pickDeploymentRequest(response);
      if (deploymentId(request)) this.deployments[deploymentId(request)] = request;
      return request;
    },
    async cancelDeployment(requestId, context = {}) {
      const existing = this.deployments[requestId] || {};
      const response = await clowderApi.sendDeploymentAction({
        ...existing,
        ...context,
        deploymentRequestId: requestId,
        action: 'cancel',
        actionId: context.actionId || `${requestId}:cancel:${Date.now()}`,
        channelId: context.channelId || existing.channelId || existing.channel_id || '',
        channelType: Number(context.channelType || existing.channelType || existing.channel_type || 0)
      });
      const request = pickDeploymentRequest(response);
      this.deployments[deploymentId(request, requestId)] = request;
      return request;
    },
    startKickoffPolling(coordId) {
      if (!coordId || this.kickoffPollings[coordId]) return;
      this.kickoffPollings[coordId] = setInterval(() => {
        this.fetchArtifacts(coordId).catch(() => undefined);
      }, 3000);
    },
    stopKickoffPolling(coordId) {
      if (this.kickoffPollings[coordId]) {
        clearInterval(this.kickoffPollings[coordId]);
        delete this.kickoffPollings[coordId];
      }
    },
    reset() {
      Object.keys(this.kickoffPollings).forEach((id) => this.stopKickoffPolling(id));
      this.status = 'unknown';
      this.error = '';
      this.agentDirectory = {};
      this.bindings = {};
      this.conversations = {};
      this.threads = {};
      this.tasks = {};
      this.artifacts = {};
      this.deployments = {};
      this.projectGroups = {};
      this.groupCats = {};
      this.capabilities = normalizeCapabilities();
    }
  }
});
