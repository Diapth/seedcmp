# Tasks: IM Web UI Optimization

**Input**: Design documents from `/specs/001-im-web-ui-optimization/`

**Prerequisites**: `specs/001-im-web-ui-optimization/plan.md`, `specs/001-im-web-ui-optimization/spec.md`, `specs/001-im-web-ui-optimization/research.md`, `specs/001-im-web-ui-optimization/data-model.md`, `specs/001-im-web-ui-optimization/contracts/`, `specs/001-im-web-ui-optimization/quickstart.md`, `specs/001-im-web-ui-optimization/references/manifest.pdf`

**Tests**: Automated H5 smoke/screenshot checks are required after runtime setup. Manual visual browser testing remains mandatory at every phase checkpoint, with issue recording under `issues/001-im-web-ui-optimization-qa.md`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. Each implementation checkpoint must close or explicitly defer current-stage issues before the next phase begins.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on an incomplete task
- **[Story]**: Which user story this task belongs to, required only inside user story phases
- **File paths**: Every task includes exact target file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Make the uni-app project runnable for H5 visual QA and establish the required file surface.

- [x] T001 Create `package.json` with uni-app Vue 3, Pinia, H5 dev/build scripts, automated H5 smoke/screenshot scripts, and dependency compatibility notes in `specs/001-im-web-ui-optimization/contracts/platform-compatibility.md`
- [x] T002 Configure Vue 3 and Pinia app bootstrap in `main.js` and root app shell mount in `App.vue`
- [x] T003 Register planned login, chat, group, contacts, agents, files, and settings routes in `pages.json`
- [x] T004 Configure cross-platform metadata and base stylesheet imports in `manifest.json` and `uni.scss`, then record platform guard/fallback notes in `specs/001-im-web-ui-optimization/contracts/platform-compatibility.md`
- [x] T005 [P] Create the stage QA issue log template in `issues/001-im-web-ui-optimization-qa.md`
- [x] T006 [P] Create base style files `styles/tokens.scss`, `styles/layout.scss`, and `styles/themes.scss`
- [x] T007 Run initial `npm install`, `npm run dev:h5`, and automated H5 smoke/screenshot checks, then record setup visual QA results for 375x844, 768x1024, 1024x768, and 1440x900 in `issues/001-im-web-ui-optimization-qa.md`
- [x] T008 Resolve setup QA findings recorded in `issues/001-im-web-ui-optimization-qa.md`, re-test `specs/001-im-web-ui-optimization/quickstart.md`, and commit setup changes with a Chinese git message

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared design, state, icon, responsive, and layout primitives that all user stories depend on.

**Critical**: No user story work can begin until this phase is complete.

