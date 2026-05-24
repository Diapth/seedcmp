# Tasks: IM Web V2.0 Completion

**Input**: Design documents from `sections/im_web/.ai/V2.0/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required. Every story must include build evidence, automated test evidence, smoke/user-flow evidence, and code review evidence before completion.

**Organization**: Tasks are grouped by gate and user story. Phase 2 is a blocking V1.0 regression closure gate; V2.0 feature work starts only after Phase 2 passes.

## Phase 1: Setup and Planning Hygiene

**Purpose**: Confirm the V2.0 workspace, quality gates, and issue tracker are ready before implementation.

- [X] T001 Verify root workspace scripts for `type-check`, `build`, `test:unit`, and `test:e2e` in `sections/im_web/package.json`
- [X] T002 [P] Verify Vitest setup and test include patterns in `sections/im_web/apps/chat/vitest.config.ts`
- [X] T003 [P] Verify Playwright smoke test setup and base URL behavior in `sections/im_web/apps/chat/playwright.config.ts`
- [X] T004 [P] Verify ignored generated artifacts, test output, `node_modules/`, and `dist/` patterns in `/media/leng/DiskB1/exp/seedcmp/.gitignore`
- [X] T005 Update testing tool status and any missing command notes in `sections/im_web/.ai/V2.0/issues/V2-01_testing_strategy.md`

---

## Phase 2: Foundational V1.0 Regression Closure Gate

**Purpose**: Close remaining V1.0-derived issues and prove the current client is clean before V2.0 feature work.

**CRITICAL**: No V2.0 user story implementation starts until this phase passes.

- [X] T006 Audit all V1.0 issue statuses and residual risks in `sections/im_web/.ai/v1.0/issues/` and record the closure summary in `sections/im_web/.ai/V2.0/issues/V2-01_testing_strategy.md`
- [X] T007 Run the existing V1.0 regression check suite from `sections/im_web/.ai/v1.0/checks/verify-all-issues.mjs` and record results in `sections/im_web/.ai/V2.0/issues/V2-01_testing_strategy.md`
- [X] T008 [P] Add or verify WebSocket address sanitization regression tests for V2-02 in `sections/im_web/apps/chat/tests/sdkAddress.test.ts`
- [X] T009 [P] Add or verify group offline unread retention regression tests for V2-03 in `sections/im_web/apps/chat/tests/groupOfflineUnreadRetention.test.ts`
- [X] T010 [P] Add or verify realtime CMD group store sync regression tests for V2-04 in `sections/im_web/apps/chat/tests/realtimeCmdGroupSync.test.ts`
- [X] T011 [P] Add or verify contact group creation and friend state regression tests for V2-05 in `sections/im_web/apps/chat/tests/contactGroupCreationState.test.ts`
- [X] T012 [P] Add or verify message UI stability regression tests for V2-06 in `sections/im_web/apps/chat/tests/messageUiStability.test.ts`
- [X] T013 [P] Add or verify group conversation presentation regression tests for V2-07 in `sections/im_web/apps/chat/tests/conversationPresentation.test.ts`
- [X] T014 [P] Add or verify group owner permission regression tests for V2-08 in `sections/im_web/apps/chat/tests/groupOwnerPermission.test.ts`
- [X] T015 Verify and fix WebSocket address sanitization for V2-02 in `sections/im_web/packages/datasource-vue/src/stores/sdkAddress.ts` and `sections/im_web/packages/datasource-vue/src/stores/sdk.ts`
- [X] T016 Verify and fix group offline unread retention for V2-03 in `sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts`, `sections/im_web/packages/datasource-vue/src/stores/groupStore.ts`, and `sections/im_web/packages/datasource-vue/src/cmd/index.ts`
- [X] T017 Verify and fix realtime CMD group synchronization for V2-04 in `sections/im_web/packages/datasource-vue/src/cmd/index.ts`
- [X] T018 Verify and fix contact group creation and friend search states for V2-05 in `sections/im_web/packages/contacts-vue/src/views/ContactList.vue`, `sections/im_web/packages/contacts-vue/src/views/AddFriendPage.vue`, and `sections/im_web/packages/contacts-vue/src/utils/friendSearchState.ts`
- [X] T019 Verify and fix message UI stability for V2-06 in `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`, `sections/im_web/packages/datasource-vue/src/cmd/index.ts`, and `sections/im_web/apps/chat/src/components/MessageList.vue`
- [X] T020 Verify and fix group conversation sorting and settings regressions for V2-07 in `sections/im_web/apps/chat/src/utils/conversationPresentation.ts`, `sections/im_web/apps/chat/src/views/ConversationList.vue`, and `sections/im_web/packages/base-vue/src/components/GroupSettingsDrawer.vue`
- [X] T021 Verify and fix group owner and admin permission fallback for V2-08 in `sections/im_web/packages/base-vue/src/components/GroupSettingsDrawer.vue` and `sections/im_web/packages/datasource-vue/src/stores/groupChatUtils.ts`
- [X] T022 Run `pnpm type-check`, `pnpm build`, and `pnpm test:unit` from `sections/im_web/package.json` and record output in `sections/im_web/.ai/V2.0/issues/V2-01_testing_strategy.md`
- [X] T023 Run required manual smoke checks for V2-02 through V2-08 and record closure evidence in `sections/im_web/.ai/V2.0/issues/`
- [X] T024 Complete code review for the V1.0 regression closure gate and record the result in `sections/im_web/.ai/V2.0/tasks.md`

**2026-05-24 Phase 2 Close Evidence**

- Build gate: `pnpm type-check` exit 0; `pnpm lint` exit 0 with 10 existing unused warnings and 0 errors; `pnpm test:unit` exit 0 with 8 files / 23 tests; `pnpm build` exit 0 with known chunk size warning; `pnpm test:e2e` exit 0 with 1 Playwright smoke passed.
- Browser smoke: `sections/im_web/.ai/V2.0/issues/tests-e2e/two-account-audit-2026-05-24T05-09-53-941Z/summary.md` reports 22 checks passed, 0 failed, 25 screenshots, 0 network errors.
- Code review: local review found no blocking issues in Phase 2 regression closure or V2-10 media-send patch. Confirmed store-owned SDK send path, backend-aligned `/file/upload` contract, `MessageFile` encode/contentType, runtime `.js` parity, and failure UI state. Residual non-blocking risks: existing unused lint warnings and large index chunk warning.

**Checkpoint**: V1.0-derived regression backlog is zero and the client is clean enough for V2.0 feature work.

---

## Phase 3: User Story 1 - Complete Daily Messaging (Priority: P1) MVP

**Goal**: Complete reliable send, receive, media, message action, reaction, receipt, pin, reminder, and refresh/reconnect behavior for direct and group conversations.

**Independent Test**: Use one direct chat and one group chat to exchange text, media, reply, edit, delete, reaction, receipt, pinned-message, and reminder interactions, then refresh and reconnect to confirm restored state.

### Tests for User Story 1

- [X] T025 [P] [US1] Add message normalization, duplicate suppression, and unsupported content tests in `sections/im_web/apps/chat/tests/messageStoreDailyMessaging.test.ts`
- [X] T026 [P] [US1] Add message action, reaction, receipt, pin, and reminder store tests in `sections/im_web/apps/chat/tests/messageActions.test.ts`
- [X] T027 [P] [US1] Add media send and preview component tests in `sections/im_web/apps/chat/tests/messageMediaCells.test.ts`
- [X] T028 [US1] Add Playwright daily messaging smoke flow in `sections/im_web/apps/chat/tests-e2e/smoke-uc1-daily-messaging.spec.ts`

### Implementation for User Story 1

- [X] T029 [P] [US1] Complete supported message content type registration and unavailable fallbacks in `sections/im_web/packages/datasource-vue/src/contentTypes/index.ts`
- [X] T030 [US1] Implement message send, retry, pending, failed, and duplicate suppression behavior in `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
- [X] T031 [US1] Implement media asset upload, preview, play, download, and retry state mapping in `sections/im_web/packages/datasource-vue/src/api/index.ts` and `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
- [X] T032 [P] [US1] Complete media and unsupported message rendering in `sections/im_web/packages/base-vue/src/components/messages/ImageCell.vue`, `sections/im_web/packages/base-vue/src/components/messages/FileCell.vue`, `sections/im_web/packages/base-vue/src/components/messages/VoiceCell.vue`, and `sections/im_web/packages/base-vue/src/components/messages/VideoCell.vue`
- [X] T033 [US1] Implement edit, revoke, local delete, mutual delete, reply, and mention action surfaces in `sections/im_web/apps/chat/src/components/MessageList.vue`, `sections/im_web/apps/chat/src/components/MessageInput.vue`, and `sections/im_web/packages/base-vue/src/components/ContextMenu.vue`
- [X] T034 [US1] Implement reactions, receipts, pinned messages, and reminders with verified-backend or unavailable states in `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts` and `sections/im_web/apps/chat/src/components/MessageList.vue`
- [X] T035 [US1] Keep conversation summaries, unread counts, mentions, and stale-summary cleanup synchronized in `sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts`
- [X] T036 [US1] Run `pnpm type-check`, `pnpm build`, `pnpm test:unit`, and the US1 Playwright smoke from `sections/im_web/package.json` and record evidence in `sections/im_web/.ai/V2.0/tasks.md`
- [X] T037 [US1] Complete US1 code review against the checklist in `sections/im_web/.ai/V2.0/plan.md`

**Checkpoint**: US1 is independently functional and testable.

**2026-05-24 US1 Close Evidence**

- T025/T026/T027: `messageStoreDailyMessaging.test.ts`, `messageActions.test.ts`, `messageMediaSending.test.ts`, and `messageMediaCells.test.ts` cover payload normalization, duplicate suppression, unsupported fallback registration, send pending/fail/retry, media upload retry state, revoke/edit/delete, reactions, receipts, pinned messages, reminders, reply/mention surfaces, and media preview/unavailable states.
- T029-T035: `messageStore.ts` owns daily messaging state for optimistic text/media sends, retryable failures, backend-backed edit/revoke/local delete/mutual delete, read receipts, reaction toggles, pinned-message sync, reminder sync/done state, conversation summary recomputation, and stale revoked/unsupported digest cleanup. `api/index.ts` wraps verified TangSengDaoDaoServer message endpoints for edit, delete, mutual delete, readed, receipt, pinned, and reminder flows. `MessageList.vue`, `MessageInput.vue`, and `ContextMenu.vue` expose the corresponding UI actions and disabled unavailable states.
- T028 smoke: `cd sections/im_web/apps/chat && pnpm exec playwright test tests-e2e/smoke-uc1-daily-messaging.spec.ts --project=chromium` exit 0, 1 passed. The smoke logs in, sends a text message, and verifies the right-click daily action surface.
- Verification: `cd sections/im_web && pnpm type-check` exit 0; `cd sections/im_web && pnpm build` exit 0 with existing large chunk warning; `cd sections/im_web && pnpm test:unit` exit 0, 11 files / 35 tests passed.
- Code review: local review against the plan checklist found no blocking US1 issues. Package ownership stays in datasource stores/API wrappers with UI-only action surfaces in chat/base components; backend-backed actions use confirmed TangSengDaoDaoServer routes; unsupported reminder creation remains a disabled visible state rather than a fake action; destructive actions are explicit menu actions; build, unit, and smoke evidence reviewed. Residual non-blocking risks: full manual multi-device receipt/reaction convergence still depends on backend test accounts, and Vite still reports the pre-existing large `index` chunk warning.

---

## Phase 4: User Story 2 - Manage Groups End-to-End (Priority: P1)

**Goal**: Complete group profile, membership, invitation, QR entry, role, mute, blacklist, ownership, exit, and disband flows with clear permission boundaries.

**Independent Test**: Create a group, invite members, update settings, promote an admin, mute and blacklist a member, transfer ownership, and exit or disband where permitted.

### Tests for User Story 2

- [X] T038 [P] [US2] Add group role and permission fallback tests in `sections/im_web/apps/chat/tests/groupPermissions.test.ts`
- [X] T039 [P] [US2] Add group invite, QR, approval, expired, and unavailable state tests in `sections/im_web/apps/chat/tests/groupJoinFlows.test.ts`
- [X] T040 [P] [US2] Add group settings drawer component tests in `sections/im_web/apps/chat/tests/groupSettingsDrawer.test.ts`
- [X] T041 [US2] Add Playwright group management smoke flow in `sections/im_web/apps/chat/tests-e2e/smoke-uc2-group-management.spec.ts`

### Implementation for User Story 2

- [X] T042 [US2] Complete group profile, announcement, saved status, mute setting, lifecycle, and permission state in `sections/im_web/packages/datasource-vue/src/stores/groupStore.ts`
- [X] T043 [US2] Complete member role, mute, blacklist, remove, transfer, exit, and disband store actions in `sections/im_web/packages/datasource-vue/src/stores/groupStore.ts`
- [X] T044 [US2] Complete group settings UI, permission gates, destructive confirmations, and unavailable states in `sections/im_web/packages/base-vue/src/components/GroupSettingsDrawer.vue`
- [X] T045 [US2] Complete create group, invite selection, and member list workflows in `sections/im_web/apps/chat/src/views/CreateGroupPage.vue` and `sections/im_web/apps/chat/src/views/GroupMemberList.vue`
- [X] T046 [US2] Implement QR invite and invite confirmation UI states in `sections/im_web/apps/chat/src/views/CreateGroupPage.vue` and `sections/im_web/packages/base-vue/src/components/GroupSettingsDrawer.vue`
- [X] T047 [US2] Normalize group realtime notices and member updates in `sections/im_web/packages/datasource-vue/src/cmd/index.ts`
- [X] T048 [US2] Run `pnpm type-check`, `pnpm build`, `pnpm test:unit`, and the US2 Playwright smoke from `sections/im_web/package.json` and record evidence in `sections/im_web/.ai/V2.0/tasks.md`
- [X] T049 [US2] Complete US2 code review against the checklist in `sections/im_web/.ai/V2.0/plan.md`

**Checkpoint**: US2 is independently functional and testable.

**2026-05-24 US2 Close Evidence**

- T038-T040: Added `groupPermissions.test.ts`, `groupJoinFlows.test.ts`, and `groupSettingsDrawer.test.ts` covering permission fallback, store-owned group actions, invite/QR/approval/expired/unavailable state contracts, and drawer destructive/permission UI contracts.
- T041 smoke: `cd sections/im_web/apps/chat && pnpm exec playwright test tests-e2e/smoke-uc2-group-management.spec.ts --project=chromium` exit 0, 1 passed. The smoke logs in, opens a group conversation, opens settings, and verifies QR, invitation, mute, and invite member controls.
- T042-T047: `groupStore.ts` now owns profile/settings, invite, member remove, role management, member mute, full mute, blacklist, transfer, exit, disband, QR, invite confirmation, and scan join state. `api/index.ts` wraps the verified group invite/QR/scan/blacklist endpoints. `GroupSettingsDrawer.vue`, `CreateGroupPage.vue`, and `GroupMemberList.vue` expose permission-gated actions, destructive confirmations, invite approval, QR, expired/unavailable copy, and member management. `cmd/index.ts` refreshes group info/member state for realtime group membership, manager, transfer, blacklist, and forbidden updates.
- Verification: `cd sections/im_web && pnpm type-check` exit 0; `cd sections/im_web && pnpm build` exit 0 with existing large chunk warning; `cd sections/im_web && pnpm test:unit` exit 0, 14 files / 40 tests passed.
- Code review: local review against the plan checklist found no blocking US2 issues. Group state mutations are centralized in datasource store actions; UI uses permission gates and confirmations; unsupported/uncertain blacklist and QR states are visible as disabled/unavailable states where appropriate; backend wrappers map to TangSengDaoDaoServer routes. Residual non-blocking risk: full invite approval and scan-join end-to-end approval still depends on multi-account backend setup.

---

## Phase 5: User Story 3 - Recover Reliably From Network Changes (Priority: P1)

**Goal**: Make connection, reconnect, offline queue, recovery sync, and multi-device kickout states visible and reliable.

**Independent Test**: Send messages while offline, reconnect, force gateway reconnect, receive messages on another device, and confirm pending sends, missed data, unread counts, and summaries converge.

### Tests for User Story 3

- [ ] T050 [P] [US3] Add SDK connection state and address recovery tests in `sections/im_web/apps/chat/tests/sdkRecovery.test.ts`
- [ ] T051 [P] [US3] Add offline queue and pending work tests in `sections/im_web/apps/chat/tests/offlineQueue.test.ts`
- [ ] T052 [P] [US3] Add kickout state cleanup tests in `sections/im_web/apps/chat/tests/kickoutRecovery.test.ts`
- [ ] T053 [US3] Add Playwright reconnect and recovery smoke flow in `sections/im_web/apps/chat/tests-e2e/smoke-uc4-recovery.spec.ts`

### Implementation for User Story 3

- [ ] T054 [US3] Complete visible SDK connection states and reconnect transitions in `sections/im_web/packages/datasource-vue/src/stores/sdk.ts`
- [ ] T055 [US3] Complete offline pending queue preservation and resend/failure behavior in `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
- [ ] T056 [US3] Complete recovery synchronization for conversations, messages, reactions, pins, reminders, read states, and group updates in `sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts`
- [ ] T057 [US3] Complete kickout sensitive-state cleanup in `sections/im_web/packages/datasource-vue/src/stores/kickout.ts` and `sections/im_web/apps/chat/src/App.vue`
- [ ] T058 [US3] Add user-visible connection and recovery indicators in `sections/im_web/apps/chat/src/layouts/MainLayout.vue`
- [ ] T059 [US3] Run `pnpm type-check`, `pnpm build`, `pnpm test:unit`, and the US3 Playwright smoke from `sections/im_web/package.json` and record evidence in `sections/im_web/.ai/V2.0/tasks.md`
- [ ] T060 [US3] Complete US3 code review against the checklist in `sections/im_web/.ai/V2.0/plan.md`

