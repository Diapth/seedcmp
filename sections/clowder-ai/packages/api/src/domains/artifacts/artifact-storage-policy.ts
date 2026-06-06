import { resolve, sep } from 'node:path';
import { getDefaultUploadDir } from '../../utils/upload-paths.js';
import {
  resolveMaomiWorkspaceRoot,
  type MaomiWorkspaceRootSource,
} from '../maomi-workspaces/workspace-root.js';
import {
  resolveProjectRuntimeRoot,
  type ProjectRuntimeRootSource,
} from '../runtime-workspaces/project-runtime-root.js';

/**
 * V3-39: One documented contract for the three artifact storage layers.
 *
 *   runtime      = agent scratch / worktrees / transient staging (.clowder)
 *   userWorkspace = durable user-facing project source (maomi_workspace)
 *   delivery     = browser-usable published media (/uploads)
 *
 * This module composes the existing per-layer resolvers so invocation,
 * delivery, and cleanup flows can all reference the SAME boundary instead of
 * re-deriving roots ad hoc.
 */

export type ArtifactLayer = 'runtime' | 'userWorkspace' | 'delivery' | 'unknown';

export type ArtifactDeliverySource = 'env:UPLOAD_DIR' | 'default:packages/api/uploads';

export interface ArtifactStoragePolicyRoots {
  /** Internal runtime/scratch root. Null when no concrete project path is bound. */
  readonly runtimeRoot: string | null;
  /** Durable user project workspace root (maomi_workspace). */
  readonly userWorkspaceRoot: string;
  /** Published web-delivery media root (/uploads on disk). */
  readonly deliveryRoot: string;
}

export interface ArtifactStoragePolicySources {
  readonly runtime: ProjectRuntimeRootSource | null;
  readonly userWorkspace: MaomiWorkspaceRootSource;
  readonly delivery: ArtifactDeliverySource;
}

export interface ArtifactStoragePolicy extends ArtifactStoragePolicyRoots {
  readonly sources: ArtifactStoragePolicySources;
  /** Classify an absolute path into the layer that owns it. */
  classify(absPath: string): ArtifactLayer;
  /** True only when the path is durable user-owned project content. */
  isDurableUserAsset(absPath: string): boolean;
}

export interface ResolveArtifactStoragePolicyInput {
  /** Project path bound to the thread/task (may be null/"default"). */
  readonly projectPath?: string | null;
  /** Repo/launch root used to derive the default user workspace sibling. */
  readonly launchedProjectRoot: string;
  readonly env?: NodeJS.ProcessEnv;
}

function isWithin(root: string | null | undefined, candidate: string): boolean {
  if (!root) return false;
  const rootAbs = resolve(root);
  const candidateAbs = resolve(candidate);
  return candidateAbs === rootAbs || candidateAbs.startsWith(`${rootAbs}${sep}`);
}

/**
 * Classify a path by the DEEPEST matching root, so nested layouts (e.g. an
 * uploads dir living inside the launched project) resolve to the most specific
 * owning layer rather than an accidental ancestor.
 */
export function classifyPath(absPath: string, roots: ArtifactStoragePolicyRoots): ArtifactLayer {
  const candidates: ReadonlyArray<readonly [ArtifactLayer, string | null]> = [
    ['delivery', roots.deliveryRoot],
    ['runtime', roots.runtimeRoot],
    ['userWorkspace', roots.userWorkspaceRoot],
  ];
  let best: ArtifactLayer = 'unknown';
  let bestLen = -1;
  for (const [layer, root] of candidates) {
    if (root && isWithin(root, absPath)) {
      const len = resolve(root).length;
      if (len > bestLen) {
        best = layer;
        bestLen = len;
      }
    }
  }
  return best;
}

export function isDurableUserAsset(absPath: string, roots: ArtifactStoragePolicyRoots): boolean {
  return classifyPath(absPath, roots) === 'userWorkspace';
}

export async function resolveArtifactStoragePolicy(
  input: ResolveArtifactStoragePolicyInput,
): Promise<ArtifactStoragePolicy> {
  const env = input.env ?? process.env;

  const runtime = await resolveProjectRuntimeRoot({ projectPath: input.projectPath ?? null, env });
  const userWorkspace = await resolveMaomiWorkspaceRoot({
    launchedProjectRoot: input.launchedProjectRoot,
    env,
  });
  const deliveryRoot = getDefaultUploadDir(env.UPLOAD_DIR);

  const roots: ArtifactStoragePolicyRoots = {
    runtimeRoot: runtime?.runtimeRoot ?? null,
    userWorkspaceRoot: userWorkspace.rootPath,
    deliveryRoot,
  };

  const sources: ArtifactStoragePolicySources = {
    runtime: runtime?.source ?? null,
    userWorkspace: userWorkspace.source,
    delivery: env.UPLOAD_DIR?.trim() ? 'env:UPLOAD_DIR' : 'default:packages/api/uploads',
  };

  return {
    ...roots,
    sources,
    classify: (absPath: string) => classifyPath(absPath, roots),
    isDurableUserAsset: (absPath: string) => isDurableUserAsset(absPath, roots),
  };
}
