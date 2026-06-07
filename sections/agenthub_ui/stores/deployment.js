import { defineStore } from 'pinia';
import { clowderApi } from '@/api/clowder.js';

function unwrapData(response) {
  return response?.data || response || {};
}

function pickDeploymentRequest(response) {
  const data = unwrapData(response);
  return data.deploymentRequest || data.deployment_request || data.request || data;
}

function deploymentId(request = {}, fallback = '') {
  return request.id || request.requestId || request.request_id || request.deploymentRequestId || request.deployment_request_id || fallback;
}

function normalizeChannelContext(input = {}, existing = {}) {
  const channelId = input.channelId || input.channel_id || existing.channelId || existing.channel_id || '';
  const channelType = Number(input.channelType || input.channel_type || existing.channelType || existing.channel_type || 0);
  return { channelId, channelType };
}

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
        const request = pickDeploymentRequest(response);
        this.requests[deploymentId(request)] = request;
        return request;
      } finally {
        this.loading = false;
      }
    },
    async fetch(id) {
      const response = await clowderApi.getDeploymentRequest(id);
      const request = pickDeploymentRequest(response);
      this.requests[deploymentId(request, id)] = request;
      return request;
    },
    async fetchActive(params) {
      const response = await clowderApi.getActiveDeploymentRequest(params);
      const request = pickDeploymentRequest(response);
      const id = deploymentId(request);
      if (id) this.requests[id] = request;
      return id ? request : null;
    },
    async confirm(id, context = {}) {
      const existing = this.requests[id] || {};
      const { channelId, channelType } = normalizeChannelContext(context, existing);
      const deploymentRequestId = id || context.deploymentRequestId || context.requestId;
      const actionId = context.actionId || `${deploymentRequestId}:confirm:${Date.now()}`;
      const response = await clowderApi.sendDeploymentAction({
        ...existing,
        ...context,
        deploymentRequestId,
        action: 'confirm',
        actionId,
        channelId,
        channelType
      });
      const request = pickDeploymentRequest(response);
      this.requests[deploymentId(request, deploymentRequestId)] = request;
      return request;
    },
    async cancel(id, context = {}) {
      const existing = this.requests[id] || {};
      const { channelId, channelType } = normalizeChannelContext(context, existing);
      const deploymentRequestId = id || context.deploymentRequestId || context.requestId;
      const actionId = context.actionId || `${deploymentRequestId}:cancel:${Date.now()}`;
      const response = await clowderApi.sendDeploymentAction({
        ...existing,
        ...context,
        deploymentRequestId,
        action: 'cancel',
        actionId,
        channelId,
        channelType
      });
      const request = pickDeploymentRequest(response);
      this.requests[deploymentId(request, deploymentRequestId)] = request;
      return request;
    }
  }
});
