/**
 * Task Callback Integration Tests
 * 验证 MCP update-task 回传端点与 TaskStore 的集成
 *
 * 使用 Fastify injection + 真实 InvocationRegistry + TaskStore
 */

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { before, beforeEach, describe, test } from 'node:test';
import '../helpers/setup-cat-registry.js';
import Fastify from 'fastify';

const { InvocationRegistry } = await import('../../dist/domains/cats/services/agents/invocation/InvocationRegistry.js');
const { TaskStore } = await import('../../dist/domains/cats/services/stores/ports/TaskStore.js');
const { ThreadStore } = await import('../../dist/domains/cats/services/stores/ports/ThreadStore.js');
const { MessageStore } = await import('../../dist/domains/cats/services/stores/ports/MessageStore.js');
const { callbacksRoutes } = await import('../../dist/routes/callbacks.js');
const { threadTasksRoutes } = await import('../../dist/routes/thread-tasks.js');

function createMockSocketManager() {
  const events = [];
  return {
    broadcastAgentMessage(msg) {
      events.push({ type: 'agent', msg });
    },
    broadcastToRoom(room, event, data) {
      events.push({ room, event, data });
    },
    getEvents() {
      return events;
    },
  };
}

describe('Task Callback Integration', () => {
  let registry;
  let messageStore;
  let taskStore;
  let threadStore;
  let socketManager;

  beforeEach(() => {
    registry = new InvocationRegistry();
    messageStore = new MessageStore();
    taskStore = new TaskStore();
    threadStore = new ThreadStore();
    socketManager = createMockSocketManager();
  });

  async function createApp() {
    const app = Fastify();
    await app.register(callbacksRoutes, {
      registry,
      messageStore,
      socketManager,
      taskStore,
      threadStore,
    });
    await app.register(threadTasksRoutes, {
      taskStore,
      threadStore,
      log: app.log,
    });
    return app;
  }

  test('MCP update-task succeeds for owned task', async () => {
    const app = await createApp();

    // Create invocation for opus
    const { invocationId, callbackToken } = await registry.create('user-1', 'opus', 'thread-1');

    // Create a task owned by opus
    const task = taskStore.create({
      threadId: 'thread-1',
      title: 'Test task',
      why: 'Testing',
      createdBy: 'user',
      ownerCatId: 'opus',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-task',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: {
        taskId: task.id,
        status: 'doing',
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.task.status, 'doing');

    // Verify broadcast
    const events = socketManager.getEvents();
    const taskEvent = events.find((e) => e.event === 'task_updated');
    assert.ok(taskEvent, 'task_updated event should be broadcast');
    assert.equal(taskEvent.room, 'thread:thread-1');
  });

  test('MCP update-task rejects invalid credentials', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-task',
      payload: {
        invocationId: 'bad-id',
        callbackToken: 'bad-token',
        taskId: 'some-task',
        status: 'done',
      },
    });

    assert.equal(response.statusCode, 401);
  });

  test('MCP update-task rejects task owned by another cat', async () => {
    const app = await createApp();

    // Invocation for codex
    const { invocationId, callbackToken } = await registry.create('user-1', 'codex', 'thread-1');

    // Task owned by opus
    const task = taskStore.create({
      threadId: 'thread-1',
      title: 'Opus task',
      why: 'Testing',
      createdBy: 'user',
      ownerCatId: 'opus',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-task',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: {
        taskId: task.id,
        status: 'done',
      },
    });

    assert.equal(response.statusCode, 403);
  });

  test('MCP update-task allows unowned task', async () => {
    const app = await createApp();

    const { invocationId, callbackToken } = await registry.create('user-1', 'opus', 'thread-1');

    // Task with no owner
    const task = taskStore.create({
      threadId: 'thread-1',
      title: 'Unowned task',
      why: 'Anyone can update',
      createdBy: 'user',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-task',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: {
        taskId: task.id,
        status: 'doing',
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().task.status, 'doing');
  });

  test('MCP update-task rejects cross-thread update', async () => {
    const app = await createApp();

    // Invocation in thread-A
    const { invocationId, callbackToken } = await registry.create('user-1', 'opus', 'thread-A');

    // Task in thread-B
    const task = taskStore.create({
      threadId: 'thread-B',
      title: 'Task in another thread',
      why: 'Cross-thread test',
      createdBy: 'user',
      ownerCatId: 'opus',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/update-task',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: {
        taskId: task.id,
        status: 'done',
      },
    });

    assert.equal(response.statusCode, 403);
    assert.match(response.json().error, /different thread/);
  });

  // --- F160: cat_cafe_create_task ---

  test('MCP create-task succeeds with valid input', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = await registry.create('user-1', 'opus', 'thread-1');

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/create-task',
      payload: {
        invocationId,
        callbackToken,
        title: 'Fix login bug',
        why: 'Users are getting 500 errors on login',
      },
    });

    assert.equal(response.statusCode, 201);
    const body = response.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.task.title, 'Fix login bug');
    assert.equal(body.task.kind, 'work');
    assert.equal(body.task.threadId, 'thread-1');
    assert.equal(body.task.createdBy, 'opus');
    assert.equal(body.task.status, 'todo');

    const events = socketManager.getEvents();
    const createEvent = events.find((e) => e.event === 'task_created');
    assert.ok(createEvent, 'task_created event should be broadcast');
    assert.equal(createEvent.room, 'thread:thread-1');
  });

  test('thread task route returns callback-created tasks with diagnostics', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = await registry.create('user-1', 'opus', 'thread-1');

    const created = await app.inject({
      method: 'POST',
      url: '/api/callbacks/create-task',
      payload: {
        invocationId,
        callbackToken,
        title: 'Make wedding page',
        why: 'User asked coordinator to create the first page',
        ownerCatId: 'codex',
      },
    });

    assert.equal(created.statusCode, 201);
    const taskId = created.json().task.id;

    const listed = await app.inject({
      method: 'GET',
      url: `/api/threads/thread-1/tasks?expectedTaskId=${encodeURIComponent(taskId)}`,
    });

    assert.equal(listed.statusCode, 200);
    const body = listed.json();
    assert.equal(body.threadId, 'thread-1');
    assert.equal(body.tasks.length, 1);
    assert.equal(body.tasks[0].id, taskId);
    assert.equal(body.diagnostics.state, 'ok');
    assert.equal(body.diagnostics.taskCount, 1);
    assert.deepEqual(body.diagnostics.mismatchedTasks, []);
  });

  test('thread task route reports expected task bound to another thread', async () => {
    const app = await createApp();
    const task = taskStore.create({
      threadId: 'thread-other',
      title: 'Task in another invocation thread',
      why: 'Regression guard for IM Web binding mismatch',
      createdBy: 'user',
      ownerCatId: 'codex',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/threads/thread-current/tasks?expectedTaskId=${encodeURIComponent(task.id)}`,
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.threadId, 'thread-current');
    assert.equal(body.tasks.length, 0);
    assert.equal(body.diagnostics.state, 'thread_binding_mismatch');
    assert.equal(body.diagnostics.mismatchedTasks[0].taskId, task.id);
    assert.equal(body.diagnostics.mismatchedTasks[0].expectedThreadId, 'thread-current');
    assert.equal(body.diagnostics.mismatchedTasks[0].actualThreadId, 'thread-other');
  });

  test('MCP create-task rejects invalid credentials', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/create-task',
      payload: {
        invocationId: 'bad-id',
        callbackToken: 'bad-token',
        title: 'Some task',
      },
    });

    assert.equal(response.statusCode, 401);
  });

  test('MCP create-task enforces kind=work even if kind field sent (AC-A4 regression guard)', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = await registry.create('user-1', 'opus', 'thread-1');

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/create-task',
      payload: {
        invocationId,
        callbackToken,
        title: 'PR #42',
        kind: 'pr_tracking',
      },
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().task.kind, 'work', 'kind must be forced to work regardless of input');
  });

  test('MCP create-task with ownerCatId', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = await registry.create('user-1', 'opus', 'thread-1');

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/create-task',
      payload: {
        invocationId,
        callbackToken,
        title: 'Review docs',
        why: 'Needs fresh eyes',
        ownerCatId: 'codex',
      },
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().task.ownerCatId, 'codex');
  });

  test('MCP create-task rejects empty title', async () => {
    const app = await createApp();
    const { invocationId, callbackToken } = await registry.create('user-1', 'opus', 'thread-1');

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/create-task',
      payload: {
        invocationId,
        callbackToken,
        title: '',
      },
    });

    assert.equal(response.statusCode, 400);
  });

  test('MCP declare-artifact creates a task-scoped artifact ledger entry', async () => {
    const app = await createApp();
    const projectRoot = join(tmpdir(), `cat-cafe-artifact-${Date.now()}`);
    await mkdir(projectRoot, { recursive: true });
    await writeFile(join(projectRoot, 'result.md'), '# done\n');
    const thread = threadStore.create('user-1', 'Artifacts', projectRoot);
    const { invocationId, callbackToken } = await registry.create('user-1', 'opus', thread.id);

    const response = await app.inject({
      method: 'POST',
      url: '/api/callbacks/declare-artifact',
      headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
      payload: {
        path: 'result.md',
        kind: 'doc',
        description: 'Final markdown deliverable',
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.artifact.path, 'result.md');
    assert.equal(body.artifact.ownerCatId, 'opus');

    const events = socketManager.getEvents();
    assert.ok(events.some((e) => e.event === 'artifact_declared'), 'artifact_declared event should be broadcast');

    const artifactsRes = await app.inject({
      method: 'GET',
      url: `/api/threads/${thread.id}/artifacts`,
    });
    assert.equal(artifactsRes.statusCode, 200);
    const artifactsBody = artifactsRes.json();
    assert.equal(artifactsBody.artifacts.length, 1);
    assert.equal(artifactsBody.artifacts[0].status, 'available');
    assert.equal(artifactsBody.artifacts[0].path, 'result.md');
    assert.equal(artifactsBody.artifacts[0].kind, 'doc');
    assert.equal(artifactsBody.artifacts[0].description, 'Final markdown deliverable');
    assert.equal(artifactsBody.artifacts[0].source, 'declared');
  });

  test('thread artifacts route returns missing refs as diagnostics', async () => {
    const app = await createApp();
    const projectRoot = join(tmpdir(), `cat-cafe-artifact-missing-${Date.now()}`);
    await mkdir(projectRoot, { recursive: true });
    const thread = threadStore.create('user-1', 'Artifacts', projectRoot);
    taskStore.create({
      threadId: thread.id,
      title: 'Missing output',
      why: 'diagnostic',
      createdBy: 'opus',
      ownerCatId: 'opus',
      artifactRefs: ['missing.txt'],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/threads/${thread.id}/artifacts`,
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.artifacts.length, 1);
    assert.equal(body.artifacts[0].status, 'missing');
    assert.equal(body.diagnostics.missing, 1);
  });
});
