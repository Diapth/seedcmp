# Feature Specification: IM Web V3.0 Clowder Multi-Agent Connector

**Feature Branch**: `002-im-web-v3-clowder`

**Created**: 2026-05-28

**Status**: Draft

**Input**: User description: "V3.0 plan: connect with `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors`, let the clowder project fully plug in, and implement multi-user multi-agent connection."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Route IM Conversations Into Clowder Threads (Priority: P1)

As an IM Web user, I can bind a direct chat or group chat to a Clowder thread so normal TangSeng messages become Clowder connector messages and agent replies return to the same IM conversation.

**Why this priority**: Full Clowder access starts with a reliable bridge between WuKongIM/TangSeng conversations and Clowder connector routing.

**Independent Test**: Bind one direct chat and one group chat, send text and media-compatible messages, verify Clowder creates or reuses the correct thread binding, invokes the target agent, and sends one durable reply back into IM Web.

**Acceptance Scenarios**:

1. **Given** a user sends a message in a bound IM conversation, **When** the bridge forwards it, **Then** Clowder stores it as a connector-sourced thread message with sender identity, channel identity, dedup metadata, and target-agent routing metadata.
2. **Given** the same IM message is retried by realtime recovery or webhook replay, **When** Clowder receives it again, **Then** the dedup layer skips the duplicate and IM Web does not show duplicate agent replies.
3. **Given** a Clowder agent responds, **When** the outbound hook delivers the result, **Then** IM Web receives a normal TangSeng robot/system message with markdown-safe content, sender identity, and stable ordering after refresh.

---

### User Story 2 - Manage Multi-User Group Access and Permissions (Priority: P1)

As a group owner or administrator, I can control which IM groups may use Clowder, who can run connector commands, and how group members are represented to Clowder agents.

**Why this priority**: Multi-user agent access needs explicit group authorization and sender attribution before it is safe in production group chats.

**Independent Test**: Enable Clowder for one group, deny another group, run allowed and admin-only commands as owner, manager, and member, then verify sender identity and permission results in both IM and Clowder thread history.

**Acceptance Scenarios**:

1. **Given** a group is not allowed, **When** a member mentions a Clowder agent, **Then** no agent invocation runs and the group receives a clear authorization message.
2. **Given** a group is allowed, **When** multiple members send messages, **Then** Clowder records the original sender ID/name on each connector source and agents can distinguish participants.
3. **Given** admin-only command mode is enabled, **When** a non-admin sends `/use`, `/new`, `/focus`, `/ask`, or group authorization commands, **Then** the command is denied without changing thread bindings.

---

### User Story 3 - Connect Multiple Clowder Agents From One IM Conversation (Priority: P1)

As a group participant, I can mention one or more Clowder agents from IM Web and get directed replies without leaving the chat client.

**Why this priority**: The requested V3.0 capability is multi-user multi-agent connection, not only single DeepSeek robot replies.

**Independent Test**: Configure at least two Clowder cats, send messages using explicit `@agent` mentions, `/ask`, `/focus`, and unmentioned follow-up messages, then verify target selection and replies across refresh.

**Acceptance Scenarios**:

1. **Given** a message contains one Clowder agent mention, **When** it reaches the connector router, **Then** only the matching agent is invoked.
2. **Given** a message uses `/ask <agent> <message>`, **When** the command is accepted, **Then** the message is forwarded to the current bound Clowder thread and routed to that agent.
3. **Given** no explicit mention exists, **When** the thread already has agent activity or preferred cats, **Then** routing follows Clowder's participant/preferred-cat fallback rather than a hardcoded DeepSeek account.

---

### User Story 4 - Provide IM-Side Thread and Agent Controls (Priority: P2)

As an IM Web user, I can view and adjust the Clowder binding, active thread, available agents, and thread focus from inside the chat UI.

**Why this priority**: Slash commands can cover the first version, but a web client should expose clear state and avoid making users memorize connector commands.

**Independent Test**: Open a Clowder-enabled conversation settings panel, view current thread, change active thread, inspect available agents, set/clear focus, and confirm commands and UI remain consistent.

**Acceptance Scenarios**:

1. **Given** a conversation is Clowder-enabled, **When** the user opens settings, **Then** they can see connector status, bound thread title/ID, available agents, focus state, and last delivery state.
2. **Given** the user changes active thread or focus from the UI, **When** the action succeeds, **Then** future IM messages route to the selected Clowder thread/agent.
3. **Given** Clowder is unavailable or credentials are missing, **When** the user opens the panel, **Then** they see a disabled state and no fake-available controls.

---

### User Story 5 - Preserve Streaming, Media, and History Behavior (Priority: P2)

As a user, I can receive streaming Clowder replies, file-aware responses, and historical thread context without duplicate bubbles or lost messages.

**Why this priority**: V2.0 already fixed AI streaming and duplicate history defects; V3.0 must not regress them while replacing single-robot AI with Clowder.

**Independent Test**: Send a long prompt that streams, attach supported media, refresh during and after completion, and verify one final reply, usable markdown/media fallback, and complete history.

**Acceptance Scenarios**:

1. **Given** Clowder streams a reply, **When** IM Web receives chunks and final output, **Then** the UI shows one evolving assistant message and merges the final persisted message without duplication.
2. **Given** a user sends an image, file, or voice message, **When** the connector can process it, **Then** supported media is forwarded as content blocks; unsupported media gets a visible unavailable fallback.
3. **Given** the user refreshes, **When** history sync runs, **Then** human messages, connector command responses, and agent replies remain ordered and complete.

## Edge Cases

