export const CLOWDER_CONNECTOR_ID = 'im-web';

export interface ClowderFileBlock {
  name: string;
  url: string;
  size?: number;
  raw?: any;
}

function asRecord(value: any): Record<string, any> | undefined {
  return value && typeof value === 'object' ? value : undefined;
}

function parseMaybeJson(value: any) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function stripClowderCatDecorations(value: string) {
  return String(value || '').replace(/[🐱🐈🐾\s]+$/g, '').trim();
}

export function normalizeClowderCanonicalDisplayName(displayName: string, catId = '') {
  const name = stripClowderCatDecorations(displayName);
  const normalizedName = name.replace(/^@/, '').trim().toLocaleLowerCase();
  const normalizedCatId = stripClowderCatDecorations(catId).replace(/^@/, '').trim().toLocaleLowerCase();
  const coordinatorTokens = new Set([
    'coordinator',
    'pm',
    '协调者',
    '主agent',
    '主代理'
  ]);
  if (coordinatorTokens.has(normalizedCatId) || coordinatorTokens.has(normalizedName)) {
    return '协调者';
  }
  return name;
}

export function extractClowderCatDisplayNameFromText(text: string) {
  const value = String(text || '').trim();
  const prefixMatch = value.match(/^【([^】]{1,40}?)】/);
  if (prefixMatch) return stripClowderCatDecorations(prefixMatch[1]);

  const leadingSlashMatch = value.match(/^([^\s/@/［\[\]］，。:：！？?（）()]{1,40})\/[^\s/［\[\]］，。:：]{1,40}(?=[\s，。:：！？?）)]|已|收|回|确|$)/u);
  if (leadingSlashMatch) return stripClowderCatDecorations(leadingSlashMatch[1]);

  const suffixMatch = value.match(/[［\[]([^\]/\]］\n]{1,40})\/[^\]］\n]{1,120}[］\]]\s*$/);
  if (suffixMatch) return stripClowderCatDecorations(suffixMatch[1]);

  const selfIntroSlashMatch = value.match(/(?:^|[\s，。！？～~])([^\s/@/［\[\]］，。:：！？?（）()]{1,40})\/[^\s/［\[\]］，。:：！？?（）()]{1,40}(?=\s*(?:在此|已|收到|来|可以|能|为|帮|接|回复|上线|准备))/u);
  if (selfIntroSlashMatch) return stripClowderCatDecorations(selfIntroSlashMatch[1]);

  return '';
}

export function getClowderPayload(input: any) {
  return asRecord(input?.content) || asRecord(input?.payload) || asRecord(input) || {};
}

