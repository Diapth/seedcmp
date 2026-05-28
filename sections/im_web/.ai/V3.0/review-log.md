# Review Log: IM Web V3.0 Clowder Multi-Agent Connector

## Global Review Gates

- [ ] Package boundaries and dependency direction verified
- [ ] Browser code does not receive Clowder secrets
- [ ] SDK listeners and durable IM state remain in datasource stores
- [ ] TangSeng/WuKongIM remain IM source of truth
- [ ] Clowder remains connector, thread, permission, and agent source of truth
- [ ] Unavailable, denied, queue-full, timeout, and unsupported media states are visible
- [ ] V2 duplicate prevention, markdown, reconnect, and history behavior are preserved
- [ ] Build, test, smoke, and review evidence is recorded in `sections/im_web/.ai/V3.0/evidence.md`

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
  - TangSeng bridge has normalization, HMAC signing, and outbound callback signature verification scaffold, keeping bridge secrets server-side.
  - IM Web has DTO/store types, Clowder state store, status badge scaffold, and message normalization that treats `im-web`/`clowder:*` replies as markdown AI assistant messages while preserving existing DeepSeek merge behavior.
  - Package boundary check: IM Web browser code contains DTOs and state only; Clowder connector code stays in `/media/leng/DiskB1/exp/clowder-ai`; TangSeng owns HMAC bridge endpoints.
  - Auth check: inbound IM-to-Clowder payloads use `x-im-web-*` HMAC; outbound Clowder-to-TangSeng payloads use `x-clowder-*` HMAC; no Clowder connector secret is exposed through browser APIs.
  - Connector contract check: `connectorId` remains `im-web`, `externalChatId` remains `{channelType}:{channelId}`, and dedup uses connector/message/client IDs.
  - Remaining US1 work: production message listener registration in TangSeng `modules/message/event.go` (T027) and full direct/group Playwright smoke (T023).

### US2 - Manage Multi-User Group Access and Permissions

- Status: Pending
- Notes:

### US3 - Connect Multiple Clowder Agents From One IM Conversation

- Status: Pending
- Notes:

### US4 - Provide IM-Side Thread and Agent Controls

- Status: Pending
- Notes:

### US5 - Preserve Streaming, Media, and History Behavior

- Status: Pending
- Notes:
