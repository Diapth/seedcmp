# V3-25: Clowder Cat Onboarding Methods, Context Menus, And Group Auto Reply Policy

## Status

Implemented in `fix/v3-25-clowder-context-auto-reply`.

Automated verification, repeated browser smoke, two-account smoke, and live soft auto-reply smoke passed in the V3-25 worktree. Keep this issue in review only for final branch hygiene and optional extra responsive screenshots.

## Created

2026-06-01

## Labels

feature, clowder, cats, context-menu, group-chat, auto-reply, ux

## Priority

P1

## User Report

The V3 Clowder integration is usable enough for direct and group cat routing, but three product surfaces still feel incomplete:

1. The Clowder "新增猫猫" flow stops after choosing a runtime platform. In reality, after creating or adding a cat, the user must be able to choose whether the cat is added through an API-key style account or through an OAuth/subscription account.
2. Right-click behavior needs to be completed across the chat product:
   - right-click a conversation to pin, mute, delete, or hide it;
   - right-click another group member's avatar to mention that user or view their profile;
   - right-click a message to quote reply, delete, or copy it.
3. Cat group chats need automatic cat replies based on group context. A cat should reply when a human message clearly talks to or about cats even without an explicit `@`, such as a message containing `猫猫`. A cat should not interrupt ordinary human-to-human chat when the latest relevant user message does not mention cats or otherwise continue a cat conversation.

## Current State

- `ClowderCatConsolePage.vue` currently asks for name, alias, runtime platform, personality, and capability tags, then calls `clowderStore.createCatAndConnect()`.
- `ClowderCreateCatRequest` currently requires `clientId: 'openai' | 'anthropic'` but has no account/auth method, account reference, OAuth status, or API credential flow.
- TangSeng `createCatAndConnect()` builds `/cats new <name> <alias> --platform codex|claude-code`. It does not distinguish API-key accounts from OAuth/subscription accounts.
- Clowder already has account concepts in `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/routes/accounts.ts`, including `authType: 'oauth' | 'api_key'`, so the IM Web bridge should reuse that model instead of inventing browser-owned credentials.
- Conversation right-click already contains pin, mute, and delete, but it lacks a hide state and needs clearer synced semantics.
- Message right-click already contains several advanced actions, including copy, reply, local delete, and mutual delete. The user-facing minimal contract still needs to be made consistent around "引用回复 / 删除 / 复制" and covered by tests.
- Group member avatar right-click is not implemented as a first-class interaction in the message list.
- Group cat prompt metadata already has `proactiveReplies`, but the IM Web send path currently routes Clowder only for direct Clowder conversations, direct cat conversations, explicit cat mentions, and command targets.

## Scope Decision

Recommended delivery is one umbrella issue with three independently testable slices:

1. Cat onboarding method selection.
2. Context menu completion.
3. Group auto-reply trigger policy.

Alternative A is to split the work into three separate issues. That would reduce PR size, but it hides that all three items are part of the same product gap: cats and chat actions do not yet behave like native IM features.

Alternative B is to implement only auto-reply first. That would improve the most visible Clowder behavior, but users would still get stuck when adding cats and would still lack expected right-click actions.

Use the recommended umbrella issue, but allow implementation to land in separate PRs or commits per slice.

## Requirements

### 1. Cat Onboarding Method Selection

- The "新增猫猫" UI must make the flow explicit:
  - choose runtime platform, such as Codex/OpenAI or Claude Code/Anthropic;
  - choose auth/add method: API-key account or OAuth/subscription account;
  - enter or select the method-specific account details;
  - create/connect the cat only after the backend confirms a stable routable `catId`.
- Browser code must not persist raw API keys or OAuth refresh tokens.
- API-key setup must send secrets only to a backend endpoint that stores credentials through the Clowder account/credential layer.
- OAuth setup must use a backend-mediated flow or an existing built-in OAuth account reference. If OAuth is not configured, the UI must show a clear unavailable state rather than silently falling back to API mode.
- The IM Web request contract should grow from only `clientId` to include auth intent, for example:
  - `authType: 'api_key' | 'oauth'`;
  - `accountRef` when choosing an existing account;
  - optional `model` only when required by the selected API-key account;
  - no raw credential fields in long-lived store state.
