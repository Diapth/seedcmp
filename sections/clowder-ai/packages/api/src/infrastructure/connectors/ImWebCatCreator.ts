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
import { loadCatConfig, toAllCatConfigs } from '../../config/cat-config-loader.js';
import { resolveProjectTemplatePath } from '../../config/project-template-path.js';

export interface ImWebCreateCatInput {
  readonly displayName: string;
  readonly mentionPatterns: readonly string[];
  readonly roleTemplateId?: string;
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

function uniqueConfigs(configs: readonly CatConfig[]): CatConfig[] {
  const byId = new Map<string, CatConfig>();
  for (const config of configs) {
    const key = String(config.id);
    if (!byId.has(key)) byId.set(key, config);
  }
  return [...byId.values()];
}

function loadTemplateConfigs(projectRoot: string): CatConfig[] {
  return Object.values(toAllCatConfigs(loadCatConfig(resolveProjectTemplatePath(projectRoot))));
}

function normalizeTemplateLookup(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, '');
}

function roleTemplateKeys(config: CatConfig): string[] {
  return [
    String(config.id),
    config.breedId,
    config.breedDisplayName,
    config.displayName,
    config.name,
    ...config.mentionPatterns,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(normalizeTemplateLookup);
}

function findRoleTemplateCat(configs: readonly CatConfig[], roleTemplateId?: string): CatConfig | undefined {
  const needle = normalizeTemplateLookup(roleTemplateId || '');
  if (!needle) return undefined;
  return configs.find((config) => roleTemplateKeys(config).includes(needle));
}

function pickRuntimeTemplateCat(clientId: ClientId, configs: readonly CatConfig[]): CatConfig {
  const projectRoot = resolveActiveProjectRoot();
  const allConfigs = configs.length > 0 ? configs : loadTemplateConfigs(projectRoot);
  const preferred =
    allConfigs.find((cat) => cat.clientId === clientId && cat.accountRef) ??
    allConfigs.find((cat) => cat.clientId === clientId);
  if (!preferred) {
    throw new Error(`没有可继承的 ${clientId} Clowder cat 配置`);
  }
  return preferred;
}

function resolveCreateTemplates(input: ImWebCreateCatInput): { roleTemplate: CatConfig; runtimeTemplate: CatConfig } {
  const projectRoot = resolveActiveProjectRoot();
  const templateConfigs = loadTemplateConfigs(projectRoot);
  const runtimeConfigs = Object.values(catRegistry.getAllConfigs());
  const allConfigs = uniqueConfigs([...templateConfigs, ...runtimeConfigs]);
  const roleTemplate = findRoleTemplateCat(allConfigs, input.roleTemplateId);
  if (input.roleTemplateId && !roleTemplate) {
    throw new Error(`没有找到角色模板：${input.roleTemplateId}`);
  }
  const runtimeTemplate = pickRuntimeTemplateCat(
    input.clientId,
    uniqueConfigs([...runtimeConfigs, ...templateConfigs]),
  );
  return {
    roleTemplate: roleTemplate ?? runtimeTemplate,
    runtimeTemplate,
  };
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
      const { roleTemplate, runtimeTemplate } = resolveCreateTemplates(input);
      const defaultCli = defaultCliForClient(clientId);
      const defaultEffort = getDefaultCliEffortForProvider(clientId);
      const cli = runtimeTemplate.cli ?? {
        ...defaultCli,
        ...(defaultEffort ? { effort: defaultEffort } : {}),
      };
      const catId = uniqueCatId(displayName);
      const projectRoot = resolveActiveProjectRoot();

      const catalog = createRuntimeCat(projectRoot, {
        catId,
        name: displayName,
        displayName,
        avatar: roleTemplate.avatar ?? '/avatars/default.png',
        color: roleTemplate.color ?? { primary: '#3B82F6', secondary: '#DBEAFE' },
        mentionPatterns,
        ...(input.accountRef
          ? { accountRef: input.accountRef }
          : runtimeTemplate.accountRef
            ? { accountRef: runtimeTemplate.accountRef }
            : {}),
        roleDescription: roleTemplate.roleDescription || `${displayName}，由 TangSeng IM 通过 Clowder 新增。`,
        personality: roleTemplate.personality,
        teamStrengths: roleTemplate.teamStrengths,
        caution: roleTemplate.caution,
        ...(roleTemplate.strengths ? { strengths: [...roleTemplate.strengths] } : {}),
        sessionChain: roleTemplate.sessionChain ?? runtimeTemplate.sessionChain,
        clientId,
        defaultModel: input.defaultModel ?? runtimeTemplate.defaultModel ?? '',
        mcpSupport: runtimeTemplate.mcpSupport ?? true,
        cli,
        ...(runtimeTemplate.commandArgs ? { commandArgs: [...runtimeTemplate.commandArgs] } : {}),
        ...(runtimeTemplate.cliConfigArgs ? { cliConfigArgs: [...runtimeTemplate.cliConfigArgs] } : {}),
        ...(runtimeTemplate.provider ? { provider: runtimeTemplate.provider } : {}),
        ...(runtimeTemplate.contextBudget ? { contextBudget: runtimeTemplate.contextBudget } : {}),
        ...(roleTemplate.voiceConfig ? { voiceConfig: roleTemplate.voiceConfig } : {}),
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