- [x] T009 Define cross-platform spacing, typography, colors, focus, status, and touch-target tokens in `styles/tokens.scss`
- [x] T010 Define desktop workbench, mobile stacked, safe-area, fixed input, and right-workspace layout rules in `styles/layout.scss`
- [x] T011 Define light/dark theme variables and reduced-motion behavior in `styles/themes.scss`
- [x] T012 [P] Implement responsive, safe-area, and visual-state composables in `composables/useResponsiveLayout.js`, `composables/useSafeArea.js`, and `composables/useVisualState.js`
- [x] T013 [P] Implement the open-source icon wrapper and icon-name contract in `components/common/AppIcon.vue`
- [x] T014 [P] Implement shared avatar, empty state, status badge, and dialog components in `components/common/AppAvatar.vue`, `components/common/AppEmptyState.vue`, `components/common/AppStatusBadge.vue`, and `components/common/AppDialog.vue`
- [x] T015 [P] Implement app/session and navigation store foundations in `stores/app.js` and `stores/navigation.js`
- [x] T016 [P] Implement conversation and message store foundations in `stores/conversation.js` and `stores/message.js`
- [x] T017 [P] Implement contacts, agents, files, and settings store foundations in `stores/contact.js`, `stores/agent.js`, `stores/file.js`, and `stores/settings.js`
- [x] T018 [P] Implement shared formatting and avatar fallback utilities in `utils/formatConversation.js`, `utils/formatMessage.js`, and `utils/avatarFallback.js`
- [x] T019 [P] Complete pre-implementation source reference audit notes in `specs/001-im-web-ui-optimization/contracts/source-reference-audit.md` and implement legacy manifest coverage helper logic in `utils/manifestCoverage.js`
- [x] T020 Implement the responsive application shell container in `components/layout/AppShell.vue`
- [x] T021 [P] Implement primary desktop and mobile navigation components in `components/layout/DesktopSidebar.vue` and `components/layout/MobileTabBar.vue`
- [x] T022 Wire global styles, theme class, connection state, and safe-area CSS variables through `App.vue`
- [x] T023 Run foundational visual QA and automated H5 smoke/screenshot checks against `specs/001-im-web-ui-optimization/quickstart.md`, then record desktop/mobile/Android-relevant findings in `issues/001-im-web-ui-optimization-qa.md`
- [x] T024 Resolve foundational QA findings recorded in `issues/001-im-web-ui-optimization-qa.md`, re-test affected viewports, and commit foundation changes with a Chinese git message

---

## Phase 3: User Story 1 - Cross-Platform IM Main Shell (Priority: P1) MVP

**Goal**: Users can enter a clear desktop IM workbench or mobile/Android touch-first shell and reach chat, group, contacts, agents, files, and settings modules.

**Independent Test**: From login, enter the app at 375x844, 768x1024, 1024x768, and 1440x900; verify every primary module is reachable, active navigation is visible, Chinese labels render correctly, and no shell content overlaps.

### Implementation for User Story 1

- [x] T025 [US1] Populate primary module navigation data, active route matching, and badge placeholders in `stores/navigation.js`
- [x] T026 [P] [US1] Implement password login, QR entry, loading, error, and mobile-safe layout states in `pages/login/index.vue`
- [x] T027 [P] [US1] Implement registration form, validation states, and touch-first stacked layout in `pages/login/register.vue`
- [x] T028 [US1] Implement the chat workbench welcome/list landing and mobile list entry in `pages/chat/index.vue`
- [x] T029 [P] [US1] Create reachable module landing placeholders with correct Chinese labels in `pages/group/index.vue`, `pages/contacts/index.vue`, `pages/agents/index.vue`, `pages/files/index.vue`, and `pages/settings/index.vue`
- [x] T030 [US1] Integrate desktop sidebar, mobile tab bar, route titles, connection banner, and safe-area behavior in `components/layout/AppShell.vue`
- [x] T031 [US1] Verify all primary route titles and navigation entries against `specs/001-im-web-ui-optimization/contracts/routes-contract.md` and update `pages.json`
- [x] T032 [US1] Implement mobile list/detail switching rules and Android-safe bottom navigation spacing in `components/layout/MobileTabBar.vue` and `composables/useSafeArea.js`
- [x] T033 [US1] Run US1 visual browser QA at 375x844, 768x1024, 1024x768, and 1440x900, include the 5-second recognition check, and record findings in `issues/001-im-web-ui-optimization-qa.md`
- [x] T034 [US1] Resolve US1 shell/navigation QA findings recorded in `issues/001-im-web-ui-optimization-qa.md` and re-test the affected routes
- [x] T035 [US1] Record US1 verification notes in `issues/001-im-web-ui-optimization-qa.md` and commit US1 changes with a Chinese git message

---

## Phase 4: User Story 2 - Clear And Stable Chat Experience (Priority: P1)

**Goal**: Users can browse conversations, open single/group/AI chats, read varied message types, and use input states without layout collisions.

**Independent Test**: Use mock single chat, group chat, and AI/robot conversations to verify list summaries, unread/pinned/muted/draft/@ states, message bubbles, right preview, input controls, empty/error/loading states, and mobile safe-area behavior.

