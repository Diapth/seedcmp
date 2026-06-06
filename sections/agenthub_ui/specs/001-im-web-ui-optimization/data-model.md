# Data Model: IM Web UI Optimization

## Navigation Item

- **Fields**: `id`, `label`, `icon`, `route`, `activeMatcher`, `badgeCount`, `desktopVisible`, `mobileVisible`, `androidVisible`, `order`
- **Relationships**: Points to one route contract entry; may derive badge from Conversation Preview or Agent state.
- **Validation**: Label must be valid Chinese text; icon must resolve through `AppIcon`; touch target must be at least 44px on mobile.

## Conversation Preview

- **Fields**: `id`, `channelId`, `channelType`, `name`, `avatarUrl`, `fallbackInitial`, `lastMessageDigest`, `lastMessageTime`, `unreadCount`, `pinned`, `muted`, `draftText`, `mentionState`, `syncState`
- **Relationships**: Opens one Chat View; references Message Items by channel key.
- **Validation**: Long names and digests must truncate or wrap without overlapping time and badges; unread count caps visually at `99+`.
- **State transitions**: `normal -> selected`, `normal -> pinned`, `normal -> muted`, `syncing -> failed -> retrying -> synced`.

## Message Item

- **Fields**: `id`, `channelId`, `channelType`, `senderId`, `senderName`, `senderAvatar`, `direction`, `contentType`, `contentPreview`, `timestamp`, `status`, `replyRef`, `reactions`, `actions`
- **Relationships**: Belongs to one conversation; may open File Preview, Image Lightbox, Context Menu, or Reply Preview.
- **Validation**: Supported visible types include text, image, GIF, voice, video, location, card, file, merged history, sticker, system, revoked, failed, and loading.
- **State transitions**: `draft -> sending -> sent`, `sending -> failed -> retrying -> sent`, `sent -> revoked`, `sent -> edited`.

## Message Input State

- **Fields**: `channelId`, `text`, `replyTarget`, `mentionQuery`, `mentionedTargets`, `attachmentDrafts`, `voiceState`, `sendingState`, `robotPanelState`, `aiPanelState`
- **Relationships**: Reads selected conversation and member/agent lists; writes draft state to Conversation store.
- **Validation**: Send is disabled when text is empty and no attachment is selected; helper panels must not hide primary input or navigation.
- **State transitions**: `idle -> typing -> sending -> idle`, `idle -> recording -> sendingVoice -> idle`, `robotIdle -> loading -> ready|unavailable|failed`.

## Contact or Group

- **Fields**: `id`, `type`, `displayName`, `avatarUrl`, `fallbackInitial`, `status`, `roleLabel`, `memberCount`, `actions`, `blocked`, `requestState`
- **Relationships**: Can create Conversation Preview; group entries connect to Group Member entities.
- **Validation**: Empty, loading, denied, and error states require recovery guidance.

## Agent

- **Fields**: `id`, `displayName`, `avatarUrl`, `capabilitySummary`, `status`, `connectorType`, `entryRoute`, `availabilityReason`
- **Relationships**: May appear as Contact, Conversation Preview sender, Clowder Panel participant, or @ mention target.
- **Validation**: Status must be visible without relying on color alone.

## File Preview

- **Fields**: `id`, `name`, `type`, `sizeLabel`, `sourceUrl`, `previewKind`, `previewState`, `errorMessage`, `actions`
- **Relationships**: Opens from Message Item or Files page; may occupy Right Workspace.
- **Validation**: Markdown/text/HTML/PDF/Office fallback states must be visible; mobile uses stacked/full-screen panel.
- **State transitions**: `closed -> loading -> ready`, `loading -> failed -> retrying`, `ready -> closed`.

## Right Workspace

- **Fields**: `visible`, `activeTab`, `width`, `mode`, `preview`, `clowderState`, `resizeState`
- **Relationships**: Contains File Preview or Clowder Panel; on mobile becomes overlay/stacked route.
- **Validation**: Desktop width must not reduce chat below readable width; mobile must provide clear close/back path.

## Settings Surface

- **Fields**: `profile`, `themeMode`, `notificationPermission`, `deviceSessions`, `blockedList`, `androidPermissions`
- **Relationships**: Updates App and Settings stores; links to device and blacklist routes.
- **Validation**: Dark mode, denied permission, and device removal states require clear user feedback.

## Legacy Manifest Screen

- **Fields**: `id`, `title`, `viewport`, `pageNumber`, `module`, `mappingStatus`, `targetRoute`, `targetComponent`, `notes`
- **Relationships**: Maps old UI/function modules from `manifest.pdf` to route and UI-state contracts.
- **Validation**: Every manifest module must be `included`, `merged`, `deferred`, or `removed-with-approval` before tasks are generated. Deferred modules may omit target route/component placeholders until implementation starts, but must keep a rationale in the coverage contract.

## Source Reference Audit Item

- **Fields**: `id`, `module`, `imWebPath`, `uniPath`, `manifestReference`, `behaviorNotes`, `visualNotes`, `targetRoute`, `targetComponent`, `openRisks`
- **Relationships**: Links source reference findings to route, UI-state, and manifest coverage contracts.
- **Validation**: Each primary module must record whether `im_web`, `uni`, and `manifest.pdf` were reviewed before implementation starts.

## Platform Compatibility Record

- **Fields**: `id`, `itemName`, `itemType`, `h5Compatible`, `appPlusAndroidCompatible`, `guardStrategy`, `fallbackUx`, `qaImpact`
- **Relationships**: Links dependency/API adoption to `package.json`, platform guards, composables, affected pages, and QA issue records.
- **Validation**: Every new dependency or platform API must be checked before adoption and must include fallback notes when compatibility is partial or unsupported.

## UI Issue Record

- **Fields**: `id`, `stage`, `platform`, `viewport`, `module`, `severity`, `reproduction`, `expected`, `actual`, `status`, `fixCommit`, `verificationNote`
- **Relationships**: Links to visual QA checkpoint and affected route/component.
- **Validation**: Status must move through `open -> fixing -> fixed -> verified` before next stage begins. Story-level QA entries must record the 5-second recognition result.
