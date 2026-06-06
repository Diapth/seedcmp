import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  failCoordination,
  InMemoryCoordinatorStore,
  isValidCoordinationTransition,
} from '../dist/domains/cats/services/stores/ports/CoordinatorStore.js';

describe('CoordinatorStore coordination state', () => {
  it('validates legal transitions and rejects terminal rewrites', async () => {
    assert.equal(isValidCoordinationTransition('planning', 'dispatching'), true);
    assert.equal(isValidCoordinationTransition('dispatching', 'running'), true);
    assert.equal(isValidCoordinationTransition('running', 'aggregating'), true);
    assert.equal(isValidCoordinationTransition('aggregating', 'succeeded'), true);
    assert.equal(isValidCoordinationTransition('succeeded', 'running'), false);

    const store = new InMemoryCoordinatorStore();
    const { coordination } = await store.create({
      coordinationId: 'coord-state',
      threadId: 'thread-a',
      createdBy: 'user-a',
      goal: 'build and test',
    });

    await store.transition(coordination.coordinationId, 'dispatching');
    await store.transition(coordination.coordinationId, 'running');
    await store.transition(coordination.coordinationId, 'aggregating');
    await store.transition(coordination.coordinationId, 'succeeded');
    await assert.rejects(
      () => store.transition(coordination.coordinationId, 'running'),
      /Invalid coordination transition/,
    );
  });

  it('creates idempotently and deduplicates repeated dispatch targets/subtasks', async () => {
    const store = new InMemoryCoordinatorStore();
    const first = await store.create({
      threadId: 'thread-b',
      sourceMessageId: 'msg-1',
      createdBy: 'user-a',
      goal: 'ship page',
      targetCatIds: ['codex', 'codex', 'claude'],
      subtasks: [
        { id: 'task-1', title: 'Implement', targetCatId: 'codex' },
        { id: 'task-1', title: 'Implement duplicate', targetCatId: 'codex' },
      ],
    });
    const second = await store.create({
      threadId: 'thread-b',
      sourceMessageId: 'msg-1',
      createdBy: 'user-a',
      goal: 'ship page again',
    });

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.coordination.coordinationId, first.coordination.coordinationId);
    assert.deepEqual(first.coordination.targetCatIds, ['codex', 'claude']);
    assert.equal(first.coordination.subtasks.length, 1);
  });

  it('marks failure and cancellation with terminal metadata', async () => {
    const store = new InMemoryCoordinatorStore();
    const { coordination } = await store.create({
      coordinationId: 'coord-failure',
      threadId: 'thread-c',
      createdBy: 'user-a',
      goal: 'deploy',
    });
    const failed = failCoordination(coordination, 'agent unavailable');
    assert.equal(failed.status, 'failed');
    assert.equal(failed.failureReason, 'agent unavailable');
    assert.ok(failed.completedAt);

    const cancelled = await store.cancel(coordination.coordinationId, 'user cancelled');
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.failureReason, 'user cancelled');
  });
});
