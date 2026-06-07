import { defineStore } from 'pinia';
import { storage } from '@/utils/storage.js';

export const useAppStore = defineStore('app', {
  state: () => ({
    theme: storage.get('app_theme') || 'light',
    token: storage.get('app_token') || storage.get('auth.accessToken') || '',
    currentUser: storage.get('app_user') || null,
    kickout: {
      visible: false,
      reason: ''
    }
  }),
  actions: {
    setTheme(newTheme) {
      this.theme = newTheme;
      storage.set('app_theme', newTheme);
      // #ifdef H5
      if (typeof document !== 'undefined') {
        document.documentElement.className = `theme-${newTheme}`;
      }
      // #endif
    },
    setCurrentUser(user, token = '') {
      this.currentUser = user;
      this.token = token || this.token;
      storage.set('app_user', user);
      if (token) storage.set('app_token', token);
    },
    triggerKickout(reason = '登录状态已失效，请重新登录') {
      this.kickout = { visible: true, reason };
      this.logout();
    },
    acknowledgeKickout() {
      this.kickout = { visible: false, reason: '' };
    },
    logout() {
      this.currentUser = null;
      this.token = '';
      storage.clear();
    }
  }
});
