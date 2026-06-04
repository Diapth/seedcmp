import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import Fastify from 'fastify';

class FakeRedis {
  constructor() {
    this.strings = new Map();
    this.sets = new Map();
    this.hashes = new Map();
    this.zsets = new Map();
  }

  async get(key) {
    return this.strings.get(key) ?? null;
  }

  async set(key, value) {
    this.strings.set(key, String(value));
    return 'OK';
  }

  async setnx(key, value) {
    if (this.strings.has(key)) return 0;
    this.strings.set(key, String(value));
    return 1;
  }

  async sadd(key, ...members) {
    const set = this.sets.get(key) ?? new Set();
    for (const member of members) set.add(String(member));
    this.sets.set(key, set);
    return members.length;
  }

  async smembers(key) {
    return [...(this.sets.get(key) ?? new Set())];
  }

  async hset(key, data) {
    const hash = this.hashes.get(key) ?? {};
    Object.assign(hash, data);
    this.hashes.set(key, hash);
    return Object.keys(data).length;
  }

  async hgetall(key) {
    return { ...(this.hashes.get(key) ?? {}) };
  }

  async zadd(key, score, member) {
    const zset = this.zsets.get(key) ?? new Map();
    zset.set(String(member), Number(score));
    this.zsets.set(key, zset);
    return 1;
  }

  async zrange(key, start, stop) {
    const rows = [...(this.zsets.get(key) ?? new Map()).entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([member]) => member);
    const end = stop === -1 ? rows.length : stop + 1;
    return rows.slice(start, end);
  }

  async zrem(key, member) {
    return this.zsets.get(key)?.delete(String(member)) ? 1 : 0;
  }

  async del(key) {
    const deleted = Number(this.strings.delete(key))
      + Number(this.sets.delete(key))
      + Number(this.hashes.delete(key))
      + Number(this.zsets.delete(key));
    return deleted;
  }

  async expire() {
    return 1;
  }

  async persist() {
    return 1;
  }

  async eval() {
    throw new Error('FakeRedis eval is not implemented for this test');
  }

  multi() {
    return new FakePipeline(this);
  }
}

class FakePipeline {
  constructor(redis) {
    this.redis = redis;
    this.ops = [];
  }

  set(key, value) {
    this.ops.push(() => this.redis.set(key, value));
    return this;
  }

  sadd(key, ...members) {
    this.ops.push(() => this.redis.sadd(key, ...members));
    return this;
  }

  hset(key, data) {
    this.ops.push(() => this.redis.hset(key, data));
    return this;
  }

  hgetall(key) {
    this.ops.push(() => this.redis.hgetall(key));
    return this;
  }

  zadd(key, score, member) {
    this.ops.push(() => this.redis.zadd(key, score, member));
    return this;
  }

  zrem(key, member) {
    this.ops.push(() => this.redis.zrem(key, member));
    return this;
  }

  del(key) {
    this.ops.push(() => this.redis.del(key));
    return this;
  }

  async exec() {
    const out = [];
    for (const op of this.ops) {
      out.push([null, await op()]);
    }
    return out;
  }
}

