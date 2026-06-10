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

export const CLOWDER_CAT_CONTACT_PREFIX = 'clowder_cat:';

export function buildClowderCatContactId(catId = '') {
  const id = firstNonEmpty(catId);
  if (!id) return '';
  if (id.startsWith(CLOWDER_CAT_CONTACT_PREFIX)) return id;
  return `${CLOWDER_CAT_CONTACT_PREFIX}${id}`;
}

export function getClowderCatIdFromContactId(contactId = '') {
  const id = firstNonEmpty(contactId);
  if (!id.startsWith(CLOWDER_CAT_CONTACT_PREFIX)) return '';
  return id.slice(CLOWDER_CAT_CONTACT_PREFIX.length);
}

function resolveClowderCatId(agent = {}, fallback = '') {
  const id = firstNonEmpty(
    agent.catId,
    agent.cat_id,
    agent.directCatId,
    agent.direct_cat_id,
    agent.raw?.catId,
    agent.raw?.cat_id,
    agent.raw?.roleTemplateId,
    agent.raw?.role_template_id,
    agent.raw?.id,
    fallback
  );
  return getClowderCatIdFromContactId(id) || id;
}

export function isClowderAgent(agent = {}) {
  const source = clean(agent.source || agent.platform || agent.raw?.source).toLowerCase();
  return source === 'clowder'
    || source.includes('clowder')
    || Boolean(agent.catId || agent.cat_id || agent.directCatId || agent.raw?.catId || agent.raw?.cat_id);
}

export function shouldPreserveClowderAgentDisplayName(existing = {}, incoming = {}) {
  const channelId = firstNonEmpty(incoming.channelId, incoming.id, existing.channelId, existing.id);
  const hasClowderContact = Boolean(getClowderCatIdFromContactId(channelId));
  const existingName = firstNonEmpty(existing.name, existing.nickname);
  const incomingName = firstNonEmpty(incoming.name, incoming.nickname);
  return hasClowderContact
    && existingName
    && (
      incomingName === channelId
      || existing.source === 'clowder'
      || existing.isAgent
      || existing.type === 'robot'
    );
}

function clowderAgentDisplayName(agent = {}) {
  return firstNonEmpty(agent.name, agent.nickname, agent.displayName, agent.display_name, agent.alias);
}

function clowderAgentAvatar(agent = {}) {
  return firstNonEmpty(agent.avatar, agent.logo);
}

export function applyClowderAgentDirectoryToConversations(conversations = [], agents = []) {
  const agentByCatId = new Map();
  (agents || []).forEach((agent) => {
    const catId = resolveClowderCatId(agent, firstNonEmpty(agent.id, agent.agentId, agent.uid));
    if (!catId) return;
    agentByCatId.set(catId, agent);
    agentByCatId.set(buildClowderCatContactId(catId), agent);
  });
  if (!agentByCatId.size) return conversations;

  return conversations.map((conversation) => {
    const channelId = firstNonEmpty(conversation.channelId, conversation.id);
    const catId = getClowderCatIdFromContactId(channelId);
    if (!catId) return conversation;
    const agent = agentByCatId.get(catId) || agentByCatId.get(channelId);
    if (!agent) return conversation;
    const displayName = clowderAgentDisplayName(agent);
    return {
      ...conversation,
      name: displayName || conversation.name,
      avatar: clowderAgentAvatar(agent) || conversation.avatar,
      type: 'robot',
      source: 'clowder',
      isAgent: true,
      agentId: catId,
      directCatId: catId
    };
  });
}

export function createAgentConversation(agent = {}) {
  const baseId = firstNonEmpty(agent.id, agent.agentId, agent.uid, agent.alias);
  const directCatId = isClowderAgent(agent) ? resolveClowderCatId(agent, baseId) : '';
  const id = directCatId ? buildClowderCatContactId(directCatId) : baseId;
  const name = firstNonEmpty(agent.name, agent.nickname, agent.alias, '智能体');
  return {
    id,
    channelId: id,
    channelType: 1,
    type: 'robot',
    name,
    avatar: firstNonEmpty(agent.avatar, agent.logo),
    unread: 0,
    lastMessage: firstNonEmpty(agent.desc, agent.description, '智能体已连接，可以开始对话'),
    lastTime: Date.now(),
    isPinned: false,
    isMuted: false,
    draft: '',
    isAgent: true,
    agentId: directCatId || id,
    ...(directCatId ? {
      source: 'clowder',
      directCatId
    } : {})
  };
}

export function createAgentMember(agent = {}) {
  const id = firstNonEmpty(agent.id, agent.agentId, agent.uid, agent.alias);
  const name = firstNonEmpty(agent.name, agent.nickname, agent.alias, '智能体');
  const alias = firstNonEmpty(agent.alias, name.startsWith('@') ? name : `@${id || name}`);
  return {
    id,
    uid: id,
    nickname: name,
    name,
    alias,
    avatar: firstNonEmpty(agent.avatar, agent.logo),
    role: 'member',
    isMuted: false,
    isAgent: true,
    agentId: id,
    status: agent.status || 'active'
  };
}
