import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type {
  IMaomiWorkspaceStore,
  MaomiWorkspace,
  MaomiWorkspaceStatus,
} from '../domains/maomi-workspaces/MaomiWorkspaceStore.js';
import type { IThreadWorkspaceBindingStore } from '../domains/maomi-workspaces/ThreadWorkspaceBindingStore.js';
import type { IThreadStore } from '../domains/cats/services/stores/ports/ThreadStore.js';
import type { MaomiWorkspaceRoot } from '../domains/maomi-workspaces/workspace-root.js';
import { isValidMaomiSlug } from '../domains/maomi-workspaces/slug.js';
import { resolveUserId } from '../utils/request-identity.js';

export interface MaomiWorkspaceRoutesOptions {
  workspaceRoot: MaomiWorkspaceRoot;
  workspaceStore: IMaomiWorkspaceStore;
  bindingStore: IThreadWorkspaceBindingStore;
  threadStore?: IThreadStore;
}

const createWorkspaceSchema = z.object({
  slug: z.string().trim().min(1).max(63),
  displayName: z.string().trim().min(1).max(100),
  sourceIntent: z.string().trim().max(1000).optional(),
  createdBy: z.enum(['user', 'coordinator', 'cat', 'system']).optional().default('user'),
  threadId: z.string().trim().min(1).optional(),
});

const proposeWorkspaceSchema = z.object({
  intentText: z.string().trim().min(1).max(1000),
  threadId: z.string().trim().min(1).optional(),
});

const listWorkspaceQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'discarded']).optional(),
});

const bindWorkspaceSchema = z.object({
  workspaceId: z.string().trim().min(1).nullable(),
  mirrorProjectPath: z.boolean().optional().default(true),
});

function workspaceSummary(workspace: MaomiWorkspace) {
  return {
    workspaceId: workspace.id,
    id: workspace.id,
    slug: workspace.slug,
    displayName: workspace.displayName,
    rootPath: workspace.rootPath,
    relativePath: workspace.relativePath,
    sourceIntent: workspace.sourceIntent,
    linkedThreadIds: workspace.linkedThreadIds,
    linkedTaskIds: workspace.linkedTaskIds,
    createdBy: workspace.createdBy,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    lastActiveAt: workspace.lastActiveAt,
    status: workspace.status,
  };
}