### Implementation for User Story 2

- [x] T036 [US2] Populate conversation preview fixtures and state transitions in `stores/conversation.js`
- [x] T037 [US2] Populate message item, input, reply, mention, voice, robot, loading, failed, and sending states in `stores/message.js`
- [x] T038 [P] [US2] Implement conversation and message formatting for long Chinese names, digests, timestamps, badges, and supported content types in `utils/formatConversation.js` and `utils/formatMessage.js`
- [x] T039 [P] [US2] Implement conversation list and row states in `components/chat/ConversationList.vue` and `components/chat/ConversationItem.vue`
- [x] T040 [P] [US2] Implement message list and message bubble states for text, image, GIF, voice, video, location, card, file, merged history, sticker, system, revoked, failed, and loading messages in `components/chat/MessageList.vue` and `components/chat/MessageBubble.vue`
- [x] T041 [P] [US2] Implement message context menu and input toolbar states in `components/chat/MessageContextMenu.vue` and `components/chat/MessageInput.vue`
- [x] T042 [US2] Implement chat right workspace shell and file/image preview states in `components/chat/RightWorkspace.vue` and `components/chat/FilePreviewPanel.vue`
- [x] T043 [US2] Implement single chat, group chat, AI contact, empty, loading, failed-send, and mobile back-path detail view in `pages/chat/detail.vue`
- [x] T044 [US2] Implement group chat entry behavior and member summary integration in `pages/group/index.vue`
- [x] T045 [US2] Integrate conversation search, selected conversation persistence, and notification-permission messaging in `pages/chat/index.vue`
- [x] T046 [US2] Run US2 visual browser QA at required viewports plus Android validation for input/safe-area behavior, include the 5-second recognition check, and record findings in `issues/001-im-web-ui-optimization-qa.md`
- [x] T047 [US2] Resolve US2 chat/message/input QA findings recorded in `issues/001-im-web-ui-optimization-qa.md` and re-test affected chat routes
- [x] T048 [US2] Record US2 verification notes in `issues/001-im-web-ui-optimization-qa.md` and commit US2 changes with a Chinese git message

---

## Phase 5: User Story 3 - Consistent Collaboration Panels And Resource Pages (Priority: P2)

**Goal**: Users get consistent contacts, agents, files, settings, right workspace, and Clowder/resource experiences across desktop and mobile.

**Independent Test**: Visit contacts, group flows, agents, files, settings, device management, and right workspace panels; verify hierarchy, action density, empty/error states, mobile back paths, and manifest coverage alignment.

### Implementation for User Story 3

- [x] T049 [P] [US3] Implement contacts/groups/requests/blacklist state fixtures and actions in `stores/contact.js`
- [x] T050 [P] [US3] Implement contact list and contact card components in `components/contacts/ContactList.vue` and `components/contacts/ContactCard.vue`
- [x] T051 [US3] Implement contacts, friend requests, add friend, and blacklist pages in `pages/contacts/index.vue`, `pages/contacts/friend-requests.vue`, `pages/contacts/add.vue`, and `pages/contacts/blacklist.vue`
- [x] T052 [US3] Implement create group, invite members, member search, and cat member management in `pages/group/create.vue` and `pages/group/members.vue`, while keeping deferred group QR rationale only in `specs/001-im-web-ui-optimization/contracts/legacy-manifest-coverage.md`
- [x] T053 [P] [US3] Implement agent state, agent card, catalog, creation, DeepSeek, and Clowder cat entry states in `stores/agent.js`, `components/agents/AgentCard.vue`, `pages/agents/index.vue`, and `pages/agents/new.vue`
- [x] T054 [P] [US3] Implement file list, preview fallback, unsupported file, and open/download actions in `stores/file.js`, `components/files/FileList.vue`, and `pages/files/index.vue`
- [x] T055 [P] [US3] Implement profile, theme, notifications, permissions, devices, and session-removal UI in `stores/settings.js`, `components/settings/SettingsSection.vue`, `pages/settings/index.vue`, and `pages/settings/devices.vue`
- [x] T056 [US3] Implement Clowder thread/focus/agents/status panel states and mobile overlay behavior in `components/chat/ClowderPanel.vue` and `components/chat/RightWorkspace.vue`
- [x] T057 [US3] Run US3 visual browser QA at required viewports plus Android validation for panel/navigation changes, include the 5-second recognition check, and record findings in `issues/001-im-web-ui-optimization-qa.md`
- [x] T058 [US3] Resolve US3 collaboration/resource QA findings recorded in `issues/001-im-web-ui-optimization-qa.md` and re-test affected routes
- [x] T059 [US3] Record US3 verification notes in `issues/001-im-web-ui-optimization-qa.md` and commit US3 changes with a Chinese git message