- Clowder API is offline, slow, partially started, or missing connector gateway configuration.
- IM Web reconnects and resends pending messages while Clowder already processed the original message.
- A group is disbanded, renamed, muted, or ownership changes while a Clowder binding exists.
- A user leaves a group while their earlier message is still triggering an agent reply.
- Multiple users mention different agents at nearly the same time.
- An agent queue is full and Clowder returns `full` instead of dispatching.
- Slash commands conflict with normal chat text or TangSeng robot menu commands.
- Clowder returns rich blocks that IM Web cannot render natively.
- A bound Clowder thread is deleted, archived, or no longer accessible to the mapped owner.
- Media upload succeeds in TangSeng but cannot be fetched by Clowder, or Clowder media cannot be re-sent through TangSeng.
- Authorization state differs between TangSeng group roles and Clowder connector permission store.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST add an `im-web` Clowder connector definition and adapter contract that maps TangSeng direct and group conversations to Clowder connector chats.
- **FR-002**: The system MUST map each IM conversation to a stable Clowder `ConnectorThreadBinding` using `connectorId`, `externalChatId`, `threadId`, `userId`, and optional `hubThreadId`.
- **FR-003**: The bridge MUST deduplicate inbound IM messages by connector ID, channel ID, and stable IM message ID/client message number.
- **FR-004**: Inbound IM messages MUST include original sender ID and display name in the Clowder `ConnectorSource.sender` field for group and direct chats.
- **FR-005**: Inbound IM messages MUST support text and mention routing to Clowder's `parseMentions`, `/ask`, `/focus`, `/use`, `/thread`, `/new`, `/where`, `/cats`, `/status`, `/history`, `/allow-group`, and `/deny-group` command paths where enabled.
- **FR-006**: The default route for unmentioned IM messages MUST use Clowder's configured default cat, preferred cats, or last-active participant fallback, not the V2.0 hardcoded `deepseek_ai_robot`.
- **FR-007**: Group use MUST respect a Clowder permission policy equivalent to `IConnectorPermissionStore`, including group whitelist, connector admins, and admin-only commands.
- **FR-008**: IM Web MUST expose visible enabled, disabled, loading, denied, unavailable, and error states for Clowder connection and group authorization.
- **FR-009**: Clowder agent replies MUST be delivered into TangSeng as durable robot/system messages that participate in normal message ordering, unread, history sync, and refresh recovery.
- **FR-010**: Streaming Clowder replies MUST update one IM-side assistant message and merge final persisted output without duplicate visible replies.
- **FR-011**: Rich Clowder output MUST degrade safely to markdown/plain text when TangSeng has no matching native message type.
- **FR-012**: Supported media attachments MUST be passed to Clowder as content blocks or retrievable URLs; unsupported attachments MUST retain an unavailable state instead of failing silently.
- **FR-013**: The UI MUST provide a conversation-level Clowder status/control surface for thread binding, available agents, focus, permissions, and last delivery state.
- **FR-014**: Clowder connector commands MUST be stored in a hub/system thread or equivalent command history so normal conversation history is not polluted by command internals.
- **FR-015**: Errors from Clowder dispatch, queue-full, permission-denied, media download, and outbound delivery MUST produce user-visible retry or unavailable states.
- **FR-016**: The implementation MUST preserve V2.0 message duplicate prevention, AI markdown rendering, reconnect recovery, and large-history ordering behavior.
- **FR-017**: The bridge MUST authenticate server-to-server calls between TangSeng/IM Web integration and Clowder with a shared secret or stronger mechanism, and reject unsigned inbound callbacks.
- **FR-018**: V3.0 MUST not require copying clowder source code into `sections/im_web`; integration should use API/connector contracts or a separately deployed Clowder service.

### Key Entities *(include if feature involves data)*

- **IM Connector Binding**: The stable mapping between a TangSeng conversation and a Clowder thread.
- **IM Connector Message**: A normalized inbound user message or command sent from IM Web into Clowder.
- **Clowder Agent Reply**: A streamed or final agent response delivered back to TangSeng.
- **IM Connector Permission**: The authorization state for a group, sender, and command.
- **Clowder Agent Directory**: The routable Clowder cat list, mention patterns, availability, and display metadata exposed to IM Web.
- **Connector Hub Thread**: The Clowder-side system thread used for connector command exchanges.
- **Delivery State**: Per-message bridge state covering queued, dispatched, streaming, delivered, failed, skipped, and duplicate.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In smoke testing, a direct IM conversation and a group IM conversation can each bind to Clowder, send a message, receive an agent reply, refresh, and show no duplicates.
- **SC-002**: 99% of retry/reconnect duplicate inbound events are skipped by connector dedup in integration tests.
- **SC-003**: At least two configured Clowder agents can be invoked from one group conversation by explicit mention or `/ask`, with sender identity preserved.
- **SC-004**: Group whitelist and admin-only command tests pass for owner/admin/member roles with no unauthorized thread binding changes.
- **SC-005**: Streaming replies render as one evolving markdown message and remain one message after final persistence and refresh.
- **SC-006**: Clowder unavailable and queue-full cases show a user-visible failure or retry state within 5 seconds.
- **SC-007**: V2.0 regression tests for message duplicate handling, AI markdown/history ordering, reconnect recovery, group permissions, and build/type-check still pass.

## Assumptions

- Clowder runs as a separate service or package workspace and remains the source of truth for agent registry, connector routing, thread bindings, and outbound hook semantics.
- TangSeng/WuKongIM remains the source of truth for IM users, groups, message persistence, unread state, and realtime delivery.
- V3.0 will introduce a backend bridge layer; the browser client will not call Clowder secrets or connector internals directly.
- The first implementation targets text, markdown, and common media fallbacks before attempting full native rich-block parity.
- Existing V2.0 DeepSeek robot UI may remain as a compatibility fallback, but new multi-agent routing should use Clowder.
