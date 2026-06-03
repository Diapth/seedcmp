/**
 * Coordinator Kickoff REST API
 *
 *   GET  /api/coordinator/kickoff/:coordinationId
 *     — Fetch a previously emitted kickoff (im_web pulls on mount, WS is best-effort).
 *
 *   GET  /api/coordinator/kickoffs?userId=...
 *     — List all active kickoffs for a user. Used by im_web to surface the
 *       "Create Project Group Chat?" card in any ClowderConversationPanel
 *       without requiring the front-end to track coordinationId↔channelId
 *       mapping. The front-end filters by `createdAt` (recent only) and
 *       ditches entries as the user dismisses them.
 *
 *   POST /api/coordinator/kickoff/:coordinationId/dismiss
 *     — User dismissed the "Create Project Group Chat?" card. Removes the record.
 *
 * All endpoints are idempotent and lightweight; the kickoff is short-lived by
 * design (it only matters until the user accepts or dismisses).
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ICoordinatorKickoffStore } from '../domains/cats/services/stores/ports/CoordinatorKickoffStore.js';

export interface CoordinatorKickoffRoutesOptions {
  kickoffStore: ICoordinatorKickoffStore;
}

function coordinationIdFromParams(req: FastifyRequest): string {
  const params = req.params as { coordinationId?: string };
  return String(params?.coordinationId ?? '').trim();
}

export const coordinatorKickoffRoutes: FastifyPluginAsync<CoordinatorKickoffRoutesOptions> = async (
  app,
  opts,
) => {
  app.get('/api/coordinator/kickoff/:coordinationId', async (request, reply) => {
    const coordinationId = coordinationIdFromParams(request);
    if (!coordinationId) {
      return reply.status(400).send({ error: 'coordinationId is required' });
    }
    const kickoff = await opts.kickoffStore.get(coordinationId);
    if (!kickoff) {
      return reply.status(404).send({ error: 'kickoff not found', coordinationId });
    }
    return reply.send({ kickoff });
  });

  app.get('/api/coordinator/kickoffs', async (request, reply) => {
    const query = request.query as { userId?: string; maxAgeMs?: string };
    const userId = String(query.userId ?? '').trim();
    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }
    const maxAgeMs = Number.parseInt(query.maxAgeMs ?? '', 10);
    const cutoff = Number.isFinite(maxAgeMs) && maxAgeMs > 0
      ? Date.now() - maxAgeMs
      : 0;
    // NOTE: kickoffStore doesn't index by userId yet (Phase 1.5 scope is
    // coordinationId-keyed only). For now, list all and let im_web filter.
    // userId param is accepted for forward compatibility (F190 milestone).
    const all = await opts.kickoffStore.list();
    const kickoffs = cutoff > 0 ? all.filter((k) => k.createdAt >= cutoff) : all;
    return reply.send({ kickoffs });
  });

  app.post('/api/coordinator/kickoff/:coordinationId/dismiss', async (request, reply) => {
    const coordinationId = coordinationIdFromParams(request);
    if (!coordinationId) {
      return reply.status(400).send({ error: 'coordinationId is required' });
    }
    const removed = await opts.kickoffStore.delete(coordinationId);
    return reply.send({ coordinationId, removed });
  });
};
