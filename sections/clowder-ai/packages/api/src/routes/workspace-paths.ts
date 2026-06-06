/**
 * Workspace path validation API
 *
 *   GET /api/workspace/validate?path=...
 *     — Validate that a user-supplied project path is acceptable before
 *       creating a project group chat. Wraps the existing
 *       `validateProjectPath` (denylist by default, allowlist when
 *       PROJECT_ALLOWED_ROOTS is set) so im_web can give the user a
 *       friendly error before they hit "create group chat".
 *
 * The canonical validation already happens inside `POST /api/threads`; this
 * route is a read-only preview that mirrors the same rules.
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { getAllowedRoots, validateProjectPath } from '../utils/project-path.js';

export interface WorkspacePathsRoutesOptions {
  log: {
    warn: (obj: object, msg?: string) => void;
  };
}

interface ValidateResponse {
  valid: boolean;
  absolute: string;
  exists: boolean;
  isDirectory: boolean;
  /** In legacy allowlist mode, the roots a valid path must be under. */
  allowedRoots?: string[];
  reason?: string;
}

function readPathParam(req: FastifyRequest): string {
  const query = req.query as { path?: string };
  return String(query.path ?? '').trim();
}

export const workspacePathsRoutes: FastifyPluginAsync<WorkspacePathsRoutesOptions> = async (
  app,
  _opts,
) => {
  app.get('/api/workspace/validate', async (request, reply) => {
    const raw = readPathParam(request);
    if (!raw) {
      const allowedRoots = getAllowedRoots();
      return reply.status(400).send({
        valid: false,
        absolute: '',
        exists: false,
        isDirectory: false,
        ...(allowedRoots.length > 0 ? { allowedRoots } : {}),
        reason: 'path 不能为空',
      } satisfies ValidateResponse);
    }

    const allowedRoots = getAllowedRoots();
    const validated = await validateProjectPath(raw);
    if (!validated) {
      // Re-derive the absolute path for the response so the caller can show
      // them what we tried.
      const { resolve } = await import('node:path');
      return reply.send({
        valid: false,
        absolute: resolve(raw),
        exists: false,
        isDirectory: false,
        ...(allowedRoots.length > 0 ? { allowedRoots } : {}),
        reason: '路径无效(必须是一个存在的目录,且不在系统保护目录下)',
      } satisfies ValidateResponse);
    }
    return reply.send({
      valid: true,
      absolute: validated,
      exists: true,
      isDirectory: true,
      ...(allowedRoots.length > 0 ? { allowedRoots } : {}),
    } satisfies ValidateResponse);
  });
};
