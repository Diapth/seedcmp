import { defineStore } from 'pinia';
import { authApi } from '@/api/auth.js';
import { storage } from '@/utils/storage.js';
import { setKickoutHandler, setRefreshHandler } from '@/utils/request.js';
import { useAppStore } from './app.js';

function normalizeUsername(value) {
  const raw = String(value || '').trim();
  if (/^0086\d{11}$/.test(raw)) return raw;
  if (/^\d{11}$/.test(raw)) return `0086${raw}`;
  return raw;
}

function buildLoginDevice() {
  const systemInfo = typeof uni !== 'undefined' && uni.getSystemInfoSync
    ? (() => {
        try {
          return uni.getSystemInfoSync();
        } catch {
          return {};
        }
      })()
    : {};
  const platform = systemInfo.platform || 'web';
  return {
    device_id: systemInfo.deviceId || systemInfo.deviceBrand || `agenthub-${platform}`,
    device_name: systemInfo.deviceName || systemInfo.browserName || 'AgentHub H5',
    device_model: systemInfo.model || 'uni-app',
    device_type: platform === 'android' ? 1 : 2
  };
}

function pickToken(payload) {
  return payload?.token || payload?.access_token || payload?.accessToken || '';
}

function pickRefreshToken(payload) {
  return payload?.refresh_token || payload?.refreshToken || '';
}

function normalizeLoginResult(response) {
  const payload = response?.data || response || {};
  return {
    ...payload,
    uid: payload.uid || payload.user?.uid || payload.user_id || '',
    name: payload.name || payload.user?.name || payload.nickname || '',
    avatar: payload.avatar || payload.logo || payload.user?.avatar || '',
    token: pickToken(payload),
    refreshToken: pickRefreshToken(payload),
    expiresAt: Number(payload.expires_at || payload.expiresAt || 0)
  };
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: storage.get('auth.accessToken') || '',
    refreshToken: storage.get('auth.refreshToken') || '',
    expiresAt: Number(storage.get('auth.expiresAt') || 0),
    uid: storage.get('auth.uid') || '',
    loginStatus: 'idle',
    lastError: '',
    qrLogin: {
      available: false,
      uuid: '',
      status: 'unavailable',
      message: '二维码登录后端能力待确认'
    }
  }),
  getters: {
    isLoggedIn(state) {
      return Boolean(state.accessToken && state.uid);
    }
  },
  actions: {
    installRequestHandlers() {
      setRefreshHandler(() => this.refreshAccessToken());
      setKickoutHandler((error) => {
        const appStore = useAppStore();
        appStore.triggerKickout(error?.message || '账号已在其他设备登录');
      });
    },
    setTokens(payload = {}) {
      this.accessToken = payload.accessToken || payload.token || this.accessToken || '';
      this.refreshToken = payload.refreshToken || payload.refresh_token || this.refreshToken || '';
      this.expiresAt = Number(payload.expiresAt || payload.expires_at || this.expiresAt || 0);
      this.uid = payload.uid || this.uid || '';
      if (this.accessToken) storage.set('auth.accessToken', this.accessToken);
      if (this.refreshToken) storage.set('auth.refreshToken', this.refreshToken);
      if (this.expiresAt) storage.set('auth.expiresAt', this.expiresAt);
      if (this.uid) storage.set('auth.uid', this.uid);
      useAppStore().token = this.accessToken;
    },
    applyLoginResult(response) {
      const result = normalizeLoginResult(response);
      this.setTokens({
        accessToken: result.token,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
        uid: result.uid
      });
      storage.set('auth.loginInfo', result);
      useAppStore().setCurrentUser(result, result.token);
      return result;
    },
    async login(credentials) {
      this.loginStatus = 'submitting';
      this.lastError = '';
      try {
        const username = normalizeUsername(credentials.username || credentials.phone || credentials.account);
        const result = await authApi.login({
          ...credentials,
          username,
          flag: credentials.flag ?? 1,
          device: credentials.device || buildLoginDevice()
        });
        const normalized = this.applyLoginResult(result);
        this.loginStatus = 'success';
        return normalized;
      } catch (err) {
        this.loginStatus = 'failed';
        this.lastError = err?.message || '登录失败';
        throw err;
      }
    },
    async register(payload) {
      this.loginStatus = 'submitting';
      this.lastError = '';
      try {
        const result = await authApi.register({
          zone: '0086',
          ...payload,
          phone: String(payload.phone || '').replace(/^0086/, '')
        });
        const data = result?.data || result;
        if (data?.token || data?.access_token) {
          this.applyLoginResult(result);
        }
        this.loginStatus = 'success';
        return data;
      } catch (err) {
        this.loginStatus = 'failed';
        this.lastError = err?.message || '注册失败';
        throw err;
      }
    },
    async sendRegisterCode(phone) {
      return authApi.getRegisterSmsCode({ zone: '0086', phone: String(phone || '').replace(/^0086/, '') });
    },
    async refreshAccessToken() {
      if (!this.refreshToken) {
        throw new Error('缺少 refresh token');
      }
      const result = await authApi.refreshToken(this.refreshToken);
      const data = result?.data || result || {};
      this.setTokens({
        accessToken: data.token || data.access_token,
        refreshToken: data.refresh_token || data.refreshToken || this.refreshToken,
        expiresAt: data.expires_at || data.expiresAt,
        uid: data.uid || this.uid
      });
      return this.accessToken;
    },
    async bootstrap() {
      this.installRequestHandlers();
      const loginInfo = storage.get('auth.loginInfo') || storage.get('app_user');
      if (this.accessToken && loginInfo) {
        useAppStore().setCurrentUser(loginInfo, this.accessToken);
      }
      return this.isLoggedIn;
    },
    async logout(skipRemote = false) {
      if (!skipRemote) {
        try {
          await authApi.quit();
        } catch {
          // Local logout must still complete if the token is already invalid.
        }
      }
      this.accessToken = '';
      this.refreshToken = '';
      this.expiresAt = 0;
      this.uid = '';
      this.loginStatus = 'idle';
      storage.clear();
      useAppStore().logout();
    }
  }
});
