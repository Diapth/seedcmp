import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    theme: uni.getStorageSync('app_theme') || 'light',
    token: uni.getStorageSync('app_token') || '',
    currentUser: uni.getStorageSync('app_user') ? JSON.parse(uni.getStorageSync('app_user')) : null
  }),
  actions: {
    setTheme(newTheme) {
      this.theme = newTheme;
      uni.setStorageSync('app_theme', newTheme);
      // #ifdef H5
      document.documentElement.className = `theme-${newTheme}`;
      // #endif
    },
    setCurrentUser(user, token = '') {
      this.currentUser = user;
      this.token = token;
      uni.setStorageSync('app_user', JSON.stringify(user));
      uni.setStorageSync('app_token', token);
    },
    logout() {
      this.currentUser = null;
      this.token = '';
      uni.removeStorageSync('app_user');
      uni.removeStorageSync('app_token');
    }
  }
});
