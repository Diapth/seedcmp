/**
 * Coordinator Kickoff Store
 *
 * Persists one CoordinatorKickoff per coordinationId, produced when a coordinator
 * finishes its first intake reply and emits a `cat-recommendation` JSON block.
 * The kickoff is consumed by im_web to surface a "Create Project Group Chat?"
 * card; once the user accepts or dismisses it, the record is removed.
 */

import type { CoordinatorKickoff } from '@cat-cafe/shared';

export interface ICoordinatorKickoffStore {
  put(kickoff: CoordinatorKickoff): Promise<void>;
  get(coordinationId: string): Promise<CoordinatorKickoff | null>;
  delete(coordinationId: string): Promise<boolean>;
  list(): Promise<CoordinatorKickoff[]>;
}

export class InMemoryCoordinatorKickoffStore implements ICoordinatorKickoffStore {
  private readonly byCoordinationId = new Map<string, CoordinatorKickoff>();

  async put(kickoff: CoordinatorKickoff): Promise<void> {
    this.byCoordinationId.set(kickoff.coordinationId, kickoff);
  }

  async get(coordinationId: string): Promise<CoordinatorKickoff | null> {
    return this.byCoordinationId.get(coordinationId) ?? null;
  }

  async delete(coordinationId: string): Promise<boolean> {
    return this.byCoordinationId.delete(coordinationId);
  }

  async list(): Promise<CoordinatorKickoff[]> {
    return [...this.byCoordinationId.values()];
  }
}
