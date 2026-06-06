import { defineStore } from 'pinia';
import { clowderApi } from '@/api/clowder.js';

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

export const useProjectGroupStore = defineStore('projectGroup', {
  state: () => ({
    bindings: {},
    loading: false,
    lastError: ''
  }),
  actions: {
    async ensure(payload) {
      this.loading = true;
      try {
        const response = await clowderApi.ensureProjectGroup(payload);
        const binding = pickBinding(response);
        this.bindings[bindingKey(binding, payload.pmDirectChannelId)] = binding;
        return binding;
      } finally {
        this.loading = false;
      }
    },
    async fetchActive(params) {
      const response = await clowderApi.getActiveProjectGroup(params);
      const binding = pickBinding(response);
      this.bindings[bindingKey(binding, params.pmDirectChannelId)] = binding;
      return binding;
    },
    async cancel(bindingId, reason = '用户取消') {
      this.bindings[bindingId] = { ...(this.bindings[bindingId] || {}), status: 'cancelled', reason };
    }
  }
});
