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

function safeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function normalizeManualContextPin(pin = {}) {
  const messageId = firstNonEmpty(pin.messageId, pin.message_id);
  return {
    id: firstNonEmpty(pin.id, pin.pinId, pin.pin_id, messageId),
    threadId: firstNonEmpty(pin.threadId, pin.thread_id),
    channelId: firstNonEmpty(pin.channelId, pin.channel_id),
    channelType: safeNumber(pin.channelType ?? pin.channel_type, 0),
    messageId,
    messageSeq: safeNumber(pin.messageSeq ?? pin.message_seq, 0),
    clientMsgNo: firstNonEmpty(pin.clientMsgNo, pin.client_msg_no),
    contentExcerpt: firstNonEmpty(pin.contentExcerpt, pin.content_excerpt),
    senderName: firstNonEmpty(pin.senderName, pin.sender_name),
    pinnedBy: firstNonEmpty(pin.pinnedBy, pin.pinned_by, pin.userId, pin.user_id),
    status: firstNonEmpty(pin.status, 'active'),
    raw: pin
  };
}

export function normalizeManualContextPinsResponse(resp = {}) {
  return firstArray(resp.pins, resp.data?.pins, resp.items, resp.data?.items, resp.data)
    .map(normalizeManualContextPin)
    .filter((pin) => pin.id && pin.messageId);
}

export function resolveConversationThreadId(conversation = {}) {
  const binding = conversation.binding || conversation.raw?.binding || {};
  return firstNonEmpty(
    conversation.threadId,
    conversation.thread_id,
    conversation.directThreadId,
    conversation.direct_thread_id,
    conversation.projectThreadId,
    conversation.project_thread_id,
    conversation.clowderThreadId,
    conversation.clowder_thread_id,
    binding.threadId,
    binding.thread_id,
    binding.projectThreadId,
    binding.project_thread_id,
    conversation.raw?.threadId,
    conversation.raw?.thread_id,
    conversation.raw?.projectThreadId,
    conversation.raw?.project_thread_id
  );
}

function messageIdentityValues(message = {}) {
  return [
    message.messageId,
    message.message_id,
    message.id,
    message.clientMsgNo,
    message.client_msg_no
  ].map(firstNonEmpty).filter(Boolean);
}

function stripMarkdown(value = '') {
  return clean(value)
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim())
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|\s)#{1,6}\s*/g, '$1')
    .replace(/(^|\s)>\s*/g, '$1')
    .replace(/(^|\s)([-*+]|\d+\.)\s+/g, '$1')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function manualContextExcerptForMessage(message = {}, maxLength = 240) {
  let text = '';
  if (message.type === 'file') {
    text = `[文件] ${firstNonEmpty(message.fileName, message.name, message.content, '未命名文件')}`;
  } else if (message.type === 'image') {
    text = '[图片]';
  } else if (message.type === 'voice') {
    text = '[语音]';
  } else {
    text = stripMarkdown(firstNonEmpty(message.content, message.text, message.markdown));
  }
  const normalized = clean(text);
  if (!normalized || normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

export function buildManualContextPinPayload(message = {}, conversation = {}, options = {}) {
  const messageId = firstNonEmpty(message.messageId, message.message_id, message.id, message.clientMsgNo, message.client_msg_no);
  const contentExcerpt = manualContextExcerptForMessage(message, options.maxExcerptLength || 240);
  if (!messageId || !contentExcerpt) return null;
  const payload = {
    channelId: firstNonEmpty(message.channelId, message.channel_id, conversation.channelId, conversation.channel_id, conversation.id),
    channelType: safeNumber(message.channelType ?? message.channel_type ?? conversation.channelType ?? conversation.channel_type, conversation.type === 'group' ? 2 : 1),
    messageId,
    contentExcerpt
  };
  const clientMsgNo = firstNonEmpty(message.clientMsgNo, message.client_msg_no);
  if (clientMsgNo) payload.clientMsgNo = clientMsgNo;
  const messageSeq = safeNumber(message.messageSeq ?? message.message_seq, 0);
  if (messageSeq > 0) payload.messageSeq = messageSeq;
  const senderName = firstNonEmpty(message.senderName, message.sender_name, message.fromName, message.from_name);
  if (senderName) payload.senderName = senderName;
  return payload;
}

function isActivePin(pin = {}) {
  return firstNonEmpty(pin.status, 'active') === 'active';
}

function messageMatchesPin(message = {}, pin = {}) {
  const pinMessageId = firstNonEmpty(pin.messageId, pin.message_id);
  if (!pinMessageId) return false;
  return messageIdentityValues(message).includes(pinMessageId);
}

export function applyManualContextPinsToMessages(messages = [], pins = []) {
  const activePins = (pins || []).map(normalizeManualContextPin).filter(isActivePin);
  return (messages || []).map((message) => {
    const pin = activePins.find((item) => messageMatchesPin(message, item));
    return {
      ...message,
      manualContextPinned: Boolean(pin),
      manualContextPinId: pin?.id || ''
    };
  });
}

export function compactManualContextPinPayload(payload = {}) {
  const next = {};
  [
    'channelId',
    'channelType',
    'messageId',
    'messageSeq',
    'clientMsgNo',
    'contentExcerpt',
    'senderName',
    'status'
  ].forEach((key) => {
    const value = payload[key];
    if (value === undefined || value === null || value === '') return;
    next[key] = value;
  });
  return next;
}
