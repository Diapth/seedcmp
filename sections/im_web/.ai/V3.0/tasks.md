# Tasks: IM Web V3.0 Clowder Multi-Agent Connector

**Input**: Design documents from `sections/im_web/.ai/V3.0/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, and `contracts/`

**Tests**: Required. V3.0 crosses IM Web, TangSengDaoDaoServer, WuKongIM delivery, and Clowder connector routing, so each story includes contract/unit/integration/smoke evidence before completion.

**Organization**: Tasks are grouped by user story so each increment can be implemented and tested independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the two-project integration workspace and evidence locations.

- [X] T001 Confirm V3 feature pointer and branch metadata in `.specify/feature.json`, `sections/im_web/.ai/V3.0/spec.md`, and `sections/im_web/.ai/V3.0/plan.md`
- [X] T002 [P] Create V3 evidence log skeleton in `sections/im_web/.ai/V3.0/evidence.md`
- [X] T003 [P] Add environment variable inventory for Clowder bridge settings in `sections/im_web/.ai/V3.0/quickstart.md`
- [X] T004 [P] Map existing IM Web message/recovery test fixtures for reuse in `sections/im_web/apps/chat/tests/setup.ts`
- [X] T005 [P] Map existing Clowder connector test helpers for reuse in `/media/leng/DiskB1/exp/clowder-ai/packages/api/test/im-web-connector-test-helpers.js`
- [X] T006 Record baseline build and test commands in `sections/im_web/.ai/V3.0/evidence.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define shared contracts, bridge boundaries, and configuration used by all user stories.

**CRITICAL**: No user story implementation should start until this phase is complete.

- [X] T007 Add shared IM Web Clowder API types and DTOs for FR-001, FR-002, FR-008, FR-013 in `sections/im_web/packages/datasource-vue/src/api/clowder.ts`
- [X] T008 Add Clowder UI/store domain types for bindings, agents, permissions, replies, and delivery state in `sections/im_web/packages/datasource-vue/src/stores/clowderTypes.ts`
- [X] T009 Add TangSeng bridge configuration model for base URL, feature flag, secret presence, and owner mapping in `sections/im/TangSengDaoDaoServer/modules/common/clowder_config.go`
- [X] T010 Add bridge HMAC signing and timestamp verification helper for FR-017 in `sections/im/TangSengDaoDaoServer/modules/common/clowder_signature.go`
- [X] T011 Add bridge HMAC verification tests for invalid, stale, and valid signatures in `sections/im/TangSengDaoDaoServer/modules/common/clowder_signature_test.go`
- [X] T012 Add Clowder `im-web` connector shared type entry for FR-001 in `/media/leng/DiskB1/exp/clowder-ai/packages/shared/src/types/connector.ts`
- [X] T013 Add Clowder `im-web` connector definition scaffold for FR-001 in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/adapters/ImWebAdapter.ts`
- [X] T014 Add Clowder connector registration wiring for `im-web` in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/connector-gateway-bootstrap.ts`
- [X] T015 Add Clowder bridge route scaffold for inbound and health/status endpoints in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/routes/connector-webhooks.ts`
- [X] T016 Add package boundary and secret exposure review checklist in `sections/im_web/.ai/V3.0/review-log.md`
- [X] T017 Run baseline IM Web type-check command and record output in `sections/im_web/.ai/V3.0/evidence.md`
- [X] T018 Run baseline Clowder API build command and record output in `sections/im_web/.ai/V3.0/evidence.md`

**Checkpoint**: Shared contracts, config, connector identity, and auth helpers are ready.

---

## Phase 3: User Story 1 - Route IM Conversations Into Clowder Threads (Priority: P1) MVP

**Goal**: Bind TangSeng direct/group conversations to Clowder threads, forward inbound messages with dedup and sender metadata, and deliver one durable reply back into IM Web.

**Independent Test**: Bind one direct chat and one group chat, send text/media-compatible messages, verify Clowder routes to the correct thread, and refresh IM Web without duplicate replies.

### Tests for User Story 1

- [X] T019 [P] [US1] Add bridge inbound contract tests for signed payload, binding reuse, duplicate skip, and permission response in `/media/leng/DiskB1/exp/clowder-ai/packages/api/test/im-web-inbound-bridge.test.js`
- [X] T020 [P] [US1] Add IM Web datasource API contract tests for binding/status responses in `sections/im_web/apps/chat/tests/clowderBridgeContracts.test.ts`
- [X] T021 [P] [US1] Add TangSeng bridge normalization tests for channel IDs, sender fields, dedup keys, and attachments in `sections/im/TangSengDaoDaoServer/modules/clowder/bridge_test.go`
- [X] T022 [P] [US1] Add IM Web message store tests for durable Clowder replies and refresh dedup in `sections/im_web/apps/chat/tests/clowderMessageStore.test.ts`
- [ ] T023 [US1] Add Playwright direct/group binding smoke for SC-001 in `sections/im_web/apps/chat/tests-e2e/smoke-v3-clowder-binding.spec.ts`

### Implementation for User Story 1

- [X] T024 [P] [US1] Implement TangSeng IM connector binding model and persistence facade for FR-002 in `sections/im/TangSengDaoDaoServer/modules/clowder/model.go`
- [X] T025 [P] [US1] Implement TangSeng inbound message normalization for FR-003, FR-004, FR-012 in `sections/im/TangSengDaoDaoServer/modules/clowder/normalize.go`
- [X] T026 [US1] Implement TangSeng signed inbound forwarder to Clowder for FR-001, FR-003, FR-017 in `sections/im/TangSengDaoDaoServer/modules/clowder/client.go`
- [X] T027 [US1] Wire TangSeng message events into the Clowder bridge for FR-009 in `sections/im/TangSengDaoDaoServer/modules/message/event.go`
- [X] T028 [US1] Implement Clowder inbound route handling for `im-web` payloads in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/routes/connector-webhooks.ts`
- [X] T029 [US1] Implement Clowder binding lookup and creation through `ConnectorThreadBindingStore` in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/ImWebInboundHandler.ts`
- [X] T030 [US1] Implement Clowder dedup integration using connector ID, external chat ID, message ID, and client message number in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/InboundMessageDedup.ts`
- [X] T031 [US1] Implement IM outbound adapter text/markdown delivery to TangSeng for FR-009, FR-011 in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/adapters/ImWebAdapter.ts`
- [X] T032 [US1] Implement TangSeng outbound callback route for signed Clowder replies in `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`
- [X] T033 [US1] Add datasource API methods for Clowder binding, status, and delivery state in `sections/im_web/packages/datasource-vue/src/api/clowder.ts`
- [X] T034 [US1] Add Clowder state store for connection status, active binding, and delivery state in `sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts`
- [X] T035 [US1] Merge Clowder robot/system replies into existing message normalization in `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
- [X] T036 [US1] Add minimal conversation Clowder status badge for enabled/loading/error states in `sections/im_web/apps/chat/src/components/ClowderStatusBadge.vue`
- [X] T037 [US1] Run IM Web `pnpm type-check`, `pnpm build`, and targeted Vitest output for US1 in `sections/im_web/.ai/V3.0/evidence.md`
- [X] T038 [US1] Run Clowder API build and targeted connector tests for US1 in `sections/im_web/.ai/V3.0/evidence.md`
- [X] T039 [US1] Complete package boundary, connector contract, and auth review notes for US1 in `sections/im_web/.ai/V3.0/review-log.md`

