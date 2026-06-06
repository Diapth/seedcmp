import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';

const API_DIR = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(API_DIR, '../..');
const mod = await import('../dist/utils/skill-mount.js');

describe('resolveMainRepoPath', () => {
  it('falls back to the repository root when git is unavailable', () => {
    const script = `
const mod = await import('./dist/utils/skill-mount.js');
console.log(await mod.resolveMainRepoPath());
`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: API_DIR,
      env: { ...process.env, PATH: '/nonexistent' },
      encoding: 'utf8',
      timeout: 5_000,
    });

    assert.equal(
      result.status,
      0,
      `child should resolve fallback path cleanly; stdout=${result.stdout} stderr=${result.stderr}`,
    );
    assert.equal(result.stdout.trim(), REPO_ROOT);
  });
});

describe('buildProviderSkillDirCandidates', () => {
  it('honors provider-specific HOME overrides for user-level skills', () => {
    const projectRoot = '/tmp/project';
    const home = '/tmp/home';
    const env = {
      CLAUDE_HOME: '/tmp/claude-home',
      CODEX_HOME: '/tmp/codex-home',
      GEMINI_HOME: '/tmp/gemini-home',
      KIMI_SHARE_DIR: '/tmp/kimi-share',
    };

    assert.deepEqual(mod.buildProviderSkillDirCandidates(projectRoot, home, env), {
      claude: [join(projectRoot, '.claude', 'skills'), join(env.CLAUDE_HOME, 'skills')],
      codex: [join(projectRoot, '.codex', 'skills'), join(env.CODEX_HOME, 'skills')],
      gemini: [join(projectRoot, '.gemini', 'skills'), join(env.GEMINI_HOME, 'skills')],
      kimi: [join(projectRoot, '.kimi', 'skills'), join(env.KIMI_SHARE_DIR, 'skills')],
    });
  });
});