- TangSeng and Clowder command/API layers must preserve the selected method. A created Codex API-key cat and a created Codex OAuth cat must not collapse into the same ambiguous runtime template.
- Error states must be user-visible:
  - platform missing;
  - auth method missing;
  - API key validation failed;
  - OAuth unavailable or cancelled;
  - Clowder account/cat creation failed;
  - created cat not routable after creation.

### 2. Conversation Context Menu

- Right-clicking a conversation row must expose:
  - `置顶` / `取消置顶`;
  - `消息免打扰` / `关闭免打扰`;
  - `隐藏会话`;
  - `删除会话`.
- Pin and mute must continue to sync through the existing conversation/group setting path.
- Delete must preserve the existing local/remote conversation deletion behavior and require confirmation if the action removes the active row.
- Hide must be distinct from delete:
  - it removes the conversation from the sidebar without deleting messages;
  - reopening from search, contacts, group entry, direct cat entry, or a new incoming message must reveal it again;
  - the hidden state should sync through conversation extra if the backend supports it, with a documented local fallback if not.
- Menu labels must be state-aware and should not show ambiguous combined labels such as `置顶 / 取消置顶` once the current state is known.
- The menu must clamp to the viewport, close on outside click, close after action, and remain usable on narrow screens.

### 3. Group Member Avatar Context Menu

- Right-clicking another human member's avatar in a group message must expose:
  - `@TA`;
  - `查看资料`.
- `@TA` must insert the correct mention token at the current draft caret when possible, or append it to the draft with a trailing space when no caret is available.
- `@TA` must store the correct mention UID for send payload construction, normalizing both `uid` and `member_uid`.
- `查看资料` must open the same user profile drawer used by other profile entry points.
- The menu must not show invalid actions for system messages, deleted messages, unavailable users, or the current user's own avatar unless there is a defined product behavior.
- If the avatar belongs to a Clowder cat, the first slice may either:
  - support `@猫猫` plus cat profile details; or
  - show only the existing cat identity with no human profile action.
  The chosen behavior must be explicit in tests.

### 4. Message Context Menu

- Right-clicking a message must expose the core user-facing actions:
  - `引用回复`;
  - `复制`;
  - `删除`.
- `引用回复` must set `messageStore.replyTarget`, focus the input, render the quote preview, and send reply metadata with the next message.
- `复制` must work for text, markdown, visible thinking/transcript text, code content, and useful file/image metadata where text content is not present.
- `删除` must make the local-vs-mutual distinction clear:
  - local delete removes the row only for the current user;
  - mutual delete is available only for messages where the current user or group permissions allow it;
  - destructive actions require confirmation when they affect durable remote state.
- Existing advanced actions such as edit, revoke, pin, receipt, reactions, and reminders may remain, but the menu must not bury the requested core actions behind inconsistent labels.
- Deleted, revoked, failed, pending, Clowder streaming placeholder, and unsupported-message rows must have predictable enabled/disabled actions.

### 5. Group Cat Auto Reply Trigger Policy

- Group cat auto replies must be governed by a deterministic policy, not by raw substring routing alone.
- Explicit `@cat` behavior remains the highest-priority trigger and must keep existing routing semantics.
- Soft auto-reply triggers should route when the current human message clearly addresses cats without an explicit `@`, including:
  - contains a group cat display name;
  - contains a group cat alias or mention pattern without `@`;
  - contains a generic cat trigger such as `猫猫`, when the group has exactly one available cat or a focused/last-active cat is known;
  - quotes or replies to a recent cat message.
- Soft auto-reply must not route when the human message is ordinary human-to-human chat and the latest relevant context does not mention cats.
- If multiple cats are eligible and there is no focused, mentioned, or last-active cat, the first implementation must avoid guessing. It may show no auto reply, or surface a clear non-blocking hint that the user should mention a specific cat.
- Auto reply must be gated by group permission and group-level Clowder state:
  - group allowed;
  - Clowder available;
  - cat available;
  - proactive/soft reply mode enabled for the group.
- Add a group-level setting or Clowder panel control for the auto-reply mode. A practical minimum is:
  - `仅 @ 时回复`;
  - `提到猫猫时自动回复`;
  - `关闭`.
