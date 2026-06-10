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

function isTechnicalClowderName(value = '', channelId = '') {
  const text = firstNonEmpty(value);
  if (!text) return false;
  return text === firstNonEmpty(channelId) || text.startsWith(CLOWDER_CAT_CONTACT_PREFIX);
}

function normalizeClowderLookupKey(value = '') {
  return firstNonEmpty(value)
    .replace(new RegExp(`^${CLOWDER_CAT_CONTACT_PREFIX}`), '')
    .replace(/^@/, '')
    .toLowerCase();
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
    && !isTechnicalClowderName(existingName, channelId)
    && (
      !incomingName
      || isTechnicalClowderName(incomingName, channelId)
      || existing.source === 'clowder'
      || existing.isAgent
      || existing.type === 'robot'
    );
}

function clowderAgentDisplayName(agent = {}, channelId = '') {
  const candidates = [
    agent.displayName,
    agent.display_name,
    agent.name,
    agent.nickname,
    agent.alias
  ];
  for (const value of candidates) {
    const text = firstNonEmpty(value);
    if (text && !isTechnicalClowderName(text, channelId)) return text;
  }
  return firstNonEmpty(agent.displayName, agent.display_name, agent.name, agent.nickname, agent.alias);
}

function clowderAgentAvatar(agent = {}) {
  return firstNonEmpty(agent.avatar, agent.logo);
}

function addClowderAgentLookup(agentByCatId, key, agent) {
  const lookupKey = normalizeClowderLookupKey(key);
  if (!lookupKey || agentByCatId.has(lookupKey)) return;
  agentByCatId.set(lookupKey, agent);
}

export function applyClowderAgentDirectoryToConversations(conversations = [], agents = []) {
  const agentByCatId = new Map();
  (agents || []).forEach((agent) => {
    const catId = resolveClowderCatId(agent, firstNonEmpty(agent.id, agent.agentId, agent.uid));
    if (!catId) return;
    [
      catId,
      buildClowderCatContactId(catId),
      agent.id,
      agent.agentId,
      agent.uid,
      agent.catId,
      agent.cat_id,
      agent.directCatId,
      agent.direct_cat_id,
      agent.alias,
      agent.nickname,
      agent.raw?.id,
      agent.raw?.catId,
      agent.raw?.cat_id,
      agent.raw?.directCatId,
      agent.raw?.direct_cat_id,
      agent.raw?.alias,
      agent.raw?.nickname,
      ...(Array.isArray(agent.aliases) ? agent.aliases : []),
      ...(Array.isArray(agent.mentionPatterns) ? agent.mentionPatterns : []),
      ...(Array.isArray(agent.mention_patterns) ? agent.mention_patterns : []),
      ...(Array.isArray(agent.raw?.aliases) ? agent.raw.aliases : []),
      ...(Array.isArray(agent.raw?.mentionPatterns) ? agent.raw.mentionPatterns : []),
      ...(Array.isArray(agent.raw?.mention_patterns) ? agent.raw.mention_patterns : [])
    ].forEach((key) => addClowderAgentLookup(agentByCatId, key, agent));
  });
  if (!agentByCatId.size) return conversations;

  return conversations.map((conversation) => {
    const channelId = firstNonEmpty(conversation.channelId, conversation.id);
    const catId = getClowderCatIdFromContactId(channelId);
    if (!catId) return conversation;
    const agent = agentByCatId.get(normalizeClowderLookupKey(catId))
      || agentByCatId.get(normalizeClowderLookupKey(channelId));
    if (!agent) return conversation;
    const displayName = clowderAgentDisplayName(agent, channelId);
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
  const name = directCatId
    ? firstNonEmpty(clowderAgentDisplayName(agent, id), '智能体')
    : firstNonEmpty(agent.name, agent.nickname, agent.alias, '智能体');
  const threadId = firstNonEmpty(
    agent.threadId,
    agent.thread_id,
    agent.directThreadId,
    agent.direct_thread_id,
    agent.binding?.threadId,
    agent.binding?.thread_id,
    agent.raw?.threadId,
    agent.raw?.thread_id
  );
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
    ...(threadId ? {
      threadId,
      directThreadId: threadId
    } : {}),
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