---

## Phase 6: User Story 4 - Handoff-Ready Directory And File Planning (Priority: P2)

**Goal**: Developers can understand page, component, store, style, utility, QA, and legacy manifest ownership without reverse-engineering the old React or im_web sources.

**Independent Test**: Cross-check every planned route, component, Pinia store, style file, utility, QA issue log, and legacy manifest module against the implementation files and contracts.

### Implementation for User Story 4

- [x] T060 [US4] Cross-check implemented route files against `specs/001-im-web-ui-optimization/contracts/routes-contract.md` and update route ownership notes in that file
- [x] T061 [P] [US4] Cross-check UI state ownership against `specs/001-im-web-ui-optimization/contracts/ui-state-contract.md` and update missing page/component/store references in that file
- [x] T062 [P] [US4] Cross-check every manifest module from `specs/001-im-web-ui-optimization/references/manifest.pdf` against `specs/001-im-web-ui-optimization/contracts/legacy-manifest-coverage.md` and update included/merged/deferred/removed mapping details, keeping deferred modules contract-only until implementation starts
- [x] T063 [US4] Verify folder and file ownership against `specs/001-im-web-ui-optimization/plan.md` and `specs/001-im-web-ui-optimization/spec.md`, then document justified exceptions in those files
- [x] T064 [US4] Run US4 handoff and visual coverage QA, including manifest coverage review and 5-second recognition review, and record findings in `issues/001-im-web-ui-optimization-qa.md`
- [x] T065 [US4] Resolve US4 handoff/coverage QA findings recorded in `issues/001-im-web-ui-optimization-qa.md`, re-test contract coverage, and commit US4 changes with a Chinese git message

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and refinements that affect multiple user stories.

- [x] T066 Run full `specs/001-im-web-ui-optimization/quickstart.md` validation with `npm install`, `npm run dev:h5`, and automated H5 smoke/screenshot checks, then record final H5 smoke results in `issues/001-im-web-ui-optimization-qa.md`
- [x] T067 Run final visual browser QA at 375x844, 768x1024, 1024x768, and 1440x900 plus Android validation and 5-second recognition checks when affected, then record results in `issues/001-im-web-ui-optimization-qa.md`
- [x] T068 Verify touch targets, focus states, contrast, reduced motion, hotlinked image fallbacks, and Chinese text encoding across `styles/tokens.scss`, `styles/themes.scss`, `components/common/AppIcon.vue`, and `App.vue`
- [x] T069 Close or explicitly defer remaining QA records with rationale in `issues/001-im-web-ui-optimization-qa.md` and update final coverage notes in `specs/001-im-web-ui-optimization/contracts/legacy-manifest-coverage.md`
- [x] T070 Commit final polish and QA closure for `issues/001-im-web-ui-optimization-qa.md` and `specs/001-im-web-ui-optimization/contracts/legacy-manifest-coverage.md` with a Chinese git message after confirming `git status --short` only contains intended files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational completion; delivers MVP shell and navigation.
- **US2 (Phase 4)**: Depends on Foundational completion and uses US1 shell routes for integrated validation.
- **US3 (Phase 5)**: Depends on Foundational completion and integrates with US1 navigation plus US2 right workspace.
- **US4 (Phase 6)**: Depends on completed route/component/store decisions from US1-US3.
- **Polish (Phase 7)**: Depends on all selected user stories and current-stage issue closure.

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational; no dependency on other user stories.
- **US2 (P1)**: Can start after Foundational; integrated demo is clearer after US1 shell exists.
- **US3 (P2)**: Can start after Foundational; right workspace integration benefits from US2 chat surfaces.
- **US4 (P2)**: Should run after US1-US3 because it verifies implemented ownership and manifest mapping.

