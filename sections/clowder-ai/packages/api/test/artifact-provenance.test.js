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

  it('promotionTargetPath targets the user workspace inbox for a leaked /tmp deliverable', async () => {
    const { promotionTargetPath } = await import('../dist/domains/artifacts/artifact-provenance.js');

    const userRoot = resolve('/home/u/Desktop/maomi_workspace');
    const target = promotionTargetPath('/tmp/test-page.zip', userRoot);
    assert.equal(target, `${userRoot}/_inbox/test-page.zip`);

    // Honors an explicit download name over the source basename.
    const named = promotionTargetPath('/tmp/abc123.zip', userRoot, 'wedding-site.zip');
    assert.equal(named, `${userRoot}/_inbox/wedding-site.zip`);
  });

  it('promotionTargetPath returns null when source already lives in the user workspace or no root is known', async () => {
    const { promotionTargetPath } = await import('../dist/domains/artifacts/artifact-provenance.js');

    const userRoot = resolve('/home/u/Desktop/maomi_workspace');
    assert.equal(promotionTargetPath(`${userRoot}/wedding/site.zip`, userRoot), null);
    assert.equal(promotionTargetPath('/tmp/test-page.zip', null), null);
    assert.equal(promotionTargetPath('/tmp/test-page.zip', ''), null);
  });
});
