import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { RedisClient } from '@cat-cafe/shared/utils';
import { isValidMaomiSlug, nextCollisionSlug, proposeMaomiSlug } from './slug.js';

export type MaomiWorkspaceStatus = 'active' | 'archived' | 'discarded';
export type MaomiWorkspaceCreatedBy = 'user' | 'coordinator' | 'cat' | 'system';

export interface MaomiWorkspace {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  rootPath: string;
  relativePath: string;
  sourceIntent?: string;
  linkedThreadIds: string[];
  linkedTaskIds: string[];
  createdBy: MaomiWorkspaceCreatedBy;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  status: MaomiWorkspaceStatus;
}

export interface WorkspaceProposal {
  displayName: string;
  slug: string;
  rootPath: string;
  relativePath: string;
  sourceIntent: string;
  confidence: number;
  collision?: 'none' | 'existing_active' | 'existing_archived' | 'slug_taken';
  existingWorkspaceId?: string;
}

export interface CreateMaomiWorkspaceInput {
  userId: string;
  slug: string;
  displayName: string;
  sourceIntent?: string;
  createdBy: MaomiWorkspaceCreatedBy;
  threadId?: string;
}

export interface IMaomiWorkspaceStore {
  propose(userId: string, intentText: string, threadId?: string): Promise<WorkspaceProposal>;
  create(input: CreateMaomiWorkspaceInput): Promise<MaomiWorkspace>;
  get(id: string): Promise<MaomiWorkspace | null>;
  listByUser(userId: string, filter?: { status?: MaomiWorkspaceStatus }): Promise<MaomiWorkspace[]>;
  findBySlug(userId: string, slug: string): Promise<MaomiWorkspace | null>;
  linkThread(workspaceId: string, threadId: string): Promise<MaomiWorkspace | null>;
  linkTask(workspaceId: string, taskId: string): Promise<MaomiWorkspace | null>;
  archive(workspaceId: string): Promise<MaomiWorkspace | null>;
  discard(workspaceId: string): Promise<MaomiWorkspace | null>;
  restore(workspaceId: string): Promise<MaomiWorkspace | null>;
}

function normalizeUnique(items: readonly string[], item: string): string[] {
  return item && !items.includes(item) ? [...items, item] : [...items];
}

function statusRank(status: MaomiWorkspaceStatus): number {
  if (status === 'active') return 0;
  if (status === 'archived') return 1;
  return 2;
}

export class MaomiWorkspaceStore implements IMaomiWorkspaceStore {
  protected readonly byId = new Map<string, MaomiWorkspace>();

  constructor(protected readonly rootPath: string) {}

  async propose(userId: string, intentText: string): Promise<WorkspaceProposal> {
    const proposed = proposeMaomiSlug(intentText);
    const existing = await this.findBySlug(userId, proposed.slug);
    const takenSlugs = await this.listTakenSlugs();
    let collision: WorkspaceProposal['collision'] = 'none';
    let slug = proposed.slug;
    let existingWorkspaceId: string | undefined;
    if (existing) {
      collision = existing.status === 'archived' ? 'existing_archived' : 'existing_active';
      existingWorkspaceId = existing.id;
    } else if (takenSlugs.has(proposed.slug)) {
      collision = 'slug_taken';
    }
    if (collision !== 'none') {
      slug = nextCollisionSlug(proposed.slug, (candidate) => takenSlugs.has(candidate));
    }

    return {
      displayName: proposed.displayName,
      slug,
      rootPath: resolve(this.rootPath, slug),
      relativePath: this.relativePathForSlug(slug),
      sourceIntent: intentText,
      confidence: proposed.confidence,
      collision,
      ...(existingWorkspaceId ? { existingWorkspaceId } : {}),
    };
  }

  async create(input: CreateMaomiWorkspaceInput): Promise<MaomiWorkspace> {
    const slug = input.slug.trim().toLowerCase();
    if (!isValidMaomiSlug(slug)) {
      throw new Error('Invalid Maomi workspace slug');
    }
    const takenSlugs = await this.listTakenSlugs();
    if (takenSlugs.has(slug)) {
      throw new Error(`Maomi workspace slug already exists: ${slug}`);
    }

    const now = Date.now();
    const rootPath = resolve(this.rootPath, slug);
    await mkdir(resolve(rootPath, '.clowder', 'runtime'), { recursive: true });
    await mkdir(resolve(rootPath, 'artifacts'), { recursive: true });
    await mkdir(resolve(rootPath, 'previews'), { recursive: true });
    await mkdir(resolve(rootPath, 'patches'), { recursive: true });

    const workspace: MaomiWorkspace = {
      id: `maomi_${randomUUID()}`,
      userId: input.userId,
      slug,
      displayName: input.displayName.trim() || slug,
      rootPath,
      relativePath: this.relativePathForSlug(slug),
      ...(input.sourceIntent ? { sourceIntent: input.sourceIntent } : {}),
      linkedThreadIds: input.threadId ? [input.threadId] : [],
      linkedTaskIds: [],
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
      status: 'active',
    };

    await this.put(workspace);
    return workspace;
  }

  async get(id: string): Promise<MaomiWorkspace | null> {
    return this.byId.get(id) ?? null;
  }

