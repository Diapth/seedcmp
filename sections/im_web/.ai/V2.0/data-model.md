# Data Model: IM Web V2.0 Completion

## Conversation
- Fields: `id`, `type`, `title`, `avatar`, `lastMessage`, `lastMessageTime`, `unreadCount`, `draft`, `pinned`, `muted`, `mentionCount`, `recoveryState`
- Relationships: contains many `Message` records; belongs to one direct peer or one `Group`
- Rules: ordering must use server-backed message time; unread and mention counts must survive refresh and reconnect

## Message
- Fields: `id`, `conversationId`, `senderId`, `contentType`, `content`, `status`, `createdAt`, `updatedAt`, `deletedAt`, `revokedAt`, `replyTo`, `mentions`, `reactions`, `receiptState`, `mediaMeta`
- Relationships: belongs to one `Conversation`; may reference another `Message` through `replyTo`
- Rules: outgoing messages need pending/sent/failed states; system messages must not be rendered as normal user chatter; duplicate visible messages must be prevented during sync overlap

## Group
- Fields: `id`, `name`, `avatar`, `ownerId`, `adminIds`, `memberCount`, `announcement`, `saved`, `muted`, `blacklistState`, `inviteMode`, `joinMode`, `lifecycleState`
- Relationships: contains many `GroupMember` rows and can back one `Conversation`
- Rules: owner-only and manager-only actions must be gated visibly; invitation and QR flows need explicit success, approval, expired, and denied states

## GroupMember
- Fields: `groupId`, `userId`, `displayName`, `role`, `muteState`, `joinSource`, `status`, `permissionFlags`
- Relationships: belongs to one `Group`
- Rules: permissions may need fallback from group summary to member role; member state must stay in sync with settings and management actions

## UserProfile
- Fields: `userId`, `name`, `avatar`, `shortId`, `qrCodeState`, `devices`, `notificationSettings`, `securitySettings`
- Relationships: drives identity across conversations, contacts, and settings pages
- Rules: updates must flow into visible chat identity after refresh

## RealtimeSession
- Fields: `connectionState`, `reconnectState`, `kickoutState`, `pendingQueue`, `lastSyncAt`, `lastError`
- Relationships: controls the active SDK session and recovery state
- Rules: offline or reconnecting work must be preserved and either replayed or marked failed with recovery guidance

## SearchResult
- Fields: `category`, `targetId`, `targetType`, `title`, `subtitle`, `routeTarget`, `context`
- Relationships: can point to a conversation, person, group, or message
- Rules: results must be grouped and actionable

## WorkplaceApp
- Fields: `id`, `name`, `icon`, `banner`, `category`, `route`, `order`, `recentUseState`
- Relationships: grouped under workplace surfaces
- Rules: unsupported workplace content should remain hidden or unavailable, not broken

## RobotInteraction
- Fields: `id`, `robotId`, `mode`, `payload`, `status`, `streamState`, `ackState`
- Relationships: attached to a conversation interaction
- Rules: robot UI must not disrupt normal chat flow

## Report
- Fields: `id`, `targetType`, `targetId`, `category`, `description`, `attachments`, `status`
- Relationships: submitted from a conversation, group, or user context
- Rules: reporting must preserve core chat state even if submission fails
