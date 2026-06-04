import type {
  ClowderAgent,
  ClowderCatSource,
  ClowderConnectionState,
  ClowderConnectionStatus,
  ClowderDeliveryState,
  ClowderLastDeliveryState,
  ClowderRoutingMode,
  ClowderStreamState,
  IMConnectorBinding,
  IMConnectorPermission
} from '../api/clowder';
import type { ClowderCatContact } from './clowderCatContacts';

export type {
  ClowderAgent,
  ClowderCatSource,
  ClowderConnectionState,
  ClowderConnectionStatus,
  ClowderDeliveryState,
  ClowderLastDeliveryState,
  ClowderRoutingMode,
  ClowderStreamState,
  IMConnectorBinding,
  IMConnectorPermission
};

export type { ClowderCatContact };

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

/**
 * Mirror of `CoordinatorKickoff` in `packages/shared/src/types/coordination.ts`
 * (sections/clowder-ai). One record per coordinationId, surfaced as a
 * "Create Project Group Chat?" card. im_web and clowder-ai are separate
 * submodules so we mirror the type rather than import across the boundary.
 */
export interface CoordinatorKickoff {
  coordinationId: string;
  messageId: string;
  suggestedCats: readonly string[];
  reason?: string;
  workspaceProposal?: {
    displayName: string;
    slug: string;
    rootPath: string;
    relativePath: string;
    sourceIntent: string;
    confidence: number;
    collision?: 'none' | 'existing_active' | 'existing_archived' | 'slug_taken';
    existingWorkspaceId?: string;
  };
  createdAt: number;
}
