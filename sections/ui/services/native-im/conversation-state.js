import { messageDigestFromInput } from './normalizers.js';

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

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = clean(value);
    if (text) return value;
  }
  return '';
}

function toTimestampMs(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const next = safeNumber(value, 0);
  if (!next) return fallback;
  return next > 100000000000 ? next : next * 1000;
}

function groupLastMessageTime(input = {}) {
  const recent = Array.isArray(input.recents) ? input.recents[0] : null;
  const lastMessage = input.last_message || input.lastMessageObj || {};
  return firstNonEmpty(
    input.last_msg_time,
    input.lastMsgTime,
    input.last_message_time,
    input.lastMessageTime,
    input.timestamp,
    input.lastTime,
    lastMessage.timestamp,
    lastMessage.time,
    lastMessage.created_at,
    lastMessage.createdAt,
    recent?.timestamp,
    recent?.time,
    recent?.created_at,
    recent?.createdAt
  );
}

export function conversationDraftKey(channelId, channelType = 1) {
  return `${clean(channelId)}-${Number(channelType || 1)}`;
}

export function conversationDeleteKey(channelId, channelType = 1) {
  return `${clean(channelId)}:${Number(channelType || 1)}`;
}

function conversationSeqTime(conversation = {}) {
  return {
    seq: safeNumber(
      conversation.lastSeq
      || conversation.last_msg_seq
      || conversation.lastMsgSeq
      || conversation.messageSeq
      || conversation.message_seq,
      0
    ),
    time: safeNumber(
      conversation.lastTime
      || conversation.last_msg_time
      || conversation.lastMsgTime
      || conversation.timestamp
      || conversation.updatedAt
      || conversation.updated_at,
      0
    )
  };
}

export function createDeletedConversationRecord(conversation = {}, deletedAt = Date.now(), options = {}) {
  const { seq, time } = conversationSeqTime(conversation);
  return {
    lastSeq: options.permanent ? Number.MAX_SAFE_INTEGER : seq,
    lastTime: time,
    deletedAt,
    ...(options.permanent ? { permanent: true } : {})
  };
}

function normalizeDeletedConversationRecord(record = {}) {
  if (!record || typeof record !== 'object') return null;
  return {
    lastSeq: safeNumber(record.lastSeq || record.last_msg_seq || record.lastMsgSeq || record.seq, 0),
    lastTime: safeNumber(record.lastTime || record.last_msg_time || record.lastMsgTime || record.time, 0),
    deletedAt: safeNumber(record.deletedAt || record.deleted_at, Date.now())
  };
}

function incomingIsNewerThanDeletedRecord(conversation = {}, record = {}) {
  const normalized = normalizeDeletedConversationRecord(record);
  if (!normalized) return false;
  const { seq, time } = conversationSeqTime(conversation);
  if (seq > 0 && seq > normalized.lastSeq) return true;
  if (normalized.lastSeq >= Number.MAX_SAFE_INTEGER && seq <= 0) return false;
  if (time > 0 && time > normalized.lastTime) return true;
  return false;
}

export function shouldSuppressDeletedConversation(conversation = {}, deletedRecords = {}) {
  const identity = conversationIdentity(conversation);
  if (!identity.channelId) return false;
  const record = normalizeDeletedConversationRecord(deletedRecords[conversationDeleteKey(identity.channelId, identity.channelType)]);
  if (!record) return false;
  return !incomingIsNewerThanDeletedRecord(conversation, record);
}

export function filterDeletedConversations(conversations = [], deletedRecords = {}) {
  return conversations.filter((conversation) => !shouldSuppressDeletedConversation(conversation, deletedRecords));
}

export function resolveGroupPageId(routeOptions = {}, state = {}) {
  return clean(
    routeOptions.id
    || routeOptions.groupId
    || routeOptions.group_id
    || state.activeGroupId
    || state.activeConversationId
    || state.activeId
    || state.fallbackGroupId
    || '2'
  );
}

export function buildGroupScopedRoute(basePath, groupId, extraParams = {}) {
  const pairs = [['id', clean(groupId)]];
  Object.entries(extraParams).forEach(([key, value]) => {
    const text = clean(value);
    if (text) pairs.push([key, text]);
  });
  const query = pairs
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `${basePath}?${query}`;
}