**Checkpoint**: P1 core is stable enough to begin P2 work.

---

## Phase 6: User Story 4 - Complete Account, Settings, and Login Flows (Priority: P2)

**Goal**: Complete profile, personal QR code, devices, notification preferences, security settings, account safety actions, and QR login states.

**Independent Test**: Edit profile, show personal QR, complete QR login state transitions, change notification preferences, review devices, remove a device, and validate logout behavior.

### Tests for User Story 4

- [ ] T061 [P] [US4] Add profile and device management tests in `sections/im_web/apps/chat/tests/accountSettings.test.ts`
- [ ] T062 [P] [US4] Add QR login state tests in `sections/im_web/apps/chat/tests/qrLogin.test.ts`
- [ ] T063 [US4] Add Playwright account and QR login smoke flow in `sections/im_web/apps/chat/tests-e2e/smoke-uc6-account-settings.spec.ts`

### Implementation for User Story 4

- [ ] T064 [US4] Complete profile view/edit, avatar update, and personal QR state in `sections/im_web/apps/chat/src/views/MyProfileDrawer.vue` and `sections/im_web/packages/datasource-vue/src/stores/userStore.ts`
- [ ] T065 [US4] Complete device list, device removal, and logout state handling in `sections/im_web/apps/chat/src/views/DeviceManagementPage.vue`
- [ ] T066 [US4] Complete QR login waiting, scanned, confirmed, expired, rejected, and failed states in `sections/im_web/packages/login-vue/src/views/LoginPage.vue` and `sections/im_web/packages/login-vue/src/stores/loginStore.ts`
- [ ] T067 [US4] Complete notification preference and unavailable browser permission states in `sections/im_web/apps/chat/src/views/MyProfileDrawer.vue`
- [ ] T068 [US4] Run `pnpm type-check`, `pnpm build`, `pnpm test:unit`, and the US4 Playwright smoke from `sections/im_web/package.json` and record evidence in `sections/im_web/.ai/V2.0/tasks.md`
- [ ] T069 [US4] Complete US4 code review against the checklist in `sections/im_web/.ai/V2.0/plan.md`

