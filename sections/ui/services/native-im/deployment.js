const DEPLOYMENT_INTENT_RE = /(部署|发布|上线|预览环境|preview|deploy|deployment)/i;
const DEPLOYMENT_NEGATIVE_RE = /(不部署|先不部署|别部署|不要部署|取消部署|暂不部署|不用部署)/i;
const PROJECT_KICKOFF_RE = /(项目群|创建项目|组织多智能体|多智能体分工|交付物|需求|约束|prd|预算|排期|readme)/i;
const ACTIONABLE_DEPLOYMENT_RE = /^(?:请|帮我|麻烦|开始|执行|现在|立即|同意|确认)?\s*(?:把|将)?[\s\S]{0,80}(?:部署|发布|上线|deploy)[\s\S]{0,80}(?:到|至|为|成|preview|预览环境|环境|线上)/i;
const CLOWDER_CAT_CONTACT_PREFIX = 'clowder_cat:';

function firstText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function cleanCatId(value = '') {
  return String(value || '').trim().replace(new RegExp(`^${CLOWDER_CAT_CONTACT_PREFIX}`), '');
}

function isClowderDirectConversation(conversation = {}) {
  const channelType = Number(conversation.channelType || conversation.channel_type || (conversation.type === 'group' ? 2 : 1));
  if (channelType === 2 || conversation.type === 'group') return false;
  return conversation.type === 'robot'
    || conversation.source === 'clowder'
    || Boolean(conversation.directCatId || conversation.direct_cat_id || conversation.catId || conversation.cat_id)
    || String(conversation.id || conversation.channelId || '').startsWith(CLOWDER_CAT_CONTACT_PREFIX);
}

function deploymentStatusLabel(status = '') {
  const value = String(status || '').toLowerCase();
  if (value === 'needs_fields') return '需要补充信息';
  if (value === 'submitting') return '提交中';
  if (value === 'confirmed' || value === 'queued') return '已排队';
  if (value === 'running') return '部署中';
  if (value === 'succeeded' || value === 'deployed') return '部署完成';
  if (value === 'failed') return '部署失败';
  if (value === 'cancelled' || value === 'canceled') return '已取消';
  return '待确认';
}

function deploymentCardSummary(card = {}) {
  const label = deploymentStatusLabel(card.status);
  const target = firstText(card.target, '待确认目标');
  if (card.status === 'failed') return `${label}：${firstText(card.failureReason, card.error, target)}`;
  if (card.status === 'cancelled' || card.status === 'canceled') return `已取消部署：${target}`;
  return `${label}：${target}`;
}

