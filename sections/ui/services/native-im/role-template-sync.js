// Role template sync helpers: merge fallback role templates with remote
// cat-templates and compute the form patch when the user picks a role,
// honoring `dirtyFields` so user edits are never overwritten.

const CHINESE_PINYIN_MAP = {
  '宪宪': 'xianxian', '因因': 'yinyin', '橘橘': 'juju', '叮叮': 'dingding',
  '黑黑': 'heihei', '苗苗': 'miaomiao', '花花': 'huahua', '蓝蓝': 'lanlan',
  '安安': 'anan', '森森': 'sensen', '银银': 'yinyin', '罗罗': 'luoluo',
  '拉拉': 'lala', '波波': 'bobo', '短短': 'duanduan'
};

function firstText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))];
}

function splitTeamStrengths(text = '') {
  return uniqueStrings(String(text || '').split(/[、，,;；·\s\/]+/));
}

function splitSummaryTags(text = '') {
  return uniqueStrings(String(text || '').split(/[、，,;；]+/));
}

function firstList(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function cleanMention(value = '') {
  return String(value || '').trim().replace(/^@+/, '');
}

function aliasFromNickname(nickname = '', fallbackName = '') {
  const trimmed = String(nickname || '').trim();
  if (CHINESE_PINYIN_MAP[trimmed]) return CHINESE_PINYIN_MAP[trimmed];
  const ascii = trimmed.replace(/[^a-zA-Z0-9_]/g, '');
  if (ascii) return ascii.toLowerCase();
  const fromName = String(fallbackName || '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  return fromName || 'agent';
}

export function normalizeRoleTemplate(raw = {}) {
  const id = firstText(raw.id, raw.roleTemplateId, raw.templateId);
  if (!id) return null;
  const name = firstText(raw.name, raw.displayName, raw.display_name, raw.label, id);
  const nickname = firstText(
    raw.nickname,
    cleanMention(firstList(raw.aliases, raw.mentionPatterns, raw.mention_patterns)[0])
  );
  const roleDescription = firstText(
    raw.roleDescription,
    raw.role_description,
    raw.capabilitySummary,
    raw.capability_summary,
    raw.description
  );
  const personality = firstText(
    raw.personality,
    raw.personalitySummary,
    raw.personality_summary,
    raw.systemPrompt,
    raw.system_prompt
  );
  const teamStrengths = firstText(raw.teamStrengths, raw.team_strengths);
  const capabilitySummary = firstText(raw.capabilitySummary, raw.capability_summary);
  return {
    id,
    label: name,
    name,
    nickname,
    avatar: firstText(raw.avatar),
    description: firstText(raw.description, roleDescription, raw.summary),
    roleDescription,
    personality,
    teamStrengths: teamStrengths || capabilitySummary,
    capabilityTags: uniqueStrings([
      ...(Array.isArray(raw.capabilityTags) ? raw.capabilityTags : []),
      ...(Array.isArray(raw.capabilities) ? raw.capabilities : []),
      ...splitTeamStrengths(teamStrengths),
      ...(!teamStrengths ? splitSummaryTags(capabilitySummary) : [])
    ]),
    restrictions: Array.isArray(raw.restrictions) ? [...raw.restrictions] : [],
    virtual: Boolean(raw.virtual)
  };
}

export function mergeRoleTemplates(remote = [], fallback = []) {
  const seen = new Map();
  fallback.forEach((tpl) => {
    const normalized = normalizeRoleTemplate(tpl);
    if (normalized) seen.set(normalized.id, normalized);
  });
  remote.forEach((tpl) => {
    const normalized = normalizeRoleTemplate(tpl);
    if (!normalized) return;
    seen.set(normalized.id, normalized);
  });
  return [...seen.values()];
}

export function buildRoleTemplateOptions(remote = []) {
  const remoteOnly = remote
    .map(normalizeRoleTemplate)
    .filter((tpl) => tpl && !tpl.virtual);
  const seen = new Set();
  const options = [];
  remoteOnly.forEach((tpl) => {
    if (seen.has(tpl.id)) return;
    seen.add(tpl.id);
    options.push(tpl);
  });
  return options;
}

export function applyRoleTemplateToForm(form = {}, dirty = new Set(), template = null) {
  if (!template) return form;
  const next = { ...form };
  next.roleTemplate = template.id;

  if (template.virtual) return next;

  if (!dirty.has('name') && template.name) next.name = template.name;
  if (!dirty.has('alias')) {
    const alias = aliasFromNickname(template.nickname, template.name);
    if (alias) next.aliasRaw = alias;
  }
  if (!dirty.has('desc')) {
    const desc = firstText(template.roleDescription, template.description, template.personality);
    if (desc) next.desc = desc;
  }
  if (!dirty.has('capabilityTags')) {
    const tags = template.capabilityTags?.length
      ? [...template.capabilityTags]
      : splitTeamStrengths(template.teamStrengths);
    if (tags.length) next.capabilityTags = tags.slice(0, 8);
  }
  if (!dirty.has('systemPrompt')) {
    const personality = firstText(template.personality);
    const restrictions = Array.isArray(template.restrictions) ? template.restrictions : [];
    const parts = [];
    if (template.name) parts.push(`你是${template.name}。`);
    if (personality) parts.push(personality);
    if (restrictions.length) {
      parts.push('禁忌：');
      restrictions.forEach((r) => parts.push(`- ${r}`));
    }
    if (parts.length) next.systemPrompt = parts.join('\n');
  }
  return next;
}

export const __test__ = { aliasFromNickname, splitTeamStrengths };
