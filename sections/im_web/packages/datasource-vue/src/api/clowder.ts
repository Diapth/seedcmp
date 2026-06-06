import { apiClient } from '@tsdaodao/base-vue';

export type ClowderConnectorId = 'im-web';
export type ClowderChannelType = 1 | 2;
export type ClowderChatType = 'direct' | 'group';

export type ClowderConnectionState = 'disabled' | 'unconfigured' | 'connecting' | 'ready' | 'denied' | 'error';
export type ClowderBindingStatus = 'active' | 'disabled' | 'orphaned' | 'failed';
export type ClowderDeliveryState = 'queued' | 'dispatched' | 'streaming' | 'delivered' | 'skipped' | 'duplicate' | 'failed' | 'full';
export type ClowderRoutingMode = 'mention' | 'ask' | 'focus' | 'preferred' | 'last-active' | 'default';
export type ClowderStreamState = 'placeholder' | 'chunk' | 'final' | 'cleanup';
export type ClowderCatSource = 'existing' | 'runtime-created' | 'disconnected' | 'stale';
export type ClowderGroupAutoReplyMode = 'off' | 'mentions_only' | 'soft_mentions';
export type ClowderTaskStatus = 'todo' | 'doing' | 'blocked' | 'done';
export type ClowderCoordinationStatus =
  | 'planning'
  | 'dispatching'
  | 'running'
  | 'aggregating'
  | 'succeeded'
  | 'failed'
  | 'cancelled';
export type ClowderCoordinationDispatchMode = 'parallel' | 'serial' | 'mixed';
export type ClowderCoordinationSubtaskStatus = 'todo' | 'doing' | 'blocked' | 'done' | 'failed' | 'cancelled';

export interface ClowderConversationRef {
  channelId: string;
  channelType: ClowderChannelType;
}

export interface ClowderConnectionStatus {
  enabled: boolean;
  configured: boolean;
  reachable: boolean;
  state: ClowderConnectionState;
  version?: string;
  lastHealthCheckAt?: number;
  lastError?: string;
  featureFlags?: Record<string, boolean>;
}

export interface IMConnectorBinding {
  connectorId: ClowderConnectorId;
  externalChatId: string;
  channelId: string;
  channelType: ClowderChannelType;
  threadId: string;
  userId: string;
  hubThreadId?: string;
  createdAt?: number;
  updatedAt?: number;
  status: ClowderBindingStatus;
}

export interface ClowderAgent {
  catId: string;
  displayName: string;
  aliases?: string[];
  mentionPatterns: string[];
  avatar?: string;
  personalitySummary?: string;
  capabilitySummary?: string;
  available: boolean;
  availabilityState?: 'available' | 'unavailable' | 'stale';
  source?: ClowderCatSource;
  connected?: boolean;
  lastActiveAt?: number;
  messageCount?: number;
  preferred?: boolean;
}

export interface ClowderCatRoleTemplate {
  roleTemplateId: string;
  catId: string;
  logicalKey?: string;
  displayName: string;
  aliases?: string[];
  mentionPatterns?: string[];
  avatar?: string;
  personalitySummary?: string;
  capabilitySummary?: string;
  cloneable: boolean;
  unavailableReason?: string;
  source?: 'role-template' | ClowderCatSource;
}

export interface ClowderClientDefaultModels {
  defaultModel?: string;
  models?: string[];
}

