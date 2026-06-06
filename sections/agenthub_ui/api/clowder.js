import { request } from '@/utils/request.js';

function paramsQuery(params = {}) {
  const cleaned = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return new URLSearchParams(cleaned).toString();
}

export const clowderApi = {
  getStatus() {
    return request('clowder/status');
  },
  getConversationState(params) {
    const query = paramsQuery(params);
    return request(`clowder/conversation${query ? `?${query}` : ''}`);
  },
  getAgentDirectory(params = {}) {
    const query = paramsQuery(params);
    return request(`clowder/conversation/agents${query ? `?${query}` : ''}`);
  },
  getCatDirectory(params = {}) {
    const query = paramsQuery(params);
    return request(`clowder/cats${query ? `?${query}` : ''}`);
  },
  getLocalAuthCapabilities() {
    return request('clowder/local-auth/capabilities');
  },
  createCatAndConnect(data) {
    return request('clowder/cats', { method: 'POST', data });
  },
  connectCatContact(data) {
    return request('clowder/cats/connect', { method: 'POST', data });
  },
  deleteCatContact(catId) {
    return request(`clowder/cats/${encodeURIComponent(catId)}`, { method: 'DELETE' });
  },
  bindConversation(data) {
    return request('clowder/conversation/bind', { method: 'POST', data });
  },
  setFocus(data) {
    return request('clowder/conversation/focus', { method: 'POST', data });
  },
  clearFocus(data) {
    return request('clowder/conversation/focus/clear', { method: 'POST', data });
  },
  sendConversationMessage(data) {
    return request('clowder/conversation/message', { method: 'POST', data });
  },
  getThreadTasks(threadId, options = {}) {
    const query = paramsQuery({
      expectedTaskId: options.expectedTaskId,
      observedTaskIds: options.observedTaskIds?.join(',')
    });
    return request(`clowder/thread/${encodeURIComponent(threadId)}/tasks${query ? `?${query}` : ''}`);
  },
  createDeploymentRequest(data) {
    return request('clowder/conversation/deployment-request', { method: 'POST', data });
  },
  getDeploymentRequest(id) {
    return request(`clowder/conversation/deployment-request/${encodeURIComponent(id)}`);
  },
  getActiveDeploymentRequest(params) {
    const query = paramsQuery(params);
    return request(`clowder/conversation/deployment-request/active${query ? `?${query}` : ''}`);
  },
  sendDeploymentAction(data) {
    return request('clowder/conversation/deployment-action', { method: 'POST', data });
  },
  createCoordination(data) {
    return request('clowder/coordinator/coordination', { method: 'POST', data });
  },
  getCoordination(coordinationId) {
    return request(`clowder/coordinator/coordination/${encodeURIComponent(coordinationId)}`);
  },
  listThreadCoordinations(threadId) {
    return request(`clowder/thread/${encodeURIComponent(threadId)}/coordinations`);
  },
  cancelCoordination(coordinationId, reason = '') {
    return request(`clowder/coordinator/coordination/${encodeURIComponent(coordinationId)}/cancel`, {
      method: 'POST',
      data: reason ? { reason } : {}
    });
  },
  getGroupCats(params) {
    const query = paramsQuery(params);
    return request(`clowder/group/cats${query ? `?${query}` : ''}`);
  },
  syncGroupCats(data) {
    return request('clowder/group/cats/sync', { method: 'POST', data });
  },
  ensureProjectGroup(data) {
    return request('clowder/project-groups/ensure', { method: 'POST', data });
  },
  getActiveProjectGroup(params) {
    const query = paramsQuery(params);
    return request(`clowder/project-groups/active${query ? `?${query}` : ''}`);
  },
  updateProjectGroupThread(bindingId, data) {
    return request(`clowder/project-groups/${encodeURIComponent(bindingId)}/thread`, { method: 'POST', data });
  },
  allowGroup(params) {
    return request('clowder/group/allow', { method: 'POST', data: params });
  },
  denyGroup(params) {
    return request('clowder/group/deny', { method: 'POST', data: params });
  },
  uploadSkill(data) {
    return request('clowder/skills', { method: 'POST', data });
  }
};
