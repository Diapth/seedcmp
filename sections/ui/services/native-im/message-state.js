function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const next = clean(value);
    if (next) return next;
  }
  return '';
}

function safeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function contentKey(message = {}) {
  if (message.type === 'text' || !message.type) {
    return clean(message.content).replace(/\s+/g, ' ');
  }
  return [
    message.type,
    clean(message.content),
    clean(message.fileName || message.name || message.url)
  ].join('|');
}

function messageDigest(message = {}) {
  if (message.type === 'image') return '[图片]';
  if (message.type === 'voice') return '[语音]';
  if (message.type === 'file') return `[文件] ${message.fileName || message.name || message.content || ''}`.trim();
  return clean(message.content) || '收到一条新消息';
}

export function collectSelfIds(currentUser = {}) {
  const raw = currentUser.raw || {};
  const ids = [
    'me',
    currentUser.id,
    currentUser.uid,
    currentUser.userId,
    currentUser.user_id,
    currentUser.username,
    currentUser.shortNo,
    currentUser.phone,
    raw.uid,
    raw.id,
    raw.user_id,
    raw.username,
    raw.short_no,
    raw.phone,
    raw.mobile
  ].map(clean).filter(Boolean);
  return new Set(ids);
}

export function isSelfSender(senderId, currentUser = {}) {
  const id = clean(senderId);
  if (!id) return false;
  return collectSelfIds(currentUser).has(id);
}

export function resolveSelfId(currentUser = {}) {
  return firstNonEmpty(currentUser.id, currentUser.uid, currentUser.raw?.uid, 'me');
}

export function resolveSelfName(currentUser = {}, fallback = '我') {
  return firstNonEmpty(currentUser.remark, currentUser.nickname, currentUser.name, currentUser.raw?.name, fallback);
}

export function resolveSelfAvatar(currentUser = {}) {
  return firstNonEmpty(currentUser.avatar, currentUser.logo, currentUser.raw?.avatar, currentUser.raw?.logo);
}

export function conversationSummaryForMessage(message = {}, currentUser = {}, conversation = {}) {
  const digest = messageDigest(message);
  if (isSelfSender(message.senderId || message.from_uid || message.fromUID, currentUser)) {
    return conversation?.type === 'group' ? `我: ${digest}` : digest;
  }
  if (conversation?.type === 'group') {
    const senderName = firstNonEmpty(message.senderName, message.sender_id, message.senderId);
    return senderName ? `${senderName}: ${digest}` : digest;
  }
  return digest;
}

export function createClientMsgNo(prefix = 'ui') {
  const random = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

export function messageIdentityKey(message = {}) {
  return firstNonEmpty(
    message.messageId,
    message.messageID,
    message.message_id,
    message.clientMsgNo,
    message.client_msg_no,
    message.id
  );
}

export function enrichNativeMessageSender(message = {}, conversation = {}, currentUser = {}) {
  const next = { ...message };
  if (isSelfSender(next.senderId || next.from_uid || next.fromUID, currentUser)) {
    next.senderId = resolveSelfId(currentUser);
    next.senderName = resolveSelfName(currentUser, next.senderName || '我');
    next.senderAvatar = resolveSelfAvatar(currentUser) || next.senderAvatar || next.avatar || '';
    return next;
  }

  if (conversation?.type === 'single') {
    next.senderName = firstNonEmpty(conversation.name, next.senderName, next.senderId, '用户');
    next.senderAvatar = firstNonEmpty(conversation.avatar, next.senderAvatar, next.avatar);
  } else {
    next.senderName = firstNonEmpty(next.senderName, next.senderId, conversation?.name, '用户');
    next.senderAvatar = firstNonEmpty(next.senderAvatar, next.avatar);
  }
  return next;
}

export function findSelfEchoIndex(messages = [], incoming = {}, currentUser = {}, options = {}) {
  const incomingSenderId = incoming.senderId || incoming.from_uid || incoming.fromUID;
  if (!isSelfSender(incomingSenderId, currentUser)) return -1;

  const incomingContent = contentKey(incoming);
  if (!incomingContent) return -1;

  const incomingTime = safeNumber(incoming.time, 0);
  const timeWindowMs = options.timeWindowMs || 15000;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (!isSelfSender(candidate.senderId || candidate.from_uid || candidate.fromUID, currentUser)) continue;
    if (contentKey(candidate) !== incomingContent) continue;
    const candidateTime = safeNumber(candidate.time, 0);
    if (incomingTime && candidateTime && Math.abs(incomingTime - candidateTime) > timeWindowMs) continue;
    return index;
  }
  return -1;
}

export function mergeNativeMessageIntoList(messages = [], incoming = {}, options = {}) {
  const currentUser = options.currentUser || {};
  const conversation = options.conversation || {};
  const enrichedIncoming = enrichNativeMessageSender(incoming, conversation, currentUser);
  const key = messageIdentityKey(enrichedIncoming);
  const next = [...messages];

  if (key) {
    const keyIndex = next.findIndex((message) => messageIdentityKey(message) === key);
    if (keyIndex >= 0) {
      next[keyIndex] = {
        ...next[keyIndex],
        ...enrichedIncoming,
        status: enrichedIncoming.status || next[keyIndex].status || 'success'
      };
      return sortMessages(next);
    }
  }

  const echoIndex = findSelfEchoIndex(next, enrichedIncoming, currentUser, options);
  if (echoIndex >= 0) {
    next[echoIndex] = {
      ...next[echoIndex],
      ...enrichedIncoming,
      id: firstNonEmpty(enrichedIncoming.id, next[echoIndex].id),
      status: enrichedIncoming.status || 'success'
    };
    return sortMessages(next);
  }

  next.push(enrichedIncoming);
  return sortMessages(next);
}

export function mergeNativeMessageLists(current = [], incoming = [], options = {}) {
  return incoming.reduce((list, message) => mergeNativeMessageIntoList(list, message, options), [...current]);
}

export function sortMessages(messages = []) {
  return [...messages].sort((a, b) => safeNumber(a.time, 0) - safeNumber(b.time, 0));
}
