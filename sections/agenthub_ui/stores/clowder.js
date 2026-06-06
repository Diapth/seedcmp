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
      const data = response?.data || response || {};
      this.status = data.status || data.state || 'unknown';
      this.error = data.error || '';
      return data;
    },
    async fetchCapabilities() {
      const response = await clowderApi.getLocalAuthCapabilities();
      const data = response?.data || response || {};
      this.capabilities = normalizeCapabilities(data);
      return this.capabilities;
    },
    async fetchAgentDirectory(params = {}) {
      const response = await clowderApi.getCatDirectory(params);
      const data = response?.data || response || {};
      const list = data.cats || data.agents || [];
      this.agentDirectory = Object.fromEntries(list.map((cat) => [cat.cat_id || cat.id, cat]));
      return list;
    },
    async createCat(payload) {
      const response = await clowderApi.createCatAndConnect(payload);
      const data = response?.data || response || {};
      const cat = data.cat || data.agent || data;
      if (cat?.cat_id || cat?.id) this.agentDirectory[cat.cat_id || cat.id] = cat;
      return cat;
    },
    async connectCat(catId) {
      const response = await clowderApi.connectCatContact({ catId });
      const data = response?.data || response || {};
      const cat = data.cat || data.agent || data;
      if (cat?.cat_id || cat?.id) this.agentDirectory[cat.cat_id || cat.id] = cat;
      return cat;
    },
    async disconnectCat(catId) {
      await clowderApi.deleteCatContact(catId);
      if (this.agentDirectory[catId]) this.agentDirectory[catId].status = 'inactive';
    },
    async fetchBinding(channelId, channelType) {
      const response = await clowderApi.getConversationState({ channelId, channelType });
      const data = response?.data || response || {};
      const key = channelKey(channelId, channelType);
      this.conversations[key] = data;
      this.bindings[key] = data.binding || null;
      return data;
    },
    async bindConversation(data) {
      const response = await clowderApi.bindConversation(data);
      const binding = response?.data || response || {};
      this.bindings[channelKey(data.channelId, data.channelType)] = binding;
      return binding;
    },
    async setFocus(conversationRef, catId) {
      const response = await clowderApi.setFocus({ ...conversationRef, catId });
      const data = response?.data || response || {};
      this.conversations[channelKey(conversationRef.channelId, conversationRef.channelType)] = data;
      return data;
    },
    async clearFocus(conversationRef) {
      const response = await clowderApi.clearFocus(conversationRef);
      const data = response?.data || response || {};
      this.conversations[channelKey(conversationRef.channelId, conversationRef.channelType)] = data;
      return data;
    },
    async listGroupCats(groupId) {
      const response = await clowderApi.getGroupCats({ groupId });
      return response?.data || response || {};
    },
    async addGroupCat(groupId, catId) {
      return clowderApi.syncGroupCats({ groupId, addCatIds: [catId], removeCatIds: [] });
    },
    async removeGroupCat(groupId, catId) {
      return clowderApi.syncGroupCats({ groupId, addCatIds: [], removeCatIds: [catId] });
    },
    async sendConversationMessage(payload) {
      const response = await clowderApi.sendConversationMessage(payload);
      return response?.data || response || {};
    },
    async fetchThreadTasks(threadId, options = {}) {
      const response = await clowderApi.getThreadTasks(threadId, options);
      const data = response?.data || response || {};
      this.tasks[threadId] = data.tasks || [];
      return this.tasks[threadId];
    },
    async fetchArtifacts(coordinationId) {
      const response = await clowderApi.getCoordination(coordinationId);
      const data = response?.data || response || {};
      this.artifacts[coordinationId] = data.artifacts || [];
      return this.artifacts[coordinationId];
    },
    async confirmProjectGroup(payload) {
      const response = await clowderApi.ensureProjectGroup(payload);
      const data = response?.data || response || {};
      if (data.bindingId || data.id) this.projectGroups[data.bindingId || data.id] = data;
      return data;
    },
    async cancelProjectGroup(bindingId, reason = '用户取消') {
      this.projectGroups[bindingId] = { ...(this.projectGroups[bindingId] || {}), status: 'cancelled', reason };
    },
    async submitDeployment(payload) {
      const response = await clowderApi.createDeploymentRequest(payload);
      const data = response?.data || response || {};
      if (data.id || data.requestId) this.deployments[data.id || data.requestId] = data;
      return data;
    },
    async cancelDeployment(requestId) {
      const response = await clowderApi.sendDeploymentAction({ requestId, action: 'cancel' });
      const data = response?.data || response || {};
      this.deployments[requestId] = data;
      return data;
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
      this.capabilities = normalizeCapabilities();
    }
  }
});
