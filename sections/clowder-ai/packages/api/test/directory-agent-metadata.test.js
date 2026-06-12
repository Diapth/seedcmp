import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { catConfigToDirectoryAgent } = await import('../dist/utils/thread-cat-directory-agent.js');

describe('catConfigToDirectoryAgent()', () => {
  it('preserves runtime cat provider metadata for IM Web reuse gating', () => {
    const agent = catConfigToDirectoryAgent(
      {
        id: 'runtime-cat-codex',
        displayName: '狸花猫（资料整理师）',
        avatar: '/avatars/tabby.png',
        mentionPatterns: ['@资料整理师'],
        personality: '资料整理',
        roleDescription: '整理真实数据源',
        teamStrengths: '数据源审计',
        clientId: 'openai',
        accountRef: 'codex',
      },
      'existing',
      { projectRoot: process.cwd() },
    );

    assert.equal(agent.clientId, 'openai');
    assert.equal(agent.accountRef, 'codex');
    assert.equal(agent.authType, 'oauth');
    assert.equal(agent.accessMode, 'oauth');
    assert.equal(agent.platform, 'openai');
  });
});
