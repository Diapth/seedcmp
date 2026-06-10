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

function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function firstText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'object') continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function firstRawText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'object') continue;
    const text = String(value);
    if (text) return text;
  }
  return '';
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
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

function normalizeEventName(value) {
  return clean(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

function memberDisplayName(member) {
  if (member && typeof member === 'object') {
    return firstText(member.remark, member.nickname, member.name, member.uid, member.id);
  }
  return firstText(member);
}

function mentionNameFromMap(source, uid) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return '';
  return firstText(source[uid], source[String(uid)]);
}

function mentionNameFromMembers(members, uid) {
  if (!Array.isArray(members)) return '';
  const member = members.find((item) => {
    if (!item || typeof item !== 'object') return false;
    return clean(firstNonEmpty(item.uid, item.userId, item.user_id, item.id)) === clean(uid);
  });
  return memberDisplayName(member);
}

function mentionDisplayName(mention = {}, uid = '', entry = {}) {
  return firstText(
    entry.name,
    entry.nickname,
    entry.displayName,
    entry.display_name,
    mentionNameFromMap(mention.names, uid),
    mentionNameFromMap(mention.nicknames, uid),
    mentionNameFromMap(mention.displayNames, uid),
    mentionNameFromMap(mention.display_names, uid),
    mentionNameFromMembers(mention.members, uid),
    mentionNameFromMembers(mention.users, uid),
    uid
  );
}

function findMentionOffset(text = '', name = '', uid = '', start = 0) {
  const source = String(text || '');
  const candidates = [name, uid]
    .map((value) => clean(value).replace(/^@/, ''))
    .filter(Boolean);
  for (const value of [...new Set(candidates)]) {
    const token = `@${value}`;
    const afterStart = source.indexOf(token, Math.max(0, start));
    if (afterStart >= 0) return afterStart;
    const anywhere = source.indexOf(token);
    if (anywhere >= 0) return anywhere;
  }
  return -1;
}

function normalizeMentionEntry(entry, mention = {}, text = '', cursor = 0) {
  const objectEntry = entry && typeof entry === 'object' ? entry : {};
  const uid = firstNonEmpty(
    objectEntry.userId,
    objectEntry.user_id,
    objectEntry.uid,
    objectEntry.id,
    typeof entry === 'object' ? '' : entry
  );
  const name = mentionDisplayName(mention, uid, objectEntry);
  const explicitOffset = objectEntry.offset ?? objectEntry.index ?? objectEntry.start;
  const inferredOffset = findMentionOffset(text, name, uid, cursor);
  const offset = explicitOffset === undefined || explicitOffset === null || explicitOffset === ''
    ? inferredOffset
    : toNumber(explicitOffset, inferredOffset);

  if (!uid && !name) return null;
  return {
    userId: String(uid || name),
    uid: String(uid || name),
    name: String(name || uid),
    offset
  };
}

function uniqueMentions(mentions = []) {
  const seen = new Set();
  return mentions.filter((mention) => {
    if (!mention) return false;
    const key = `${mention.userId}:${mention.name}:${mention.offset}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeMentions(mention = {}, text = '', ...sources) {
  const entries = [
    ...firstArray(mention.mentions, mention.items, mention.members, mention.users),
    ...firstArray(...sources),
    ...firstArray(mention.uids, mention.userIds, mention.user_ids)
  ];
  let cursor = 0;
  const normalized = entries.map((entry) => {
    const item = normalizeMentionEntry(entry, mention, text, cursor);
    if (item && item.offset >= 0) {
      cursor = item.offset + item.name.length + 1;
    }
    return item;
  });
  return uniqueMentions(normalized);
}

function normalizeMentionAll(value) {
  return value === true || value === 1 || value === '1' || clean(value).toLowerCase() === 'true';
}

function memberListText(...values) {
  const members = firstArray(...values);
  if (!members.length) {
    const text = firstText(...values);
    return text;
  }
  return members.map(memberDisplayName).filter(Boolean).join('、');
}

function normalizeStreamPhase(value) {
  const state = clean(value).toLowerCase();
  if (['placeholder', 'thinking', 'start', 'created'].includes(state)) return 'placeholder';
  if (['chunk', 'delta', 'streaming'].includes(state)) return 'chunk';
  if (['final', 'done', 'complete', 'completed'].includes(state)) return 'final';
  if (state === 'cleanup') return 'cleanup';
  return state;
}

function normalizeStreamState(content = {}) {
  const event = normalizeEventName(firstText(content.event, content.type_name, content.typeName, content.action, content.cmd));
  const stream = content.stream && typeof content.stream === 'object' ? content.stream : null;
  const isTopLevelStream = /^clowder_(stream|reply|delta)/.test(event)
    || firstText(content.streamKey, content.stream_key, content.streamId, content.stream_id);
  const source = stream || (isTopLevelStream ? content : null);
  if (!source) return {};
  const state = normalizeStreamPhase(firstText(
    source.state,
    source.phase,
    source.status,
    source.stage,
    content.phase,
    content.status,
    content.stage
  ));
  const streamKey = firstText(
    source.platformMessageId,
    source.platform_message_id,
    source.streamKey,
    source.stream_key,
    source.streamId,
    source.stream_id,
    content.platformMessageId,
    content.platform_message_id,
    content.streamKey,
    content.stream_key,
    content.streamId,
    content.stream_id,
    content.clientMsgNo,
    content.client_msg_no
  );
  if (!streamKey) return {};
  const phase = ['placeholder', 'chunk', 'final', 'cleanup'].includes(state) ? state : 'chunk';
  const targetMessageId = firstText(
    source.targetMessageId,
    source.target_message_id,
    source.promptMessageId,
    source.prompt_message_id,
    source.inReplyTo,
    source.in_reply_to,
    content.targetMessageId,
    content.target_message_id,
    content.promptMessageId,
    content.prompt_message_id,
    content.inReplyTo,
    content.in_reply_to
  );
  return {
    streamKey,
    streamPhase: phase,
    ...(targetMessageId ? { targetMessageId } : {}),
    streaming: phase === 'placeholder' || phase === 'chunk',
    renderMode: 'markdown',
    isMarkdown: true
  };
}

function normalizeClowderReactionEvent(content = {}) {
  const event = normalizeEventName(firstText(content.event, content.type_name, content.typeName, content.action, content.cmd));
  if (event !== 'clowder_reaction') return null;
  const targetMessageId = firstText(
    content.target_message_id,
    content.targetMessageId,
    content.message_id,
    content.messageId,
    content.platformMessageId,
    content.platform_message_id
  );
  const emoji = firstText(content.emoji, content.reaction, content.emoji_type, content.emojiType) || '❤️';
  return {
    targetMessageId,
    emoji,
    userId: firstText(content.user_id, content.userId, content.uid, 'clowder'),
    userName: firstText(content.user_name, content.userName, content.name, 'Clowder AI')
  };
}

function hasNoticeChange(content = {}) {
  const fields = firstArray(content.fields, content.changedFields, content.changed_fields);
  return Boolean(
    firstText(content.notice, content.announcement, content.newNotice, content.new_notice, content.newAnnouncement, content.new_announcement)
    || fields.some((field) => /notice|announcement/i.test(String(field)))
  );
}

export function resolveSystemMessageContent(content = {}) {
  const event = normalizeEventName(firstText(content.event, content.type_name, content.typeName, content.action, content.cmd));
  const reactionEvent = normalizeClowderReactionEvent(content);
  if (reactionEvent) {
    return { text: '', event, isSilentSystem: true, reactionEvent };
  }
  const explicitText = firstText(content.text, content.title, content.message);
  if (explicitText) {
    return { text: explicitText, event, isSilentSystem: false };
  }

  const operator = firstText(
    content.operator_name,
    content.operatorName,
    content.inviter_name,
    content.inviterName,
    content.from_name,
    content.fromName,
    content.creator_name,
    content.creatorName,
    content.senderName,
    content.operator,
    content.inviter,
    '有人'
  );
  const members = memberListText(
    content.members,
    content.memberNames,
    content.member_names,
    content.users,
    content.uids,
    content.invitees,
    content.removed,
    content.removees
  );
  const notice = firstText(
    content.notice,
    content.announcement,
    content.newNotice,
    content.new_notice,
    content.newAnnouncement,
    content.new_announcement
  );

  switch (event) {
    case 'group_create':
      return { text: `${operator} 创建了群聊`, event, isSilentSystem: false };
    case 'group_member_add':
    case 'member_add':
    case 'group_join':
    case 'join_group':
    case 'invite':
      return {
        text: members ? `${operator} 邀请 ${members} 加入群聊` : `${operator} 邀请新成员加入群聊`,
        event,
        isSilentSystem: false
      };
    case 'group_member_remove':
    case 'member_remove':
    case 'group_kick':
    case 'kick':
      return {
        text: members ? `${operator} 将 ${members} 移出群聊` : `${operator} 移出了群成员`,
        event,
        isSilentSystem: false
      };
    case 'group_exit':
    case 'group_leave':
    case 'leave_group':
    case 'quit_group':
      return { text: `${operator} 退出了群聊`, event, isSilentSystem: false };
    case 'group_disband':
      return { text: `${operator} 解散了群聊`, event, isSilentSystem: false };
    case 'group_notice_update':
    case 'group_announcement_update':
    case 'notice_update':
    case 'announcement_update':
      return {
        text: `${operator} 修改了群公告${notice ? `：${notice}` : ''}`,
        event,
        isSilentSystem: false
      };
    case 'group_update':
    case 'group_profile_update':
      if (hasNoticeChange(content)) {
        return {
          text: `${operator} 修改了群公告${notice ? `：${notice}` : ''}`,
          event,
          isSilentSystem: false
        };
      }
      return { text: `${operator} 更新了群资料`, event, isSilentSystem: false };
    default:
      return {
        text: event ? '系统通知' : '',
        event,
        isSilentSystem: !event
      };
  }
}

export function normalizeContent(payload) {
  const envelope = payload && typeof payload === 'object' ? payload : {};
  const rawSource = envelope.payload ?? envelope.contentObj ?? envelope.content ?? payload;
  const parsed = parsePayload(rawSource);
  const nestedSource = parsed.contentObj
    ?? parsed.payload
    ?? (parsed.content && typeof parsed.content === 'object' ? parsed.content : undefined);
  const nested = nestedSource ? parsePayload(nestedSource) : {};
  const content = { ...envelope, ...parsed, ...nested };
  const type = toNumber(
    envelope.type
      ?? envelope.contentType
      ?? envelope.content_type
      ?? parsed.type
      ?? parsed.contentType
      ?? parsed.content_type
      ?? nested.type
      ?? nested.contentType
      ?? 1,
    1
  );
  const contentText = firstText(
    parsed.content,
    parsed.text,
    parsed.title,
    nested.content,
    nested.text,
    nested.title,
    envelope.text,
    envelope.title
  );
  const deltaText = firstRawText(
    parsed.delta,
    parsed.contentDelta,
    parsed.content_delta,
    nested.delta,
    nested.contentDelta,
    nested.content_delta,
    envelope.delta,
    envelope.contentDelta,
    envelope.content_delta
  );
  const text = contentText || deltaText;
  const name = firstNonEmpty(
    content.name,
    content.fileName,
    content.file_name,
    content.filename,
    content.title,
    payload?.name,
    payload?.file_name,
    payload?.fileName
  );
  const streamState = normalizeStreamState(content);
  const markdownState = (content.markdown === true || content.format === 'markdown')
    ? { renderMode: 'markdown', isMarkdown: true }
    : {};

  if (type === 2) {
    return { type: 'image', content: '[图片]', url: content.url || content.remoteUrl || '' };
  }
  if (type === 4) {
    return { type: 'voice', content: '[语音]', url: content.url || '', duration: toNumber(content.time || content.duration, 0) };
  }
  if (type === 8) {
    const fileName = name || String(text || '').replace(/^\[文件\]\s*/, '').trim() || '文件';
    const url = firstNonEmpty(
      content.url,
      content.remoteUrl,
      content.remote_url,
      content.sourceUrl,
      content.source_url,
      content.contentUrl,
      content.content_url,
      content.path,
      payload?.url,
      payload?.remote_url,
      payload?.path
    );
    return {
      type: 'file',
      content: `[文件] ${fileName}`.trim(),
      name: fileName,
      fileName,
      size: content.size || content.fileSize || content.file_size || payload?.size || payload?.file_size || 0,
      url
    };
  }
  if (streamState.streamKey) {
    return {
      type: 'text',
      content: text || '',
      streamDelta: Boolean(deltaText && !contentText && streamState.streamPhase === 'chunk'),
      ...markdownState,
      ...streamState
    };
  }
  if (type === 99 || type === 1000) {
    const system = resolveSystemMessageContent({ ...content, text });
    return {
      type: 'system',
      content: system.text,
      systemEvent: system.event,
      isSilentSystem: system.isSilentSystem,
      ...(system.reactionEvent ? { reactionEvent: system.reactionEvent } : {})
    };
  }

  return {
    type: 'text',
    content: text || '',
    ...markdownState,
    ...streamState
  };
}

function normalizeRichBlocks(input = {}, raw = {}) {
  return firstArray(
    input.richBlocks,
    input.rich_blocks,
    raw.richBlocks,
    raw.rich_blocks,
    input.extra?.rich?.blocks,
    raw.extra?.rich?.blocks,
    input.metadata?.richBlocks,
    input.metadata?.rich_blocks,
    raw.metadata?.richBlocks,
    raw.metadata?.rich_blocks
  ).filter((block) => block && typeof block === 'object');
}

function isProposalRichBlock(block = {}) {
  const actions = firstArray(block.actions);
  return String(block.id || '').startsWith('proposal-')
    || actions.some((action) => /^propose:(approve|reject)$/.test(String(action?.action || '')));
}

function normalizeProposalCard(block = {}) {
  const actions = firstArray(block.actions).map((action = {}) => ({
    label: firstText(action.label, action.text, action.action),
    action: firstText(action.action),
    payload: action.payload && typeof action.payload === 'object' ? action.payload : {}
  }));
  const proposalId = firstText(
    actions.find((action) => action.payload?.proposalId)?.payload?.proposalId,
    String(block.id || '').replace(/^proposal-/, '')
  );
  return {
    id: firstText(block.id, proposalId),
    proposalId,
    title: firstText(block.title, '提议新建 thread'),
    bodyMarkdown: firstText(block.bodyMarkdown, block.body, block.content, block.description),
    tone: firstText(block.tone, 'info'),
    fields: firstArray(block.fields).map((field = {}) => ({
      label: firstText(field.label, field.name),
      value: firstText(field.value, field.text)
    })).filter((field) => field.label || field.value),
    actions,
    status: 'pending'
  };
}

export function normalizeMessage(input = {}, options = {}) {
  const payload = input.payload ?? input.content ?? input.contentObj ?? {};
  const normalizedContent = normalizeContent({ ...input, payload });
  const id = firstNonEmpty(input.message_id, input.messageID, input.id, input.client_msg_no, input.clientMsgNo);
  const senderId = firstNonEmpty(input.from_uid, input.fromUID, input.senderId, options.currentUid);
  const senderName = firstNonEmpty(input.from_name, input.senderName, input.sender_name, senderId);
  const raw = parsePayload(payload);
  const mention = raw.mention || input.mention || {};
  const mentions = normalizeMentions(mention, normalizedContent.content, raw.mentions, input.mentions);
  const richBlocks = normalizeRichBlocks(input, raw);
  const proposalBlock = richBlocks.find(isProposalRichBlock);
  const proposalCard = proposalBlock ? normalizeProposalCard(proposalBlock) : null;

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
    mentionAll: normalizeMentionAll(mention.all),
    mentionUids: mentions.map((item) => item.userId).filter(Boolean),
    raw,
    ...normalizedContent,
    ...(richBlocks.length ? { richBlocks } : {}),
    ...(proposalCard ? {
      type: 'proposal_card',
      content: proposalCard.title,
      proposalCard
    } : {})
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
  if (content.isSilentSystem) return '';
  return content.content || '收到一条新消息';
}

function recentMessageFromInput(input = {}) {
  return Array.isArray(input.recents) ? input.recents[0] : null;
}

function hasDigestSource(input = {}) {
  const recent = recentMessageFromInput(input);
  const lastMessage = input.last_message || input.lastMessageObj;
  return Boolean(
    input.payload
    || input.content
    || input.lastMessage
    || lastMessage?.payload
    || lastMessage?.content
    || recent?.payload
    || recent?.content
  );
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
  const lastMessage = hasDigestSource(input) ? messageDigestFromInput(input) : '';
  const lastTime = toTimestampMs(lastMessageTimeFromInput(input), lastMessage ? Date.now() : 0);

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
    lastMessage,
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
