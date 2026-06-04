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
 *       tab. Files that no longer exist on disk are returned with diagnostic
 *       status instead of being silently filtered out.
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

export type ArtifactKind = 'code' | 'doc' | 'image' | 'preview' | 'file' | 'patch' | 'workspace' | 'other';
export type ThreadArtifactStatus = 'available' | 'missing' | 'outside_project' | 'forbidden';
export type ThreadArtifactSource = 'declared' | 'task_ref';
export type ThreadTaskDiagnosticsState = 'ok' | 'success_empty' | 'thread_binding_mismatch' | 'created_task_missing';
const ARTIFACT_REF_PREFIX = 'artifact:';

export interface ThreadArtifact {
  path: string;                // relative to projectPath
  absolutePath: string;        // absolute when known
  kind: ArtifactKind;
  description?: string;
  ownerCatId: string;
  taskId: string;
  createdAt: number;
  source: ThreadArtifactSource;
  status: ThreadArtifactStatus;
  reason?: string;
}

export interface ThreadTaskMismatchDiagnostic {
  taskId: string;
  expectedThreadId: string;
  actualThreadId: string;
  title?: string;
  ownerCatId?: string | null;
  status?: string;
}

export interface ThreadTaskDiagnostics {
  state: ThreadTaskDiagnosticsState;
  taskCount: number;
  queryThreadId: string;
  observedTaskIds: string[];
  missingTaskIds: string[];
  mismatchedTasks: ThreadTaskMismatchDiagnostic[];
}

interface ParsedArtifactRef {
  path: string;
  kind: ArtifactKind;
  description?: string;
  source: ThreadArtifactSource;
}

function threadIdFromParams(req: FastifyRequest): string {
  const params = req.params as { threadId?: string };
  return String(params?.threadId ?? '').trim();
}

function stringListFromQuery(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const item of values) {
    if (typeof item !== 'string') continue;
    for (const part of item.split(',')) {
      const trimmed = part.trim();
      if (trimmed && !out.includes(trimmed)) out.push(trimmed);
    }
  }
  return out;
}

async function buildThreadTaskDiagnostics(
  taskStore: ITaskStore,
  threadId: string,
  tasks: TaskItem[],
  observedTaskIds: string[],
): Promise<ThreadTaskDiagnostics> {
  const inThread = new Set(tasks.map((task) => task.id));
  const missingTaskIds: string[] = [];
  const mismatchedTasks: ThreadTaskMismatchDiagnostic[] = [];

  for (const taskId of observedTaskIds) {
    if (inThread.has(taskId)) continue;
    const task = await Promise.resolve(taskStore.get(taskId));
    if (!task) {
      missingTaskIds.push(taskId);
      continue;
    }
    if (task.threadId !== threadId) {
      mismatchedTasks.push({
        taskId,
        expectedThreadId: threadId,
        actualThreadId: task.threadId,
        title: task.title,
        ownerCatId: task.ownerCatId ?? null,
        status: task.status,
      });
    }
  }

  let state: ThreadTaskDiagnosticsState = tasks.length > 0 ? 'ok' : 'success_empty';
  if (mismatchedTasks.length > 0) {
    state = 'thread_binding_mismatch';
  } else if (missingTaskIds.length > 0) {
    state = 'created_task_missing';
  }

  return {
    state,
    taskCount: tasks.length,
    queryThreadId: threadId,
    observedTaskIds,
    missingTaskIds,
    mismatchedTasks,
  };
}

function isPathInsideRoot(child: string, root: string): boolean {
  const childAbs = isAbsolute(child) ? child : resolve(child);
  if (childAbs === root) return true;
  return childAbs.startsWith(root + sep) || childAbs.startsWith(root + '/');
}

export function isSupportedArtifactKind(kind: string): kind is ArtifactKind {
  return ['code', 'doc', 'image', 'preview', 'file', 'patch', 'workspace', 'other'].includes(kind);
}

export function serializeArtifactRef(
  path: string,
  kind: ArtifactKind = 'other',
  description?: string,
): string {
  if (kind === 'other' && !description) return path;
  return `${ARTIFACT_REF_PREFIX}${JSON.stringify({
    path,
    kind,
    ...(description ? { description } : {}),
  })}`;
}

export function parseArtifactRef(ref: string): ParsedArtifactRef {
  if (!ref.startsWith(ARTIFACT_REF_PREFIX)) {
    return { path: ref, kind: 'other', source: 'task_ref' };
  }
  try {
    const parsed = JSON.parse(ref.slice(ARTIFACT_REF_PREFIX.length)) as {
      path?: unknown;
      kind?: unknown;
      description?: unknown;
    };
    const path = typeof parsed.path === 'string' && parsed.path.trim() ? parsed.path : ref;
    const kind = typeof parsed.kind === 'string' && isSupportedArtifactKind(parsed.kind)
      ? parsed.kind
      : 'other';
    const description = typeof parsed.description === 'string' ? parsed.description : undefined;
    return { path, kind, description, source: 'declared' };
  } catch {
    return { path: ref, kind: 'other', source: 'task_ref' };
  }
}