  async listByUser(userId: string, filter?: { status?: MaomiWorkspaceStatus }): Promise<MaomiWorkspace[]> {
    return [...this.byId.values()]
      .filter((workspace) => workspace.userId === userId)
      .filter((workspace) => !filter?.status || workspace.status === filter.status)
      .sort((a, b) => statusRank(a.status) - statusRank(b.status) || b.lastActiveAt - a.lastActiveAt);
  }

  async findBySlug(userId: string, slug: string): Promise<MaomiWorkspace | null> {
    const normalized = slug.trim().toLowerCase();
    return [...this.byId.values()].find((workspace) => workspace.userId === userId && workspace.slug === normalized) ?? null;
  }

  async linkThread(workspaceId: string, threadId: string): Promise<MaomiWorkspace | null> {
    const workspace = await this.get(workspaceId);
    if (!workspace) return null;
    const now = Date.now();
    const updated = {
      ...workspace,
      linkedThreadIds: normalizeUnique(workspace.linkedThreadIds, threadId),
      updatedAt: now,
      lastActiveAt: now,
    };
    await this.put(updated);
    return updated;
  }

  async linkTask(workspaceId: string, taskId: string): Promise<MaomiWorkspace | null> {
    const workspace = await this.get(workspaceId);
    if (!workspace) return null;
    const now = Date.now();
    const updated = {
      ...workspace,
      linkedTaskIds: normalizeUnique(workspace.linkedTaskIds, taskId),
      updatedAt: now,
      lastActiveAt: now,
    };
    await this.put(updated);
    return updated;
  }

  async archive(workspaceId: string): Promise<MaomiWorkspace | null> {
    return this.updateStatus(workspaceId, 'archived');
  }

  async discard(workspaceId: string): Promise<MaomiWorkspace | null> {
    return this.updateStatus(workspaceId, 'discarded');
  }

  async restore(workspaceId: string): Promise<MaomiWorkspace | null> {
    return this.updateStatus(workspaceId, 'active');
  }

  protected async put(workspace: MaomiWorkspace): Promise<void> {
    this.byId.set(workspace.id, workspace);
    await this.writeProjectMetadata(workspace);
  }

  protected async listTakenSlugs(): Promise<Set<string>> {
    return new Set([...this.byId.values()].map((workspace) => workspace.slug));
  }

  private async updateStatus(workspaceId: string, status: MaomiWorkspaceStatus): Promise<MaomiWorkspace | null> {
    const workspace = await this.get(workspaceId);
    if (!workspace) return null;
    const updated = { ...workspace, status, updatedAt: Date.now() };
    await this.put(updated);
    return updated;
  }

  private async writeProjectMetadata(workspace: MaomiWorkspace): Promise<void> {
    await mkdir(resolve(workspace.rootPath, '.clowder'), { recursive: true });
    const projectJson = resolve(workspace.rootPath, '.clowder', 'project.json');
    await writeFile(projectJson, `${JSON.stringify(workspace, null, 2)}\n`, 'utf-8');
  }

  private relativePathForSlug(slug: string): string {
    return `${basename(this.rootPath)}/${slug}`;
  }
}

export class RedisMaomiWorkspaceStore extends MaomiWorkspaceStore {
  constructor(
    rootPath: string,
    private readonly redis: RedisClient,
  ) {
    super(rootPath);
  }

  override async get(id: string): Promise<MaomiWorkspace | null> {
    const raw = await this.redis.get(this.detailKey(id));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MaomiWorkspace;
    } catch {
      return null;
    }
  }

  override async listByUser(userId: string, filter?: { status?: MaomiWorkspaceStatus }): Promise<MaomiWorkspace[]> {
    const ids = await this.redis.smembers(this.userKey(userId));
    const workspaces: MaomiWorkspace[] = [];
    for (const id of ids) {
      const workspace = await this.get(id);
      if (workspace) workspaces.push(workspace);
    }
    return workspaces
      .filter((workspace) => !filter?.status || workspace.status === filter.status)
      .sort((a, b) => statusRank(a.status) - statusRank(b.status) || b.lastActiveAt - a.lastActiveAt);
  }

  override async findBySlug(userId: string, slug: string): Promise<MaomiWorkspace | null> {
    const id = await this.redis.get(this.slugKey(userId, slug.trim().toLowerCase()));
    return id ? this.get(id) : null;
  }

  protected override async put(workspace: MaomiWorkspace): Promise<void> {
    await super.put(workspace);
    const pipeline = this.redis.multi();
    pipeline.set(this.detailKey(workspace.id), JSON.stringify(workspace));
    pipeline.sadd(this.userKey(workspace.userId), workspace.id);
    pipeline.sadd(this.globalSlugKey(), workspace.slug);
    pipeline.set(this.slugKey(workspace.userId, workspace.slug), workspace.id);
    await pipeline.exec();
  }

  protected override async listTakenSlugs(): Promise<Set<string>> {
    return new Set(await this.redis.smembers(this.globalSlugKey()));
  }

  private detailKey(id: string): string {
    return `maomi-workspace:${id}`;
  }

  private userKey(userId: string): string {
    return `maomi-workspaces:user:${userId}`;
  }

  private globalSlugKey(): string {
    return 'maomi-workspaces:slugs';
  }

  private slugKey(userId: string, slug: string): string {
    return `maomi-workspaces:slug:${userId}:${slug}`;
  }
}
