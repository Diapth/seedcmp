export function conversationKey(channelId, channelType) {
  return `${String(channelId || '')}-${Number(channelType || 0)}`;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return value;
  }
  return '';
}

function toNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeStatus(input = {}) {
  if (input.revoked || input.is_deleted) return 'revoked';
  const value = input.status ?? input.messageStatus;
  if (value === 0 || value === '0' || value === 'wait' || value === 'waiting') return 'sending';
  if (value === 1 || value === '1' || value === 'normal' || value === 'sent') return 'success';
  if (value === 2 || value === '2' || value === 'fail' || value === 'failed') return 'failed';
  if (typeof value === 'string' && value.trim()) return value;
  return 'success';
}

function toTimestampMs(value, fallbackMs = 0) {
  if (value === undefined || value === null || value === '') return fallbackMs;
  const next = toNumber(value, 0);
  if (!next) return fallbackMs;
  return next > 100000000000 ? next : next * 1000;
}

function parsePayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'object') return payload;
  if (typeof payload !== 'string') return {};

  try {
    return JSON.parse(payload);
  } catch {
    try {
      let decoded = '';
      if (typeof globalThis.atob === 'function') {
        decoded = decodeURIComponent(escape(globalThis.atob(payload)));
      } else if (globalThis.Buffer) {
        decoded = globalThis.Buffer.from(payload, 'base64').toString('utf8');
      }
      if (decoded) return JSON.parse(decoded);
    } catch {
      return { type: 1, content: payload, text: payload };
    }
    return { type: 1, content: payload, text: payload };
  }
}

export function normalizeContent(payload) {
  const content = parsePayload(payload?.payload || payload?.content || payload);
  const type = toNumber(content.type || content.contentType || payload?.content_type || payload?.contentType || 1, 1);
  const text = firstNonEmpty(content.content, content.text, content.title, payload?.content, payload?.text);
  const name = firstNonEmpty(content.name, content.fileName, payload?.name, payload?.file_name);

  if (type === 2) {
    return { type: 'image', content: '[图片]', url: content.url || content.remoteUrl || '' };
  }
  if (type === 4) {
    return { type: 'voice', content: '[语音]', url: content.url || '', duration: toNumber(content.time || content.duration, 0) };
  }
  if (type === 8) {
    return {
      type: 'file',
      content: `[文件] ${name || text || ''}`.trim(),
      name: name || text || '文件',
      fileName: name || text || '文件',
      size: content.size || payload?.size || 0,
      url: content.url || payload?.url || ''
    };
  }
  if (type === 99 || type === 1000) {
    return { type: 'system', content: text || '[系统消息]' };
  }

  return { type: 'text', content: text || '' };
}

export function normalizeMessage(input = {}, options = {}) {
  const payload = input.payload ?? input.content ?? input.contentObj ?? {};
  const normalizedContent = normalizeContent({ ...input, payload });
  const id = firstNonEmpty(input.message_id, input.messageID, input.id, input.client_msg_no, input.clientMsgNo);
  const senderId = firstNonEmpty(input.from_uid, input.fromUID, input.senderId, options.currentUid);
  const senderName = firstNonEmpty(input.from_name, input.senderName, input.sender_name, senderId);
  const raw = parsePayload(payload);
  const mention = raw.mention || input.mention || {};
  const mentions = Array.isArray(mention.uids) ? mention.uids.map(String) : [];

  return {
    id: String(id || `local-${Date.now()}`),
    messageId: String(firstNonEmpty(input.message_id, input.messageID, input.id)),
    messageSeq: toNumber(input.message_seq ?? input.messageSeq, 0),
    clientMsgNo: String(firstNonEmpty(input.client_msg_no, input.clientMsgNo)),
    clientSeq: toNumber(input.client_seq ?? input.clientSeq, 0),
    senderId: String(senderId || ''),
    senderName: String(senderName || ''),
    senderAvatar: input.senderAvatar || input.from_avatar || '',
    time: toTimestampMs(input.timestamp ?? input.time ?? input.created_at, Date.now()),
    status: normalizeStatus(input),
    reactions: input.reactions || [],
    replyRef: input.replyRef || raw.reply || null,
    mentions,
    raw,
    ...normalizedContent
  };
}

