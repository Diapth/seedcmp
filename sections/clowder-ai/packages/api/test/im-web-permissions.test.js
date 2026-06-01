import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemoryConnectorPermissionStore } from '../dist/infrastructure/connectors/ConnectorPermissionStore.js';
import { ImWebPermissionPolicy } from '../dist/infrastructure/connectors/ImWebPermissionPolicy.js';

describe('im-web permission policy', () => {
  it('denies groups outside the whitelist when whitelist is enabled', async () => {
    const store = new MemoryConnectorPermissionStore();
    await store.setWhitelistEnabled('im-web', true);
    await store.allowGroup('im-web', '2:allowed-group', 'Allowed Group');
    const policy = new ImWebPermissionPolicy(store);

    assert.deepEqual(await policy.evaluateGroup('2:allowed-group', { senderId: 'member-1' }), {
      connectorId: 'im-web',
      externalChatId: '2:allowed-group',
      whitelistEnabled: true,
      allowed: true,
      adminOnlyCommands: false,
      adminSenderIds: [],
      disabledReason: undefined,
    });
    assert.deepEqual(await policy.evaluateGroup('2:denied-group', { senderId: 'member-1' }), {
      connectorId: 'im-web',
      externalChatId: '2:denied-group',
      whitelistEnabled: true,
      allowed: false,
      adminOnlyCommands: false,
      adminSenderIds: [],
      disabledReason: 'group_not_allowed',
    });
  });

  it('allows only configured admins to run admin-only commands', async () => {
    const store = new MemoryConnectorPermissionStore();
    await store.setAdminOpenIds('im-web', ['owner-1', 'manager-1']);
    await store.setCommandAdminOnly('im-web', true);
    const policy = new ImWebPermissionPolicy(store);

    assert.equal(await policy.canRunCommand({ senderId: 'owner-1', command: '/allow-group' }), true);
    assert.equal(await policy.canRunCommand({ senderId: 'member-1', command: '/allow-group' }), false);
    assert.equal(await policy.canRunCommand({ senderId: 'member-1', command: 'hello' }), true);
  });
});