**Checkpoint**: US4 is independently functional and testable.

---

## Phase 7: User Story 5 - Add Discovery and Productivity Surfaces (Priority: P3)

**Goal**: Complete global search, workplace surfaces, robot interactions, reports, and common configuration-driven features where backend support is available.

**Independent Test**: Search people, groups, and messages; open workplace content; use robot interactions; submit a report; and verify unavailable states do not break chat.

### Tests for User Story 5

- [ ] T070 [P] [US5] Add categorized search tests in `sections/im_web/apps/chat/tests/searchResults.test.ts`
- [ ] T071 [P] [US5] Add workplace and client config tests in `sections/im_web/apps/chat/tests/workplaceConfig.test.ts`
- [ ] T072 [P] [US5] Add robot and report unavailable/submit state tests in `sections/im_web/apps/chat/tests/robotReportFlows.test.ts`
- [ ] T073 [US5] Add Playwright discovery and reporting smoke flow in `sections/im_web/apps/chat/tests-e2e/smoke-uc7-discovery-productivity.spec.ts`

### Implementation for User Story 5

- [ ] T074 [US5] Complete global search service and result routing in `sections/im_web/packages/datasource-vue/src/api/index.ts` and `sections/im_web/apps/chat/src/components/SearchResultList.vue`
- [ ] T075 [US5] Complete workplace banner, category, app, recent app, add/remove, and ordering states in `sections/im_web/apps/chat/src/views/ChatWelcome.vue`
- [ ] T076 [US5] Complete robot menu, inline result, response, ack, and unavailable states in `sections/im_web/apps/chat/src/components/MessageInput.vue` and `sections/im_web/apps/chat/src/components/MessageList.vue`
- [ ] T077 [US5] Complete report target, category, description, attachment, submit, and failure states in `sections/im_web/apps/chat/src/views/UserProfileDrawer.vue`
- [ ] T078 [US5] Apply common client configuration, feature visibility, chat background, and update prompt states in `sections/im_web/packages/base-vue/src/composables/useRemoteConfig.ts`
- [ ] T079 [US5] Run `pnpm type-check`, `pnpm build`, `pnpm test:unit`, and the US5 Playwright smoke from `sections/im_web/package.json` and record evidence in `sections/im_web/.ai/V2.0/tasks.md`
- [ ] T080 [US5] Complete US5 code review against the checklist in `sections/im_web/.ai/V2.0/plan.md`

