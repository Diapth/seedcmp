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
    } : {}),
    platform: firstNonEmpty(agent.platform, agent.clientId, agent.raw?.platform, agent.raw?.clientId, agent.raw?.client_id),
    clientId: firstNonEmpty(agent.clientId, agent.client_id, agent.raw?.clientId, agent.raw?.client_id),
    accessMode: firstNonEmpty(agent.accessMode, agent.access_mode, agent.authType, agent.auth_type, agent.raw?.accessMode, agent.raw?.access_mode, agent.raw?.authType, agent.raw?.auth_type),
    authType: firstNonEmpty(agent.authType, agent.auth_type, agent.accessMode, agent.access_mode, agent.raw?.authType, agent.raw?.auth_type, agent.raw?.accessMode, agent.raw?.access_mode),
    accountRef: firstNonEmpty(agent.accountRef, agent.account_ref, agent.raw?.accountRef, agent.raw?.account_ref)
  };
}

function normalizeDisplayLookup(value = '') {
  return firstNonEmpty(value)
    .replace(new RegExp(`^${CLOWDER_CAT_CONTACT_PREFIX}`), '')
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/智能体|ai/g, '');
}

function agentConversationLookupValues(entity = {}) {
  const raw = entity.raw || {};
  const values = [
    entity.id,
    entity.channelId,
    entity.uid,
    entity.agentId,
    entity.agent_id,
    entity.catId,
    entity.cat_id,
    entity.directCatId,
    entity.direct_cat_id,
    raw.id,
    raw.uid,
    raw.agentId,
    raw.agent_id,
    raw.catId,
    raw.cat_id,
    raw.directCatId,
    raw.direct_cat_id
  ].map((value) => firstNonEmpty(value)).filter(Boolean);
  const expanded = new Set();
  values.forEach((value) => {
    expanded.add(value);
    if (value.startsWith(CLOWDER_CAT_CONTACT_PREFIX)) {
      expanded.add(value.slice(CLOWDER_CAT_CONTACT_PREFIX.length));
    } else {
      expanded.add(`${CLOWDER_CAT_CONTACT_PREFIX}${value}`);
    }
  });
  return [...expanded].map((value) => normalizeClowderLookupKey(value)).filter(Boolean);
}

export function findAgentForConversation(conversation = {}, agents = []) {
  if (!conversation || conversation.type !== 'robot') return null;
  const conversationKeys = new Set(agentConversationLookupValues(conversation));
  if (conversationKeys.size) {
    const direct = (agents || []).find((agent) =>
      agentConversationLookupValues(agent).some((key) => conversationKeys.has(key))
    );
    if (direct) return direct;
  }

  const conversationName = normalizeDisplayLookup(firstNonEmpty(conversation.name, conversation.nickname));
  if (!conversationName) return null;
  return (agents || []).find((agent) => {
    const agentName = normalizeDisplayLookup(firstNonEmpty(agent.name, agent.nickname, agent.displayName));
    const agentAlias = normalizeDisplayLookup(agent.alias);
    return (agentName && (conversationName.includes(agentName) || agentName.includes(conversationName)))
      || (agentAlias && (conversationName.includes(agentAlias) || agentAlias.includes(conversationName)));
  }) || null;
}

function isRuntimeAccessMode(value = '') {
  return ['oauth', 'api-key', 'api_key'].includes(firstNonEmpty(value).toLowerCase());
}

function isBackendPlaceholderAccessMode(value = '') {
  const mode = firstNonEmpty(value).toLowerCase();
  return !mode || mode === 'backend' || mode === 'clowder';
}

function isBackendPlaceholderPlatform(value = '') {
  const platform = firstNonEmpty(value).toLowerCase();
  return !platform || platform === 'clowder' || platform === 'backend';
}

function isGenericTemplate(value = '') {
  const template = firstNonEmpty(value).toLowerCase();
  return !template || template === 'general';
}

export function mergeClowderAgentRuntimeConfig(incoming = {}, existing = {}) {
  if (!incoming || !existing) return incoming;
  if (!isRuntimeAccessMode(existing.accessMode || existing.authType)) return incoming;
  const next = { ...incoming };
  if (isBackendPlaceholderAccessMode(incoming.accessMode || incoming.authType)) {
    next.accessMode = existing.accessMode;
    next.authType = existing.authType || existing.accessMode;
  }
  if (isBackendPlaceholderPlatform(incoming.platform)) {
    next.platform = existing.platform;
  }
  if (!firstNonEmpty(incoming.accountRef, incoming.account_ref) && firstNonEmpty(existing.accountRef, existing.account_ref)) {
    next.accountRef = firstNonEmpty(existing.accountRef, existing.account_ref);
  }
  if (isGenericTemplate(incoming.roleTemplate) && !isGenericTemplate(existing.roleTemplate)) {
    next.roleTemplate = existing.roleTemplate;
  }
  if (isGenericTemplate(incoming.templateId) && !isGenericTemplate(existing.templateId || existing.roleTemplate)) {
    next.templateId = firstNonEmpty(existing.templateId, existing.roleTemplate);
  }
  if (!firstNonEmpty(incoming.model, incoming.defaultModel, incoming.customModel)) {
    next.model = existing.model;
    next.defaultModel = existing.defaultModel;
    next.customModel = existing.customModel;
  }
  next.runtimeConfigPreserved = true;
  return next;
}

