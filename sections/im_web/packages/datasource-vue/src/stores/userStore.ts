import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi, userApi } from '../api';
import { StorageService } from '@tsdaodao/base-vue';
import { useSdkStore } from './sdk';
import { useChannelStore } from './channelStore';
import { useGroupStore } from './groupStore';
import { useConversationStore } from './conversationStore';
import { useMessageStore } from './messageStore';

export interface User {
  uid: string;
  name: string;
  short_no?: string;
  sex?: number;
  avatar?: string;
  [key: string]: any;
}

const DEVICE_TEXT_MAX_LENGTH = 100;
const DEVICE_ID_MAX_LENGTH = 40;

function limitDeviceField(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength);
}

function sanitizeLoginCredentials(credentials: any) {
  const next = { ...credentials };
  if (next.device) {
    next.device = {
      ...next.device,
      device_id: limitDeviceField(next.device.device_id, DEVICE_ID_MAX_LENGTH),
      device_name: limitDeviceField(next.device.device_name || 'Web Browser', DEVICE_TEXT_MAX_LENGTH),
      device_model: limitDeviceField(next.device.device_model || 'Web Browser', DEVICE_TEXT_MAX_LENGTH)
    };
  }
  return next;
}

export const useUserStore = defineStore('user', () => {
  const currentUser = ref<User | null>(null);
  const token = ref<string | null>(null);
  const loginInfo = ref<any>(null);
  const userCache = ref<Record<string, User>>({});

  // Initialize from storage on store load
  const storedToken = StorageService.get('token');
  const storedLoginInfo = StorageService.get('loginInfo');
  if (storedToken && storedLoginInfo) {
    token.value = storedToken;
    loginInfo.value = JSON.parse(storedLoginInfo);
      currentUser.value = normalizeUser(loginInfo.value);

    const sdkStore = useSdkStore();
    sdkStore.initializeSDK(currentUser.value.uid, storedToken);
  }

  const isLoggedIn = computed(() => !!token.value);

  function normalizeUser(input: any): User {
    return {
      uid: input.uid,
      name: input.name,
      short_no: input.short_no,
      sex: input.sex,
      avatar: input.avatar || input.logo || ''
    };
  }

  function applyLoginResult(res: any) {
    if (res && res.token) {
      token.value = res.token;
      loginInfo.value = res;
      currentUser.value = normalizeUser(res);

      StorageService.set('token', res.token);
      StorageService.set('uid', res.uid);
      StorageService.set('name', res.name);
      StorageService.set('loginInfo', JSON.stringify(res));

      const sdkStore = useSdkStore();
      sdkStore.initializeSDK(res.uid, res.token);
    }
    return res;
  }

  async function login(credentials: any) {
    const res: any = await authApi.login(sanitizeLoginCredentials(credentials));
    return applyLoginResult(res);
  }

  async function logout(skipRemoteQuit = false) {
    if (!skipRemoteQuit) {
      try {
        await authApi.quit();
      } catch (e) {
        console.warn('Quit api call failed or bypassed', e);
      }
    }
    // Clear storage
    StorageService.clear();
    token.value = null;
    loginInfo.value = null;
    currentUser.value = null;
    userCache.value = {};

    // Reset sibling stores to clear account state and cache
    useChannelStore().reset();
    useGroupStore().reset();
    useConversationStore().reset();
    useMessageStore().reset();

    // Trigger logout event globally so contacts store can catch and reset
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tsdaodao:logout'));
    }

    // Disconnect SDK
    const sdkStore = useSdkStore();
    sdkStore.disconnect();
  }

  async function updateProfile(profile: { name?: string; sex?: number; short_no?: string }) {
    const res: any = await userApi.updateProfile(profile);
    if (currentUser.value) {
      currentUser.value = {
        ...currentUser.value,
        ...profile,
        ...(res || {})
      };
    }
    if (loginInfo.value) {
      loginInfo.value = {
        ...loginInfo.value,
        ...profile,
        ...(res || {})
      };
      StorageService.set('loginInfo', JSON.stringify(loginInfo.value));
    }
    if (profile.name) {
      StorageService.set('name', profile.name);
    }
    return res;
  }

  async function updateAvatar(fileOrUrl: File | string) {
    if (!currentUser.value) {
      throw new Error('No current user');
    }
    if (typeof fileOrUrl === 'string') {
      currentUser.value.avatar = fileOrUrl;
      if (loginInfo.value) {
        loginInfo.value.avatar = fileOrUrl;
        StorageService.set('loginInfo', JSON.stringify(loginInfo.value));
      }
      return { avatar: fileOrUrl };
    }

    const formData = new FormData();
    formData.append('file', fileOrUrl);
    const res: any = await userApi.uploadAvatar(currentUser.value.uid, formData);
    const avatar = res?.url || res?.avatar || res?.path || '';
    if (avatar) {
      currentUser.value.avatar = avatar;
      if (loginInfo.value) {
        loginInfo.value.avatar = avatar;
        StorageService.set('loginInfo', JSON.stringify(loginInfo.value));
      }
    }
    return res;
  }

  // Batch query user profiles with local caching to avoid duplicate requests
  async function getUsersByIds(uids: string[]): Promise<User[]> {
    const missingUids = uids.filter(uid => !userCache.value[uid]);
    if (missingUids.length > 0) {
      await Promise.all(
        missingUids.map(async (uid) => {
          try {
            const res: any = await userApi.getUserInfo(uid);
            if (res) {
              userCache.value[uid] = res;
            }
          } catch (e) {
            console.error(`Failed to fetch info for user ${uid}`, e);
          }
        })
      );
    }
    return uids.map(uid => userCache.value[uid] || { uid, name: '未知用户' });
  }

  return {
    currentUser,
    token,
    loginInfo,
    isLoggedIn,
    userCache,
    applyLoginResult,
    login,
    logout,
    updateProfile,
    updateAvatar,
    getUsersByIds
  };
});
