import type { CatConfig, ClientId } from '@cat-cafe/shared';
import { builtinAccountIdForClient } from '../config/account-resolver.js';
import type { RuntimeProviderProfile } from '../config/account-resolver.js';
import type { ThreadCatDirectoryAgent } from '../routes/thread-cats.js';

type AccountResolver = (projectRoot: string, accountRef: string) => RuntimeProviderProfile | null;
const BUILTIN_OAUTH_ACCOUNT_REFS = new Set([
  'claude',
  'builtin_anthropic',
  'codex',
  'builtin_openai',
  'gemini',
  'builtin_google',
  'kimi',
  'builtin_kimi',
  'dare',
  'builtin_dare',
  'opencode',
  'builtin_opencode',
]);

export interface CatDirectoryAgentOptions {
  projectRoot?: string;
  resolveAccountRef?: AccountResolver;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function platformForClientId(clientId?: string): string | undefined {
  return stringOrUndefined(clientId);
}

function defaultAccountRefForClient(clientId?: ClientId): string | undefined {
  if (!clientId) return undefined;
  return builtinAccountIdForClient(clientId) ?? undefined;
}

function resolveAuthType(
  accountRef: string | undefined,
  projectRoot: string | undefined,
  resolveAccountRef: AccountResolver | undefined,
): string | undefined {
  if (!accountRef) return undefined;
  if (projectRoot && resolveAccountRef) {
    const profile = resolveAccountRef(projectRoot, accountRef);
    if (profile?.authType) return profile.authType;
  }
  if (BUILTIN_OAUTH_ACCOUNT_REFS.has(accountRef)) return 'oauth';
  return undefined;
}

export function catConfigToDirectoryAgent(
  config: CatConfig,
  source: ThreadCatDirectoryAgent['source'],
  options: CatDirectoryAgentOptions = {},
): ThreadCatDirectoryAgent {
  const clientId = stringOrUndefined(config.clientId);
  const accountRef = stringOrUndefined(config.accountRef) ?? defaultAccountRefForClient(config.clientId);
  const authType = resolveAuthType(accountRef, options.projectRoot, options.resolveAccountRef);
  return {
    catId: String(config.id),
    displayName: config.displayName,
    aliases: [...config.mentionPatterns],
    mentionPatterns: [...config.mentionPatterns],
    avatar: config.avatar,
    personalitySummary: config.personality,
    capabilitySummary: config.teamStrengths ?? config.roleDescription,
    ...(config.restrictions && config.restrictions.length > 0 ? { restrictions: [...config.restrictions] } : {}),
    ...(clientId ? { clientId, platform: platformForClientId(clientId) } : {}),
    ...(accountRef ? { accountRef } : {}),
    ...(authType ? { authType, accessMode: authType } : {}),
    source,
  };
}