export function shouldPersistConversationDraft(conversation = {}, identity = {}) {
  const channelId = clean(identity.channelId || conversation.channelId || conversation.channel_id || conversation.id);
  const name = clean(conversation.name || conversation.title || conversation.displayName).toLowerCase();
  if (!channelId) return false;
  if (channelId.toLowerCase().includes('clowder') || name.includes('clowder') || name.includes('协同猫')) return false;
  if (conversation.source === 'mock' || conversation.type === 'robot' || conversation.isAgent) return false;
  return true;
}

function conversationIdentity(conversation = {}) {
  return {
    channelId: clean(conversation.channelId || conversation.channel_id || conversation.id),
    channelType: Number(conversation.channelType || conversation.channel_type || (conversation.type === 'group' ? 2 : 1) || 1)
  };
}

export function conversationReadKey(channelId, channelType = 1) {
  return `${clean(channelId)}:${Number(channelType || 1)}`;
}

function markerCoversConversation(conversation = {}, marker = {}) {
  if (!marker) return false;
  const lastSeq = safeNumber(conversation.lastSeq || conversation.last_msg_seq || conversation.lastMsgSeq, 0);
  const markerSeq = safeNumber(marker.seq || marker.messageSeq || marker.lastSeq, 0);
  if (lastSeq && markerSeq && markerSeq >= lastSeq) return true;

  const lastTime = safeNumber(conversation.lastTime || conversation.timestamp || conversation.updatedAt || conversation.updated_at, 0);
  const markerTime = safeNumber(marker.time || marker.readAt || marker.timestamp, 0);
  if (markerTime && (!lastTime || markerTime >= lastTime)) return true;

  return Boolean(markerTime && !lastSeq && !lastTime);
}

export function conversationDisplayUnread(conversation = {}, options = {}) {
  const unread = safeNumber(conversation.unread, 0);
  if (unread <= 0) return 0;
  if (conversation.source === 'mock') return 0;

  const identity = conversationIdentity(conversation);
  const activeId = clean(options.activeId);
  if (activeId && (activeId === clean(conversation.id) || activeId === identity.channelId)) return 0;

  const marker = options.readMarkers?.[conversationReadKey(identity.channelId, identity.channelType)];
  if (markerCoversConversation(conversation, marker)) return 0;
  return unread;
}

export function totalDisplayUnread(conversations = [], options = {}) {
  return conversations.reduce((total, conversation) => (
    total + conversationDisplayUnread(conversation, options)
  ), 0);
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
  const clearedKeys = options.clearedKeys || new Set();
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
    if (clearedKeys.has(key)) return { ...conversation, draft: '' };
    if (!draftByKey.has(key) || dirtyKeys.has(key)) return conversation;
    return { ...conversation, draft: draftByKey.get(key) || '' };
  });
}

export function normalizeNativeGroup(input = {}) {
  const id = clean(input.group_no || input.groupNo || input.id || input.channel_id || input.channelId);
  const name = clean(input.name || input.group_name || input.groupName || id || '群聊');
  const digest = messageDigestFromInput(input);
  const lastMessage = digest && digest !== '收到一条新消息' ? digest : '';
  const lastTime = toTimestampMs(groupLastMessageTime(input), lastMessage ? Date.now() : 0);
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
    createTime: toTimestampMs(input.created_at ?? input.createdAt ?? input.createTime, 0),
    lastMessage,
    lastTime,
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
    lastMessage: normalized.lastMessage || `你已加入群聊 ${normalized.name}`,
    lastTime: normalized.lastTime || normalized.createTime || 0,
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
  const existing = next[index];
  const shouldUseGroupLastMessage = nextConversation.lastTime
    && (!existing.lastTime || nextConversation.lastTime >= existing.lastTime);
  next[index] = {
    ...nextConversation,
    ...existing,
    name: normalized.name || existing.name,
    avatar: normalized.avatar || existing.avatar,
    memberCount: normalized.memberCount || existing.memberCount || 0,
    channelType: 2,
    type: 'group',
    lastMessage: shouldUseGroupLastMessage ? nextConversation.lastMessage : existing.lastMessage,
    lastTime: shouldUseGroupLastMessage ? nextConversation.lastTime : (existing.lastTime || nextConversation.lastTime || 0)
  };
  return next;
}

export function mergeNativeConversationTimeline(existing = {}, incoming = {}) {
  const hasIncomingTime = Boolean(incoming.lastTime);
  const hasIncomingMessage = clean(incoming.lastMessage);
  return {
    lastMessage: hasIncomingMessage ? incoming.lastMessage : (existing.lastMessage || ''),
    lastTime: hasIncomingTime ? incoming.lastTime : (existing.lastTime || 0)
  };
}
