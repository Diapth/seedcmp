import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

describe('buildAllowedWorkspaceDirs extraDirs (V3-39 write boundary)', () => {
  it('includes maomi_workspace + current worktree roots and dedups', async () => {
    const { buildAllowedWorkspaceDirs } = await import(
      '../dist/domains/runtime-workspaces/project-runtime-root.js'
    );

    const projectRoot = '/home/u/repo/packages/api';
    const runtimeRoot = '/home/u/repo/packages/api/.clowder';
    const worktreeRoot = '/home/u/repo';
    const maomiRoot = '/home/u/maomi_workspace';

    const result = buildAllowedWorkspaceDirs(projectRoot, runtimeRoot, undefined, [
      worktreeRoot,
      maomiRoot,
      worktreeRoot, // duplicate → must be deduped
    ]);
    const parts = result.split(':');

    assert.ok(parts.includes(resolve(projectRoot)));
    assert.ok(parts.includes(resolve(runtimeRoot)));
    assert.ok(parts.includes(resolve(worktreeRoot)), 'current worktree root is writable');
    assert.ok(parts.includes(resolve(maomiRoot)), 'maomi_workspace is writable');
    assert.equal(parts.filter((p) => p === resolve(worktreeRoot)).length, 1, 'no duplicate worktree entry');
  });

  it('merges existing ALLOWED_WORKSPACE_DIRS and drops empties', async () => {
    const { buildAllowedWorkspaceDirs } = await import(
      '../dist/domains/runtime-workspaces/project-runtime-root.js'
    );
    const result = buildAllowedWorkspaceDirs('/a', '/a/.clowder', '/extra1:/extra2', [
      '',
      '/maomi',
    ]);
    const parts = result.split(':');
    assert.ok(parts.includes(resolve('/extra1')));
    assert.ok(parts.includes(resolve('/extra2')));
    assert.ok(parts.includes(resolve('/maomi')));
    assert.ok(!parts.includes(''), 'no empty entries');
  });
});
