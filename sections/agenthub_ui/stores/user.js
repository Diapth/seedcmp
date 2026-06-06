import { defineStore } from 'pinia';
import { userApi } from '@/api/user.js';
import { useAppStore } from './app.js';
import { useAuthStore } from './auth.js';

function normalizeUser(input = {}) {
  return {
    ...input,
    uid: input.uid || input.id || input.user_id || '',
    id: input.uid || input.id || input.user_id || '',
    name: input.name || input.nickname || '',
    nickname: input.nickname || input.name || '',
    avatar: input.avatar || input.logo || ''
  };
}

export const useUserStore = defineStore('user', {
  state: () => ({
    currentUser: null,
    userCache: {},
    loading: false,
    lastError: ''
  }),
  actions: {
    normalizeUser,
    async fetchMe() {
      const authStore = useAuthStore();
      if (!authStore.uid) return null;
      this.loading = true;
      this.lastError = '';
      try {
        const response = await userApi.getUserInfo(authStore.uid);
        const user = normalizeUser(response?.data || response || {});
        this.currentUser = user;
        this.userCache[user.uid] = user;
        useAppStore().setCurrentUser(user, authStore.accessToken);
        return user;
      } catch (err) {
        this.lastError = err?.message || '获取用户信息失败';
        throw err;
      } finally {
        this.loading = false;
      }
    },
    async updateProfile(patch) {
      const response = await userApi.updateProfile(patch);
      const user = normalizeUser({ ...(this.currentUser || {}), ...patch, ...(response?.data || response || {}) });
      this.currentUser = user;
      this.userCache[user.uid] = user;
      useAppStore().setCurrentUser(user);
      return user;
    },
    async fetchUser(uid) {
      if (!uid) return null;
      if (this.userCache[uid]) return this.userCache[uid];
      const response = await userApi.getUserInfo(uid);
      const user = normalizeUser(response?.data || response || {});
      this.userCache[user.uid] = user;
      return user;
    },
    async getUsersByIds(uids = []) {
      const unique = Array.from(new Set(uids.filter(Boolean)));
      return Promise.all(unique.map((uid) => this.fetchUser(uid)));
    },
    reset() {
      this.currentUser = null;
      this.userCache = {};
      this.loading = false;
      this.lastError = '';
    }
  }
});
