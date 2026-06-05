import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { basename, extname, join, resolve, sep } from 'node:path';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { DeploymentJob, IDeploymentJobStore } from '../domains/deployments/DeploymentJobStore.js';

export interface DeploymentRoutesOptions {
  deploymentJobStore: IDeploymentJobStore;
}

function isInsideOrEqual(child: string, parent: string): boolean {
  const childAbs = resolve(child);
  const parentAbs = resolve(parent);
  return childAbs === parentAbs || childAbs.startsWith(`${parentAbs}${sep}`);
}

function serializeDeploymentJob(job: DeploymentJob) {
  return {
    id: job.id,
    deploymentRequestId: job.deploymentRequestId,
    userId: job.userId,
    connectorId: job.connectorId,
    channelId: job.channelId,
    channelType: job.channelType,
    target: job.target,
    environment: job.environment,
    workspaceId: job.workspaceId,
    workspacePath: job.workspacePath,
    status: job.status,
    previewUrl: job.previewUrl,
    downloadUrl: job.downloadUrl,
    artifactPath: job.artifactPath,
    sourcePackagePath: job.sourcePackagePath,
    containerPlan: job.containerPlan,
    failureReason: job.failureReason,
    logsSummary: job.logs.slice(-5).map((entry) => entry.message),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

function contentTypeForPath(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === '.html' || ext === '.htm') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.ico') return 'image/x-icon';
  if (ext === '.txt') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

async function resolvePreviewFile(previewRootPath: string, requestedPath: string): Promise<string> {
  const root = await realpath(previewRootPath);
  const normalizedRequest = requestedPath.replace(/^\/+/, '') || 'index.html';
  const candidate = resolve(root, decodeURIComponent(normalizedRequest));
  const candidateStat = await stat(candidate);
  const filePath = candidateStat.isDirectory() ? join(candidate, 'index.html') : candidate;
  const realFilePath = await realpath(filePath);
  if (!isInsideOrEqual(realFilePath, root)) {
    throw new Error('Preview path escapes deployment root');
  }
  return realFilePath;
}

export const deploymentRoutes: FastifyPluginAsync<DeploymentRoutesOptions> = async (app, opts) => {
  app.get('/api/deployments/:deploymentId', async (request, reply) => {
    const { deploymentId } = request.params as { deploymentId?: string };
    const job = deploymentId ? await opts.deploymentJobStore.get(deploymentId) : null;
    if (!job) return reply.status(404).send({ error: 'deployment job not found', deploymentId });
    return reply.send({ deployment: serializeDeploymentJob(job) });
  });

  app.get('/api/deployments/:deploymentId/logs', async (request, reply) => {
    const { deploymentId } = request.params as { deploymentId?: string };
    const job = deploymentId ? await opts.deploymentJobStore.get(deploymentId) : null;
    if (!job) return reply.status(404).send({ error: 'deployment job not found', deploymentId });
    return reply.send({ deploymentId: job.id, logs: await opts.deploymentJobStore.getLogs(job.id) });
  });

  app.get('/api/deployments/:deploymentId/download', async (request, reply) => {
    const { deploymentId } = request.params as { deploymentId?: string };
    const job = deploymentId ? await opts.deploymentJobStore.get(deploymentId) : null;
    if (!job?.downloadFilePath) return reply.status(404).send({ error: 'deployment download not found', deploymentId });
    try {
      const fileStat = await stat(job.downloadFilePath);
      reply.header('Content-Type', 'application/gzip');
      reply.header('Content-Length', fileStat.size);
      reply.header('Content-Disposition', `attachment; filename="${basename(job.downloadFilePath)}"`);
      return reply.send(createReadStream(job.downloadFilePath));
    } catch {
      return reply.status(404).send({ error: 'deployment download not found', deploymentId });
    }
  });

  async function sendPreview(requestedDeploymentId: string | undefined, requestedPath: string, reply: FastifyReply) {
    const job = requestedDeploymentId ? await opts.deploymentJobStore.get(requestedDeploymentId) : null;
    if (!job?.previewRootPath) return reply.status(404).send({ error: 'deployment preview not found', deploymentId: requestedDeploymentId });
    try {
      const filePath = await resolvePreviewFile(job.previewRootPath, requestedPath);
      const fileStat = await stat(filePath);
      reply.header('Content-Type', contentTypeForPath(filePath));
      reply.header('Content-Length', fileStat.size);
      reply.header('Cache-Control', 'private, max-age=60');
      return reply.send(createReadStream(filePath));
    } catch (err) {
      if (err instanceof Error && err.message.includes('escapes')) {
        return reply.status(403).send({ error: err.message });
      }
      return reply.status(404).send({ error: 'deployment preview file not found', deploymentId: requestedDeploymentId });
    }
  }

  app.get('/api/deployments/:deploymentId/preview', async (request, reply) => {
    const { deploymentId } = request.params as { deploymentId?: string };
    return sendPreview(deploymentId, 'index.html', reply);
  });

  app.get('/api/deployments/:deploymentId/preview/*', async (request, reply) => {
    const params = request.params as { deploymentId?: string; '*': string };
    return sendPreview(params.deploymentId, params['*'] || 'index.html', reply);
  });
};