**Checkpoint**: User Story 1 is independently usable as the MVP bridge.

---

## Phase 4: User Story 2 - Manage Multi-User Group Access and Permissions (Priority: P1)

**Goal**: Enforce group whitelist, connector admins, admin-only commands, and sender attribution for multi-user group chats.

**Independent Test**: Enable one group, deny another, run allowed and admin-only commands as owner/admin/member, and verify no unauthorized binding mutation.

### Tests for User Story 2

- [ ] T040 [P] [US2] Add Clowder permission store tests for `im-web` group whitelist and admin-only commands in `/media/leng/DiskB1/exp/clowder-ai/packages/api/test/im-web-permissions.test.js`
- [ ] T041 [P] [US2] Add TangSeng group role mapping tests for owner, manager, member, and departed member in `sections/im/TangSengDaoDaoServer/modules/clowder/permissions_test.go`
- [ ] T042 [P] [US2] Add IM Web permission UI state tests for denied, disabled, admin-only, and loading states in `sections/im_web/apps/chat/tests/clowderPermissionState.test.ts`
- [ ] T043 [US2] Add Playwright group permission smoke for SC-004 in `sections/im_web/apps/chat/tests-e2e/smoke-v3-clowder-permissions.spec.ts`

### Implementation for User Story 2

- [ ] T044 [P] [US2] Implement TangSeng group role snapshot adapter for FR-007 in `sections/im/TangSengDaoDaoServer/modules/clowder/permissions.go`
- [ ] T045 [US2] Wire group owner and manager role checks into Clowder bridge forwarding in `sections/im/TangSengDaoDaoServer/modules/group/service.go`
- [ ] T046 [US2] Implement Clowder `im-web` permission mapping with `ConnectorPermissionStore` in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/ImWebPermissionPolicy.ts`
- [ ] T047 [US2] Implement `/allow-group` and `/deny-group` behavior for `im-web` in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts`
- [ ] T048 [US2] Add permission-denied, command-admin-only, and group-not-allowed response mapping in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/routes/connector-webhooks.ts`
- [ ] T049 [US2] Add datasource methods for group authorization and admin-only state in `sections/im_web/packages/datasource-vue/src/api/clowder.ts`
- [ ] T050 [US2] Extend Clowder store with permission state and role-aware disabled reasons in `sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts`
- [ ] T051 [US2] Render denied and admin-only states in the status badge and settings entry point in `sections/im_web/apps/chat/src/components/ClowderStatusBadge.vue`
- [ ] T052 [US2] Preserve sender ID and display name in message metadata across group history refresh in `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
- [ ] T053 [US2] Run IM Web targeted tests and group permission smoke output for US2 in `sections/im_web/.ai/V3.0/evidence.md`
- [ ] T054 [US2] Run Clowder targeted permission tests output for US2 in `sections/im_web/.ai/V3.0/evidence.md`
- [ ] T055 [US2] Complete permissions and unauthorized mutation review notes for US2 in `sections/im_web/.ai/V3.0/review-log.md`

