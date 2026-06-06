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
function catMatchesToken(cat, value) {
    const normalized = normalizeToken(value || '');
    if (!normalized)
        return false;
    return catTokens(cat).some(token => normalizeToken(token) === normalized);
}
function catMentionedByName(text, cat) {
    return catTokens(cat)
        .map(token => token.replace(/^@/, '').trim())
        .filter(Boolean)
        .some(token => text.includes(token));
}
function getReplyTargetCatId(replyTarget, cats) {
    const content = replyTarget?.content || replyTarget?.payload || {};
    const metadata = content.metadata || {};
    const connectorId = content.connectorId || content.connector_id || metadata.connectorId || metadata.connector_id;
    const explicit = String(replyTarget?.catId ||
        replyTarget?.cat_id ||
        content.catId ||
        content.cat_id ||
        content.agentId ||
        content.agent_id ||
        metadata.catId ||
        metadata.cat_id ||
        metadata.agentId ||
        metadata.agent_id ||
        '').trim();
    if (explicit)
        return explicit;
    const fromUID = String(replyTarget?.fromUID || replyTarget?.from_uid || replyTarget?.from || '').trim();
    if (fromUID.startsWith('clowder_cat:'))
        return fromUID.slice('clowder_cat:'.length);
    if (fromUID.startsWith('clowder_cat_'))
        return fromUID.slice('clowder_cat_'.length);
    if (fromUID.startsWith('clowder:'))
        return fromUID.slice('clowder:'.length);
    const displayName = String(content.catDisplayName ||
        content.cat_display_name ||
        content.catName ||
        content.cat_name ||
        metadata.catDisplayName ||
        metadata.cat_display_name ||
        metadata.catName ||
        metadata.cat_name ||
        '').trim();
    const matchedByName = cats.find(cat => catMatchesToken(cat, displayName));
    if (matchedByName)
        return matchedByName.catId;
    if (connectorId === 'im-web' && displayName)
        return displayName;
    return '';
}
function isCoordinatorReplyTarget(replyTarget, catId) {
    const content = replyTarget?.content || replyTarget?.payload || {};
    const metadata = content.metadata || {};
    const candidates = [
        catId,
        replyTarget?.targetType,
        replyTarget?.senderType,
        content.targetType,
        content.target_type,
        content.senderType,
        content.sender_type,
        content.catDisplayName,
        content.cat_display_name,
        content.catName,
        content.cat_name,
        metadata.targetType,
        metadata.target_type,
        metadata.senderType,
        metadata.sender_type,
        metadata.catDisplayName,
        metadata.cat_display_name,
        replyTarget?.fromUID,
        replyTarget?.from_uid,
        replyTarget?.from
    ].map(value => normalizeToken(String(value || '')));
    return candidates.some(value => [
        'coordinator',
        'pm',
        '协调者',
        '主agent',
        '主代理',
        'clowder:coordinator',
        'clowder_cat:coordinator',
        'clowder_cat_coordinator'
    ].includes(value));
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
    const defaultTargetCatId = String(input.defaultTargetCatId || '').trim();
    const replyTargetCatId = getReplyTargetCatId(input.replyTarget, cats);
    if (isCoordinatorReplyTarget(input.replyTarget, replyTargetCatId) && defaultTargetCatId) {
        return decision('reply_to_coordinator', [defaultTargetCatId]);
    }
    const replyCat = findAvailableCat(cats, replyTargetCatId);
    if (replyCat) {
        return decision('reply_to_cat', [replyCat.catId]);
    }
    if (input.mode === 'soft_mentions' && defaultTargetCatId) {
        return decision('default_coordinator', [defaultTargetCatId]);
    }
    if (cats.length === 0) {
        return decision('no_available_cats');
    }
    const text = String(input.text || '').trim();
    const currentDecision = resolveSoftTextTrigger(text, cats, input.focusedCatId, input.lastActiveCatId);
    if (currentDecision.reason !== 'no_trigger') {
        return currentDecision;
    }
    return resolveRecentContextTrigger(input, cats) || currentDecision;
}
