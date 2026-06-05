import type { FastifyPluginAsync } from 'fastify';
import { resolveHeaderUserId } from '../utils/request-identity.js';
import { DEFAULT_ENVIRONMENT_CANDIDATES, type DeploymentEnvironment, type DeploymentRequest, type IDeploymentRequestStore } from '../domains/deployments/DeploymentRequestStore.js';
import type { DeploymentExecutor } from '../domains/deployments/DeploymentExecutor.js';
import type { DeploymentJob, IDeploymentJobStore } from '../domains/deployments/DeploymentJobStore.js';

type DeploymentAction = 'confirm' | 'cancel';
type DeploymentActionStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'needs_fields';

interface DeploymentActionRecord {
  deploymentRequestId: string;
  action: DeploymentAction;
  actionId: string;
  status: DeploymentActionStatus;
  channelId: string;
  channelType: 1 | 2;
  actorUserId: string;
  target?: string;
  environment?: string;
  workspaceId?: string;
  workspacePath?: string;
  missingFields: string[];
  createdAt: number;
}

export interface ConnectorDeploymentActionRoutesOptions {
  deploymentRequestStore?: IDeploymentRequestStore;
  deploymentJobStore?: IDeploymentJobStore;
  deploymentExecutor?: DeploymentExecutor;
}

const deploymentActions = new Map<string, DeploymentActionRecord>();

function missingDeploymentFields(body: Record<string, unknown>): string[] {
  const explicit = Array.isArray(body.missingFields)
    ? body.missingFields.map((field) => String(field || '').trim()).filter(Boolean)
    : [];
  const target = String(body.target || '').trim();
  const environment = String(body.environment || '').trim();
  if (!target || target === '待确认目标') explicit.push('target');
  if (!environment || environment === '待确认环境') explicit.push('environment');
  return Array.from(new Set(explicit));
}

