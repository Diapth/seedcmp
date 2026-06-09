function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeExistingMemberIds(existingMembers = []) {
  const ids = new Set();
  existingMembers.forEach((member = {}) => {
    [
      member.id,
      member.uid,
      member.agentId,
      member.agent_id,
      member.catId,
      member.cat_id,
      member.directCatId,
      member.direct_cat_id
    ].map(clean).filter(Boolean).forEach((id) => {
      ids.add(id);
      ids.add(`agent:${id}`);
    });
  });
  return ids;
}

export function normalizeAgentCandidate(agent = {}) {
  const agentId = clean(agent.id || agent.agentId || agent.uid || agent.catId || agent.directCatId);
  if (!agentId) return null;
  const name = clean(agent.name || agent.nickname || agent.alias || agentId);
  const alias = clean(agent.alias || (name.startsWith('@') ? name : `@${agentId}`));
  return {
    ...agent,
    id: `agent:${agentId}`,
    uid: `agent:${agentId}`,
    agentId,
    nickname: name,
    name,
    avatar: clean(agent.avatar || agent.logo),
    inviteType: 'agent',
    alias,
    platform: clean(agent.platform || agent.clientId || agent.raw?.clientId || agent.raw?.client_id),
    rawAgent: agent
  };
}

export function normalizeContactCandidate(contact = {}) {
  const id = clean(contact.id || contact.uid);
  if (!id) return null;
  const name = clean(contact.nickname || contact.name || contact.remark || id);
  return {
    ...contact,
    id,
    uid: id,
    nickname: name,
    name,
    avatar: clean(contact.avatar),
    inviteType: 'contact'
  };
}

export function buildSelectableGroupMembers({ contacts = [], agents = [], existingMembers = [] } = {}) {
  const existingIds = normalizeExistingMemberIds(existingMembers);
  const agentCandidates = agents
    .map(normalizeAgentCandidate)
    .filter(Boolean)
    .filter((agent) => !existingIds.has(agent.id) && !existingIds.has(agent.agentId));
  const contactCandidates = contacts
    .map(normalizeContactCandidate)
    .filter(Boolean)
    .filter((contact) => !existingIds.has(contact.id));
  return [...agentCandidates, ...contactCandidates];
}

export function splitSelectedGroupMembers(selectedIds = [], selectableMembers = []) {
  const byId = new Map(selectableMembers.map((member) => [member.id, member]));
  const contactIds = [];
  const agents = [];
  selectedIds.map(clean).filter(Boolean).forEach((id) => {
    const item = byId.get(id);
    if (!item) return;
    if (item.inviteType === 'agent') {
      agents.push(item.rawAgent || item);
      return;
    }
    contactIds.push(item.id);
  });
  return {
    contactIds,
    agentIds: agents.map((agent) => clean(agent.id || agent.agentId || agent.uid || agent.catId || agent.directCatId)).filter(Boolean),
    agents
  };
}
