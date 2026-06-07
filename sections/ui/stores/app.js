import { defineStore } from 'pinia';
import { isAuthExpiredError } from '@/services/native-im/api-client';
import { nativeImService } from '@/services/native-im/service';
import { useContactStore } from '@/stores/contact';
import { useConversationStore } from '@/stores/conversation';
import { useMessageStore } from '@/stores/message';

function parseStorageJSON(key) {
  const raw = uni.getStorageSync(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function errorText(error) {
  return error?.msg || error?.message || '请求失败';
}

function redirectToLogin() {
  if (typeof uni === 'undefined' || typeof uni.reLaunch !== 'function') return;
  uni.reLaunch({
    url: '/pages/login/index'
  });
}

export const useAppStore = defineStore('app', {
  state: () => ({
    theme: uni.getStorageSync('app_theme') || 'light',
    token: uni.getStorageSync('app_token') || '',
    currentUser: parseStorageJSON('app_user'),
    connectionState: uni.getStorageSync('app_token') ? 'stored' : 'guest',
    nativeReady: false,
    nativeError: ''
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
      if (user?.id || user?.uid) {
        uni.setStorageSync('app_user_uid', user.id || user.uid);
      }
    },
    async loginWithPassword({ username, password }) {
      this.connectionState = 'logging-in';
      this.nativeError = '';
      try {
        const session = await nativeImService.loginWithPassword({ username, password });
        this.setCurrentUser(session.user, session.token);
        this.connectionState = 'logged-in';
        await this.initializeNativeIm({ sync: true });
        return session;
      } catch (error) {
        this.connectionState = 'login-failed';
        this.nativeError = errorText(error);
        throw error;
      }
    },
    async initializeNativeIm(options = {}) {
      if (!this.currentUser?.id || !this.token) return { connected: false, reason: 'missing-session' };
      this.connectionState = 'connecting';
      this.nativeError = '';
      try {
        const result = await nativeImService.initializeSdk({
          uid: this.currentUser.id,
          token: this.token,
          onMessage: (message) => {
            const messageStore = useMessageStore();
            messageStore.receiveNativeMessage(message);
          },
          onMessageStatus: (ack) => {
            const messageStore = useMessageStore();
            messageStore.updateNativeSendStatus(ack);
          },
          onCmd: () => {
            const conversationStore = useConversationStore();
            const contactStore = useContactStore();
            conversationStore.syncNativeConversations({ silent: true });
            contactStore.fetchNativeFriendRequests({ silent: true });
          },
          onStatus: ({ status, reasonCode }) => {
            this.connectionState = String(status || 'connected');
            if (reasonCode === 2) this.logout();
          },
          onConversation: () => {
            const conversationStore = useConversationStore();
            conversationStore.syncNativeConversations({ silent: true });
          }
        });
        this.nativeReady = result.connected;
        this.connectionState = 'connected';
        if (options.sync !== false) {
          await this.syncNativeBootData();
        }
        return result;
      } catch (error) {
        this.nativeReady = false;
        this.nativeError = errorText(error);
        this.connectionState = error?.sdkUnavailable ? 'http-only' : 'disconnected';
        if (options.sync !== false) {
          await this.syncNativeBootData();
        }
        return { connected: false, error };
      }
    },
    async bootstrapNativeSession() {
      if (!this.currentUser?.id || !this.token) return;
      await this.initializeNativeIm({ sync: true });
    },
    async syncNativeBootData() {
      const conversationStore = useConversationStore();
      const contactStore = useContactStore();
      try {
        await conversationStore.syncNativeConversations({ silent: true, throwOnAuthError: true });
      } catch (error) {
        if (isAuthExpiredError(error)) {
          this.nativeError = '登录已过期，请重新登录';
          this.logout();
          redirectToLogin();
          return { authExpired: true };
        }
        throw error;
      }

      await Promise.allSettled([
        conversationStore.activeId
          ? useMessageStore().syncNativeMessages(conversationStore.activeId, { silent: true })
          : Promise.resolve(),
        contactStore.syncNativeContacts({ silent: true }),
        contactStore.fetchNativeFriendRequests({ silent: true })
      ]);
      return { authExpired: false };
    },
    logout() {
      nativeImService.disconnect();
      this.currentUser = null;
      this.token = '';
      this.nativeReady = false;
      this.nativeError = '';
      this.connectionState = 'guest';
      uni.removeStorageSync('app_user');
      uni.removeStorageSync('app_token');
      uni.removeStorageSync('app_user_uid');
    }
  }
});
