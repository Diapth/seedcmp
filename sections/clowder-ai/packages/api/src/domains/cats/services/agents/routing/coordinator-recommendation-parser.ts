import type { CatId } from '@cat-cafe/shared';

/**
 * Extract a coordinator's "project recommendation" JSON block from its reply text.
 *
 * Coordinators may emit a fenced JSON block to suggest cats to invite into a new
 * project group chat:
 *
 *     ```cat-recommendation
 *     { "suggested_cats": ["opus", "codex"], "reason": "..." }
 *     ```
 *
 * This function is tolerant:
 *   - missing block → returns empty suggestion
 *   - malformed JSON → returns empty suggestion (no throw)
 *   - non-array suggested_cats → returns empty suggestion
 *   - extra unknown fields in the JSON → ignored
 */
export interface CoordinatorRecommendation {
  suggestedCats: CatId[];
  reason?: string;
}

const BLOCK_RE = /```cat-recommendation\s*([\s\S]*?)```/i;
const INNER_OBJECT_RE = /\{[\s\S]*\}/;

export function hasCoordinatorRecommendation(text: string): boolean {
  if (typeof text !== 'string' || text.length === 0) return false;
  return BLOCK_RE.test(text);
}

export function parseCoordinatorRecommendation(text: string): CoordinatorRecommendation {
  if (typeof text !== 'string' || text.length === 0) {
    return { suggestedCats: [] };
  }

  const blockMatch = text.match(BLOCK_RE);
  if (!blockMatch) {
    return { suggestedCats: [] };
  }

  const inner = blockMatch[1] ?? '';
  const objectMatch = inner.match(INNER_OBJECT_RE);
  if (!objectMatch) {
    return { suggestedCats: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(objectMatch[0]);
  } catch {
    return { suggestedCats: [] };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { suggestedCats: [] };
  }

  const obj = parsed as Record<string, unknown>;
  const raw = obj.suggested_cats;
  if (!Array.isArray(raw)) {
    return { suggestedCats: [] };
  }

  const suggestedCats: CatId[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    suggestedCats.push(trimmed as CatId);
  }

  const reasonRaw = obj.reason;
  const reason =
    typeof reasonRaw === 'string' && reasonRaw.trim().length > 0
      ? reasonRaw.trim()
      : undefined;

  return reason
    ? { suggestedCats, reason }
    : { suggestedCats };
}
