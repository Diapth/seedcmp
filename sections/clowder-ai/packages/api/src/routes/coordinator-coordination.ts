import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ICoordinatorStore } from '../domains/cats/services/stores/ports/CoordinatorStore.js';
import { resolveHeaderUserId } from '../utils/request-identity.js';

export interface CoordinatorCoordinationRoutesOptions {
  coordinatorStore: ICoordinatorStore;
}

const coordinationStatusSchema = z.enum([
  'planning',
  'dispatching',
  'running',
  'aggregating',
  'succeeded',
  'failed',
  'cancelled',
]);

const dispatchModeSchema = z.enum(['parallel', 'serial', 'mixed']);
const subtaskStatusSchema = z.enum(['todo', 'doing', 'blocked', 'done', 'failed', 'cancelled']);

const subtaskSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  targetCatId: z.string().trim().min(1).optional(),
  status: subtaskStatusSchema.optional(),
  artifactRefs: z.array(z.string().trim().min(1)).optional(),
  dependsOn: z.array(z.string().trim().min(1)).optional(),
  result: z.string().trim().min(1).optional(),
  failureReason: z.string().trim().min(1).optional(),
});

const createCoordinationSchema = z.object({
  coordinationId: z.string().trim().min(1).optional(),
  threadId: z.string().trim().min(1),
  sourceMessageId: z.string().trim().min(1).optional(),
  createdBy: z.string().trim().min(1).optional(),
  goal: z.string().trim().min(1),
  assumptions: z.array(z.string()).optional(),
  subtasks: z.array(subtaskSchema).optional(),
  targetCatIds: z.array(z.string()).optional(),
  dispatchMode: dispatchModeSchema.optional(),
  status: coordinationStatusSchema.optional(),
  idempotencyKey: z.string().trim().min(1).optional(),
});

const updateCoordinationSchema = z.object({
  status: coordinationStatusSchema.optional(),
  assumptions: z.array(z.string()).optional(),
  subtasks: z.array(subtaskSchema).optional(),
  targetCatIds: z.array(z.string()).optional(),
  dispatchMode: dispatchModeSchema.optional(),
  aggregateSummary: z.string().optional(),
  failureReason: z.string().optional(),
});

const cancelCoordinationSchema = z.object({
  reason: z.string().trim().min(1).optional(),
});

function coordinationIdFromParams(request: FastifyRequest): string {
  const params = request.params as { coordinationId?: string };
  return String(params?.coordinationId ?? '').trim();
}

function threadIdFromParams(request: FastifyRequest): string {
  const params = request.params as { threadId?: string };
  return String(params?.threadId ?? '').trim();
}

function routeUserId(request: FastifyRequest): string {
  return resolveHeaderUserId(request) || 'default-user';
}

export const coordinatorCoordinationRoutes: FastifyPluginAsync<CoordinatorCoordinationRoutesOptions> = async (
  app,
  opts,
) => {
  app.post('/api/coordinator/coordination', async (request, reply) => {
    const parsed = createCoordinationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.issues });
    }
    const { coordination, created } = await opts.coordinatorStore.create({
      ...parsed.data,
      createdBy: parsed.data.createdBy || routeUserId(request),
    });
    return reply.status(created ? 201 : 200).send({ coordination, duplicate: !created });
  });

  app.patch('/api/coordinator/coordination/:coordinationId', async (request, reply) => {
    const coordinationId = coordinationIdFromParams(request);
    if (!coordinationId) {
      return reply.status(400).send({ error: 'coordinationId is required' });
    }
    const parsed = updateCoordinationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.issues });
    }
    try {
      const coordination = await opts.coordinatorStore.update(coordinationId, parsed.data);
      if (!coordination) return reply.status(404).send({ error: 'coordination not found', coordinationId });
      return reply.send({ coordination });
    } catch (err) {
      return reply.status(409).send({ error: 'invalid_coordination_transition', message: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/coordinator/coordination/:coordinationId', async (request, reply) => {
    const coordinationId = coordinationIdFromParams(request);
    if (!coordinationId) {
      return reply.status(400).send({ error: 'coordinationId is required' });
    }
    const coordination = await opts.coordinatorStore.get(coordinationId);
    if (!coordination) {
      return reply.status(404).send({ error: 'coordination not found', coordinationId });
    }
    return reply.send({ coordination });
  });

  app.get('/api/threads/:threadId/coordinations', async (request, reply) => {
    const threadId = threadIdFromParams(request);
    if (!threadId) {
      return reply.status(400).send({ error: 'threadId is required' });
    }
    const coordinations = await opts.coordinatorStore.listByThread(threadId);
    return reply.send({ threadId, coordinations });
  });

  app.post('/api/coordinator/coordination/:coordinationId/cancel', async (request, reply) => {
    const coordinationId = coordinationIdFromParams(request);
    if (!coordinationId) {
      return reply.status(400).send({ error: 'coordinationId is required' });
    }
    const parsed = cancelCoordinationSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.issues });
    }
    try {
      const coordination = await opts.coordinatorStore.cancel(coordinationId, parsed.data.reason);
      if (!coordination) return reply.status(404).send({ error: 'coordination not found', coordinationId });
      return reply.send({ coordination });
    } catch (err) {
      return reply.status(409).send({ error: 'invalid_coordination_transition', message: err instanceof Error ? err.message : String(err) });
    }
  });
};
