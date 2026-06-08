import {
  CLOWDER_CAT_CONTACT_PREFIX,
  getClowderCatIdFromContactId
} from './agent-state.js';

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

export function toConversationPreview(value, maxLength = 80) {
  const source = clean(value);
  if (!source) return '';
  const text = source
    .replace(/```[\s\S]*?```/g, (block) => {
      const inner = block.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim();
      return inner || '[代码]';
    })
    .split(/\r?\n/)
    .filter((line) => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line))
    .join(' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, alt) => clean(alt) || '[图片]')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|\s)#{1,6}\s*/g, '$1')
    .replace(/(^|\s)>\s*/g, '$1')
    .replace(/(^|\s)([-*+]|\d+\.)\s+/g, '$1')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
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
  if (!isVisibleChatMessage(message)) return '';
  if (message.type === 'system') return clean(message.content);
  if (message.type === 'image') return '[图片]';
  if (message.type === 'voice') return '[语音]';
  if (message.type === 'file') return toConversationPreview(`[文件] ${message.fileName || message.name || message.content || ''}`);
  return toConversationPreview(message.content) || '收到一条新消息';
}

export function isVisibleChatMessage(message = {}) {
  if (!message) return false;
  if (message.hidden || message.isSilentSystem) return false;
  if (message.type === 'system' && !clean(message.content)) return false;
  return true;
}

function normalizeTimestampMs(value, fallback = Date.now()) {
  const next = safeNumber(value, fallback);
  return next > 100000000000 ? next : next * 1000;
}

function normalizeStreamPhase(event = {}) {
  const raw = clean(event.phase || event.stage || event.event || event.status || event.type).toLowerCase();
  if (['thinking', 'placeholder', 'start', 'created'].includes(raw)) return 'placeholder';
  if (['chunk', 'delta', 'streaming'].includes(raw)) return 'chunk';
  if (['final', 'done', 'completed', 'complete'].includes(raw)) return 'final';
  return event.delta ? 'chunk' : 'final';
}

function normalizeAgentFile(file = {}, streamKey = '', index = 0) {
  const name = firstNonEmpty(file.fileName, file.name, file.title, `智能体文件-${index + 1}`);
  const url = firstNonEmpty(file.url, file.sourceUrl, file.contentUrl, file.path);
  return {
    id: firstNonEmpty(file.id, file.fileId, `${streamKey}-file-${index}`),
    type: 'file',
    content: name,
    name,
    fileName: name,
    fileSize: file.fileSize || file.size || '',
    fileSizeBytes: safeNumber(file.fileSizeBytes ?? file.bytes, 0),
    fileType: firstNonEmpty(file.fileType, file.ext, name.split('.').pop()),
    mimeType: firstNonEmpty(file.mimeType, file.type),
    url,
    sourceUrl: firstNonEmpty(file.sourceUrl, url),
    contentUrl: firstNonEmpty(file.contentUrl, url),
    previewContent: firstNonEmpty(file.previewContent, file.contentText, file.markdown, file.text),
    generatedByAgent: true,
    source: 'clowder',
    raw: file
  };
}

export function isClowderConversation(conversation = {}) {
  const id = clean(conversation.id || conversation.channelId || conversation.agentId).toLowerCase();
  const name = clean(conversation.name || conversation.title || conversation.displayName).toLowerCase();
  return isClowderDirectCatConversation(conversation)
    || id.includes('clowder')
    || name.includes('clowder')
    || name.includes('协同猫');
}

export function resolveClowderDirectCatId(conversation = {}) {
  const explicit = firstNonEmpty(
    conversation.directCatId,
    conversation.direct_cat_id,
    conversation.catId,
    conversation.cat_id,
    conversation.agentId,
    conversation.agent_id
  );
  if (explicit && !explicit.startsWith(CLOWDER_CAT_CONTACT_PREFIX)) return explicit;
  return getClowderCatIdFromContactId(explicit)
    || getClowderCatIdFromContactId(conversation.channelId)
    || getClowderCatIdFromContactId(conversation.id);
}

export function isClowderDirectCatConversation(conversation = {}) {
  const id = firstNonEmpty(conversation.channelId, conversation.id);
  return Boolean(
    getClowderCatIdFromContactId(id)
    || conversation.directCatId
    || conversation.direct_cat_id
    || (conversation.source === 'clowder' && conversation.type === 'robot')
  );
}

