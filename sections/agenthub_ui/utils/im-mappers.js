export function channelKey(channelId, channelType) {
  return `${channelId}-${toBackendChannelType(channelType)}`;
}

export function toBackendChannelType(type) {
  if (type === 2 || type === '2' || type === 'group') return 2;
  if (type === 3 || type === '3' || type === 'robot') return 1;
  return 1;
}

export function toVisualConversationType(channelType) {
  return Number(channelType) === 2 ? 'group' : 'single';
}

function pickContentText(content) {
  if (typeof content === 'string') return content;
  if (!content || typeof content !== 'object') return '';
  return content.text || content.content || content.title || content.name || '';
}

function pickMessageType(content, raw = {}) {
  if (raw.type && typeof raw.type === 'string') return raw.type;
  if (content?.type) return content.type;
  if (raw.payload?.type) return raw.payload.type;
  return 'text';
}

export function messageSummary(message = {}) {
  const type = message.type || pickMessageType(message.content, message);
  if (type === 'image') return '[图片]';
  if (type === 'voice') return '[语音]';
  if (type === 'file') return `[文件] ${message.fileName || message.name || pickContentText(message.content) || ''}`.trim();
  if (type === 'system') return message.content || '系统消息';
  return message.content || pickContentText(message.content) || '收到一条新消息';
}

export function createInboundMessage(raw = {}, userCache = {}) {
  const content = raw.content || raw.payload || {};
  const senderId = raw.from_uid || raw.fromUID || raw.senderId || raw.uid || '';
  const cachedUser = userCache[senderId] || {};
  const text = pickContentText(content);
  return {
    id: String(raw.message_id || raw.messageID || raw.id || raw.client_msg_no || raw.clientMsgNo || Date.now()),
    clientMsgNo: raw.client_msg_no || raw.clientMsgNo || '',
    messageSeq: Number(raw.message_seq || raw.messageSeq || 0),
    senderId,
    senderName: raw.from_name || raw.senderName || cachedUser.name || cachedUser.nickname || senderId || '未知用户',
    senderAvatar: raw.from_avatar || raw.senderAvatar || cachedUser.avatar || '',
    content: text,
    type: pickMessageType(content, raw),
    time: Number(raw.timestamp || raw.time || Date.now()),
    status: raw.status || 'success',
    reactions: raw.reactions || [],
    replyRef: raw.replyRef || raw.remote_extra?.reply || null,
    mentions: raw.mentions || raw.remote_extra?.mentions || [],
    raw
  };
}

export function toConversationItem(raw = {}, channelCache = {}) {
  const channelId = raw.channel_id || raw.channelId || raw.id || '';
  const channelType = Number(raw.channel_type || raw.channelType || toBackendChannelType(raw.type));
  const key = channelKey(channelId, channelType);
  const cached = channelCache[key] || {};
  const extra = raw.extra || raw.remote_extra || {};
  const lastMessage = raw.last_message || raw.lastMessage || {};
  return {
    id: String(channelId),
    channelId: String(channelId),
    channelType,
    key,
    name: raw.channel_name || raw.name || cached.name || '未命名会话',
    avatar: raw.channel_logo || raw.avatar || cached.avatar || '',
    type: raw.type || toVisualConversationType(channelType),
    unread: Number(raw.unread || 0),
    lastMessage: typeof lastMessage === 'string' ? lastMessage : messageSummary(createInboundMessage(lastMessage)),
    lastTime: Number(raw.timestamp || raw.last_time || raw.lastTime || Date.now()),
    lastMessageSeq: Number(raw.last_msg_seq || raw.lastMessageSeq || 0),
    isPinned: Number(extra.top ?? raw.top ?? raw.isPinned ?? 0) === 1 || raw.isPinned === true,
    isMuted: Number(extra.mute ?? raw.mute ?? raw.isMuted ?? 0) === 1 || raw.isMuted === true,
    draft: extra.draft || raw.draft || '',
    memberCount: raw.member_count || raw.memberCount || 0,
    raw
  };
}
