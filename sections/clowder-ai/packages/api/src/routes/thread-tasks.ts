/**
 * Thread Task + Artifact REST API (Phase 4 + 5)
 *
 *   GET  /api/threads/:threadId/tasks
 *     — List all tasks for a thread, sorted by id. Used by the
 *       ProjectKanbanPanel (Phase 5) to show doing/blocked/todo/done columns.
 *
 *   POST /api/threads/:threadId/artifacts
 *     — Append a new artifact to one of the thread's tasks. The MCP tool
 *       `cat_cafe_declare_artifact` (Phase 4.4) calls the same logic over
 *       MCP. This REST route is the manual / front-end fallback.
 *
 *   GET  /api/threads/:threadId/artifacts
 *     — List all artifacts produced in this thread, grouped by ownerCatId.
 *       Used by ProjectArtifactsPanel (Phase 4.6) to render the artifacts
 *       tab. Files that no longer exist on disk are silently filtered out.
 */

import { existsSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { createCatId, type CatId, type TaskItem } from '@cat-cafe/shared';
import type { ITaskStore } from '../domains/cats/services/stores/ports/TaskStore.js';
import type { IThreadStore } from '../domains/cats/services/stores/ports/ThreadStore.js';
import { isUnderAllowedRoot, validateProjectPath } from '../utils/project-path.js';

export interface ThreadTasksRoutesOptions {
  taskStore: ITaskStore;
  threadStore?: IThreadStore;
  log: {
    warn: (obj: object, msg?: string) => void;
    error: (obj: object, msg?: string) => void;
  };
}

export type ArtifactKind = 'code' | 'doc' | 'image' | 'preview' | 'other';

export interface ThreadArtifact {
  path: string;                // relative to projectPath
  absolutePath: string;        // absolute, exists on disk
  kind: ArtifactKind;
  description?: string;
  ownerCatId: string;
  taskId: string;
  createdAt: number;
}

function threadIdFromParams(req: FastifyRequest): string {
  const params = req.params as { threadId?: string };
  return String(params?.threadId ?? '').trim();
}

function isPathInsideRoot(child: string, root: string): boolean {
  const childAbs = isAbsolute(child) ? child : resolve(child);
  if (childAbs === root) return true;
  return childAbs.startsWith(root + sep) || childAbs.startsWith(root + '/');
}

function findOrCreateArtifactTask(
  taskStore: ITaskStore,
  threadId: string,
  userId: string,
  coordinationId: string | undefined,
  ownerCatId: string,
  path: string,
  kind: ArtifactKind,
  description: string | undefined,
): Promise<TaskItem> {
  // Try to find an existing task for this owner within the coordination.
  // We look for the first task on this thread owned by this cat, scoped to
  // the same coordinationId when provided. Falls back to creating a new
  // "auto" task on the fly.
  return (async () => {
    const threadTasks = await Promise.resolve(taskStore.listByThread(threadId));
    const existing = threadTasks.find(
      (t) =>
        t.ownerCatId === ownerCatId &&
        (coordinationId ? t.coordinationId === coordinationId : true),
    );
    if (existing) {
      const refs = new Set(existing.artifactRefs ?? []);
      if (!refs.has(path)) {
        refs.add(path);
        const updated = await Promise.resolve(taskStore.update(existing.id, { artifactRefs: [...refs] }));
        return updated ?? existing;
      }
      return existing;
    }

    const created = await Promise.resolve(
      taskStore.create({
        threadId,
        userId,
        title: `${ownerCatId} 的产出文件`,
        why: description ?? '猫猫自动声明的产物',
        createdBy: 'system',
        kind: 'work',
        ownerCatId: createCatId(ownerCatId),
        ...(coordinationId ? { coordinationId } : {}),
        artifactRefs: [path],
      }),
    );
    // Touch updatedAt to surface the task in list queries.
    const touched = await Promise.resolve(taskStore.update(created.id, { why: description ?? created.why }));
    return touched ?? created;
  })();
}

function buildThreadArtifact(
  task: TaskItem,
  projectPath: string,
  path: string,
  kind: ArtifactKind,
  description: string | undefined,
): ThreadArtifact | null {
  // Resolve to absolute and verify it actually exists on disk. Drop stale
  // refs (cat removed the file) silently — the panel only shows living
  // artifacts.
  const absolutePath = isAbsolute(path) ? path : resolve(projectPath, path);
  if (!existsSync(absolutePath)) return null;
  if (projectPath && !isPathInsideRoot(absolutePath, projectPath)) return null;
  return {
    path: projectPath ? absolutePath.slice(projectPath.length).replace(/^[\\/]+/, '') : path,
    absolutePath,
    kind,
    description,
    ownerCatId: task.ownerCatId ?? 'unknown',
    taskId: task.id,
    createdAt: task.updatedAt ?? task.createdAt,
  };
}

export const threadTasksRoutes: FastifyPluginAsync<ThreadTasksRoutesOptions> = async (
  app,
  opts,
) => {
  // ----- Phase 5: GET /api/threads/:threadId/tasks -----
  app.get('/api/threads/:threadId/tasks', async (request, reply) => {
    const threadId = threadIdFromParams(request);
    if (!threadId) {
      return reply.status(400).send({ error: 'threadId is required' });
    }
    const tasks = await Promise.resolve(opts.taskStore.listByThread(threadId));
    return reply.send({ tasks });
  });

  // ----- Phase 4.5: POST /api/threads/:threadId/artifacts -----
  app.post('/api/threads/:threadId/artifacts', async (request, reply) => {
    const threadId = threadIdFromParams(request);
    if (!threadId) {
      return reply.status(400).send({ error: 'threadId is required' });
    }
    const body = request.body as {
      userId?: string;
      path?: string;
      kind?: ArtifactKind;
      description?: string;
      ownerCatId?: string;
      coordinationId?: string;
    } ?? {};
    const userId = String(body.userId ?? '').trim();
    const path = String(body.path ?? '').trim();
    const kind = (body.kind ?? 'other') as ArtifactKind;
    const description = body.description?.trim();
    const ownerCatId = String(body.ownerCatId ?? '').trim();
    const coordinationId = body.coordinationId?.trim();

    if (!userId) return reply.status(400).send({ error: 'userId is required' });
    if (!path) return reply.status(400).send({ error: 'path is required' });
    if (!ownerCatId) return reply.status(400).send({ error: 'ownerCatId is required' });
    if (!['code', 'doc', 'image', 'preview', 'other'].includes(kind)) {
      return reply.status(400).send({ error: 'kind must be one of code|doc|image|preview|other' });
    }

    // ProjectPath is the absolute root this thread is bound to. The
    // declared path must be inside it (or a bare filename, in which case
    // we resolve it relative to projectPath).
    const thread = opts.threadStore ? await Promise.resolve(opts.threadStore.get(threadId)) : null;
    const projectPath = thread?.projectPath;
    let absolutePath: string;
    if (isAbsolute(path)) {
      absolutePath = path;
    } else if (projectPath) {
      absolutePath = resolve(projectPath, path);
    } else {
      return reply.status(400).send({ error: 'path is absolute but thread has no projectPath to bound it' });
    }

    if (projectPath) {
      const projectAbs = await validateProjectPath(projectPath);
      if (!projectAbs) {
        return reply.status(400).send({ error: 'thread projectPath is no longer a valid workspace directory' });
      }
      if (!isPathInsideRoot(absolutePath, projectAbs)) {
        return reply.status(400).send({
          error: 'artifact path escapes thread projectPath',
          projectPath: projectAbs,
          attempted: absolutePath,
        });
      }
    }

    if (!existsSync(absolutePath)) {
      return reply.status(400).send({ error: 'artifact path does not exist on disk', absolutePath });
    }
    // Also confirm the file is under an allowed root (denylist or allowlist).
    if (!isUnderAllowedRoot(absolutePath)) {
      return reply.status(400).send({ error: 'artifact path is under a protected system directory', absolutePath });
    }

    let task: TaskItem;
    try {
      task = await findOrCreateArtifactTask(
        opts.taskStore,
        threadId,
        userId,
        coordinationId,
        ownerCatId,
        absolutePath,
        kind,
        description,
      );
    } catch (err) {
      opts.log.error({ err, threadId, path }, '[thread-artifacts] failed to attach artifact');
      return reply.status(500).send({ error: 'failed to attach artifact' });
    }

    return reply.send({ task, artifact: { path: absolutePath, kind, description } });
  });

  // ----- Phase 4.6: GET /api/threads/:threadId/artifacts -----
  app.get('/api/threads/:threadId/artifacts', async (request, reply) => {
    const threadId = threadIdFromParams(request);
    if (!threadId) {
      return reply.status(400).send({ error: 'threadId is required' });
    }
    const thread = opts.threadStore ? await Promise.resolve(opts.threadStore.get(threadId)) : null;
    const projectPath = thread?.projectPath
      ? await validateProjectPath(thread.projectPath)
      : null;
    const tasks = await Promise.resolve(opts.taskStore.listByThread(threadId));

    const artifacts: ThreadArtifact[] = [];
    for (const task of tasks) {
      const refs = task.artifactRefs ?? [];
      for (const ref of refs) {
        if (!projectPath) {
          // No projectPath binding — surface refs as-is but skip
          // existence checks (we can't be sure where they live).
          const owner = task.ownerCatId ?? 'unknown';
          artifacts.push({
            path: ref,
            absolutePath: ref,
            kind: 'other',
            ownerCatId: owner,
            taskId: task.id,
            createdAt: task.updatedAt ?? task.createdAt,
          });
          continue;
        }
        const artifact = buildThreadArtifact(
          task,
          projectPath,
          ref,
          'other',
          undefined,
        );
        if (artifact) artifacts.push(artifact);
      }
    }

    // Stable ordering: owner → createdAt desc
    artifacts.sort((a, b) => {
      if (a.ownerCatId !== b.ownerCatId) return a.ownerCatId.localeCompare(b.ownerCatId);
      return b.createdAt - a.createdAt;
    });
    return reply.send({ artifacts });
  });
};
