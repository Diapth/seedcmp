const SKILL_TONES = ['primary', 'cyan', 'orange', 'green', 'purple'];

function clean(value = '') {
  return String(value || '').trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return '';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  return [...new Set(asArray(values).map((value) => clean(value).replace(/^clowder_cat:/, '')).filter(Boolean))];
}

function slug(value = '') {
  return clean(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, '-').replace(/^-+|-+$/g, '') || 'skill';
}

function skillTone(index = 0) {
  return SKILL_TONES[index % SKILL_TONES.length];
}

function statusText(enabled, status = '') {
  if (status === 'deleted') return '已删除';
  return enabled === false ? '已停用' : '已启用';
}

function skillDescription(input = {}) {
  return firstNonEmpty(input.desc, input.description, input.descriptionOverride, input.trigger, '后端 Skill 已同步');
}

function skillDocuments(input = {}) {
  const markdown = firstNonEmpty(input.markdown, input.document, input.readme, input.skillMd, input.skill_md);
  if (!markdown) return [];
  return [{
    id: 'overview',
    title: '使用说明',
    type: 'Markdown',
    updatedAt: input.updatedAt || input.updated_at || '',
    summary: skillDescription(input),
    markdown
  }];
}

export function normalizeUserSkill(input = {}, index = 0) {
  const agentIds = uniqueStrings(input.agentIds || input.agent_ids || input.assignments);
  const enabled = input.enabled !== false;
  const name = firstNonEmpty(input.name, input.displayName, input.display_name, input.skillId, input.skill_id);
  const id = firstNonEmpty(input.id, input.userSkillId, input.user_skill_id, input.sourceId, input.source_id, name);
  return {
    id,
    userSkillId: id,
    sourceId: firstNonEmpty(input.sourceId, input.source_id, input.skillSourceId, input.skill_source_id),
    skillId: firstNonEmpty(input.skillId, input.skill_id, slug(name)),
    name,
    displayName: firstNonEmpty(input.displayName, input.display_name, name),
    category: firstNonEmpty(input.category, '未分类'),
    level: enabled ? '已添加' : '已停用',
    desc: skillDescription(input),
    description: skillDescription(input),
    icon: input.icon || 'bookmark',
    tone: input.tone || skillTone(index),
    enabled,
    status: statusText(enabled, input.status),
    source: firstNonEmpty(input.sourceType, input.source_type, input.source, 'user'),
    sourceType: firstNonEmpty(input.sourceType, input.source_type, input.source, 'user'),
    provider: firstNonEmpty(input.provider),
    addSource: firstNonEmpty(input.addSource, input.add_source, 'market'),
    agentIds,
    assignedAgentCount: Number(input.assignedAgentCount ?? input.assigned_agent_count ?? agentIds.length),
    triggers: uniqueStrings(input.triggers || (input.trigger ? [input.trigger] : [])),
    files: asArray(input.files),
    documents: skillDocuments(input),
    packageName: firstNonEmpty(input.packageName, input.package_name, `${slug(name)}.skill.zip`),
    location: firstNonEmpty(input.location, input.sourcePath, input.source_path, ''),
    updatedAt: firstNonEmpty(input.updatedAt, input.updated_at, ''),
    author: firstNonEmpty(input.author, input.sourceOwnerUid, input.source_owner_uid, 'Clowder')
  };
}

export function normalizeUserSkillList(skills = []) {
  return asArray(skills).map((skill, index) => normalizeUserSkill(skill, index));
}

export function normalizeMarketplaceSkill(input = {}, index = 0) {
  const name = firstNonEmpty(input.name, input.displayName, input.display_name, input.skillId, input.skill_id);
  const enabled = input.added === true;
  return {
    id: firstNonEmpty(input.id, input.sourceId, input.source_id, `${firstNonEmpty(input.provider, 'skill')}-${slug(name)}`),
    sourceId: firstNonEmpty(input.sourceId, input.source_id, input.id),
    skillId: firstNonEmpty(input.skillId, input.skill_id, slug(name)),
    name,
    displayName: firstNonEmpty(input.displayName, input.display_name, name),
    category: firstNonEmpty(input.category, '未分类'),
    level: input.mounted === false ? '未挂载' : (enabled ? '已添加' : '市场可添加'),
    desc: skillDescription(input),
    description: skillDescription(input),
    icon: input.icon || 'bookmark',
    tone: input.tone || skillTone(index),
    added: enabled,
    enabled,
    mounted: input.mounted !== false,
    status: input.mounted === false ? '未挂载' : (enabled ? '已添加' : '可添加'),
    source: firstNonEmpty(input.sourceType, input.source_type, input.source, 'official'),
    sourceType: firstNonEmpty(input.sourceType, input.source_type, input.source, 'official'),
    provider: firstNonEmpty(input.provider),
    conflictStatus: firstNonEmpty(input.conflictStatus, input.conflict_status, 'none'),
    requiresMcp: asArray(input.requiresMcp || input.requires_mcp),
    agentIds: [],
    assignedAgentCount: 0,
    triggers: uniqueStrings(input.triggers || (input.trigger ? [input.trigger] : [])),
    files: asArray(input.files),
    documents: skillDocuments(input),
    packageName: firstNonEmpty(input.packageName, input.package_name, `${slug(name)}.skill.zip`),
    location: firstNonEmpty(input.location, input.sourcePath, input.source_path, ''),
    updatedAt: firstNonEmpty(input.updatedAt, input.updated_at, ''),
    author: firstNonEmpty(input.author, input.sourceOwnerUid, input.source_owner_uid, 'Clowder')
  };
}

export function normalizeMarketplaceSkillList(skills = []) {
  return asArray(skills).map((skill, index) => normalizeMarketplaceSkill(skill, index));
}

export function normalizeSkillCatalogPreview(skillCatalog = {}) {
  return Object.entries(skillCatalog || {}).flatMap(([provider, entries], providerIndex) => {
    return asArray(entries).map((entry, index) => normalizeMarketplaceSkill({
      id: `${provider}-${slug(entry.name || entry.id || index + 1)}`,
      sourceId: `${provider}:${slug(entry.name || entry.id || index + 1)}`,
      name: entry.name || entry.id || `${provider}-${index + 1}`,
      category: entry.category || provider,
      description: entry.description || entry.trigger || '后端技能已同步',
      trigger: entry.trigger,
      mounted: entry.mounted !== false,
      sourceType: 'catalog',
      provider
    }, providerIndex + index));
  });
}
