import { createHash } from 'node:crypto';
import { mkdir, realpath } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

export type ProjectRuntimeRootSource =
  | 'env:CLOWDER_PROJECT_RUNTIME_ROOT'
  | 'env:CAT_CAFE_PROJECT_RUNTIME_ROOT'
  | 'project:.clowder';

export interface ResolveProjectRuntimeRootInput {
  projectPath?: string | null;
  env?: NodeJS.ProcessEnv;
}

export interface ProjectRuntimeRoot {
  projectId: string;
  projectRoot: string;
  runtimeRoot: string;
  source: ProjectRuntimeRootSource;
}

function projectIdFromPath(projectRoot: string): string {
  const name = basename(projectRoot).replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
  const digest = createHash('sha1').update(projectRoot).digest('hex').slice(0, 8);
  return `${name}-${digest}`;
}

async function canonicalizeDirectory(path: string): Promise<string> {
  return realpath(resolve(path));
}

export async function resolveProjectRuntimeRoot(input: ResolveProjectRuntimeRootInput): Promise<ProjectRuntimeRoot | null> {
  const projectPath = input.projectPath?.trim();
  if (!projectPath || projectPath === 'default' || projectPath.startsWith('games/')) {
    return null;
  }

  const env = input.env ?? process.env;
  const projectRoot = await canonicalizeDirectory(projectPath);
  const projectId = projectIdFromPath(projectRoot);
  const explicitRoot = env.CLOWDER_PROJECT_RUNTIME_ROOT?.trim() || env.CAT_CAFE_PROJECT_RUNTIME_ROOT?.trim();

  if (explicitRoot) {
    const runtimeRoot = resolve(explicitRoot, projectId);
    await mkdir(runtimeRoot, { recursive: true });
    return {
      projectId,
      projectRoot,
      runtimeRoot,
      source: env.CLOWDER_PROJECT_RUNTIME_ROOT?.trim()
        ? 'env:CLOWDER_PROJECT_RUNTIME_ROOT'
        : 'env:CAT_CAFE_PROJECT_RUNTIME_ROOT',
    };
  }

  const runtimeRoot = resolve(projectRoot, '.clowder');
  await mkdir(runtimeRoot, { recursive: true });
  return {
    projectId,
    projectRoot,
    runtimeRoot,
    source: 'project:.clowder',
  };
}

export function buildAllowedWorkspaceDirs(
  projectRoot: string,
  runtimeRoot: string,
  existingAllowed?: string,
  extraDirs?: readonly string[],
): string {
  const ordered = [projectRoot, runtimeRoot, ...(extraDirs ?? [])];
  if (existingAllowed?.trim()) {
    ordered.push(...existingAllowed.split(/[:,]/).map((item) => item.trim()).filter(Boolean));
  }
  return [...new Set(ordered.filter(Boolean).map((item) => resolve(item)))].join(':');
}
