import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, it } from 'node:test';

const tmpRoots = [];

async function createTempDir(prefix = 'artifact-policy-') {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tmpRoots.push(dir);
  return realpath(dir);
}

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('artifact storage policy (V3-39)', () => {
  it('resolves runtime / user-workspace / delivery roots from explicit env', async () => {
    const projectPath = await createTempDir('proj-');
    const runtimeBase = await createTempDir('runtime-');
    const userWorkspace = await createTempDir('user-');
    const uploadDir = await createTempDir('uploads-');
    const launchedProjectRoot = await createTempDir('launched-');

    const { resolveArtifactStoragePolicy } = await import(
      '../dist/domains/artifacts/artifact-storage-policy.js'
    );

    const policy = await resolveArtifactStoragePolicy({
      projectPath,
      launchedProjectRoot,
      env: {
        CLOWDER_PROJECT_RUNTIME_ROOT: runtimeBase,
        MAOMI_WORKSPACE_ROOT: userWorkspace,
        UPLOAD_DIR: uploadDir,
      },
    });

    assert.ok(policy.runtimeRoot, 'runtime root should resolve when a project path is bound');
    assert.ok(policy.runtimeRoot.startsWith(runtimeBase), 'runtime root nests under env base');
    assert.equal(policy.userWorkspaceRoot, userWorkspace);
    assert.equal(policy.deliveryRoot, uploadDir);

    assert.equal(policy.sources.runtime, 'env:CLOWDER_PROJECT_RUNTIME_ROOT');
    assert.equal(policy.sources.userWorkspace, 'env:MAOMI_WORKSPACE_ROOT');
    assert.equal(policy.sources.delivery, 'env:UPLOAD_DIR');
  });

  it('defaults durable user deliverables to maomi_workspace, not the runtime root', async () => {
    const parent = await createTempDir('layout-');
    const launchedProjectRoot = join(parent, 'repo');
    await mkdir(launchedProjectRoot, { recursive: true });

    const { resolveArtifactStoragePolicy } = await import(
      '../dist/domains/artifacts/artifact-storage-policy.js'
    );

    // No MAOMI_WORKSPACE_ROOT / CLOWDER_USER_WORKSPACE_ROOT -> default sibling.
    const policy = await resolveArtifactStoragePolicy({
      projectPath: null,
      launchedProjectRoot,
      env: {},
    });

    assert.equal(policy.sources.userWorkspace, 'default:sibling-maomi_workspace');
    assert.ok(
      policy.userWorkspaceRoot.endsWith('maomi_workspace'),
      'default user workspace settles in maomi_workspace',
    );
    assert.ok(
      !policy.userWorkspaceRoot.includes('.clowder'),
      'durable user workspace must not live under .clowder runtime scratch',
    );
  });

  it('classifies paths into the deepest owning layer', async () => {
    const projectPath = await createTempDir('proj-');
    const runtimeBase = await createTempDir('runtime-');
    const userWorkspace = await createTempDir('user-');
    const uploadDir = await createTempDir('uploads-');
    const launchedProjectRoot = await createTempDir('launched-');

    const { resolveArtifactStoragePolicy, classifyPath } = await import(
      '../dist/domains/artifacts/artifact-storage-policy.js'
    );

    const policy = await resolveArtifactStoragePolicy({
      projectPath,
      launchedProjectRoot,
      env: {
        CLOWDER_PROJECT_RUNTIME_ROOT: runtimeBase,
        MAOMI_WORKSPACE_ROOT: userWorkspace,
        UPLOAD_DIR: uploadDir,
      },
    });

    assert.equal(policy.classify(join(policy.runtimeRoot, 'scratch', 'tmp.txt')), 'runtime');
    assert.equal(policy.classify(join(userWorkspace, 'wedding', 'src', 'index.html')), 'userWorkspace');
    assert.equal(policy.classify(join(uploadDir, 'abc.tar.gz')), 'delivery');
    assert.equal(policy.classify('/etc/passwd'), 'unknown');

    // Standalone classifier agrees with the bound method.
    assert.equal(
      classifyPath(join(userWorkspace, 'todo', 'artifacts', 'plan.md'), policy),
      'userWorkspace',
    );
  });

  it('isDurableUserAsset is true only for user-workspace content', async () => {
    const projectPath = await createTempDir('proj-');
    const runtimeBase = await createTempDir('runtime-');
    const userWorkspace = await createTempDir('user-');
    const uploadDir = await createTempDir('uploads-');
    const launchedProjectRoot = await createTempDir('launched-');

    const { resolveArtifactStoragePolicy } = await import(
      '../dist/domains/artifacts/artifact-storage-policy.js'
    );

    const policy = await resolveArtifactStoragePolicy({
      projectPath,
      launchedProjectRoot,
      env: {
        CLOWDER_PROJECT_RUNTIME_ROOT: runtimeBase,
        MAOMI_WORKSPACE_ROOT: userWorkspace,
        UPLOAD_DIR: uploadDir,
      },
    });

    assert.equal(policy.isDurableUserAsset(join(userWorkspace, 'wedding', 'index.html')), true);
    assert.equal(policy.isDurableUserAsset(join(policy.runtimeRoot, 'scratch.txt')), false);
    assert.equal(policy.isDurableUserAsset(join(uploadDir, 'archive.tar.gz')), false);
  });

  it('cleanup guard: runtime scratch cleanup must not target user/delivery paths', async () => {
    const projectPath = await createTempDir('proj-');
    const runtimeBase = await createTempDir('runtime-');
    const userWorkspace = await createTempDir('user-');
    const uploadDir = await createTempDir('uploads-');
    const launchedProjectRoot = await createTempDir('launched-');

    const { resolveArtifactStoragePolicy } = await import(
      '../dist/domains/artifacts/artifact-storage-policy.js'
    );

    const policy = await resolveArtifactStoragePolicy({
      projectPath,
      launchedProjectRoot,
      env: {
        CLOWDER_PROJECT_RUNTIME_ROOT: runtimeBase,
        MAOMI_WORKSPACE_ROOT: userWorkspace,
        UPLOAD_DIR: uploadDir,
      },
    });

    const candidates = [
      join(policy.runtimeRoot, 'a.tmp'),
      join(userWorkspace, 'keep-me.html'),
      join(uploadDir, 'delivered.tar.gz'),
    ];
    const safeToDeleteAsRuntimeScratch = candidates.filter((p) => policy.classify(p) === 'runtime');

    assert.deepEqual(safeToDeleteAsRuntimeScratch, [join(policy.runtimeRoot, 'a.tmp')]);
  });
});
