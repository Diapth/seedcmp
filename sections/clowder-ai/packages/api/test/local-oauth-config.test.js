import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

describe('local OAuth config probe', () => {
  let homeDir;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), 'local-oauth-'));
  });

  afterEach(async () => {
    await rm(homeDir, { recursive: true, force: true });
  });

  it('summarizes Codex and Claude Code local config without leaking secrets', async () => {
    await mkdir(join(homeDir, '.codex'), { recursive: true });
    await mkdir(join(homeDir, '.claude'), { recursive: true });
    await writeFile(
      join(homeDir, '.codex', 'config.toml'),
      [
        'profile = "work"',
        'model = "gpt-5.4"',
        '[profiles.work]',
        'model = "gpt-5.5"',
        'model_provider = "openai"',
      ].join('\n'),
      'utf-8',
    );
    await writeFile(
      join(homeDir, '.codex', 'auth.json'),
      JSON.stringify({
        access_token: 'codex-access-token',
        refresh_token: 'codex-refresh-token',
        accounts: [{ id: 'acct_1' }],
      }),
      'utf-8',
    );
    await writeFile(
      join(homeDir, '.claude', 'settings.json'),
      JSON.stringify({
        model: 'claude-sonnet-4-6',
        profile: 'default',
        env: {
          ANTHROPIC_API_KEY: 'claude-secret-key',
        },
      }),
      'utf-8',
    );

    const { probeLocalOAuthCapabilities } = await import(`../dist/config/local-oauth-config.js?t=${Date.now()}`);
    const summary = await probeLocalOAuthCapabilities({ homeDir });
    const codex = summary.providers.find((provider) => provider.provider === 'codex');
    const claude = summary.providers.find((provider) => provider.provider === 'claude');

    assert.ok(codex);
    assert.equal(codex.authConfigured, true);
    assert.equal(codex.configPresent, true);
    assert.equal(codex.defaultModel, 'gpt-5.5');
    assert.equal(codex.profile, 'work');
    assert.deepEqual(
      codex.configFiles.map((file) => file.path),
      ['~/.codex/config.toml', '~/.codex/auth.json'],
    );

    assert.ok(claude);
    assert.equal(claude.authConfigured, true);
    assert.equal(claude.configPresent, true);
    assert.equal(claude.defaultModel, 'claude-sonnet-4-6');
    assert.equal(claude.profile, 'default');

    const serialized = JSON.stringify(summary);
    assert.equal(serialized.includes('codex-access-token'), false);
    assert.equal(serialized.includes('codex-refresh-token'), false);
    assert.equal(serialized.includes('claude-secret-key'), false);
    assert.equal(serialized.includes(homeDir), false);
  });

  it('reports missing local OAuth files as diagnostics', async () => {
    const { probeLocalOAuthCapabilities } = await import(`../dist/config/local-oauth-config.js?t=${Date.now()}-missing`);
    const summary = await probeLocalOAuthCapabilities({ homeDir });
    const codex = summary.providers.find((provider) => provider.provider === 'codex');
    const claude = summary.providers.find((provider) => provider.provider === 'claude');

    assert.equal(codex?.authConfigured, false);
    assert.equal(codex?.configPresent, false);
    assert.ok(codex?.diagnostics?.some((item) => item.includes('codex login')));
    assert.equal(claude?.authConfigured, false);
    assert.equal(claude?.configPresent, false);
    assert.ok(claude?.diagnostics?.some((item) => item.includes('claude login')));
  });
});

describe('create cat schema OAuth model handling', () => {
  it('allows OAuth cats to omit defaultModel so the CLI default is used', async () => {
    const { createCatSchema } = await import(`../dist/routes/cats.js?t=${Date.now()}`);
    const parsed = createCatSchema.safeParse({
      catId: 'oauth-cat',
      name: 'OAuth Cat',
      displayName: 'OAuth Cat',
      color: { primary: '#165dff', secondary: '#e8f3ff' },
      mentionPatterns: ['@oauth-cat'],
      accountRef: 'codex',
      roleDescription: 'Uses local CLI OAuth configuration',
      clientId: 'openai',
    });

    assert.equal(parsed.success, true);
    assert.equal(parsed.data.defaultModel, '');
  });
});
