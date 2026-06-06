import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import type { ResolvedDeploymentArtifact } from './DeploymentArtifactResolver.js';

export interface StaticSiteDeploymentResult {
  previewRootPath: string;
  artifactPath: string;
  previewUrl: string;
}

export interface StaticSiteDeploymentExecutorOptions {
  deploymentsDir: string;
  publicBaseUrl?: string;
}

const DENIED_NAMES = new Set(['.git', 'node_modules', 'secrets']);
const DENIED_FILE_PATTERNS = [/^\.env(?:\.|$)/, /\.pem$/i, /\.key$/i, /^id_rsa$/i];

function isDeniedName(name: string): boolean {
  if (DENIED_NAMES.has(name)) return true;
  return DENIED_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

function isHtmlFile(path: string): boolean {
  return ['.html', '.htm'].includes(extname(path).toLowerCase());
}

function publicPreviewUrl(baseUrl: string | undefined, deploymentId: string): string {
  const path = `/api/deployments/${encodeURIComponent(deploymentId)}/preview/`;
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function findHtmlEntry(directory: string): Promise<string | null> {
  const entries = await readdir(directory, { withFileTypes: true });
  const indexEntry = entries.find((entry) => entry.isFile() && entry.name.toLowerCase() === 'index.html');
  if (indexEntry) return join(directory, indexEntry.name);
  const htmlEntry = entries.find((entry) => entry.isFile() && isHtmlFile(entry.name));
  return htmlEntry ? join(directory, htmlEntry.name) : null;
}

export class StaticSiteDeploymentExecutor {
  constructor(private readonly options: StaticSiteDeploymentExecutorOptions) {}

  async canDeploy(artifact: ResolvedDeploymentArtifact): Promise<boolean> {
    if (artifact.stat.isFile()) return isHtmlFile(artifact.targetPath);
    if (!artifact.stat.isDirectory()) return false;
    return Boolean(await findHtmlEntry(artifact.targetPath));
  }

  async execute(deploymentId: string, artifact: ResolvedDeploymentArtifact): Promise<StaticSiteDeploymentResult> {
    if (!(await this.canDeploy(artifact))) {
      throw new Error('Deployment target does not contain an HTML entry point');
    }

    const deploymentRoot = resolve(this.options.deploymentsDir, deploymentId);
    const previewRootPath = join(deploymentRoot, 'site');
    await rm(previewRootPath, { recursive: true, force: true });
    await mkdir(previewRootPath, { recursive: true });

    if (artifact.stat.isFile()) {
      await cp(artifact.targetPath, join(previewRootPath, 'index.html'));
    } else {
      await cp(artifact.targetPath, previewRootPath, {
        recursive: true,
        filter(source) {
          return !isDeniedName(basename(source));
        },
      });
      const copiedIndexPath = join(previewRootPath, 'index.html');
      try {
        await stat(copiedIndexPath);
      } catch {
        const originalEntry = await findHtmlEntry(artifact.targetPath);
        if (originalEntry) {
          await cp(originalEntry, copiedIndexPath);
        } else {
          await writeFile(copiedIndexPath, '<!doctype html><title>Deployment preview</title>', 'utf-8');
        }
      }
    }

    return {
      previewRootPath,
      artifactPath: artifact.stat.isFile() ? dirname(artifact.targetPath) : artifact.targetPath,
      previewUrl: publicPreviewUrl(this.options.publicBaseUrl, deploymentId),
    };
  }
}
