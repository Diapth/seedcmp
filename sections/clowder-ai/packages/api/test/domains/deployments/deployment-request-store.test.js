import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DeploymentRequestStore } from '../../../dist/domains/deployments/DeploymentRequestStore.js';

describe('DeploymentRequestStore', () => {
  it('creates, updates, and transitions a deployment request', async () => {
    const store = new DeploymentRequestStore();

    const created = await store.create({
      userId: 'test-user',
      channelId: 'channel-a',
      channelType: 1,
      originalText: '帮我部署',
      targetCandidates: [
        { id: 'workspace', label: '婚礼', value: '婚礼', source: 'active_workspace' },
      ],
      environmentCandidates: [
        { id: 'local', label: '本地', value: 'local' },
      ],
    });

    assert.equal(created.status, 'needs_fields');
    assert.deepEqual(created.missingFields.sort(), ['environment', 'target']);

    const updated = await store.updateFields(created.id, {
      target: '婚礼',
      environment: 'local',
      sourceMessageId: 'msg-1',
    });

    assert.ok(updated);
    assert.equal(updated.status, 'pending_confirmation');
    assert.deepEqual(updated.missingFields, []);

    const active = await store.listActiveByConversation({
      userId: 'test-user',
      channelId: 'channel-a',
      channelType: 1,
    });
    assert.equal(active.length, 1);
    assert.equal(active[0].id, created.id);

    const confirmed = await store.confirm(created.id);
    assert.ok(confirmed);
    assert.equal(confirmed.status, 'confirmed');

    const afterConfirm = await store.listActiveByConversation({
      userId: 'test-user',
      channelId: 'channel-a',
      channelType: 1,
    });
    assert.equal(afterConfirm.length, 0);

    const cancelled = await store.cancel(created.id);
    assert.ok(cancelled);
    assert.equal(cancelled.status, 'cancelled');
  });
});
