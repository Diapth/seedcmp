// @ts-check

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

describe('DeepSeek account environment override', () => {
  let globalRoot;
  let previousGlobalRoot;
  let previousDeepseekKey;

  beforeEach(async () => {
    globalRoot = await mkdtemp(join(tmpdir(), 'deepseek-account-'));
    previousGlobalRoot = process.env.CAT_CAFE_GLOBAL_CONFIG_ROOT;
    previousDeepseekKey = process.env.DEEPSEEK_API_KEY;
    process.env.CAT_CAFE_GLOBAL_CONFIG_ROOT = globalRoot;
    process.env.DEEPSEEK_API_KEY = 'env-deepseek-key';

    await mkdir(join(globalRoot, '.cat-cafe'), { recursive: true });
    await writeFile(
      join(globalRoot, '.cat-cafe', 'accounts.json'),
      JSON.stringify(
        {
          deepseek: {
            authType: 'api_key',
            baseUrl: 'https://api.deepseek.com/anthropic',
            models: ['deepseek-v4-flash'],
          },
        },
        null,
        2,
      ),
      'utf-8',
    );
    await writeFile(
      join(globalRoot, '.cat-cafe', 'credentials.json'),
      JSON.stringify({ deepseek: { apiKey: 'stale-credentials-key' } }, null, 2),
      'utf-8',
    );
  });

  afterEach(async () => {
    if (previousGlobalRoot === undefined) delete process.env.CAT_CAFE_GLOBAL_CONFIG_ROOT;
    else process.env.CAT_CAFE_GLOBAL_CONFIG_ROOT = previousGlobalRoot;
    if (previousDeepseekKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousDeepseekKey;
    await rm(globalRoot, { recursive: true, force: true });
  });

  it('uses DEEPSEEK_API_KEY for the deepseek account instead of stale stored credentials', async () => {
    const { resolveByAccountRef } = await import(`../dist/config/account-resolver.js?t=${Date.now()}`);

    const profile = resolveByAccountRef(globalRoot, 'deepseek');

    assert.equal(profile?.apiKey, 'env-deepseek-key');
    assert.equal(profile?.baseUrl, 'https://api.deepseek.com/anthropic');
    assert.deepEqual(profile?.models, ['deepseek-v4-flash']);
  });
});
