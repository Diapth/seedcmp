import { isAbsolute, relative, resolve } from 'node:path';
import { getDefaultUploadDir } from '../../utils/upload-paths.js';
import {
  classifyPath,
  type ArtifactLayer,
  type ArtifactStoragePolicyRoots,
} from './artifact-storage-policy.js';

/**
 * V3-39 §2.2: an artifact record that keeps the SOURCE location distinct from
 * the published DELIVERY location, so the two are never conflated.
 *
 *   sourcePath / workspaceRelativePath -> where the agent's file actually lives
 *   deliveryUrl                        -> the browser-usable /uploads reference
 */
export interface ArtifactProvenance {
  /** Absolute (or original) on-disk source the delivery was published from. */
  readonly sourcePath: string;
  /** Which storage layer the source belongs to. */
  readonly sourceLayer: ArtifactLayer;
  /** Path relative to the user workspace root, when the source is durable user content. */
  readonly workspaceRelativePath?: string;
  /** Browser-usable delivered reference (e.g. /uploads/x.tar.gz). */
  readonly deliveryUrl: string;
  readonly downloadName?: string;
  readonly contentType?: string;
  readonly size?: number;
}

/**
 * Build a roots view straight from env (no filesystem side effects), so the
 * delivery hook can classify a source path at send time without re-running the
 * fs-touching resolveArtifactStoragePolicy.
 */
export function rootsFromEnv(env: NodeJS.ProcessEnv = process.env): ArtifactStoragePolicyRoots {
  const runtimeRoot =
    env.CLOWDER_PROJECT_RUNTIME_ROOT?.trim() || env.CAT_CAFE_PROJECT_RUNTIME_ROOT?.trim() || null;
  const userWorkspaceRoot =
    env.MAOMI_WORKSPACE_ROOT?.trim() || env.CLOWDER_USER_WORKSPACE_ROOT?.trim() || '';
  return {
    runtimeRoot: runtimeRoot ? resolve(runtimeRoot) : null,
    userWorkspaceRoot: userWorkspaceRoot ? resolve(userWorkspaceRoot) : '',
    deliveryRoot: getDefaultUploadDir(env.UPLOAD_DIR),
  };
}

export interface BuildArtifactProvenanceInput {
  readonly sourcePath: string;
  readonly deliveryUrl: string;
  readonly roots: ArtifactStoragePolicyRoots;
  readonly downloadName?: string;
  readonly contentType?: string;
  readonly size?: number;
}

export function buildArtifactProvenance(input: BuildArtifactProvenanceInput): ArtifactProvenance {
  const sourcePath = isAbsolute(input.sourcePath) ? resolve(input.sourcePath) : input.sourcePath;
  const sourceLayer = classifyPath(sourcePath, input.roots);
  const workspaceRelativePath =
    sourceLayer === 'userWorkspace' && input.roots.userWorkspaceRoot
      ? relative(input.roots.userWorkspaceRoot, sourcePath)
      : undefined;

  return {
    sourcePath,
    sourceLayer,
    deliveryUrl: input.deliveryUrl,
    ...(workspaceRelativePath ? { workspaceRelativePath } : {}),
    ...(input.downloadName ? { downloadName: input.downloadName } : {}),
    ...(input.contentType ? { contentType: input.contentType } : {}),
    ...(typeof input.size === 'number' && input.size > 0 ? { size: input.size } : {}),
  };
}
