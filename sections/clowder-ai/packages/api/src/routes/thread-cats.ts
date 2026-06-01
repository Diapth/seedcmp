/**
 * GET /api/threads/:id/cats — Thread cat categorization API (F142)
 *
 * Returns participants, routable cats, and availability status for a thread.
 * Auth: connector-bound threads require binding owner header (P1 v4 fix).
 */

import type { FastifyPluginAsync } from 'fastify';
import { resolveHeaderUserId } from '../utils/request-identity.js';
import type { ParticipantActivityInput } from './thread-cats-core.js';
import { categorizeThreadCats } from './thread-cats-core.js';

export interface ThreadCatsRoutesOptions {
  threadStore: {
    get(id: string):
      | { id: string; title?: string | null; routingPolicy?: { v: number; scopes?: unknown } | null }
      | null
      | Promise<{
          id: string;
          title?: string | null;
          routingPolicy?: { v: number; scopes?: unknown } | null;
        } | null>;
    getParticipantsWithActivity(threadId: string): ParticipantActivityInput[] | Promise<ParticipantActivityInput[]>;
  };
  agentRegistry: {
    getAllEntries(): Map<string, unknown>;
  };
  bindingStore: {
    getByThread(threadId: string): Array<{ userId: string }> | Promise<Array<{ userId: string }>>;
    getByExternal?(connectorId: string, externalChatId: string): { threadId: string; userId: string } | null | Promise<{ threadId: string; userId: string } | null>;
  };
  getCatDisplayName: (catId: string) => string;
  getAllCatIds: () => string[];
  isCatAvailable: (catId: string) => boolean;
}

export const threadCatsRoutes: FastifyPluginAsync<ThreadCatsRoutesOptions> = async (app, opts) => {
  const { threadStore, agentRegistry, bindingStore, getCatDisplayName, getAllCatIds, isCatAvailable } = opts;

  app.get<{ Params: { id: string } }>('/api/threads/:id/cats', async (request, reply) => {
    const { id } = request.params;

    // 1. Thread exists?
    const thread = await threadStore.get(id);
    if (!thread) return reply.status(404).send({ error: 'Thread not found' });

    // 2. Auth: connector binding owner check (P1 v4)
    const bindings = await bindingStore.getByThread(id);
    if (bindings.length > 0) {
      const requestUserId = resolveHeaderUserId(request);
      if (!requestUserId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      if (!bindings.some((b) => b.userId === requestUserId)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
    }

    // 3. Categorize via shared core (KD-9)
    const participantActivity = await threadStore.getParticipantsWithActivity(id);
    const result = categorizeThreadCats({
      participantActivity,
      registeredServices: agentRegistry.getAllEntries(),
      allCatIds: getAllCatIds(),
      getCatDisplayName,
      isCatAvailable,
    });

    return {
      ...result,
      routingPolicy: thread.routingPolicy ? `v${thread.routingPolicy.v}` : null,
    };
  });

  app.get<{ Querystring: { externalChatId?: string; threadId?: string } }>('/api/connectors/im-web/agents', async (request, reply) => {
    const { externalChatId, threadId: queryThreadId } = request.query;
    let threadId = queryThreadId;
    let ownerUserId: string | undefined;

    if (!threadId && externalChatId && bindingStore.getByExternal) {
      const binding = await bindingStore.getByExternal('im-web', externalChatId);
      if (!binding) {
        const registeredAgents = agentRegistry.getAllEntries();
        return {
          threadId: null,
          externalChatId,
          bindingRequired: true,
          agents: getAllCatIds().map((catId) => ({
            catId,
            displayName: getCatDisplayName(catId),
            mentionPatterns: [`@${catId}`],
            available: isCatAvailable(catId) && registeredAgents.has(catId),
            preferred: false,
          })),
          preferredCatIds: [],
          lastActiveCatId: undefined,
        };
      }
      threadId = binding.threadId;
      ownerUserId = binding.userId;
    }
    if (!threadId) return reply.status(400).send({ error: 'threadId or externalChatId required' });

    const thread = await threadStore.get(threadId);
    if (!thread) return reply.status(404).send({ error: 'Thread not found' });

    const bindings = await bindingStore.getByThread(threadId);
    if (bindings.length > 0 || ownerUserId) {
      const requestUserId = resolveHeaderUserId(request);
      if (!requestUserId) return reply.status(401).send({ error: 'Authentication required' });
      const allowed = bindings.some((b) => b.userId === requestUserId) || ownerUserId === requestUserId;
      if (!allowed) return reply.status(403).send({ error: 'Forbidden' });
    }

    const participantActivity = await threadStore.getParticipantsWithActivity(threadId);
    const participantByCat = new Map(participantActivity.map((p) => [p.catId, p]));
    const result = categorizeThreadCats({
      participantActivity,
      registeredServices: agentRegistry.getAllEntries(),
      allCatIds: getAllCatIds(),
      getCatDisplayName,
      isCatAvailable,
    });
    const preferredCatIds = Array.isArray((thread as { preferredCats?: unknown }).preferredCats)
      ? ((thread as { preferredCats?: string[] }).preferredCats ?? [])
      : [];
    const preferredSet = new Set(preferredCatIds);
    const knownCatIds = new Set<string>([
      ...getAllCatIds(),
      ...participantActivity.map((item) => item.catId),
      ...preferredCatIds,
    ]);
    const agents = [...knownCatIds].map((catId) => {
      const activity = participantByCat.get(catId);
      return {
        catId,
        displayName: getCatDisplayName(catId),
        mentionPatterns: [`@${catId}`],
        available: isCatAvailable(catId) && agentRegistry.getAllEntries().has(catId),
        preferred: preferredSet.has(catId),
        ...(activity?.lastMessageAt ? { lastActiveAt: activity.lastMessageAt } : {}),
        ...(activity?.messageCount ? { messageCount: activity.messageCount } : {}),
      };
    });
    const lastActive = [...participantActivity].filter((item) => item.messageCount > 0).sort((a, b) => b.lastMessageAt - a.lastMessageAt)[0];

    return {
      threadId,
      agents,
      preferredCatIds,
      lastActiveCatId: lastActive?.catId,
    };
  });
};
