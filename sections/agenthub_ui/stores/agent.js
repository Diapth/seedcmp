import { defineStore } from 'pinia';
import { clowderApi } from '@/api/clowder.js';

function normalizeAgent(input = {}) {
  return {
    id: input.cat_id || input.catId || input.id || '',
    name: input.name || input.display_name || '未命名智能体',
    alias: input.alias || '',
    desc: input.desc || input.description || '',
    avatar: input.avatar || input.logo || '',
    status: input.status || 'unknown',
    creator: input.creator || input.created_by || '',
    platform: input.platform || '',
    accessMode: input.access_mode || input.accessMode || '',
    model: input.model || '',
    accountRef: input.account_ref || input.accountRef || '',
    apiKey: '',
    apiUrl: '',
    customModel: '',
    systemPrompt: '',
    roleTemplate: input.role_template || input.roleTemplate || '',
    templateId: input.template_id || input.templateId || '',
    capabilityTags: input.capability_tags || input.capabilityTags || [],
    raw: input
  };
}

function normalizeSkill(input = {}) {
  return {
    id: input.id || input.skill_id || input.name || '',
    name: input.name || '未命名技能',
    category: input.category || '',
    level: input.level || '',
    desc: input.desc || input.description || '',
    icon: input.icon || 'bookmark',
    tone: input.tone || 'primary',
    agentIds: input.agent_ids || input.agentIds || [],
    raw: input
  };
}

export const useAgentStore = defineStore('agent', {
  state: () => ({
    agents: [],
    userSkills: [],
    localSkills: [],
    boards: [],
    loading: false,
    lastError: '',
    unavailable: {
      skillUpload: false,
      reason: ''
    }
  }),
  getters: {
    activeAgents(state) {
      return state.agents.filter((agent) => agent.status === 'active' || agent.status === 'online');
    }
  },
  actions: {
    normalizeAgent,
    async fetchAgentDirectory(params = {}) {
      this.loading = true;
      this.lastError = '';
      try {
        const response = await clowderApi.getCatDirectory(params);
        const data = response?.data || response || {};
        const list = data.cats || data.agents || data.items || [];
        this.agents = list.map(normalizeAgent);
        return this.agents;
      } catch (err) {
        this.lastError = err?.message || '获取智能体目录失败';
        throw err;
      } finally {
        this.loading = false;
      }
    },
    async fetchSkills() {
      try {
        const response = await clowderApi.getAgentDirectory({});
        const data = response?.data || response || {};
        this.userSkills = (data.skills || []).map(normalizeSkill);
        this.localSkills = this.userSkills;
        return this.userSkills;
      } catch (err) {
        this.unavailable.skillUpload = true;
        this.unavailable.reason = err?.message || '技能接口暂不可用';
        this.userSkills = [];
        this.localSkills = [];
        return [];
      }
    },
    async createAgent(payload) {
      const response = await clowderApi.createCatAndConnect({
        name: payload.name,
        alias: payload.alias,
        desc: payload.desc,
        platform: payload.platform || 'claude-code',
        access_mode: payload.accessMode || 'oauth',
        model: payload.model,
        account_ref: payload.accountRef,
        system_prompt: payload.systemPrompt,
        capability_tags: payload.capabilityTags || []
      });
      const data = response?.data || response || {};
      const agent = normalizeAgent(data.cat || data.agent || data);
      if (agent.id && !this.agents.some((item) => item.id === agent.id)) {
        this.agents.unshift(agent);
      }
      return agent;
    },
    async connectAgent(catId) {
      const response = await clowderApi.connectCatContact({ catId });
      const data = response?.data || response || {};
      const agent = normalizeAgent(data.cat || data.agent || data);
      if (agent.id) this.updateAgent(agent.id, agent);
      return agent;
    },
    async disconnectAgent(catId) {
      await clowderApi.deleteCatContact(catId);
      this.updateAgent(catId, { status: 'inactive' });
    },
    updateAgent(id, patch) {
      const index = this.agents.findIndex((agent) => agent.id === id);
      if (index >= 0) {
        this.agents[index] = { ...this.agents[index], ...patch };
        return this.agents[index];
      }
      const created = normalizeAgent({ id, ...patch });
      this.agents.unshift(created);
      return created;
    },
    reset() {
      this.agents = [];
      this.userSkills = [];
      this.localSkills = [];
      this.boards = [];
      this.loading = false;
      this.lastError = '';
    }
  }
});
