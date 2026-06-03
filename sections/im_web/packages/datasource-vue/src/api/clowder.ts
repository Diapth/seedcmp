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

export interface ClowderDeploymentActionRequest extends ClowderConversationRef {
  deploymentRequestId: string;
  action: 'confirm' | 'cancel';
  actionId: string;
  cardMessageId?: string;
  sourceMessageId?: string;
  target?: string;
  environment?: string;
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
  status: 'confirmed' | 'cancelled' | 'needs_fields' | 'failed';
  missingFields?: string[];
  message?: string;
  actionId?: string;
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
  sendDeploymentAction(data: ClowderDeploymentActionRequest) {
    return apiClient.post<ClowderDeploymentActionResponse>('clowder/conversation/deployment-action', data);
  },
  syncGroupCats(data: ClowderGroupCatSyncRequest) {
    return apiClient.post<Record<string, unknown>>('clowder/group/cats/sync', data);
  },
  getGroupCats(params: { groupId: string }) {
    return apiClient.get<ClowderGroupCatStateResponse>('clowder/group/cats', { params });
  },
  allowGroup(params: ClowderConversationRef) {
    return apiClient.post<IMConnectorPermission>('clowder/group/allow', params);
  },
  denyGroup(params: ClowderConversationRef) {
    return apiClient.post<IMConnectorPermission>('clowder/group/deny', params);
  }
};