export function appendArtifactRef(
  refs: readonly string[] | undefined,
  path: string,
  kind: ArtifactKind,
  description?: string,
): string[] {
  const existing = refs ?? [];
  if (existing.some((ref) => parseArtifactRef(ref).path === path)) {
    return [...existing];
  }
  return [...existing, serializeArtifactRef(path, kind, description)];
}

export function findOrCreateArtifactTask(
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
      const refs = appendArtifactRef(existing.artifactRefs, path, kind, description);
      if (refs.length !== (existing.artifactRefs ?? []).length) {
        const updated = await Promise.resolve(taskStore.update(existing.id, { artifactRefs: refs }));
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
        artifactRefs: [serializeArtifactRef(path, kind, description)],
      }),
    );
    // Touch updatedAt to surface the task in list queries.
    const touched = await Promise.resolve(taskStore.update(created.id, { why: description ?? created.why }));
    return touched ?? created;
  })();
}

export function buildThreadArtifact(
  task: TaskItem,
  projectPath: string,
  path: string,
  kind: ArtifactKind,
  description: string | undefined,
  source: ThreadArtifactSource = 'task_ref',
): ThreadArtifact {
  const absolutePath = isAbsolute(path) ? path : resolve(projectPath, path);
  const outsideProject = Boolean(projectPath && !isPathInsideRoot(absolutePath, projectPath));
  const exists = existsSync(absolutePath);
  const status: ThreadArtifactStatus = outsideProject ? 'outside_project' : exists ? 'available' : 'missing';
  return {
    path: projectPath && !outsideProject ? absolutePath.slice(projectPath.length).replace(/^[\\/]+/, '') : path,
    absolutePath,
    kind,
    description,
    ownerCatId: task.ownerCatId ?? 'unknown',
    taskId: task.id,
    createdAt: task.updatedAt ?? task.createdAt,
    source,
    status,
    ...(status === 'outside_project' ? { reason: 'artifact path is outside thread projectPath' } : {}),
    ...(status === 'missing' ? { reason: 'artifact path does not exist on disk' } : {}),
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
    const query = request.query as { expectedTaskId?: unknown; observedTaskIds?: unknown };
    const observedTaskIds = Array.from(new Set([
      ...stringListFromQuery(query.expectedTaskId),
      ...stringListFromQuery(query.observedTaskIds),
    ]));
    const diagnostics = await buildThreadTaskDiagnostics(opts.taskStore, threadId, tasks, observedTaskIds);
    return reply.send({ threadId, tasks, diagnostics });
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
    if (!isSupportedArtifactKind(kind)) {
      return reply.status(400).send({ error: 'kind must be one of code|doc|image|preview|file|patch|workspace|other' });
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
        const parsedRef = parseArtifactRef(ref);
        if (!projectPath) {
          const owner = task.ownerCatId ?? 'unknown';
          artifacts.push({
            path: parsedRef.path,
            absolutePath: parsedRef.path,
            kind: parsedRef.kind,
            ...(parsedRef.description ? { description: parsedRef.description } : {}),
            ownerCatId: owner,
            taskId: task.id,
            createdAt: task.updatedAt ?? task.createdAt,
            source: parsedRef.source,
            status: isAbsolute(parsedRef.path) && !existsSync(parsedRef.path) ? 'missing' : 'available',
            ...(isAbsolute(parsedRef.path) && !existsSync(parsedRef.path) ? { reason: 'artifact path does not exist on disk' } : {}),
          });
          continue;
        }
        const artifact = buildThreadArtifact(
          task,
          projectPath,
          parsedRef.path,
          parsedRef.kind,
          parsedRef.description,
          parsedRef.source,
        );
        artifacts.push(artifact);
      }
    }

    // Stable ordering: owner → createdAt desc
    artifacts.sort((a, b) => {
      if (a.ownerCatId !== b.ownerCatId) return a.ownerCatId.localeCompare(b.ownerCatId);
      return b.createdAt - a.createdAt;
    });
    const diagnostics = artifacts.reduce<Record<string, number>>((acc, artifact) => {
      acc[artifact.status] = (acc[artifact.status] ?? 0) + 1;
      return acc;
    }, {});
    return reply.send({ artifacts, diagnostics });
  });
};
