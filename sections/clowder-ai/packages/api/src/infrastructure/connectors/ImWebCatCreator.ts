import {
  type CatConfig,
  type CliConfig,
  catRegistry,
  getDefaultCliEffortForProvider,
  type ClientId,
} from '@cat-cafe/shared';
import { configEventBus, createChangeSetId } from '../../config/config-event-bus.js';
import { resolveActiveProjectRoot } from '../../utils/active-project-root.js';
import { createRuntimeCat } from '../../config/runtime-cat-catalog.js';
import { toAllCatConfigs } from '../../config/cat-config-loader.js';

export interface ImWebCreateCatInput {
  readonly displayName: string;
  readonly mentionPatterns: readonly string[];
  readonly clientId: ClientId;
  readonly authType?: 'oauth' | 'api_key';
  readonly accountRef?: string;
  readonly defaultModel?: string;
  readonly requestedBy: string;
}

export interface ImWebCreateCatResult {
  readonly catId: string;
  readonly displayName: string;
  readonly mentionPatterns: string[];
}

function slugifyCatName(input: string): string {
  const ascii = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (/^[a-z]/.test(ascii)) return ascii.slice(0, 48);
  return `cat-${Date.now().toString(36).slice(-6)}`;
}

function uniqueCatId(displayName: string): string {
  const base = slugifyCatName(displayName);
  if (!catRegistry.has(base)) return base;
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base}-${i}`;
    if (!catRegistry.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

function defaultCliForClient(client: ClientId): CliConfig {
  switch (client) {
    case 'anthropic':
      return { command: 'claude', outputFormat: 'stream-json' };
    case 'openai':
      return { command: 'codex', outputFormat: 'json' };
    case 'google':
      return { command: 'gemini', outputFormat: 'stream-json' };
    case 'kimi':
      return { command: 'kimi', outputFormat: 'stream-json' };
    case 'dare':
      return { command: 'dare', outputFormat: 'json' };
    case 'opencode':
      return { command: 'opencode', outputFormat: 'json' };
    case 'antigravity':
      return { command: 'antigravity', outputFormat: 'json' };
    case 'catagent':
      return { command: 'catagent', outputFormat: 'json' };
    default:
      return { command: client, outputFormat: 'json' };
  }
}

function pickTemplateCat(clientId: ClientId): CatConfig {
  const configs = Object.values(catRegistry.getAllConfigs());
  const preferred =
    configs.find((cat) => cat.clientId === clientId && cat.accountRef) ??
    configs.find((cat) => cat.clientId === clientId);
  if (!preferred) {
    throw new Error(`没有可继承的 ${clientId} Clowder cat 配置`);
  }
  return preferred;
}

function normalizeAliases(displayName: string, aliases: readonly string[]): string[] {
  const values = aliases.length > 0 ? aliases : [`@${displayName}`];
  return Array.from(
    new Set(
      values
        .map((alias) => alias.trim())
        .filter(Boolean)
        .map((alias) => (alias.startsWith('@') ? alias : `@${alias}`)),
    ),
  );
}

export function createImWebCatCreator() {
  return {
    async create(input: ImWebCreateCatInput): Promise<ImWebCreateCatResult> {
      const displayName = input.displayName.trim();
      if (!displayName) throw new Error('猫名不能为空');
      const mentionPatterns = normalizeAliases(displayName, input.mentionPatterns);
      const clientId = input.clientId;
      const template = pickTemplateCat(clientId);
      const defaultCli = defaultCliForClient(clientId);
      const defaultEffort = getDefaultCliEffortForProvider(clientId);
      const cli = template.cli ?? {
        ...defaultCli,
        ...(defaultEffort ? { effort: defaultEffort } : {}),
      };
      const catId = uniqueCatId(displayName);
      const projectRoot = resolveActiveProjectRoot();

      const catalog = createRuntimeCat(projectRoot, {
        catId,
        name: displayName,
        displayName,
        avatar: template.avatar ?? '/avatars/default.png',
        color: template.color ?? { primary: '#3B82F6', secondary: '#DBEAFE' },
        mentionPatterns,
        ...(input.accountRef ? { accountRef: input.accountRef } : template.accountRef ? { accountRef: template.accountRef } : {}),
        roleDescription: `${displayName}，由 TangSeng IM 通过 Clowder 新增。`,
        personality: template.personality,
        teamStrengths: template.teamStrengths,
        caution: template.caution,
        ...(template.strengths ? { strengths: [...template.strengths] } : {}),
        sessionChain: template.sessionChain,
        clientId,
        defaultModel: input.defaultModel ?? template.defaultModel ?? '',
        mcpSupport: template.mcpSupport ?? true,
        cli,
        ...(template.provider ? { provider: template.provider } : {}),
        ...(template.contextBudget ? { contextBudget: template.contextBudget } : {}),
        ...(template.voiceConfig ? { voiceConfig: template.voiceConfig } : {}),
      });
      const config = toAllCatConfigs(catalog)[catId];
      if (!config) throw new Error(`新猫猫配置未写入运行时目录：${catId}`);
      if (!catRegistry.has(catId)) catRegistry.register(catId, config);

      await configEventBus.emitChangeAsync({
        source: 'cat-config',
        scope: 'domain',
        changedKeys: [catId],
        changeSetId: createChangeSetId(),
        timestamp: Date.now(),
      });

      return { catId, displayName, mentionPatterns };
    },
  };
}
