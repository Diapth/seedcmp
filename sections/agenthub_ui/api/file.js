import { request } from '@/utils/request.js';

export const fileApi = {
  list(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(query ? `files?${query}` : 'files');
  },
  upload(data) {
    return request('files', { method: 'POST', data });
  },
  get(fileId) {
    return request(`files/${encodeURIComponent(fileId)}`);
  },
  getPreview(fileId) {
    return request(`files/${encodeURIComponent(fileId)}/preview`);
  },
  remove(fileId) {
    return request(`files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
  }
};
