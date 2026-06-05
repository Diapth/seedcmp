import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

describe('artifact provenance (V3-39 §2.2)', () => {
  it('keeps sourcePath/workspaceRelativePath distinct from deliveryUrl for user-workspace sources', async () => {
    const { buildArtifactProvenance } = await import(
      '../dist/domains/artifacts/artifact-provenance.js'
    );

    const userWorkspaceRoot = resolve('/tmp/maomi_workspace');
    const prov = buildArtifactProvenance({
      sourcePath: `${userWorkspaceRoot}/wedding/artifacts/site.tar.gz`,
      deliveryUrl: '/uploads/wedding-abc123.tar.gz',
      downloadName: 'site.tar.gz',
      size: 2048,
      roots: {
        runtimeRoot: resolve('/tmp/proj/.clowder'),
        userWorkspaceRoot,
        deliveryRoot: resolve('/tmp/uploads'),
      },
    });

    assert.equal(prov.sourceLayer, 'userWorkspace');
    assert.equal(prov.sourcePath, `${userWorkspaceRoot}/wedding/artifacts/site.tar.gz`);
    assert.equal(prov.workspaceRelativePath, 'wedding/artifacts/site.tar.gz');
    assert.equal(prov.deliveryUrl, '/uploads/wedding-abc123.tar.gz');
    assert.notEqual(prov.sourcePath, prov.deliveryUrl);
    assert.equal(prov.downloadName, 'site.tar.gz');
    assert.equal(prov.size, 2048);
  });

  it('classifies a runtime-scratch source without a workspace-relative path', async () => {
    const { buildArtifactProvenance } = await import(
      '../dist/domains/artifacts/artifact-provenance.js'
    );

    const runtimeRoot = resolve('/tmp/proj/.clowder');
    const prov = buildArtifactProvenance({
      sourcePath: `${runtimeRoot}/workspaces/t1/scratch.txt`,
      deliveryUrl: '/uploads/scratch-xyz.txt',
      roots: {
        runtimeRoot,
        userWorkspaceRoot: resolve('/tmp/maomi_workspace'),
        deliveryRoot: resolve('/tmp/uploads'),
      },
    });

    assert.equal(prov.sourceLayer, 'runtime');
    assert.equal(prov.workspaceRelativePath, undefined);
    assert.notEqual(prov.sourcePath, prov.deliveryUrl);
  });

  it('rootsFromEnv reads layer roots from environment', async () => {
    const { rootsFromEnv } = await import('../dist/domains/artifacts/artifact-provenance.js');

    const roots = rootsFromEnv({
      CLOWDER_PROJECT_RUNTIME_ROOT: '/tmp/proj/.clowder',
      MAOMI_WORKSPACE_ROOT: '/tmp/maomi_workspace',
      UPLOAD_DIR: '/tmp/uploads',
    });

    assert.equal(roots.runtimeRoot, resolve('/tmp/proj/.clowder'));
    assert.equal(roots.userWorkspaceRoot, resolve('/tmp/maomi_workspace'));
    assert.equal(roots.deliveryRoot, resolve('/tmp/uploads'));
  });
});
