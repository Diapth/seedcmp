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
    .replace(/[*~]{1,3}/g, '')
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

function comparableTextContent(message = {}) {
  return clean(message.content)
    .replace(/[▌▋▊█]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyClowderPartialReplyDuplicate(candidate = {}, incoming = {}) {
  const candidateContent = comparableTextContent(candidate);
  const incomingContent = comparableTextContent(incoming);
  if (!candidateContent || !incomingContent) return false;
  if (candidateContent === incomingContent) return true;

  const shorter = candidateContent.length <= incomingContent.length ? candidateContent : incomingContent;
  const longer = candidateContent.length > incomingContent.length ? candidateContent : incomingContent;
  if (shorter.length < 48) return false;
  if (!longer.startsWith(shorter)) return false;

  const coverage = shorter.length / Math.max(longer.length, 1);
  return coverage >= 0.35;
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

function isFetchableFileUrl(value = '') {
  const url = clean(value);
  return /^(https?:|blob:|data:)/i.test(url)
    || /^\/(uploads|v1|clowder-api|api|static|assets)\//i.test(url);
}

function normalizeWorkspaceArtifactPath(value = '') {
  const raw = clean(value);
  if (!raw || isFetchableFileUrl(raw) || /^javascript:/i.test(raw)) return '';
  return raw.replace(/^\.?\//, '').replace(/\\/g, '/');
}

function workspaceRawFileUrl(worktreeId = '', workspacePath = '') {
  const tree = clean(worktreeId);
  const path = normalizeWorkspaceArtifactPath(workspacePath);
  if (!tree || !path) return '';
  return `/v1/clowder/workspace/file/raw?worktreeId=${encodeURIComponent(tree)}&path=${encodeURIComponent(path)}`;
}

function normalizeAgentFile(file = {}, streamKey = '', index = 0) {
  const name = firstNonEmpty(file.fileName, file.name, file.title, `智能体文件-${index + 1}`);
  const explicitUrlCandidates = [file.url, file.sourceUrl, file.contentUrl, file.previewUrl, file.downloadUrl];
  const explicitUrl = firstNonEmpty(...explicitUrlCandidates);
  const fetchableUrl = explicitUrlCandidates.map(clean).find(isFetchableFileUrl) || '';
  const workspacePath = firstNonEmpty(
    file.workspacePath,
    file.workspace_path,
    file.relativePath,
    file.relative_path,
    file.path,
    fetchableUrl ? '' : explicitUrl
  );
  const worktreeId = firstNonEmpty(
    file.worktreeId,
    file.worktree_id,
    file.workspaceWorktreeId,
    file.workspace_worktree_id,
    file.worktree?.id,
    file.workspace?.worktreeId,
    file.workspace?.worktree_id
  );
  const url = firstNonEmpty(fetchableUrl, workspaceRawFileUrl(worktreeId, workspacePath));
  const extension = clean(file.fileType || file.ext || name.split('.').pop()).toLowerCase();
  const inlineTextTypes = new Set([
    'md', 'markdown', 'html', 'htm', 'txt', 'text', 'json',
    'js', 'ts', 'jsx', 'tsx', 'css', 'less', 'scss', 'vue',
    'py', 'java', 'cpp', 'c', 'go', 'sql', 'sh', 'xml', 'yaml', 'yml'
  ]);
  const inlineContent = firstNonEmpty(
    file.previewContent,
    file.contentText,
    file.markdown,
    file.text,
    inlineTextTypes.has(extension) ? file.content : ''
  );
  return {
    id: firstNonEmpty(file.id, file.fileId, `${streamKey}-file-${index}`),
    type: 'file',
    content: name,
    name,
    fileName: name,
    fileSize: file.fileSize || file.size || '',
    fileSizeBytes: safeNumber(file.fileSizeBytes ?? file.bytes, 0),
    fileType: firstNonEmpty(file.fileType, file.ext, extension),
    mimeType: firstNonEmpty(file.mimeType, file.type),
    url,
    path: normalizeWorkspaceArtifactPath(workspacePath),
    workspacePath: normalizeWorkspaceArtifactPath(workspacePath),
    worktreeId,
    sourceUrl: firstNonEmpty(isFetchableFileUrl(file.sourceUrl) ? file.sourceUrl : '', url),
    contentUrl: firstNonEmpty(isFetchableFileUrl(file.contentUrl) ? file.contentUrl : '', url),
    previewContent: inlineContent,
    generatedByAgent: true,
    source: 'clowder',
    raw: file
  };
}

function isRichFileBlock(block = {}) {
  if (!block || typeof block !== 'object') return false;
  const kind = clean(block.kind || block.type || block.blockType || block.block_type).toLowerCase();
  if (['file', 'attachment', 'document'].includes(kind)) return true;
  const name = firstNonEmpty(block.fileName, block.file_name, block.filename, block.name, block.title);
  const location = firstNonEmpty(
    block.url,
    block.sourceUrl,
    block.source_url,
    block.contentUrl,
    block.content_url,
    block.downloadUrl,
    block.download_url,
    block.workspacePath,
    block.workspace_path,
    block.relativePath,
    block.relative_path,
    block.path
  );
  return Boolean(name && location);
}

function normalizeRichFileBlocks(message = {}) {
  const blocks = Array.isArray(message.richBlocks) ? message.richBlocks : [];
  const parentKey = firstNonEmpty(message.streamKey, message.clientMsgNo, message.messageId, message.id, 'rich');
  return blocks
    .filter(isRichFileBlock)
    .map((block, index) => {
      const blockId = firstNonEmpty(block.id, block.blockId, block.block_id, block.fileId, block.file_id, index);
      return normalizeAgentFile({
        ...block,
        id: `${parentKey}-rich-file-${blockId}`,
        fileName: firstNonEmpty(block.fileName, block.file_name, block.filename, block.name, block.title),
        name: firstNonEmpty(block.name, block.fileName, block.file_name, block.filename, block.title),
        fileType: firstNonEmpty(block.fileType, block.file_type, block.ext, block.extension),
        mimeType: firstNonEmpty(block.mimeType, block.mime_type, block.type),
        sourceUrl: firstNonEmpty(block.sourceUrl, block.source_url, block.url),
        contentUrl: firstNonEmpty(block.contentUrl, block.content_url, block.url),
        workspacePath: firstNonEmpty(block.workspacePath, block.workspace_path, block.relativePath, block.relative_path, block.path),
        worktreeId: firstNonEmpty(block.worktreeId, block.worktree_id, block.workspaceWorktreeId, block.workspace_worktree_id)
      }, parentKey, index);
    });
}

function appendRichFileBlockMessages(messages = [], sourceMessage = {}) {
  const files = normalizeRichFileBlocks(sourceMessage);
  if (!files.length) return messages;
  const next = [...messages];
  files.forEach((file, index) => {
    const fileMessage = {
      reactions: [],
      replyRef: null,
      mentions: [],
      ...file,
      senderId: sourceMessage.senderId,
      senderName: sourceMessage.senderName,
      senderAvatar: sourceMessage.senderAvatar,
      status: 'success',
      time: safeNumber(sourceMessage.time, Date.now()) + index + 1,
      generatedByAgent: true,
      source: sourceMessage.source || 'clowder',
      parentMessageId: firstNonEmpty(sourceMessage.messageId, sourceMessage.id, sourceMessage.clientMsgNo)
    };
    const fileKey = messageIdentityKey(fileMessage);
    const existingIndex = next.findIndex((message) => messageIdentityKey(message) === fileKey);
    if (existingIndex >= 0) {
      next[existingIndex] = { ...next[existingIndex], ...fileMessage };
    } else {
      next.push(fileMessage);
    }
  });
  return next;
}

export function isClowderConversation(conversation = {}) {
  const id = clean(conversation.id || conversation.channelId || conversation.agentId).toLowerCase();
  const name = clean(conversation.name || conversation.title || conversation.displayName).toLowerCase();
  return isClowderDirectCatConversation(conversation)
    || isClowderProjectGroupConversation(conversation)
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

export function isClowderProjectGroupConversation(conversation = {}) {
  const binding = conversation.binding || conversation.raw?.binding || {};
  const threadId = resolveClowderConversationThreadId(conversation);
  const channelType = Number(conversation.channelType || conversation.channel_type || (conversation.type === 'group' ? 2 : 0));
  return Boolean(threadId && (channelType === 2 || conversation.type === 'group' || conversation.isProjectGroup));
}

function resolveClowderConversationThreadId(conversation = {}) {
  const binding = conversation.binding || conversation.raw?.binding || {};
  return firstNonEmpty(
    conversation.projectThreadId,
    conversation.project_thread_id,
    conversation.threadId,
    conversation.thread_id,
    conversation.clowderThreadId,
    conversation.clowder_thread_id,
    binding.projectThreadId,
    binding.project_thread_id,
    binding.threadId,
    binding.thread_id,
    conversation.raw?.projectThreadId,
    conversation.raw?.project_thread_id,
    conversation.raw?.threadId,
    conversation.raw?.thread_id
  );
}

function normalizeTargetCatId(value = '') {
  const id = firstNonEmpty(value);
  if (!id) return '';
  return getClowderCatIdFromContactId(id) || id.replace(/^@/, '');
}

function normalizeMentionText(value = '') {
  return clean(value)
    .replace(/^@/, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function candidateMentionLabels(member = {}) {
  return [
    member.alias,
    member.mention,
    member.name,
    member.displayName,
    member.nickname,
    member.title,
    member.raw?.alias,
    member.raw?.name,
    member.raw?.displayName,
    member.raw?.nickname
  ].map(normalizeMentionText).filter(Boolean);
}

function providerFamilyFromMember(member = {}) {
  const raw = member.raw || {};
  const haystack = [
    member.provider,
    member.platform,
    member.clientId,
    member.client_id,
    member.accountRef,
    member.account_ref,
    raw.provider,
    raw.platform,
    raw.clientId,
    raw.client_id,
    raw.accountRef,
    raw.account_ref
  ].map(clean).join(' ').toLowerCase();
  if (haystack.includes('anthropic') || haystack.includes('claude')) return 'claude';
  if (haystack.includes('openai') || haystack.includes('codex')) return 'codex';
  if (haystack.includes('google') || haystack.includes('gemini')) return 'gemini';
  return '';
}

function accessModeFromMember(member = {}) {
  const raw = member.raw || {};
  const haystack = [
    member.accessMode,
    member.access_mode,
    member.authType,
    member.auth_type,
    raw.accessMode,
    raw.access_mode,
    raw.authType,
    raw.auth_type
  ].map(clean).join(' ').replace(/_/g, '-').toLowerCase();
  if (haystack.includes('oauth')) return 'oauth';
  if (haystack.includes('api-key') || haystack.includes('api key') || haystack.includes('apikey')) return 'api-key';
  return '';
}

function runtimeCatPenalty(id = '', member = {}) {
  const provider = providerFamilyFromMember(member);
  if (provider === 'claude') return -20;
  if (provider === 'codex') return 40;
  if (/^runtime-cat-/i.test(id)) return 20;
  return 0;
}

function memberMatchScore(member = {}, mentionedLabels = []) {
  const id = normalizeTargetCatId(firstNonEmpty(
    member.catId,
    member.cat_id,
    member.directCatId,
    member.direct_cat_id,
    member.agentId,
    member.agent_id,
    member.userId,
    member.uid,
    member.id
  ));
  if (!id) return null;
  const labels = candidateMentionLabels(member);
  if (!labels.length) return null;
  const matched = mentionedLabels.some((mention) => labels.some((label) => mention === label || mention.includes(label) || label.includes(mention)));
  if (!matched) return null;
  const accessMode = accessModeFromMember(member);
  return {
    id,
    score: runtimeCatPenalty(id, member) + (accessMode === 'oauth' ? -2 : 0)
  };
}

function conversationCatMembers(conversation = {}) {
  const binding = conversation.binding || conversation.raw?.binding || {};
  const directMembers = [
    ...(Array.isArray(conversation.catMembers) ? conversation.catMembers : []),
    ...(Array.isArray(conversation.agents) ? conversation.agents : []),
    ...(Array.isArray(conversation.agentMembers) ? conversation.agentMembers : []),
    ...(Array.isArray(conversation.members) ? conversation.members : [])
  ];
  const idMembers = [
    ...(Array.isArray(conversation.catMemberIds) ? conversation.catMemberIds : []),
    ...(Array.isArray(conversation.workerCatIds) ? conversation.workerCatIds : []),
    ...(Array.isArray(conversation.targetCatIds) ? conversation.targetCatIds : []),
    ...(Array.isArray(binding.catMemberIds) ? binding.catMemberIds : []),
    ...(Array.isArray(binding.workerCatIds) ? binding.workerCatIds : []),
    ...(Array.isArray(binding.targetCatIds) ? binding.targetCatIds : [])
  ].map((id) => ({ id }));
  return [...directMembers, ...idMembers];
}

function lineStartMentionTargetsFromText(text = '', conversation = {}) {
  const members = conversationCatMembers(conversation);
  if (!members.length) return [];
  const lines = String(text || '').split(/\r?\n/);
  const mentionedLabels = lines
    .map((line) => line.match(/^\s*@([^\s，,、:：]+)/u)?.[1])
    .map(normalizeMentionText)
    .filter(Boolean);
  if (!mentionedLabels.length) return [];

  const bestById = new Map();
  members.forEach((member) => {
    const matched = memberMatchScore(member, mentionedLabels);
    if (!matched) return;
    const previous = bestById.get(matched.id);
    if (!previous || matched.score < previous.score) bestById.set(matched.id, matched);
  });
  const matches = [...bestById.values()];
  if (!matches.length) return [];
  const bestScore = Math.min(...matches.map((item) => item.score));
  return matches
    .filter((item) => item.score === bestScore)
    .map((item) => item.id);
}

function targetCatIdsFromPayload(payload = {}) {
  const explicit = Array.isArray(payload.targetCatIds) ? payload.targetCatIds : [];
  const mentions = Array.isArray(payload.mentions) ? payload.mentions : [];
  return [...new Set([
    ...explicit.map(normalizeTargetCatId),
    ...mentions.map((mention) => normalizeTargetCatId(
      mention.catId
        || mention.directCatId
        || mention.agentId
        || mention.userId
        || mention.uid
        || mention.id
    ))
  ].filter(Boolean))];
}

export function buildClowderConversationBridgePayload(conversation = {}, payload = {}) {
  const text = firstNonEmpty(payload.content, payload.text);
  const result = { text };
  const promptContext = firstNonEmpty(payload.promptContext);
  if (isClowderDirectCatConversation(conversation)) {
    const directCatId = resolveClowderDirectCatId(conversation);
    if (directCatId) result.directCatId = directCatId;
    if (promptContext) result.promptContext = promptContext;
    return result;
  }

  if (isClowderProjectGroupConversation(conversation)) {
    const threadId = resolveClowderConversationThreadId(conversation);
    const targetCatIds = [...new Set([
      ...targetCatIdsFromPayload(payload),
      ...lineStartMentionTargetsFromText(text, conversation)
    ].filter(Boolean))];
    if (threadId) result.threadId = threadId;
    if (targetCatIds.length) result.targetCatIds = targetCatIds;
    result.promptContext = promptContext || `项目群：${firstNonEmpty(conversation.name, conversation.title, conversation.id, conversation.channelId)}`;
  }
  return result;
}

export function shouldStartLocalClowderStream(conversation = {}) {
  return isClowderConversation(conversation)
    && !isClowderDirectCatConversation(conversation)
    && !isClowderProjectGroupConversation(conversation);
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

  let next = [...messages];
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
  if (normalized.targetMessageId) {
    next = clearAgentPendingFeedbackFromList(next, {
      targetMessageId: normalized.targetMessageId,
      agentId: normalized.senderId
    });
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

function messageMentionsCurrentUser(message = {}, currentUser = {}) {
  if (message.mentionAll) return true;
  const selfIds = collectSelfIds(currentUser);
  if (!selfIds.size) return false;
  const mentions = Array.isArray(message.mentions) ? message.mentions : [];
  const mentionUids = Array.isArray(message.mentionUids) ? message.mentionUids : [];
  return [...mentions, ...mentionUids].some((mention) => {
    if (mention && typeof mention === 'object') {
      return [
        mention.userId,
        mention.user_id,
        mention.uid,
        mention.id
      ].map(clean).some((id) => id && selfIds.has(id));
    }
    const id = clean(mention);
    return id && selfIds.has(id);
  });
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
    const reminder = messageMentionsCurrentUser(message, currentUser) ? '[有人@我] ' : '';
    return `${reminder}${senderName ? `${senderName}: ${digest}` : digest}`;
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

function messageIdentityKeys(message = {}) {
  return new Set([
    message.id,
    message.messageId,
    message.messageID,
    message.message_id,
    message.clientMsgNo,
    message.client_msg_no
  ].map(clean).filter(Boolean));
}

export function applyReactionEventIntoList(messages = [], event = {}) {
  const normalized = normalizeReactionEvent(event);
  if (!normalized.targetMessageId || !normalized.emoji || !normalized.userId) return [...messages];
  return messages.map((message) => {
    if (!messageIdentityKeys(message).has(normalized.targetMessageId)) return message;

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

function normalizeAgentPendingFeedback(event = {}) {
  const targetMessageId = firstNonEmpty(
    event.targetMessageId,
    event.target_message_id,
    event.messageId,
    event.message_id,
    event.clientMsgNo,
    event.client_msg_no
  );
  const agentId = firstNonEmpty(event.agentId, event.agent_id, event.senderId, event.sender_id, event.userId, event.user_id, 'clowder');
  const streamKey = firstNonEmpty(event.streamKey, event.stream_key, targetMessageId ? `pending:${targetMessageId}` : '');
  const emoji = firstNonEmpty(event.emoji, event.reaction, '👀');
  const expiresAt = safeNumber(event.expiresAt ?? event.expires_at, 0);
  return {
    targetMessageId,
    agentId,
    streamKey,
    emoji,
    ...(expiresAt ? { expiresAt } : {})
  };
}

function comparableAgentId(value = '') {
  const id = clean(value);
  return getClowderCatIdFromContactId(id) || id;
}

export function applyAgentPendingFeedbackIntoList(messages = [], event = {}) {
  const pending = normalizeAgentPendingFeedback(event);
  if (!pending.targetMessageId || !pending.agentId || !pending.emoji) return [...messages];
  return messages.map((message) => {
    if (!messageIdentityKeys(message).has(pending.targetMessageId)) return message;
    const reactions = Array.isArray(message.reactions)
      ? message.reactions.map((reaction) => ({
          ...reaction,
          userIds: Array.isArray(reaction.userIds) ? [...reaction.userIds] : []
        }))
      : [];
    const existing = reactions.find((reaction) => (
      reaction.kind === 'agent_pending'
      && reaction.localOnly === true
      && reaction.streamKey === pending.streamKey
    ));
    if (existing) {
      if (!existing.userIds.some((uid) => comparableAgentId(uid) === comparableAgentId(pending.agentId))) {
        existing.userIds.push(pending.agentId);
      }
      existing.count = existing.userIds.length;
      existing.emoji = pending.emoji;
      if (pending.expiresAt) existing.expiresAt = pending.expiresAt;
    } else {
      reactions.push({
        emoji: pending.emoji,
        userIds: [pending.agentId],
        count: 1,
        kind: 'agent_pending',
        streamKey: pending.streamKey,
        localOnly: true,
        ...(pending.expiresAt ? { expiresAt: pending.expiresAt } : {})
      });
    }
    return { ...message, reactions };
  });
}

export function clearAgentPendingFeedbackFromList(messages = [], event = {}) {
  const pending = normalizeAgentPendingFeedback(event);
  if (!pending.targetMessageId) return [...messages];
  return messages.map((message) => {
    if (!messageIdentityKeys(message).has(pending.targetMessageId)) return message;
    const reactions = Array.isArray(message.reactions) ? message.reactions : [];
    const nextReactions = reactions.flatMap((reaction) => {
      const isPending = reaction?.kind === 'agent_pending' || reaction?.localOnly === true;
      if (!isPending) return [reaction];
      const userIds = Array.isArray(reaction.userIds) ? [...reaction.userIds] : [];
      const shouldClear = !pending.agentId || userIds.some((uid) => comparableAgentId(uid) === comparableAgentId(pending.agentId));
      if (!shouldClear) return [reaction];
      const remainingUserIds = pending.agentId
        ? userIds.filter((uid) => comparableAgentId(uid) !== comparableAgentId(pending.agentId))
        : [];
      if (!remainingUserIds.length) return [];
      return [{
        ...reaction,
        userIds: remainingUserIds,
        count: remainingUserIds.length
      }];
    });
    return { ...message, reactions: nextReactions };
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
  const catId = firstNonEmpty(next.catId, next.cat_id, next.raw?.catId, next.raw?.cat_id);
  const catDisplayName = firstNonEmpty(
    next.catDisplayName,
    next.cat_display_name,
    next.raw?.catDisplayName,
    next.raw?.cat_display_name
  );
  if (catId || catDisplayName) {
    next.senderId = catId || next.senderId || next.from_uid || next.fromUID;
    next.senderName = catDisplayName || next.senderName || next.senderId || 'Clowder AI';
    next.senderAvatar = firstNonEmpty(next.senderAvatar, next.avatar);
    return next;
  }
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

function normalizedSenderKey(message = {}) {
  return clean(message.senderId || message.from_uid || message.fromUID || message.userId || message.uid).toLowerCase();
}

function isClowderReplySender(message = {}) {
  const sender = normalizedSenderKey(message);
  return sender === 'clowder'
    || sender.startsWith('clowder:')
    || sender.startsWith(CLOWDER_CAT_CONTACT_PREFIX);
}

function findEquivalentClowderReplyIndex(messages = [], incoming = {}, currentUser = {}, options = {}) {
  if (!isClowderConversation(options.conversation || {})) return -1;
  const incomingSenderId = incoming.senderId || incoming.from_uid || incoming.fromUID;
  if (isSelfSender(incomingSenderId, currentUser)) return -1;
  if (!isClowderReplySender(incoming)) return -1;
  if (incoming.type && incoming.type !== 'text') return -1;

  const incomingContent = contentKey(incoming);
  if (!incomingContent) return -1;
  const incomingSender = normalizedSenderKey(incoming);
  const incomingTime = safeNumber(incoming.time, 0);
  const timeWindowMs = options.agentReplyDedupeWindowMs || 10 * 60 * 1000;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (!isVisibleChatMessage(candidate)) continue;
    if (candidate.type && candidate.type !== 'text') continue;
    if (!isClowderReplySender(candidate)) continue;
    if (isSelfSender(candidate.senderId || candidate.from_uid || candidate.fromUID, currentUser)) continue;
    if (normalizedSenderKey(candidate) !== incomingSender) continue;
    if (contentKey(candidate) !== incomingContent && !isLikelyClowderPartialReplyDuplicate(candidate, incoming)) continue;
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
    const baseMessages = enrichedIncoming.targetMessageId
      ? clearAgentPendingFeedbackFromList(messages, {
          targetMessageId: enrichedIncoming.targetMessageId,
          agentId: firstNonEmpty(enrichedIncoming.senderId, 'clowder')
        })
      : messages;
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
    const next = [...baseMessages];
    const streamIndex = next.findIndex((message) => messageIdentityKey(message) === key);
    if (streamIndex >= 0) {
      const incomingContent = streamMessage.content || '';
      const mergedContent = phase === 'chunk' && streamMessage.streamDelta
        ? `${next[streamIndex].content || ''}${incomingContent}`
        : streamMessage.content;
      const mergedStreamMessage = {
        ...next[streamIndex],
        ...streamMessage,
        content: mergedContent,
        reactions: next[streamIndex].reactions || streamMessage.reactions || [],
        replyRef: next[streamIndex].replyRef || streamMessage.replyRef || null,
        mentions: next[streamIndex].mentions || streamMessage.mentions || []
      };
      next[streamIndex] = mergedStreamMessage;
      return sortMessages(isFinal ? appendRichFileBlockMessages(next, mergedStreamMessage) : next);
    }
    next.push(streamMessage);
    return sortMessages(isFinal ? appendRichFileBlockMessages(next, streamMessage) : next);
  }
  const key = messageIdentityKey(enrichedIncoming);
  const next = [...messages];

  if (key) {
    const keyIndex = next.findIndex((message) => messageIdentityKey(message) === key);
    if (keyIndex >= 0) {
      const mergedMessage = {
        ...next[keyIndex],
        ...enrichedIncoming,
        status: enrichedIncoming.status || next[keyIndex].status || 'success'
      };
      next[keyIndex] = mergedMessage;
      return sortMessages(appendRichFileBlockMessages(next, mergedMessage));
    }
  }

  const duplicateReplyIndex = findEquivalentClowderReplyIndex(next, enrichedIncoming, currentUser, options);
  if (duplicateReplyIndex >= 0) {
    const mergedMessage = {
      ...next[duplicateReplyIndex],
      ...enrichedIncoming,
      id: firstNonEmpty(enrichedIncoming.id, next[duplicateReplyIndex].id),
      status: enrichedIncoming.status || next[duplicateReplyIndex].status || 'success',
      streaming: enrichedIncoming.streaming === undefined ? false : enrichedIncoming.streaming,
      reactions: next[duplicateReplyIndex].reactions || enrichedIncoming.reactions || [],
      replyRef: next[duplicateReplyIndex].replyRef || enrichedIncoming.replyRef || null,
      mentions: next[duplicateReplyIndex].mentions || enrichedIncoming.mentions || []
    };
    next[duplicateReplyIndex] = mergedMessage;
    return sortMessages(appendRichFileBlockMessages(next, mergedMessage));
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
  return sortMessages(appendRichFileBlockMessages(next, enrichedIncoming));
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

function isLocalCoordinatorConfirmationCard(message = {}) {
  return message?.metadata?.coordinator_template_cats_request === true
    || message?.metadata?.project_group_confirmation === true
    || message?.metadata?.deployment_card === true
    || Boolean(message?.coordinatorTemplateCatsCard?.cardId)
    || Boolean(message?.projectGroupCard?.cardId)
    || Boolean(message?.deploymentCard?.cardId)
    || message?.type === 'coordinator_template_cats_request'
    || message?.type === 'project_group_confirmation'
    || message?.type === 'deployment_card'
    || message?.contentType === 'coordinator_template_cats_request'
    || message?.contentType === 'project_group_confirmation'
    || message?.contentType === 'deployment_card';
}

function shouldPreserveLocalUiStateMessage(message = {}, incoming = [], options = {}) {
  const conversation = options.conversation || {};
  if (!isClowderConversation(conversation)) return false;
  if (!isLocalCoordinatorConfirmationCard(message)) return false;
  if (hasEquivalentIncomingMessage(message, incoming, options.currentUser || {}, options)) return false;
  return true;
}

export function mergeSyncedMessagesPreservingLocalContext(current = [], incoming = [], options = {}) {
  const contextMessages = firstArray(options.preservedContextMessages, options.localContextMessages)
    .filter((message) => shouldPreserveLocalContextMessage(message, incoming, options));
  const preserved = [
    ...contextMessages,
    ...current.filter((message) => (
      shouldPreserveLocalContextMessage(message, incoming, options)
      || shouldPreserveLocalUiStateMessage(message, incoming, options)
    ))
  ];
  return mergeNativeMessageLists(preserved, incoming, options);
}

export function sortMessages(messages = []) {
  return [...messages].sort((a, b) => safeNumber(a.time, 0) - safeNumber(b.time, 0));
}