export function shouldStartLocalClowderStream(conversation = {}) {
  return isClowderConversation(conversation)
    && !isClowderDirectCatConversation(conversation);
}

function splitStreamContent(content = '', chunkSize = 36) {
  const size = Math.max(8, Number(chunkSize) || 36);
  const chunks = [];
  for (let index = 0; index < content.length; index += size) {
    chunks.push(content.slice(index, index + size));
  }
  return chunks;
}

function clowderMarkdownReplyContent(prompt = '') {
  const topic = toConversationPreview(prompt, 48) || '当前请求';
  return [
    `## Clowder AI 流式回复`,
    '',
    `我已收到：**${topic}**`,
    '',
    '| 项目 | 说明 |',
    '| --- | --- |',
    '| 状态 | 已进入多智能体协作整理流程 |',
    '| 输出 | 以 Markdown 表格、代码块和链接样式流式返回 |',
    '| 下一步 | 可继续补充约束，我会把结论同步到会话摘要 |',
    '',
    '```markdown',
    '- placeholder: 正在思考',
    '- chunk: 分段追加 Markdown 内容',
    '- final: 合并为一条最终回复',
    '```',
    '',
    '[查看协作说明](https://agenthub.local/clowder)'
  ].join('\n');
}

export function createClowderMarkdownStreamEvents(prompt = '', options = {}) {
  const streamKey = firstNonEmpty(options.streamKey, createClientMsgNo('clowder_stream'));
  const content = firstNonEmpty(options.content, clowderMarkdownReplyContent(prompt));
  const chunks = splitStreamContent(content, options.chunkSize);
  const base = {
    streamKey,
    targetMessageId: firstNonEmpty(options.targetMessageId, options.target_message_id),
    emoji: firstNonEmpty(options.emoji, options.reaction, '👀'),
    senderId: 'clowder',
    senderName: 'Clowder AI',
    time: options.time || Date.now()
  };
  return [
    { ...base, phase: 'placeholder', content: '' },
    ...chunks.map((delta, index) => ({
      ...base,
      phase: 'chunk',
      delta,
      time: base.time + index + 1
    })),
    { ...base, phase: 'final', content, time: base.time + chunks.length + 1 }
  ];
}

