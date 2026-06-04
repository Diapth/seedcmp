import type { CatId } from './ids.js';

export type LeadSelectionMode = 'direct' | 'coordinator';

export type LeadSelectionReason =
  | 'no_mention'
  | 'explicit_coordinator'
  | 'multi_mention'
  | 'direct_mention'
  | 'coordinator_unavailable'
  | 'fallback'
  | 'whisper_override';

export interface LeadSelection {
  readonly leadCatId: CatId;
  readonly participantCatIds: readonly CatId[];
  readonly mode: LeadSelectionMode;
  readonly reason: LeadSelectionReason;
}

export type CoordinationPhase = 'intake' | 'planning' | 'dispatching' | 'aggregating' | 'completed' | 'blocked';

export interface CoordinationContext {
  readonly id: string;
  readonly leadCatId: CatId;
  readonly participantCatIds: readonly CatId[];
  readonly phase: CoordinationPhase;
  readonly artifactRefs?: readonly string[];
}

export interface WorkspaceProposal {
  readonly displayName: string;
  readonly slug: string;
  readonly rootPath: string;
  readonly relativePath: string;
  readonly sourceIntent: string;
  readonly confidence: number;
  readonly collision?: 'none' | 'existing_active' | 'existing_archived' | 'slug_taken';
  readonly existingWorkspaceId?: string;
}

/**
 * When a coordinator finishes its first intake reply, it may emit a fenced
 * `cat-recommendation` JSON block suggesting cats to invite into a new project
 * group chat. This is the persisted, transport-friendly form of that
 * recommendation — stored once per coordinationId, surfaced to im_web via
 * WebSocket, and dismissed when the user accepts/declines the kickoff card.
 */
export interface CoordinatorKickoff {
  readonly coordinationId: string;
  readonly messageId: string;
  readonly suggestedCats: readonly CatId[];
  readonly reason?: string;
  readonly workspaceProposal?: WorkspaceProposal;
  readonly createdAt: number;
}
