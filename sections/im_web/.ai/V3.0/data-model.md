# Data Model: IM Web V3.0 Clowder Multi-Agent Connector

## IMConnectorBinding

- Fields: `connectorId`, `externalChatId`, `channelId`, `channelType`, `threadId`, `userId`, `hubThreadId`, `createdAt`, `updatedAt`, `status`
- Relationships: maps one TangSeng direct or group conversation to one active Clowder thread; may have one connector hub thread
- Validation: `connectorId` is `im-web`; `externalChatId` uses `{channelType}:{channelId}`; `threadId` must be returned by Clowder; `status` is `active`, `disabled`, `orphaned`, or `failed`

## IMConnectorMessage

- Fields: `connectorId`, `externalChatId`, `messageId`, `clientMsgNo`, `messageSeq`, `senderId`, `senderName`, `chatType`, `chatName`, `text`, `attachments`, `mentions`, `timestamp`
- Relationships: created from one TangSeng message; routed to one Clowder thread through `IMConnectorBinding`
- Validation: dedup key uses `connectorId`, `externalChatId`, and stable `messageId` or `clientMsgNo`; sender must be present for group chats; unsupported attachments are marked unavailable

## ClowderAgent

- Fields: `catId`, `displayName`, `mentionPatterns`, `available`, `lastActiveAt`, `messageCount`, `preferred`
- Relationships: returned by Clowder thread-cats/cat registry APIs; can be selected by mention, `/ask`, `/focus`, or UI control
- Validation: `catId` must exist in Clowder `catRegistry`; mention aliases must be unique after normalization

## AgentRoutingDecision

- Fields: `threadId`, `messageId`, `targetCatIds`, `routingMode`, `matchedMention`, `commandKind`, `fallbackReason`
- Relationships: produced during inbound routing; attached to delivery/debug state
- Validation: `routingMode` is `mention`, `ask`, `focus`, `preferred`, `last-active`, or `default`; `targetCatIds` must not include unavailable cats unless Clowder explicitly queues them

## IMConnectorPermission

- Fields: `connectorId`, `externalChatId`, `whitelistEnabled`, `allowed`, `adminOnlyCommands`, `adminSenderIds`, `sourceRoleSnapshot`, `updatedAt`
- Relationships: controls whether a TangSeng group can route to Clowder and who can run commands
- Validation: denied groups must not create or mutate thread bindings; admin sender IDs should reconcile TangSeng owner/manager roles with Clowder permission store

## ClowderReply

- Fields: `threadId`, `invocationId`, `catId`, `content`, `richBlocks`, `origin`, `triggerMessageId`, `streamState`, `deliveryState`, `timestamp`
- Relationships: emitted by Clowder outbound/streaming hooks and delivered to one or more TangSeng conversations through bindings
- Validation: final replies must be durable in TangSeng; streaming updates must map to one stable IM message; unsupported rich blocks must degrade safely

## DeliveryState

- Fields: `bridgeMessageId`, `externalChatId`, `threadId`, `invocationId`, `state`, `attemptCount`, `lastError`, `lastUpdatedAt`
- Relationships: tracks one inbound or outbound bridge operation
- Validation: `state` is `queued`, `dispatched`, `streaming`, `delivered`, `skipped`, `duplicate`, `failed`, or `full`; failures must expose retry/unavailable UI where user-actionable

## ConnectorHubThread

- Fields: `threadId`, `connectorId`, `externalChatId`, `title`, `lastCommandAt`, `systemKind`
- Relationships: stores slash command exchanges separately from normal conversation routing
- Validation: hub thread must be lazily created and linked through `hubThreadId`; command history should not duplicate in normal IM conversation history

## ClowderConnectionStatus

- Fields: `enabled`, `configured`, `reachable`, `version`, `lastHealthCheckAt`, `lastError`, `featureFlags`
- Relationships: drives IM Web Clowder settings UI and bridge availability
- Validation: missing secret, missing base URL, failed health check, or disabled feature flag must render disabled/unavailable controls