describe('Maomi project workspaces', () => {
  let tmpDirs;
  let originalEnv;

  beforeEach(() => {
    tmpDirs = [];
    originalEnv = {
      PROJECT_ALLOWED_ROOTS: process.env.PROJECT_ALLOWED_ROOTS,
      PROJECT_ALLOWED_ROOTS_APPEND: process.env.PROJECT_ALLOWED_ROOTS_APPEND,
      MAOMI_WORKSPACE_ROOT: process.env.MAOMI_WORKSPACE_ROOT,
      CLOWDER_USER_WORKSPACE_ROOT: process.env.CLOWDER_USER_WORKSPACE_ROOT,
    };
  });

  afterEach(async () => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function tempDir(prefix = 'maomi-workspaces-') {
    const dir = await mkdtemp(join(tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
  }

  it('resolves the default root as a sibling maomi_workspace outside the launched repo', async () => {
    const { resolveMaomiWorkspaceRoot } = await import('../dist/domains/maomi-workspaces/workspace-root.js');
    const parent = await tempDir();
    const launchedProjectRoot = join(parent, 'seedcmp');
    await mkdir(join(launchedProjectRoot, '.git'), { recursive: true });

    const root = await resolveMaomiWorkspaceRoot({ launchedProjectRoot, env: {} });
    assert.equal(root.rootPath, await realpath(join(parent, 'maomi_workspace')));
    assert.equal(root.source, 'default:sibling-maomi_workspace');
    assert.equal(root.insideLaunchedProject, false);

    const metadata = JSON.parse(await readFile(join(root.rootPath, '.clowder-root.json'), 'utf-8'));
    assert.equal(metadata.kind, 'maomi_workspace_root');
  });

  it('proposes safe slugs and rejects path-like or reserved slugs', async () => {
    const { isValidMaomiSlug, proposeMaomiSlug, sanitizeMaomiSlug } = await import(
      '../dist/domains/maomi-workspaces/slug.js'
    );

    assert.equal(proposeMaomiSlug('做一个婚礼网页').slug, 'wedding');
    assert.equal(sanitizeMaomiSlug('Todo App!'), 'todo-app');
    assert.equal(isValidMaomiSlug('../seedcmp'), false);
    assert.equal(isValidMaomiSlug('con'), false);
    assert.equal(isValidMaomiSlug('Wedding'), false);
  });

  it('creates, links, archives, and persists workspace metadata without cross-user directory collisions', async () => {
    const { MaomiWorkspaceStore } = await import('../dist/domains/maomi-workspaces/MaomiWorkspaceStore.js');
    const root = await tempDir();
    const store = new MaomiWorkspaceStore(root);

    const workspace = await store.create({
      userId: 'alice',
      slug: 'wedding',
      displayName: '婚礼项目',
      sourceIntent: '做一个婚礼网页',
      createdBy: 'coordinator',
      threadId: 'thread-1',
    });
    assert.equal(workspace.rootPath, resolve(root, 'wedding'));
    assert.deepEqual(workspace.linkedThreadIds, ['thread-1']);
    assert.equal(existsSync(join(workspace.rootPath, '.clowder', 'runtime')), true);

    const projectJson = JSON.parse(await readFile(join(workspace.rootPath, '.clowder', 'project.json'), 'utf-8'));
    assert.equal(projectJson.id, workspace.id);
    assert.equal(projectJson.slug, 'wedding');

    const relinked = await store.linkThread(workspace.id, 'thread-2');
    assert.deepEqual(relinked.linkedThreadIds, ['thread-1', 'thread-2']);
    const linkedTask = await store.linkTask(workspace.id, 'task-1');
    assert.deepEqual(linkedTask.linkedTaskIds, ['task-1']);

    const proposal = await store.propose('alice', '婚礼网页');
    assert.equal(proposal.collision, 'existing_active');
    assert.equal(proposal.existingWorkspaceId, workspace.id);
    assert.equal(proposal.slug, 'wedding-2');

    const crossUserProposal = await store.propose('bob', 'wedding');
    assert.equal(crossUserProposal.collision, 'slug_taken');
    assert.equal(crossUserProposal.slug, 'wedding-2');
    await assert.rejects(
      () => store.create({ userId: 'bob', slug: 'wedding', displayName: 'Bob wedding', createdBy: 'user' }),
      /already exists/,
    );

    const archived = await store.archive(workspace.id);
    assert.equal(archived.status, 'archived');
    assert.deepEqual((await store.listByUser('bob')).map((item) => item.id), []);
  });

  it('persists workspace, binding, and task workspace metadata through Redis-backed stores', async () => {
    const { RedisMaomiWorkspaceStore } = await import('../dist/domains/maomi-workspaces/MaomiWorkspaceStore.js');
    const { RedisThreadWorkspaceBindingStore } = await import(
      '../dist/domains/maomi-workspaces/ThreadWorkspaceBindingStore.js'
    );
    const { RedisTaskStore } = await import(
      '../dist/domains/cats/services/stores/redis/RedisTaskStore.js'
    );
    const redis = new FakeRedis();
    const root = await tempDir();
    const workspaceStore = new RedisMaomiWorkspaceStore(root, redis);
    const bindingStore = new RedisThreadWorkspaceBindingStore(redis);
    const taskStore = new RedisTaskStore(redis);

    const workspace = await workspaceStore.create({
      userId: 'alice',
      slug: 'todo',
      displayName: 'Todo',
      createdBy: 'user',
    });
    assert.equal((await workspaceStore.findBySlug('alice', 'todo')).id, workspace.id);
    assert.equal((await workspaceStore.propose('bob', 'todo')).collision, 'slug_taken');

    await bindingStore.bind('thread-1', 'alice', workspace.id);
    await bindingStore.bind('thread-1', 'alice', 'maomi_other');
    const binding = await bindingStore.clear('thread-1', 'alice');
    assert.equal(binding.activeWorkspaceId, null);
    assert.deepEqual(binding.recentWorkspaceIds, ['maomi_other', workspace.id]);

    const task = await taskStore.create({
      threadId: 'thread-1',
      title: 'Build UI',
      why: 'Need an app',
      createdBy: 'alice',
      workspaceId: workspace.id,
      workspaceRelativePath: 'src/App.tsx',
    });
    assert.equal((await taskStore.get(task.id)).workspaceId, workspace.id);
    const updated = await taskStore.update(task.id, { workspaceRelativePath: 'src/main.tsx' });
    assert.equal(updated.workspaceRelativePath, 'src/main.tsx');
    assert.equal((await taskStore.listByThread('thread-1'))[0].workspaceId, workspace.id);
  });

  it('creates and binds workspaces through routes and mirrors projectPath for compatibility', async () => {
    const { maomiWorkspaceRoutes } = await import('../dist/routes/maomi-workspaces.js');
    const { threadsRoutes } = await import('../dist/routes/threads.js');
    const { MaomiWorkspaceStore } = await import('../dist/domains/maomi-workspaces/MaomiWorkspaceStore.js');
    const { ThreadWorkspaceBindingStore } = await import(
      '../dist/domains/maomi-workspaces/ThreadWorkspaceBindingStore.js'
    );
    const { ThreadStore } = await import('../dist/domains/cats/services/stores/ports/ThreadStore.js');
    const root = await tempDir();
    process.env.PROJECT_ALLOWED_ROOTS = root;
    delete process.env.PROJECT_ALLOWED_ROOTS_APPEND;

    const workspaceStore = new MaomiWorkspaceStore(root);
    const bindingStore = new ThreadWorkspaceBindingStore();
    const threadStore = new ThreadStore();
    const workspaceRoot = { rootPath: root, source: 'default:sibling-maomi_workspace', insideLaunchedProject: false };
    const app = Fastify();
    await app.register(maomiWorkspaceRoutes, { workspaceRoot, workspaceStore, bindingStore, threadStore });
    await app.register(threadsRoutes, { threadStore, maomiWorkspaceStore: workspaceStore, threadWorkspaceBindingStore: bindingStore });
    await app.ready();

    try {
      const createWorkspaceRes = await app.inject({
        method: 'POST',
        url: '/api/maomi-workspaces',
        headers: { 'x-cat-cafe-user': 'alice' },
        payload: { slug: 'wedding', displayName: '婚礼项目', sourceIntent: '做一个婚礼网页' },
      });
      assert.equal(createWorkspaceRes.statusCode, 201);
      const workspace = createWorkspaceRes.json().workspace;

      const createThreadRes = await app.inject({
        method: 'POST',
        url: '/api/threads',
        headers: { 'x-cat-cafe-user': 'alice' },
        payload: { title: '婚礼项目群聊', workspaceId: workspace.id },
      });
      assert.equal(createThreadRes.statusCode, 201);
      const thread = createThreadRes.json();
      assert.equal(thread.projectPath, workspace.rootPath);
      assert.equal((await bindingStore.get(thread.id)).activeWorkspaceId, workspace.id);

      const otherThread = await threadStore.create('alice', '继续修改婚礼', 'default');
      const bindRes = await app.inject({
        method: 'PUT',
        url: `/api/threads/${otherThread.id}/workspace-binding`,
        headers: { 'x-cat-cafe-user': 'alice' },
        payload: { workspaceId: workspace.id },
      });
      assert.equal(bindRes.statusCode, 200);
      assert.equal(bindRes.json().activeWorkspace.id, workspace.id);
      assert.equal((await threadStore.get(otherThread.id)).projectPath, workspace.rootPath);
    } finally {
      await app.close();
    }
  });

  it('attaches active workspace metadata to callback-created tasks and artifact tasks', async () => {
    const { callbacksRoutes } = await import('../dist/routes/callbacks.js');
    const { threadTasksRoutes } = await import('../dist/routes/thread-tasks.js');
    const { InvocationRegistry } = await import(
      '../dist/domains/cats/services/agents/invocation/InvocationRegistry.js'
    );
    const { MessageStore } = await import('../dist/domains/cats/services/stores/ports/MessageStore.js');
    const { TaskStore } = await import('../dist/domains/cats/services/stores/ports/TaskStore.js');
    const { ThreadStore } = await import('../dist/domains/cats/services/stores/ports/ThreadStore.js');
    const { MaomiWorkspaceStore } = await import('../dist/domains/maomi-workspaces/MaomiWorkspaceStore.js');
    const { ThreadWorkspaceBindingStore } = await import(
      '../dist/domains/maomi-workspaces/ThreadWorkspaceBindingStore.js'
    );
    const root = await tempDir();
    process.env.PROJECT_ALLOWED_ROOTS = root;
    delete process.env.PROJECT_ALLOWED_ROOTS_APPEND;

    const registry = new InvocationRegistry();
    const messageStore = new MessageStore();
    const taskStore = new TaskStore();
    const threadStore = new ThreadStore();
    const workspaceStore = new MaomiWorkspaceStore(root);
    const bindingStore = new ThreadWorkspaceBindingStore();
    const socketEvents = [];
    const socketManager = {
      broadcastAgentMessage: (msg) => socketEvents.push({ type: 'agent', msg }),
      broadcastToRoom: (room, event, data) => socketEvents.push({ room, event, data }),
    };
    const workspace = await workspaceStore.create({
      userId: 'user-1',
      slug: 'wedding',
      displayName: '婚礼项目',
      createdBy: 'coordinator',
    });
    const thread = await threadStore.create('user-1', '婚礼项目', workspace.rootPath);
    await bindingStore.bind(thread.id, 'user-1', workspace.id);

    const app = Fastify();
    await app.register(callbacksRoutes, {
      registry,
      messageStore,
      socketManager,
      taskStore,
      threadStore,
      maomiWorkspaceStore: workspaceStore,
      threadWorkspaceBindingStore: bindingStore,
    });
    await app.register(threadTasksRoutes, {
      taskStore,
      threadStore,
      maomiWorkspaceStore: workspaceStore,
      threadWorkspaceBindingStore: bindingStore,
      log: app.log,
    });
    await app.ready();

    try {
      const { invocationId, callbackToken } = await registry.create('user-1', 'opus', thread.id);
      const taskRes = await app.inject({
        method: 'POST',
        url: '/api/callbacks/create-task',
        headers: { 'x-invocation-id': invocationId, 'x-callback-token': callbackToken },
        payload: { title: '搭建婚礼首页', why: '用户确认了项目工作区' },
      });
      assert.equal(taskRes.statusCode, 201);
      const task = taskRes.json().task;
      assert.equal(task.workspaceId, workspace.id);
      assert.equal((await workspaceStore.get(workspace.id)).linkedTaskIds.includes(task.id), true);

      const artifactPath = join(workspace.rootPath, 'src', 'index.html');
      await mkdir(join(workspace.rootPath, 'src'), { recursive: true });
      await writeFile(artifactPath, '<main>Wedding</main>\n', 'utf-8');
      const artifactRes = await app.inject({
        method: 'POST',
        url: `/api/threads/${thread.id}/artifacts`,
        payload: { userId: 'user-1', path: 'src/index.html', kind: 'code', ownerCatId: 'opus' },
      });
      assert.equal(artifactRes.statusCode, 200);
      assert.equal(artifactRes.json().task.workspaceId, workspace.id);
      assert.equal(artifactRes.json().task.workspaceRelativePath, 'src/index.html');

      const artifactsRes = await app.inject({ method: 'GET', url: `/api/threads/${thread.id}/artifacts` });
      assert.equal(artifactsRes.statusCode, 200);
      assert.equal(artifactsRes.json().artifacts[0].workspaceId, workspace.id);
      assert.equal(artifactsRes.json().artifacts[0].workspaceRelativePath, 'src/index.html');
    } finally {
      await app.close();
    }
  });

  it('reports thread/workspace mismatch diagnostics without merging another thread task into the kanban response', async () => {
    const { threadTasksRoutes } = await import('../dist/routes/thread-tasks.js');
    const { TaskStore } = await import('../dist/domains/cats/services/stores/ports/TaskStore.js');
    const { ThreadStore } = await import('../dist/domains/cats/services/stores/ports/ThreadStore.js');
    const { MaomiWorkspaceStore } = await import('../dist/domains/maomi-workspaces/MaomiWorkspaceStore.js');
    const { ThreadWorkspaceBindingStore } = await import(
      '../dist/domains/maomi-workspaces/ThreadWorkspaceBindingStore.js'
    );
    const root = await tempDir();
    const taskStore = new TaskStore();
    const threadStore = new ThreadStore();
    const workspaceStore = new MaomiWorkspaceStore(root);
    const bindingStore = new ThreadWorkspaceBindingStore();
    const workspace = await workspaceStore.create({ userId: 'alice', slug: 'todo', displayName: 'Todo', createdBy: 'user' });
    const threadA = await threadStore.create('alice', '当前会话', workspace.rootPath);
    const threadB = await threadStore.create('alice', '别的会话', workspace.rootPath);
    await bindingStore.bind(threadA.id, 'alice', workspace.id);
    const otherThreadTask = taskStore.create({
      threadId: threadB.id,
      title: '属于别的会话的任务',
      why: '用于诊断',
      createdBy: 'alice',
      workspaceId: workspace.id,
    });

    const app = Fastify();
    await app.register(threadTasksRoutes, {
      taskStore,
      threadStore,
      maomiWorkspaceStore: workspaceStore,
      threadWorkspaceBindingStore: bindingStore,
      log: app.log,
    });
    await app.ready();

    try {
      const res = await app.inject({
        method: 'GET',
        url: `/api/threads/${threadA.id}/tasks?observedTaskIds=${otherThreadTask.id}`,
      });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.deepEqual(body.tasks, []);
      assert.equal(body.diagnostics.state, 'thread_binding_mismatch');
      assert.equal(body.diagnostics.activeWorkspaceId, workspace.id);
      assert.equal(body.diagnostics.mismatchedTasks[0].actualThreadId, threadB.id);
      assert.equal(body.diagnostics.mismatchedTasks[0].taskWorkspaceId, workspace.id);
    } finally {
      await app.close();
    }
  });
});
