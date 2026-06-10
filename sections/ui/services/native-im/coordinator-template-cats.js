// Coordinator template cats request: builds the user-confirmation card for
// missing template cats, derives creation profile from the coordinator
// agent, and tracks card state machine.

import { findMissingRoles, scanExistingCats, detectRequiredCapabilityProfile } from './coordinator-capability.js';

const CLOWDER_CAT_CONTACT_PREFIX = 'clowder_cat:';
const CARD_KEY_PREFIX = 'coordinator-template-cats-card';

function firstText(...values) {
 for (const value of values) {
 if (value === undefined || value === null) continue;
 const text = String(value).trim();
 if (text) return text;
 }
 return '';
}

function uniqueStrings(values = []) {
 return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function oauthProviderForPlatform(platform = '') {
 const value = firstText(platform).toLowerCase();
 if (value.includes('claude') || value.includes('anthropic')) return 'claude';
 if (value.includes('gemini') || value.includes('google')) return 'gemini';
 return 'codex';
}

function defaultClientIdForPlatform(platform = '') {
 const value = firstText(platform).toLowerCase();
 if (value.includes('claude') || value.includes('anthropic')) return 'anthropic';
 if (value.includes('gemini') || value.includes('google')) return 'google';
 return 'openai';
}

function cleanCatId(value = '') {
 return String(value || '').trim().replace(new RegExp(`^${CLOWDER_CAT_CONTACT_PREFIX}`), '');
}

function cardErrorText(error = '') {
 if (!error) return '';
 if (typeof error === 'string') return error;
 return firstText(error.msg, error.message, error.error, '创建模板猫猫失败');
}

function findTemplateByRoleId(templates = [], roleTemplateId = '') {
 const target = String(roleTemplateId || '').trim();
 if (!target) return null;
 return templates.find((template) => (
 String(template.id || '').trim() === target
 || String(template.roleTemplateId || '').trim() === target
 || String(template.templateId || '').trim() === target
 )) || null;
}

function summarizeReason(template = null, roleTemplateId = '') {
 if (!template) return `未找到匹配 ${roleTemplateId} 的模板`;
 const teamStrengths = firstText(template.teamStrengths, template.team_strengths, template.roleDescription, template.role_description);
 return teamStrengths ? `匹配能力：${teamStrengths}` : '匹配当前需求所需能力';
}

function summarizeProfileLabel(profile = null) {
 return firstText(profile?.label, profile?.id, '协调者能力盘点');
}

function buildRequestItems({ missingRoleTemplateIds = [], templates = [] } = {}) {
 return missingRoleTemplateIds.map((roleTemplateId) => {
 const template = findTemplateByRoleId(templates, roleTemplateId);
 return {
 templateId: firstText(template?.id, template?.roleTemplateId, roleTemplateId),
 roleTemplateId,
 name: firstText(template?.name, template?.nickname, roleTemplateId),
 nickname: firstText(template?.nickname),
 alias: firstText(template?.alias),
 aliases: Array.isArray(template?.aliases) ? uniqueStrings(template.aliases) : [],
 avatar: firstText(template?.avatar),
 reason: summarizeReason(template, roleTemplateId),
 capabilities: uniqueStrings([
 ...(Array.isArray(template?.capabilityTags) ? template.capabilityTags : []),
 ...(Array.isArray(template?.capabilities) ? template.capabilities : [])
 ]),
 personality: firstText(template?.personality, template?.systemPrompt),
 status: 'pending',
 agentId: '',
 error: ''
 };
 }).filter((item) => item.templateId);
}

function summarizeCard(card = {}) {
 const profile = card.requiredProfile;
 const profileLabel = summarizeProfileLabel(profile);
 const totals = (card.items || []).reduce((acc, item) => {
 acc.total += 1;
 if (item.status === 'created') acc.created += 1;
 else if (item.status === 'failed') acc.failed += 1;
 else if (item.status === 'creating') acc.creating += 1;
 return acc;
 }, { total: 0, created: 0, failed: 0, creating: 0 });

 if (card.status === 'created') return `已创建 ${totals.created}/${totals.total} 个缺失模板猫猫（${profileLabel}）`;
 if (card.status === 'partial') return `部分创建：${totals.created}/${totals.total} 成功，${totals.failed} 失败（${profileLabel}）`;
 if (card.status === 'failed') return `缺失模板猫猫创建失败（${profileLabel}）`;
 if (card.status === 'cancelled') return `已取消创建缺失模板猫猫（${profileLabel}）`;
 if (card.status === 'creating') return `正在创建 ${totals.total} 个缺失模板猫猫（${profileLabel}）`;
 return `协调者盘点：建议创建 ${totals.total} 个缺失模板猫猫（${profileLabel}）`;
}

function normalizeCard(input = {}) {
 const sourceMessage = input.sourceMessage || {};
 const cardId = firstText(input.cardId, input.id, buildCoordinatorTemplateCatsCardId(sourceMessage));
 const status = firstText(input.status, 'pending_confirmation');
 const items = Array.isArray(input.items) ? input.items.map((item) => ({
 templateId: firstText(item.templateId, item.roleTemplateId),
 roleTemplateId: firstText(item.roleTemplateId, item.templateId),
 name: firstText(item.name, item.roleTemplateId, item.templateId),
 nickname: firstText(item.nickname),
 alias: firstText(item.alias),
 aliases: Array.isArray(item.aliases) ? uniqueStrings(item.aliases) : [],
 avatar: firstText(item.avatar),
 reason: firstText(item.reason),
 capabilities: Array.isArray(item.capabilities) ? [...item.capabilities] : [],
 personality: firstText(item.personality),
 status: firstText(item.status, 'pending'),
 agentId: firstText(item.agentId),
 error: cardErrorText(item.error)
 })) : [];

 return {
 cardId,
 id: cardId,
 status,
 sourceMessageId: firstText(input.sourceMessageId, sourceMessage.messageId, sourceMessage.id),
 sourceClientMsgNo: firstText(input.sourceClientMsgNo, sourceMessage.clientMsgNo, sourceMessage.client_msg_no),
 sourceText: firstText(input.sourceText, sourceMessage.content),
 pmDirectChannelId: firstText(input.pmDirectChannelId, input.channelId),
 pmDirectChannelType: Number(input.pmDirectChannelType || input.channelType || 1),
 coordinator: {
 id: firstText(input.coordinator?.id, input.coordinatorId, 'coordinator'),
 name: firstText(input.coordinator?.name, input.coordinatorName, 'PM / 协调者'),
 avatar: firstText(input.coordinator?.avatar, input.coordinatorAvatar)
 },
 requiredProfile: input.requiredProfile ? {
 id: firstText(input.requiredProfile.id),
 label: firstText(input.requiredProfile.label),
 roleTemplateIds: uniqueStrings(input.requiredProfile.roleTemplateIds || [])
 } : null,
 reusableCats: Array.isArray(input.reusableCats) ? input.reusableCats.map((cat) => ({
 id: firstText(cat.id),
 name: firstText(cat.name, cat.id),
 roleTemplate: firstText(cat.roleTemplate),
 matchedRole: firstText(cat.matchedRole)
 })) : [],
 items,
 coordinatorProfile: input.coordinatorProfile || null,
 error: cardErrorText(input.error),
 updatedAt: input.updatedAt || Date.now()
 };
}

export function buildCoordinatorTemplateCatsCardId(sourceMessage = {}) {
 const id = firstText(sourceMessage.id, sourceMessage.messageId, sourceMessage.clientMsgNo, sourceMessage.client_msg_no, Date.now());
 return `${CARD_KEY_PREFIX}:${id}`;
}

export function resolveCoordinatorCreationProfile(coordinator = {}) {
 const raw = coordinator.raw || {};
 const platform = firstText(coordinator.platform, raw.platform, 'clowder');
 const accessModeRaw = firstText(coordinator.accessMode, coordinator.authType, raw.accessMode, raw.authType, '').toLowerCase();
 const accessMode = accessModeRaw === 'oauth' ? 'oauth' : (accessModeRaw === 'api-key' || accessModeRaw === 'api_key' ? 'api-key' : '');
 const clientId = firstText(coordinator.clientId, raw.clientId, defaultClientIdForPlatform(platform));
 const provider = oauthProviderForPlatform(platform);
 const providerLabel = provider === 'claude' ? 'Claude Code' : provider === 'gemini' ? 'Gemini CLI' : 'Codex';
 const accountRef = firstText(
 coordinator.accountRef,
 raw.accountRef,
 accessMode === 'oauth' ? provider : 'default'
 );
 const defaultModel = firstText(
 coordinator.defaultModel,
 coordinator.model,
 coordinator.customModel,
 raw.defaultModel,
 raw.model
 );
 const systemPrompt = firstText(coordinator.systemPrompt, coordinator.personality, coordinator.desc, raw.systemPrompt, raw.personality, raw.desc);
 const inheritsFromCoordinator = Boolean(accessMode)
 && Boolean(firstText(coordinator.id, coordinator.catId, coordinator.uid, raw.id));
 const source = accessMode ? 'coordinator-derived' : 'undetermined';
 return {
 platform,
 clientId,
 provider,
 providerLabel,
 accessMode,
 authType: accessMode === 'oauth' ? 'oauth' : (accessMode ? 'api_key' : ''),
 accountRef,
 defaultModel,
 systemPrompt,
 capabilityTags: uniqueStrings([
 ...(Array.isArray(coordinator.capabilityTags) ? coordinator.capabilityTags : []),
 ...(Array.isArray(raw.capabilityTags) ? raw.capabilityTags : [])
 ]),
 coordinatorId: firstText(coordinator.id, coordinator.catId, coordinator.uid, raw.id, 'coordinator'),
 coordinatorName: firstText(coordinator.name, coordinator.nickname, raw.name, 'PM / 协调者'),
 inheritsFromCoordinator,
 source
 };
}

export function buildAgentPayloadFromTemplate(template = {}, coordinatorProfile = {}, options = {}) {
 const profile = coordinatorProfile || {};
 const roleTemplateId = firstText(template.id, template.roleTemplateId, template.templateId, 'general');
 const displayName = firstText(template.name, template.nickname, options.name, roleTemplateId);
 const aliases = Array.isArray(template.aliases) ? template.aliases : [];
 const alias = firstText(template.alias, aliases[0], options.alias, displayName);
 const capabilities = uniqueStrings([
 ...(Array.isArray(template.capabilityTags) ? template.capabilityTags : []),
 ...(Array.isArray(template.capabilities) ? template.capabilities : []),
 ...(Array.isArray(profile.capabilityTags) ? profile.capabilityTags : [])
 ]);
 const base = {
 name: displayName,
 alias,
 roleTemplateId,
 templateId: roleTemplateId,
 platform: firstText(options.platform, profile.platform, 'clowder'),
 clientId: firstText(options.clientId, profile.clientId, defaultClientIdForPlatform(profile.platform)),
 accessMode: profile.accessMode || '',
 authType: profile.authType || '',
 accountRef: firstText(options.accountRef, profile.accountRef, profile.accessMode === 'oauth' ? oauthProviderForPlatform(profile.platform) : 'default'),
 capabilities,
 personality: firstText(template.personality, template.systemPrompt, profile.systemPrompt, options.personality)
 };

 if (profile.accessMode === 'oauth') {
 base.accessMode = 'oauth';
 base.authType = 'oauth';
 base.inheritCoordinatorAuth = true;
 } else if (profile.accessMode === 'api-key') {
 base.accessMode = 'api-key';
 base.authType = 'api_key';
 }
 if (base.accessMode !== 'oauth' && profile.defaultModel) {
 base.defaultModel = profile.defaultModel;
 }
 return base;
}

export function isCoordinatorTemplateCatsConfirmationMessage(message = {}) {
 return message?.type === 'coordinator_template_cats_request'
 || message?.contentType === 'coordinator_template_cats_request'
 || message?.metadata?.coordinator_template_cats_request === true
 || Boolean(message?.coordinatorTemplateCatsCard?.cardId);
}

export function shouldCreateCoordinatorTemplateCatsRequest({ conversation = {}, agent = {}, text = '' } = {}) {
 const channelType = Number(conversation.channelType || conversation.channel_type || 0);
 if (channelType === 2 || conversation.type === 'group') return false;
 const isClowderConversation = conversation.type === 'robot'
 || conversation.source === 'clowder'
 || Boolean(conversation.directCatId || conversation.direct_cat_id)
 || String(conversation.id || conversation.channelId || '').startsWith(CLOWDER_CAT_CONTACT_PREFIX);
 if (!isClowderConversation) return false;
 const haystack = uniqueStrings([
 agent.roleTemplate,
 agent.templateId,
 agent.roleTemplateId,
 agent.alias,
 agent.name,
 conversation.directCatId,
 conversation.direct_cat_id,
 conversation.name
 ]).join(' ').toLowerCase();
 if (!haystack.trim()) return false;
 const coordinatorKeywords = ['coordinator', 'pm', 'projectmanager', 'productmanager', 'clowder', '协调', '协同', '项目经理', '产品经理'];
 return coordinatorKeywords.some((keyword) => haystack.includes(keyword));
}

export function buildCoordinatorTemplateCatsRequestInput({
 conversation = {},
 coordinator = {},
 sourceMessage = {},
 text = '',
 availableAgents = [],
 templates = []
} = {}) {
 const requiredProfile = detectRequiredCapabilityProfile(text || sourceMessage.content);
 const reusable = scanExistingCats({ requiredProfile, availableAgents });
 const missingRoleIds = findMissingRoles({ requiredProfile, availableAgents });
 const items = buildRequestItems({ missingRoleTemplateIds: missingRoleIds, templates });
 const coordinatorProfile = resolveCoordinatorCreationProfile(coordinator);

 return {
 sourceMessage,
 sourceText: firstText(text, sourceMessage.content),
 pmDirectChannelId: firstText(conversation.channelId, conversation.id),
 pmDirectChannelType: Number(conversation.channelType || conversation.channel_type || 1),
 coordinator: {
 id: firstText(coordinator.id, coordinator.catId, coordinator.uid, conversation.directCatId, 'coordinator'),
 name: firstText(coordinator.name, coordinator.nickname, conversation.name, 'PM / 协调者'),
 avatar: firstText(coordinator.avatar, conversation.avatar)
 },
 coordinatorProfile,
 requiredProfile,
 reusableCats: reusable,
 items,
 status: 'pending_confirmation'
 };
}

export function createCoordinatorTemplateCatsMessage(input = {}) {
 const card = normalizeCard(input);
 return {
 id: card.cardId,
 clientMsgNo: card.cardId,
 type: 'coordinator_template_cats_request',
 contentType: 'coordinator_template_cats_request',
 senderId: card.coordinator.id,
 senderName: card.coordinator.name,
 senderAvatar: card.coordinator.avatar,
 content: summarizeCard(card),
 time: input.time || Date.now(),
 status: 'success',
 reactions: [],
 replyRef: null,
 mentions: [],
 coordinatorTemplateCatsCard: card,
 metadata: {
 ...(input.metadata || {}),
 coordinator_template_cats_request: true,
 coordinatorTemplateCatsCard: card
 }
 };
}

export function upsertCoordinatorTemplateCatsMessage(list = [], input = {}) {
 const nextMessage = createCoordinatorTemplateCatsMessage(input);
 const next = [...list];
 const index = next.findIndex((message) => (
 message.id === nextMessage.id
 || message.coordinatorTemplateCatsCard?.cardId === nextMessage.id
 ));
 if (index < 0) return [...next, nextMessage];

 const previous = next[index];
 const mergedCard = {
 ...(previous.coordinatorTemplateCatsCard || {}),
 ...nextMessage.coordinatorTemplateCatsCard,
 status: input.status || previous.coordinatorTemplateCatsCard?.status || nextMessage.coordinatorTemplateCatsCard.status,
 items: nextMessage.coordinatorTemplateCatsCard.items.length
 ? nextMessage.coordinatorTemplateCatsCard.items
 : (previous.coordinatorTemplateCatsCard?.items || []),
 error: cardErrorText(input.error ?? previous.coordinatorTemplateCatsCard?.error ?? nextMessage.coordinatorTemplateCatsCard.error)
 };
 next[index] = {
 ...previous,
 ...nextMessage,
 time: previous.time || nextMessage.time,
 coordinatorTemplateCatsCard: mergedCard,
 metadata: {
 ...(previous.metadata || {}),
 ...(nextMessage.metadata || {}),
 coordinator_template_cats_request: true,
 coordinatorTemplateCatsCard: mergedCard
 },
 content: summarizeCard(mergedCard)
 };
 return next;
}

export function updateCoordinatorTemplateCatsMessage(list = [], cardId = '', patch = {}) {
 const id = String(cardId || '').trim();
 if (!id) return list;

 return list.map((message) => {
 if (message.id !== id && message.coordinatorTemplateCatsCard?.cardId !== id) return message;

 const previousItems = message.coordinatorTemplateCatsCard?.items || [];
 const incomingItems = Array.isArray(patch.items) ? patch.items : null;
 const mergedItems = incomingItems
 ? incomingItems.map((item) => {
 const prev = previousItems.find((entry) => entry.templateId === item.templateId || entry.roleTemplateId === item.roleTemplateId);
 return {
 templateId: firstText(item.templateId, item.roleTemplateId, prev?.templateId),
 roleTemplateId: firstText(item.roleTemplateId, item.templateId, prev?.roleTemplateId),
 name: firstText(item.name, prev?.name, item.templateId, item.roleTemplateId),
 nickname: firstText(item.nickname, prev?.nickname),
 avatar: firstText(item.avatar, prev?.avatar),
 reason: firstText(item.reason, prev?.reason),
 capabilities: Array.isArray(item.capabilities)
 ? [...item.capabilities]
 : (Array.isArray(prev?.capabilities) ? [...prev.capabilities] : []),
 personality: firstText(item.personality, prev?.personality),
 status: firstText(item.status, prev?.status || 'pending'),
 agentId: firstText(item.agentId, prev?.agentId),
 error: cardErrorText(item.error ?? prev?.error)
 };
 })
 : previousItems;

 const mergedCard = {
 ...(message.coordinatorTemplateCatsCard || {}),
 ...patch,
 cardId: message.coordinatorTemplateCatsCard?.cardId || id,
 id,
 items: mergedItems,
 error: cardErrorText(patch.error ?? message.coordinatorTemplateCatsCard?.error),
 updatedAt: patch.updatedAt || Date.now()
 };
 return {
 ...message,
 status: 'success',
 content: summarizeCard(mergedCard),
 coordinatorTemplateCatsCard: mergedCard,
 metadata: {
 ...(message.metadata || {}),
 coordinator_template_cats_request: true,
 coordinatorTemplateCatsCard: mergedCard
 }
 };
 });
}

export function summarizeCoordinatorTemplateCatsCard(card = {}) {
 return summarizeCard(card);
}
