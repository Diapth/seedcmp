import { existsSync } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import type { DeploymentRequest, DeploymentTargetCandidate } from './DeploymentRequestStore.js';

export interface ResolvedDeploymentArtifact {
  targetPath: string;
  stat: Awaited<ReturnType<typeof stat>>;
  source: 'target' | 'workspace' | 'candidate';
  displayPath: string;
}

export interface DeploymentArtifactResolverOptions {
  allowedRoots: string[];
  defaultRoot?: string;
}

const PLACEHOLDER_TARGETS = new Set(['待确认目标', 'this page', '这个页面', '页面', '网页']);

function isInsideOrEqual(child: string, parent: string): boolean {
  const childAbs = resolve(child);
  const parentAbs = resolve(parent);
  return childAbs === parentAbs || childAbs.startsWith(`${parentAbs}${sep}`);
}

function uniqueTexts(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function targetLooksLikePath(target: string): boolean {
  return isAbsolute(target) || target.startsWith('.') || target.includes('/') || target.includes('\\');
}

function candidatePath(candidate: DeploymentTargetCandidate | undefined, request: DeploymentRequest): string | null {
  const rawPath = String(candidate?.path || '').trim();
  if (!rawPath) return null;
  if (isAbsolute(rawPath)) return rawPath;
  const workspacePath = String(request.workspacePath || '').trim();
  if (workspacePath) return resolve(workspacePath, rawPath);
  return rawPath;
}

export class DeploymentArtifactResolver {
  constructor(private readonly options: DeploymentArtifactResolverOptions) {}

  async resolve(request: DeploymentRequest): Promise<ResolvedDeploymentArtifact> {
    const allowedRoots = await this.canonicalAllowedRoots();
    if (allowedRoots.length === 0) {
      throw new Error('No deployment workspace roots are configured');
    }

    const target = String(request.target || '').trim();
    const matchingCandidate = request.targetCandidates.find((candidate) => candidate.value === target);
    const workspacePath = String(request.workspacePath || '').trim();
    const targetIsPlaceholder = !target || PLACEHOLDER_TARGETS.has(target.toLowerCase()) || PLACEHOLDER_TARGETS.has(target);

    const candidates = uniqueTexts([
      candidatePath(matchingCandidate, request),
      targetIsPlaceholder && workspacePath ? workspacePath : null,
      workspacePath && target && !targetIsPlaceholder && !targetLooksLikePath(target) && basename(workspacePath) === target
        ? workspacePath
        : null,
      workspacePath && target && !targetIsPlaceholder && targetLooksLikePath(target) && !isAbsolute(target)
        ? resolve(workspacePath, target)
        : null,
      target && !targetIsPlaceholder ? target : null,
      this.options.defaultRoot && target && !targetIsPlaceholder && !isAbsolute(target)
        ? resolve(this.options.defaultRoot, target)
        : null,
    ]);

    for (const candidate of candidates) {
      const absolute = isAbsolute(candidate)
        ? resolve(candidate)
        : resolve(this.options.defaultRoot || allowedRoots[0], candidate);
      const canonical = await this.canonicalExistingPath(absolute);
      if (!canonical) continue;
      this.assertAllowed(canonical, allowedRoots);
      const artifactStat = await stat(canonical);
      return {
        targetPath: canonical,
        stat: artifactStat,
        source: candidate === workspacePath ? 'workspace' : candidate === candidatePath(matchingCandidate, request) ? 'candidate' : 'target',
        displayPath: relative(this.options.defaultRoot || allowedRoots[0], canonical) || canonical,
      };
    }

    throw new Error(target ? `Deployment target not found: ${target}` : 'Deployment target is required');
  }

  private async canonicalAllowedRoots(): Promise<string[]> {
    const roots: string[] = [];
    for (const root of this.options.allowedRoots) {
      const text = String(root || '').trim();
      if (!text || !existsSync(text)) continue;
      try {
        roots.push(await realpath(text));
      } catch {
        roots.push(resolve(text));
      }
    }
    return uniqueTexts(roots);
  }

  private async canonicalExistingPath(path: string): Promise<string | null> {
    if (!existsSync(path)) return null;
    try {
      return await realpath(path);
    } catch {
      return resolve(path);
    }
  }

  private assertAllowed(path: string, allowedRoots: string[]): void {
    if (!allowedRoots.some((root) => isInsideOrEqual(path, root))) {
      throw new Error('Deployment target must be inside an allowed workspace root');
    }
  }
}
