import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveRiverWatchDemoConfig,
  riverWatchDemoResetAgentIds
} from './record-riverwatch-real-demo.mjs';

test('CLI args override RiverWatch demo environment defaults', () => {
  const config = resolveRiverWatchDemoConfig({
    argv: [
      '--suffix',
      '240117',
      '--ui-url',
      'http://localhost:5179',
      '--api-base',
      'http://127.0.0.1:19090/v1',
      '--clowder-api-base',
      'http://127.0.0.1:3009',
      '--ai-timeout-ms',
      '12345',
      '--ai-provider',
      'codex',
      '--fast'
    ],
    env: {
      RIVERWATCH_DEMO_SUFFIX: 'envsuffix',
      AGENTHUB_UI_URL: 'http://localhost:5173',
      AGENTHUB_API_BASE: 'http://127.0.0.1:8090/v1',
      CLOWDER_API_BASE: 'http://127.0.0.1:3004',
      RIVERWATCH_DEMO_FAST: '0',
      RIVERWATCH_AI_TIMEOUT_MS: '600000',
      RIVERWATCH_AI_PROVIDER: 'claude'
    },
    now: 999999240117
  });

  assert.deepEqual(config, {
    baseUrl: 'http://localhost:5179',
    apiBase: 'http://127.0.0.1:19090/v1',
    clowderApiBase: 'http://127.0.0.1:3009',
    suffix: '240117',
    fast: true,
    aiWaitTimeout: 12345,
    aiProvider: 'codex'
  });
});

test('environment variables remain the default RiverWatch demo config source', () => {
  const config = resolveRiverWatchDemoConfig({
    argv: [],
    env: {
      RIVERWATCH_DEMO_SUFFIX: 'env123',
      AGENTHUB_UI_URL: 'http://localhost:5180',
      AGENTHUB_API_BASE: 'http://127.0.0.1:8091/v1',
      CLOWDER_API_BASE: 'http://127.0.0.1:3005',
      RIVERWATCH_DEMO_FAST: '1',
      RIVERWATCH_AI_TIMEOUT_MS: '45678',
      RIVERWATCH_AI_PROVIDER: 'claude'
    },
    now: 999999240117
  });

  assert.deepEqual(config, {
    baseUrl: 'http://localhost:5180',
    apiBase: 'http://127.0.0.1:8091/v1',
    clowderApiBase: 'http://127.0.0.1:3005',
    suffix: 'env123',
    fast: true,
    aiWaitTimeout: 45678,
    aiProvider: 'claude'
  });
});

test('RiverWatch demo config falls back to stable defaults', () => {
  const config = resolveRiverWatchDemoConfig({
    argv: [],
    env: {},
    now: 999999240117
  });

  assert.deepEqual(config, {
    baseUrl: 'http://localhost:5173',
    apiBase: 'http://127.0.0.1:8090/v1',
    clowderApiBase: 'http://127.0.0.1:3004',
    suffix: '240117',
    fast: false,
    aiWaitTimeout: 1800000,
    aiProvider: 'claude'
  });
});

test('RiverWatch demo reset only selects dynamic demo agents', () => {
  const ids = riverWatchDemoResetAgentIds([
    { catId: 'bobo', displayName: '波斯猫（前端工程师）', source: 'existing' },
    { catId: 'devops', displayName: '孟加拉猫（DevOps）', source: 'existing' },
    { catId: 'riverpm205016', displayName: 'RiverWatch PM 205016', source: 'existing' },
    { catId: 'runtime-cat-18b7fe993abed0a2', displayName: '狸花猫（资料整理师）', source: 'existing' },
    { catId: 'source-curator-claude', displayName: '狸花猫（资料整理师）', source: 'clowder' },
    { catId: 'deck-strategist-claude', displayName: '俄罗斯蓝猫（叙事策略师）', source: 'clowder' },
    { catId: 'storyboard-designer-claude', displayName: '土耳其安哥拉猫（分镜设计师）', source: 'clowder' },
    { catId: 'source-curator', displayName: '狸花猫（资料整理师）', source: 'disconnected' },
    { catId: 'deck-strategist', displayName: '俄罗斯蓝猫（叙事策略师）', source: 'role-template' },
    { catId: 'qa', displayName: '英短（QA工程师）', source: 'disconnected' }
  ]);

  assert.deepEqual(ids.sort(), [
    'deck-strategist-claude',
    'riverpm205016',
    'runtime-cat-18b7fe993abed0a2',
    'source-curator-claude',
    'storyboard-designer-claude'
  ].sort());
});
