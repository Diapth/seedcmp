import { defineStore } from 'pinia';
import { fileApi } from '@/api/file.js';

function normalizeFile(input = {}) {
  return {
    id: input.id || input.file_id || input.url || input.name || '',
    name: input.name || input.filename || '未命名文件',
    size: input.size_text || input.size || '',
    time: Number(input.created_at || input.updated_at || input.time || Date.now()),
    type: input.type || String(input.name || input.filename || '').split('.').pop() || '',
    url: input.url || input.download_url || '',
    previewUrl: input.preview_url || input.previewUrl || '',
    previewContent: input.previewContent || input.content || '',
    raw: input
  };
}

export const useFileStore = defineStore('file', {
  state: () => ({
    files: [],
    loading: false,
    lastError: '',
    unavailableReason: ''
  }),
  actions: {
    async fetchFiles(params = {}) {
      this.loading = true;
      try {
        const response = await fileApi.list(params);
        const data = response?.data || response || {};
        this.files = (data.files || data.items || []).map(normalizeFile);
        return this.files;
      } finally {
        this.loading = false;
      }
    },
    async uploadFile(file) {
      const response = await fileApi.upload(file);
      const data = response?.data || response || {};
      const uploaded = normalizeFile(data.file || data);
      if (uploaded.id) this.files.unshift(uploaded);
      return uploaded;
    },
    async fetchPreview(fileId) {
      const response = await fileApi.getPreview(fileId);
      return response?.data || response || {};
    },
    markUnavailable(reason) {
      this.unavailableReason = reason;
    },
    reset() {
      this.files = [];
      this.loading = false;
      this.lastError = '';
      this.unavailableReason = '';
    }
  }
});
