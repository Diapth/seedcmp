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

export function normalizeTimestamp(value, fallback = Date.now()) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    const parsed = Date.parse(String(value || '').replace(' ', 'T'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
  if (numeric <= 0) return fallback;
  return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
}

function normalizePayload(payload, fallbackType = 1) {
  if (payload === undefined || payload === null) return {};
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      return parsed && typeof parsed === 'object' ? parsed : { type: fallbackType, text: payload };
    } catch {
      return { type: fallbackType, text: payload };
    }
  }
  return payload && typeof payload === 'object' ? payload : { type: fallbackType, text: String(payload) };
}

function pickContentText(content) {
  if (typeof content === 'string') return content;
  if (!content || typeof content !== 'object') return '';
  return content.text || content.content || content.title || content.name || content.url || '';
}

function isDeploymentPayload(content = {}) {
  if (!content || typeof content !== 'object') return false;
  const cardType = String(content.cardType || content.card_type || content.kind || '').toLowerCase();
  return cardType === 'deployment' ||
    cardType === 'deploy' ||
    cardType === 'deployment_confirmation' ||
    Boolean(content.deploymentRequestId || content.deployment_request_id || content.deploymentRequest);
}

function normalizeMessageType(type) {
  if (typeof type === 'string') return type;
  const numeric = Number(type);
  if (numeric === 1) return 'text';
  if (numeric === 2) return 'image';
  if (numeric === 4) return 'voice';
  if (numeric === 7) return 'deployment';
  if (numeric === 8) return 'file';
  if (numeric === 99 || numeric === 1000) return 'system';
  return 'text';
}

function pickMessageType(content, raw = {}) {
  if (isDeploymentPayload(content)) return 'deployment';
  if (raw.type) return normalizeMessageType(raw.type);
  if (content?.type) return normalizeMessageType(content.type);
  if (raw.payload?.type) return normalizeMessageType(raw.payload.type);
  return 'text';
}

function normalizeDeployment(content = {}, raw = {}) {
  const request = content.deploymentRequest || content.deployment_request || {};
  const id = content.deploymentRequestId || content.deployment_request_id ||
    request.deploymentRequestId || request.deployment_request_id ||
    request.id || request.requestId || '';
  return {
    requestId: id,
    title: content.title || content.statusLabel || '部署请求',
    status: content.status || request.status || 'pending_confirmation',
    target: content.target || request.target || '',
    environment: content.environment || request.environment || '',
    previewUrl: content.previewUrl || content.preview_url || request.previewUrl || request.preview_url || '',
    downloadUrl: content.downloadUrl || content.download_url || request.downloadUrl || request.download_url || '',
    channelId: raw.channel_id || raw.channelId || content.channelId || content.channel_id || request.channelId || request.channel_id || '',
    channelType: Number(raw.channel_type || raw.channelType || content.channelType || content.channel_type || request.channelType || request.channel_type || 0),
    raw: content
  };
}

function isDigestSource(raw = {}) {
  if (!raw || raw.is_deleted === 1 || raw.is_revoked === 1 || raw.revoke === 1) return false;
  const content = normalizePayload(raw.payload ?? raw.content ?? raw.contentObj, raw.type || 1);
  const rawType = raw.type ?? content?.type ?? raw.content_type ?? raw.contentType;
  const numericType = Number(rawType);
  return !(numericType === 99 || numericType === 1000);
}

function pickConversationLastMessage(raw = {}) {
  const candidates = [
    raw.last_message,
    raw.lastMessage,
    raw.last_msg,
    raw.message,
    ...(Array.isArray(raw.recents) ? raw.recents : []),
    ...(Array.isArray(raw.messages) ? raw.messages : [])
  ].filter(Boolean);
  return candidates.find(isDigestSource) || candidates[0] || {};
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
  const content = normalizePayload(raw.content ?? raw.payload ?? raw.contentObj, raw.type || 1);
  const senderId = raw.from_uid || raw.fromUID || raw.senderId || raw.uid || '';
  const cachedUser = userCache[senderId] || {};
  const type = pickMessageType(content, raw);
  const deployment = type === 'deployment' ? normalizeDeployment(content, raw) : null;
  const text = deployment?.title || pickContentText(content);
  return {
    id: String(raw.message_id || raw.messageID || raw.id || raw.client_msg_no || raw.clientMsgNo || Date.now()),
    clientMsgNo: raw.client_msg_no || raw.clientMsgNo || '',
    messageSeq: Number(raw.message_seq || raw.messageSeq || 0),
    senderId,
    senderName: raw.from_name || raw.senderName || cachedUser.name || cachedUser.nickname || senderId || '未知用户',
    senderAvatar: raw.from_avatar || raw.senderAvatar || cachedUser.avatar || '',
    content: text,
    type,
    time: normalizeTimestamp(raw.timestamp || raw.time || Date.now()),
    status: raw.status || 'success',
    reactions: raw.reactions || [],
    replyRef: raw.replyRef || raw.remote_extra?.reply || null,
    mentions: raw.mentions || raw.remote_extra?.mentions || [],
    fileName: raw.fileName || raw.name || content.name || '',
    url: raw.url || content.url || '',
    channelId: raw.channel_id || raw.channelId || deployment?.channelId || '',
    channelType: Number(raw.channel_type || raw.channelType || deployment?.channelType || 0),
    deploymentRequestId: deployment?.requestId || '',
    deployment,
    raw
  };
}