export const maomiWorkspaceRoutes: FastifyPluginAsync<MaomiWorkspaceRoutesOptions> = async (app, opts) => {
  function routeUserId(request: Parameters<typeof resolveUserId>[0]): string {
    return resolveUserId(request, { defaultUserId: 'default-user' }) ?? 'default-user';
  }

  app.get('/api/maomi-workspaces/root', async (_request, reply) => {
    return reply.send({
      workspaceRoot: opts.workspaceRoot.rootPath,
      rootPath: opts.workspaceRoot.rootPath,
      source: opts.workspaceRoot.source,
      diagnostics: {
        insideLaunchedProject: opts.workspaceRoot.insideLaunchedProject,
      },
    });
  });

  app.post('/api/maomi-workspaces/propose', async (request, reply) => {
    const parsed = proposeWorkspaceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.issues });
    }
    const userId = routeUserId(request);
    const proposal = await opts.workspaceStore.propose(userId, parsed.data.intentText, parsed.data.threadId);
    return reply.send({ proposal });
  });

  app.post('/api/maomi-workspaces', async (request, reply) => {
    const parsed = createWorkspaceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.issues });
    }
    if (!isValidMaomiSlug(parsed.data.slug)) {
      return reply.status(400).send({ error: 'Invalid slug: use [a-z0-9][a-z0-9._-]{0,62}' });
    }

    const userId = routeUserId(request);
    try {
      const workspace = await opts.workspaceStore.create({
        userId,
        slug: parsed.data.slug,
        displayName: parsed.data.displayName,
        sourceIntent: parsed.data.sourceIntent,
        createdBy: parsed.data.createdBy,
        threadId: parsed.data.threadId,
      });

      if (parsed.data.threadId) {
        await opts.bindingStore.bind(parsed.data.threadId, userId, workspace.id);
        await opts.workspaceStore.linkThread(workspace.id, parsed.data.threadId);
        if (parsed.data.threadId && opts.threadStore?.updateProjectPath) {
          await opts.threadStore.updateProjectPath(parsed.data.threadId, workspace.rootPath);
        }
      }

      return reply.status(201).send({ workspace: workspaceSummary(workspace) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const statusCode = message.includes('already exists') ? 409 : 400;
      return reply.status(statusCode).send({ error: message });
    }
  });

  app.get('/api/maomi-workspaces', async (request, reply) => {
    const parsed = listWorkspaceQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request query', details: parsed.error.issues });
    }
    const userId = routeUserId(request);
    const workspaces = await opts.workspaceStore.listByUser(userId, {
      ...(parsed.data.status ? { status: parsed.data.status as MaomiWorkspaceStatus } : {}),
    });
    return reply.send({ workspaces: workspaces.map(workspaceSummary) });
  });

  app.get('/api/maomi-workspaces/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = routeUserId(request);
    const workspace = await opts.workspaceStore.get(id);
    if (!workspace || workspace.userId !== userId) {
      return reply.status(404).send({ error: 'workspace not found', workspaceId: id });
    }
    return reply.send({ workspace: workspaceSummary(workspace) });
  });

  app.post('/api/maomi-workspaces/:id/archive', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = routeUserId(request);
    const existing = await opts.workspaceStore.get(id);
    if (!existing || existing.userId !== userId) {
      return reply.status(404).send({ error: 'workspace not found', workspaceId: id });
    }
    const workspace = await opts.workspaceStore.archive(id);
    return reply.send({ workspace: workspace ? workspaceSummary(workspace) : null });
  });

  app.get('/api/threads/:threadId/workspace-binding', async (request, reply) => {
    const { threadId } = request.params as { threadId: string };
    const userId = routeUserId(request);
    const binding = await opts.bindingStore.get(threadId);
    const activeWorkspace = binding?.activeWorkspaceId
      ? await opts.workspaceStore.get(binding.activeWorkspaceId)
      : null;
    const thread = opts.threadStore ? await opts.threadStore.get(threadId) : null;
    const mismatch = Boolean(
      activeWorkspace
        && thread?.projectPath
        && thread.projectPath !== 'default'
        && thread.projectPath !== activeWorkspace.rootPath,
    );
    return reply.send({
      threadId,
      binding: binding ?? {
        threadId,
        userId,
        activeWorkspaceId: null,
        recentWorkspaceIds: [],
        updatedAt: 0,
      },
      activeWorkspace: activeWorkspace ? workspaceSummary(activeWorkspace) : null,
      diagnostics: {
        state: activeWorkspace ? (mismatch ? 'project_path_mismatch' : 'ok') : 'no_active_workspace',
        threadProjectPath: thread?.projectPath ?? null,
        activeWorkspaceId: activeWorkspace?.id ?? null,
        activeWorkspaceRoot: activeWorkspace?.rootPath ?? null,
      },
    });
  });

  app.put('/api/threads/:threadId/workspace-binding', async (request, reply) => {
    const { threadId } = request.params as { threadId: string };
    const parsed = bindWorkspaceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.issues });
    }
    const userId = routeUserId(request);
    const workspace = parsed.data.workspaceId ? await opts.workspaceStore.get(parsed.data.workspaceId) : null;
    if (parsed.data.workspaceId && (!workspace || workspace.userId !== userId)) {
      return reply.status(404).send({ error: 'workspace not found', workspaceId: parsed.data.workspaceId });
    }

    const binding = await opts.bindingStore.bind(threadId, userId, workspace?.id ?? null);
    if (workspace) {
      await opts.workspaceStore.linkThread(workspace.id, threadId);
      if (parsed.data.mirrorProjectPath && opts.threadStore?.updateProjectPath) {
        await opts.threadStore.updateProjectPath(threadId, workspace.rootPath);
      }
    }

    return reply.send({
      threadId,
      binding,
      activeWorkspace: workspace ? workspaceSummary(workspace) : null,
      diagnostics: {
        state: workspace ? 'ok' : 'no_active_workspace',
        activeWorkspaceId: workspace?.id ?? null,
        activeWorkspaceRoot: workspace?.rootPath ?? null,
      },
    });
  });
};