**Checkpoint**: Group access is explicit, auditable, and role-aware.

---

## Phase 5: User Story 3 - Connect Multiple Clowder Agents From One IM Conversation (Priority: P1)

**Goal**: Route mentions, `/ask`, `/focus`, preferred cats, and fallback behavior to multiple Clowder agents from one IM conversation.

**Independent Test**: Configure two Clowder agents, invoke them by mention and command from the same group, and verify routing persists after refresh.

### Tests for User Story 3

- [ ] T056 [P] [US3] Add Clowder multi-agent routing tests for mention, `/ask`, `/focus`, preferred cats, and fallback in `/media/leng/DiskB1/exp/clowder-ai/packages/api/test/im-web-multi-agent-routing.test.js`
- [ ] T057 [P] [US3] Add IM Web agent directory store tests for available, unavailable, preferred, and last-active agents in `sections/im_web/apps/chat/tests/clowderAgentDirectory.test.ts`
- [ ] T058 [P] [US3] Add command parsing contract tests for IM message slash commands in `sections/im_web/apps/chat/tests/clowderCommandContracts.test.ts`
- [ ] T059 [US3] Add Playwright two-agent mention and `/ask` smoke for SC-003 in `sections/im_web/apps/chat/tests-e2e/smoke-v3-clowder-multi-agent.spec.ts`

### Implementation for User Story 3

- [ ] T060 [P] [US3] Expose Clowder agent directory and mention aliases for `im-web` in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/routes/thread-cats.ts`
- [ ] T061 [US3] Route IM mentions through Clowder mention parser for FR-005 in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/mention-parser.ts`
- [ ] T062 [US3] Route `/ask`, `/focus`, `/use`, `/thread`, `/new`, `/where`, `/cats`, `/status`, and `/history` through Clowder command layer for FR-005, FR-014 in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts`
- [ ] T063 [US3] Remove hardcoded DeepSeek default routing from the V3 path for FR-006 in `sections/im/TangSengDaoDaoServer/modules/robot/event.go`
- [ ] T064 [US3] Add Clowder agent directory API client in `sections/im_web/packages/datasource-vue/src/api/clowder.ts`
- [ ] T065 [US3] Add agent directory, focus, and preferred cat actions in `sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts`
- [ ] T066 [US3] Render Clowder cat identity and connector badge on assistant messages in `sections/im_web/apps/chat/src/components/MessageCell.vue`
- [ ] T067 [US3] Add command response presentation as system/connector messages in `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
- [ ] T068 [US3] Run IM Web targeted command and agent directory tests output for US3 in `sections/im_web/.ai/V3.0/evidence.md`
- [ ] T069 [US3] Run Clowder targeted multi-agent routing tests output for US3 in `sections/im_web/.ai/V3.0/evidence.md`
- [ ] T070 [US3] Complete multi-agent routing and fallback review notes for US3 in `sections/im_web/.ai/V3.0/review-log.md`

**Checkpoint**: One IM conversation can reach multiple Clowder agents without V2 single-robot routing.

---

## Phase 6: User Story 4 - Provide IM-Side Thread and Agent Controls (Priority: P2)

**Goal**: Show and adjust Clowder binding, thread, agent directory, focus, permissions, and delivery state from the IM Web conversation UI.

