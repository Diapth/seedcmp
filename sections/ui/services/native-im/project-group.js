const PROJECT_START_RE = /(项目群|创建.*群|拉.*(?:猫|智能体|agent|codex|claude)|拆解.*任务|分工执行|协调.*(?:智能体|agent|codex|claude)|PM|pm|coordinator)/i;

const PROJECT_NAME_PATTERNS = [
  /项目名称(?:叫|为|是)?\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,40})/i,
  /项目名(?:叫|为|是)?\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,40})/i,
  /项目叫\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,40})/i,
  /群(?:名|名称)(?:叫|为|是)?\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,40})/i
];

const PROJECT_GROUP_CONFIRM_EXACT = new Set([
  '确认',
  '同意',
  '批准',
  '可以',
  '可以的',
  '好',
  '好的',
  '行',
  '行吧',
  '没问题',
  '创建吧',
  '建群吧',
  '拉群吧',
  '可以创建吧',
  '可以建群吧',
  '就这样',
  '就按这个来',
  '按这个来',
  '按这个建群',
  '按这个创建',
  '继续',
  '继续创建',
  '继续建群',
  'ok',
  'okay',
  'yes',
  'yep'
]);

const PROJECT_GROUP_CANCEL_RE = /(不建|别建|不用建|不要建|先不要|先别|取消|算了|暂停|驳回|拒绝|不同意|不批准|不可以|不用了|别拉|不要拉)/i;
const PROJECT_GROUP_RECOVER_RE = /(重新|重发|再发).*(发|给|来|一下)|找不到.*(?:按钮|卡片)|(?:按钮|卡片).*(?:没|不见|丢|失效|不可用)/i;
const PROJECT_GROUP_CONFIRM_RE = /(?:确认|同意|批准|可以|按这个|就这样|继续).*(?:建群|创建|拉群|项目群|全员群)/i;
const PROJECT_GROUP_PROPOSAL_RE = /(项目群|全员群|创建.*群|建群|拉群|拉.*(?:猫|智能体|agent|codex|claude)|分工执行|协调.*(?:智能体|agent|codex|claude))/i;
const PENDING_PROJECT_GROUP_STATUSES = new Set(['', 'pending', 'pending_confirmation', 'failed']);

