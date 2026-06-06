/**
 * Managed HOME-level skill mounts for provider CLIs.
 *
 * Project-level .{provider}/skills only works when the agent runs from that
 * exact project root. Clowder may dispatch cats into maomi workspaces, runtime
 * worktrees, or nested monorepos, so the runtime also keeps provider HOME
 * skills mounted from the canonical cat-cafe-skills source.
 */

import { lstat, mkdir, readlink, rm, symlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { listSourceSkillNames } from './skills-state.js';

export type ProviderHomeSkillKey = 'claude' | 'codex' | 'gemini' | 'kimi';

export interface ProviderHomeSkillSyncOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly homeDir?: string;
}

export interface ProviderHomeSkillSyncResult {
  readonly synced: string[];
  readonly skippedExisting: string[];
  readonly providerDirs: Record<ProviderHomeSkillKey, string>;
}

const PROVIDERS: readonly ProviderHomeSkillKey[] = ['claude', 'codex', 'gemini', 'kimi'];

let cachedSyncKey: string | null = null;
let cachedSyncPromise: Promise<ProviderHomeSkillSyncResult> | null = null;

function resolveHomePath(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return resolve(trimmed || fallback);
}

export function resolveProviderHomeSkillDirs(
  options: ProviderHomeSkillSyncOptions = {},
): Record<ProviderHomeSkillKey, string> {
  const env = options.env ?? process.env;
  const home = resolve(options.homeDir ?? env.HOME ?? homedir());
  const claudeHome = resolveHomePath(env.CLAUDE_HOME, join(home, '.claude'));
  const codexHome = resolveHomePath(env.CODEX_HOME, join(home, '.codex'));
  const geminiHome = resolveHomePath(env.GEMINI_HOME, join(home, '.gemini'));
  const kimiHome = resolveHomePath(env.KIMI_SHARE_DIR, join(home, '.kimi'));

  return {
    claude: join(claudeHome, 'skills'),
    codex: join(codexHome, 'skills'),
    gemini: join(geminiHome, 'skills'),
    kimi: join(kimiHome, 'skills'),
  };
}

function absoluteTarget(target: string): string {
  return isAbsolute(target) ? target : resolve(target);
}

async function ensureManagedHomeSymlink(linkPath: string, target: string): Promise<'synced' | 'skipped-existing'> {
  const desired = absoluteTarget(target);
  try {
    const s = await lstat(linkPath);
    if (s.isSymbolicLink()) {
      const existing = await readlink(linkPath);
      const existingAbs = isAbsolute(existing) ? existing : resolve(dirname(linkPath), existing);
      if (resolve(existingAbs) === desired) return 'synced';
      await rm(linkPath);
    } else {
      // HOME-level skills may be personal user skills. Never replace real dirs/files.
      return 'skipped-existing';
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  await mkdir(dirname(linkPath), { recursive: true });
  await symlink(desired, linkPath);
  return 'synced';
}

export async function syncSkillsToProviderHomes(
  skillsSource: string,
  options: ProviderHomeSkillSyncOptions = {},
): Promise<ProviderHomeSkillSyncResult> {
  const sourceRoot = resolve(skillsSource);
  const skillNames = await listSourceSkillNames(sourceRoot);
  const providerDirs = resolveProviderHomeSkillDirs(options);
  const synced = new Set<string>();
  const skippedExisting = new Set<string>();

  for (const provider of PROVIDERS) {
    const skillsDir = providerDirs[provider];
    await mkdir(skillsDir, { recursive: true });
    for (const skillName of skillNames) {
      const result = await ensureManagedHomeSymlink(join(skillsDir, skillName), join(sourceRoot, skillName));
      const key = `${provider}:${skillName}`;
      if (result === 'synced') synced.add(key);
      else skippedExisting.add(key);
    }
  }

  return {
    synced: [...synced].sort(),
    skippedExisting: [...skippedExisting].sort(),
    providerDirs,
  };
}

export async function ensureProviderHomeSkillsSynced(
  skillsSource: string,
  options: ProviderHomeSkillSyncOptions = {},
): Promise<ProviderHomeSkillSyncResult> {
  const providerDirs = resolveProviderHomeSkillDirs(options);
  const key = JSON.stringify({ skillsSource: resolve(skillsSource), providerDirs });
  if (cachedSyncKey === key && cachedSyncPromise) return cachedSyncPromise;

  cachedSyncKey = key;
  cachedSyncPromise = syncSkillsToProviderHomes(skillsSource, options).catch((err) => {
    cachedSyncKey = null;
    cachedSyncPromise = null;
    throw err;
  });
  return cachedSyncPromise;
}