export function messageDigestFromInput(input = {}) {
  const recent = Array.isArray(input.recents) ? input.recents[0] : null;
  const payload = input.last_message?.payload
    ?? input.last_message?.content
    ?? recent?.payload
    ?? recent?.content
    ?? input.payload
    ?? input.content
    ?? input.lastMessage;
  const content = normalizeContent(payload || input.last_message || recent || {});
  return content.content || '收到一条新消息';
}

function recentMessageFromInput(input = {}) {
  return Array.isArray(input.recents) ? input.recents[0] : null;
}

function lastMessageTimeFromInput(input = {}) {
  const recent = recentMessageFromInput(input);
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

export function normalizeConversation(input = {}, channelInfo = {}) {
  const channelId = String(firstNonEmpty(input.channel_id, input.channelId, input.id, channelInfo.channel_id, channelInfo.channelID));
  const channelType = toNumber(input.channel_type ?? input.channelType ?? channelInfo.channel_type ?? channelInfo.channelType, 1);
  const isGroup = channelType === 2;
  const category = firstNonEmpty(channelInfo.category, channelInfo.orgData?.category, input.category);
  const isRobot = Number(channelInfo.robot || channelInfo.orgData?.robot || 0) === 1 || category === 'robot';
  const name = firstNonEmpty(channelInfo.remark, channelInfo.orgData?.remark, input.remark, channelInfo.name, channelInfo.title, input.name, channelId);
  const logo = firstNonEmpty(channelInfo.logo, channelInfo.avatar, input.avatar);
  const lastTime = toTimestampMs(lastMessageTimeFromInput(input), 0);

  return {
    id: channelId,
    key: conversationKey(channelId, channelType),
    channelId,
    channelType,
    type: isGroup ? 'group' : (isRobot ? 'robot' : 'single'),
    name,
    avatar: logo || '',
    unread: toNumber(input.unread, 0),
    lastSeq: toNumber(input.last_msg_seq ?? input.lastMsgSeq, 0),
    lastMessage: messageDigestFromInput(input),
    lastTime,
    isPinned: Number(input.top ?? input.stick ?? channelInfo.top ?? channelInfo.stick ?? 0) === 1,
    isMuted: Number(input.mute ?? channelInfo.mute ?? 0) === 1,
    draft: String(firstNonEmpty(input.draft, input.extra?.draft, input.remoteExtra?.draft)),
    raw: input,
    channelInfo
  };
}

export function normalizeFriend(input = {}) {
  const id = String(firstNonEmpty(input.uid, input.id, input.user_id));
  const nickname = String(firstNonEmpty(input.name, input.nickname, id));
  return {
    id,
    uid: id,
    nickname,
    name: nickname,
    avatar: input.avatar || input.logo || '',
    pinyin: input.pinyin || nickname,
    phone: input.phone || input.mobile || '',
    remark: input.remark || '',
    status: Number(input.online || 0) === 1 ? 'online' : (input.status || 'offline'),
    version: input.version || 0,
    vercode: input.vercode || '',
    raw: input
  };
}

export function normalizeFriendRequest(input = {}) {
  const id = String(firstNonEmpty(input.id, input.uid, input.apply_uid, input.to_uid, input.token));
  return {
    id,
    uid: String(firstNonEmpty(input.uid, input.apply_uid, input.to_uid)),
    nickname: String(firstNonEmpty(input.to_name, input.apply_name, input.name, input.nickname, '未知用户')),
    avatar: input.avatar || '',
    message: input.remark || input.message || '申请添加你为好友',
    token: input.token || '',
    time: toNumber(input.created_at ?? input.createdAt ?? input.time, Date.now()),
    status: input.status === undefined ? 'pending' : (Number(input.status) === 1 ? 'accepted' : input.status),
    raw: input
  };
}

export function normalizeFriendSearchResult(response = {}, context = {}) {
  const data = response.data || response.user || response;
  if (!response || response.exist === 0 || !data) {
    return null;
  }
  const friend = normalizeFriend(data);
  if (friend.id === String(context.currentUid || '')) {
    return { ...friend, relationship: 'self' };
  }
  if ((context.contacts || []).some((item) => String(item.id || item.uid) === friend.id)) {
    return { ...friend, relationship: 'friend' };
  }
  if ((context.blacklist || []).some((item) => String(item.id || item.uid) === friend.id)) {
    return { ...friend, relationship: 'blacklist' };
  }
  if (Number(data.be_blacklist || data.beBlacklist || 0) === 1) {
    return { ...friend, relationship: 'blacklist' };
  }
  return { ...friend, relationship: 'stranger' };
}