**Checkpoint**: US5 is independently functional and testable.

---

## Phase 8: User Story 6 - Improve Large History and Desktop Readiness (Priority: P3)

**Goal**: Improve large-history browsing, dark mode, notifications, unread behavior, and desktop-form-factor readiness for long-running use.

**Independent Test**: Load thousands of messages, scroll/search/send/receive, switch theme, trigger notifications, and confirm unread counts stay correct.

### Tests for User Story 6

- [ ] T081 [P] [US6] Add large history rendering and scroll stability tests in `sections/im_web/apps/chat/tests/largeHistory.test.ts`
- [ ] T082 [P] [US6] Add dark mode and responsive layout tests in `sections/im_web/apps/chat/tests/themeResponsive.test.ts`
- [ ] T083 [P] [US6] Add notification and unread behavior tests in `sections/im_web/apps/chat/tests/notificationUnread.test.ts`
- [ ] T084 [US6] Add Playwright large history and desktop readiness smoke flow in `sections/im_web/apps/chat/tests-e2e/smoke-uc8-large-history.spec.ts`

### Implementation for User Story 6

- [ ] T085 [US6] Improve large message list rendering and stable sizing in `sections/im_web/apps/chat/src/components/MessageList.vue`
- [ ] T086 [US6] Improve conversation list unread and notification state handling in `sections/im_web/apps/chat/src/views/ConversationList.vue` and `sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts`
- [ ] T087 [US6] Complete dark mode persistence and responsive shell behavior in `sections/im_web/apps/chat/src/layouts/MainLayout.vue` and `sections/im_web/packages/base-vue/src/styles/variables.css`
- [ ] T088 [US6] Complete desktop-style notification permission, denied, revoked, and unavailable states in `sections/im_web/apps/chat/src/views/MyProfileDrawer.vue`
- [ ] T089 [US6] Run `pnpm type-check`, `pnpm build`, `pnpm test:unit`, and the US6 Playwright smoke from `sections/im_web/package.json` and record evidence in `sections/im_web/.ai/V2.0/tasks.md`
- [ ] T090 [US6] Complete US6 code review against the checklist in `sections/im_web/.ai/V2.0/plan.md`