export function createAgentMember(agent = {}) {
  const id = firstNonEmpty(agent.id, agent.agentId, agent.uid, agent.catId, agent.cat_id, agent.directCatId, agent.direct_cat_id, agent.alias);
  const name = firstNonEmpty(agent.displayName, agent.display_name, agent.name, agent.nickname, agent.alias, '智能体');
  const alias = firstNonEmpty(agent.alias, name.startsWith('@') ? name : `@${id || name}`);
  const catId = isClowderAgent(agent) ? resolveClowderCatId(agent, id) : '';
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
    agentId: catId || id,
    ...(catId ? {
      catId,
      directCatId: catId,
      source: 'clowder'
    } : {}),
    platform: firstNonEmpty(agent.platform, agent.clientId, agent.raw?.platform, agent.raw?.clientId, agent.raw?.client_id),
    clientId: firstNonEmpty(agent.clientId, agent.client_id, agent.raw?.clientId, agent.raw?.client_id),
    accessMode: firstNonEmpty(agent.accessMode, agent.access_mode, agent.authType, agent.auth_type, agent.raw?.accessMode, agent.raw?.access_mode, agent.raw?.authType, agent.raw?.auth_type),
    authType: firstNonEmpty(agent.authType, agent.auth_type, agent.accessMode, agent.access_mode, agent.raw?.authType, agent.raw?.auth_type, agent.raw?.accessMode, agent.raw?.access_mode),
    accountRef: firstNonEmpty(agent.accountRef, agent.account_ref, agent.raw?.accountRef, agent.raw?.account_ref),
    status: agent.status || 'active'
  };
}

function memberLookupValues(entity = {}) {
  const raw = entity.raw || {};
  const values = [
    entity.id,
    entity.uid,
    entity.agentId,
    entity.agent_id,
    entity.catId,
    entity.cat_id,
    entity.directCatId,
    entity.direct_cat_id,
    raw.id,
    raw.uid,
    raw.agentId,
    raw.agent_id,
    raw.catId,
    raw.cat_id,
    raw.directCatId,
    raw.direct_cat_id
  ].map((value) => firstNonEmpty(value)).filter(Boolean);
  const expanded = new Set();
  values.forEach((value) => {
    const text = firstNonEmpty(value);
    if (!text) return;
    expanded.add(text);
    expanded.add(text.replace(/^agent:/, ''));
    if (text.startsWith(CLOWDER_CAT_CONTACT_PREFIX)) {
      expanded.add(text.slice(CLOWDER_CAT_CONTACT_PREFIX.length));
    } else {
      expanded.add(`${CLOWDER_CAT_CONTACT_PREFIX}${text}`);
    }
  });
  return [...expanded].map((value) => value.toLowerCase());
}

function indexGroupMembersByIdentity(members = []) {
  const index = new Map();
  members.forEach((member, memberIndex) => {
    memberLookupValues(member).forEach((key) => {
      if (!index.has(key)) index.set(key, memberIndex);
    });
  });
  return index;
}

export function mergeGroupMembersWithAgentMembers(members = [], agents = []) {
  const next = (members || []).map((member) => ({ isMuted: false, role: 'member', ...member }));
  const memberIndexByIdentity = indexGroupMembersByIdentity(next);

  (agents || []).forEach((agent) => {
    const agentMember = createAgentMember(agent);
    if (!agentMember.id) return;
    const identities = memberLookupValues({ ...agent, ...agentMember });
    const existingIndex = identities
      .map((key) => memberIndexByIdentity.get(key))
      .find((index) => index !== undefined);

    if (existingIndex !== undefined) {
      const existing = next[existingIndex];
      next[existingIndex] = {
        ...existing,
        ...agentMember,
        id: existing.id || agentMember.id,
        uid: existing.uid || existing.id || agentMember.uid,
        role: existing.role || agentMember.role || 'member',
        isMuted: existing.isMuted ?? agentMember.isMuted ?? false,
        isAgent: true,
        agentId: agentMember.agentId || existing.agentId || existing.id
      };
      memberLookupValues(next[existingIndex]).forEach((key) => {
        if (!memberIndexByIdentity.has(key)) memberIndexByIdentity.set(key, existingIndex);
      });
      return;
    }

    const newIndex = next.length;
    next.push(agentMember);
    identities.forEach((key) => {
      if (!memberIndexByIdentity.has(key)) memberIndexByIdentity.set(key, newIndex);
    });
  });

  return next;
}