function buildFallbackDeploymentRequest(body: Record<string, unknown>, actorUserId: string, status: DeploymentActionStatus): DeploymentRequest {
  const target = String(body.target || '').trim() || null;
  const environment = String(body.environment || '').trim().toLowerCase();
  return {
    id: String(body.deploymentRequestId || '').trim(),
    userId: actorUserId,
    connectorId: 'im-web',
    channelId: String(body.channelId || '').trim(),
    channelType: Number(body.channelType) as 1 | 2,
    ...(String(body.sourceMessageId || '').trim() ? { sourceMessageId: String(body.sourceMessageId || '').trim() } : {}),
    ...(String(body.cardMessageId || '').trim() ? { cardMessageId: String(body.cardMessageId || '').trim() } : {}),
    originalText: String(body.originalText || '').trim(),
    target,
    environment: (['local', 'preview', 'testing', 'staging', 'production', 'development'].includes(environment)
      ? environment
      : null) as DeploymentEnvironment | null,
    missingFields: missingDeploymentFields(body) as Array<'target' | 'environment'>,
    status,
    targetCandidates: [],
    environmentCandidates: DEFAULT_ENVIRONMENT_CANDIDATES,
    ...(String(body.workspaceId || '').trim() ? { workspaceId: String(body.workspaceId || '').trim() } : {}),
    ...(String(body.workspacePath || body.rootPath || '').trim() ? { workspacePath: String(body.workspacePath || body.rootPath || '').trim() } : {}),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function summarizeJobLogs(job: DeploymentJob | null | undefined): string[] {
  return (job?.logs ?? []).slice(-5).map((entry) => entry.message);
}

export const connectorDeploymentActionRoutes: FastifyPluginAsync<ConnectorDeploymentActionRoutesOptions> = async (app, opts) => {
  app.post('/api/connectors/im-web/deployment-action', async (request, reply) => {
    const actorUserId = resolveHeaderUserId(request) || 'unknown';
    const body = (request.body || {}) as Record<string, unknown>;
    const deploymentRequestId = String(body.deploymentRequestId || '').trim();
    const action = String(body.action || '').trim() as DeploymentAction;
    const actionId = String(body.actionId || '').trim();
    const channelId = String(body.channelId || '').trim();
    const channelType = Number(body.channelType);
    const deploymentRequestStore = opts.deploymentRequestStore;
    const deploymentJobStore = opts.deploymentJobStore;
    const deploymentExecutor = opts.deploymentExecutor;

    if (!deploymentRequestId) return reply.status(400).send({ error: 'deploymentRequestId is required' });
    if (action !== 'confirm' && action !== 'cancel') return reply.status(400).send({ error: 'action must be confirm or cancel' });
    if (!actionId) return reply.status(400).send({ error: 'actionId is required' });
    if (!channelId || (channelType !== 1 && channelType !== 2)) {
      return reply.status(400).send({ error: 'channel is required' });
    }

    const idempotencyKey = `${deploymentRequestId}:${action}:${actionId}`;
    const existing = deploymentActions.get(idempotencyKey);
    if (existing) {
      const deploymentRequest = deploymentRequestStore ? await deploymentRequestStore.get(deploymentRequestId) : null;
      const deployment = deploymentJobStore ? await deploymentJobStore.get(deploymentRequestId) : null;
      return reply.send({ ok: true, duplicate: true, ...existing, deploymentRequest, deployment });
    }

    const missingFields = missingDeploymentFields(body);
    let status: DeploymentActionStatus = action === 'cancel'
      ? 'cancelled'
      : missingFields.length > 0
        ? 'needs_fields'
        : 'queued';

    let deploymentRequest: DeploymentRequest | null = deploymentRequestStore
      ? await deploymentRequestStore.get(deploymentRequestId)
      : null;
    let deployment: DeploymentJob | null = deploymentJobStore ? await deploymentJobStore.get(deploymentRequestId) : null;

    if (deploymentRequestStore && deploymentRequest) {
      const updatedDeploymentRequest = await deploymentRequestStore.updateFields(deploymentRequestId, {
        target: String(body.target || '').trim() || undefined,
        environment: String(body.environment || '').trim() || undefined,
        sourceMessageId: String(body.sourceMessageId || '').trim() || undefined,
        cardMessageId: String(body.cardMessageId || '').trim() || undefined,
        workspaceId: String(body.workspaceId || '').trim() || undefined,
        workspacePath: String(body.workspacePath || body.rootPath || '').trim() || undefined,
      });
      if (!updatedDeploymentRequest) {
        return reply.status(404).send({ error: 'deployment request not found', deploymentRequestId });
      }
      deploymentRequest = updatedDeploymentRequest;
      if (action === 'confirm') {
        if (deploymentRequest.missingFields.length > 0) {
          const record: DeploymentActionRecord = {
            deploymentRequestId,
            action,
            actionId,
            status: 'needs_fields',
            channelId,
            channelType: channelType as 1 | 2,
            actorUserId,
            target: String(body.target || '').trim() || undefined,
            environment: String(body.environment || '').trim() || undefined,
            workspaceId: String(body.workspaceId || '').trim() || undefined,
            workspacePath: String(body.workspacePath || body.rootPath || '').trim() || undefined,
            missingFields: deploymentRequest.missingFields,
            createdAt: Date.now(),
          };
          deploymentActions.set(idempotencyKey, record);
          return reply.send({
            ok: true,
            ...record,
            deploymentRequest,
            message: 'Deployment action requires target/environment before confirmation',
          });
        }
        deploymentRequest = await deploymentRequestStore.confirm(deploymentRequestId) ?? deploymentRequest;
        if (deploymentJobStore && deploymentExecutor && deploymentRequest.target && deploymentRequest.environment) {
          deployment = await deploymentJobStore.createQueued({
            deploymentRequestId,
            userId: deploymentRequest.userId,
            channelId: deploymentRequest.channelId,
            channelType: deploymentRequest.channelType,
            target: deploymentRequest.target,
            environment: deploymentRequest.environment,
            ...(deploymentRequest.workspaceId ? { workspaceId: deploymentRequest.workspaceId } : {}),
            ...(deploymentRequest.workspacePath ? { workspacePath: deploymentRequest.workspacePath } : {}),
          });
          deploymentRequest = await deploymentRequestStore.updateExecution(deploymentRequestId, {
            status: 'queued',
            deploymentJobId: deployment.id,
            logsSummary: summarizeJobLogs(deployment),
            failureReason: null,
            previewUrl: null,
            downloadUrl: null,
            containerPlan: null,
          }) ?? deploymentRequest;
          status = 'queued';
          const queuedDeployment = deployment;
          const queuedRequest = deploymentRequest;
          void (async () => {
            await deploymentRequestStore.updateExecution(deploymentRequestId, {
              status: 'running',
              deploymentJobId: queuedDeployment.id,
              logsSummary: summarizeJobLogs(await deploymentJobStore.get(queuedDeployment.id)),
              failureReason: null,
              previewUrl: null,
              downloadUrl: null,
              containerPlan: null,
            });
            const completedDeployment = await deploymentExecutor.execute(queuedDeployment, queuedRequest);
            await deploymentRequestStore.updateExecution(deploymentRequestId, {
              status: completedDeployment.status,
              deploymentJobId: completedDeployment.id,
              previewUrl: completedDeployment.previewUrl ?? null,
              downloadUrl: completedDeployment.downloadUrl ?? null,
              logsSummary: summarizeJobLogs(completedDeployment),
              failureReason: completedDeployment.failureReason ?? null,
              containerPlan: completedDeployment.containerPlan ?? null,
            });
          })().catch(async (err) => {
            const failureReason = err instanceof Error ? err.message : String(err);
            request.log.error({ err, deploymentRequestId }, 'background deployment execution failed');
            await deploymentJobStore.appendLog(queuedDeployment.id, 'error', failureReason).catch(() => null);
            const failedDeployment = await deploymentJobStore.update(queuedDeployment.id, {
              status: 'failed',
              failureReason,
              completedAt: Date.now(),
            }).catch(() => null);
            await deploymentRequestStore.updateExecution(deploymentRequestId, {
              status: 'failed',
              deploymentJobId: queuedDeployment.id,
              logsSummary: summarizeJobLogs(failedDeployment),
              failureReason,
            }).catch(() => null);
          });
        }
      } else {
        deploymentRequest = await deploymentRequestStore.cancel(deploymentRequestId) ?? deploymentRequest;
        if (deploymentJobStore) {
          const existingJob = await deploymentJobStore.get(deploymentRequestId);
          if (existingJob && !['succeeded', 'failed', 'cancelled'].includes(existingJob.status)) {
            await deploymentJobStore.appendLog(deploymentRequestId, 'warn', 'Deployment job cancelled by user');
            deployment = await deploymentJobStore.update(deploymentRequestId, {
              status: 'cancelled',
              completedAt: Date.now(),
              failureReason: 'Deployment cancelled by user',
            });
          } else {
            deployment = existingJob;
          }
        }
      }
    }

    const record: DeploymentActionRecord = {
      deploymentRequestId,
      action,
      actionId,
      status,
      channelId,
      channelType: channelType as 1 | 2,
      actorUserId,
      target: String(body.target || '').trim() || undefined,
      environment: String(body.environment || '').trim() || undefined,
      workspaceId: String(body.workspaceId || '').trim() || undefined,
      workspacePath: String(body.workspacePath || body.rootPath || '').trim() || undefined,
      missingFields,
      createdAt: Date.now(),
    };
    deploymentActions.set(idempotencyKey, record);

    request.log.info(
      { deploymentRequestId, action, status, channelId, channelType, actorUserId, missingFields },
      'IM Web deployment action received',
    );
    return reply.send({
      ok: true,
      ...record,
      deploymentRequest: deploymentRequest || buildFallbackDeploymentRequest(body, actorUserId, status),
      deployment,
      message: status === 'needs_fields'
        ? 'Deployment action requires target/environment before confirmation'
        : 'Deployment action accepted',
    });
  });
};
