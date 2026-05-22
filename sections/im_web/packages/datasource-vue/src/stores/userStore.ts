import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi, userApi } from '../api';
import { StorageService } from '@tsdaodao/base-vue';
import { useSdkStore } from './sdk';

export interface User {
  uid: string;
  name: string;
  short_no?: string;
  sex?: number;
  [key: string]: any;
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
    currentUser.value = {
      uid: loginInfo.value.uid,
      name: loginInfo.value.name,
      short_no: loginInfo.value.short_no,
      sex: loginInfo.value.sex
    };

    const sdkStore = useSdkStore();
    sdkStore.initializeSDK(currentUser.value.uid, storedToken);
  }

  const isLoggedIn = computed(() => !!token.value);

  async function login(credentials: any) {
    const res: any = await authApi.login(credentials);
    if (res && res.token) {
      token.value = res.token;
      loginInfo.value = res;
      currentUser.value = {
        uid: res.uid,
        name: res.name,
        short_no: res.short_no,
        sex: res.sex
      };

      // Store in StorageService
      StorageService.set('token', res.token);
      StorageService.set('uid', res.uid);
      StorageService.set('name', res.name);
      StorageService.set('loginInfo', JSON.stringify(res));

      // Auto initialize SDK
      const sdkStore = useSdkStore();
      sdkStore.initializeSDK(res.uid, res.token);
    }
    return res;
  }

  async function logout() {
    try {
      await authApi.quit();
    } catch (e) {
      console.warn('Quit api call failed or bypassed', e);
    }
    // Clear storage
    StorageService.clear();
    token.value = null;
    loginInfo.value = null;
    currentUser.value = null;

    // Disconnect SDK
    const sdkStore = useSdkStore();
    sdkStore.disconnect();
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
    login,
    logout,
    getUsersByIds
  };
});
