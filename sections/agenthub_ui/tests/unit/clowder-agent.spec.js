import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAgentStore } from '../../stores/agent.js';
import { useClowderStore } from '../../stores/clowder.js';
import { useDeploymentStore } from '../../stores/deployment.js';
import { useProjectGroupStore } from '../../stores/projectGroup.js';
import { useSettingsStore } from '../../stores/settings.js';
import { resetRequestRuntimeForTests, setRequestAdapter } from '../../utils/request.js';
import { resetStorageForTests } from '../../utils/storage.js';

describe('Clowder and agent stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetStorageForTests();
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

  it('hydrates backend templates, model options, and skill catalog from cat directory', async () => {
    setRequestAdapter(async ({ url }) => {
      expect(url).toContain('/clowder/cats');
      return {
        status: 200,
        data: {
          code: 0,
          data: {
            agents: [],
            templates: [
              {
                roleTemplateId: 'pm',
                catId: 'pm-agent',
                displayName: 'PM',
                capabilitySummary: '项目拆解',
                cloneable: true
              }
            ],
            clientDefaults: {
              codex: { defaultModel: 'gpt-5.4', models: ['gpt-5.4', 'gpt-5.4-mini'] }
            },
            skillCatalog: {
              codex: [
                {
                  name: 'Code Review',
                  category: 'quality',
                  trigger: '/review',
                  description: 'review changed files',
                  mounted: true
                }
              ]
            }
          }
        }
      };
    });

    const agentStore = useAgentStore();
    await agentStore.fetchAgentDirectory();
    const skills = await agentStore.fetchSkills();

    expect(agentStore.roleTemplates[0]).toMatchObject({
      id: 'pm',
      label: 'PM',
      catId: 'pm-agent'
    });
    expect(agentStore.platformModelOptions.codex[0]).toMatchObject({
      id: 'gpt-5.4',
      default: true
    });
    expect(skills[0]).toMatchObject({
      id: 'codex:Code Review',
      name: 'Code Review',
      category: 'quality',
      status: '已启用',
      triggers: ['/review']
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

  it('creates OAuth cats with backend field names required by TangSeng', async () => {
    setRequestAdapter(async ({ url, method, data }) => {
      expect(method).toBe('POST');
      expect(url).toContain('/clowder/cats');
      expect(data).toMatchObject({
        name: '验收猫',
        alias: '@v13cat',
        platform: 'claude-code',
        clientId: 'claude-code',
        authType: 'oauth',
        accountRef: 'claude',
        defaultModel: 'opus',
        roleTemplateId: 'coordinator',
        capabilities: ['项目拆解']
      });
      expect(data).not.toHaveProperty('access_mode');
      expect(data).not.toHaveProperty('account_ref');
      return {
        status: 200,
        data: {
          code: 0,
          data: {
            agent: {
              catId: 'cat-v13',
              displayName: '验收猫',
              aliases: ['@v13cat'],
              connected: true
            }
          }
        }
      };
    });

    const agent = await useAgentStore().createAgent({
      name: '验收猫',
      alias: '@v13cat',
      desc: 'V1-3 live cat',
      platform: 'claude-code',
      accessMode: 'oauth',
      model: 'opus',
      accountRef: 'claude',
      roleTemplate: 'coordinator',
      capabilityTags: ['项目拆解']
    });

    expect(agent).toMatchObject({ id: 'cat-v13', name: '验收猫' });
  });

  it('creates cats through the Clowder store with backend create-cat field names', async () => {
    setRequestAdapter(async ({ url, method, data }) => {
      expect(method).toBe('POST');
      expect(url).toContain('/clowder/cats');
      expect(data).toMatchObject({
        name: 'Store Cat',
        clientId: 'codex',
        authType: 'oauth',
        accountRef: 'codex',
        defaultModel: 'gpt-5.5'
      });
      return {
        status: 200,
        data: {
          code: 0,
          data: {
            agent: {
              catId: 'cat-store',
              displayName: 'Store Cat'
            }
          }
        }
      };
    });

    const cat = await useClowderStore().createCat({
      name: 'Store Cat',
      platform: 'codex',
      accessMode: 'oauth',
      model: 'gpt-5.5',
      accountRef: 'codex'
    });

    expect(cat.catId).toBe('cat-store');
  });

  it('stores project group bindings from wrapped backend responses', async () => {
    setRequestAdapter(async ({ url, method, data }) => {
      expect(method).toBe('POST');
      expect(url).toContain('/clowder/project-groups/ensure');
      expect(data).toMatchObject({ pmDirectChannelId: 'pm-direct' });
      return {
        status: 200,
        data: {
          code: 0,
          data: {
            binding: {
              bindingId: 'pg-1',
              status: 'created',
              projectGroupId: 'group-1',
              projectThreadId: 'thread-1'
            }
          }
        }
      };
    });

    const projectGroupStore = useProjectGroupStore();
    const result = await projectGroupStore.ensure({ pmDirectChannelId: 'pm-direct' });

    expect(result).toMatchObject({ bindingId: 'pg-1', projectGroupId: 'group-1' });
    expect(projectGroupStore.bindings['pg-1']).toMatchObject({ status: 'created' });
  });

  it('confirms deployment cards with deployment action and stores wrapped request payloads', async () => {
    const calls = [];
    setRequestAdapter(async ({ url, method, data }) => {
      calls.push({ url, method, data });
      expect(method).toBe('POST');
      expect(url).toContain('/clowder/conversation/deployment-action');
      expect(data).toMatchObject({
        deploymentRequestId: 'dep-1',
        action: 'confirm',
        channelId: 'group-1',
        channelType: 2
      });
      expect(data.actionId).toContain('dep-1:confirm:');
      return {
        status: 200,
        data: {
          code: 0,
          data: {
            deploymentRequest: {
              id: 'dep-1',
              status: 'running',
              channelId: 'group-1',
              channelType: 2
            }
          }
        }
      };
    });

    const deploymentStore = useDeploymentStore();
    const result = await deploymentStore.confirm('dep-1', { channelId: 'group-1', channelType: 2 });

    expect(result).toMatchObject({ id: 'dep-1', status: 'running' });
    expect(deploymentStore.requests['dep-1']).toMatchObject({ status: 'running' });
    expect(calls).toHaveLength(1);
  });

  it('loads active deployment requests from wrapped backend responses', async () => {
    setRequestAdapter(async ({ url, method }) => {
      expect(method).toBe('GET');
      expect(url).toContain('/clowder/conversation/deployment-request/active');
      expect(url).toContain('channelId=group-1');
      expect(url).toContain('channelType=2');
      return {
        status: 200,
        data: {
          code: 0,
          data: {
            deploymentRequest: {
              id: 'dep-active',
              status: 'pending_confirmation',
              channelId: 'group-1',
              channelType: 2,
              target: 'agenthub-ui',
              environment: 'preview'
            }
          }
        }
      };
    });

    const deploymentStore = useDeploymentStore();
    const request = await deploymentStore.fetchActive({ channelId: 'group-1', channelType: 2 });

    expect(request).toMatchObject({
      id: 'dep-active',
      status: 'pending_confirmation',
      target: 'agenthub-ui'
    });
    expect(deploymentStore.requests['dep-active']).toMatchObject({ channelType: 2 });
  });

  it('marks settings feature fallbacks unavailable when backend capability is missing', async () => {
    setRequestAdapter(async ({ url }) => {
      expect(url).toContain('/user/loginuuid');
      return {
        status: 404,
        data: { message: 'not found' }
      };
    });

    const settingsStore = useSettingsStore();
    const result = await settingsStore.generateQrLoginToken();

    expect(result).toMatchObject({
      available: false,
      status: 'unavailable'
    });
    expect(result.message).toContain('not found');
  });
});
