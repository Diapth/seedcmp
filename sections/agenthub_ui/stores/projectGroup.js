import { defineStore } from 'pinia';
import { clowderApi } from '@/api/clowder.js';

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
        const data = response?.data || response || {};
        this.bindings[data.bindingId || data.id || payload.pmDirectChannelId] = data;
        return data;
      } finally {
        this.loading = false;
      }
    },
    async fetchActive(params) {
      const response = await clowderApi.getActiveProjectGroup(params);
      const data = response?.data || response || {};
      this.bindings[data.bindingId || data.id || params.pmDirectChannelId] = data;
      return data;
    },
    async cancel(bindingId, reason = '用户取消') {
      this.bindings[bindingId] = { ...(this.bindings[bindingId] || {}), status: 'cancelled', reason };
    }
  }
});
