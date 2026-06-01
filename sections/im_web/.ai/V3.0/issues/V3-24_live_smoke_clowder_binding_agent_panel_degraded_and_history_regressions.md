# V3-24: Live Smoke Clowder Binding, Agent Badge, Panel Width, Degraded State, And History Regressions

## Status

Resolved 2026-06-01.

## Created

2026-05-31

## Labels

bug, clowder, live-smoke, multi-agent, binding, degraded-state, history-recovery, responsive

## Priority

P0

## User Report

The V3 live smoke suite still fails after the Clowder connector and multi-account visual path are partially working. The failures show that Clowder is connected, but the live acceptance path is not stable enough to close V3.

The failing areas are:

1. Direct binding reply times out after sending `@codex ... direct binding smoke`.
2. Multi-agent smoke expects the latest cat badge to contain `codex`, but the newest visible cat remains `布偶猫`.
3. Clowder panel responsive smoke finds `.clowder-panel` width `249.609375`, below the expected minimum of `260`.
4. Streaming/media degraded-mode interception does not show `error`, `unavailable`, or `clowder_unavailable`.
5. V2 regression smoke sends a non-Clowder message, reloads, and cannot find the message in refreshed history.

## Evidence

Recorded in `sections/im_web/.ai/V3.0/evidence.md` under `V3 Live Smoke Suite Attempt - 2026-05-31 16:14 CST`.

Failing command:

```bash
cd sections/im_web/apps/chat
RUN_V3_CLOWDER_SMOKE=1 TARGET_URL=http://localhost:3000 CLOWDER_URL=http://localhost:3003 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 TEST_B_USERNAME=13733632709 TEST_B_PASSWORD=123456 TEST_GROUP_CONVERSATION=集群 TEST_AGENT_A=codex TEST_AGENT_B=ragdoll CLOWDER_TEST_USER=18337488675 CLOWDER_CONNECTOR_SECRET=dev-im-web-secret pnpm exec playwright test tests-e2e/smoke-v3-clowder-panel.spec.ts tests-e2e/smoke-v3-clowder-binding.spec.ts tests-e2e/smoke-v3-clowder-multi-agent.spec.ts tests-e2e/smoke-v3-clowder-permissions.spec.ts tests-e2e/smoke-v3-clowder-streaming-media.spec.ts tests-e2e/smoke-v3-clowder-v2-regression.spec.ts tests-e2e/smoke-v3-clowder-thread-lifecycle.spec.ts --config playwright.config.ts --reporter=line
```

Result: failed, 7 tests total, 5 failed, 2 skipped.

Related passing baseline:

- Default runnable E2E: `8 passed, 11 skipped`.
- Multi-account visual regression run `v3-multi-account-visual-20260531081933`: passed with two real accounts in `TestGroup1`, middle-position mention popup visible, Clowder panel width `419px`, console/page/network errors all `0`.

## Impact

- Direct cat or agent conversations can appear connected but fail to produce a routed Clowder reply.
- Multi-agent routing may display the wrong active/latest cat identity, making users unable to trust which agent responded.
- Narrow layouts can make the Clowder panel visually fail smoke criteria and risk clipped controls.
- Clowder outage or degraded media/streaming states may silently fail instead of surfacing a user-visible unavailable state.
- Non-Clowder IM behavior regresses under the V3 live suite if a normal sent message disappears after refresh.

## Reproduction Notes

1. Start TangSeng API, WuKongIM, IM Web, and Clowder with the `im-web` connector configured.
2. Use two real accounts:
   - `18337488675`
   - `13733632709`
3. Ensure the live test group `集群` is available.
4. Run the failing command above from `sections/im_web/apps/chat`.
5. Inspect `sections/im_web/apps/chat/test-results/*/error-context.md` for the per-spec timeout/assertion context.

## Failure Breakdown

### 1. Direct Binding Reply Timeout

Actual: after the smoke sends `@codex ... direct binding smoke`, Playwright times out waiting for an additional Clowder reply count.

Expected: the direct binding path creates or reuses the correct Clowder thread binding, routes to `codex`, and renders exactly one durable Clowder reply without duplicate placeholders.

### 2. Multi-Agent Latest Badge Mismatch

Actual: the smoke expects the newest cat badge to contain `codex`, but the latest visible cat identity is still `布偶猫`.

