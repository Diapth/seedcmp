import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type {
  CreateDeploymentRequestInput,
  DeploymentEnvironment,
  DeploymentEnvironmentCandidate,
  DeploymentRequest,
  DeploymentTargetCandidate,
  IDeploymentRequestStore,
  UpdateDeploymentRequestInput,
} from '../domains/deployments/DeploymentRequestStore.js';
import { DEFAULT_ENVIRONMENT_CANDIDATES } from '../domains/deployments/DeploymentRequestStore.js';
import { resolveHeaderUserId } from '../utils/request-identity.js';

export interface ConnectorDeploymentRequestRoutesOptions {
  deploymentRequestStore: IDeploymentRequestStore;
}

const deploymentEnvironmentSchema = z.enum(['local', 'preview', 'testing', 'staging', 'production', 'development']);

const deploymentTargetCandidateSchema = z.object({
  id: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1).optional(),
  value: z.string().trim().min(1),
  source: z.enum(['active_workspace', 'recent_workspace', 'artifact', 'preview', 'task', 'text']).optional(),
  workspaceId: z.string().trim().min(1).optional(),
  path: z.string().trim().min(1).optional(),
});

const deploymentEnvironmentCandidateSchema = z.object({
  id: deploymentEnvironmentSchema.optional(),
  label: z.string().trim().min(1).optional(),
  value: deploymentEnvironmentSchema,
});

const createDeploymentRequestSchema = z.object({
  channelId: z.string().trim().min(1),
  channelType: z.union([z.literal(1), z.literal(2)]),
  threadId: z.string().trim().min(1).optional(),
  externalChatId: z.string().trim().min(1).optional(),
  sourceMessageId: z.string().trim().min(1).optional(),
  cardMessageId: z.string().trim().min(1).optional(),
  originalText: z.string().trim().min(1),
  target: z.string().trim().min(1).optional().nullable(),
  environment: deploymentEnvironmentSchema.optional().nullable(),
  targetCandidates: z.array(deploymentTargetCandidateSchema).optional(),
  environmentCandidates: z.array(deploymentEnvironmentCandidateSchema).optional(),
  workspaceId: z.string().trim().min(1).optional(),
  workspacePath: z.string().trim().min(1).optional(),
  forceNew: z.boolean().optional(),
});

const updateDeploymentRequestSchema = z.object({
  target: z.string().trim().min(1).optional().nullable(),
  environment: deploymentEnvironmentSchema.optional().nullable(),
  sourceMessageId: z.string().trim().min(1).optional(),
  cardMessageId: z.string().trim().min(1).optional(),
  targetCandidates: z.array(deploymentTargetCandidateSchema).optional(),
  workspaceId: z.string().trim().min(1).optional(),
  workspacePath: z.string().trim().min(1).optional(),
});

const activeDeploymentRequestQuerySchema = z.object({
  channelId: z.string().trim().min(1),
  channelType: z.coerce.number().refine((value) => value === 1 || value === 2, 'channelType must be 1 or 2'),
});

type DeploymentTargetCandidateInput = {
  id?: string;
  label?: string;
  value: string;
  source?: DeploymentTargetCandidate['source'];
  workspaceId?: string;
  path?: string;
};

type DeploymentEnvironmentCandidateInput = {
  id?: DeploymentEnvironment;
  label?: string;
  value: DeploymentEnvironment;
};

function routeUserId(request: Parameters<typeof resolveHeaderUserId>[0]): string {
  return resolveHeaderUserId(request) || 'default-user';
}

function normalizeTargetCandidates(candidates?: Array<DeploymentTargetCandidateInput | undefined>): DeploymentTargetCandidate[] {
  return (candidates || [])
    .map((candidate) => {
      const value = String(candidate?.value || '').trim();
      if (!value) return null;
      return {
        id: String(candidate?.id || value),
        label: String(candidate?.label || value),
        value,
        source: candidate?.source || 'text',
        ...(candidate?.workspaceId ? { workspaceId: candidate.workspaceId } : {}),
        ...(candidate?.path ? { path: candidate.path } : {}),
      };
    })
    .filter((candidate): candidate is DeploymentTargetCandidate => candidate !== null);
}

function normalizeEnvironmentCandidates(
  candidates?: Array<DeploymentEnvironmentCandidateInput | undefined>,
): DeploymentEnvironmentCandidate[] {
  return (candidates || [])
    .map((candidate) => {
      const value = candidate?.value;
      if (!value) return null;
      return {
        id: candidate?.id || value,
        label: String(candidate?.label || value),
        value,
      };
    })
    .filter((candidate): candidate is DeploymentEnvironmentCandidate => candidate !== null);
}

function latestActiveRequest(requests: DeploymentRequest[]): DeploymentRequest | null {
  return requests[0] ?? null;
}

function responseBody(deploymentRequest: DeploymentRequest, extra: Record<string, unknown> = {}) {
  return {
    deploymentRequest,
    ...extra,
  };
}