**Independent Test**: Open a Clowder-enabled conversation settings panel, change thread/focus, inspect agents, and confirm UI and slash commands stay consistent.

### Tests for User Story 4

- [ ] T071 [P] [US4] Add component tests for Clowder settings panel ready, disabled, denied, and error states in `sections/im_web/apps/chat/tests/clowderPanel.test.ts`
- [ ] T072 [P] [US4] Add store tests for thread switch, focus set/clear, and last delivery state in `sections/im_web/apps/chat/tests/clowderControlStore.test.ts`
- [ ] T073 [US4] Add Playwright settings panel smoke for SC-001 and SC-006 in `sections/im_web/apps/chat/tests-e2e/smoke-v3-clowder-panel.spec.ts`

### Implementation for User Story 4

- [ ] T074 [US4] Add Clowder conversation settings panel component for FR-008, FR-013 in `sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue`
- [ ] T075 [US4] Wire Clowder panel entry into conversation settings view in `sections/im_web/apps/chat/src/views/ChatView.vue`
- [ ] T076 [US4] Implement thread binding selection and active thread update API calls in `sections/im_web/packages/datasource-vue/src/api/clowder.ts`
- [ ] T077 [US4] Implement focus set/clear and agent availability actions in `sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts`
- [ ] T078 [US4] Add disabled reason text and stable loading/error states in `sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue`
- [ ] T079 [US4] Expose bridge health, configured, reachable, version, and feature flag status in `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`
- [ ] T080 [US4] Add Clowder health/status route response mapping in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/routes/connector-webhooks.ts`
- [ ] T081 [US4] Run IM Web panel tests and smoke output for US4 in `sections/im_web/.ai/V3.0/evidence.md`
- [ ] T082 [US4] Complete UI state, text containment, and disabled-control review notes for US4 in `sections/im_web/.ai/V3.0/review-log.md`

**Checkpoint**: Users can inspect and control Clowder state without memorizing commands.

---

## Phase 7: User Story 5 - Preserve Streaming, Media, and History Behavior (Priority: P2)

**Goal**: Preserve V2.0 streaming merge, media fallback, markdown rendering, reconnect recovery, and large-history ordering while using Clowder.

**Independent Test**: Stream a long reply, send supported and unsupported media, refresh during and after completion, and verify one ordered final reply.

### Tests for User Story 5

- [ ] T083 [P] [US5] Add Clowder streaming adapter tests for placeholder, chunk, final, cleanup, and duplicate final prevention in `/media/leng/DiskB1/exp/clowder-ai/packages/api/test/im-web-streaming-adapter.test.js`
- [ ] T084 [P] [US5] Add IM Web streaming merge and refresh regression tests for SC-005 and FR-016 in `sections/im_web/apps/chat/tests/clowderStreamingMerge.test.ts`
- [ ] T085 [P] [US5] Add media fallback contract tests for supported and unsupported attachments in `sections/im_web/apps/chat/tests/clowderMediaFallback.test.ts`
- [ ] T086 [P] [US5] Add large-history and reconnect V2 regression coverage for Clowder replies in `sections/im_web/apps/chat/tests/clowderHistoryRecovery.test.ts`
- [ ] T087 [US5] Add Playwright streaming/media/refresh smoke for SC-005 and SC-007 in `sections/im_web/apps/chat/tests-e2e/smoke-v3-clowder-streaming-media.spec.ts`

### Implementation for User Story 5

- [ ] T088 [US5] Implement stream placeholder, edit, final, and cleanup methods for FR-010 in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/adapters/ImWebAdapter.ts`
- [ ] T089 [US5] Map Clowder streaming callback states to one stable TangSeng client message number in `sections/im/TangSengDaoDaoServer/modules/clowder/streaming.go`
- [ ] T090 [US5] Preserve single-message streaming merge in IM Web message store for FR-010, FR-016 in `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
- [ ] T091 [US5] Implement rich-block plaintext and markdown fallback for FR-011 in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/rich-block-plaintext.ts`
- [ ] T092 [US5] Implement TangSeng media attachment to Clowder content block normalization for FR-012 in `sections/im/TangSengDaoDaoServer/modules/clowder/media.go`
- [ ] T093 [US5] Implement unsupported media unavailable state in IM Web message cells for FR-012, FR-015 in `sections/im_web/apps/chat/src/components/MessageCell.vue`
- [ ] T094 [US5] Map queue-full, Clowder unavailable, timeout, media download, and outbound failure errors to visible retry/unavailable states for FR-015 in `sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts`
- [ ] T095 [US5] Run IM Web streaming, media, reconnect, and large-history regression output for US5 in `sections/im_web/.ai/V3.0/evidence.md`
- [ ] T096 [US5] Run Clowder streaming adapter and media tests output for US5 in `sections/im_web/.ai/V3.0/evidence.md`
- [ ] T097 [US5] Complete streaming, duplicate prevention, media fallback, and V2 regression review notes for US5 in `sections/im_web/.ai/V3.0/review-log.md`

