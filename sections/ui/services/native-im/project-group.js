const PROJECT_START_RE = /(项目群|创建.*群|拉.*(?:猫|智能体|agent|codex|claude)|拆解.*任务|分工执行|协调.*(?:智能体|agent|codex|claude)|PM|pm|coordinator)/i;

const PROJECT_NAME_PATTERNS = [
  /项目名称(?:叫|为|是)?\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,40})/i,
  /项目名(?:叫|为|是)?\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,40})/i,
  /项目叫\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,40})/i,
  /群(?:名|名称)(?:叫|为|是)?\s*[「『“"]?([^」』”"\n，。,.!?！？；;]{2,40})/i
];

function cleanProjectName(value = '') {
  return String(value || '')
    .trim()
    .replace(/^(?:叫|为|是|：|:)\s*/, '')
    .replace(/[」』”"']+$/g, '')
    .trim();
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
