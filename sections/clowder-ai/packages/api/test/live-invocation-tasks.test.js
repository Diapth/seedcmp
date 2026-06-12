import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('buildLiveInvocationTasks (V3-31 live kanban)', () => {
  it('synthesizes a doing card per running invocation cat', async () => {
    const { buildLiveInvocationTasks } = await import('../dist/routes/thread-tasks.js');

    const live = buildLiveInvocationTasks(
      [{ id: 'inv-1', targetCats: ['xtz'], createdAt: 1000 }],
      'thread-1',
      [],
      5000,
    );

    assert.equal(live.length, 1);
    assert.equal(live[0].status, 'doing');
    assert.equal(live[0].ownerCatId, 'xtz');
    assert.equal(live[0].threadId, 'thread-1');
    assert.equal(live[0].id, 'live:inv-1:xtz');
    assert.equal(live[0].createdBy, 'system');
    assert.equal(live[0].createdAt, 1000);
  });

  it('does not duplicate a cat that already has a real doing task', async () => {
    const { buildLiveInvocationTasks } = await import('../dist/routes/thread-tasks.js');

    const existing = [
      { id: 't1', status: 'doing', ownerCatId: 'xtz', threadId: 'thread-1' },
    ];
    const live = buildLiveInvocationTasks(
      [{ id: 'inv-1', targetCats: ['xtz'], createdAt: 1000 }],
      'thread-1',
      existing,
      5000,
    );

    assert.equal(live.length, 0);
  });

  it('dedups the same cat across overlapping invocations', async () => {
    const { buildLiveInvocationTasks } = await import('../dist/routes/thread-tasks.js');

    const live = buildLiveInvocationTasks(
      [
        { id: 'inv-1', targetCats: ['xtz', 'dd'], createdAt: 1000 },
        { id: 'inv-2', targetCats: ['xtz'], createdAt: 2000 },
      ],
      'thread-1',
      [],
      5000,
    );

    const owners = live.map((t) => t.ownerCatId).sort();
    assert.deepEqual(owners, ['dd', 'xtz']);
  });
});