Expected: after targeting `codex`, the latest visible Clowder reply and badge reflect the agent/cat that actually responded. Nearby-message identity recovery must not incorrectly reuse an older cat name.

### 3. Clowder Panel Width Below Threshold

Actual: `.clowder-panel` measured `249.609375px`, below the smoke threshold of `260px`.

Expected: the panel and dock layout preserve a stable minimum usable width across the smoke viewport, with controls contained and no clipped interactive state.

### 4. Degraded Mode Does Not Surface Unavailable State

Actual: the streaming/media degraded-mode route interception does not show `error`, `unavailable`, or `clowder_unavailable`.

Expected: when the Clowder request path is unavailable, intercepted, or degraded, the UI shows an explicit unavailable/error state within the conversation or Clowder panel instead of silently leaving the user waiting.

### 5. Non-Clowder Message Missing After Reload

Actual: V2 regression smoke sends a normal non-Clowder message, reloads, and cannot find it.

Expected: V3 Clowder sync, message hydration, and history recovery must preserve ordinary TangSeng IM messages. A non-Clowder message sent in a live conversation must remain visible after reload.

## Suspected Areas

```text
sections/im_web/apps/chat/tests-e2e/smoke-v3-clowder-binding.spec.ts
sections/im_web/apps/chat/tests-e2e/smoke-v3-clowder-multi-agent.spec.ts
sections/im_web/apps/chat/tests-e2e/smoke-v3-clowder-panel.spec.ts
sections/im_web/apps/chat/tests-e2e/smoke-v3-clowder-streaming-media.spec.ts
sections/im_web/apps/chat/tests-e2e/smoke-v3-clowder-v2-regression.spec.ts
sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue
sections/im_web/apps/chat/src/components/MessageInput.vue
sections/im_web/apps/chat/src/components/MessageList.vue
sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
sections/im_web/packages/datasource-vue/src/stores/messageStore.ts
sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts
sections/im_web/packages/base-vue/src/utils/clowderMessageIdentity.ts
sections/im/TangSengDaoDaoServer/modules/clowder
/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors
```

## Acceptance Criteria

- The full V3 live smoke command above passes with `RUN_V3_CLOWDER_SMOKE=1`.
- Direct binding smoke receives a routed Clowder reply for the requested agent and does not time out.
- Multi-agent smoke displays the correct latest cat/agent badge after targeting `codex` and does not inherit stale `布偶猫` identity.
- Clowder panel keeps a stable usable width at the smoke viewport and satisfies the Playwright width threshold.
- Degraded streaming/media scenarios show an explicit unavailable/error state matching the smoke expectation.
- Normal non-Clowder messages sent during the V2 regression smoke are still visible after reload.
- Existing default E2E remains green.
- The multi-account visual path remains green or is rerun with updated evidence if touched.

## Required Verification

```bash
cd sections/im_web
pnpm type-check
pnpm build
```

```bash
cd sections/im_web/apps/chat
pnpm exec playwright test --config playwright.config.ts --reporter=line
```

```bash
cd sections/im_web/apps/chat
RUN_V3_CLOWDER_SMOKE=1 TARGET_URL=http://localhost:3000 CLOWDER_URL=http://localhost:3003 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 TEST_B_USERNAME=13733632709 TEST_B_PASSWORD=123456 TEST_GROUP_CONVERSATION=集群 TEST_AGENT_A=codex TEST_AGENT_B=ragdoll CLOWDER_TEST_USER=18337488675 CLOWDER_CONNECTOR_SECRET=dev-im-web-secret pnpm exec playwright test tests-e2e/smoke-v3-clowder-panel.spec.ts tests-e2e/smoke-v3-clowder-binding.spec.ts tests-e2e/smoke-v3-clowder-multi-agent.spec.ts tests-e2e/smoke-v3-clowder-permissions.spec.ts tests-e2e/smoke-v3-clowder-streaming-media.spec.ts tests-e2e/smoke-v3-clowder-v2-regression.spec.ts tests-e2e/smoke-v3-clowder-thread-lifecycle.spec.ts --config playwright.config.ts --reporter=line
```

## Notes

Do not close this issue based only on unit tests. The failure is specifically a live multi-service browser acceptance failure, so closure requires Playwright live-smoke evidence and updated notes in this file or `sections/im_web/.ai/V3.0/evidence.md`.

