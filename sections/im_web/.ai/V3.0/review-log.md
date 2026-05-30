# Review Log: IM Web V3.0 Clowder Multi-Agent Connector

## Global Review Gates

- [X] Package boundaries and dependency direction verified
- [X] Browser code does not receive Clowder secrets
- [X] SDK listeners and durable IM state remain in datasource stores
- [X] TangSeng/WuKongIM remain IM source of truth
- [X] Clowder remains connector, thread, permission, and agent source of truth
- [X] Unavailable, denied, queue-full, timeout, and unsupported media states are visible
- [X] V2 duplicate prevention, markdown, reconnect, and history behavior are preserved
- [X] Build, test, smoke, and review evidence is recorded in `sections/im_web/.ai/V3.0/evidence.md`

## Story Reviews

## Phase 2 Foundation Review

- Status: Passed for scaffold scope
- Package boundaries: IM Web added DTO/store types only; TangSeng owns bridge config/signature helpers; Clowder owns connector registry, adapter scaffold, and connector routes.
- Secret exposure: Clowder connector secret remains server-side in TangSeng/Clowder config and is not surfaced through browser DTOs.
- Evidence: TangSeng targeted tests, IM Web type-check, and Clowder API build are recorded in `sections/im_web/.ai/V3.0/evidence.md`.

### US1 - Route IM Conversations Into Clowder Threads

- Status: Passed for contract/scaffold scope; runnable smoke remains pending
- Notes:
  - Clowder inbound handler routes signed `im-web` payloads to `ConnectorRouter` and rejects unsigned payloads.
  - Clowder outbound adapter sends text/markdown replies to TangSeng callback with `x-clowder-signature` and `x-clowder-timestamp`; non-2xx callback responses surface as delivery failures.
  - TangSeng bridge has env-loaded configuration, message listener registration, normalization, HMAC signing, and outbound callback signature verification scaffold, keeping bridge secrets server-side.
  - IM Web has DTO/store types, Clowder state store, status badge scaffold, and message normalization that treats `im-web`/`clowder:*` replies as markdown AI assistant messages while preserving existing DeepSeek merge behavior.
  - Package boundary check: IM Web browser code contains DTOs and state only; Clowder connector code stays in `/media/leng/DiskB1/exp/clowder-ai`; TangSeng owns HMAC bridge endpoints.
  - Auth check: inbound IM-to-Clowder payloads use `x-im-web-*` HMAC; outbound Clowder-to-TangSeng payloads use `x-clowder-*` HMAC; no Clowder connector secret is exposed through browser APIs.
  - Connector contract check: `connectorId` remains `im-web`, `externalChatId` remains `{channelType}:{channelId}`, and dedup uses connector/message/client IDs.
  - Remaining US1 work: full direct/group Playwright smoke (T023), pending runnable multi-service environment.

### US2 - Manage Multi-User Group Access and Permissions

- Status: Passed for targeted tests and implementation scope; live smoke remains environment-gated
- Notes:
  - Clowder `ImWebPermissionPolicy` evaluates `im-web` group whitelist, admin sender IDs, and admin-only command requirements through `ConnectorPermissionStore`.
  - TangSeng role snapshots normalize owner, manager, member, and departed states before forwarding group metadata; the production path injects them through `message/event.go` and `clowder/listener.go`.
  - IM Web Clowder store records permission state and derives stable disabled reasons for denied groups and admin-only controls.
  - Unauthorized mutation review: `/allow-group` and `/deny-group` remain guarded by admin checks in the command layer; route-level response mapping returns `403` plus user-facing `userMessage` for `group_not_allowed`, `command_admin_only`, and `permission_denied`.
  - Smoke review: Playwright smoke is present but skipped unless `RUN_V3_CLOWDER_SMOKE` is set with TangSeng, WuKongIM, Clowder API, bridge secret, and two test users.

### US3 - Connect Multiple Clowder Agents From One IM Conversation

- Status: Passed for targeted tests and implementation scope; live smoke remains environment-gated
- Notes:
  - Clowder exposes an `im-web` agent directory from thread cats, participants, preferred cats, last-active cat, message counts, and availability.
  - Mention, `/ask`, `/focus`, preferred-cat, and fallback routing are covered by Clowder targeted tests.
  - TangSeng V3 bridge path skips legacy single DeepSeek robot routing when the Clowder bridge is configured, preventing duplicate routing.
  - IM Web stores the agent directory, focus state, and command responses; assistant messages show Clowder identity in `TextCell.vue`.
  - Residual risk: end-to-end two-account, two-agent mention smoke needs the real multi-service environment.

### US4 - Provide IM-Side Thread and Agent Controls

- Status: Passed for targeted tests and implementation scope; live smoke remains environment-gated
- Notes:
  - `ClowderConversationPanel.vue` renders enabled, disabled, denied, loading, error, delivery, thread, focus, and agent-directory states without exposing secrets.
  - `ChatView.vue` provides the conversation entry point, while datasource/store code owns bridge calls and durable state.
  - TangSeng status exposes enabled/configured/reachable/version/feature flags; Clowder status route mirrors connector readiness.
  - Disabled controls use stable reasons for missing configuration, denied group, admin-only action, unavailable agent, and transient errors.
  - Residual risk: browser screenshots for panel layout and text containment require the live UI smoke environment.

### US5 - Preserve Streaming, Media, and History Behavior

- Status: Passed for targeted tests and implementation scope; live smoke remains environment-gated
- Notes:
  - Streaming callback states map to one stable TangSeng client message number, so placeholder, chunk, final, cleanup, realtime, and history copies merge into one visible reply.
  - Rich blocks fall back to plaintext/markdown when native cards are unavailable.
  - TangSeng normalizes supported media attachments and marks unsupported media for visible unavailable states.
  - IM Web maps queue-full, timeout, unavailable, media-download, and outbound failures into delivery states instead of silent drops.
  - Residual risk: refresh-during-stream and media-download live smoke require the full bridge and test account environment.
