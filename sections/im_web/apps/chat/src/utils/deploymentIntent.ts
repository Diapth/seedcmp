export interface DeploymentIntent {
  shouldConfirm: boolean;
  target: string;
  environment: string;
  missingFields: Array<'target' | 'environment'>;
  reason: 'new_deployment_request' | 'deployment_field_update' | 'negated_or_discussion' | 'no_deployment_intent';
}

export interface DeploymentIntentContext {
  hasActiveRequest?: boolean;
}

const DEPLOYMENT_KEYWORDS = [
  '部署',
  '上线',
  '发布',
  'deploy',
  'deployment',
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

export function detectDeploymentIntent(input: string, context: DeploymentIntentContext = {}): DeploymentIntent {
  const text = String(input || '').trim();
  if (!text) {
    return {
      shouldConfirm: false,
      target: '',
      environment: '',
      missingFields: [],
      reason: 'no_deployment_intent'
    };
  }

  if (NEGATED_OR_DISCUSSION.test(text)) {
    return {
      shouldConfirm: false,
      target: '',
      environment: '',
      missingFields: [],
      reason: 'negated_or_discussion'
    };
  }

  const hasKeyword = hasDeploymentKeyword(text);
  const hasActiveRequest = context.hasActiveRequest === true;
  if (!hasKeyword && !hasActiveRequest) {
    return {
      shouldConfirm: false,
      target: '',
      environment: '',
      missingFields: [],
      reason: 'no_deployment_intent'
    };
  }

  const target = detectTarget(text, hasActiveRequest);
  const environment = detectEnvironment(text);
  const hasFieldSignal = target !== '待确认目标' || environment !== '待确认环境';
  if (!hasKeyword && !hasActiveRequest) {
    return {
      shouldConfirm: false,
      target: '',
      environment: '',
      missingFields: [],
      reason: 'no_deployment_intent'
    };
  }
  if (hasActiveRequest && !hasKeyword && !hasFieldSignal) {
    return {
      shouldConfirm: false,
      target: '',
      environment: '',
      missingFields: [],
      reason: 'no_deployment_intent'
    };
  }

  return {
    shouldConfirm: true,
    target,
    environment,
    missingFields: missingFieldsFor(target, environment),
    reason: hasActiveRequest ? 'deployment_field_update' : 'new_deployment_request'
  };
}