function normalizeDeploymentTimestamp(value) {
  const timestamp = Number(value || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return Date.now();
  return timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
}

export function normalizeDeploymentRequest(request = {}) {
  const raw = request.deploymentRequest || request.data?.deploymentRequest || request.data || request;
  const id = firstText(raw.id, raw.deploymentRequestId, raw.deployment_request_id);
  return {
    ...raw,
    id,
    deploymentRequestId: id,
    channelId: firstText(raw.channelId, raw.channel_id),
    channelType: Number(raw.channelType || raw.channel_type || 1),
    target: firstText(raw.target),
    environment: firstText(raw.environment),
    missingFields: Array.isArray(raw.missingFields) ? raw.missingFields : (Array.isArray(raw.missing_fields) ? raw.missing_fields : []),
    status: firstText(raw.status, 'pending_confirmation'),
    targetCandidates: Array.isArray(raw.targetCandidates) ? raw.targetCandidates : [],
    environmentCandidates: Array.isArray(raw.environmentCandidates) ? raw.environmentCandidates : [],
    deploymentJobId: firstText(raw.deploymentJobId, raw.deployment_job_id),
    previewUrl: firstText(raw.previewUrl, raw.preview_url),
    downloadUrl: firstText(raw.downloadUrl, raw.download_url),
    logsSummary: Array.isArray(raw.logsSummary) ? raw.logsSummary : (Array.isArray(raw.logs_summary) ? raw.logs_summary : []),
    failureReason: firstText(raw.failureReason, raw.failure_reason),
    createdAt: Number(raw.createdAt || raw.created_at || Date.now()),
    updatedAt: Number(raw.updatedAt || raw.updated_at || Date.now())
  };
}

function normalizeDeploymentCard(input = {}) {
  const deploymentRequest = normalizeDeploymentRequest(input.deploymentRequest || input);
  const sourceMessage = input.sourceMessage || {};
  const conversation = input.conversation || {};
  const agent = input.agent || {};
  const deploymentRequestId = firstText(deploymentRequest.id, deploymentRequest.deploymentRequestId, input.deploymentRequestId);
  const cardId = deploymentCardId(deploymentRequestId);
  const status = deploymentRequest.status || 'pending_confirmation';
  return {
    cardId,
    id: cardId,
    deploymentRequestId,
    deploymentJobId: deploymentRequest.deploymentJobId,
    status,
    statusLabel: deploymentStatusLabel(status),
    target: firstText(deploymentRequest.target, input.target, '待确认目标'),
    environment: firstText(deploymentRequest.environment, input.environment, 'preview'),
    originalText: firstText(deploymentRequest.originalText, deploymentRequest.original_text, input.originalText, sourceMessage.content),
    sourceMessageId: firstText(deploymentRequest.sourceMessageId, deploymentRequest.source_message_id, sourceMessage.messageId, sourceMessage.id),
    sourceClientMsgNo: firstText(sourceMessage.clientMsgNo, sourceMessage.client_msg_no),
    directChannelId: firstText(conversation.channelId, conversation.id, deploymentRequest.channelId),
    directChannelType: Number(conversation.channelType || conversation.channel_type || deploymentRequest.channelType || 1),
    catId: cleanCatId(firstText(agent.directCatId, agent.catId, agent.id, conversation.directCatId, conversation.catId, conversation.id)),
    catDisplayName: firstText(agent.name, agent.nickname, agent.displayName, conversation.name, 'Clowder'),
    previewUrl: deploymentRequest.previewUrl,
    downloadUrl: deploymentRequest.downloadUrl,
    logsSummary: deploymentRequest.logsSummary,
    failureReason: deploymentRequest.failureReason,
    missingFields: deploymentRequest.missingFields,
    targetCandidates: deploymentRequest.targetCandidates,
    environmentCandidates: deploymentRequest.environmentCandidates,
    deploymentRequest,
    updatedAt: Date.now()
  };
}

export function deploymentCardId(deploymentRequestId = '') {
  return `deployment-card-${String(deploymentRequestId || Date.now()).trim()}`;
}

export function isDeploymentIntent(text = '') {
  const source = String(text || '').trim();
  if (source.length < 3 || !DEPLOYMENT_INTENT_RE.test(source) || DEPLOYMENT_NEGATIVE_RE.test(source)) return false;
  if (!ACTIONABLE_DEPLOYMENT_RE.test(source)) return false;
  if (PROJECT_KICKOFF_RE.test(source) && !/^(?:请|帮我|麻烦|开始|执行|现在|立即|把|将|部署|发布|上线|deploy)/i.test(source)) return false;
  return true;
}

export function shouldCreateDeploymentCard({ conversation = {}, text = '' } = {}) {
  return isClowderDirectConversation(conversation) && isDeploymentIntent(text);
}

export function isDeploymentCardMessage(message = {}) {
  return message.type === 'deployment_card'
    || message.contentType === 'deployment_card'
    || message.metadata?.deployment_card === true
    || message.deploymentCard?.deploymentRequestId;
}

export function buildDeploymentCardMessage(input = {}, context = {}) {
  const card = normalizeDeploymentCard({
    deploymentRequest: input.deploymentRequest || input,
    ...context
  });
  return {
    id: card.cardId,
    clientMsgNo: card.cardId,
    type: 'deployment_card',
    contentType: 'deployment_card',
    senderId: card.catId || 'clowder',
    senderName: card.catDisplayName || 'Clowder',
    content: deploymentCardSummary(card),
    time: normalizeDeploymentTimestamp(card.deploymentRequest.createdAt),
    status: 'success',
    reactions: [],
    replyRef: null,
    mentions: [],
    deploymentCard: card,
    metadata: {
      deployment_card: true,
      deploymentCard: card
    }
  };
}

export function upsertDeploymentCardMessage(list = [], input = {}) {
  const nextMessage = buildDeploymentCardMessage(input.deploymentRequest || input, input);
  const next = [...list];
  const index = next.findIndex((message) => (
    message.id === nextMessage.id
    || message.deploymentCard?.deploymentRequestId === nextMessage.deploymentCard.deploymentRequestId
  ));
  if (index < 0) return [...next, nextMessage];
  const previous = next[index];
  const mergedCard = {
    ...(previous.deploymentCard || {}),
    ...nextMessage.deploymentCard,
    downloadUrl: nextMessage.deploymentCard.downloadUrl || previous.deploymentCard?.downloadUrl || '',
    previewUrl: nextMessage.deploymentCard.previewUrl || previous.deploymentCard?.previewUrl || ''
  };
  next[index] = {
    ...previous,
    ...nextMessage,
    time: previous.time || nextMessage.time,
    deploymentCard: mergedCard,
    metadata: {
      ...(previous.metadata || {}),
      deployment_card: true,
      deploymentCard: mergedCard
    },
    content: deploymentCardSummary(mergedCard)
  };
  return next;
}

export function updateDeploymentCardMessage(list = [], cardId = '', patch = {}) {
  const id = String(cardId || '').trim();
  if (!id) return list;
  return list.map((message) => {
    if (message.id !== id && message.deploymentCard?.cardId !== id && message.deploymentCard?.deploymentRequestId !== id) {
      return message;
    }
    const mergedCard = {
      ...(message.deploymentCard || {}),
      ...patch,
      cardId: message.deploymentCard?.cardId || id,
      id: message.deploymentCard?.id || id,
      status: patch.status || message.deploymentCard?.status || 'pending_confirmation',
      downloadUrl: patch.downloadUrl || message.deploymentCard?.downloadUrl || '',
      previewUrl: patch.previewUrl || message.deploymentCard?.previewUrl || '',
      failureReason: firstText(patch.failureReason, patch.error, message.deploymentCard?.failureReason),
      updatedAt: patch.updatedAt || Date.now()
    };
    mergedCard.statusLabel = deploymentStatusLabel(mergedCard.status);
    return {
      ...message,
      status: 'success',
      content: deploymentCardSummary(mergedCard),
      deploymentCard: mergedCard,
      metadata: {
        ...(message.metadata || {}),
        deployment_card: true,
        deploymentCard: mergedCard
      }
    };
  });
}

export function deploymentFailedPatch(error = '') {
  return {
    status: 'failed',
    failureReason: firstText(error?.msg, error?.message, error?.error, error, '部署操作失败')
  };
}