const CLOWDER_CAT_CONTACT_PREFIX = 'clowder_cat:';
const COORDINATOR_KEYWORDS = [
  'coordinator',
  'pm',
  'projectmanager',
  'productmanager',
  'clowder',
  '协调者',
  '协同',
  '项目经理',
  '产品经理',
  '项目管理'
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

function resolveThreadId(source = {}) {
  const binding = source.binding || {};
  const raw = source.raw || {};
  return firstText(
    source.projectThreadId,
    source.project_thread_id,
    source.threadId,
    source.thread_id,
    source.directThreadId,
    source.direct_thread_id,
    source.clowderThreadId,
    source.clowder_thread_id,
    binding.projectThreadId,
    binding.project_thread_id,
    binding.threadId,
    binding.thread_id,
    raw.projectThreadId,
    raw.project_thread_id,
    raw.threadId,
    raw.thread_id,
    raw.binding?.projectThreadId,
    raw.binding?.project_thread_id,
    raw.binding?.threadId,
    raw.binding?.thread_id
  );
}

function cleanProjectName(value = '') {
  return String(value || '')
    .trim()
    .replace(/^(?:叫|为|是|：|:)\s*/, '')
    .replace(/[」』”"']+$/g, '')
    .trim();
}

function cleanCatId(value = '') {
  return String(value || '').trim().replace(new RegExp(`^${CLOWDER_CAT_CONTACT_PREFIX}`), '');
}

function normalizeKeyword(value = '') {
  return cleanCatId(value)
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[\s_\-:：/]+/g, '')
    .replace(/智能体|agent|ai/g, '');
}

function compactIntentText(text = '') {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[\s，,。.!！?？；;：:、"'“”‘’「」『』（）()【】[\]{}<>《》-]+/g, '');
}

function messageText(message = {}) {
  return firstText(message.content, message.text, message.payload?.content, message.raw?.content);
}

function messageStatus(message = {}) {
  return String(message.projectGroupCard?.status || message.status || '').trim().toLowerCase();
}

function isPendingProjectGroupMessage(message = {}) {
  if (!isProjectGroupConfirmationMessage(message)) return false;
  const status = String(message.projectGroupCard?.status || '').trim().toLowerCase();
  return PENDING_PROJECT_GROUP_STATUSES.has(status);
}

function proposalText(message = {}) {
  const card = message.proposalCard || {};
  const fields = Array.isArray(card.fields)
    ? card.fields.map((field = {}) => `${firstText(field.label)} ${firstText(field.value)}`)
    : [];
  return [
    message.content,
    card.title,
    card.bodyMarkdown,
    card.description,
    ...fields
  ].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
}

function isPendingProjectGroupProposal(message = {}) {
  const card = message.proposalCard || {};
  const proposalId = firstText(card.proposalId, card.id);
  if (!proposalId) return false;
  const status = String(card.status || message.status || 'pending').trim().toLowerCase();
  if (!PENDING_PROJECT_GROUP_STATUSES.has(status)) return false;
  return PROJECT_GROUP_PROPOSAL_RE.test(proposalText(message));
}

function keywordValues(entity = {}) {
  const raw = entity.raw || {};
  return [
    entity.id,
    entity.uid,
    entity.catId,
    entity.cat_id,
    entity.directCatId,
    entity.direct_cat_id,
    entity.agentId,
    entity.agent_id,
    entity.name,
    entity.nickname,
    entity.displayName,
    entity.alias,
    entity.roleTemplate,
    entity.roleTemplateId,
    entity.templateId,
    entity.template_id,
    raw.id,
    raw.catId,
    raw.cat_id,
    raw.roleTemplate,
    raw.roleTemplateId,
    raw.templateId
  ];
}

function isCoordinatorEntity(entity = {}) {
  const haystack = keywordValues(entity).map(normalizeKeyword).filter(Boolean);
  return haystack.some((value) => COORDINATOR_KEYWORDS.some((keyword) => value.includes(keyword)));
}

function isDirectAgentConversation(conversation = {}) {
  const channelType = Number(conversation.channelType || conversation.channel_type || (conversation.type === 'group' ? 2 : 1));
  if (channelType === 2 || conversation.type === 'group') return false;
  return conversation.type === 'robot'
    || conversation.source === 'clowder'
    || Boolean(conversation.directCatId || conversation.direct_cat_id)
    || String(conversation.id || conversation.channelId || '').startsWith(CLOWDER_CAT_CONTACT_PREFIX);
}

function agentCatId(agent = {}) {
  return cleanCatId(firstText(agent.directCatId, agent.direct_cat_id, agent.catId, agent.cat_id, agent.id, agent.uid));
}

function isAvailableWorkerAgent(agent = {}) {
  if (!agentCatId(agent)) return false;
  if (isCoordinatorEntity(agent)) return false;
  if (agent.available === false || agent.connected === false) return false;
  return !['inactive', 'disabled', 'unavailable'].includes(String(agent.status || '').toLowerCase());
}

function mentionedWorkerIds(text = '', agents = []) {
  const normalizedText = normalizeKeyword(text);
  return uniqueStrings(agents.filter(isAvailableWorkerAgent).filter((agent) => {
    const candidates = keywordValues(agent)
      .map(normalizeKeyword)
      .filter((value) => value && value.length >= 2);
    return candidates.some((value) => normalizedText.includes(value) || value.includes(normalizedText));
  }).map(agentCatId));
}

function defaultWorkerIds(agents = []) {
  return uniqueStrings(agents.filter(isAvailableWorkerAgent).map(agentCatId)).slice(0, 3);
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

export function shouldCreateProjectGroupConfirmation({ conversation = {}, agent = {}, text = '' } = {}) {
  return isProjectStartRequest(text)
    && isDirectAgentConversation(conversation)
    && (isCoordinatorEntity(agent) || isCoordinatorEntity(conversation));
}

export function buildProjectGroupConfirmationInput({
  conversation = {},
  agent = {},
  sourceMessage = {},
  text = '',
  currentUser = {},
  availableAgents = []
} = {}) {
  const pmDirectChannelId = firstText(conversation.channelId, conversation.id);
  const coordinatorId = agentCatId(agent) || agentCatId(conversation) || 'coordinator';
  const targetCatIds = mentionedWorkerIds(text || sourceMessage.content, availableAgents);
  const workerCatIds = targetCatIds.length ? targetCatIds : defaultWorkerIds(availableAgents);
  const userId = firstText(currentUser.id, currentUser.uid, currentUser.userId, currentUser.raw?.uid, currentUser.raw?.id);
  const threadId = resolveThreadId(conversation) || resolveThreadId(agent);
  return {
    sourceMessage,
    sourceText: firstText(text, sourceMessage.content),
    projectName: resolveProjectGroupName(text || sourceMessage.content, conversation.name || agent.name || 'Clowder'),
    pmDirectChannelId,
    pmDirectChannelType: Number(conversation.channelType || conversation.channel_type || 1),
    pmDirectThreadId: threadId,
    projectThreadId: threadId,
    pmMemberId: coordinatorId ? `${CLOWDER_CAT_CONTACT_PREFIX}${coordinatorId}` : CLOWDER_CAT_CONTACT_PREFIX + 'coordinator',
    userMemberIds: userId ? [userId] : [],
    catMemberIds: uniqueStrings([coordinatorId, ...workerCatIds]),
    targetCatIds: workerCatIds,
    workerCatIds,
    coordinator: {
      id: coordinatorId,
      name: firstText(agent.name, agent.nickname, conversation.name, 'PM / 协调者'),
      avatar: firstText(agent.avatar, conversation.avatar)
    }
  };
}

function cardErrorText(error = '') {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return firstText(error.msg, error.message, error.error, '项目群创建失败');
}

function proposalErrorText(error = '') {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return firstText(error.msg, error.message, error.error, '提案处理失败');
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

export function isProjectGroupTextCancelIntent(text = '') {
  const source = String(text || '').trim();
  return Boolean(source && PROJECT_GROUP_CANCEL_RE.test(source));
}

export function isProjectGroupTextRecoverIntent(text = '') {
  const source = String(text || '').trim();
  return Boolean(source && PROJECT_GROUP_RECOVER_RE.test(source));
}

export function isProjectGroupTextConfirmIntent(text = '') {
  const source = String(text || '').trim();
  if (!source || isProjectGroupTextCancelIntent(source)) return false;
  const compact = compactIntentText(source);
  return PROJECT_GROUP_CONFIRM_EXACT.has(compact)
    || PROJECT_GROUP_CONFIRM_RE.test(source)
    || isProjectGroupTextRecoverIntent(source);
}

export function findPendingProjectGroupConfirmation(messages = []) {
  const list = Array.isArray(messages) ? messages : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const message = list[index] || {};
    if (isPendingProjectGroupMessage(message)) return message;
  }
  return null;
}

export function findRecoverableProjectGroupContext({
  messages = [],
  conversation = {},
  agent = {}
} = {}) {
  const list = Array.isArray(messages) ? messages : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const message = list[index] || {};
    if (isProjectGroupConfirmationMessage(message)) continue;
    const text = messageText(message);
    if (!text || messageStatus(message) === 'failed') continue;
    if (!shouldCreateProjectGroupConfirmation({ conversation, agent, text })) continue;
    return {
      message,
      sourceMessage: message,
      sourceText: text
    };
  }
  return null;
}

export function findPendingProjectGroupProposal(messages = []) {
  const list = Array.isArray(messages) ? messages : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const message = list[index] || {};
    if (isPendingProjectGroupProposal(message)) return message;
  }
  return null;
}

export function resolveProjectGroupTextConfirmation({
  text = '',
  messages = [],
  conversation = {},
  agent = {}
} = {}) {
  const hasCancelIntent = isProjectGroupTextCancelIntent(text);
  const hasConfirmIntent = isProjectGroupTextConfirmIntent(text);
  if (!hasCancelIntent && !hasConfirmIntent) return null;

  const pendingMessage = findPendingProjectGroupConfirmation(messages);
  if (pendingMessage) {
    const cardId = firstText(pendingMessage.projectGroupCard?.cardId, pendingMessage.id);
    return {
      action: hasCancelIntent ? 'cancel' : 'confirm',
      intent: hasCancelIntent ? 'cancel' : (isProjectGroupTextRecoverIntent(text) ? 'recover' : 'confirm'),
      cardId,
      message: pendingMessage,
      card: pendingMessage.projectGroupCard || {}
    };
  }

  const pendingProposal = findPendingProjectGroupProposal(messages);
  if (pendingProposal) {
    const proposalId = firstText(pendingProposal.proposalCard?.proposalId, pendingProposal.proposalCard?.id);
    return {
      action: hasCancelIntent ? 'reject_proposal' : 'approve_proposal',
      intent: hasCancelIntent ? 'cancel' : (isProjectGroupTextRecoverIntent(text) ? 'recover' : 'confirm'),
      proposalId,
      message: pendingProposal,
      proposalCard: pendingProposal.proposalCard || {}
    };
  }

  const recoverable = findRecoverableProjectGroupContext({ messages, conversation, agent });
  if (!recoverable) return null;
  return {
    action: hasCancelIntent ? 'cancel_context' : 'create_and_confirm',
    intent: hasCancelIntent ? 'cancel' : (isProjectGroupTextRecoverIntent(text) ? 'recover' : 'confirm'),
    ...recoverable
  };
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

export function updateProjectGroupProposalMessage(list = [], proposalId = '', patch = {}) {
  const id = String(proposalId || '').trim();
  if (!id) return list;
  return list.map((message) => {
    const card = message.proposalCard || {};
    const currentProposalId = firstText(card.proposalId, card.id);
    if (message.id !== id && currentProposalId !== id) return message;
    const mergedCard = {
      ...card,
      ...patch,
      proposalId: currentProposalId || id,
      id: card.id || `proposal-${currentProposalId || id}`,
      error: proposalErrorText(patch.error ?? card.error),
      updatedAt: patch.updatedAt || Date.now()
    };
    return {
      ...message,
      status: 'success',
      proposalCard: mergedCard,
      metadata: {
        ...(message.metadata || {}),
        project_group_text_fallback: true,
        proposalCard: mergedCard
      }
    };
  });
}

export function buildProjectGroupEnsurePayload(card = {}, options = {}) {
  const currentUser = options.currentUser || {};
  const userId = firstText(currentUser.id, currentUser.uid, currentUser.userId, currentUser.raw?.uid, currentUser.raw?.id);
  const payload = {
    projectName: firstText(card.projectName, card.projectGroupName, 'Clowder 项目群'),
    workspaceId: firstText(card.workspaceId),
    pmDirectChannelId: firstText(card.pmDirectChannelId),
    pmDirectChannelType: Number(card.pmDirectChannelType || 1),
    pmDirectThreadId: firstText(card.pmDirectThreadId),
    projectThreadId: firstText(card.projectThreadId),
    pmMemberId: firstText(card.pmMemberId, card.coordinator?.id ? `${CLOWDER_CAT_CONTACT_PREFIX}${cleanCatId(card.coordinator.id)}` : ''),
    userMemberIds: uniqueStrings([...(card.userMemberIds || []), userId]),
    catMemberIds: uniqueStrings([...(card.catMemberIds || []), ...(card.targetCatIds || []), ...(card.workerCatIds || [])]),
    createdBy: firstText(card.createdBy, 'user')
  };
  Object.keys(payload).forEach((key) => {
    if (payload[key] === '' || payload[key] === undefined || payload[key] === null) delete payload[key];
    if (Array.isArray(payload[key]) && payload[key].length === 0) delete payload[key];
  });
  return payload;
}

export function projectGroupCreatedPatch(resp = {}, card = {}) {
  const binding = resp.binding || resp.data?.binding || resp.data || resp;
  const groupNo = firstText(binding.projectGroupNo, binding.project_group_no, binding.groupNo, binding.group_no, card.projectGroupNo);
  const projectName = firstText(binding.projectName, binding.project_name, binding.name, card.projectGroupName, card.projectName);
  return {
    status: 'created',
    projectGroupNo: groupNo,
    projectGroupName: projectName,
    projectBindingId: firstText(binding.id, binding.bindingId, binding.binding_id, card.projectBindingId),
    projectThreadId: firstText(binding.projectThreadId, binding.project_thread_id, binding.threadId, binding.thread_id, card.projectThreadId),
    catMemberIds: uniqueStrings(binding.catMemberIds || binding.cat_member_ids || card.catMemberIds || []),
    reused: Boolean(resp.reused ?? resp.data?.reused ?? binding.reused ?? card.reused),
    error: ''
  };
}

export function projectGroupFailedPatch(error = '') {
  return {
    status: 'failed',
    error: cardErrorText(error)
  };
}
