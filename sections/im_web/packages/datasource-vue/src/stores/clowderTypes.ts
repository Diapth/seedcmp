import type {
  ClowderAgent,
  ClowderConnectionState,
  ClowderConnectionStatus,
  ClowderDeliveryState,
  ClowderLastDeliveryState,
  ClowderRoutingMode,
  ClowderStreamState,
  IMConnectorBinding,
  IMConnectorPermission
} from '../api/clowder';

export type {
  ClowderAgent,
  ClowderConnectionState,
  ClowderConnectionStatus,
  ClowderDeliveryState,
  ClowderLastDeliveryState,
  ClowderRoutingMode,
  ClowderStreamState,
  IMConnectorBinding,
  IMConnectorPermission
};

export interface ClowderAgentDirectoryState {
  agents: ClowderAgent[];
  loading: boolean;
  error?: string;
  lastLoadedAt?: number;
}

export interface ClowderConversationPanelState {
  channelId: string;
  channelType: number;
  status: ClowderConnectionStatus;
  binding?: IMConnectorBinding;
  permission?: IMConnectorPermission;
  focusCatId?: string;
  lastDelivery?: ClowderLastDeliveryState;
  agentDirectory: ClowderAgentDirectoryState;
  disabledReason?: string;
}

export interface ClowderReplyPresentation {
  agentDisplayName: string;
  connectorBadge: boolean;
  markdown: string;
  streaming: boolean;
  deliveryState?: ClowderDeliveryState;
  retryable: boolean;
}

export interface ClowderRoutingDecision {
  threadId: string;
  messageId: string;
  targetCatIds: string[];
  routingMode: ClowderRoutingMode;
  matchedMention?: string;
  commandKind?: string;
  fallbackReason?: string;
}

export interface ClowderStreamEnvelope {
  invocationId: string;
  platformMessageId?: string;
  state: ClowderStreamState;
  content?: string;
  final?: boolean;
}
