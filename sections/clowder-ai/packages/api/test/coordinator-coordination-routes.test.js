import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import Fastify from 'fastify';
import { InMemoryCoordinatorStore } from '../dist/domains/cats/services/stores/ports/CoordinatorStore.js';
import { coordinatorCoordinationRoutes } from '../dist/routes/coordinator-coordination.js';

const HEADERS = {
  'content-type': 'application/json',
  'x-cat-cafe-user': 'user-a',
};

describe('coordinator coordination routes', () => {
  let app;

  beforeEach(() => {
    app = Fastify();
    app.register(coordinatorCoordinationRoutes, { coordinatorStore: new InMemoryCoordinatorStore() });
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates, gets, lists, updates, and cancels coordination records', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/coordinator/coordination',
      headers: HEADERS,
      payload: {
        threadId: 'thread-routes',
        sourceMessageId: 'msg-1',
        goal: 'Build and deploy a landing page',
        assumptions: ['static site'],
        targetCatIds: ['codex', 'claude'],
        subtasks: [{ id: 'task-a', title: 'Implement page', targetCatId: 'codex' }],
        dispatchMode: 'parallel',
      },
    });
    assert.equal(createRes.statusCode, 201);
    const created = JSON.parse(createRes.payload).coordination;
    assert.equal(created.createdBy, 'user-a');
    assert.equal(created.status, 'planning');

    const duplicateRes = await app.inject({
      method: 'POST',
      url: '/api/coordinator/coordination',
      headers: HEADERS,
      payload: {
        threadId: 'thread-routes',
        sourceMessageId: 'msg-1',
        goal: 'Duplicate should be ignored',
      },
    });
    assert.equal(duplicateRes.statusCode, 200);
    assert.equal(JSON.parse(duplicateRes.payload).duplicate, true);
    assert.equal(JSON.parse(duplicateRes.payload).coordination.coordinationId, created.coordinationId);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/coordinator/coordination/${encodeURIComponent(created.coordinationId)}`,
      headers: HEADERS,
    });
    assert.equal(getRes.statusCode, 200);
    assert.equal(JSON.parse(getRes.payload).coordination.goal, 'Build and deploy a landing page');

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/threads/thread-routes/coordinations',
      headers: HEADERS,
    });
    assert.equal(listRes.statusCode, 200);
    assert.equal(JSON.parse(listRes.payload).coordinations.length, 1);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/coordinator/coordination/${encodeURIComponent(created.coordinationId)}`,
      headers: HEADERS,
      payload: {
        status: 'dispatching',
        aggregateSummary: 'plan ready',
      },
    });
    assert.equal(patchRes.statusCode, 200);
    assert.equal(JSON.parse(patchRes.payload).coordination.status, 'dispatching');

    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/coordinator/coordination/${encodeURIComponent(created.coordinationId)}/cancel`,
      headers: HEADERS,
      payload: { reason: 'manual test' },
    });
    assert.equal(cancelRes.statusCode, 200);
    const cancelled = JSON.parse(cancelRes.payload).coordination;
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.failureReason, 'manual test');
  });
});
