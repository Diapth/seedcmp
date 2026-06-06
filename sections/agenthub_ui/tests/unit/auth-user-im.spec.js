import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAppStore } from '../../stores/app.js';
import { useAuthStore } from '../../stores/auth.js';
import { useImStore } from '../../stores/im.js';
import { useUserStore } from '../../stores/user.js';
import { memoryStorage, resetStorageForTests } from '../../utils/storage.js';
import { resetRequestRuntimeForTests, setRequestAdapter } from '../../utils/request.js';

describe('auth, user and im stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetStorageForTests();
    resetRequestRuntimeForTests();
  });

  it('logs in against the real auth API shape and persists tokens through the storage abstraction', async () => {
    setRequestAdapter(async ({ url }) => {
      expect(url).toContain('/user/login');
      return {
        status: 200,
        data: {
          code: 0,
          data: {
            token: 'access-a',
            refresh_token: 'refresh-a',
            uid: 'u-1',
            name: '真实用户',
            avatar: 'https://example.com/a.png'
          }
        }
      };
    });

    const authStore = useAuthStore();
    const result = await authStore.login({ username: '13800000000', password: 'secret' });

    expect(result.uid).toBe('u-1');
    expect(authStore.accessToken).toBe('access-a');
    expect(memoryStorage.get('auth.accessToken')).toBe('access-a');
    expect(useAppStore().currentUser.name).toBe('真实用户');
  });

  it('fetches current user and mirrors it into app store', async () => {
    setRequestAdapter(async ({ url }) => {
      expect(url).toContain('/users/u-2');
      return { status: 200, data: { code: 0, data: { uid: 'u-2', name: '后端用户' } } };
    });
    const authStore = useAuthStore();
    authStore.setTokens({ accessToken: 'token', uid: 'u-2' });

    const userStore = useUserStore();
    await userStore.fetchMe();

    expect(userStore.currentUser.uid).toBe('u-2');
    expect(useAppStore().currentUser.uid).toBe('u-2');
  });

  it('loads IM credentials after login and caches ws_addr for SDK initialization', async () => {
    setRequestAdapter(async ({ url }) => {
      expect(url).toContain('/users/u-3/im');
      return {
        status: 200,
        data: {
          code: 0,
          data: { token: 'im-token', ws_addr: 'ws://127.0.0.1:5200' }
        }
      };
    });
    const authStore = useAuthStore();
    authStore.setTokens({ accessToken: 'token', uid: 'u-3' });

    const imStore = useImStore();
    await imStore.fetchImAddress();

    expect(imStore.imToken).toBe('im-token');
    expect(imStore.wsAddr).toBe('ws://127.0.0.1:5200');
    expect(memoryStorage.get('im.wsAddr')).toBe('ws://127.0.0.1:5200');
  });
});