**Checkpoint**: US6 is independently functional and testable.

---

## Phase 9: Polish and Cross-Cutting Release Readiness

**Purpose**: Final verification and release readiness after all desired stories are complete.

- [ ] T091 [P] Update final backend-alignment and deferral notes in `sections/im_web/.ai/V2.0/research.md`
- [ ] T092 [P] Update smoke instructions and environment notes in `sections/im_web/.ai/V2.0/quickstart.md`
- [ ] T093 [P] Update entity and state changes discovered during implementation in `sections/im_web/.ai/V2.0/data-model.md`
- [ ] T094 Run full `pnpm type-check`, `pnpm build`, `pnpm test:unit`, and `pnpm test:e2e` verification from `sections/im_web/package.json`
- [ ] T095 Run final manual realtime recovery checks and record results in `sections/im_web/.ai/V2.0/issues/V2-01_testing_strategy.md`
- [ ] T096 Complete final code review and record release readiness in `sections/im_web/.ai/V2.0/tasks.md`

---

## Dependencies and Execution Order

### Phase Dependencies

- Phase 1 has no dependencies.
- Phase 2 depends on Phase 1 and blocks every V2.0 user story.
- Phase 3, Phase 4, and Phase 5 are all P1 stories and should run after Phase 2; execute them in the listed order unless the same files are isolated by assigned owners.
- Phase 6 depends on P1 completion.
- Phase 7 and Phase 8 depend on P1 completion and can start after Phase 6 if team capacity is limited.
- Phase 9 depends on all desired story phases being complete.

