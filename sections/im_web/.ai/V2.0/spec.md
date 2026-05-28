# Feature Specification: IM Web V2.0 Completion

**Feature Branch**: `001-im-web-v2`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "将前面对 sections/im_web 与 TangSengDaoDaoServer、WuKongIM 后端差距的梳理整理成 V2.0 版本分支要做的任务"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete Daily Messaging (Priority: P1)

As a chat user, I can send, receive, view, retry, delete, edit, react to, reply to, and inspect messages across text and media conversations without losing context during refreshes, reconnects, or device switches.

**Why this priority**: Messaging reliability and message actions are the core value of the product; without this, other modules cannot feel complete.

**Independent Test**: Can be fully tested by using one direct chat and one group chat to exchange text, image, file, voice, video, reply, edit, delete, reaction, read receipt, and pinned-message interactions, then refreshing and reconnecting to confirm the same state is restored.

**Acceptance Scenarios**:

1. **Given** a user is in a direct or group conversation, **When** they send an image, file, voice clip, or video, **Then** the recipient sees a usable message with progress, success or failure state, preview where applicable, and accessible content after refresh.
2. **Given** a user has sent a message within the allowed action window, **When** they edit, revoke, delete locally, or delete mutually, **Then** all affected conversation views show the correct updated state and no stale summary remains.
3. **Given** a user reacts to or removes a reaction from a message, **When** another participant opens the same conversation or reconnects, **Then** the reaction counts and participants are consistent.
4. **Given** a message has read receipt information, **When** the sender opens receipt details, **Then** they can distinguish read, unread, and unavailable receipt states.

---

### User Story 2 - Manage Groups End-to-End (Priority: P1)

As a group owner or administrator, I can manage group membership, invitations, QR entry, roles, announcements, mute rules, blacklists, and destructive actions from the web client with clear permission boundaries.

**Why this priority**: Group chat is already active in the product and several backend capabilities are not yet surfaced consistently; owners need full control without switching clients.

**Independent Test**: Can be tested by creating a group, inviting members through manual selection and QR/invite confirmation, changing settings, promoting an admin, muting a member, blacklisting a member, transferring ownership, and exiting or disbanding where permitted.

**Acceptance Scenarios**:

1. **Given** a group owner opens group settings, **When** they change the group profile, announcement, avatar, save status, mute mode, or member permissions, **Then** the settings are saved, visible to relevant members, and survive refresh.
2. **Given** a group requires invitation confirmation, **When** a user joins through an invite link or QR code, **Then** the flow shows the correct confirmation state and only admits the user after approval where required.
3. **Given** a manager changes member roles, mute state, blacklist state, or removes a member, **When** other group members view the group, **Then** membership, permissions, and system notices match the action.

---

### User Story 3 - Recover Reliably From Network Changes (Priority: P1)

As a web chat user, I can continue using the app through weak network, temporary disconnects, reconnects, and multi-device kickout events without silent message loss.

**Why this priority**: The realtime backend can deliver durable messaging, but the web client must expose connection state and reconcile missed data to be trustworthy.

**Independent Test**: Can be tested by sending messages while offline, reconnecting, forcing a gateway reconnect, receiving messages on another device, and verifying pending sends, missed messages, commands, unread counts, and conversation summaries converge.

**Acceptance Scenarios**:

1. **Given** the network disconnects during chat, **When** the user continues typing or sending, **Then** the app clearly marks pending work and either sends it after reconnect or shows a recoverable failure.
2. **Given** the connection is restored, **When** synchronization completes, **Then** conversations, messages, reactions, pinned items, reminders, read states, and group updates reflect the latest server state.
3. **Given** the same account logs in elsewhere and invalidates the current session, **When** the web client receives the kickout event, **Then** local sensitive state is cleared and the user is guided back to login.

---

### User Story 4 - Complete Account, Settings, and Login Flows (Priority: P2)

As a user, I can manage my profile, personal QR code, devices, notification preferences, security settings, account safety actions, and QR login from the web client.

**Why this priority**: These features reduce support friction and make the web client viable as a primary client, but they can be delivered after the core messaging slice.

**Independent Test**: Can be tested by editing profile details, showing a personal QR code, authorizing QR login, changing notification preferences, reviewing devices, removing a device, changing security settings, and validating logout behavior.

**Acceptance Scenarios**:

1. **Given** a user opens their profile area, **When** they edit profile fields or avatar, **Then** their updated identity appears in conversations, contacts, and profile views after refresh.
2. **Given** a user starts QR login, **When** the QR is scanned, confirmed, expired, or rejected, **Then** the web login page reflects the correct state and only authenticates after confirmation.
3. **Given** a user changes device, notification, or security settings, **When** they return later, **Then** preferences and account safety state are preserved and understandable.

---

### User Story 5 - Add Discovery and Productivity Surfaces (Priority: P3)

As a user, I can search across people, groups, and messages, access workplace apps, interact with supported robot capabilities, report abusive content, and use common configuration-driven client features.

**Why this priority**: These capabilities round out parity with the backend and existing product expectations, but they are less critical than dependable messaging, group management, and account flows.