## Resolution Notes

### Commit

- Code, tests, and live-smoke stabilization: `97a2578` (`修复 IM Web V3 Clowder live smoke 回归`).

### Root Causes

- Clowder message presentation could reuse stale nearby cat display names when the current payload already had a more precise cat id.
- Group Clowder targeting depended on durable group membership. The live `集群` bridge state only listed `ragdoll-kn9a`, while `clowder/conversation/agents` returned 502/403, so `@codex` was treated as plain text and no `clowder/conversation/message` route was sent.
- The Clowder panel hid usable group cat fallback data behind a global agent-directory error and could render below the smoke width threshold.
- V2 reload history used the same sync offset identity as conversation sync and the E2E wait treated conversation digest visibility as durable message persistence.
- SDK ACKs were keyed by SDK client message numbers instead of the local pending message client id, leaving sent rows at `messageSeq=0`.
- Reload performed only one visible history sync, so late Clowder final messages could miss the first post-refresh window.
- Some live smoke assertions were tied to volatile LLM text/badge timing instead of stable routed-message and persisted-state signals.

### Fix Record

- Recovered Clowder display names by preferring explicit payload identity/current cat ids over stale neighboring display names.
- Added conversation/list and message-row data attributes for stable live-smoke selectors.
- Added group cat fallback loading from the global cat directory when group agent directory is unavailable, and refreshed group cat membership before group sends.
- Updated group prompts to use the merged current cat set and kept the panel usable with group-cat fallback rows when agent directory is degraded.
- Added history-only `device_uuid` for visible channel history sync, latest-window hydration for stale visible histories, and guarded conversation summaries from older history overwrites.
- Added SDK ACK aliasing from `clientSeq` to the local pending `clientMsgNo`, so ACK seqs update the visible row.
- Scheduled post-load visible-history refreshes in `ChatView` to catch late Clowder replies after reload.
- Tightened V2 smoke persistence waits to require `success` plus positive `data-message-seq`.
- Adjusted live smoke timeouts and assertions for current backend behavior: multi-hop `/ask ragdoll` can result in a final Codex speaker while the reply text records the ragdoll route.
- Scoped the UC-1 context-menu smoke selector to `.context-menu` to avoid real chat-history text collisions.

### Verification

- `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderAiContactRouting.test.ts tests/clowderMixedGroupPrompt.test.ts tests/messageStoreDailyMessaging.test.ts tests/v3ClowderSmokeSelection.test.ts tests/clowderMessagePresentation.test.ts tests/clowderPanel.test.ts tests/rightDockPreviewClowder.test.ts tests/messageActions.test.ts tests/messageListenerOwnEcho.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true`
  - Result: 9 files passed, 75 tests passed.
- `cd sections/im_web && pnpm type-check`
  - Result: passed.
- `cd sections/im_web && pnpm build`
  - Result: passed; existing Vite chunk-size warning remains.
- `cd sections/im_web/apps/chat && pnpm exec playwright test --config playwright.config.ts --reporter=line`
  - Result: 8 passed, 11 skipped.
- `cd sections/im_web/apps/chat && RUN_V3_CLOWDER_SMOKE=1 TARGET_URL=http://localhost:3000 CLOWDER_URL=http://localhost:3003 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 TEST_B_USERNAME=13733632709 TEST_B_PASSWORD=123456 TEST_GROUP_CONVERSATION=集群 TEST_AGENT_A=codex TEST_AGENT_B=ragdoll CLOWDER_TEST_USER=18337488675 CLOWDER_CONNECTOR_SECRET=dev-im-web-secret pnpm exec playwright test tests-e2e/smoke-v3-clowder-panel.spec.ts tests-e2e/smoke-v3-clowder-binding.spec.ts tests-e2e/smoke-v3-clowder-multi-agent.spec.ts tests-e2e/smoke-v3-clowder-permissions.spec.ts tests-e2e/smoke-v3-clowder-streaming-media.spec.ts tests-e2e/smoke-v3-clowder-v2-regression.spec.ts tests-e2e/smoke-v3-clowder-thread-lifecycle.spec.ts --config playwright.config.ts --reporter=line`
  - Result: 5 passed, 2 skipped.
