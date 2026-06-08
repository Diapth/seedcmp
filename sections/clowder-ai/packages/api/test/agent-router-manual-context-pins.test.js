import './helpers/setup-cat-registry.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('AgentRouter passes manualContextPinStore into route strategy deps', async () => {
  const { AgentRouter } = await import('../dist/domains/cats/services/agents/routing/AgentRouter.js');
  const { AgentRegistry } = await import('../dist/domains/cats/services/agents/registry/AgentRegistry.js');

  const agentRegistry = new AgentRegistry();
  agentRegistry.register('opus', { id: 'opus' });
  const manualContextPinStore = {
    listActive: async () => [],
  };

  const router = new AgentRouter({
    agentRegistry,
    registry: {
      create: () => ({ invocationId: 'inv-1', callbackToken: 'tok-1' }),
      verify: async () => ({ ok: false, reason: 'unknown_invocation' }),
    },
    messageStore: {
      getByThreadAfter: async () => [],
      getByThread: async () => [],
      getByThreadBefore: async () => [],
    },
    manualContextPinStore,
  });

  assert.equal(router.getStrategyDeps().manualContextPinStore, manualContextPinStore);
});
