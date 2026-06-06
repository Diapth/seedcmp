import {
  type CatConfig,
  type CatRoleTemplate,
  type CliConfig,
  catRegistry,
  getDefaultCliEffortForProvider,
  type ClientId,
} from '@cat-cafe/shared';
import { configEventBus, createChangeSetId } from '../../config/config-event-bus.js';
import { loadCatTemplateConfig, toAllCatConfigs } from '../../config/cat-config-loader.js';
import { createRuntimeCat } from '../../config/runtime-cat-catalog.js';
import { resolveProjectTemplatePath } from '../../config/project-template-path.js';
import { resolveActiveProjectRoot } from '../../utils/active-project-root.js';

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

function loadRoleTemplates(projectRoot: string): CatRoleTemplate[] {
  return [...(loadCatTemplateConfig(resolveProjectTemplatePath(projectRoot)).roleTemplates ?? [])];
}

function normalizeTemplateLookup(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, '');
}

function roleTemplateKeys(template: CatRoleTemplate): string[] {
  return [
    template.id,
    template.name,
    template.nickname,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(normalizeTemplateLookup);
}

function findRoleTemplate(configs: readonly CatRoleTemplate[], roleTemplateId?: string): CatRoleTemplate | undefined {
  const needle = normalizeTemplateLookup(roleTemplateId || '');
  if (!needle) return undefined;
  return configs.find((config) => roleTemplateKeys(config).includes(needle));
}

function pickRuntimeTemplateCat(clientId: ClientId, configs: readonly CatConfig[]): CatConfig | null {
  return (
    configs.find((cat) => cat.clientId === clientId && cat.accountRef) ??
    configs.find((cat) => cat.clientId === clientId) ??
    null
  );
}

function resolveCreateTemplates(input: ImWebCreateCatInput): {
  roleTemplate: CatRoleTemplate | null;
  runtimeTemplate: CatConfig | null;
} {
  const projectRoot = resolveActiveProjectRoot();
  const templateConfigs = loadRoleTemplates(projectRoot);
  const runtimeConfigs = Object.values(catRegistry.getAllConfigs());
  const roleTemplate = findRoleTemplate(templateConfigs, input.roleTemplateId);
  if (input.roleTemplateId && !roleTemplate) {
    throw new Error(`没有找到角色模板：${input.roleTemplateId}`);
  }
  const runtimeTemplate = pickRuntimeTemplateCat(input.clientId, runtimeConfigs);
  return {
    roleTemplate: roleTemplate ?? null,
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
      const defaultEffort = getDefaultCliEffortForProvider(clientId);
      const defaultCli = {
        ...defaultCliForClient(clientId),
        ...(defaultEffort ? { effort: defaultEffort } : {}),
      };
      const cli = runtimeTemplate?.cli ?? defaultCli;
      const catId = uniqueCatId(displayName);
      const projectRoot = resolveActiveProjectRoot();

      const catalog = createRuntimeCat(projectRoot, {
        catId,
        name: displayName,
        displayName,
        avatar: roleTemplate?.avatar ?? runtimeTemplate?.avatar ?? '/avatars/default.png',
        color: roleTemplate?.color ?? runtimeTemplate?.color ?? { primary: '#3B82F6', secondary: '#DBEAFE' },
        mentionPatterns,
        ...(input.accountRef
          ? { accountRef: input.accountRef }
          : runtimeTemplate?.accountRef
            ? { accountRef: runtimeTemplate.accountRef }
            : {}),
        roleDescription: roleTemplate?.roleDescription ?? runtimeTemplate?.roleDescription ?? `${displayName}，由 TangSeng IM 通过 Clowder 新增。`,
        ...(roleTemplate?.personality ? { personality: roleTemplate.personality } : runtimeTemplate?.personality ? { personality: runtimeTemplate.personality } : {}),
        ...(roleTemplate?.teamStrengths
          ? { teamStrengths: roleTemplate.teamStrengths }
          : runtimeTemplate?.teamStrengths
            ? { teamStrengths: runtimeTemplate.teamStrengths }
            : {}),
        ...(runtimeTemplate?.caution !== undefined ? { caution: runtimeTemplate.caution } : {}),
        ...(roleTemplate?.restrictions && roleTemplate.restrictions.length > 0
          ? { restrictions: [...roleTemplate.restrictions] }
          : runtimeTemplate?.restrictions && runtimeTemplate.restrictions.length > 0
            ? { restrictions: [...runtimeTemplate.restrictions] }
            : {}),
        ...(runtimeTemplate?.strengths ? { strengths: [...runtimeTemplate.strengths] } : {}),
        ...(runtimeTemplate?.sessionChain !== undefined ? { sessionChain: runtimeTemplate.sessionChain } : {}),
        clientId,
        defaultModel: input.defaultModel ?? runtimeTemplate?.defaultModel ?? '',
        mcpSupport: runtimeTemplate?.mcpSupport ?? true,
        cli,
        ...(runtimeTemplate?.commandArgs ? { commandArgs: [...runtimeTemplate.commandArgs] } : {}),
        ...(runtimeTemplate?.cliConfigArgs ? { cliConfigArgs: [...runtimeTemplate.cliConfigArgs] } : {}),
        ...(runtimeTemplate?.provider ? { provider: runtimeTemplate.provider } : {}),
        ...(runtimeTemplate?.contextBudget ? { contextBudget: runtimeTemplate.contextBudget } : {}),
        ...(runtimeTemplate?.voiceConfig ? { voiceConfig: runtimeTemplate.voiceConfig } : {}),
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