**Independent Test**: Can be tested by finding a contact, group, and message through search; opening workplace banners and apps; using a robot menu or inline result; submitting a report; and verifying configurable client content appears without breaking core chat.

**Acceptance Scenarios**:

1. **Given** a user searches for a keyword, **When** matching people, groups, and messages exist, **Then** results are grouped, actionable, and return the user to the right detail or conversation context.
2. **Given** workplace content is available, **When** a user opens the workplace area, **Then** banners, categories, apps, recent apps, add/remove actions, and ordering are understandable and persist.
3. **Given** a user reports content or opens robot functionality, **When** the action completes or fails, **Then** the user sees a clear outcome and core chat state remains unaffected.

---

### User Story 6 - Improve Large History and Desktop Readiness (Priority: P3)

As a heavy web or desktop-form-factor user, I can browse large histories, use dark mode, receive desktop-style notifications, and rely on unread counts without the interface becoming sluggish.

**Why this priority**: This improves production readiness and parity for long-running usage, but it should follow the functional completion slices.

**Independent Test**: Can be tested by loading a conversation with thousands of messages, switching theme, receiving notifications, and confirming unread counts remain correct during extended usage.

**Acceptance Scenarios**:

1. **Given** a conversation has thousands of messages, **When** the user scrolls, searches, sends, or receives new messages, **Then** the interface remains responsive and visually stable.
2. **Given** notifications are enabled, **When** a new relevant message arrives outside the active conversation, **Then** the user receives an appropriate notification and unread counts are updated.
3. **Given** the user switches dark mode or desktop-oriented settings, **When** they reload the app, **Then** the chosen experience is preserved.

### Edge Cases

- A media upload is interrupted, retried, duplicated, cancelled, or completed after the user switches conversations.
- A message action targets a message that was already deleted, revoked, edited, or unavailable in the local cache.
- Reaction, read receipt, pinned item, and reminder sync data arrives before the corresponding message is loaded.
- A group invite is expired, already used, requires approval, references a disbanded group, or is opened by a user who is already a member.
- A group owner transfers ownership while another manager is editing settings.
- A user is kicked out during an upload, QR login, settings save, or destructive group action.
- The web client receives realtime updates while offline recovery is also loading historical data.
- Search returns no results, too many results, deleted messages, blocked users, or groups the user no longer belongs to.
- Notification permission is denied, revoked, or unavailable in the browser or desktop shell.
- A large conversation includes mixed unsupported, system, media, and revoked message types.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to send and receive text, image, file, voice, video, GIF, sticker, location, contact card, merged-forward, system, reply, and mention messages where those message types are supported by the product.
- **FR-002**: Users MUST see clear sending, success, failed, retry, and unavailable states for outgoing messages, including media messages.
- **FR-003**: Users MUST be able to preview, open, download, or play media messages according to the message type.
- **FR-004**: Users MUST be able to edit, revoke, delete locally, delete mutually, and clear conversation messages where their role and message state permit those actions.
- **FR-005**: Users MUST be able to add and remove message reactions, and participants MUST see reaction counts converge after refresh or reconnect.
- **FR-006**: Users MUST be able to view and act on message read states, including read receipt detail when the conversation supports it.
- **FR-007**: Users MUST be able to pin, unpin, view, and clear pinned messages in supported conversations.
- **FR-008**: Users MUST receive and resolve message reminders and mention reminders without losing the ability to jump to the relevant conversation context.
- **FR-009**: Users MUST be able to search within conversations and across global people, groups, and messages with categorized results.
- **FR-010**: The app MUST synchronize message extensions, reactions, reminders, pinned messages, read states, conversation summaries, unread counts, and group updates after refresh and reconnect.
- **FR-011**: The app MUST provide a visible connection and recovery state when the realtime connection is disconnected, reconnecting, recovered, or kicked out.
- **FR-012**: The app MUST preserve pending outgoing work during temporary disconnects and either complete it after recovery or show a user-actionable failure.
- **FR-013**: The app MUST prevent duplicate visible messages when realtime delivery and historical synchronization overlap.
- **FR-014**: Group owners and authorized managers MUST be able to manage group name, avatar, announcement, saved status, mute settings, member roles, member removal, member mute state, blacklists, ownership transfer, exit, and disband actions.
- **FR-015**: Users MUST be able to invite members through direct selection, invite confirmation, and QR-based flows where the group settings allow it.
- **FR-016**: Group join flows MUST show expired, already joined, approval required, rejected, successful, and unavailable states.
- **FR-017**: The app MUST enforce visible permission boundaries for owner-only, manager-only, member, and non-member group actions before destructive actions are submitted.
- **FR-018**: Users MUST be able to view and edit their profile details, avatar, personal QR code, device list, notification preferences, and supported security settings.
- **FR-019**: Users MUST be able to perform QR login through waiting, scanned, confirmed, expired, and failed states.
- **FR-020**: Users MUST be able to register, update, and clear notification-related device state and see whether notifications are enabled or blocked.
- **FR-021**: Users MUST be able to access workplace banners, categories, apps, frequently used apps, app add/remove actions, and app ordering when workplace content is enabled.
- **FR-022**: Users MUST be able to access supported robot menu and inline interaction flows without disrupting the normal conversation experience.
- **FR-023**: Users MUST be able to report users, groups, or messages with category selection, description, and attachment support where reporting is enabled.
- **FR-024**: The app MUST apply common client configuration, including remote client settings, chat backgrounds, version/update prompts, and feature visibility, where such configuration is available.
- **FR-025**: The app MUST support a usable dark mode, large-history browsing, and notification/unread behavior suitable for long-running web or desktop-form-factor usage.
- **FR-026**: The V2.0 scope MUST keep administration-only backend management screens out of the user-facing chat client unless they directly support end-user chat, group, account, workplace, robot, report, or notification workflows.

