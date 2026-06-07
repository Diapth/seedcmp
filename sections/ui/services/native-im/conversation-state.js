export function dropMockConversations(conversations = []) {
  return conversations.filter((item) => item?.source !== 'mock');
}

function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function safeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function conversationDraftKey(channelId, channelType = 1) {
  return `${clean(channelId)}-${Number(channelType || 1)}`;
}

function conversationIdentity(conversation = {}) {
  return {
    channelId: clean(conversation.channelId || conversation.channel_id || conversation.id),
    channelType: Number(conversation.channelType || conversation.channel_type || (conversation.type === 'group' ? 2 : 1) || 1)
  };
}

export function applyDraftToConversationList(conversations = [], channelId, channelType = 1, draft = '') {
  const key = conversationDraftKey(channelId, channelType);
  return conversations.map((conversation) => {
    const identity = conversationIdentity(conversation);
    if (conversationDraftKey(identity.channelId, identity.channelType) !== key) return conversation;
    return { ...conversation, draft: String(draft || '') };
  });
}

export function mergeRemoteDrafts(conversations = [], remoteDrafts = [], options = {}) {
  const dirtyKeys = options.dirtyKeys || new Set();
  const draftByKey = new Map();
  remoteDrafts.forEach((item) => {
    const channelId = item.channelId || item.channel_id || item.id;
    const channelType = item.channelType || item.channel_type || (item.type === 'group' ? 2 : 1);
    const key = conversationDraftKey(channelId, channelType);
    if (!key.startsWith('-')) {
      draftByKey.set(key, String(item.draft || ''));
    }
  });

  return conversations.map((conversation) => {
    const identity = conversationIdentity(conversation);
    const key = conversationDraftKey(identity.channelId, identity.channelType);
    if (!draftByKey.has(key) || dirtyKeys.has(key)) return conversation;
    return { ...conversation, draft: draftByKey.get(key) || '' };
  });
}

export function normalizeNativeGroup(input = {}) {
  const id = clean(input.group_no || input.groupNo || input.id || input.channel_id || input.channelId);
  const name = clean(input.name || input.group_name || input.groupName || id || '群聊');
  return {
    id,
    groupNo: id,
    channelId: id,
    channelType: 2,
    name,
    avatar: clean(input.avatar || input.logo),
    memberCount: safeNumber(input.member_count ?? input.memberCount ?? input.members_count, 0),
    announcement: clean(input.notice || input.announcement),
    creatorId: clean(input.creator || input.owner || input.creator_id || input.creatorId),
    createTime: safeNumber(input.created_at ?? input.createdAt ?? input.createTime, Date.now()),
    raw: input
  };
}

export function normalizeNativeGroupMember(input = {}) {
  const id = clean(input.uid || input.id || input.member_uid || input.memberUid || input.user_id);
  const roleValue = input.role ?? input.member_role ?? input.memberRole;
  const roleNumber = safeNumber(roleValue, 0);
  const role = roleValue === 'owner' || roleNumber === 2
    ? 'owner'
    : roleValue === 'admin' || roleNumber === 1
      ? 'admin'
      : 'member';
  return {
    id,
    uid: id,
    nickname: clean(input.name || input.nickname || input.remark || id || '用户'),
    avatar: clean(input.avatar || input.logo),
    role,
    remark: clean(input.remark),
    isMuted: Number(input.forbidden || input.mute || 0) === 1,
    raw: input
  };
}

export function upsertGroupConversation(conversations = [], group = {}) {
  const normalized = normalizeNativeGroup(group);
  if (!normalized.id) return conversations;
  const nextConversation = {
    id: normalized.id,
    channelId: normalized.id,
    channelType: 2,
    type: 'group',
    name: normalized.name,
    avatar: normalized.avatar,
    unread: 0,
    lastMessage: `你已加入群聊 ${normalized.name}`,
    lastTime: normalized.createTime || Date.now(),
    memberCount: normalized.memberCount,
    isPinned: false,
    isMuted: false,
    draft: ''
  };

  const index = conversations.findIndex((conversation) => {
    const identity = conversationIdentity(conversation);
    return identity.channelId === normalized.id && identity.channelType === 2;
  });
  if (index < 0) return [nextConversation, ...conversations];
  const next = [...conversations];
  next[index] = {
    ...nextConversation,
    ...next[index],
    name: normalized.name || next[index].name,
    avatar: normalized.avatar || next[index].avatar,
    memberCount: normalized.memberCount || next[index].memberCount || 0,
    channelType: 2,
    type: 'group'
  };
  return next;
}
