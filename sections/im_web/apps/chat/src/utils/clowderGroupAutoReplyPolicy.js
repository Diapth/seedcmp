const GENERIC_CAT_TRIGGERS = ['猫猫'];
function unique(values) {
    return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
}
function normalizeToken(value) {
    return String(value || '').replace(/^@/, '').trim().toLocaleLowerCase();
}
function availableCats(cats) {
    return cats.filter(cat => cat.catId && cat.available !== false);
}
function catTokens(cat) {
    return unique([
        cat.catId,
        cat.displayName || '',
        ...(cat.aliases || []),
        ...(cat.mentionNames || [])
    ]);
}
function findAvailableCat(cats, catId) {
    const normalized = normalizeToken(catId || '');
    if (!normalized)
        return undefined;
    return cats.find(cat => normalizeToken(cat.catId) === normalized && cat.available !== false);
}
function catMentionedByName(text, cat) {
    return catTokens(cat)
        .map(token => token.replace(/^@/, '').trim())
        .filter(Boolean)
        .some(token => text.includes(token));
}
function getReplyTargetCatId(replyTarget) {
    const content = replyTarget?.content || replyTarget?.payload || {};
    const connectorId = content.connectorId || content.connector_id;
    if (connectorId !== 'im-web')
        return '';
    return String(content.catId || content.cat_id || '').trim();
}
function decision(reason, targetCatIds = []) {
    return {
        shouldRoute: targetCatIds.length > 0,
        targetCatIds,
        reason
    };
}
function resolveSoftTextTrigger(text, cats, focusedCatId, lastActiveCatId) {
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
function recentMessageText(message) {
    const content = message?.content || message?.payload || {};
    return String(message?.text || content.text || content.content || '').trim();
}
function isRecentCatMessage(message) {
    const content = message?.content || message?.payload || {};
    return message?.fromCat === true ||
        Boolean(message?.catId || content.catId || content.cat_id || content.catDisplayName || content.cat_display_name) ||
        String(content.connectorId || content.connector_id || '') === 'im-web';
}
function resolveRecentContextTrigger(input, cats) {
    const recent = input.recentMessages || [];
    let sawCatReplyAfterCandidate = false;
    for (let index = recent.length - 1; index >= 0; index--) {
        const message = recent[index];
        if (isRecentCatMessage(message)) {
            sawCatReplyAfterCandidate = true;
            continue;
        }
        if (sawCatReplyAfterCandidate)
            continue;
        const text = recentMessageText(message);
        if (!text)
            continue;
        const contextDecision = resolveSoftTextTrigger(text, cats, input.focusedCatId, input.lastActiveCatId);
        if (contextDecision.shouldRoute || contextDecision.reason === 'ambiguous_cat_keyword') {
            return contextDecision;
        }
    }
    return undefined;
}
export function resolveGroupCatAutoReplyTrigger(input) {
    const explicitTargetCatIds = unique(input.explicitTargetCatIds || []);
    if (explicitTargetCatIds.length > 0) {
        return decision('explicit_mention', explicitTargetCatIds);
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