### Key Entities *(include if feature involves data)*

- **Conversation**: A direct or group chat entry with participant identity, summary, unread state, pinned/mute state, draft state, and recovery metadata.
- **Message**: A durable chat item with sender, sequence, content type, content payload, status, timestamps, edit/revoke/delete state, reply references, mentions, reactions, receipts, and media metadata.
- **Media Asset**: An uploaded or downloadable object used by image, file, voice, video, GIF, sticker, report attachment, or workplace visual content.
- **Group**: A multi-user conversation with profile details, owner, administrators, members, saved state, invitation rules, mute rules, blacklist, QR/invite state, and lifecycle status.
- **Group Member**: A user's role and presentation inside a group, including display name, mute status, permission level, invitation source, and membership state.
- **User Profile**: A user's identity and preferences, including avatar, display name, short identifier, personal QR code, devices, notification settings, security settings, and relationship state.
- **Realtime Session**: The active connection state for one device, including connected, reconnecting, offline, kicked out, and recovery states.
- **Search Result**: A categorized result that points to a person, group, message, file, or conversation context.
- **Workplace App**: A user-visible productivity entry with category, banner or icon presentation, route target, usage record, and ordering.
- **Robot Interaction**: A menu, inline query, response, event, acknowledgement, typing, or streaming state associated with automated accounts.
- **Report**: A user-submitted complaint with target, category, description, optional attachments, and submission outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of tested primary chat actions across text, media, reply, edit, delete, reaction, receipt, and pinned-message flows complete successfully on the first attempt in supported conversations.
- **SC-002**: After a refresh or reconnect, 99% of tested conversations show the same latest message, unread count, reactions, pinned items, reminders, and group settings as another active client within 5 seconds.
- **SC-003**: A user can complete the full media-send flow for a 10 MB file or image in under 30 seconds on a normal broadband connection, with visible progress and a clear retry path on failure.
- **SC-004**: A group owner can complete the full group management smoke test covering invite, QR join, role change, mute, blacklist, profile update, transfer, exit, and disband actions without using another client.
- **SC-005**: 90% of users in acceptance testing can understand whether they are online, reconnecting, offline, or kicked out without needing support guidance.
- **SC-006**: QR login reaches a final user-visible state within 2 seconds after scan, confirmation, expiration, or failure is known to the system.
- **SC-007**: Global search returns categorized results or an empty state within 2 seconds for 95% of common searches in a typical account.
- **SC-008**: Conversations with 5,000 loaded historical messages remain responsive enough that scrolling, selecting, and sending do not visibly block interaction for more than 100 ms in normal testing.
- **SC-009**: Notification and unread indicators match the tested conversation state in 99% of new-message, active-conversation, muted-conversation, and reconnect cases.
- **SC-010**: V2.0 reduces the known backend-alignment gap list to zero P1 gaps and no more than two accepted P3 deferrals.

## Clarifications

### Session 2026-05-24
- Q: V2.0 未完成的能力应该如何呈现？ → A: 先以灰态/占位形式保留，支持可见但不可用的状态，而不是全部隐藏。
- Q: V2.0 里哪些 capability 需要有明确的后端证据才能算可交付？ → A: 只把已经有后端证据能闭环的能力算作可交付；其他能力保留灰态但不计完成。
- 先完成V1.0bug后，再做V2.0

## Assumptions

- V2.0 is a user-facing chat client completion branch, not an administrator console branch.
- Existing account authentication, contact, conversation, message, group, workplace, robot, report, and realtime services remain available and compatible enough to support the described flows.
- Browser web usage is the primary target; desktop-form-factor readiness is included where it affects notifications, unread counts, updates, and long-running use.
- Organization-specific features remain hidden behind feature availability unless the required organization data is available.
- Gray or placeholder entry points may remain visible, but they do not count as done unless the backend flow is verified end-to-end.
- Unsupported or disabled backend capabilities should remain visible as gray, disabled, or placeholder entry points where the product expects them, and must never produce broken UI.
- Security-sensitive actions such as account deletion, password changes, ownership transfer, disbanding, and mutual deletion require explicit confirmation.
- Destructive actions should be recoverable where the product domain supports recovery, otherwise they must be clearly warned before completion.
