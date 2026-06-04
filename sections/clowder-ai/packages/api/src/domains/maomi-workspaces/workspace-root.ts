import { existsSync } from 'node:fs';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export type MaomiWorkspaceRootSource =
  | 'env:MAOMI_WORKSPACE_ROOT'
  | 'env:CLOWDER_USER_WORKSPACE_ROOT'
  | 'config:userWorkspaceRoot'
  | 'default:sibling-maomi_workspace';

export interface ResolveMaomiWorkspaceRootInput {
  launchedProjectRoot: string;
  env?: NodeJS.ProcessEnv;
  userWorkspaceRoot?: string | null;
}

export interface MaomiWorkspaceRoot {
  rootPath: string;
  source: MaomiWorkspaceRootSource;
  insideLaunchedProject: boolean;
}

function isInsideOrEqual(child: string, parent: string): boolean {
  const childAbs = resolve(child);
  const parentAbs = resolve(parent);
  return childAbs === parentAbs || childAbs.startsWith(`${parentAbs}/`);
}

async function canonicalizeOrCreate(path: string): Promise<string> {
  await mkdir(path, { recursive: true });
  return realpath(path);
}

async function writeRootMetadata(rootPath: string, source: MaomiWorkspaceRootSource): Promise<void> {
  const metadataPath = resolve(rootPath, '.clowder-root.json');
  if (existsSync(metadataPath)) return;
  const payload = {
    kind: 'maomi_workspace_root',
    source,
    createdAt: Date.now(),
    runtimeVersion: 1,
  };
  await writeFile(metadataPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

export function findLaunchedProjectRoot(start = process.cwd()): string {
  let dir = resolve(start);
  while (dir !== dirname(dir)) {
    if (existsSync(resolve(dir, '.git'))) return dir;
    dir = dirname(dir);
  }
  return resolve(start);
}

export async function resolveMaomiWorkspaceRoot(
  input: ResolveMaomiWorkspaceRootInput,
): Promise<MaomiWorkspaceRoot> {
  const env = input.env ?? process.env;
  const launchedProjectRoot = await canonicalizeOrCreate(input.launchedProjectRoot);

  let source: MaomiWorkspaceRootSource = 'default:sibling-maomi_workspace';
  let candidate =
    env.MAOMI_WORKSPACE_ROOT?.trim()
    || env.CLOWDER_USER_WORKSPACE_ROOT?.trim()
    || input.userWorkspaceRoot?.trim()
    || resolve(dirname(launchedProjectRoot), 'maomi_workspace');

  if (env.MAOMI_WORKSPACE_ROOT?.trim()) {
    source = 'env:MAOMI_WORKSPACE_ROOT';
  } else if (env.CLOWDER_USER_WORKSPACE_ROOT?.trim()) {
    source = 'env:CLOWDER_USER_WORKSPACE_ROOT';
  } else if (input.userWorkspaceRoot?.trim()) {
    source = 'config:userWorkspaceRoot';
  }

  candidate = resolve(candidate);
  const rootPath = await canonicalizeOrCreate(candidate);
  const insideLaunchedProject = isInsideOrEqual(rootPath, launchedProjectRoot);
  if (insideLaunchedProject && source === 'default:sibling-maomi_workspace') {
    throw new Error('Default Maomi workspace root must not be inside the launched project root');
  }

  await writeRootMetadata(rootPath, source);
  return { rootPath, source, insideLaunchedProject };
}
