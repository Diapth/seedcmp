// Coordinator capability profile detection + existing cat scanning.

const CAPABILITY_PROFILES = [
 {
 id: 'ppt-delivery',
 label: 'PPT / 文档成稿',
 keywords: ['ppt', 'deck', '演示', '幻灯片', '幻灯', '汇报材料', '成稿', 'presentation'],
 roleTemplateIds: ['source-curator', 'deck-strategist', 'storyboard-designer', 'svg-executor-guardian', 'deck-qa-exporter']
 },
 {
 id: 'document-writing',
 label: '文档 / 写作',
 keywords: ['文档', '写作', '文章', '说明书', '长文', '论文', 'writeup', 'writing'],
 roleTemplateIds: ['source-curator', 'architect', 'qa']
 },
 {
 id: 'architecture-review',
 label: '架构 / 评审',
 keywords: ['架构', '评审', 'review', 'reviewer', 'code review', '代码审查', '技术评审'],
 roleTemplateIds: ['architect', 'peer-reviewer']
 },
 {
 id: 'delivery-deploy',
 label: '部署 / 上线',
 keywords: ['部署', '上线', '发布', 'deploy', 'release', 'ci/cd', '流水线', '运维'],
 roleTemplateIds: ['devops', 'qa']
 },
 {
 id: 'frontend-delivery',
 label: '前端实现',
 keywords: ['前端', '页面', 'ui', 'ux', '界面', 'frontend', '页面实现'],
 roleTemplateIds: ['frontend', 'qa']
 },
 {
 id: 'general-execution',
 label: '通用执行',
 keywords: ['执行', '协作', '分工', '安排', '拉猫', '协调'],
 roleTemplateIds: ['frontend', 'devops', 'qa']
 }
];

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

function lowerText(text = '') {
 return String(text || '').toLowerCase();
}

function matchProfileByKeywords(text = '') {
 const haystack = lowerText(text);
 if (!haystack) return null;
 return CAPABILITY_PROFILES.find((profile) =>
 profile.keywords.some((keyword) => haystack.includes(lowerText(keyword)))
 ) || null;
}

export function detectRequiredCapabilityProfile(text = '') {
 const profile = matchProfileByKeywords(text);
 if (!profile) return null;
 return {
 id: profile.id,
 label: profile.label,
 roleTemplateIds: [...profile.roleTemplateIds]
 };
}

export function normalizeAgentForScan(agent = {}) {
 const raw = agent.raw || {};
 return {
 id: firstText(agent.id, agent.uid, agent.catId, agent.cat_id, agent.directCatId, agent.agentId, raw.id),
 name: firstText(agent.name, agent.nickname, agent.displayName, agent.alias, agent.id, '智能体'),
 roleTemplate: firstText(agent.roleTemplate, agent.templateId, agent.roleTemplateId, raw.roleTemplate, raw.templateId, raw.roleTemplateId, '').toLowerCase(),
 templateId: firstText(agent.templateId, agent.roleTemplateId, agent.roleTemplate, raw.templateId, raw.roleTemplateId).toLowerCase(),
 capabilityTags: uniqueStrings([
 ...(Array.isArray(agent.capabilityTags) ? agent.capabilityTags : []),
 ...(Array.isArray(raw.capabilityTags) ? raw.capabilityTags : []),
 ...(Array.isArray(agent.capabilities) ? agent.capabilities : []),
 ...(Array.isArray(raw.capabilities) ? raw.capabilities : [])
 ]).map((tag) => String(tag || '').toLowerCase()).filter(Boolean),
 raw
 };
}

function agentMatchesRoleTemplate(agent = {}, roleTemplateId = '') {
 const target = String(roleTemplateId || '').trim().toLowerCase();
 if (!target) return false;
 if (agent.roleTemplate && agent.roleTemplate === target) return true;
 if (agent.templateId && agent.templateId === target) return true;
 return agent.capabilityTags.some((tag) => tag.toLowerCase() === target);
}

function agentMatchesProfileKeywords(agent = {}, profile = null) {
 if (!profile) return false;
 const haystack = uniqueStrings([
 agent.name,
 ...agent.capabilityTags,
 agent.roleTemplate,
 agent.templateId
 ]).map((value) => lowerText(value)).filter(Boolean);
 if (!haystack.length) return false;
 return profile.keywords.some((keyword) =>
 haystack.some((value) => value.includes(lowerText(keyword)))
 );
}

export function scanExistingCats({ requiredProfile = null, availableAgents = [] } = {}) {
 const normalizedAgents = availableAgents
 .map(normalizeAgentForScan)
 .filter((agent) => agent.id);
 const reusable = [];
 const seen = new Set();
 const requiredRoles = requiredProfile?.roleTemplateIds || [];

 requiredRoles.forEach((roleId) => {
 const matched = normalizedAgents.find((agent) => agentMatchesRoleTemplate(agent, roleId));
 if (matched && !seen.has(matched.id)) {
 seen.add(matched.id);
 reusable.push({
 id: matched.id,
 name: matched.name,
 roleTemplate: matched.roleTemplate || matched.templateId || roleId,
 matchedRole: roleId
 });
 }
 });

 if (reusable.length === 0 && requiredProfile) {
 normalizedAgents.forEach((agent) => {
 if (seen.has(agent.id)) return;
 if (!agentMatchesProfileKeywords(agent, requiredProfile)) return;
 seen.add(agent.id);
 reusable.push({
 id: agent.id,
 name: agent.name,
 roleTemplate: agent.roleTemplate || agent.templateId || '',
 matchedRole: ''
 });
 });
 }

 return reusable;
}

export function findMissingRoles({ requiredProfile = null, availableAgents = [] } = {}) {
 const requiredRoles = requiredProfile?.roleTemplateIds || [];
 if (!requiredRoles.length) return [];
 const normalizedAgents = availableAgents
 .map(normalizeAgentForScan)
 .filter((agent) => agent.id);
 return requiredRoles.filter((roleId) =>
 !normalizedAgents.some((agent) => agentMatchesRoleTemplate(agent, roleId))
 );
}

export function listCapabilityProfiles() {
 return CAPABILITY_PROFILES.map((profile) => ({
 id: profile.id,
 label: profile.label,
 roleTemplateIds: [...profile.roleTemplateIds]
 }));
}
