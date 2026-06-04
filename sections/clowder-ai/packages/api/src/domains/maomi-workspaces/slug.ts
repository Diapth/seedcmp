import { createHash } from 'node:crypto';

const WINDOWS_RESERVED = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

const INTENT_SLUG_HINTS: Array<[RegExp, string, string]> = [
  [/婚礼|结婚|wedding/i, 'wedding', '婚礼项目'],
  [/待办|todo|任务清单/i, 'todo', 'Todo 项目'],
  [/简历|resume|cv/i, 'resume', '简历项目'],
  [/博客|blog/i, 'blog', '博客项目'],
  [/官网|landing|首页|网站|网页/i, 'website', '网站项目'],
];

export function isValidMaomiSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  if (normalized !== slug.trim()) return false;
  if (!/^[a-z0-9][a-z0-9._-]{0,62}$/.test(normalized)) return false;
  if (normalized.includes('..') || normalized.includes('/') || normalized.includes('\\')) return false;
  if (/[\u0000-\u001f\u007f]/.test(normalized)) return false;
  if (WINDOWS_RESERVED.has(normalized)) return false;
  return true;
}

export function sanitizeMaomiSlug(input: string): string | null {
  const candidate = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 63);
  if (!candidate) return null;
  const normalized = /^[a-z0-9]/.test(candidate) ? candidate : `project-${candidate}`;
  return isValidMaomiSlug(normalized) ? normalized : null;
}

function hashFallback(text: string): string {
  return createHash('sha1').update(text || `${Date.now()}`).digest('hex').slice(0, 8);
}

export function proposeMaomiSlug(intentText: string): { slug: string; displayName: string; confidence: number } {
  const text = intentText.trim();
  for (const [pattern, slug, displayName] of INTENT_SLUG_HINTS) {
    if (pattern.test(text)) {
      return { slug, displayName, confidence: 0.85 };
    }
  }

  const ascii = sanitizeMaomiSlug(text);
  if (ascii) {
    return { slug: ascii, displayName: text || ascii, confidence: 0.6 };
  }

  return {
    slug: `project-${hashFallback(text)}`,
    displayName: text || 'Maomi Project',
    confidence: 0.35,
  };
}

export function nextCollisionSlug(slug: string, taken: (candidate: string) => boolean): string {
  if (!taken(slug)) return slug;
  for (let index = 2; index <= 99; index += 1) {
    const candidate = `${slug}-${index}`;
    if (candidate.length <= 63 && !taken(candidate)) return candidate;
  }
  const base = slug.slice(0, 54).replace(/[-._]+$/g, '') || 'project';
  const dated = `${base}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  if (isValidMaomiSlug(dated) && !taken(dated)) return dated;
  return `${base}-${hashFallback(`${slug}:${Date.now()}`)}`.slice(0, 63);
}
