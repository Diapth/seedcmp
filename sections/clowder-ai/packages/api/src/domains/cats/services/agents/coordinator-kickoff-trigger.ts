/**
 * Coordinator Kickoff Trigger
 *
 * When a coordinator finishes its first intake reply, scan the accumulated text
 * for a `cat-recommendation` JSON block. If present and the coordination phase
 * is still `intake`, persist a CoordinatorKickoff and push it to the user over
 * WebSocket so im_web can surface the "Create Project Group Chat?" card.
 *
 * This is the only place that calls the kickoff store from the message flow,
 * keeping parsing + persistence + emission in one well-tested seam.
 */

import type { CoordinatorKickoff } from '@cat-cafe/shared';
import type { IMaomiWorkspaceStore } from '../../../maomi-workspaces/MaomiWorkspaceStore.js';
import type { ICoordinatorKickoffStore } from '../stores/ports/CoordinatorKickoffStore.js';
import {
  hasCoordinatorRecommendation,
  parseCoordinatorRecommendation,
} from './routing/coordinator-recommendation-parser.js';

export const COORDINATOR_KICKOFF_EVENT = 'coordinator_kickoff';

export interface CoordinatorKickoffTriggerDeps {
  kickoffStore: ICoordinatorKickoffStore;
  /** WebSocket emitter — must accept (userId, event, data). */
  emit: (userId: string, event: string, data: unknown) => void;
  /** Logger — keep it pino-compatible (info/warn/error). */
  log: {
    info: (obj: object, msg?: string) => void;
    warn: (obj: object, msg?: string) => void;
    error: (obj: object, msg?: string) => void;
  };
  maomiWorkspaceStore?: IMaomiWorkspaceStore;
}

export interface MaybeEmitCoordinatorKickoffInput {
  userId: string;
  coordinationId: string;
  /** The coordinator's full reply text (after streaming aggregation). */
  replyText: string;
  /** The persisted message id of the coordinator's intake reply. */
  messageId: string;
  /** Coordination phase — only emit on `intake` so subsequent turns don't re-emit. */
  phase: string;
  /** Coordination id of an existing kickoff, if any — suppress duplicates. */
  existingKickoffCoordinationId?: string;
  /** User-facing request that produced the recommendation, used for workspace proposal. */
  sourceIntent?: string;
  /** Current conversation thread, if this proposal should bind there before group creation. */
  threadId?: string;
}

/**
 * Idempotent: returns the kickoff that was emitted, or null if no emission happened.
 * Reasons for skipping:
 *   - phase is not 'intake'
 *   - reply text has no `cat-recommendation` block
 *   - parser finds no valid suggested_cats
 *   - coordinationId already has a kickoff (defensive dedupe)
 */
export async function maybeEmitCoordinatorKickoff(
  input: MaybeEmitCoordinatorKickoffInput,
  deps: CoordinatorKickoffTriggerDeps,
): Promise<CoordinatorKickoff | null> {
  if (input.phase !== 'intake') return null;
  if (!hasCoordinatorRecommendation(input.replyText)) return null;
  if (input.existingKickoffCoordinationId === input.coordinationId) return null;

  const rec = parseCoordinatorRecommendation(input.replyText);
  if (rec.suggestedCats.length === 0) {
    deps.log.warn(
      { coordinationId: input.coordinationId },
      '[coordinator-kickoff] recommendation block present but no valid suggested_cats — skipping',
    );
    return null;
  }

  const sourceIntent = input.sourceIntent?.trim() || rec.reason || input.replyText.slice(0, 200);
  const workspaceProposal = deps.maomiWorkspaceStore
    ? await deps.maomiWorkspaceStore.propose(input.userId, sourceIntent, input.threadId).catch((err) => {
        deps.log.warn({ err, coordinationId: input.coordinationId }, '[coordinator-kickoff] workspace proposal failed');
        return null;
      })
    : null;

  const kickoff: CoordinatorKickoff = {
    coordinationId: input.coordinationId,
    messageId: input.messageId,
    suggestedCats: rec.suggestedCats,
    ...(rec.reason ? { reason: rec.reason } : {}),
    ...(workspaceProposal ? { workspaceProposal } : {}),
    createdAt: Date.now(),
  };

  try {
    await deps.kickoffStore.put(kickoff);
  } catch (err) {
    deps.log.error(
      { err, coordinationId: input.coordinationId },
      '[coordinator-kickoff] failed to persist kickoff',
    );
    return null;
  }

  try {
    deps.emit(input.userId, COORDINATOR_KICKOFF_EVENT, kickoff);
  } catch (err) {
    deps.log.error(
      { err, coordinationId: input.coordinationId },
      '[coordinator-kickoff] failed to emit WS event',
    );
  }

  deps.log.info(
    { coordinationId: input.coordinationId, suggestedCats: rec.suggestedCats },
    '[coordinator-kickoff] emitted project kickoff',
  );

  return kickoff;
}
