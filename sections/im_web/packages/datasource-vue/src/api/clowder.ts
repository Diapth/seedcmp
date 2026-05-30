import { apiClient } from '@tsdaodao/base-vue';

export type ClowderConnectorId = 'im-web';
export type ClowderChannelType = 1 | 2;
export type ClowderChatType = 'direct' | 'group';

export type ClowderConnectionState = 'disabled' | 'unconfigured' | 'connecting' | 'ready' | 'denied' | 'error';
export type ClowderBindingStatus = 'active' | 'disabled' | 'orphaned' | 'failed';
export type ClowderDeliveryState = 'queued' | 'dispatched' | 'streaming' | 'delivered' | 'skipped' | 'duplicate' | 'failed' | 'full';
export type ClowderRoutingMode = 'mention' | 'ask' | 'focus' | 'preferred' | 'last-active' | 'default';
export type ClowderStreamState = 'placeholder' | 'chunk' | 'final' | 'cleanup';

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
  mentionPatterns: string[];
  available: boolean;
  lastActiveAt?: number;
  messageCount?: number;
  preferred?: boolean;
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

export interface ClowderBindRequest extends ClowderConversationRef {
  threadId?: string;
  title?: string;
}

export interface ClowderFocusRequest extends ClowderConversationRef {
  catId?: string;
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
  bindConversation(data: ClowderBindRequest) {
    return apiClient.post<IMConnectorBinding>('clowder/conversation/bind', data);
  },
  setFocus(data: ClowderFocusRequest) {
    return apiClient.post<ClowderConversationStateResponse>('clowder/conversation/focus', data);
  },
  clearFocus(params: ClowderConversationRef) {
    return apiClient.post<ClowderConversationStateResponse>('clowder/conversation/focus/clear', params);
  },
  allowGroup(params: ClowderConversationRef) {
    return apiClient.post<IMConnectorPermission>('clowder/group/allow', params);
  },
  denyGroup(params: ClowderConversationRef) {
    return apiClient.post<IMConnectorPermission>('clowder/group/deny', params);
  }
};
