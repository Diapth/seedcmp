import { stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { IThreadStore } from '../domains/cats/services/stores/ports/ThreadStore.js';
import type { IRuntimeWorkspaceStore } from '../domains/runtime-workspaces/RuntimeWorkspaceStore.js';
import { resolveProjectRuntimeRoot } from '../domains/runtime-workspaces/project-runtime-root.js';

export interface ThreadWorkspacesRoutesOptions {
  threadStore: IThreadStore;
  runtimeWorkspaceStore: IRuntimeWorkspaceStore;
}

function threadIdFromParams(req: FastifyRequest): string {
  const params = req.params as { threadId?: string };
  return String(params?.threadId ?? '').trim();
}

async function existsDirectory(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isDirectory();
  } catch {
    return false;
  }
}

function isInsideOrEqual(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'));
}

export const threadWorkspacesRoutes: FastifyPluginAsync<ThreadWorkspacesRoutesOptions> = async (app, opts) => {
  app.get('/api/threads/:threadId/workspaces', async (request, reply) => {
    const threadId = threadIdFromParams(request);
    if (!threadId) {
      return reply.status(400).send({ error: 'threadId is required' });
    }

    const thread = await Promise.resolve(opts.threadStore.get(threadId));
    if (!thread) {
      return reply.status(404).send({ error: 'Thread not found' });
    }

    const projectRuntime = await resolveProjectRuntimeRoot({ projectPath: thread.projectPath }).catch(() => null);
    const workspaces = await opts.runtimeWorkspaceStore.listByThread(threadId);
    const enriched = await Promise.all(
      workspaces.map(async (workspace) => ({
        ...workspace,
        exists: await existsDirectory(workspace.path),
        projectScoped: projectRuntime ? isInsideOrEqual(workspace.path, projectRuntime.runtimeRoot) : false,
      })),
    );

    return reply.send({
      threadId,
      projectPath: thread.projectPath,
      projectRuntimeRoot: projectRuntime,
      workspaces: enriched,
      diagnostics: {
        registered: enriched.length,
        missing: enriched.filter((workspace) => !workspace.exists).length,
        outsideProjectRuntime: enriched.filter((workspace) => projectRuntime && !workspace.projectScoped).length,
      },
    });
  });
};
