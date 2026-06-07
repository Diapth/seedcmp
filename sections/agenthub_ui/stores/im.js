import { defineStore } from 'pinia';
import { userApi } from '@/api/user.js';
import { storage } from '@/utils/storage.js';
import { useAuthStore } from './auth.js';

export const useImStore = defineStore('im', {
  state: () => ({
    wsAddr: storage.get('im.wsAddr') || '',
    imToken: storage.get('im.token') || '',
    loading: false,
    lastError: ''
  }),
  actions: {
    async fetchImAddress(uid = '') {
      const authStore = useAuthStore();
      const targetUid = uid || authStore.uid;
      if (!targetUid) return null;
      this.loading = true;
      this.lastError = '';
      try {
        const response = await userApi.getImCredentials(targetUid);
        const data = response?.data || response || {};
        this.wsAddr = data.ws_addr || data.wsAddr || '';
        this.imToken = data.token || data.im_token || data.imToken || authStore.accessToken;
        storage.set('im.wsAddr', this.wsAddr);
        storage.set('im.token', this.imToken);
        return data;
      } catch (err) {
        this.lastError = err?.message || '获取 IM 节点失败';
        throw err;
      } finally {
        this.loading = false;
      }
    },
    reset() {
      this.wsAddr = '';
      this.imToken = '';
      this.loading = false;
      this.lastError = '';
      storage.remove('im.wsAddr');
      storage.remove('im.token');
    }
  }
});
