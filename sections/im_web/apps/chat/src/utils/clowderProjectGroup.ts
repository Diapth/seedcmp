const PROJECT_START_RE = /(项目|做一个|实现|开发|制作|搭建|创建|生成|协调|拆解|分工|派发|拉.*猫|agent|PM|pm)/i;
const PROJECT_NAME_PATTERNS = [
  /项目名称(?:叫|为|是)?\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,30})/i,
  /项目名(?:叫|为|是)?\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,30})/i,
  /项目叫\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,30})/i,
  /群(?:名|名称)(?:叫|为|是)?\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,30})/i,
];

function cleanProjectName(value: string) {
  return String(value || '')
    .trim()
    .replace(/^(?:叫|为|是|：|:)\s*/, '')
    .replace(/[」』”"']+$/g, '')
    .trim();
}

export function isProjectStartRequest(text: string) {
  const trimmed = String(text || '').trim();
  if (trimmed.length < 4) return false;
  return PROJECT_START_RE.test(trimmed);
}

export function resolveProjectGroupName(text: string, fallback?: string) {
  const source = String(text || '').trim();
  for (const pattern of PROJECT_NAME_PATTERNS) {
    const match = source.match(pattern);
    const candidate = cleanProjectName(match?.[1] || '');
    if (candidate) return candidate.slice(0, 20);
  }
  const fallbackName = cleanProjectName(fallback || '');
  if (fallbackName) return fallbackName.slice(0, 20);
  const withoutMentions = source.replace(/^\s*(?:@[\w\u4e00-\u9fff-]+[\s，,、]*)+/u, '').trim();
  const compact = withoutMentions.replace(/\s+/g, ' ');
  return (compact || '项目群聊').slice(0, 20);
}