- Auto replies must include a trigger reason in the Clowder inbound payload or prompt context, such as `explicit_mention`, `soft_cat_keyword`, `soft_cat_name`, or `reply_to_cat`.
- Auto replies must use the same group context policy as explicit cat mentions:
  - sender identity;
  - group display name and id;
  - human members;
  - cat members;
  - recent group transcript with sender attribution;
  - current message and selected target cat ids.
- Prevent loops and duplicates:
  - never auto-route Clowder connector messages, system messages, revoked/deleted rows, or cat-authored rows;
  - max one auto Clowder invocation per source user message;
  - use a stable dedup key based on source `clientMsgNo` / `messageID` and trigger type;
  - rate limit repeated soft triggers in the same group if needed.

## Acceptance Criteria

- Creating a cat from IM Web requires both a runtime platform and an auth/add method. API-key and OAuth/subscription paths produce distinct backend requests and visible success/failure states.
- API credentials and OAuth tokens are never stored in browser Pinia state, localStorage, or message payloads.
- A cat created through API-key mode and a cat created through OAuth mode can both become routable contacts and can be opened as direct conversations.
- Conversation right-click supports pin, mute, hide, and delete with state-aware labels and synced/local fallback behavior.
- Hidden conversations disappear from the sidebar without losing message history and reappear when reopened or when a new message arrives.
- Right-clicking another group member avatar can insert `@TA` into the draft and open that member's profile.
- Message right-click supports quote reply, delete, and copy for the relevant message types, while preserving existing advanced actions.
- In a group with one available cat and soft auto-reply enabled, sending a message containing `猫猫` without `@` routes one cat reply into the same group.
- In a group with human-only back-and-forth and no current cat keyword/name/reply target, cats do not auto-reply.
- In a multi-cat group with no focus and only an ambiguous generic `猫猫` trigger, the system does not choose the wrong cat silently.
- Explicit `@cat` still works and is not regressed by the soft auto-reply policy.
- Auto-reply outputs still merge streaming placeholder/chunk/final messages into one durable group row and do not duplicate after refresh.

## Suspected Areas

```text
sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue
sections/im_web/packages/datasource-vue/src/api/clowder.ts
sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
sections/im_web/packages/datasource-vue/src/stores/clowderCatContacts.ts
sections/im_web/apps/chat/src/views/ConversationList.vue
sections/im_web/apps/chat/src/components/MessageList.vue
sections/im_web/apps/chat/src/components/MessageInput.vue
sections/im_web/apps/chat/src/views/ChatView.vue
sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts
sections/im_web/packages/datasource-vue/src/stores/messageStore.ts
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/im/TangSengDaoDaoServer/modules/message/api_conversation.go
/media/leng/DiskB1/exp/clowder-ai/packages/api/src/routes/accounts.ts
/media/leng/DiskB1/exp/clowder-ai/packages/api/src/routes/cats.ts
/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts
/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/ImWebCatCreator.ts
```

## Suggested Delivery Order

1. Add contract tests for cat creation auth method selection before changing UI.
2. Extend IM Web and TangSeng Clowder create-cat contracts to carry `authType` and account reference safely.
3. Update `ClowderCatConsolePage.vue` with platform plus auth method selection and clear unavailable states.
4. Normalize context menu actions and labels for conversations and messages.
5. Add group avatar context menu and draft mention insertion.
6. Implement a pure trigger resolver for group cat auto reply and test the resolver before wiring it to send.
7. Wire the resolver into `MessageInput.vue` / Clowder routing and persist group auto-reply mode in `clowder/group/cats/sync`.
8. Run unit, contract, and browser smoke for onboarding, context menus, explicit mentions, soft auto reply, and no-reply human chat.

## Regression Coverage Required

- `clowderCatConsole.test.ts`
  - platform and auth method are both required;
  - API-key and OAuth modes submit distinct safe payloads;
  - OAuth unavailable state is visible.
- `clowderMixedGroupPrompt.test.ts` or a new group auto-reply test
  - `proactiveReplies` / auto-reply mode persists with group cat sync;
  - prompt context includes trigger reason and selected cat ids.
- `clowderAiContactRouting.test.ts`
  - generic `猫猫` routes only when policy allows;
  - ordinary human chat does not route;
  - ambiguous multi-cat keyword does not silently choose the wrong cat.
- `messageActions.test.ts`
  - message menu exposes quote reply, copy, local delete, and mutual delete states.
