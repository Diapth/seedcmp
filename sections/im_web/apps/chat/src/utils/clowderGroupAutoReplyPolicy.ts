export type GroupCatAutoReplyMode = 'off' | 'mentions_only' | 'soft_mentions';

export type GroupCatAutoReplyReason =
  | 'explicit_mention'
  | 'default_coordinator'
  | 'soft_cat_keyword'
  | 'soft_cat_name'
  | 'reply_to_cat'
  | 'ambiguous_cat_keyword'
  | 'auto_reply_disabled'
  | 'no_available_cats'
  | 'no_trigger';

export interface GroupCatAutoReplyCat {
  catId: string;
  displayName?: string;
  aliases?: string[];
  mentionNames?: string[];
  available?: boolean;
}

export interface GroupCatAutoReplyDecision {
  shouldRoute: boolean;
  targetCatIds: string[];
  reason: GroupCatAutoReplyReason;
}

export interface GroupCatRecentMessage {
  text?: string;
  content?: any;
  payload?: any;
  fromCat?: boolean;
  catId?: string;
}

export interface ResolveGroupCatAutoReplyInput {
  text: string;
  mode: GroupCatAutoReplyMode;
  cats: GroupCatAutoReplyCat[];
  explicitTargetCatIds?: string[];
  defaultTargetCatId?: string;
  focusedCatId?: string;
  lastActiveCatId?: string;
  replyTarget?: any;
  recentMessages?: GroupCatRecentMessage[];
}

const GENERIC_CAT_TRIGGERS = ['猫猫'];

function unique(values: string[]) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
}

function normalizeToken(value: string) {
  return String(value || '').replace(/^@/, '').trim().toLocaleLowerCase();
}

function availableCats(cats: GroupCatAutoReplyCat[]) {
  return cats.filter(cat => cat.catId && cat.available !== false);
}

function catTokens(cat: GroupCatAutoReplyCat) {
  return unique([
    cat.catId,
    cat.displayName || '',
    ...(cat.aliases || []),
    ...(cat.mentionNames || [])
  ]);
}

function findAvailableCat(cats: GroupCatAutoReplyCat[], catId?: string) {
  const normalized = normalizeToken(catId || '');
  if (!normalized) return undefined;
  return cats.find(cat => normalizeToken(cat.catId) === normalized && cat.available !== false);
}

function catMentionedByName(text: string, cat: GroupCatAutoReplyCat) {
  return catTokens(cat)
    .map(token => token.replace(/^@/, '').trim())
    .filter(Boolean)
    .some(token => text.includes(token));
}

function getReplyTargetCatId(replyTarget: any) {
  const content = replyTarget?.content || replyTarget?.payload || {};
  const connectorId = content.connectorId || content.connector_id;
  if (connectorId !== 'im-web') return '';
  return String(content.catId || content.cat_id || '').trim();
}

function decision(reason: GroupCatAutoReplyReason, targetCatIds: string[] = []): GroupCatAutoReplyDecision {
  return {
    shouldRoute: targetCatIds.length > 0,
    targetCatIds,
    reason
  };
}

function resolveSoftTextTrigger(
  text: string,
  cats: GroupCatAutoReplyCat[],
  focusedCatId?: string,
  lastActiveCatId?: string
) {
  const namedCats = cats.filter(cat => catMentionedByName(text, cat));
  if (namedCats.length === 1) {
    return decision('soft_cat_name', [namedCats[0].catId]);
  }
  if (namedCats.length > 1) {
    return decision('ambiguous_cat_keyword');
  }

  const hasGenericCatTrigger = GENERIC_CAT_TRIGGERS.some(trigger => text.includes(trigger));
  if (!hasGenericCatTrigger) {
    return decision('no_trigger');
  }

  const focusedCat = findAvailableCat(cats, focusedCatId);
  if (focusedCat) {
    return decision('soft_cat_keyword', [focusedCat.catId]);
  }

  const lastActiveCat = findAvailableCat(cats, lastActiveCatId);
  if (lastActiveCat) {
    return decision('soft_cat_keyword', [lastActiveCat.catId]);
  }

  if (cats.length === 1) {
    return decision('soft_cat_keyword', [cats[0].catId]);
  }

  return decision('ambiguous_cat_keyword');
}

function recentMessageText(message: GroupCatRecentMessage) {
  const content = message?.content || message?.payload || {};
  return String(message?.text || content.text || content.content || '').trim();
}

function isRecentCatMessage(message: GroupCatRecentMessage) {
  const content = message?.content || message?.payload || {};
  return message?.fromCat === true ||
    Boolean(message?.catId || content.catId || content.cat_id || content.catDisplayName || content.cat_display_name) ||
    String(content.connectorId || content.connector_id || '') === 'im-web';
}

function resolveRecentContextTrigger(input: ResolveGroupCatAutoReplyInput, cats: GroupCatAutoReplyCat[]) {
  const recent = input.recentMessages || [];
  let sawCatReplyAfterCandidate = false;
  for (let index = recent.length - 1; index >= 0; index--) {
    const message = recent[index];
    if (isRecentCatMessage(message)) {
      sawCatReplyAfterCandidate = true;
      continue;
    }
    if (sawCatReplyAfterCandidate) continue;
    const text = recentMessageText(message);
    if (!text) continue;
    const contextDecision = resolveSoftTextTrigger(text, cats, input.focusedCatId, input.lastActiveCatId);
    if (contextDecision.shouldRoute || contextDecision.reason === 'ambiguous_cat_keyword') {
      return contextDecision;
    }
  }
  return undefined;
}

export function resolveGroupCatAutoReplyTrigger(input: ResolveGroupCatAutoReplyInput): GroupCatAutoReplyDecision {
  const explicitTargetCatIds = unique(input.explicitTargetCatIds || []);
  if (explicitTargetCatIds.length > 0) {
    return decision('explicit_mention', explicitTargetCatIds);
  }

  const defaultTargetCatId = String(input.defaultTargetCatId || '').trim();
  if (input.mode === 'soft_mentions' && defaultTargetCatId) {
    return decision('default_coordinator', [defaultTargetCatId]);
  }

  if (input.mode !== 'soft_mentions') {
    return decision('auto_reply_disabled');
  }

  const cats = availableCats(input.cats || []);
  if (cats.length === 0) {
    return decision('no_available_cats');
  }

  const replyCat = findAvailableCat(cats, getReplyTargetCatId(input.replyTarget));
  if (replyCat) {
    return decision('reply_to_cat', [replyCat.catId]);
  }

  const text = String(input.text || '').trim();
  const currentDecision = resolveSoftTextTrigger(text, cats, input.focusedCatId, input.lastActiveCatId);
  if (currentDecision.reason !== 'no_trigger') {
    return currentDecision;
  }

  return resolveRecentContextTrigger(input, cats) || currentDecision;
}