export const connectorDeploymentRequestRoutes: FastifyPluginAsync<ConnectorDeploymentRequestRoutesOptions> = async (
  app,
  opts,
) => {
  app.post('/api/connectors/im-web/deployment-requests', async (request, reply) => {
    const parsed = createDeploymentRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.issues });
    }

    const userId = routeUserId(request);
    const activeRequests = await opts.deploymentRequestStore.listActiveByConversation({
      userId,
      channelId: parsed.data.channelId,
      channelType: parsed.data.channelType,
    });
    const currentActive = latestActiveRequest(activeRequests);
    if (currentActive && !parsed.data.forceNew) {
      return reply.send(responseBody(currentActive, {
        activeRequestExists: true,
        duplicate: true,
      }));
    }

    const input: CreateDeploymentRequestInput = {
      userId,
      channelId: parsed.data.channelId,
      channelType: parsed.data.channelType,
      ...(parsed.data.threadId ? { threadId: parsed.data.threadId } : {}),
      ...(parsed.data.externalChatId ? { externalChatId: parsed.data.externalChatId } : {}),
      ...(parsed.data.sourceMessageId ? { sourceMessageId: parsed.data.sourceMessageId } : {}),
      ...(parsed.data.cardMessageId ? { cardMessageId: parsed.data.cardMessageId } : {}),
      originalText: parsed.data.originalText,
      ...(parsed.data.target !== undefined ? { target: parsed.data.target } : {}),
      ...(parsed.data.environment !== undefined ? { environment: parsed.data.environment as DeploymentEnvironment | null } : {}),
      targetCandidates: normalizeTargetCandidates(parsed.data.targetCandidates),
      environmentCandidates: normalizeEnvironmentCandidates(parsed.data.environmentCandidates),
      ...(parsed.data.workspaceId ? { workspaceId: parsed.data.workspaceId } : {}),
      ...(parsed.data.workspacePath ? { workspacePath: parsed.data.workspacePath } : {}),
    };

    const deploymentRequest = await opts.deploymentRequestStore.create(input);
    return reply.status(201).send(responseBody(deploymentRequest));
  });

  app.patch('/api/connectors/im-web/deployment-requests/:id', async (request, reply) => {
    const params = request.params as { id?: string };
    const deploymentRequestId = String(params?.id ?? '').trim();
    if (!deploymentRequestId) {
      return reply.status(400).send({ error: 'deploymentRequestId is required' });
    }

    const parsed = updateDeploymentRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.issues });
    }

    const existing = await opts.deploymentRequestStore.get(deploymentRequestId);
    if (!existing) {
      return reply.status(404).send({ error: 'deployment request not found', deploymentRequestId });
    }
    if (!['needs_fields', 'pending_confirmation'].includes(existing.status)) {
      return reply.status(409).send(responseBody(existing, {
        error: 'request_not_editable',
      }));
    }

    const updateInput: UpdateDeploymentRequestInput = {
      ...(parsed.data.target !== undefined ? { target: parsed.data.target } : {}),
      ...(parsed.data.environment !== undefined ? { environment: parsed.data.environment as DeploymentEnvironment | null } : {}),
      ...(parsed.data.sourceMessageId ? { sourceMessageId: parsed.data.sourceMessageId } : {}),
      ...(parsed.data.cardMessageId ? { cardMessageId: parsed.data.cardMessageId } : {}),
      ...(parsed.data.targetCandidates ? { targetCandidates: normalizeTargetCandidates(parsed.data.targetCandidates) } : {}),
      ...(parsed.data.workspaceId ? { workspaceId: parsed.data.workspaceId } : {}),
      ...(parsed.data.workspacePath ? { workspacePath: parsed.data.workspacePath } : {}),
    };
    const deploymentRequest = await opts.deploymentRequestStore.updateFields(deploymentRequestId, updateInput);
    if (!deploymentRequest) {
      return reply.status(404).send({ error: 'deployment request not found', deploymentRequestId });
    }
    return reply.send(responseBody(deploymentRequest));
  });

  app.get('/api/connectors/im-web/deployment-requests/active', async (request, reply) => {
    const parsed = activeDeploymentRequestQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request query', details: parsed.error.issues });
    }
    const userId = routeUserId(request);
    const requests = await opts.deploymentRequestStore.listByConversation({
      userId,
      channelId: parsed.data.channelId,
      channelType: parsed.data.channelType as 1 | 2,
    });
    const deploymentRequest = latestActiveRequest(requests);
    if (!deploymentRequest) {
      return reply.status(404).send({
        error: 'deployment request not found',
        channelId: parsed.data.channelId,
        channelType: parsed.data.channelType,
      });
    }
    return reply.send(responseBody(deploymentRequest));
  });

  app.get('/api/connectors/im-web/deployment-requests/:id', async (request, reply) => {
    const params = request.params as { id?: string };
    const deploymentRequestId = String(params?.id ?? '').trim();
    if (!deploymentRequestId) {
      return reply.status(400).send({ error: 'deploymentRequestId is required' });
    }

    const userId = routeUserId(request);
    const deploymentRequest = await opts.deploymentRequestStore.get(deploymentRequestId);
    if (!deploymentRequest || deploymentRequest.userId !== userId) {
      return reply.status(404).send({ error: 'deployment request not found', deploymentRequestId });
    }
    return reply.send(responseBody(deploymentRequest));
  });
};
