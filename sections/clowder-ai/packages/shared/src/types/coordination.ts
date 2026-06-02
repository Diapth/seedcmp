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
