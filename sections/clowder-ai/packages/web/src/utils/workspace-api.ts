/**
 * F214: Maomi Workspace API helpers
 *
 * Calls the maomi-workspaces REST API through the unified apiFetch client.
 */

import { apiFetch } from './api-client';

// ---- Types (mirrors packages/api/src/domains/maomi-workspaces/MaomiWorkspaceStore.ts) ----

export type MaomiWorkspaceStatus = 'active' | 'archived' | 'discarded';

export interface WorkspaceSummary {
  id: string;
  workspaceId: string;
  slug: string;
  displayName: string;
  rootPath: string;
  relativePath: string;
  sourceIntent?: string;
  linkedThreadIds: string[];
  linkedTaskIds: string[];
  createdBy: 'user' | 'coordinator' | 'cat' | 'system';
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  status: MaomiWorkspaceStatus;
}

export interface CreateWorkspaceInput {
  slug: string;
  displayName: string;
  sourceIntent?: string;
  createdBy?: 'user' | 'coordinator' | 'cat' | 'system';
  threadId?: string;
}

// ---- API Functions ----

/** List workspaces for the current user */
export async function fetchWorkspaces(status?: MaomiWorkspaceStatus): Promise<WorkspaceSummary[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await apiFetch(`/api/maomi-workspaces${query}`);
  if (!res.ok) {
    throw new Error(`获取项目群列表失败 (${res.status})`);
  }
  const data = (await res.json()) as { items: WorkspaceSummary[] };
  return data.items;
}

/** Create a new workspace */
export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceSummary> {
  const res = await apiFetch('/api/maomi-workspaces', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { error?: string }).error || `创建失败 (${res.status})`;
    throw new Error(message);
  }
  return (await res.json()) as WorkspaceSummary;
}
