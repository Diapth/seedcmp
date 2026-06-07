import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useContactStore } from '../../stores/contact.js';
import { resetStorageForTests } from '../../utils/storage.js';
import { resetRequestRuntimeForTests, setRequestAdapter } from '../../utils/request.js';

describe('contact and file user-facing stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetStorageForTests();
    resetRequestRuntimeForTests();
  });

  it('maps real user/search responses without fabricating strangers', async () => {
    setRequestAdapter(async ({ url }) => {
      expect(url).toContain('/user/search?keyword=codex');
      return {
        status: 200,
        data: {
          code: 0,
          data: {
            exist: 1,
            data: {
              uid: 'clowder_cat:codex',
              name: 'qwq',
              avatar: 'https://example.com/codex.png',
              vercode: 'verify-token'
            }
          }
        }
      };
    });

    const contactStore = useContactStore();
    const result = await contactStore.searchUser('codex');

    expect(result).toMatchObject({
      id: 'clowder_cat:codex',
      nickname: 'qwq',
      avatar: 'https://example.com/codex.png',
      relationship: 'stranger',
      vercode: 'verify-token'
    });
  });

  it('returns null when user/search says the user does not exist', async () => {
    setRequestAdapter(async () => ({ status: 200, data: { code: 0, data: { exist: 0 } } }));

    await expect(useContactStore().searchUser('missing-user')).resolves.toBeNull();
  });

  it('maps top-level friend/sync arrays into contacts', async () => {
    setRequestAdapter(async ({ url }) => {
      expect(url).toContain('/friend/sync');
      return {
        status: 200,
        data: [
          {
            uid: 'friend-b',
            name: '测试员B',
            avatar: 'https://example.com/b.png',
            remark: 'B 同学'
          }
        ]
      };
    });

    const contacts = await useContactStore().fetchContacts();

    expect(contacts).toEqual([
      expect.objectContaining({
        id: 'friend-b',
        nickname: '测试员B',
        avatar: 'https://example.com/b.png',
        remark: 'B 同学'
      })
    ]);
  });

  it('passes backend vercode when sending a friend request', async () => {
    const adapter = vi.fn(async ({ url, data }) => {
      expect(url).toContain('/friend/apply');
      expect(data).toMatchObject({
        to_uid: 'target-uid',
        remark: '你好',
        vercode: 'verify-token'
      });
      return { status: 200, data: { code: 0, data: { to_uid: 'target-uid', token: 'apply-token' } } };
    });
    setRequestAdapter(adapter);

    await useContactStore().sendFriendRequest('target-uid', '你好', 'verify-token');

    expect(adapter).toHaveBeenCalledTimes(1);
  });
});
