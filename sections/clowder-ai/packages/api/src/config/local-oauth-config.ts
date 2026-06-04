import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';

export type LocalOAuthProvider = 'codex' | 'claude';

export interface LocalOAuthConfigFileSummary {
  path: string;
  exists: boolean;
  readable: boolean;
}

export interface LocalOAuthConfigSummary {
  provider: LocalOAuthProvider;
  authConfigured: boolean;
  configPresent: boolean;
  configFiles: LocalOAuthConfigFileSummary[];
  defaultModel?: string;
  profile?: string;
  diagnostics?: string[];
}

export interface LocalOAuthCapabilitiesResponse {
  providers: LocalOAuthConfigSummary[];
}

interface ProbeOptions {
  homeDir?: string;
}

interface InspectedFile {
  actualPath: string;
  summary: LocalOAuthConfigFileSummary;
  content?: string;
}

const SENSITIVE_KEY_PATTERN = /(token|refresh|secret|key|credential)/i;
const MODEL_KEYS = ['model', 'defaultModel', 'default_model', 'default-model', 'modelName', 'default_model_name'];
const PROFILE_KEYS = ['profile', 'defaultProfile', 'default_profile', 'activeProfile', 'active_profile'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readSafeString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function findSafeStringByKey(value: unknown, keys: string[], path: string[] = []): string | undefined {
  if (path.some((part) => SENSITIVE_KEY_PATTERN.test(part))) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSafeStringByKey(item, keys, path);
      if (found) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    if (keys.includes(key) && typeof child === 'string' && child.trim()) return child.trim();
  }
  for (const [key, child] of Object.entries(value)) {
    const found = findSafeStringByKey(child, keys, [...path, key]);
    if (found) return found;
  }
  return undefined;
}

function hasAuthSignal(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => hasAuthSignal(item));
  if (!isRecord(value)) return false;
  return Object.keys(value).length > 0;
}

async function inspectFile(actualPath: string, displayPath: string): Promise<InspectedFile> {
  const summary: LocalOAuthConfigFileSummary = {
    path: displayPath,
    exists: false,
    readable: false,
  };
  try {
    await access(actualPath, constants.F_OK);
    summary.exists = true;
  } catch {
    return { actualPath, summary };
  }

  try {
    await access(actualPath, constants.R_OK);
    summary.readable = true;
    return {
      actualPath,
      summary,
      content: await readFile(actualPath, 'utf-8'),
    };
  } catch {
    return { actualPath, summary };
  }
}

function parseJson(content: string): unknown {
  return JSON.parse(content) as unknown;
}

function parseCodexConfig(content: string): { defaultModel?: string; profile?: string } {
  const data = parseToml(content) as Record<string, unknown>;
  const profile = readSafeString(data, PROFILE_KEYS) || findSafeStringByKey(data, PROFILE_KEYS);
  let defaultModel = readSafeString(data, MODEL_KEYS);
  const profiles = isRecord(data.profiles) ? data.profiles : undefined;
  if (profile && profiles && isRecord(profiles[profile])) {
    defaultModel = readSafeString(profiles[profile], MODEL_KEYS) || defaultModel;
  }
  defaultModel ||= findSafeStringByKey(data, MODEL_KEYS);
  return {
    ...(defaultModel ? { defaultModel } : {}),
    ...(profile ? { profile } : {}),
  };
}

function parseClaudeSettings(content: string): { defaultModel?: string; profile?: string } {
  const data = parseJson(content);
  if (!isRecord(data)) return {};
  const defaultModel = readSafeString(data, MODEL_KEYS) || findSafeStringByKey(data, MODEL_KEYS);
  const profile = readSafeString(data, PROFILE_KEYS) || findSafeStringByKey(data, PROFILE_KEYS);
  return {
    ...(defaultModel ? { defaultModel } : {}),
    ...(profile ? { profile } : {}),
  };
}

async function probeCodex(homeDir: string): Promise<LocalOAuthConfigSummary> {
  const diagnostics: string[] = [];
  const configFile = await inspectFile(join(homeDir, '.codex', 'config.toml'), '~/.codex/config.toml');
  const authFile = await inspectFile(join(homeDir, '.codex', 'auth.json'), '~/.codex/auth.json');
  let configPresent = false;
  let authConfigured = false;
  let parsedConfig: { defaultModel?: string; profile?: string } = {};

  if (configFile.content) {
    try {
      parsedConfig = parseCodexConfig(configFile.content);
      configPresent = true;
    } catch {
      diagnostics.push('Codex config.toml 无法解析');
    }
  } else if (!configFile.summary.exists) {
    diagnostics.push('未找到 ~/.codex/config.toml');
  } else if (!configFile.summary.readable) {
    diagnostics.push('无法读取 ~/.codex/config.toml');
  }

  if (authFile.content) {
    try {
      authConfigured = hasAuthSignal(parseJson(authFile.content));
    } catch {
      diagnostics.push('Codex auth.json 无法解析');
    }
  } else if (!authFile.summary.exists) {
    diagnostics.push('未找到 ~/.codex/auth.json，请先运行 codex login');
  } else if (!authFile.summary.readable) {
    diagnostics.push('无法读取 ~/.codex/auth.json');
  }

  return {
    provider: 'codex',
    authConfigured,
    configPresent,
    configFiles: [configFile.summary, authFile.summary],
    ...parsedConfig,
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
  };
}

async function probeClaude(homeDir: string): Promise<LocalOAuthConfigSummary> {
  const diagnostics: string[] = [];
  const settingsFile = await inspectFile(join(homeDir, '.claude', 'settings.json'), '~/.claude/settings.json');
  let parsedSettings: { defaultModel?: string; profile?: string } = {};
  let configPresent = false;

  if (settingsFile.content) {
    try {
      parsedSettings = parseClaudeSettings(settingsFile.content);
      configPresent = true;
    } catch {
      diagnostics.push('Claude Code settings.json 无法解析');
    }
  } else if (!settingsFile.summary.exists) {
    diagnostics.push('未找到 ~/.claude/settings.json，请先运行 claude login');
  } else if (!settingsFile.summary.readable) {
    diagnostics.push('无法读取 ~/.claude/settings.json');
  }

  return {
    provider: 'claude',
    authConfigured: configPresent,
    configPresent,
    configFiles: [settingsFile.summary],
    ...parsedSettings,
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
  };
}

export async function probeLocalOAuthCapabilities(options: ProbeOptions = {}): Promise<LocalOAuthCapabilitiesResponse> {
  const home = options.homeDir || homedir();
  const providers = await Promise.all([probeCodex(home), probeClaude(home)]);
  return { providers };
}