export function normalizeAgentReplyEvent(event = {}) {
  const streamKey = firstNonEmpty(
    event.streamKey,
    event.stream_key,
    event.streamId,
    event.stream_id,
    event.clientMsgNo,
    event.client_msg_no,
    event.messageId,
    event.message_id,
    event.id
  );
  const phase = normalizeStreamPhase(event);
  const content = firstNonEmpty(event.content, event.text, event.markdown, event.message);
  const delta = firstNonEmpty(event.delta, event.contentDelta, event.content_delta, phase === 'chunk' ? content : '');
  const files = firstArray(event.files, event.attachments, event.generatedFiles, event.generated_files)
    .map((file, index) => normalizeAgentFile(file, streamKey, index));

  return {
    streamKey,
    phase,
    content,
    delta,
    files,
    targetMessageId: firstNonEmpty(
      event.targetMessageId,
      event.target_message_id,
      event.promptMessageId,
      event.prompt_message_id,
      event.inReplyTo,
      event.in_reply_to
    ),
    emoji: firstNonEmpty(event.emoji, event.reaction, event.ackEmoji, event.ack_emoji, '👀'),
    senderId: firstNonEmpty(event.senderId, event.sender_id, event.agentId, event.agent_id, 'clowder'),
    senderName: firstNonEmpty(event.senderName, event.sender_name, event.agentName, event.agent_name, 'Clowder AI'),
    senderAvatar: firstNonEmpty(event.senderAvatar, event.sender_avatar),
    time: normalizeTimestampMs(event.time ?? event.timestamp ?? event.createdAt ?? event.created_at),
    raw: event
  };
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function mergeAgentReplyEventIntoList(messages = [], event = {}) {
  const normalized = normalizeAgentReplyEvent(event);
  if (!normalized.streamKey) return [...messages];

  const next = [...messages];
  if (normalized.phase === 'placeholder') {
    if (normalized.targetMessageId) {
      return applyReactionEventIntoList(next, {
        targetMessageId: normalized.targetMessageId,
        emoji: normalized.emoji,
        userId: normalized.senderId
      });
    }
    return next;
  }

  const index = next.findIndex((message) => {
    const key = firstNonEmpty(message.streamKey, message.clientMsgNo, message.messageId, message.id);
    return key === normalized.streamKey;
  });
  const existing = index >= 0 ? next[index] : null;
  const isFinal = normalized.phase === 'final';
  const existingContent = existing?.content === '正在思考...' ? '' : (existing?.content || '');
  const content = isFinal
    ? (normalized.content || existing?.content || normalized.delta)
    : normalized.phase === 'chunk'
      ? `${existingContent}${normalized.delta || normalized.content}`
      : (normalized.content || existing?.content || '正在思考...');

  const merged = {
    reactions: [],
    replyRef: null,
    mentions: [],
    ...(existing || {}),
    id: normalized.streamKey,
    clientMsgNo: normalized.streamKey,
    streamKey: normalized.streamKey,
    senderId: normalized.senderId,
    senderName: normalized.senderName,
    senderAvatar: normalized.senderAvatar,
    type: 'text',
    content,
    time: existing?.time || normalized.time,
    status: isFinal ? 'success' : 'sending',
    streaming: !isFinal,
    renderMode: 'markdown',
    source: 'clowder',
    raw: normalized.raw
  };

  if (index >= 0) {
    next[index] = merged;
  } else {
    next.push(merged);
  }

  if (isFinal && normalized.files.length) {
    normalized.files.forEach((file, fileIndex) => {
      const id = file.id || `${normalized.streamKey}-file-${fileIndex}`;
      const fileMessage = {
        reactions: [],
        replyRef: null,
        mentions: [],
        ...file,
        id,
        senderId: normalized.senderId,
        senderName: normalized.senderName,
        senderAvatar: normalized.senderAvatar,
        status: 'success',
        time: normalized.time + fileIndex + 1
      };
      const existingFileIndex = next.findIndex((message) => message.id === id);
      if (existingFileIndex >= 0) {
        next[existingFileIndex] = { ...next[existingFileIndex], ...fileMessage };
      } else {
        next.push(fileMessage);
      }
    });
  }

  return sortMessages(next);
}

export function collectSelfIds(currentUser = {}) {
  currentUser = currentUser || {};
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
  currentUser = currentUser || {};
  const id = clean(senderId);
  if (!id) return false;
  return collectSelfIds(currentUser).has(id);
}

export function resolveSelfId(currentUser = {}) {
  currentUser = currentUser || {};
  return firstNonEmpty(
    currentUser.id,
    currentUser.uid,
    currentUser.userId,
    currentUser.user_id,
    currentUser.raw?.uid,
    currentUser.raw?.id,
    currentUser.raw?.user_id,
    'me'
  );
}

export function resolveSelfName(currentUser = {}, fallback = '我') {
  currentUser = currentUser || {};
  return firstNonEmpty(currentUser.remark, currentUser.nickname, currentUser.name, currentUser.raw?.name, fallback);
}

export function resolveSelfAvatar(currentUser = {}) {
  currentUser = currentUser || {};
  return firstNonEmpty(currentUser.avatar, currentUser.logo, currentUser.raw?.avatar, currentUser.raw?.logo);
}

function storageGet(storage, key) {
  if (!storage || !key) return '';
  try {
    if (typeof storage.getStorageSync === 'function') return storage.getStorageSync(key) || '';
    if (typeof storage.getItem === 'function') return storage.getItem(key) || '';
  } catch {
    return '';
  }
  return '';
}

function storageSet(storage, key, value) {
  if (!storage || !key) return;
  try {
    if (typeof storage.setStorageSync === 'function') {
      storage.setStorageSync(key, value);
      return;
    }
    if (typeof storage.setItem === 'function') storage.setItem(key, value);
  } catch {
    // A failed prompt cache write must not interrupt message sending.
  }
}

function promptContextStorageKey(conversationId, currentUser = {}) {
  return `clowder_prompt_context:${clean(resolveSelfId(currentUser))}:${clean(conversationId)}`;
}

function normalizePromptContextMessage(message = {}, currentUser = {}) {
  if (!message || !isVisibleChatMessage(message)) return null;
  if (!isSelfSender(message.senderId || message.from_uid || message.fromUID, currentUser)) return null;
  const content = clean(message.content);
  if (!content || (message.type && message.type !== 'text')) return null;
  const id = firstNonEmpty(message.id, message.messageId, message.clientMsgNo);
  if (!id) return null;
  return {
    id,
    messageId: firstNonEmpty(message.messageId, message.id),
    clientMsgNo: firstNonEmpty(message.clientMsgNo, message.id),
    senderId: resolveSelfId(currentUser),
    senderName: firstNonEmpty(message.senderName, resolveSelfName(currentUser)),
    senderAvatar: firstNonEmpty(message.senderAvatar, resolveSelfAvatar(currentUser)),
    content,
    type: 'text',
    status: 'success',
    source: 'clowder',
    time: safeNumber(message.time, Date.now()),
    reactions: Array.isArray(message.reactions) ? message.reactions : [],
    replyRef: message.replyRef || null,
    mentions: Array.isArray(message.mentions) ? message.mentions : []
  };
}

export function readClowderPromptContext(storage, conversationId, currentUser = {}) {
  const key = promptContextStorageKey(conversationId, currentUser);
  const raw = storageGet(storage, key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return firstArray(parsed)
      .map((message) => normalizePromptContextMessage(message, currentUser))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function rememberClowderPromptContext(storage, conversationId, message = {}, currentUser = {}, options = {}) {
  const normalized = normalizePromptContextMessage(message, currentUser);
  if (!normalized) return readClowderPromptContext(storage, conversationId, currentUser);

  const limit = Math.max(1, safeNumber(options.limit, 20));
  const existing = readClowderPromptContext(storage, conversationId, currentUser);
  const key = messageIdentityKey(normalized);
  const next = [
    ...existing.filter((item) => messageIdentityKey(item) !== key),
    normalized
  ].slice(-limit);

  storageSet(storage, promptContextStorageKey(conversationId, currentUser), JSON.stringify(next));
  return next;
}

export function resolveOutboundSender(currentUser = {}, sender = {}) {
  currentUser = currentUser || {};
  sender = sender || {};
  const explicitId = firstNonEmpty(sender.id, sender.uid, sender.userId, sender.user_id);
  const explicitName = firstNonEmpty(sender.name === '我' ? '' : sender.name, sender.nickname);
  const explicitAvatar = firstNonEmpty(sender.avatar, sender.logo);

  return {
    id: explicitId && explicitId !== 'me' ? explicitId : resolveSelfId(currentUser),
    name: explicitName || resolveSelfName(currentUser),
    avatar: explicitAvatar || resolveSelfAvatar(currentUser)
  };
}

export function conversationSummaryForMessage(message = {}, currentUser = {}, conversation = {}) {
  const digest = messageDigest(message);
  if (!digest) return '';
  if (isSelfSender(message.senderId || message.from_uid || message.fromUID, currentUser)) {
    return conversation?.type === 'group' ? `我: ${digest}` : digest;
  }
  if (conversation?.type === 'group') {
    const senderName = firstNonEmpty(message.senderName, message.sender_id, message.senderId);
    return senderName ? `${senderName}: ${digest}` : digest;
  }
  return digest;
}

export function shouldKeepLocalSendSuccess(error = {}, conversation = {}) {
  const text = firstNonEmpty(error.msg, error.message, error.error?.msg, error.error?.message);
  if (error.sdkUnavailable) return true;
  if (/wukongimjssdk|WKSDK\.shared|chatManager|send unavailable|不可用|未安装/i.test(text)) return true;
  return conversation?.source === 'mock'
    && /network|runtime|request|fetch|uni\.|未获取到上传地址|文件上传失败|upload url is empty|no supported upload runtime/i.test(text);
}

export function resolveLocalSendStatus(sent = {}, conversation = {}) {
  const status = clean(sent.status) || 'success';
  if (status === 'failed' || status === 'revoked') return status;
  if (conversation?.source === 'mock' && status === 'sending') return 'success';
  return status;
}

export function shouldUseLocalMockMediaSuccess(conversation = {}, payload = {}) {
  return conversation?.source === 'mock'
    && payload?.type
    && payload.type !== 'text';
}

export function createClientMsgNo(prefix = 'ui') {
  const random = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

export function messageIdentityKey(message = {}) {
  return firstNonEmpty(
    message.streamKey,
    message.messageId,
    message.messageID,
    message.message_id,
    message.clientMsgNo,
    message.client_msg_no,
    message.id
  );
}

function normalizeReactionEvent(event = {}) {
  const targetMessageId = firstNonEmpty(
    event.targetMessageId,
    event.target_message_id,
    event.messageId,
    event.message_id,
    event.platformMessageId,
    event.platform_message_id
  );
  const emoji = firstNonEmpty(event.emoji, event.reaction, event.emojiType, event.emoji_type, '❤️');
  const userId = firstNonEmpty(event.userId, event.user_id, event.uid, 'clowder');
  return { targetMessageId, emoji, userId };
}

export function applyReactionEventIntoList(messages = [], event = {}) {
  const normalized = normalizeReactionEvent(event);
  if (!normalized.targetMessageId || !normalized.emoji || !normalized.userId) return [...messages];
  return messages.map((message) => {
    const keys = new Set([
      message.id,
      message.messageId,
      message.messageID,
      message.message_id,
      message.clientMsgNo,
      message.client_msg_no
    ].map(clean).filter(Boolean));
    if (!keys.has(normalized.targetMessageId)) return message;

    const reactions = Array.isArray(message.reactions)
      ? message.reactions.map((reaction) => ({
          ...reaction,
          userIds: Array.isArray(reaction.userIds) ? [...reaction.userIds] : []
        }))
      : [];
    const existing = reactions.find((reaction) => reaction.emoji === normalized.emoji);
    if (existing) {
      if (!existing.userIds.some((uid) => clean(uid) === normalized.userId)) {
        existing.userIds.push(normalized.userId);
      }
      existing.count = existing.userIds.length;
    } else {
      reactions.push({ emoji: normalized.emoji, userIds: [normalized.userId], count: 1 });
    }
    return { ...message, reactions };
  });
}

function findLatestSelfPromptIndex(messages = [], incoming = {}, options = {}) {
  const currentUser = options.currentUser || {};
  const incomingTime = safeNumber(incoming.time, 0);
  const timeWindowMs = options.ackTimeWindowMs || 10 * 60 * 1000;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (!isVisibleChatMessage(candidate)) continue;
    if (!isSelfSender(candidate.senderId || candidate.from_uid || candidate.fromUID, currentUser)) continue;
    if (candidate.type && candidate.type !== 'text') continue;
    if (!contentKey(candidate)) continue;
    const candidateTime = safeNumber(candidate.time, 0);
    if (incomingTime && candidateTime && candidateTime - incomingTime > timeWindowMs) continue;
    if (incomingTime && candidateTime && incomingTime - candidateTime > timeWindowMs) continue;
    return index;
  }
  return -1;
}

function applyReactionToLatestSelfPrompt(messages = [], incoming = {}, options = {}) {
  const index = findLatestSelfPromptIndex(messages, incoming, options);
  if (index < 0) return [...messages];
  return applyReactionEventIntoList(messages, {
    targetMessageId: messageIdentityKey(messages[index]),
    emoji: firstNonEmpty(incoming.emoji, incoming.reaction, incoming.ackEmoji, incoming.ack_emoji, '👀'),
    userId: firstNonEmpty(incoming.senderId, incoming.sender_id, incoming.agentId, incoming.agent_id, 'clowder')
  });
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

function findLocalEchoAckIndex(messages = [], incoming = {}, currentUser = {}, options = {}) {
  if (!incoming.localEcho || clean(incoming.status) !== 'success') return -1;

  const incomingContent = contentKey(incoming);
  if (!incomingContent) return -1;

  const incomingTime = safeNumber(incoming.time, 0);
  const timeWindowMs = options.timeWindowMs || 15000;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (clean(candidate.status) !== 'sending') continue;
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
  if (enrichedIncoming.reactionEvent) {
    return applyReactionEventIntoList(messages, enrichedIncoming.reactionEvent);
  }
  if (enrichedIncoming.streamKey) {
    const phase = clean(
      enrichedIncoming.streamPhase
      || (enrichedIncoming.streaming === false || clean(enrichedIncoming.status) === 'success' ? 'final' : 'chunk')
    ).toLowerCase();
    if (phase === 'cleanup') {
      return [...messages];
    }
    if (phase === 'placeholder') {
      if (enrichedIncoming.targetMessageId) {
        return applyReactionEventIntoList(messages, {
          targetMessageId: enrichedIncoming.targetMessageId,
          emoji: firstNonEmpty(enrichedIncoming.emoji, enrichedIncoming.reaction, '👀'),
          userId: firstNonEmpty(enrichedIncoming.senderId, 'clowder')
        });
      }
      return applyReactionToLatestSelfPrompt(messages, enrichedIncoming, options);
    }
    const isFinal = phase === 'final';
    const streamMessage = {
      ...enrichedIncoming,
      id: enrichedIncoming.streamKey,
      clientMsgNo: enrichedIncoming.streamKey,
      messageId: enrichedIncoming.streamKey,
      type: 'text',
      status: isFinal ? 'success' : 'sending',
      streaming: !isFinal,
      renderMode: 'markdown',
      isMarkdown: true,
      source: enrichedIncoming.source || 'clowder'
    };
    const key = messageIdentityKey(streamMessage);
    const next = [...messages];
    const streamIndex = next.findIndex((message) => messageIdentityKey(message) === key);
    if (streamIndex >= 0) {
      const incomingContent = streamMessage.content || '';
      const mergedContent = phase === 'chunk' && streamMessage.streamDelta
        ? `${next[streamIndex].content || ''}${incomingContent}`
        : streamMessage.content;
      next[streamIndex] = {
        ...next[streamIndex],
        ...streamMessage,
        content: mergedContent,
        reactions: next[streamIndex].reactions || streamMessage.reactions || [],
        replyRef: next[streamIndex].replyRef || streamMessage.replyRef || null,
        mentions: next[streamIndex].mentions || streamMessage.mentions || []
      };
      return sortMessages(next);
    }
    next.push(streamMessage);
    return sortMessages(next);
  }
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

  const localEchoAckIndex = findLocalEchoAckIndex(next, enrichedIncoming, currentUser, options);
  if (localEchoAckIndex >= 0) {
    const existing = next[localEchoAckIndex];
    next[localEchoAckIndex] = {
      ...existing,
      ...enrichedIncoming,
      senderId: firstNonEmpty(enrichedIncoming.senderId, existing.senderId),
      senderName: firstNonEmpty(enrichedIncoming.senderName, existing.senderName),
      senderAvatar: firstNonEmpty(enrichedIncoming.senderAvatar, existing.senderAvatar),
      id: firstNonEmpty(enrichedIncoming.id, existing.id),
      status: 'success'
    };
    return sortMessages(next);
  }

  next.push(enrichedIncoming);
  return sortMessages(next);
}

export function mergeNativeMessageLists(current = [], incoming = [], options = {}) {
  return incoming.reduce((list, message) => mergeNativeMessageIntoList(list, message, options), [...current]);
}

function hasEquivalentIncomingMessage(message = {}, incoming = [], currentUser = {}, options = {}) {
  const key = messageIdentityKey(message);
  if (key && incoming.some((candidate) => messageIdentityKey(candidate) === key)) return true;
  return findSelfEchoIndex(incoming, message, currentUser, options) >= 0;
}

function shouldPreserveLocalContextMessage(message = {}, incoming = [], options = {}) {
  const currentUser = options.currentUser || {};
  const conversation = options.conversation || {};
  const status = clean(message.status);
  if (status === 'sending' || status === 'failed') return true;
  if (status !== 'success') return false;
  if (!isClowderConversation(conversation)) return false;
  if (!isSelfSender(message.senderId || message.from_uid || message.fromUID, currentUser)) return false;
  if (hasEquivalentIncomingMessage(message, incoming, currentUser, options)) return false;
  return isVisibleChatMessage(message);
}

export function mergeSyncedMessagesPreservingLocalContext(current = [], incoming = [], options = {}) {
  const contextMessages = firstArray(options.preservedContextMessages, options.localContextMessages)
    .filter((message) => shouldPreserveLocalContextMessage(message, incoming, options));
  const preserved = [
    ...contextMessages,
    ...current.filter((message) => shouldPreserveLocalContextMessage(message, incoming, options))
  ];
  return mergeNativeMessageLists(preserved, incoming, options);
}

export function sortMessages(messages = []) {
  return [...messages].sort((a, b) => safeNumber(a.time, 0) - safeNumber(b.time, 0));
}