**Checkpoint**: Clowder integration does not regress V2.0 message behavior.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, hardening, documentation, and release readiness across all stories.

- [ ] T098 [P] Update V3 implementation quickstart with final local startup steps in `sections/im_web/.ai/V3.0/quickstart.md`
- [ ] T099 [P] Update bridge and adapter contract docs with final request/response examples in `sections/im_web/.ai/V3.0/contracts/im-web-clowder-bridge.md`
- [ ] T100 [P] Update UI state contract with final panel fields and disabled reasons in `sections/im_web/.ai/V3.0/contracts/ui-state-contract.md`
- [ ] T101 [P] Update adapter interface contract with final streaming/media behavior in `sections/im_web/.ai/V3.0/contracts/im-web-adapter-interface.md`
- [ ] T102 Run full IM Web `pnpm type-check` and record final output in `sections/im_web/.ai/V3.0/evidence.md`
- [ ] T103 Run full IM Web `pnpm build` and record final output in `sections/im_web/.ai/V3.0/evidence.md`
- [ ] T104 Run full IM Web `pnpm test:unit` and record final output in `sections/im_web/.ai/V3.0/evidence.md`
- [ ] T105 Run runnable IM Web `pnpm test:e2e` smoke suite and record final output in `sections/im_web/.ai/V3.0/evidence.md`
- [ ] T106 Run Clowder API `pnpm build` and targeted connector tests and record final output in `sections/im_web/.ai/V3.0/evidence.md`
- [ ] T107 Run TangSengDaoDaoServer targeted Go tests for Clowder bridge and record final output in `sections/im_web/.ai/V3.0/evidence.md`
- [ ] T108 Complete final package boundary, secret/auth, connector contract, UI state, build/test, and smoke review in `sections/im_web/.ai/V3.0/review-log.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational completion.
- **Polish (Phase 8)**: Depends on all selected user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Start after Foundational. This is the MVP and provides binding, inbound routing, outbound delivery, and basic status.
- **US2 (P1)**: Start after Foundational. Can proceed alongside US1 for tests and policy design, but final verification depends on US1 bridge paths.
- **US3 (P1)**: Start after Foundational. Depends on US1 for message flow and on US2 for command permission enforcement.
- **US4 (P2)**: Depends on US1 status/binding APIs and benefits from US2/US3 state.
- **US5 (P2)**: Depends on US1 outbound delivery and should be verified after US3 routing is stable.

### Parallel Opportunities

- Setup tasks T002-T005 can run in parallel.
- Foundational type/config tasks T007-T015 can split between IM Web, TangSeng, and Clowder owners.
- Tests marked `[P]` inside each story can be created before implementation and in parallel by different owners.
- US2 permission policy, US3 routing tests, and US4 panel tests can be prepared while US1 bridge implementation is underway.
- Polish documentation tasks T098-T101 can run in parallel once implementation details settle.

---

## Parallel Example: User Story 1

```bash
Task: "T019 Add bridge inbound contract tests in /media/leng/DiskB1/exp/clowder-ai/packages/api/test/im-web-inbound-bridge.test.js"
Task: "T020 Add IM Web datasource API contract tests in sections/im_web/apps/chat/tests/clowderBridgeContracts.test.ts"
Task: "T021 Add TangSeng bridge normalization tests in sections/im/TangSengDaoDaoServer/modules/clowder/bridge_test.go"
Task: "T022 Add IM Web message store tests in sections/im_web/apps/chat/tests/clowderMessageStore.test.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete US1 tests and implementation.
3. Validate direct chat and group chat binding, one agent reply, refresh, and no duplicates.
4. Record build/test/smoke evidence before expanding scope.

### Incremental Delivery

1. Add US1 for core bridge and durable replies.
2. Add US2 for group permission safety.
3. Add US3 for true multi-agent routing.
4. Add US4 for first-class IM Web controls.
5. Add US5 for streaming/media/history hardening and V2 regression protection.

### Final Verification

1. Run IM Web type-check, build, unit tests, and runnable E2E smoke.
2. Run Clowder API build and connector-focused tests.
3. Run TangSeng targeted bridge tests.
4. Complete review log with package boundary, auth, UI state, connector contract, and smoke evidence.
