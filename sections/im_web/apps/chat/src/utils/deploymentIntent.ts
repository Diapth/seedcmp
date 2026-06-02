export interface DeploymentIntent {
  shouldConfirm: boolean;
  target: string;
  environment: string;
  reason: 'deployment_request' | 'negated_or_discussion' | 'no_deployment_intent';
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

function detectEnvironment(text: string) {
  if (/(生产|线上|prod|production)/i.test(text)) return 'production';
  if (/(预发|staging|stage|uat)/i.test(text)) return 'staging';
  if (/(测试|test|testing)/i.test(text)) return 'testing';
  if (/(开发|dev|development)/i.test(text)) return 'development';
  return '待确认环境';
}

function detectTarget(text: string) {
  const english = text.match(/\bdeploy\s+([a-z0-9_.:/-]{2,80})(?:\s+to\b|\s*$)/i);
  if (english?.[1]) return english[1];
  const chinese = text.match(/(?:部署|上线|发布)\s*([a-zA-Z0-9_.:/-]{2,80}|[\u4e00-\u9fa5][\u4e00-\u9fa5a-zA-Z0-9_.:/-]{1,40})/);
  if (chinese?.[1] && !/(到|至|生产|线上|预发|测试|开发|环境)/.test(chinese[1])) return chinese[1];
  return '待确认目标';
}

export function detectDeploymentIntent(input: string): DeploymentIntent {
  const text = String(input || '').trim();
  if (!text || !DEPLOYMENT_KEYWORDS.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))) {
    return {
      shouldConfirm: false,
      target: '',
      environment: '',
      reason: 'no_deployment_intent'
    };
  }

  if (NEGATED_OR_DISCUSSION.test(text)) {
    return {
      shouldConfirm: false,
      target: '',
      environment: '',
      reason: 'negated_or_discussion'
    };
  }

  return {
    shouldConfirm: true,
    target: detectTarget(text),
    environment: detectEnvironment(text),
    reason: 'deployment_request'
  };
}