- New conversation menu coverage
  - pin, mute, hide, delete labels and action side effects.
- New group avatar menu coverage
  - right-click another member avatar inserts the correct mention and opens profile.
- TangSeng Clowder tests
  - create-cat request preserves `authType` and account reference;
  - missing auth method fails with a clear error;
  - group cat sync persists auto-reply mode.
- Clowder API tests
  - API-key and OAuth account bindings validate through existing account/cat creation rules.

## Required Verification

```bash
cd sections/im_web
pnpm type-check
pnpm build
```

## Root Cause

- Cat onboarding only forwarded the selected runtime platform. The IM Web, TangSeng, and Clowder command bridge contracts did not preserve the user's intended account/auth method, so API-key and OAuth-backed cats collapsed into the same ambiguous `/cats new ... --platform ...` command.
- Conversation actions had pin/mute/delete plumbing but no distinct hide state, no state-specific labels, and no local fallback when the backend does not yet persist hidden conversation extras.
- Message right-click actions existed, but the user-facing labels did not match the requested core contract and group member avatars had no dedicated context menu path.
- Group cat routing was still bound to explicit mentions/direct routing. There was no deterministic policy for soft triggers such as `猫猫`, reply-to-cat context, or ambiguous multi-cat cases.

## Fix Record

- Added a pure group cat auto-reply resolver in `apps/chat/src/utils/clowderGroupAutoReplyPolicy.ts`, with the generated same-name `.js` source artifact kept in sync with the existing repo pattern. Tests cover explicit mentions, soft `猫猫` triggers, named cat triggers, reply-to-cat, disabled mode, ordinary human chat, and ambiguous multi-cat groups.
- Wired the resolver into `MessageInput.vue` so eligible group sends include selected cat ids and a `Trigger reason: ...` prompt context line while ordinary human-to-human messages do not route.
- Persisted group auto-reply mode from Clowder group sync in `clowderStore`, defaulting recovered/manual group cats to mentions-only.
- Added group-level auto-reply controls to the Clowder conversation panel: `仅 @ 时回复`, `提到猫猫时自动回复`, and `关闭`, backed by `autoReplyMode` sync through the TangSeng Clowder group-cats API.
- Added safe onboarding auth intent fields: `authType`, `accountRef`, and optional `defaultModel` across IM Web API types, Clowder cat console UI, TangSeng `/cats new` command building, and the Clowder connector command layer.
- Added conversation hide support in `conversationStore`, including local storage fallback, sidebar filtering, reveal-on-new-activity, and best-effort `conversation_extra.hidden` sync.
- Updated conversation row context menus to expose state-aware `置顶`/`取消置顶`, `消息免打扰`/`关闭免打扰`, `隐藏会话`, and `删除会话`.
- Added group member avatar right-click actions in `MessageList.vue`: `@TA` inserts a normalized mention into the draft, and `查看资料` opens the user profile drawer for human group members.
- Normalized message menu labels to the requested core contract: `引用回复`, `复制`, and delete actions while preserving existing advanced actions.
- Hardened `setGroupAutoReplyMode()` optimistic updates so a bridge sync failure rolls back both the selected mode and the generated group prompt instead of leaving stale proactive prompt text in local state.

## Verification

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/clowderGroupAutoReplyPolicy.test.ts tests/clowderAiContactRouting.test.ts tests/conversationActions.test.ts tests/messageActions.test.ts tests/clowderCatConsole.test.ts tests/clowderMixedGroupPrompt.test.ts tests/clowderPanel.test.ts --config vitest.config.ts
# PASS: 7 test files, 53 tests

pnpm exec vitest run tests/clowderGroupAutoReplyPolicy.test.ts tests/clowderAiContactRouting.test.ts tests/conversationActions.test.ts tests/messageActions.test.ts tests/clowderCatConsole.test.ts tests/clowderMixedGroupPrompt.test.ts tests/clowderPanel.test.ts --config vitest.config.ts --sequence.shuffle --sequence.seed 2503
# PASS: 7 test files, 53 tests

