import { defineStore } from 'pinia';
import { clowderApi } from '@/api/clowder.js';

export const useDeploymentStore = defineStore('deployment', {
  state: () => ({
    requests: {},
    loading: false,
    lastError: ''
  }),
  actions: {
    async submit(payload) {
      this.loading = true;
      try {
        const response = await clowderApi.createDeploymentRequest(payload);
        const data = response?.data || response || {};
        this.requests[data.id || data.requestId] = data;
        return data;
      } finally {
        this.loading = false;
      }
    },
    async fetch(id) {
      const response = await clowderApi.getDeploymentRequest(id);
      const data = response?.data || response || {};
      this.requests[id] = data;
      return data;
    },
    async cancel(id) {
      const response = await clowderApi.sendDeploymentAction({ requestId: id, action: 'cancel' });
      const data = response?.data || response || {};
      this.requests[id] = data;
      return data;
    }
  }
});
