import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { catRegistry } from '@cat-cafe/shared';
import { buildStaticIdentity } from '../dist/domains/cats/services/context/SystemPromptBuilder.js';

const originalConfigs = catRegistry.getAllConfigs();

function stubCatConfig({
  id,
  displayName,
  clientId,
  accountRef,
  mentionPatterns,
  roleDescription = '执行 RiverWatch 交付任务',
  teamStrengths = 'RiverWatch 交付'
}) {
  return {
    id,
    name: id,
    displayName,
    avatar: `/avatars/${id}.png`,
    color: { primary: '#000000', secondary: '#ffffff' },
    mentionPatterns,
    clientId,
    accountRef,
    defaultModel: 'test-model',
    mcpSupport: false,
    roleDescription,
    teamStrengths,
    personality: 'test personality'
  };
}

function restoreRegistry() {
  catRegistry.reset();
  for (const [id, config] of Object.entries(originalConfigs)) {
    catRegistry.register(id, config);
  }
}

afterEach(() => {
  restoreRegistry();
});

test('Claude OAuth static identity hides old Codex runtime cats from callable roster', () => {
  catRegistry.reset();
  catRegistry.register('riverpm-claude', stubCatConfig({
    id: 'riverpm-claude',
    displayName: 'RiverWatch PM',
    clientId: 'anthropic',
    accountRef: 'claude',
    mentionPatterns: ['@riverpm-claude'],
    roleDescription: 'PM / 协调者',
    teamStrengths: '协调 RiverWatch 多智能体交付'
  }));
  catRegistry.register('runtime-cat-old-codex', stubCatConfig({
    id: 'runtime-cat-old-codex',
    displayName: '资料整理师',
    clientId: 'openai',
    accountRef: 'codex',
    mentionPatterns: ['@runtime-cat-old-codex']
  }));
  catRegistry.register('runtime-cat-claude-source', stubCatConfig({
    id: 'runtime-cat-claude-source',
    displayName: 'Claude 资料整理师',
    clientId: 'anthropic',
    accountRef: 'claude',
    mentionPatterns: ['@runtime-cat-claude-source']
  }));

  const identity = buildStaticIdentity('riverpm-claude');

  assert.ok(identity.includes('@runtime-cat-claude-source'));
  assert.ok(!identity.includes('@runtime-cat-old-codex'));
  assert.ok(!identity.includes('runtime-cat-old-codex'));
});

test('non-OAuth or unknown provider static identity keeps existing broad roster behavior', () => {
  catRegistry.reset();
  catRegistry.register('coordinator-local', stubCatConfig({
    id: 'coordinator-local',
    displayName: 'Local PM',
    clientId: 'catagent',
    accountRef: '',
    mentionPatterns: ['@coordinator-local'],
    roleDescription: 'PM / 协调者'
  }));
  catRegistry.register('codex-worker', stubCatConfig({
    id: 'codex-worker',
    displayName: 'Codex Worker',
    clientId: 'openai',
    accountRef: 'codex',
    mentionPatterns: ['@codex-worker']
  }));

  const identity = buildStaticIdentity('coordinator-local');

  assert.ok(identity.includes('@codex-worker'));
});