pnpm exec vitest run tests/clowderGroupAutoReplyPolicy.test.ts tests/clowderAiContactRouting.test.ts tests/conversationActions.test.ts tests/messageActions.test.ts tests/clowderCatConsole.test.ts tests/clowderMixedGroupPrompt.test.ts tests/clowderPanel.test.ts --config vitest.config.ts --sequence.shuffle --sequence.seed 2504
# PASS: 7 test files, 53 tests

cd /home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke/sections/im/TangSengDaoDaoServer
go test -count=3 ./modules/clowder
# PASS

cd /home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke/sections/im_web
pnpm type-check
# PASS

cd /home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke/sections/im_web
pnpm build
# PASS, with existing Vite CJS API and chunk-size warnings

cd /media/leng/DiskB1/exp/clowder-ai/packages/api
pnpm build
# PASS

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/connector-command-layer-cats-new.test.js
# PASS: 3 tests
```

## Browser And Two-Account Evidence

### Worktree Runtime

- Worktree: `/home/leng/.config/superpowers/worktrees/seedcmp/v3-25-smoke`
- Branch: `fix/v3-25-clowder-context-auto-reply-smoke`
- IM Web URL: `http://localhost:3016`
- Clowder URL/API proxy: `http://localhost:3000`
- TangSeng API: `http://127.0.0.1:8090/v1/`
- Accounts: `18337488675 / 123456`, `13733632709 / 123456`

### Existing V3 Smoke

```bash
cd sections/im_web/apps/chat
RUN_V3_CLOWDER_SMOKE=1 TARGET_URL=http://localhost:3016 CLOWDER_URL=http://localhost:3000 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 TEST_B_USERNAME=13733632709 TEST_B_PASSWORD=123456 TEST_GROUP_CONVERSATION=TestGroup1 TEST_AGENT_A=codex TEST_AGENT_B=ragdoll CLOWDER_TEST_USER=18337488675 CLOWDER_CONNECTOR_SECRET=dev-im-web-secret pnpm exec playwright test tests-e2e/smoke-v3-clowder-panel.spec.ts --config playwright.config.ts --reporter=line
# PASS: 1 test

RUN_V3_CLOWDER_SMOKE=1 TARGET_URL=http://localhost:3016 CLOWDER_URL=http://localhost:3000 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 TEST_B_USERNAME=13733632709 TEST_B_PASSWORD=123456 TEST_GROUP_CONVERSATION=集群 TEST_AGENT_A=codex TEST_AGENT_B=ragdoll CLOWDER_TEST_USER=18337488675 CLOWDER_CONNECTOR_SECRET=dev-im-web-secret pnpm exec playwright test tests-e2e/smoke-v3-clowder-multi-agent.spec.ts --config playwright.config.ts --reporter=line
# PASS: 1 test
```

Latest rerun on 2026-06-01:

- `smoke-v3-clowder-panel.spec.ts`: PASS, 1 test, `http://localhost:3016`.
- `smoke-v3-clowder-multi-agent.spec.ts`: PASS, 1 test, `http://localhost:3016`, group `集群`.

### V3-25 Issue-Specific Smoke

Command:

```bash
TARGET_URL=http://localhost:3016 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 TEST_B_USERNAME=13733632709 TEST_B_PASSWORD=123456 TEST_GROUP_CONVERSATION=TestGroup1 CLOWDER_URL=http://localhost:3000 node /home/leng/.codex/skills/playwright-skill/run.js /tmp/playwright-v3-25-browser-smoke.js
```

Result:

- Pass: 20 checks.
- Fail: 0 checks.
- Skipped: 1 backend-data-dependent soft reply check, because `TestGroup1` is not the Clowder cat group used for live agent routing.
- Console errors: 0.
- Page errors: 0.
- Failed request events: 13 `net::ERR_ABORTED` events during navigation/close for `message/channel/sync`, `conversation/sync`, `users/...`, and `group/my`; no 5xx and no assertion failure.
- Evidence directory: `sections/im_web/.ai/V3.0/tests-e2e/v3-25-browser-20260601055240/`

Covered checks:

- Cat console exposes `添加方式`, `账号引用`, API-key-only `默认模型`, and hides `默认模型` in OAuth mode.
- Conversation right-click exposes `置顶`, `消息免打扰`, `隐藏会话`, `删除会话`.
- Clowder panel exposes `仅 @ 时回复`, `提到猫猫时自动回复`, `关闭`.
- Two-account group flow in `TestGroup1`: A message visible on B, B message visible on A, both persist after A reload.
- Message right-click exposes `引用回复`, `复制`, `本地删除`; `引用回复` opens the quote preview.
- Group avatar right-click exposes `@TA`, `查看资料`; `@TA` inserts a draft mention and `查看资料` opens the profile drawer.

