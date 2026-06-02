// @ts-check

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { catRegistry } from '@cat-cafe/shared';
import { ConnectorCommandLayer } from '../dist/infrastructure/connectors/ConnectorCommandLayer.js';
import { createImWebCatCreator } from '../dist/infrastructure/connectors/ImWebCatCreator.js';

function baseDeps(overrides = {}) {
  return {
    bindingStore: {
      async getByExternal() {
        return { connectorId: 'im-web', externalChatId: '1:clowder_ai', threadId: 'thread-1', userId: 'user-1' };
      },
      async bind() {},
      async remove() {},
    },
    threadStore: {
      create() {
        return { id: 'thread-1' };
      },
      get() {
        return { id: 'thread-1', title: 'Thread 1' };
      },
      list() {
        return [];
      },
    },
    frontendBaseUrl: 'http://localhost:3003',
    ...overrides,
  };
}

describe('/cats new live registry behavior', () => {
  it('makes a created cat visible in the next /cats response', async () => {
    const routable = new Set(['ragdoll-kn9a']);
    const catRoster = {
      'ragdoll-kn9a': { displayName: '布偶猫', available: true },
    };
    const commandLayer = new ConnectorCommandLayer(
      baseDeps({
        catRoster,
        agentRegistry: {
          has(catId) {
            return routable.has(catId);
          },
        },
        catCreator: {
          async create() {
            routable.add('news-cat');
            return { catId: 'news-cat', displayName: '新闻猫', mentionPatterns: ['@新闻猫'] };
          },
        },
      }),
    );

    await commandLayer.handle(
      'im-web',
      '1:clowder_ai',
      'user-1',
      '/cats new 新闻猫 @新闻猫 --platform codex --auth oauth --account codex',
    );
    const result = await commandLayer.handle('im-web', '1:clowder_ai', 'user-1', '/cats');

    assert.match(result.response ?? '', /新闻猫/);
  });

  it('requires and forwards the selected IM Web cat platform', async () => {
    let createInput;
    const commandLayer = new ConnectorCommandLayer(
      baseDeps({
        catCreator: {
          async create(input) {
            createInput = input;
            return { catId: 'review-cat', displayName: '审查猫', mentionPatterns: ['@review'] };
          },
        },
      }),
    );

    const missing = await commandLayer.handle('im-web', '1:clowder_ai', 'user-1', '/cats new 审查猫 @review');
    assert.match(missing.response ?? '', /--platform codex\|claude-code/);
    assert.equal(createInput, undefined);

    const created = await commandLayer.handle(
      'im-web',
      '1:clowder_ai',
      'user-1',
      '/cats new 审查猫 @review --platform claude-code --auth oauth --account claude',
    );

    assert.match(created.response ?? '', /已新增猫猫/);
    assert.equal(createInput?.clientId, 'anthropic');
    assert.equal(createInput?.authType, 'oauth');
    assert.equal(createInput?.accountRef, 'claude');
    assert.deepEqual(createInput?.mentionPatterns, ['@review']);
  });

  it('registers created IM Web runtime cats in the live catRegistry before returning', async () => {
    const displayName = `newsbot${Date.now().toString(36)}`;
    const created = await createImWebCatCreator().create({
      displayName,
      mentionPatterns: [`@${displayName}`],
      clientId: 'openai',
      requestedBy: 'user-1',
    });

    assert.equal(catRegistry.has(created.catId), true);
    assert.deepEqual(catRegistry.tryGet(created.catId)?.config.mentionPatterns, [`@${displayName}`]);
  });

  it('inherits the selected role template while keeping the selected runtime platform', async () => {
    const displayName = `ragdoll-codex-${Date.now().toString(36)}`;
    const created = await createImWebCatCreator().create({
      displayName,
      mentionPatterns: [`@${displayName}`],
      roleTemplateId: 'ragdoll',
      clientId: 'openai',
      accountRef: 'codex',
      requestedBy: 'user-1',
    });

    const config = catRegistry.tryGet(created.catId)?.config;
    assert.ok(config, 'created cat should be registered');
    assert.equal(config.clientId, 'openai');
    assert.equal(config.accountRef, 'codex');
    assert.equal(config.roleDescription, '主架构师和核心开发者，擅长深度思考和系统设计');
    assert.equal(config.personality, '温柔但有主见，喜欢深入分析问题，写代码快但注重质量');
    assert.equal(config.teamStrengths, '架构设计、写代码一把好手');
  });
});