export function getClowderRichBlocksFromPayload(payload: any): any[] {
  const content = getClowderPayload(payload);
  const metadata = asRecord(content.metadata) || {};
  const candidates = [
    content.richBlocks,
    content.rich_blocks,
    asRecord(content.rich)?.blocks,
    metadata.richBlocks,
    metadata.rich_blocks
  ].map(parseMaybeJson);

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

export function getClowderCatDisplayNameFromPayload(payload: any) {
  const content = getClowderPayload(payload);
  const metadata = asRecord(content.metadata) || {};
  const catId = String(
    content.catId ||
    content.cat_id ||
    content.agentId ||
    content.agent_id ||
    metadata.catId ||
    metadata.cat_id ||
    metadata.agentId ||
    metadata.agent_id ||
    ''
  ).trim();
  const textName = extractClowderCatDisplayNameFromText(String(content.text || content.content || ''));
  if (!catId && textName) return normalizeClowderCanonicalDisplayName(textName, catId);

  const explicit = String(
    content.catDisplayName ||
    content.cat_display_name ||
    content.catName ||
    content.cat_name ||
    metadata.catDisplayName ||
    metadata.cat_display_name ||
    metadata.catName ||
    metadata.cat_name ||
    ''
  ).trim();
  if (explicit) return normalizeClowderCanonicalDisplayName(explicit, catId);

  if (catId && normalizeClowderCanonicalDisplayName(catId, catId) === '协调者') {
    return '协调者';
  }

  if (textName) return normalizeClowderCanonicalDisplayName(textName, catId);
  return '';
}

export function isClowderPayload(payload: any) {
  const content = getClowderPayload(payload);
  if (!content || typeof content !== 'object') return false;
  if (content.connectorId === CLOWDER_CONNECTOR_ID || content.connector_id === CLOWDER_CONNECTOR_ID) return true;
  if (content.source === 'clowder' || content.provider === 'clowder') return true;
  if (content.catDisplayName || content.cat_display_name || content.catName || content.cat_name || content.catId || content.cat_id) return true;
  if (content.ai === true && getClowderCatDisplayNameFromPayload(content)) return true;
  if (content.ai === true && getClowderRichBlocksFromPayload(content).length > 0) return true;
  return false;
}

export function withClowderCatDisplayName(payload: any, fallbackDisplayName = '') {
  if (!payload || typeof payload !== 'object') return payload;
  if (!isClowderPayload(payload)) return payload;

  const catId = stripClowderCatDecorations(String(payload.catId || payload.cat_id || ''));
  const displayName = normalizeClowderCanonicalDisplayName(getClowderCatDisplayNameFromPayload(payload) ||
    catId ||
    stripClowderCatDecorations(String(fallbackDisplayName || '')), catId);
  const next = { ...payload };
  if (next.connectorId === undefined && next.connector_id !== undefined) next.connectorId = next.connector_id;
  if (next.connector_id === undefined && next.connectorId !== undefined) next.connector_id = next.connectorId;
  if (next.catId === undefined && next.cat_id !== undefined) next.catId = next.cat_id;
  if (next.cat_id === undefined && next.catId !== undefined) next.cat_id = next.catId;
  if (next.richBlocks === undefined) next.richBlocks = next.rich_blocks || next.rich?.blocks || next.metadata?.richBlocks || next.metadata?.rich_blocks;
  if (displayName) {
    next.catDisplayName = displayName;
    next.cat_display_name = displayName;
  }
  return next;
}

export function getClowderCatDisplayNameFromHistory(list: any[]) {
  return [...(list || [])].reverse()
    .map(item => getClowderCatDisplayNameFromPayload(item))
    .find(Boolean) || '';
}

function blockKind(block: any) {
  return String(block?.kind || block?.type || block?.blockType || block?.block_type || '').toLowerCase();
}

function normalizeFileName(value: string) {
  return String(value || '').trim().replace(/^["'`]+|["'`]+$/g, '');
}

function getRuntimeEnv() {
  try {
    return ((import.meta as any).env || {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getClowderPublicOrigin() {
  const env = getRuntimeEnv();
  return String(
    env.VITE_CLOWDER_API_URL ||
    env.VITE_CLOWDER_PUBLIC_URL ||
    env.VITE_CLOWDER_URL ||
    env.VITE_CLOWDER_BASE_URL ||
    'http://localhost:3004'
  ).replace(/\/+$/, '');
}

export function normalizeClowderFileUrl(url: string) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
        parsed.port === '3003' &&
        parsed.pathname.startsWith('/uploads/')
      ) {
        const origin = new URL(getClowderPublicOrigin());
        parsed.protocol = origin.protocol;
        parsed.hostname = origin.hostname;
        parsed.port = origin.port;
        return parsed.toString();
      }
    } catch {
      return value;
    }
    return value;
  }
  if (value.startsWith('/uploads/')) return `${getClowderPublicOrigin()}${value}`;
  return value;
}

export function getClowderFileBlocksFromPayload(payload: any): ClowderFileBlock[] {
  const blocks = getClowderRichBlocksFromPayload(payload)
    .filter(block => {
      const kind = blockKind(block);
      return kind === 'file' || kind === 'attachment' || Boolean((block?.fileName || block?.filename || block?.name || block?.title) && block?.url);
    })
    .map(block => {
      const name = normalizeFileName(block.fileName || block.filename || block.name || block.title || '');
      const url = normalizeClowderFileUrl(block.url || block.href || block.downloadUrl || block.download_url || '');
      const size = Number(block.size || block.fileSize || block.file_size || block.bytes || 0);
      return {
        name,
        url,
        size: Number.isFinite(size) && size > 0 ? size : undefined,
        raw: block
      };
    })
    .filter(block => Boolean(block.name && block.url));

  const content = getClowderPayload(payload);
  const type = Number(content.type || payload.type || 0);
  if (type === 8) {
    const name = normalizeFileName(content.name || content.fileName || payload.name || payload.fileName || '');
    const url = normalizeClowderFileUrl(content.url || payload.url || '');
    const size = Number(content.size || payload.size || 0);
    if (name && url) {
      blocks.push({
        name,
        url,
        size: Number.isFinite(size) && size > 0 ? size : undefined,
        raw: content
      });
    }
  }

  return blocks;
}

export function findClowderFileBlockForText(text: string, history: any[]) {
  const target = normalizeFileName(text);
  if (!target) return undefined;
  for (const item of [...(history || [])].reverse()) {
    for (const block of getClowderFileBlocksFromPayload(item)) {
      if (normalizeFileName(block.name) === target) return block;
    }
  }
  return undefined;
}

export function recoverClowderFileContentFromHistory(payload: any, history: any[], fallbackDisplayName = '') {
  if (!payload || typeof payload !== 'object') return payload;
  if (!isClowderPayload(payload)) return withClowderCatDisplayName(payload, fallbackDisplayName);
  if (Number(payload.type || 0) !== 1) return withClowderCatDisplayName(payload, fallbackDisplayName);

  const text = normalizeFileName(String(payload.text || payload.content || ''));
  if (!text) return withClowderCatDisplayName(payload, fallbackDisplayName);

  const fileBlock = findClowderFileBlockForText(text, history);
  if (!fileBlock) return withClowderCatDisplayName(payload, fallbackDisplayName);

  const displayName = getClowderCatDisplayNameFromPayload(payload) ||
    getClowderCatDisplayNameFromHistory(history) ||
    fallbackDisplayName;

  return withClowderCatDisplayName({
    ...payload,
    type: 8,
    name: payload.name || fileBlock.name,
    fileName: payload.fileName || fileBlock.name,
    url: payload.url || fileBlock.url,
    size: payload.size || fileBlock.size || 0,
    text: payload.text || text,
    content: payload.content || text
  }, displayName);
}
