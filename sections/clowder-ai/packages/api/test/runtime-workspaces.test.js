import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import Fastify from 'fastify';

describe('runtime workspaces', () => {
  let tmpRoots = [];
  let originalClowderRoot;
  let originalCatCafeRoot;

  beforeEach(() => {
    tmpRoots = [];
    originalClowderRoot = process.env.CLOWDER_PROJECT_RUNTIME_ROOT;
    originalCatCafeRoot = process.env.CAT_CAFE_PROJECT_RUNTIME_ROOT;
    delete process.env.CLOWDER_PROJECT_RUNTIME_ROOT;
    delete process.env.CAT_CAFE_PROJECT_RUNTIME_ROOT;
  });

  afterEach(async () => {
    if (originalClowderRoot === undefined) delete process.env.CLOWDER_PROJECT_RUNTIME_ROOT;
    else process.env.CLOWDER_PROJECT_RUNTIME_ROOT = originalClowderRoot;
    if (originalCatCafeRoot === undefined) delete process.env.CAT_CAFE_PROJECT_RUNTIME_ROOT;
    else process.env.CAT_CAFE_PROJECT_RUNTIME_ROOT = originalCatCafeRoot;
    await Promise.all(tmpRoots.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function tempDir(prefix) {
    const dir = await mkdtemp(join(tmpdir(), prefix));
    tmpRoots.push(dir);
    return dir;
  }

  it('resolves project runtime root under the project by default, not /tmp', async () => {
    const projectRoot = await tempDir('cat-cafe-project-');
    const { resolveProjectRuntimeRoot, buildAllowedWorkspaceDirs } = await import(
      '../dist/domains/runtime-workspaces/project-runtime-root.js'
    );

    const resolved = await resolveProjectRuntimeRoot({ projectPath: projectRoot });

    assert.ok(resolved);
    assert.equal(resolved.projectRoot, projectRoot);
    assert.equal(resolved.runtimeRoot, join(projectRoot, '.clowder'));
    assert.equal(resolved.source, 'project:.clowder');
    await stat(resolved.runtimeRoot);
    assert.equal(buildAllowedWorkspaceDirs(projectRoot, resolved.runtimeRoot), `${projectRoot}:${resolved.runtimeRoot}`);
  });

  it('uses explicit project runtime root with a project-specific child directory', async () => {
    const projectRoot = await tempDir('cat-cafe-project-');
    const runtimeRoot = await tempDir('cat-cafe-runtime-root-');
    process.env.CLOWDER_PROJECT_RUNTIME_ROOT = runtimeRoot;
    const { resolveProjectRuntimeRoot } = await import('../dist/domains/runtime-workspaces/project-runtime-root.js');

    const resolved = await resolveProjectRuntimeRoot({ projectPath: projectRoot });

    assert.ok(resolved);
    assert.equal(resolved.source, 'env:CLOWDER_PROJECT_RUNTIME_ROOT');
    assert.ok(resolved.runtimeRoot.startsWith(runtimeRoot));
    assert.notEqual(resolved.runtimeRoot, runtimeRoot);
  });

  it('registers workspace metadata and writes a sidecar file', async () => {
    const projectRoot = await tempDir('cat-cafe-project-');
    const { resolveProjectRuntimeRoot } = await import('../dist/domains/runtime-workspaces/project-runtime-root.js');
    const { RuntimeWorkspaceStore } = await import('../dist/domains/runtime-workspaces/RuntimeWorkspaceStore.js');
    const projectRuntime = await resolveProjectRuntimeRoot({ projectPath: projectRoot });
    const store = new RuntimeWorkspaceStore();

    const workspace = await store.register({
      type: 'agent_workspace',
      projectRoot,
      runtimeRoot: projectRuntime.runtimeRoot,
      path: join(projectRuntime.runtimeRoot, 'workspaces', 'thread-1', 'inv-1'),
      threadId: 'thread-1',
      invocationId: 'inv-1',
      ownerCatId: 'opus',
    });

    assert.equal(workspace.threadId, 'thread-1');
    assert.equal(workspace.cleanupPolicy, 'manual_required');
    assert.equal((await store.listByThread('thread-1')).length, 1);
    const sidecar = JSON.parse(await readFile(join(workspace.path, '.clowder-workspace.json'), 'utf-8'));
    assert.equal(sidecar.id, workspace.id);
    assert.equal(sidecar.ownerCatId, 'opus');
  });

  it('lists registered workspaces through the thread route', async () => {
    const projectRoot = await tempDir('cat-cafe-project-');
    const { ThreadStore } = await import('../dist/domains/cats/services/stores/ports/ThreadStore.js');
    const { RuntimeWorkspaceStore } = await import('../dist/domains/runtime-workspaces/RuntimeWorkspaceStore.js');
    const { resolveProjectRuntimeRoot } = await import('../dist/domains/runtime-workspaces/project-runtime-root.js');
    const { threadWorkspacesRoutes } = await import('../dist/routes/thread-workspaces.js');
    const threadStore = new ThreadStore();
    const runtimeWorkspaceStore = new RuntimeWorkspaceStore();
    const thread = threadStore.create('alice', 'Runtime test', projectRoot);
    const projectRuntime = await resolveProjectRuntimeRoot({ projectPath: projectRoot });
    await runtimeWorkspaceStore.register({
      type: 'agent_workspace',
      projectRoot,
      runtimeRoot: projectRuntime.runtimeRoot,
      path: join(projectRuntime.runtimeRoot, 'workspaces', thread.id, 'inv-1'),
      threadId: thread.id,
      invocationId: 'inv-1',
      ownerCatId: 'opus',
    });

    const app = Fastify();
    await app.register(threadWorkspacesRoutes, { threadStore, runtimeWorkspaceStore });
    await app.ready();
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/api/threads/${thread.id}/workspaces`,
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.workspaces.length, 1);
      assert.equal(body.workspaces[0].projectScoped, true);
      assert.equal(body.diagnostics.registered, 1);
      assert.equal(body.diagnostics.outsideProjectRuntime, 0);
    } finally {
      await app.close();
    }
  });
});