### User Story Dependencies

- US1 depends on the V1.0 regression closure gate.
- US2 depends on the V1.0 regression closure gate and shares group files with Phase 2, so do not overlap edits to `GroupSettingsDrawer.vue`, `groupStore.ts`, or `cmd/index.ts`.
- US3 depends on the V1.0 regression closure gate and shares SDK/message/conversation store files with US1.
- US4 can start after P1 stories complete.
- US5 can start after P1 stories complete.
- US6 can start after P1 stories complete.

### Within Each Story

- Define or update tests before implementation when behavior is missing.
- Store and datasource work precedes UI work.
- UI work precedes Playwright smoke validation.
- Build, automated tests, smoke evidence, and code review are required before marking the story done.

---

## Parallel Opportunities

- T002, T003, and T004 can run in parallel.
- T008 through T014 can run in parallel because they target different test files.
- T025 through T027 can run in parallel for US1 test coverage.
- T038 through T040 can run in parallel for US2 test coverage.
- T050 through T052 can run in parallel for US3 test coverage.
- T061 and T062 can run in parallel for US4 test coverage.
- T070 through T072 can run in parallel for US5 test coverage.
- T081 through T083 can run in parallel for US6 test coverage.
- T091 through T093 can run in parallel during final documentation polish.

---

## Parallel Example: User Story 1

