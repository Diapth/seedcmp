const PROJECT_START_RE = /(项目群|创建.*群|拉.*(?:猫|智能体|agent|codex|claude)|拆解.*任务|分工执行|协调.*(?:智能体|agent|codex|claude)|PM|pm|coordinator)/i;

const PROJECT_NAME_PATTERNS = [
  /项目名称(?:叫|为|是)?\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,40})/i,
  /项目名(?:叫|为|是)?\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,40})/i,
  /项目叫\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,40})/i,
  /群(?:名|名称)(?:叫|为|是)?\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,40})/i
];

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function firstText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function cleanProjectName(value = '') {
  return String(value || '')
    .trim()
    .replace(/^(?:叫|为|是|：|:)\s*/, '')
    .replace(/[」』”"']+$/g, '')
    .trim();
}

export function isProjectStartRequest(text = '') {
  const source = String(text || '').trim();
  if (source.length < 4) return false;
  return PROJECT_START_RE.test(source);
}

export function resolveProjectGroupName(text = '', fallback = '') {
  const source = String(text || '').trim();
  for (const pattern of PROJECT_NAME_PATTERNS) {
    const candidate = cleanProjectName(source.match(pattern)?.[1] || '');
    if (candidate) return candidate.slice(0, 24);
  }
  const fallbackName = cleanProjectName(fallback);
  if (fallbackName) {
    return /项目群$/.test(fallbackName) ? fallbackName.slice(0, 24) : `${fallbackName} 项目群`.slice(0, 24);
  }
  const compact = source
    .replace(/^\s*(?:@[\w\u4e00-\u9fff-]+[\s，,、]*)+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (compact || 'Clowder 项目群').slice(0, 24);
}

export function buildProjectGroupCardId(sourceMessage = {}) {
  const id = sourceMessage.id || sourceMessage.messageId || sourceMessage.clientMsgNo || sourceMessage.client_msg_no || '';
  return `project-group-card:${String(id || Date.now()).trim()}`;
}

function cardErrorText(error = '') {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return firstText(error.msg, error.message, error.error, '项目群创建失败');
}

function projectGroupCardSummary(card = {}) {
  const name = firstText(card.projectName, card.projectGroupName, 'Clowder 项目群');
  if (card.status === 'creating') return `正在创建或复用项目群：${name}`;
  if (card.status === 'created') return `${card.reused ? '已复用项目群' : '已创建项目群'}：${firstText(card.projectGroupName, name)}`;
  if (card.status === 'cancelled') return `已取消创建项目群：${name}`;
  if (card.status === 'failed') return `项目群创建失败：${cardErrorText(card.error) || name}`;
  return `PM / 协调者建议创建项目群：${name}`;
}

function normalizeProjectGroupCard(input = {}) {
  const sourceMessage = input.sourceMessage || {};
  const coordinator = input.coordinator || {};
  const cardId = firstText(input.cardId, input.id, buildProjectGroupCardId(sourceMessage));
  const projectName = firstText(input.projectName, resolveProjectGroupName(input.sourceText || sourceMessage.content || '', input.fallbackName));
  const status = firstText(input.status, 'pending_confirmation');
  return {
    cardId,
    id: cardId,
    status,
    projectName,
    sourceText: firstText(input.sourceText, sourceMessage.content),
    sourceMessageId: firstText(input.sourceMessageId, sourceMessage.messageId, sourceMessage.id),
    sourceClientMsgNo: firstText(input.sourceClientMsgNo, sourceMessage.clientMsgNo, sourceMessage.client_msg_no),
    pmDirectChannelId: firstText(input.pmDirectChannelId, input.channelId),
    pmDirectChannelType: Number(input.pmDirectChannelType || input.channelType || 1),
    pmDirectThreadId: firstText(input.pmDirectThreadId, input.threadId),
    coordinator: {
      id: firstText(coordinator.id, coordinator.catId, coordinator.uid, input.coordinatorId, 'coordinator'),
      name: firstText(coordinator.name, coordinator.nickname, coordinator.displayName, input.coordinatorName, 'PM / 协调者'),
      avatar: firstText(coordinator.avatar, input.coordinatorAvatar)
    },
    targetCatIds: uniqueStrings(input.targetCatIds || []),
    workerCatIds: uniqueStrings(input.workerCatIds || input.targetCatIds || []),
    workspaceId: firstText(input.workspaceId),
    projectGroupNo: firstText(input.projectGroupNo, input.groupNo),
    projectGroupName: firstText(input.projectGroupName, input.groupName),
    projectBindingId: firstText(input.projectBindingId, input.bindingId),
    projectThreadId: firstText(input.projectThreadId, input.threadId),
    projectHandoff: input.projectHandoff || null,
    reused: Boolean(input.reused),
    error: cardErrorText(input.error),
    updatedAt: input.updatedAt || Date.now()
  };
}

export function isProjectGroupConfirmationMessage(message = {}) {
  return message.type === 'project_group_confirmation'
    || message.contentType === 'project_group_confirmation'
    || message.metadata?.project_group_confirmation === true
    || message.projectGroupCard?.cardId;
}

export function createProjectGroupConfirmationMessage(input = {}) {
  const card = normalizeProjectGroupCard(input);
  return {
    id: card.cardId,
    clientMsgNo: card.cardId,
    type: 'project_group_confirmation',
    contentType: 'project_group_confirmation',
    senderId: card.coordinator.id,
    senderName: card.coordinator.name,
    senderAvatar: card.coordinator.avatar,
    content: projectGroupCardSummary(card),
    time: input.time || Date.now(),
    status: 'success',
    reactions: [],
    replyRef: null,
    mentions: [],
    projectGroupCard: card,
    metadata: {
      ...(input.metadata || {}),
      project_group_confirmation: true,
      projectGroupCard: card
    }
  };
}

export function upsertProjectGroupConfirmationMessage(list = [], input = {}) {
  const nextMessage = createProjectGroupConfirmationMessage(input);
  const next = [...list];
  const index = next.findIndex((message) => message.id === nextMessage.id || message.projectGroupCard?.cardId === nextMessage.id);
  if (index < 0) return [...next, nextMessage];
  const previous = next[index];
  const mergedCard = {
    ...(previous.projectGroupCard || {}),
    ...nextMessage.projectGroupCard,
    status: input.status || previous.projectGroupCard?.status || nextMessage.projectGroupCard.status,
    error: cardErrorText(input.error ?? previous.projectGroupCard?.error ?? nextMessage.projectGroupCard.error)
  };
  next[index] = {
    ...previous,
    ...nextMessage,
    time: previous.time || nextMessage.time,
    projectGroupCard: mergedCard,
    metadata: {
      ...(previous.metadata || {}),
      ...(nextMessage.metadata || {}),
      project_group_confirmation: true,
      projectGroupCard: mergedCard
    },
    content: projectGroupCardSummary(mergedCard)
  };
  return next;
}

export function updateProjectGroupConfirmationMessage(list = [], cardId = '', patch = {}) {
  const id = String(cardId || '').trim();
  if (!id) return list;
  return list.map((message) => {
    if (message.id !== id && message.projectGroupCard?.cardId !== id) return message;
    const mergedCard = {
      ...(message.projectGroupCard || {}),
      ...patch,
      cardId: message.projectGroupCard?.cardId || id,
      id,
      error: cardErrorText(patch.error ?? message.projectGroupCard?.error),
      updatedAt: patch.updatedAt || Date.now()
    };
    return {
      ...message,
      status: 'success',
      content: projectGroupCardSummary(mergedCard),
      projectGroupCard: mergedCard,
      metadata: {
        ...(message.metadata || {}),
        project_group_confirmation: true,
        projectGroupCard: mergedCard
      }
    };
  });
}
