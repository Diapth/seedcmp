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

function normalizeRoleTemplate(input = {}) {
  const id = input.roleTemplateId || input.role_template_id || input.templateId || input.catId || input.cat_id || input.id || '';
  const label = input.displayName || input.display_name || input.name || input.label || id || '未命名模板';
  return {
    id,
    value: input.logicalKey || input.logical_key || id,
    label,
    catId: input.catId || input.cat_id || '',
    description: input.capabilitySummary || input.capability_summary || input.personalitySummary || input.personality_summary || input.description || '',
    cloneable: input.cloneable !== false,
    unavailableReason: input.unavailableReason || input.unavailable_reason || '',
    raw: input
  };
}

function normalizePlatformModelOptions(input = {}) {
  return Object.entries(input).reduce((acc, [platform, entry]) => {
    const defaultModel = entry?.defaultModel || entry?.default_model || '';
    const models = [
      defaultModel,
      ...(Array.isArray(entry?.models) ? entry.models : [])
    ].map((model) => String(model || '').trim()).filter(Boolean);
    const uniqueModels = Array.from(new Set(models));
    if (uniqueModels.length) {
      acc[platform] = uniqueModels.map((model) => ({
        id: model,
        label: model,
        default: model === defaultModel
      }));
    }
    return acc;
  }, {});
}

function normalizeSkill(input = {}, provider = '') {
  const name = input.name || input.skill_name || input.id || '';
  const trigger = input.trigger || input.command || '';
  const id = input.id || input.skill_id || (provider && name ? `${provider}:${name}` : name);
  return {
    id,
    name: name || '未命名技能',
    category: input.category || '',
    level: input.level || '',
    desc: input.desc || input.description || '',
    icon: input.icon || 'bookmark',
    tone: input.tone || 'primary',
    agentIds: input.agent_ids || input.agentIds || [],
    provider,
    source: input.source || '后端',
    status: input.status || (input.mounted === true ? '已启用' : '未启用'),
    version: input.version || '',
    size: input.size || '',
    packageName: input.package_name || input.packageName || name || '',
    location: input.location || '',
    updatedAt: input.updated_at || input.updatedAt || '',
    author: input.author || '',
    triggers: input.triggers || (trigger ? [trigger] : []),
    files: input.files || [],
    documents: input.documents || [],
    requiresMcp: input.requiresMcp || input.requires_mcp || [],
    raw: input
  };
}

function normalizeSkillCatalog(catalog = {}) {
  return Object.entries(catalog).flatMap(([provider, skills]) => (
    Array.isArray(skills)
      ? skills.map((skill) => normalizeSkill(skill, provider))
      : []
  ));
}

export const useAgentStore = defineStore('agent', {
  state: () => ({
    agents: [],
    userSkills: [],
    localSkills: [],
    roleTemplates: [],
    platformModelOptions: {},
    skillCatalog: {},
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
    applyDirectoryMetadata(data = {}) {
      this.roleTemplates = (data.templates || data.roleTemplates || []).map(normalizeRoleTemplate);
      this.platformModelOptions = normalizePlatformModelOptions(data.clientDefaults || data.client_defaults || {});
      this.skillCatalog = data.skillCatalog || data.skill_catalog || {};
      const catalogSkills = normalizeSkillCatalog(this.skillCatalog);
      const directSkills = (data.skills || data.skillList || data.skill_list || []).map((skill) => normalizeSkill(skill));
      const skills = catalogSkills.length > 0 ? catalogSkills : directSkills;
      if (skills.length > 0 || Object.keys(this.skillCatalog).length > 0) {
        this.userSkills = skills;
        this.localSkills = skills;
      }
    },
    async fetchAgentDirectory(params = {}) {
      this.loading = true;
      this.lastError = '';
      try {
        const response = await clowderApi.getCatDirectory(params);
        const data = response?.data || response || {};
        const list = data.cats || data.agents || data.items || [];
        this.agents = list.map(normalizeAgent);
        this.applyDirectoryMetadata(data);
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
        if (!Object.keys(this.skillCatalog).length) {
          const response = await clowderApi.getCatDirectory({ includeUnavailable: true });
          this.applyDirectoryMetadata(response?.data || response || {});
        }
        const skills = this.localSkills.length > 0 ? this.localSkills : normalizeSkillCatalog(this.skillCatalog);
        this.userSkills = skills;
        this.localSkills = skills;
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
      this.roleTemplates = [];
      this.platformModelOptions = {};
      this.skillCatalog = {};
      this.boards = [];
      this.loading = false;
      this.lastError = '';
    }
  }
});
