import type { MultiMentionResult } from '@cat-cafe/shared';
import type { ICoordinatorStore } from '../../stores/ports/CoordinatorStore.js';
import { isCoordinationTerminal } from '../../stores/ports/CoordinatorStore.js';
import { resolveActiveCoordination, transitionToward } from './CoordinatorDispatcher.js';

export interface CoordinatorAggregate {
  summary: string;
  hasFailure: boolean;
  conflicts: string[];
}

const PATH_RE = /(?:^|\s)([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+)(?=$|\s|[),，。；;])/g;

export function buildCoordinatorAggregate(result: MultiMentionResult): CoordinatorAggregate {
  const received = result.responses.filter((response) => response.status === 'received');
  const failed = result.responses.filter((response) => response.status !== 'received');
  const conflicts = detectPotentialPathConflicts(result.responses.map((response) => response.content));
  const lines = [
    `协调派发 ${result.request.targets.length} 个子任务，收到 ${received.length} 个有效回复。`,
    ...received.map((response) => `@${response.catId}: ${compact(response.content)}`),
    ...failed.map((response) => `@${response.catId}: ${response.status}`),
    ...(conflicts.length ? [`潜在冲突路径：${conflicts.join(', ')}`] : []),
  ];
  return {
    summary: lines.join('\n'),
    hasFailure: failed.length > 0 || result.request.status === 'timeout' || result.request.status === 'failed',
    conflicts,
  };
}

export async function finalizeCoordinatorAggregation(
  store: ICoordinatorStore | undefined,
  input: {
    threadId: string;
    coordinationId?: string | undefined;
    result: MultiMentionResult;
  },
): Promise<void> {
  const coordination = await resolveActiveCoordination(store, input.threadId, input.coordinationId);
  if (!store || !coordination || isCoordinationTerminal(coordination.status)) return;

  const aggregate = buildCoordinatorAggregate(input.result);
  await transitionToward(store, coordination.coordinationId, 'aggregating');
  const refreshed = await store.get(coordination.coordinationId);
  if (!refreshed || isCoordinationTerminal(refreshed.status)) return;

  try {
    await store.update(coordination.coordinationId, {
      status: aggregate.hasFailure ? 'failed' : 'succeeded',
      aggregateSummary: aggregate.summary,
      ...(aggregate.hasFailure ? { failureReason: input.result.request.status } : {}),
    });
  } catch {
    // If an outside cancel/terminal write wins the race, keep that terminal state.
  }
}

export function detectPotentialPathConflicts(contents: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const content of contents) {
    const seenInMessage = new Set<string>();
    for (const match of content.matchAll(PATH_RE)) {
      const path = match[1];
      if (!path || path.includes('://')) continue;
      seenInMessage.add(path);
    }
    for (const path of seenInMessage) {
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([path]) => path)
    .sort();
}

function compact(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 240) || '(空回答)';
}
