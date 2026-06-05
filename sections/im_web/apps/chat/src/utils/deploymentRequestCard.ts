import type {
  ClowderDeploymentEnvironmentCandidate,
  ClowderDeploymentRequest,
  ClowderDeploymentTargetCandidate,
  Message,
} from '@tsdaodao/datasource-vue';

export interface DeploymentCardMessageContext {
  channelType: number;
  currentUserId?: string;
  robotId?: string;
  sourceText: string;
  sourceMessageId?: string;
  targetCatIds?: string[];
  triggerReason?: string;
  promptContext?: string;
  catId?: string;
  catDisplayName?: string;
  error?: string;
}

export interface DeploymentWorkspaceLike {
  id?: string;
  workspaceId?: string;
  displayName?: string;
  relativePath?: string;
  rootPath?: string;
}

export const DEFAULT_DEPLOYMENT_ENVIRONMENT_CANDIDATES: ClowderDeploymentEnvironmentCandidate[] = [
  { id: 'local', label: '本地', value: 'local' },
  { id: 'preview', label: '预览', value: 'preview' },
  { id: 'testing', label: '测试', value: 'testing' },
  { id: 'staging', label: '预发', value: 'staging' },
  { id: 'production', label: '生产', value: 'production' },
];

function deploymentStatusLabel(status: string) {
  if (status === 'needs_fields') return '需要补充信息';
  if (status === 'submitting') return '提交中';
  if (status === 'confirmed' || status === 'queued') return '已排队';
  if (status === 'running') return '部署中';
  if (status === 'succeeded') return '部署成功';
  if (status === 'failed') return '部署失败';
  if (status === 'cancelled' || status === 'canceled') return '已取消';
  return '待确认';
}

function deploymentDisabledReason(request: ClowderDeploymentRequest, error?: string) {
  if (error) return error;
  if (request.missingFields.length > 0) {
    return `请先补充${request.missingFields.map((field) => field === 'target' ? '部署目标' : '部署环境').join('、')}`;
  }
  if (request.status === 'cancelled') return '已取消部署';
  if (request.status === 'succeeded') return '部署已完成';
  return '';
}

export function getDeploymentCardClientMsgNo(deploymentRequestId: string) {
  return `deployment-card-${deploymentRequestId}`;
}

export function buildDeploymentTargetCandidates(
  workspace?: DeploymentWorkspaceLike | null,
  currentTarget?: string | null,
  extraCandidates: ClowderDeploymentTargetCandidate[] = [],
): ClowderDeploymentTargetCandidate[] {
  const candidates: ClowderDeploymentTargetCandidate[] = [];
  const seen = new Set<string>();
  const pushCandidate = (candidate: ClowderDeploymentTargetCandidate | null | undefined) => {
    if (!candidate?.value) return;
    const value = String(candidate.value).trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    candidates.push({
      id: candidate.id || value,
      label: candidate.label || value,
      value,
      source: candidate.source || 'text',
      ...(candidate.workspaceId ? { workspaceId: candidate.workspaceId } : {}),
      ...(candidate.path ? { path: candidate.path } : {}),
    });
  };

  if (workspace) {
    const workspaceValue = String(workspace.relativePath || workspace.rootPath || workspace.displayName || workspace.id || workspace.workspaceId || '').trim();
    pushCandidate({
      id: workspace.workspaceId || workspace.id || workspaceValue,
      label: workspace.displayName || workspaceValue,
      value: workspaceValue,
      source: 'active_workspace',
      ...(workspace.workspaceId ? { workspaceId: workspace.workspaceId } : workspace.id ? { workspaceId: workspace.id } : {}),
      ...(workspace.relativePath ? { path: workspace.relativePath } : workspace.rootPath ? { path: workspace.rootPath } : {}),
    });
  }

  if (currentTarget) {
    pushCandidate({
      id: currentTarget,
      label: currentTarget,
      value: currentTarget,
      source: 'text',
    });
  }

  for (const candidate of extraCandidates) {
    pushCandidate(candidate);
  }

  return candidates;
}

export function buildDeploymentCardMessage(
  deploymentRequest: ClowderDeploymentRequest,
  context: DeploymentCardMessageContext,
): Message {
  const clientMsgNo = getDeploymentCardClientMsgNo(deploymentRequest.id);
  const fromUID = context.channelType === 2
    ? (context.currentUserId || context.robotId || 'clowder_ai')
    : (context.robotId || 'clowder_ai');
  const disabledReason = deploymentDisabledReason(deploymentRequest, context.error);

  return {
    messageID: clientMsgNo,
    messageSeq: 0,
    clientMsgNo,
    fromUID,
    timestamp: Math.floor(Date.now() / 1000),
    content: {
      type: 7,
      cardType: 'deployment',
      title: '确认部署',
      statusLabel: deploymentStatusLabel(deploymentRequest.status),
      target: deploymentRequest.target || '待确认目标',
      environment: deploymentRequest.environment || '待确认环境',
      workspaceId: deploymentRequest.workspaceId,
      workspacePath: deploymentRequest.workspacePath,
      status: deploymentRequest.status,
      deploymentRequestId: deploymentRequest.id,
      deploymentJobId: deploymentRequest.deploymentJobId,
      previewUrl: deploymentRequest.previewUrl,
      downloadUrl: deploymentRequest.downloadUrl,
      logsSummary: deploymentRequest.logsSummary,
      failureReason: deploymentRequest.failureReason,
      containerPlan: deploymentRequest.containerPlan,
      missingFields: deploymentRequest.missingFields,
      disabledReason,
      connectorId: 'im-web',
      catId: context.catId,
      catDisplayName: context.catDisplayName,
      targetCandidates: deploymentRequest.targetCandidates,
      environmentCandidates: deploymentRequest.environmentCandidates,
      confirmText: '确认',
      cancelText: '取消',
      deploymentRequest: {
        deploymentRequestId: deploymentRequest.id,
        text: context.sourceText,
        sourceMessageId: context.sourceMessageId || deploymentRequest.sourceMessageId || clientMsgNo,
        workspaceId: deploymentRequest.workspaceId,
        workspacePath: deploymentRequest.workspacePath,
        targetCatIds: context.targetCatIds || [],
        triggerReason: context.triggerReason,
        promptContext: context.promptContext,
      },
      error: context.error || '',
    },
    isRevoked: false,
    status: 'success',
  };
}
