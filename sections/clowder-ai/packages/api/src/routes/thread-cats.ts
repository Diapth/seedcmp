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
  getDirectoryAgents?: () => ThreadCatDirectoryAgent[];
}

export const threadCatsRoutes: FastifyPluginAsync<ThreadCatsRoutesOptions> = async (app, opts) => {
  const {
    threadStore,
    agentRegistry,
    bindingStore,
    getCatDisplayName,
    getAllCatIds,
    isCatAvailable,
    getDirectoryAgents,
  } = opts;

  const buildDirectoryAgents = (
    preferredCatIds: string[] = [],
    participantActivity: ParticipantActivityInput[] = [],
  ) => {
    const registeredAgents = agentRegistry.getAllEntries();
    const preferredSet = new Set(preferredCatIds);
    const participantByCat = new Map(participantActivity.map((p) => [p.catId, p]));
    const candidates = getDirectoryAgents?.() ?? getAllCatIds().map((catId) => ({ catId }));
    const candidateByCat = new Map<string, ThreadCatDirectoryAgent>();
    for (const candidate of candidates) {
      if (!candidate.catId || candidateByCat.has(candidate.catId)) continue;
      candidateByCat.set(candidate.catId, candidate);
    }
    const knownCatIds = new Set<string>([
      ...getAllCatIds(),
      ...candidateByCat.keys(),
      ...participantActivity.map((item) => item.catId),
      ...preferredCatIds,
    ]);

    return [...knownCatIds].map((catId) => {
      const candidate = candidateByCat.get(catId);
      const activity = participantByCat.get(catId);
      const hasService = registeredAgents.has(catId);
      const available = isCatAvailable(catId) && hasService;
      return {
        catId,
        displayName: candidate?.displayName ?? getCatDisplayName(catId),
        ...(candidate?.aliases ? { aliases: candidate.aliases } : {}),
        mentionPatterns:
          candidate?.mentionPatterns && candidate.mentionPatterns.length > 0 ? candidate.mentionPatterns : [`@${catId}`],
        ...(candidate?.avatar ? { avatar: candidate.avatar } : {}),
        ...(candidate?.personalitySummary ? { personalitySummary: candidate.personalitySummary } : {}),
        ...(candidate?.capabilitySummary ? { capabilitySummary: candidate.capabilitySummary } : {}),
        ...(candidate?.restrictions && candidate.restrictions.length > 0 ? { restrictions: candidate.restrictions } : {}),
        ...(candidate?.platform ? { platform: candidate.platform } : {}),
        ...(candidate?.clientId ? { clientId: candidate.clientId } : {}),
        ...(candidate?.accessMode ? { accessMode: candidate.accessMode } : {}),
        ...(candidate?.authType ? { authType: candidate.authType } : {}),
        ...(candidate?.accountRef ? { accountRef: candidate.accountRef } : {}),
        available,
        availabilityState: available ? 'available' : 'unavailable',
        source: candidate?.source ?? (hasService ? 'existing' : 'disconnected'),
        preferred: preferredSet.has(catId),
        ...(activity?.lastMessageAt ? { lastActiveAt: activity.lastMessageAt } : {}),
        ...(activity?.messageCount ? { messageCount: activity.messageCount } : {}),
      };
    });
  };

  const buildUnboundDirectory = (externalChatId?: string, extra: Record<string, unknown> = {}) => ({
    threadId: null,
    ...(externalChatId ? { externalChatId } : {}),
    bindingRequired: true,
    agents: buildDirectoryAgents(),
    preferredCatIds: [],
    lastActiveCatId: undefined,
    ...extra,
  });

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
        return buildUnboundDirectory(externalChatId);
      }
      threadId = binding.threadId;
      ownerUserId = binding.userId;
    }
    if (!threadId) return reply.status(400).send({ error: 'threadId or externalChatId required' });

    const thread = await threadStore.get(threadId);
    if (!thread) {
      if (externalChatId) return buildUnboundDirectory(externalChatId, { bindingStatus: 'orphaned' });
      return reply.status(404).send({ error: 'Thread not found' });
    }

    const bindings = await bindingStore.getByThread(threadId);
    if (bindings.length > 0 || ownerUserId) {
      const requestUserId = resolveHeaderUserId(request);
      if (!requestUserId) {
        if (externalChatId) return buildUnboundDirectory(externalChatId, { authRequired: true });
        return reply.status(401).send({ error: 'Authentication required' });
      }
      const allowed = bindings.some((b) => b.userId === requestUserId) || ownerUserId === requestUserId;
      if (!allowed) {
        if (externalChatId) return buildUnboundDirectory(externalChatId, { permissionDenied: true });
        return reply.status(403).send({ error: 'Forbidden' });
      }
    }

    const participantActivity = await threadStore.getParticipantsWithActivity(threadId);
    const preferredCatIds = Array.isArray((thread as { preferredCats?: unknown }).preferredCats)
      ? ((thread as { preferredCats?: string[] }).preferredCats ?? [])
      : [];
    const agents = buildDirectoryAgents(preferredCatIds, participantActivity);
    const lastActive = [...participantActivity].filter((item) => item.messageCount > 0).sort((a, b) => b.lastMessageAt - a.lastMessageAt)[0];

    return {
      threadId,
      agents,
      preferredCatIds,
      lastActiveCatId: lastActive?.catId,
    };
  });
};

export interface ThreadCatDirectoryAgent {
  catId: string;
  displayName?: string;
  aliases?: string[];
  mentionPatterns?: string[];
  avatar?: string;
  personalitySummary?: string;
  capabilitySummary?: string;
  restrictions?: string[];
  source?: 'existing' | 'runtime-created' | 'disconnected' | 'stale';
  platform?: string;
  clientId?: string;
  accessMode?: string;
  authType?: string;
  accountRef?: string;
}