export interface ClowderPlatformModelOption {
  id: string;
  label: string;
  default?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export type ClowderLocalOAuthProvider = 'codex' | 'claude';
export type ClowderSkillProvider = ClowderLocalOAuthProvider | 'gemini' | 'kimi';

export interface ClowderSkillMcpDependency {
  id: string;
  status: 'ready' | 'missing' | 'unresolved' | string;
}

export interface ClowderSkillEntry {
  name: string;
  category?: string;
  trigger?: string;
  description?: string;
  mounted?: boolean;
  requiresMcp?: ClowderSkillMcpDependency[];
}

export type ClowderSkillCatalog = Partial<Record<ClowderSkillProvider, ClowderSkillEntry[]>>;

export interface ClowderLocalOAuthConfigFile {
  path: string;
  exists: boolean;
  readable: boolean;
}

export interface ClowderLocalOAuthConfigSummary {
  provider: ClowderLocalOAuthProvider;
  authConfigured: boolean;
  configPresent: boolean;
  configFiles: ClowderLocalOAuthConfigFile[];
  defaultModel?: string;
  profile?: string;
  diagnostics?: string[];
}

export interface ClowderLocalOAuthCapabilitiesResponse {
  providers: ClowderLocalOAuthConfigSummary[];
}

export interface IMConnectorPermission {
  connectorId: ClowderConnectorId;
  externalChatId: string;
  whitelistEnabled: boolean;
  allowed: boolean;
  adminOnlyCommands: boolean;
  adminSenderIds: string[];
  sourceRoleSnapshot?: Record<string, unknown>;
  updatedAt?: number;
}

export interface ClowderLastDeliveryState {
  bridgeMessageId?: string;
  externalChatId: string;
  threadId?: string;
  invocationId?: string;
  state: ClowderDeliveryState;
  attemptCount?: number;
  lastError?: string;
  lastUpdatedAt?: number;
}

export interface ClowderConversationStateResponse {
  status: ClowderConnectionStatus;
  binding?: IMConnectorBinding;
  agents: ClowderAgent[];
  permission?: IMConnectorPermission;
  focusCatId?: string;
  lastDelivery?: ClowderLastDeliveryState;
  disabledReason?: string;
}

export interface ClowderAgentDirectoryResponse {
  agents: ClowderAgent[];
  preferredCatIds?: string[];
  lastActiveCatId?: string;
}

export interface ClowderCatDirectoryResponse {
  agents: ClowderAgent[];
  templates?: ClowderCatRoleTemplate[];
  clientDefaults?: Record<string, ClowderClientDefaultModels>;
  skillCatalog?: ClowderSkillCatalog;
}

export interface ClowderBindRequest extends ClowderConversationRef {
  threadId?: string;
  title?: string;
}

export interface ClowderFocusRequest extends ClowderConversationRef {
  catId?: string;
}

export interface ClowderMessageRequest extends ClowderConversationRef {
  text: string;
  directCatId?: string;
  targetCatIds?: string[];
  promptContext?: string;
}

export type ClowderDeploymentEnvironment = 'local' | 'preview' | 'testing' | 'staging' | 'production' | 'development';
export type ClowderDeploymentRequestStatus =
  | 'needs_fields'
  | 'pending_confirmation'
  | 'confirmed'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';
export type ClowderDeploymentMissingField = 'target' | 'environment';

export interface ClowderDeploymentTargetCandidate {
  id: string;
  label: string;
  value: string;
  source: 'active_workspace' | 'recent_workspace' | 'artifact' | 'preview' | 'task' | 'text';
  workspaceId?: string;
  path?: string;
}

export interface ClowderDeploymentEnvironmentCandidate {
  id: ClowderDeploymentEnvironment;
  label: string;
  value: ClowderDeploymentEnvironment;
}

export interface ClowderDeploymentRequest {
  id: string;
  userId: string;
  connectorId: ClowderConnectorId;
  channelId: string;
  channelType: ClowderChannelType;
  threadId?: string;
  externalChatId?: string;
  sourceMessageId?: string;
  cardMessageId?: string;
  originalText: string;
  target: string | null;
  environment: ClowderDeploymentEnvironment | null;
  missingFields: ClowderDeploymentMissingField[];
  status: ClowderDeploymentRequestStatus;
  targetCandidates: ClowderDeploymentTargetCandidate[];
  environmentCandidates: ClowderDeploymentEnvironmentCandidate[];
  workspaceId?: string;
  workspacePath?: string;
  deploymentJobId?: string;
  previewUrl?: string;
  downloadUrl?: string;
  logsSummary?: string[];
  failureReason?: string;
  containerPlan?: {
    dockerfilePath: string;
    imageName: string;
    executed: false;
    reason: string;
  };
  createdAt: number;
  updatedAt: number;
}

export interface ClowderCreateDeploymentRequest extends ClowderConversationRef {
  threadId?: string;
  externalChatId?: string;
  sourceMessageId?: string;
  cardMessageId?: string;
  originalText: string;
  target?: string | null;
  environment?: ClowderDeploymentEnvironment | string | null;
  targetCandidates?: ClowderDeploymentTargetCandidate[];
  environmentCandidates?: ClowderDeploymentEnvironmentCandidate[];
  workspaceId?: string;
  workspacePath?: string;
  forceNew?: boolean;
}

export interface ClowderUpdateDeploymentRequest {
  target?: string | null;
  environment?: ClowderDeploymentEnvironment | string | null;
  sourceMessageId?: string;
  cardMessageId?: string;
  targetCandidates?: ClowderDeploymentTargetCandidate[];
  workspaceId?: string;
  workspacePath?: string;
}

export interface ClowderDeploymentRequestResponse {
  deploymentRequest: ClowderDeploymentRequest;
  activeRequestExists?: boolean;
  duplicate?: boolean;
}

export interface ClowderDeploymentActionRequest extends ClowderConversationRef {
  deploymentRequestId: string;
  action: 'confirm' | 'cancel';
  actionId: string;
  cardMessageId?: string;
  sourceMessageId?: string;
  target?: string;
  environment?: string;
  workspaceId?: string;
  missingFields?: string[];
  directCatId?: string;
  targetCatIds?: string[];
  promptContext?: string;
  originalText?: string;
}

export interface ClowderDeploymentActionResponse {
  ok: boolean;
  deploymentRequestId: string;
  action: 'confirm' | 'cancel';
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'needs_fields';
  missingFields?: string[];
  message?: string;
  actionId?: string;
  deploymentRequest?: ClowderDeploymentRequest;
}

export interface ClowderCoordinationSubtask {
  id: string;
  title: string;
  description?: string;
  targetCatId?: string;
  status: ClowderCoordinationSubtaskStatus;
  artifactRefs: string[];
  dependsOn: string[];
  result?: string;
  failureReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ClowderCoordination {
  coordinationId: string;
  threadId: string;
  sourceMessageId?: string;
  createdBy: string;
  status: ClowderCoordinationStatus;
  goal: string;
  assumptions: string[];
  subtasks: ClowderCoordinationSubtask[];
  targetCatIds: string[];
  dispatchMode: ClowderCoordinationDispatchMode;
  aggregateSummary?: string;
  failureReason?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface ClowderCreateCoordinationRequest {
  coordinationId?: string;
  threadId: string;
  sourceMessageId?: string;
  createdBy?: string;
  goal: string;
  assumptions?: string[];
  subtasks?: Array<Partial<ClowderCoordinationSubtask> & { title: string }>;
  targetCatIds?: string[];
  dispatchMode?: ClowderCoordinationDispatchMode;
  status?: ClowderCoordinationStatus;
  idempotencyKey?: string;
}

export interface ClowderUpdateCoordinationRequest {
  status?: ClowderCoordinationStatus;
  assumptions?: string[];
  subtasks?: Array<Partial<ClowderCoordinationSubtask> & { title: string }>;
  targetCatIds?: string[];
  dispatchMode?: ClowderCoordinationDispatchMode;
  aggregateSummary?: string;
  failureReason?: string;
}

export interface ClowderCoordinationResponse {
  coordination: ClowderCoordination;
  duplicate?: boolean;
}

export interface ClowderThreadCoordinationsResponse {
  threadId: string;
  coordinations: ClowderCoordination[];
}

export interface ClowderCreateCatRequest {
  name: string;
  alias?: string;
  roleTemplateId?: string;
  clientId: 'openai' | 'anthropic';
  authType: 'api_key' | 'oauth';
  accountRef: string;
  defaultModel?: string;
  personality?: string;
  capabilities?: string[];
}

export interface ClowderCatContactResponse {
  agent: ClowderAgent;
  contact?: {
    connected?: boolean;
    source?: ClowderCatSource;
  };
}

export interface ClowderDeleteCatResponse {
  deleted: boolean;
  id: string;
  updatedBy?: string;
}

export interface ClowderGroupCatSyncRequest {
  groupId: string;
  groupName: string;
  catIds: string[];
  cats?: ClowderAgent[];
  prompt: string;
  proactiveReplies?: boolean;
  autoReplyMode?: ClowderGroupAutoReplyMode;
}

export interface ClowderGroupCatStateResponse {
  groupId: string;
  groupName?: string;
  catIds: string[];
  cats?: ClowderAgent[];
  prompt?: string;
  proactiveReplies?: boolean;
  autoReplyMode?: ClowderGroupAutoReplyMode;
}

export interface ClowderProjectGroupBinding {
  id: string;
  userId: string;
  projectName: string;
  workspaceId?: string;
  pmDirectChannelId: string;
  pmDirectChannelType: ClowderChannelType;
  pmDirectThreadId?: string;
  projectGroupNo: string;
  projectThreadId?: string;
  pmMemberId: string;
  userMemberIds: string[];
  catMemberIds: string[];
  createdBy: 'pm' | 'system' | string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'archived' | string;
}

export interface ClowderEnsureProjectGroupRequest {
  projectName: string;
  workspaceId?: string;
  pmDirectChannelId: string;
  pmDirectChannelType: ClowderChannelType;
  pmDirectThreadId?: string;
  projectThreadId?: string;
  pmMemberId?: string;
  pmDisplayName?: string;
  userMemberIds?: string[];
  catMemberIds?: string[];
  createdBy?: 'pm' | 'system' | string;
}

export interface ClowderEnsureProjectGroupResponse {
  binding: ClowderProjectGroupBinding;
  group: {
    group_no: string;
    name: string;
    owner?: string;
    creator?: string;
    status?: number;
    role?: number;
    [key: string]: unknown;
  };
  reused?: boolean;
}

export interface ClowderProjectGroupBindingResponse {
  binding: ClowderProjectGroupBinding;
}

export interface ClowderProjectGroupThreadUpdateRequest {
  projectThreadId: string;
}

export interface ClowderThreadTask {
  id: string;
  kind?: string;
  threadId: string;
  title: string;
  ownerCatId: string | null;
  status: ClowderTaskStatus;
  why: string;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
  userId?: string;
  artifactRefs?: readonly string[];
  dependsOn?: readonly string[];
  coordinationId?: string;
  workspaceId?: string;
  workspaceRelativePath?: string;
}

export type ClowderThreadTaskDiagnosticsState =
  | 'ok'
  | 'success_empty'
  | 'thread_binding_mismatch'
  | 'created_task_missing';

export interface ClowderThreadTaskMismatchDiagnostic {
  taskId: string;
  expectedThreadId: string;
  actualThreadId: string;
  expectedWorkspaceId?: string | null;
  taskWorkspaceId?: string | null;
  threadWorkspaceMismatch?: boolean;
  title?: string;
  ownerCatId?: string | null;
  status?: string;
}

export interface ClowderThreadTaskDiagnostics {
  state: ClowderThreadTaskDiagnosticsState;
  taskCount: number;
  queryThreadId: string;
  activeWorkspaceId?: string | null;
  observedTaskIds: string[];
  missingTaskIds: string[];
  mismatchedTasks: ClowderThreadTaskMismatchDiagnostic[];
  workspaceMismatchedTaskIds?: string[];
}

export interface ClowderThreadTasksResponse {
  threadId: string;
  tasks: ClowderThreadTask[];
  diagnostics?: ClowderThreadTaskDiagnostics;
}

export interface ClowderThreadTasksRequestOptions {
  expectedTaskId?: string;
  observedTaskIds?: string[];
}

export type ClowderMaomiWorkspaceStatus = 'active' | 'archived' | 'discarded';

export interface ClowderMaomiWorkspace {
  id: string;
  workspaceId: string;
  userId?: string;
  slug: string;
  displayName: string;
  rootPath: string;
  relativePath: string;
  sourceIntent?: string;
  linkedThreadIds: string[];
  linkedTaskIds: string[];
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  status: ClowderMaomiWorkspaceStatus;
}

export interface ClowderWorkspaceProposal {
  displayName: string;
  slug: string;
  rootPath: string;
  relativePath: string;
  sourceIntent: string;
  confidence: number;
  collision?: 'none' | 'existing_active' | 'existing_archived' | 'slug_taken';
  existingWorkspaceId?: string;
}

export interface ClowderWorkspaceBinding {
  threadId: string;
  userId: string;
  activeWorkspaceId: string | null;
  recentWorkspaceIds: string[];
  updatedAt: number;
}

export interface ClowderWorkspaceBindingResponse {
  threadId: string;
  binding: ClowderWorkspaceBinding;
  activeWorkspace: ClowderMaomiWorkspace | null;
  diagnostics?: {
    state: 'ok' | 'no_active_workspace' | 'project_path_mismatch';
    threadProjectPath?: string | null;
    activeWorkspaceId?: string | null;
    activeWorkspaceRoot?: string | null;
  };
}

export interface ClowderWorkspaceRootResponse {
  workspaceRoot: string;
  rootPath: string;
  source: string;
  diagnostics?: {
    insideLaunchedProject?: boolean;
  };
}

function unwrapApiData<T>(response: T | { data?: T }): T {
  const maybeData = (response as { data?: T })?.data;
  return maybeData === undefined ? (response as T) : maybeData;
}

export const clowderApi = {
  getStatus() {
    return apiClient.get<ClowderConnectionStatus>('clowder/status');
  },
  getConversationState(params: ClowderConversationRef) {
    return apiClient.get<ClowderConversationStateResponse>('clowder/conversation', { params });
  },
  getAgentDirectory(params: ClowderConversationRef) {
    return apiClient.get<ClowderAgentDirectoryResponse>('clowder/conversation/agents', { params });
  },
  getCatDirectory(params?: { query?: string; includeUnavailable?: boolean }) {
    return apiClient.get<ClowderCatDirectoryResponse>('clowder/cats', { params });
  },
  getLocalAuthCapabilities() {
    return apiClient.get<ClowderLocalOAuthCapabilitiesResponse>('clowder/local-auth/capabilities');
  },
  connectCatContact(data: { catId: string }) {
    return apiClient.post<ClowderCatContactResponse>('clowder/cats/connect', data);
  },
  createCatAndConnect(data: ClowderCreateCatRequest) {
    return apiClient.post<ClowderCatContactResponse>('clowder/cats', data);
  },
  deleteCatContact(catId: string) {
    return apiClient.delete<ClowderDeleteCatResponse>(`clowder/cats/${encodeURIComponent(catId)}`);
  },
  bindConversation(data: ClowderBindRequest) {
    return apiClient.post<IMConnectorBinding>('clowder/conversation/bind', data);
  },
  setFocus(data: ClowderFocusRequest) {
    return apiClient.post<ClowderConversationStateResponse>('clowder/conversation/focus', data);
  },
  clearFocus(params: ClowderConversationRef) {
    return apiClient.post<ClowderConversationStateResponse>('clowder/conversation/focus/clear', params);
  },
  sendConversationMessage(data: ClowderMessageRequest) {
    return apiClient.post<Record<string, unknown>>('clowder/conversation/message', data);
  },
  async getThreadTasks(threadId: string, options: ClowderThreadTasksRequestOptions = {}) {
    const params: Record<string, string> = {};
    if (options.expectedTaskId) params.expectedTaskId = options.expectedTaskId;
    if (options.observedTaskIds?.length) params.observedTaskIds = options.observedTaskIds.join(',');
    const response = await apiClient.get<ClowderThreadTasksResponse>(
      `clowder/thread/${encodeURIComponent(threadId)}/tasks`,
      { params },
    );
    return unwrapApiData(response as unknown as ClowderThreadTasksResponse | { data?: ClowderThreadTasksResponse });
  },
  async getWorkspaceRoot() {
    const response = await apiClient.get<ClowderWorkspaceRootResponse>('clowder/maomi-workspaces/root');
    return unwrapApiData(response as unknown as ClowderWorkspaceRootResponse | { data?: ClowderWorkspaceRootResponse });
  },
  async proposeWorkspace(data: { intentText: string; threadId?: string }) {
    const response = await apiClient.post<{ proposal: ClowderWorkspaceProposal }>('clowder/maomi-workspaces/propose', data);
    return unwrapApiData(response as unknown as { proposal: ClowderWorkspaceProposal } | { data?: { proposal: ClowderWorkspaceProposal } });
  },
  async createWorkspace(data: {
    slug: string;
    displayName: string;
    sourceIntent?: string;
    createdBy?: 'user' | 'coordinator' | 'cat' | 'system';
    threadId?: string;
  }) {
    const response = await apiClient.post<{ workspace: ClowderMaomiWorkspace }>('clowder/maomi-workspaces', data);
    return unwrapApiData(response as unknown as { workspace: ClowderMaomiWorkspace } | { data?: { workspace: ClowderMaomiWorkspace } });
  },
  async listWorkspaces(params?: { status?: ClowderMaomiWorkspaceStatus }) {
    const response = await apiClient.get<{ workspaces: ClowderMaomiWorkspace[] }>('clowder/maomi-workspaces', { params });
    return unwrapApiData(response as unknown as { workspaces: ClowderMaomiWorkspace[] } | { data?: { workspaces: ClowderMaomiWorkspace[] } });
  },
  async getWorkspaceBinding(threadId: string) {
    const response = await apiClient.get<ClowderWorkspaceBindingResponse>(
      `clowder/thread/${encodeURIComponent(threadId)}/workspace-binding`,
    );
    return unwrapApiData(response as unknown as ClowderWorkspaceBindingResponse | { data?: ClowderWorkspaceBindingResponse });
  },
  async setWorkspaceBinding(threadId: string, data: { workspaceId: string | null; mirrorProjectPath?: boolean }) {
    const response = await apiClient.put<ClowderWorkspaceBindingResponse>(
      `clowder/thread/${encodeURIComponent(threadId)}/workspace-binding`,
      data,
    );
    return unwrapApiData(response as unknown as ClowderWorkspaceBindingResponse | { data?: ClowderWorkspaceBindingResponse });
  },
  createDeploymentRequest(data: ClowderCreateDeploymentRequest) {
    return apiClient.post<ClowderDeploymentRequestResponse>('clowder/conversation/deployment-request', data)
      .then((response) => unwrapApiData(response as unknown as ClowderDeploymentRequestResponse | { data?: ClowderDeploymentRequestResponse }));
  },
  updateDeploymentRequest(id: string, data: ClowderUpdateDeploymentRequest) {
    return apiClient.patch<ClowderDeploymentRequestResponse>(
      `clowder/conversation/deployment-request/${encodeURIComponent(id)}`,
      data,
    ).then((response) => unwrapApiData(response as unknown as ClowderDeploymentRequestResponse | { data?: ClowderDeploymentRequestResponse }));
  },
  async getActiveDeploymentRequest(params: ClowderConversationRef) {
    const response = await apiClient.get<ClowderDeploymentRequestResponse>(
      'clowder/conversation/deployment-request/active',
      { params },
    );
    return unwrapApiData(response as unknown as ClowderDeploymentRequestResponse | { data?: ClowderDeploymentRequestResponse });
  },
  async getDeploymentRequest(id: string) {
    const response = await apiClient.get<ClowderDeploymentRequestResponse>(
      `clowder/conversation/deployment-request/${encodeURIComponent(id)}`,
    );
    return unwrapApiData(response as unknown as ClowderDeploymentRequestResponse | { data?: ClowderDeploymentRequestResponse });
  },
  sendDeploymentAction(data: ClowderDeploymentActionRequest) {
    return apiClient.post<ClowderDeploymentActionResponse>('clowder/conversation/deployment-action', data);
  },
  async createCoordination(data: ClowderCreateCoordinationRequest) {
    const response = await apiClient.post<ClowderCoordinationResponse>('clowder/coordinator/coordination', data);
    return unwrapApiData(response as unknown as ClowderCoordinationResponse | { data?: ClowderCoordinationResponse });
  },
  async updateCoordination(coordinationId: string, data: ClowderUpdateCoordinationRequest) {
    const response = await apiClient.patch<ClowderCoordinationResponse>(
      `clowder/coordinator/coordination/${encodeURIComponent(coordinationId)}`,
      data,
    );
    return unwrapApiData(response as unknown as ClowderCoordinationResponse | { data?: ClowderCoordinationResponse });
  },
  async getCoordination(coordinationId: string) {
    const response = await apiClient.get<ClowderCoordinationResponse>(
      `clowder/coordinator/coordination/${encodeURIComponent(coordinationId)}`,
    );
    return unwrapApiData(response as unknown as ClowderCoordinationResponse | { data?: ClowderCoordinationResponse });
  },
  async listThreadCoordinations(threadId: string) {
    const response = await apiClient.get<ClowderThreadCoordinationsResponse>(
      `clowder/thread/${encodeURIComponent(threadId)}/coordinations`,
    );
    return unwrapApiData(response as unknown as ClowderThreadCoordinationsResponse | { data?: ClowderThreadCoordinationsResponse });
  },
  async cancelCoordination(coordinationId: string, reason?: string) {
    const response = await apiClient.post<ClowderCoordinationResponse>(
      `clowder/coordinator/coordination/${encodeURIComponent(coordinationId)}/cancel`,
      reason ? { reason } : {},
    );
    return unwrapApiData(response as unknown as ClowderCoordinationResponse | { data?: ClowderCoordinationResponse });
  },
  syncGroupCats(data: ClowderGroupCatSyncRequest) {
    return apiClient.post<Record<string, unknown>>('clowder/group/cats/sync', data);
  },
  getGroupCats(params: { groupId: string }) {
    return apiClient.get<ClowderGroupCatStateResponse>('clowder/group/cats', { params });
  },
  async ensureProjectGroup(data: ClowderEnsureProjectGroupRequest) {
    const response = await apiClient.post<ClowderEnsureProjectGroupResponse>('clowder/project-groups/ensure', data);
    return unwrapApiData(response as unknown as ClowderEnsureProjectGroupResponse | { data?: ClowderEnsureProjectGroupResponse });
  },
  async getActiveProjectGroup(params: {
    pmDirectChannelId: string;
    pmDirectChannelType: ClowderChannelType;
    projectName?: string;
  }) {
    const response = await apiClient.get<ClowderProjectGroupBindingResponse>('clowder/project-groups/active', { params });
    return unwrapApiData(response as unknown as ClowderProjectGroupBindingResponse | { data?: ClowderProjectGroupBindingResponse });
  },
  async updateProjectGroupThread(bindingId: string, data: ClowderProjectGroupThreadUpdateRequest) {
    const response = await apiClient.post<ClowderProjectGroupBindingResponse>(
      `clowder/project-groups/${encodeURIComponent(bindingId)}/thread`,
      data,
    );
    return unwrapApiData(response as unknown as ClowderProjectGroupBindingResponse | { data?: ClowderProjectGroupBindingResponse });
  },
  allowGroup(params: ClowderConversationRef) {
    return apiClient.post<IMConnectorPermission>('clowder/group/allow', params);
  },
  denyGroup(params: ClowderConversationRef) {
    return apiClient.post<IMConnectorPermission>('clowder/group/deny', params);
  }
};
