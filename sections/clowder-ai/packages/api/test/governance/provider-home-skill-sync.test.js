import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';

import {
  resolveProviderHomeSkillDirs,
  syncSkillsToProviderHomes,
} from '../../dist/config/governance/provider-home-skill-sync.js';

let tempDir;
let homeDir;
let skillsSource;

describe('Provider HOME skill sync', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'provider-home-skills-'));
    homeDir = join(tempDir, 'home');
    skillsSource = join(tempDir, 'cat-cafe-skills');

    for (const skill of ['debugging', 'tdd']) {
      await mkdir(join(skillsSource, skill), { recursive: true });
      await writeFile(join(skillsSource, skill, 'SKILL.md'), `# ${skill}\n`);
    }
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('resolves provider HOME skills dirs for Claude, Codex, Gemini and Kimi', () => {
    const dirs = resolveProviderHomeSkillDirs({
      homeDir,
      env: {
        CLAUDE_HOME: join(tempDir, 'claude-home'),
        CODEX_HOME: join(tempDir, 'codex-home'),
        GEMINI_HOME: join(tempDir, 'gemini-home'),
        KIMI_SHARE_DIR: join(tempDir, 'kimi-share'),
      },
    });

    assert.equal(dirs.claude, join(tempDir, 'claude-home', 'skills'));
    assert.equal(dirs.codex, join(tempDir, 'codex-home', 'skills'));
    assert.equal(dirs.gemini, join(tempDir, 'gemini-home', 'skills'));
    assert.equal(dirs.kimi, join(tempDir, 'kimi-share', 'skills'));
  });

  test('creates managed HOME symlinks for all four providers', async () => {
    const env = {
      CLAUDE_HOME: join(tempDir, 'claude-home'),
      CODEX_HOME: join(tempDir, 'codex-home'),
      GEMINI_HOME: join(tempDir, 'gemini-home'),
      KIMI_SHARE_DIR: join(tempDir, 'kimi-share'),
    };
    const result = await syncSkillsToProviderHomes(skillsSource, { homeDir, env });
    const dirs = resolveProviderHomeSkillDirs({ homeDir, env });

    for (const provider of ['claude', 'codex', 'gemini', 'kimi']) {
      for (const skill of ['debugging', 'tdd']) {
        const linkPath = join(dirs[provider], skill);
        const stat = await lstat(linkPath);
        assert.ok(stat.isSymbolicLink(), `${provider}:${skill} should be a symlink`);
        assert.equal(await readlink(linkPath), join(skillsSource, skill));
      }
    }
    assert.equal(result.synced.length, 8);
    assert.deepEqual(result.skippedExisting, []);
  });

  test('does not overwrite real user skills in HOME dirs', async () => {
    const userSkill = join(homeDir, '.claude', 'skills', 'tdd');
    await mkdir(userSkill, { recursive: true });
    await writeFile(join(userSkill, 'SKILL.md'), '# user tdd\n');

    const result = await syncSkillsToProviderHomes(skillsSource, { homeDir, env: {} });

    assert.equal((await lstat(userSkill)).isDirectory(), true, 'real user skill dir should remain');
    assert.ok(result.skippedExisting.includes('claude:tdd'));
  });

  test('repairs stale HOME symlinks', async () => {
    const staleTarget = join(tempDir, 'old-skills', 'tdd');
    await mkdir(join(homeDir, '.codex', 'skills'), { recursive: true });
    await mkdir(staleTarget, { recursive: true });
    await symlink(staleTarget, join(homeDir, '.codex', 'skills', 'tdd'));

    await syncSkillsToProviderHomes(skillsSource, { homeDir, env: {} });

    assert.equal(await readlink(join(homeDir, '.codex', 'skills', 'tdd')), join(skillsSource, 'tdd'));
  });
});