### Within Each User Story

- Stores and utilities before components that consume them.
- Reusable components before page-level integration.
- `pages.json` route/config updates before route reachability QA.
- Visual QA before issue resolution and re-test.
- Issue closure and Chinese git commit before moving to the next phase.

---

## Parallel Opportunities

- **Setup**: T005 and T006 can run in parallel after T001-T004 are understood.
- **Foundational**: T012-T019 and T021 can run in parallel because they touch independent composable, component, store, and utility files.
- **US1**: T026, T027, and T029 can run in parallel once shared foundation is available.
- **US2**: T038-T041 can run in parallel after T036-T037 define fixture shape and state expectations.
- **US3**: T049-T055 can run in parallel because contacts, agents, files, and settings use different files.
- **US4**: T061 and T062 can run in parallel after T060 confirms route ownership.

---

## Parallel Example: User Story 2

```text
Task: T038 Implement formatting utilities in utils/formatConversation.js and utils/formatMessage.js
Task: T039 Implement conversation list components in components/chat/ConversationList.vue and components/chat/ConversationItem.vue
Task: T040 Implement message display components in components/chat/MessageList.vue and components/chat/MessageBubble.vue
Task: T041 Implement message context/input components in components/chat/MessageContextMenu.vue and components/chat/MessageInput.vue
```

## Parallel Example: User Story 3

```text
Task: T049 Implement contacts state in stores/contact.js
Task: T053 Implement agents state/cards/pages in stores/agent.js, components/agents/AgentCard.vue, pages/agents/index.vue, and pages/agents/new.vue
Task: T054 Implement file state/list/page in stores/file.js, components/files/FileList.vue, and pages/files/index.vue
Task: T055 Implement settings state/sections/pages in stores/settings.js, components/settings/SettingsSection.vue, pages/settings/index.vue, and pages/settings/devices.vue
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1 setup so H5 can run.
2. Complete Phase 2 foundation so all stories share the same tokens, stores, icons, shell, and QA log.
3. Complete Phase 3 US1 and validate only the cross-platform IM shell.
4. Stop for visual QA, issue closure, Android-safe navigation review, and a Chinese checkpoint commit.

### Incremental Delivery

1. Setup + Foundational -> visual QA -> issue closure -> Chinese commit.
2. US1 shell/navigation/login -> visual QA -> issue closure -> Chinese commit.
3. US2 chat/conversation/message/input -> visual QA -> issue closure -> Chinese commit.
4. US3 collaboration/resources/settings/workspace -> visual QA -> issue closure -> Chinese commit.
5. US4 ownership/manifest coverage -> handoff QA -> issue closure -> Chinese commit.
6. Polish -> final quickstart, viewport, Android, accessibility, issue closure, and Chinese commit.

### Format Validation Summary

- Total tasks: 70
- Setup tasks: 8
- Foundational tasks: 16
- US1 tasks: 11
- US2 tasks: 13
- US3 tasks: 11
- US4 tasks: 6
- Polish tasks: 5
- All task IDs are sequential from T001 to T070.
- All user story phase tasks include `[US1]`, `[US2]`, `[US3]`, or `[US4]`.
- Setup, Foundational, and Polish tasks intentionally omit story labels.
