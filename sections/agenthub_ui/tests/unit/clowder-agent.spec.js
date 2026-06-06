import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAgentStore } from '../../stores/agent.js';
import { useClowderStore } from '../../stores/clowder.js';
import { resetRequestRuntimeForTests, setRequestAdapter } from '../../utils/request.js';

describe('Clowder and agent stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetRequestRuntimeForTests();
  });

  it('keeps production agent directory empty until fetched from backend', () => {
    const agentStore = useAgentStore();
    expect(agentStore.agents).toEqual([]);
  });

  it('fetches real cat directory and maps backend fields', async () => {
    setRequestAdapter(async ({ url }) => {
      expect(url).toContain('/clowder/cats');
      return {
        status: 200,
        data: {
          code: 0,
          data: {
            cats: [
              {
                cat_id: 'cat-1',
                name: 'Claude Code',
                alias: '@claude',
                desc: '真实 OAuth cat',
                status: 'active',
                platform: 'claude-code',
                access_mode: 'oauth',
                model: 'Claude Sonnet'
              }
            ]
          }
        }
      };
    });

    const agentStore = useAgentStore();
    await agentStore.fetchAgentDirectory();

    expect(agentStore.agents[0]).toMatchObject({
      id: 'cat-1',
      name: 'Claude Code',
      accessMode: 'oauth',
      platform: 'claude-code'
    });
  });

  it('surfaces OAuth/runtime capability failures instead of simulating success', async () => {
    setRequestAdapter(async ({ url }) => {
      expect(url).toContain('/clowder/local-auth/capabilities');
      return {
        status: 200,
        data: {
          code: 0,
          data: { oauthEnabled: false, runtimeAvailable: false, queueFull: true }
        }
      };
    });

    const clowderStore = useClowderStore();
    await clowderStore.fetchCapabilities();

    expect(clowderStore.capabilities.oauthEnabled).toBe(false);
    expect(clowderStore.capabilities.runtimeAvailable).toBe(false);
    expect(clowderStore.disabledReason).toContain('OAuth');
  });
});