export function buildConversationChannelCache(data = {}) {
  const cache = {};
  const users = Array.isArray(data.users) ? data.users : [];
  const groups = Array.isArray(data.groups) ? data.groups : [];

  users.forEach((user) => {
    const uid = user.uid || user.id || user.username;
    if (!uid) return;
    cache[channelKey(uid, 1)] = {
      name: user.remark || user.name || user.nickname || user.username || uid,
      avatar: user.avatar || user.logo || '',
      top: user.top || user.stick || 0,
      mute: user.mute || 0,
      raw: user
    };
  });

  groups.forEach((group) => {
    const groupNo = group.group_no || group.groupNo || group.channel_id || group.id;
    if (!groupNo) return;
    cache[channelKey(groupNo, 2)] = {
      name: group.name || group.group_name || group.groupName || groupNo,
      avatar: group.logo || group.avatar || '',
      top: group.top || group.stick || 0,
      mute: group.mute || 0,
      memberCount: group.member_count || group.memberCount || 0,
      raw: group
    };
  });

  return cache;
}

export function toGroupConversationInput(group = {}, latestMessages = []) {
  const groupId = group.id || group.group_no || group.groupNo || group.channel_id || '';
  const latestList = Array.isArray(latestMessages)
    ? [...latestMessages]
      .sort((a, b) => Number(a.message_seq || a.messageSeq || a.timestamp || 0) - Number(b.message_seq || b.messageSeq || b.timestamp || 0))
      .reverse()
    : [];
  const latest = latestList[0] || {};
  const fallbackTime = group.last_msg_time ||
    group.lastMsgTime ||
    group.updated_at_time ||
    group.updatedAtTime ||
    group.updated_at ||
    group.updatedAt ||
    group.created_at_time ||
    group.createdAtTime ||
    group.created_at ||
    group.createTime;

  return {
    channel_id: groupId,
    channel_type: 2,
    unread: Number(group.unread || 0),
    last_msg_seq: Number(latest.message_seq || latest.messageSeq || group.last_msg_seq || 0),
    last_msg_time: latest.timestamp || latest.time || fallbackTime,
    recents: latestList,
    top: group.top || group.stick || 0,
    mute: group.mute || 0,
    draft: group.draft || '',
    name: group.name || group.group_name || group.groupName || '未命名群聊',
    avatar: group.avatar || group.logo || '',
    member_count: group.memberCount || group.member_count || 0,
    raw: group
  };
}

export function toConversationItem(raw = {}, channelCache = {}) {
  const channelId = raw.channel_id || raw.channelId || raw.id || '';
  const channelType = Number(raw.channel_type || raw.channelType || toBackendChannelType(raw.type));
  const key = channelKey(channelId, channelType);
  const cached = channelCache[key] || {};
  const extra = raw.extra || raw.remote_extra || {};
  const channel = raw.channel || {};
  const lastMessage = pickConversationLastMessage(raw);
  const rawLastTime = raw.last_msg_time || raw.lastMsgTime || raw.timestamp || raw.last_time || raw.lastTime || lastMessage.timestamp || lastMessage.time;
  const rawTop = cached.top ?? extra.top ?? raw.top ?? raw.stick ?? raw.isPinned ?? 0;
  const rawMute = cached.mute ?? extra.mute ?? raw.mute ?? raw.isMuted ?? 0;
  return {
    id: String(channelId),
    channelId: String(channelId),
    channelType,
    key,
    name: raw.channel_name || raw.name || channel.channel_name || channel.name || cached.name || '未命名会话',
    avatar: raw.channel_logo || raw.avatar || channel.channel_logo || channel.logo || channel.avatar || cached.avatar || '',
    type: raw.type || toVisualConversationType(channelType),
    unread: Number(raw.unread || 0),
    lastMessage: typeof lastMessage === 'string' ? lastMessage : messageSummary(createInboundMessage(lastMessage)),
    lastTime: normalizeTimestamp(rawLastTime),
    lastMessageSeq: Number(raw.last_msg_seq || raw.lastMessageSeq || lastMessage.message_seq || lastMessage.messageSeq || 0),
    isPinned: Number(rawTop) === 1 || rawTop === true,
    isMuted: Number(rawMute) === 1 || rawMute === true,
    draft: extra.draft || raw.draft || '',
    memberCount: raw.member_count || raw.memberCount || cached.memberCount || 0,
    raw
  };
}
