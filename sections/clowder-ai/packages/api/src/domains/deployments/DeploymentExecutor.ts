import { existsSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import type { DeploymentRequest } from './DeploymentRequestStore.js';
import type { DeploymentContainerPlan, DeploymentJob, IDeploymentJobStore } from './DeploymentJobStore.js';
import { DeploymentArtifactResolver } from './DeploymentArtifactResolver.js';
import { SourcePackageExecutor } from './SourcePackageExecutor.js';
import { StaticSiteDeploymentExecutor } from './StaticSiteDeploymentExecutor.js';

export interface DeploymentExecutorOptions {
  jobStore: IDeploymentJobStore;
  deploymentsDir: string;
  allowedRoots: string[];
  defaultRoot?: string;
  publicBaseUrl?: string;
}

function dockerImageName(deploymentId: string): string {
  return `cat-cafe-${deploymentId.replace(/[^a-zA-Z0-9_.-]/g, '-').toLowerCase()}`;
}

async function maybeRealpath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return resolve(path);
  }
}

export class DeploymentExecutor {
  private readonly resolver: DeploymentArtifactResolver;
  private readonly staticSiteExecutor: StaticSiteDeploymentExecutor;
  private readonly sourcePackageExecutor: SourcePackageExecutor;

  constructor(private readonly options: DeploymentExecutorOptions) {
    this.resolver = new DeploymentArtifactResolver({
      allowedRoots: options.allowedRoots,
      defaultRoot: options.defaultRoot,
    });
    this.staticSiteExecutor = new StaticSiteDeploymentExecutor({
      deploymentsDir: options.deploymentsDir,
      publicBaseUrl: options.publicBaseUrl,
    });
    this.sourcePackageExecutor = new SourcePackageExecutor({
      deploymentsDir: options.deploymentsDir,
      publicBaseUrl: options.publicBaseUrl,
    });
  }

  async execute(job: DeploymentJob, request: DeploymentRequest): Promise<DeploymentJob> {
    let current = await this.options.jobStore.update(job.id, {
      status: 'running',
      startedAt: Date.now(),
      failureReason: null,
    }) ?? job;
    await this.options.jobStore.appendLog(job.id, 'info', 'Deployment executor started');

    try {
      const artifact = await this.resolver.resolve(request);
      await this.options.jobStore.appendLog(job.id, 'info', `Resolved deployment target: ${artifact.displayPath}`);

      const containerPlan = await this.detectContainerPlan(job.id, artifact.targetPath, artifact.stat.isDirectory());
      if (containerPlan) {
        await this.options.jobStore.appendLog(job.id, 'info', 'Dockerfile detected; container execution is planned but not started in P2');
      }

      let previewUrl: string | undefined;
      let previewRootPath: string | undefined;
      let artifactPath: string | undefined;
      if (await this.staticSiteExecutor.canDeploy(artifact)) {
        const preview = await this.staticSiteExecutor.execute(job.id, artifact);
        previewUrl = preview.previewUrl;
        previewRootPath = preview.previewRootPath;
        artifactPath = preview.artifactPath;
        await this.options.jobStore.appendLog(job.id, 'info', `Static preview generated: ${preview.previewUrl}`);
      } else {
        await this.options.jobStore.appendLog(job.id, 'warn', 'No HTML entry point found; generating source package only');
      }

      let downloadUrl: string | undefined;
      let downloadFilePath: string | undefined;
      let sourcePackagePath: string | undefined;
      try {
        const sourcePackage = await this.sourcePackageExecutor.execute(job.id, artifact);
        downloadUrl = sourcePackage.downloadUrl;
        downloadFilePath = sourcePackage.downloadFilePath;
        sourcePackagePath = sourcePackage.sourcePackagePath;
        await this.options.jobStore.appendLog(job.id, 'info', `Source package generated: ${sourcePackage.downloadUrl}`);
      } catch (err) {
        if (!previewUrl) throw err;
        await this.options.jobStore.appendLog(
          job.id,
          'warn',
          `Source package generation failed after preview succeeded: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (!previewUrl && !downloadUrl && !containerPlan) {
        throw new Error('Deployment produced no preview, download, or container plan');
      }

      current = await this.options.jobStore.update(job.id, {
        status: 'succeeded',
        previewUrl: previewUrl ?? null,
        downloadUrl: downloadUrl ?? null,
        previewRootPath: previewRootPath ?? null,
        downloadFilePath: downloadFilePath ?? null,
        artifactPath: artifactPath ?? null,
        sourcePackagePath: sourcePackagePath ?? null,
        containerPlan: containerPlan ?? null,
        completedAt: Date.now(),
      }) ?? current;
      await this.options.jobStore.appendLog(job.id, 'info', 'Deployment job succeeded');
      return await this.options.jobStore.get(job.id) ?? current;
    } catch (err) {
      const failureReason = err instanceof Error ? err.message : String(err);
      await this.options.jobStore.appendLog(job.id, 'error', failureReason);
      current = await this.options.jobStore.update(job.id, {
        status: 'failed',
        failureReason,
        completedAt: Date.now(),
      }) ?? current;
      return current;
    }
  }

  private async detectContainerPlan(
    deploymentId: string,
    artifactPath: string,
    artifactIsDirectory: boolean,
  ): Promise<DeploymentContainerPlan | null> {
    const dockerfilePath = artifactIsDirectory ? join(artifactPath, 'Dockerfile') : join(dirname(artifactPath), 'Dockerfile');
    if (!existsSync(dockerfilePath)) return null;
    const resolvedDockerfile = await maybeRealpath(dockerfilePath);
    const displayPath = this.options.defaultRoot
      ? relative(this.options.defaultRoot, resolvedDockerfile) || resolvedDockerfile
      : resolvedDockerfile;
    return {
      dockerfilePath: displayPath,
      imageName: dockerImageName(deploymentId),
      executed: false,
      reason: 'P2 container deployment only generates a plan; it does not start containers automatically.',
    };
  }
}
