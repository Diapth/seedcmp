export interface DeploymentIntent {
  shouldConfirm: boolean;
  target: string;
  environment: string;
  missingFields: Array<'target' | 'environment'>;
  requiresContextResolution: boolean;
  targetResolution: 'explicit' | 'contextual' | 'none';
  reason: 'new_deployment_request' | 'deployment_field_update' | 'negated_or_discussion' | 'no_deployment_intent';
}

export interface DeploymentIntentContext {
  hasActiveRequest?: boolean;
}

const DEPLOYMENT_KEYWORDS = [
  '部署',
  '上线',
  '发布',
  '生成预览链接',
  '预览链接',
  '打包源码',
  '源码包',
  '下载源码包',
  'deploy',
  'deployment',
  'preview link',
  'source package',
  'release',
  'rollout'
];

const NEGATED_OR_DISCUSSION = /(不要|别|无需|不用|禁止|暂不|先不|不要现在|讨论|not now|do not|don't|dont|without executing|no deploy)/i;
const DEPLOYMENT_ACKNOWLEDGEMENTS = new Set([
  '好',
  '好的',
  '行',
  '可以',
  'ok',
  'okay',
  '收到',
  '知道了',
  '嗯',
  '嗯嗯',
  '对',
]);

const DEPLOYMENT_FILLER_TOKENS = new Set([
  '吧',
  '啊',
  '呢',
  '嘛',
  '呀',
  '哈',
  '请',
  '我',
  '我们',
  '麻烦',
  '辛苦',
  '谢谢',
  'thanks',
  'thank',
  'thankyou',
  'thank you',
  'thx',
  'pls',
  'please',
]);

const DEPLOYMENT_ENVIRONMENT_TEXT = /(本地|local|localhost|预览|preview|测试|testing|staging|stage|uat|预发|生产|线上|prod|production|开发|dev|development|环境)/i;
const EXPLICIT_DEPLOYMENT_TARGET = /(?:^\.{0,2}\/|[\\/]|(?:\.(?:html?|css|js|jsx|ts|tsx|json|md|txt|zip|tgz|tar\.gz))$)/i;

function hasDeploymentKeyword(text: string) {
  return DEPLOYMENT_KEYWORDS.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
}

function detectEnvironment(text: string) {
  if (/(本地|local|localhost)/i.test(text)) return 'local';
  if (/(预览|preview)/i.test(text)) return 'preview';
  if (/(生产|线上|prod|production)/i.test(text)) return 'production';
  if (/(预发|staging|stage|uat)/i.test(text)) return 'staging';
  if (/(测试|test|testing)/i.test(text)) return 'testing';
  if (/(开发|dev|development)/i.test(text)) return 'development';
  return '待确认环境';
}

function isDeploymentEnvironmentCandidate(value: string) {
  return DEPLOYMENT_ENVIRONMENT_TEXT.test(value);
}

function sanitizeTargetCandidate(value: string) {
  const candidate = String(value || '').trim().replace(/^[\s,，。！？!?;；:：]+|[\s,，。！？!?;；:：]+$/g, '');
  if (!candidate) return '待确认目标';
  if (isDeploymentEnvironmentCandidate(candidate)) return '待确认目标';
  if (DEPLOYMENT_ACKNOWLEDGEMENTS.has(candidate.toLowerCase())) return '待确认目标';
  if (DEPLOYMENT_FILLER_TOKENS.has(candidate.toLowerCase())) return '待确认目标';
  return candidate;
}

function isLikelyLooseTarget(text: string) {
  const trimmed = String(text || '').trim();
  if (!trimmed || trimmed.length > 20) return false;
  if (/\s/.test(trimmed)) return false;
  if (DEPLOYMENT_ACKNOWLEDGEMENTS.has(trimmed.toLowerCase())) return false;
  if (DEPLOYMENT_FILLER_TOKENS.has(trimmed.toLowerCase())) return false;
  if (isDeploymentEnvironmentCandidate(trimmed)) return false;
  return /[\u4e00-\u9fa5a-zA-Z0-9_.:/-]/.test(trimmed);
}

function isExplicitDeploymentTarget(target: string) {
  const text = String(target || '').trim();
  if (!text || text === '待确认目标') return false;
  if (/^https?:\/\//i.test(text)) return false;
  return EXPLICIT_DEPLOYMENT_TARGET.test(text);
}

function detectTarget(text: string, allowLoose = false) {
  const english = text.match(/\bdeploy(?:ment|ed)?\s+([a-z0-9_.:/-]{2,80})(?:\s+(?:to|into|on)\b|\s*$)/i);
  if (english?.[1]) return sanitizeTargetCandidate(english[1]);

  const chineseTargetBefore = text.match(/(?:把|将)\s*([^\s,，。！？!?;；、]{1,80}?)\s*(?:部署|上线|发布)\s*(?:到|至)\s*(?:本地|local|localhost|预览|preview|测试|testing|staging|stage|uat|预发|生产|线上|prod|production|开发|dev|development)/i);
  if (chineseTargetBefore?.[1]) {
    const target = sanitizeTargetCandidate(chineseTargetBefore[1]);
    if (target !== '待确认目标') return target;
  }

  const chineseTargetAfter = text.match(/(?:部署|上线|发布)\s*(?:到|至|给|把|将)?\s*([^\s,，。！？!?;；、]{1,80}?)(?=(?:\s*(?:到|至|在|于|环境|环境是|环境为|,|，|。|！|!|？|\?|;|；)|$))/);
  if (chineseTargetAfter?.[1]) {
    const target = sanitizeTargetCandidate(chineseTargetAfter[1]);
    if (target !== '待确认目标') return target;
  }

  const packageOrPreviewTarget = text.match(/(?:把|将|为)\s*([^\s,，。！？!?;；、`"“”']{1,80})\s*(?:生成预览链接|打包源码|下载源码包|源码包|预览链接)/);
  if (packageOrPreviewTarget?.[1]) {
    const target = sanitizeTargetCandidate(packageOrPreviewTarget[1]);
    if (target !== '待确认目标') return target;
  }

  const packageOrPreviewTargetAfter = text.match(/(?:生成预览链接|打包源码|下载源码包|源码包|预览链接)\s+([^\s,，。！？!?;；、`"“”']{1,120})/);
  if (packageOrPreviewTargetAfter?.[1]) {
    const target = sanitizeTargetCandidate(packageOrPreviewTargetAfter[1]);
    if (target !== '待确认目标') return target;
  }

  if (allowLoose) {
    const loose = text.match(/(?:给我|帮我|我要|要|切到|换成|改成)\s*([^\s,，。！？!?;；、]{1,20})/);
    if (loose?.[1]) {
      const target = sanitizeTargetCandidate(loose[1]);
      if (target !== '待确认目标') return target;
    }
    if (isLikelyLooseTarget(text)) return sanitizeTargetCandidate(text);
  }

  return '待确认目标';
}

function missingFieldsFor(target: string, environment: string): Array<'target' | 'environment'> {
  const missingFields: Array<'target' | 'environment'> = [];
  if (target === '待确认目标') missingFields.push('target');
  if (environment === '待确认环境') missingFields.push('environment');
  return missingFields;
}

function targetResolutionFor(target: string, hasActiveRequest: boolean): DeploymentIntent['targetResolution'] {
  if (target === '待确认目标') return 'none';
  if (hasActiveRequest || isExplicitDeploymentTarget(target)) return 'explicit';
  return 'contextual';
}

function noDeploymentIntent(reason: DeploymentIntent['reason'] = 'no_deployment_intent'): DeploymentIntent {
  return {
    shouldConfirm: false,
    target: '',
    environment: '',
    missingFields: [],
    requiresContextResolution: false,
    targetResolution: 'none',
    reason
  };
}

export function detectDeploymentIntent(input: string, context: DeploymentIntentContext = {}): DeploymentIntent {
  const text = String(input || '').trim();
  if (!text) {
    return noDeploymentIntent();
  }

  if (NEGATED_OR_DISCUSSION.test(text)) {
    return noDeploymentIntent('negated_or_discussion');
  }

  const hasKeyword = hasDeploymentKeyword(text);
  const hasActiveRequest = context.hasActiveRequest === true;
  if (!hasKeyword && !hasActiveRequest) {
    return noDeploymentIntent();
  }

  const target = detectTarget(text, hasActiveRequest);
  const environment = detectEnvironment(text);
  const hasFieldSignal = target !== '待确认目标' || environment !== '待确认环境';
  if (!hasKeyword && !hasActiveRequest) {
    return noDeploymentIntent();
  }
  if (hasActiveRequest && !hasKeyword && !hasFieldSignal) {
    return noDeploymentIntent();
  }

  const targetResolution = targetResolutionFor(target, hasActiveRequest);
  const requiresContextResolution = hasKeyword && !hasActiveRequest && targetResolution !== 'explicit';

  return {
    shouldConfirm: !requiresContextResolution,
    target,
    environment,
    missingFields: missingFieldsFor(target, environment),
    requiresContextResolution,
    targetResolution,
    reason: hasActiveRequest ? 'deployment_field_update' : 'new_deployment_request'
  };
}