Repeated stability runs on 2026-06-01:

- `sections/im_web/.ai/V3.0/tests-e2e/v3-25-browser-stability-r1-202606011415/`
  - Pass: 20 checks.
  - Fail: 0 checks.
  - Skipped: 1 TestGroup1 backend-data-dependent soft reply check.
  - Console errors: 0.
  - Page errors: 0.
  - Failed request events: 28, all `net::ERR_ABORTED` during navigation/page close; no captured 5xx.
- `sections/im_web/.ai/V3.0/tests-e2e/v3-25-browser-stability-r2-202606011418/`
  - Pass: 20 checks.
  - Fail: 0 checks.
  - Skipped: 1 TestGroup1 backend-data-dependent soft reply check.
  - Console errors: 0.
  - Page errors: 0.
  - Failed request events: 46, all `net::ERR_ABORTED` during navigation/page close; no captured 5xx.

### Soft Auto-Reply Smoke

Command:

```bash
TARGET_URL=http://localhost:3016 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 TEST_GROUP_CONVERSATION=集群 node /home/leng/.codex/skills/playwright-skill/run.js /tmp/playwright-v3-25-soft-trigger.js
```

Result:

- Pass: 5 checks.
- Fail: 0 checks.
- Captured Clowder route requests: 1.
- Console errors: 0.
- Page errors: 0.
- Failed request events: 0.
- Evidence directory: `sections/im_web/.ai/V3.0/tests-e2e/v3-25-soft-20260601055627/`

Covered checks:

- Opened live Clowder group `集群`.
- Auto-reply mode controls were visible and `提到猫猫时自动回复` was clicked.
- Ordinary human chat without `猫猫` did not create a new Clowder reply after 12 seconds.
- Message containing `猫猫` captured `/v1/clowder/conversation/message` once and received a visible Clowder reply.

Repeated live stability runs on 2026-06-01:

- `sections/im_web/.ai/V3.0/tests-e2e/v3-25-soft-stability-r1-202606011417/`
  - Pass: 5 checks.
  - Fail: 0 checks.
  - Captured Clowder route requests: 1.
  - Console errors: 0.
  - Page errors: 0.
  - Failed request events: 0.
- `sections/im_web/.ai/V3.0/tests-e2e/v3-25-soft-stability-r2-202606011419/`
  - Pass: 5 checks.
  - Fail: 0 checks.
  - Captured Clowder route requests: 1.
  - Console errors: 0.
  - Page errors: 0.
  - Failed request events: 0.

### Remaining Manual Evidence

- The issue-specific smoke verifies desktop surfaces. A narrow/mobile screenshot was not added for V3-25 context menus in this run.
- A failed exploratory run attempted the full two-account V3-25 script against `集群`, but account B is not in that group and opened fallback `TestGroup1`; this is test-data mismatch, not counted as product evidence.

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/clowderCatConsole.test.ts tests/clowderAiContactRouting.test.ts tests/clowderMixedGroupPrompt.test.ts tests/messageActions.test.ts --config vitest.config.ts
```

```bash
cd /media/leng/DiskB1/exp/clowder-ai/packages/api
pnpm build
```

Run browser smoke after implementation for:

- create/connect cat through API-key mode;
- create/connect cat through OAuth/subscription mode or configured OAuth fallback;
- conversation right-click pin/mute/hide/delete;
- group avatar right-click mention/profile;
- message right-click quote/copy/delete;
- group soft auto-reply for `猫猫`;
- human-to-human group chat with no cat interruption;
- explicit `@cat` regression.

## Notes

- Do not close this issue based only on UI unit tests. The auto-reply path touches routing, permissions, context construction, streaming merge, and live group history.
- The first implementation should prefer conservative non-interruption over over-eager cat replies. A missed soft reply is easier to correct with `@cat`; an unexpected cat interruption makes group chat feel unreliable.
- If backend support for hidden conversations is not available, document the local fallback and create a backend follow-up before marking the hide behavior fully resolved.