```bash
# Independent test authoring can run together:
Task: "T025 Add message normalization, duplicate suppression, and unsupported content tests in sections/im_web/apps/chat/tests/messageStoreDailyMessaging.test.ts"
Task: "T026 Add message action, reaction, receipt, pin, and reminder store tests in sections/im_web/apps/chat/tests/messageActions.test.ts"
Task: "T027 Add media send and preview component tests in sections/im_web/apps/chat/tests/messageMediaCells.test.ts"
```

## Parallel Example: User Story 2

```bash
# Independent group test surfaces can run together:
Task: "T038 Add group role and permission fallback tests in sections/im_web/apps/chat/tests/groupPermissions.test.ts"
Task: "T039 Add group invite, QR, approval, expired, and unavailable state tests in sections/im_web/apps/chat/tests/groupJoinFlows.test.ts"
Task: "T040 Add group settings drawer component tests in sections/im_web/apps/chat/tests/groupSettingsDrawer.test.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 setup checks.
2. Complete Phase 2 V1.0 regression closure gate.
3. Complete Phase 3 US1 daily messaging.
4. Stop and validate US1 independently before expanding scope.

### Incremental Delivery

1. Close V1.0 regressions and prove the build/test baseline.
2. Deliver US1 messaging.
3. Deliver US2 group management.
4. Deliver US3 recovery and realtime reliability.
5. Deliver US4 account and login flows.
6. Deliver US5 discovery and productivity.
7. Deliver US6 large history and desktop readiness.

### Completion Rule

Gray or placeholder entry points may remain visible, but they do not count as done unless the backend flow is verified end-to-end. Each completed task must be checked off in this file only after the corresponding evidence is recorded.
