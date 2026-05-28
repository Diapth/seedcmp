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

- Status: Pending
- Notes:

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
