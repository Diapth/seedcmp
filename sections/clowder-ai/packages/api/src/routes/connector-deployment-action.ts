import type { FastifyPluginAsync } from 'fastify';
import { resolveHeaderUserId } from '../utils/request-identity.js';

type DeploymentAction = 'confirm' | 'cancel';
type DeploymentActionStatus = 'confirmed' | 'cancelled' | 'needs_fields' | 'failed';

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

export const connectorDeploymentActionRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/connectors/im-web/deployment-action', async (request, reply) => {
    const actorUserId = resolveHeaderUserId(request) || 'unknown';
    const body = (request.body || {}) as Record<string, unknown>;
    const deploymentRequestId = String(body.deploymentRequestId || '').trim();
    const action = String(body.action || '').trim() as DeploymentAction;
    const actionId = String(body.actionId || '').trim();
    const channelId = String(body.channelId || '').trim();
    const channelType = Number(body.channelType);

    if (!deploymentRequestId) return reply.status(400).send({ error: 'deploymentRequestId is required' });
    if (action !== 'confirm' && action !== 'cancel') return reply.status(400).send({ error: 'action must be confirm or cancel' });
    if (!actionId) return reply.status(400).send({ error: 'actionId is required' });
    if (!channelId || (channelType !== 1 && channelType !== 2)) {
      return reply.status(400).send({ error: 'channel is required' });
    }

    const idempotencyKey = `${deploymentRequestId}:${action}:${actionId}`;
    const existing = deploymentActions.get(idempotencyKey);
    if (existing) {
      return reply.send({ ok: true, duplicate: true, ...existing });
    }

    const missingFields = missingDeploymentFields(body);
    const status: DeploymentActionStatus = action === 'cancel'
      ? 'cancelled'
      : missingFields.length > 0
        ? 'needs_fields'
        : 'confirmed';

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
      message: status === 'needs_fields'
        ? 'Deployment action requires target/environment before confirmation'
        : 'Deployment action accepted',
    });
  });
};
