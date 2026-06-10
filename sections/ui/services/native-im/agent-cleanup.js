import {
  buildClowderCatContactId,
  getClowderCatIdFromContactId
} from './agent-state.js';

function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return '';
}

function unique(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

export function resolveAgentDeleteIdentity(agent = {}) {
  const rawId = firstNonEmpty(
    agent.catId,
    agent.cat_id,
    agent.directCatId,
    agent.direct_cat_id,
    getClowderCatIdFromContactId(agent.id),
    getClowderCatIdFromContactId(agent.agentId),
    agent.raw?.catId,
    agent.raw?.cat_id,
    agent.raw?.id,
    agent.id,
    agent.agentId,
    agent.uid
  );
  const catId = getClowderCatIdFromContactId(rawId) || rawId;
  return {
    catId,
    directConversationIds: unique([
      catId ? buildClowderCatContactId(catId) : '',
      catId,
      agent.id,
      agent.agentId,
      agent.uid
    ])
  };
}

export function isAgentMatch(candidate = {}, identity = {}) {
  const catId = clean(identity.catId);
  const ids = new Set([
    catId,
    catId ? buildClowderCatContactId(catId) : '',
    ...identity.directConversationIds || []
  ].map(clean).filter(Boolean));
  const candidateIds = [
    candidate.id,
    candidate.uid,
    candidate.agentId,
    candidate.agent_id,
    candidate.catId,
    candidate.cat_id,
    candidate.directCatId,
    candidate.direct_cat_id,
    candidate.raw?.catId,
    candidate.raw?.cat_id,
    getClowderCatIdFromContactId(candidate.id),
    getClowderCatIdFromContactId(candidate.agentId)
  ].map(clean).filter(Boolean);
  return candidateIds.some((id) => ids.has(id));
}

export function markAgentDeleted(records = {}, agent = {}, deletedAt = Date.now()) {
  const identity = resolveAgentDeleteIdentity(agent);
  if (!identity.catId) return records;
  records[identity.catId] = {
    catId: identity.catId,
    deletedAt,
    directConversationIds: identity.directConversationIds
  };
  return records;
}

export function isAgentDeleted(agent = {}, records = {}) {
  const identity = resolveAgentDeleteIdentity(agent);
  if (!identity.catId) return false;
  const record = records[identity.catId];
  if (!record) return false;
  const deletedAt = Number(record.deletedAt || 0);
  const lastActiveAt = Number(
    agent.lastActiveAt
    || agent.last_active_at
    || agent.updatedAt
    || agent.updated_at
    || agent.createdAt
    || agent.created_at
    || 0
  );
  if (lastActiveAt > deletedAt) return false;
  return true;
}

export function filterDeletedAgents(agents = [], records = {}) {
  return (agents || []).filter((agent) => !isAgentDeleted(agent, records));
}

export function cleanupAgentFromLocalState(state = {}, agent = {}, options = {}) {
  const identity = resolveAgentDeleteIdentity(agent);
  const directIds = new Set(identity.directConversationIds);
  const agents = (state.agents || []).filter((item) => !isAgentMatch(item, identity));
  const conversations = (state.conversations || []).filter((conversation) => {
    if (directIds.has(clean(conversation.id)) || directIds.has(clean(conversation.channelId))) return false;
    return !isAgentMatch(conversation, identity);
  });
  const members = Object.fromEntries(Object.entries(state.members || {}).map(([groupId, list]) => [
    groupId,
    (list || []).filter((member) => !isAgentMatch(member, identity))
  ]));
  const messages = { ...(state.messages || {}) };
  if (options.deleteDirectMessages) {
    identity.directConversationIds.forEach((id) => {
      delete messages[id];
    });
  }
  const activeId = directIds.has(clean(state.activeId)) ? '' : (state.activeId || '');

  return {
    ...state,
    agents,
    conversations,
    members,
    messages,
    activeId,
    directConversationIds: identity.directConversationIds,
    removedConversationIds: [...identity.directConversationIds].filter((id) => (
      (state.conversations || []).some((conversation) => conversation.id === id || conversation.channelId === id)
    ))
  };
}
