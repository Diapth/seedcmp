import type { ClowderAgent, ClowderCatSource } from '../api/clowder';

export const CLOWDER_CAT_CONTACT_PREFIX = 'clowder_cat:';
export const CLOWDER_AI_CONTACT_ID = 'clowder_ai';
export const LEGACY_CLOWDER_CONTACT_PREFIX = 'clowder:';

export interface ClowderCatContact {
  id: string;
  uid: string;
  catId: string;
  channelId: string;
  channelType: 1;
  directConversationId: string;
  outboundSenderId: string;
  historyGroupKey: string;
  connectorId: 'im-web';
  category: 'clowder-cat';
  robot: 1;
  name: string;
  displayName: string;
  avatar: string;
  aliases: string[];
  mentionNames: string[];
  personalitySummary: string;
  capabilitySummary: string;
  available: boolean;
  availabilityState: 'available' | 'unavailable' | 'stale';
  source: ClowderCatSource;
  connected: boolean;
}

export interface ClowderGroupHumanMember {
  id: string;
  displayName: string;
  role?: string;
  mentionHandle?: string;
}

export interface ClowderGroupPromptInput {
  groupId: string;
  groupName: string;
  humanMembers: ClowderGroupHumanMember[];
  catMembers: Array<ClowderCatContact | ClowderAgent>;
  rules?: {
    proactiveReplies?: boolean;
    privacy?: string;
  };
}

function normalizeCatId(catId: string) {
  return String(catId || '').trim();
}

function sanitizeSenderId(catId: string) {
  return normalizeCatId(catId).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values
    .map(value => String(value || '').trim())
    .filter(Boolean)));
}

function firstMentionHandle(agent: ClowderAgent) {
  return uniqueStrings([
    ...(agent.aliases || []),
    ...(agent.mentionPatterns || []),
    agent.displayName
  ]).find(value => value.startsWith('@')) || `@${agent.displayName || agent.catId}`;
}

export function buildClowderCatContactId(catId: string) {
  return `${CLOWDER_CAT_CONTACT_PREFIX}${normalizeCatId(catId)}`;
}

export function buildClowderDirectConversationId(catId: string) {
  return buildClowderCatContactId(catId);
}

export function buildClowderOutboundSenderId(catId: string) {
  return `clowder_cat_${sanitizeSenderId(catId)}`;
}

export function getClowderCatIdFromContactId(contactId: string) {
  const id = String(contactId || '');
  return id.startsWith(CLOWDER_CAT_CONTACT_PREFIX)
    ? id.slice(CLOWDER_CAT_CONTACT_PREFIX.length)
    : undefined;
}

export function isClowderCatContactId(contactId: string) {
  return !!getClowderCatIdFromContactId(contactId);
}

export function isClowderAiContactId(contactId: string) {
  const id = String(contactId || '').trim();
  return id === CLOWDER_AI_CONTACT_ID || id.startsWith(LEGACY_CLOWDER_CONTACT_PREFIX);
}

export function toClowderCatContact(agent: ClowderAgent, overrides: Partial<ClowderCatContact> = {}): ClowderCatContact {
  const catId = normalizeCatId(agent.catId);
  const aliases = uniqueStrings([
    ...(agent.aliases || []),
    ...(agent.mentionPatterns || [])
  ]);
  const displayName = String(agent.displayName || catId);
  const id = buildClowderCatContactId(catId);
  const available = agent.available !== false;
  return {
    id,
    uid: id,
    catId,
    channelId: id,
    channelType: 1,
    directConversationId: buildClowderDirectConversationId(catId),
    outboundSenderId: buildClowderOutboundSenderId(catId),
    historyGroupKey: `clowder-cat:${catId}`,
    connectorId: 'im-web',
    category: 'clowder-cat',
    robot: 1,
    name: displayName,
    displayName,
    avatar: agent.avatar || '',
    aliases,
    mentionNames: uniqueStrings([firstMentionHandle(agent), ...aliases, displayName]),
    personalitySummary: agent.personalitySummary || '',
    capabilitySummary: agent.capabilitySummary || '',
    available,
    availabilityState: available ? 'available' : 'unavailable',
    source: agent.source || 'existing',
    connected: agent.connected === true,
    ...overrides
  };
}

export function buildClowderGroupPrompt(input: ClowderGroupPromptInput) {
  const humans = input.humanMembers.map(member => ({
    ...member,
    mentionHandle: member.mentionHandle || `@${member.displayName || member.id}`
  }));
  const cats = input.catMembers.map(cat => 'id' in cat
    ? cat as ClowderCatContact
    : toClowderCatContact(cat));
  const allowedTargets = [
    ...humans.map(member => member.mentionHandle),
    ...cats.map(cat => cat.mentionNames.find(name => name.startsWith('@')) || `@${cat.displayName}`)
  ];
  const proactive = input.rules?.proactiveReplies === true
    ? 'Cats may answer proactively when the conversation context asks for their capability.'
    : 'Cats may answer only when mentioned or focused.';
  const privacy = input.rules?.privacy || 'Cats can see display names, roles, and mention handles only.';

  return [
    `Group: ${input.groupName} (id: ${input.groupId})`,
    'Humans:',
    ...humans.map(member => `- ${member.displayName} (id: ${member.id}, role: ${member.role || 'member'}, mention: ${member.mentionHandle})`),
    'Cats:',
    ...cats.map(cat => `- ${cat.displayName} (catId: ${cat.catId}, aliases: ${cat.aliases.join(', ') || 'none'}, mention: ${cat.mentionNames.find(name => name.startsWith('@')) || `@${cat.displayName}`})`),
    `Allowed @ targets: ${allowedTargets.join(', ')}`,
    `Rules: ${proactive}`,
    `Privacy: ${privacy}`
  ].join('\n');
}
