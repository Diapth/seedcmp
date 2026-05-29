# Browser Integration Test Plan: IM Web V3.0 + Clowder

## Purpose

Design the browser automation and full-stack integration flow before running it.

The live Clowder production-mode PWA is available at:

```text
http://localhost:3003
```

This plan covers Clowder PWA checks, Clowder connector API checks, IM Web browser checks, and end-to-end IM Web to Clowder bridge behavior. It does not reset Redis or delete persisted Clowder data.

## Scope

In scope:

- Verify Clowder PWA loads in production/PWA mode and exposes the expected application shell.
- Verify `im-web` connector status, agent directory, command routing, permission responses, streaming behavior, and rich-block/media fallback through API and UI evidence.
- Verify IM Web can show Clowder status/control state and merge Clowder replies into chat history.
- Verify multi-user, multi-agent flows from one IM conversation, including mentions and `/ask`.
- Capture screenshots, console errors, request failures, and API response summaries as evidence.

Out of scope for this run:

- Redis cleanup or destructive fixture reset.
- Load testing or 99th percentile performance measurement.
- Production secret discovery in browser code beyond observable network and bundle checks.
- Full manual validation of every existing V2.0 IM Web workflow unrelated to V3 Clowder.

## Required Inputs Before Execution

The runner should confirm or discover these values before executing assertion-heavy tests:

| Item | Default/Source | Required For |
|------|----------------|--------------|
| Clowder PWA URL | `http://localhost:3003` | All Clowder browser tests |
| IM Web URL | `TARGET_URL` or `http://localhost:3000` | IM Web browser tests |
| TangSeng API URL | Existing IM Web config, often `/v1/` or `http://100.79.157.76:8090/v1/` | Bridge status and message delivery checks |
| Test owner user | Existing Clowder session or `x-cat-cafe-user` API header | Agent directory and thread checks |
| Direct chat target | Existing IM Web contact or seeded conversation | SC-001 direct binding |
| Group chat target | Existing IM Web group with at least two users | SC-001, SC-003, SC-004 |
| Agent aliases | At least two Clowder agents, for example `@codex` and another configured alias | SC-003 multi-agent routing |
| Bridge enabled | `IM_WEB_CLOWDER_ENABLED=true` in TangSeng bridge | All E2E bridge tests |
| Shared secret configured | Same secret in TangSeng and Clowder | Signed inbound/outbound checks |

If a value is missing, the first browser run should switch to discovery mode and report what is unavailable instead of mutating persistent data.

## Test Data Strategy

Because Clowder uses persistent Docker Redis in production mode, test data must be namespaced and non-destructive.

- Use a unique run ID in all created threads and messages: `v3-smoke-YYYYMMDD-HHMMSS`.
- Prefer creating new Clowder threads over editing existing user threads.
- Do not delete Redis keys, threads, cats, or connector bindings during automated tests.
- For repeatability, capture the thread ID, external chat ID, message IDs, and screenshots in the evidence log.
- If a persistent binding already exists for the target IM conversation, tests should record and reuse it rather than creating a conflicting binding.

## Execution Phases

### Phase A - Service and Browser Preflight

Goal: confirm local services are reachable and collect baseline diagnostics.

Checks:

1. Detect running localhost servers with the Playwright helper.
2. Open `http://localhost:3003`.
3. Record page title, URL after redirects, visible app shell landmarks, service worker status, and PWA manifest availability.
4. Wait for `navigator.serviceWorker.ready` when service workers are available, then record active controller/script URL. If service workers are unavailable, record that PWA cache coverage is skipped.
5. Capture console errors and failed network requests.
6. Call these non-mutating endpoints from Playwright request context:
   - `GET http://localhost:3003/api/connectors/im-web/status`
   - `GET http://localhost:3003/api/commands?surface=connector`
   - `GET http://localhost:3003/api/cats`

Pass criteria:

- Clowder page reaches a stable loaded state.
- Service worker readiness is confirmed or explicitly marked unavailable.
- No fatal console error prevents app startup.
- `im-web` status endpoint returns JSON with `connectorId: "im-web"`.
- Connector command list includes at least `/status`, `/cats`, and `/focus` when command routes are enabled.

### Phase B - Clowder PWA Functional Smoke

Goal: verify the production PWA can navigate core surfaces used by connector testing.

Checks:

1. Inspect initial shell, navigation, thread list, and agent/cat surfaces.
2. Verify at least two cats/agents are visible or retrievable through API.
3. Create or locate a namespaced test thread if the UI supports it without additional credentials.
4. Send a simple message in Clowder UI if a safe test thread is available.
5. Refresh the page and verify state persists.

Pass criteria:

- PWA remains usable after refresh.
- At least two agents are discoverable by UI or `GET /api/cats`.
- No PWA cache/service-worker behavior serves an obviously stale broken shell.

### Phase C - Connector API Contract Smoke Against Live Clowder

Goal: verify live Clowder exposes the V3 `im-web` connector behavior beyond unit tests.

Checks:

1. `GET /api/connectors/im-web/status`
   - Expected fields: `enabled`, `configured`, `reachable`, `version`, `featureFlags`.
2. `GET /api/connectors/im-web/agents?externalChatId=<known-or-test-external-chat-id>`
   - If binding exists: expect agent list and preferred/last-active metadata.
   - If no binding exists: expect a clear empty/not-found response, not a server crash.
3. Signed inbound message probe, only if the test secret is available:
   - Send one namespaced `/status` or `@agent` message through `POST /api/connectors/im-web/inbound`.
   - Repeat the same payload to verify duplicate skip.
4. Permission probes:
   - Denied group returns `403` with `group_not_allowed`.
   - Non-admin command returns `403` with `command_admin_only` or `permission_denied`.

Pass criteria:

- Status endpoint is stable.
- Agent directory response is either populated or gracefully reports missing binding.
- Signed inbound request is accepted when configured.
- Duplicate inbound request does not create a second routed message.
- Permission failures are visible and machine-readable.

### Phase D - IM Web UI Smoke

Goal: verify IM Web V3 UI surfaces are usable before attempting multi-service message flow.

Checks:

1. Open IM Web with `TARGET_URL` or `http://localhost:3000`.
2. Confirm login/session state; if login is required, stop and report required credentials.
3. Open the direct test conversation and group test conversation.
4. Open the Clowder conversation panel.
5. Verify visible states:
   - enabled/disabled/configured/reachable
   - thread binding/title/id
   - agent directory
   - focus/preferred agent
   - last delivery state
   - denied/admin-only disabled reason when applicable
6. Capture desktop and mobile screenshots of the panel.

Pass criteria:

- IM Web loads without fatal browser errors.
- Clowder badge and panel are visible in eligible conversations.
- Disabled or denied states show a reason instead of silent unavailable controls.
- No text overlap or unusable controls in desktop and mobile viewports.

### Phase E - End-to-End Direct and Group Binding

Goal: validate SC-001 with live TangSeng/WuKongIM, IM Web, and Clowder.

Checks:

1. Direct conversation:
   - Send a namespaced message containing a known Clowder agent mention.
   - Wait for one agent reply in IM Web.
   - Refresh IM Web and verify the reply remains present once.
   - Verify Clowder thread/binding evidence through API or UI.
2. Group conversation:
   - Send a namespaced group message from user A.
   - If possible, send a second message from user B or use the existing second-account setup.
   - Verify sender identity is preserved in Clowder-side evidence.
   - Verify exactly one durable reply per routed invocation.

Pass criteria:

- Direct and group flows both receive replies.
- Refresh does not duplicate replies.
- Clowder records connector metadata, sender identity, and external chat ID.

### Phase F - V2 Regression Safety Net

Goal: validate FR-016 for conversations that are not Clowder-enabled.

Checks:

1. Select a normal non-Clowder conversation.
2. Send a namespaced plain text message and verify optimistic display.
3. Refresh and verify the plain message remains in history once.
4. If a V2 robot conversation is available, open the DeepSeek robot conversation, send a namespaced prompt, and verify:
   - `DeepSeek AI` panel or robot state remains visible.
   - A robot/AI reply appears without Clowder metadata.
   - Refresh does not duplicate or remove the robot reply.
5. Verify the normal conversation does not show Clowder-only failure state, denied badge, or panel mutation unless the user opens the Clowder panel explicitly.

Pass criteria:

- Normal IM messaging still works outside Clowder-enabled conversations.
- V2 robot reply path still works where the configured robot is available.
- History sync preserves plain and V2 robot messages after refresh.
- No V2 robot reply is mislabeled with `.clowder-meta`.

### Phase G - Thread Lifecycle Commands

Goal: validate `/new`, `/threads`, `/use`, `/thread`, and `/where` from the bridge contract.

Checks:

1. In the Clowder-enabled test conversation, send `/where`.
   - Expect a connector/system response with the current thread or "not bound" state.
2. Send `/new <run-id> lifecycle`.
   - Expect a connector/system response with a created or selected thread ID/title.
   - Verify the Clowder panel `Thread` section updates from `Not bound` or old ID to the new ID.
3. Send `/threads`.
   - Expect a connector/system response listing available/recent threads.
4. Send `/use <thread-ref>`.
   - Expect a connector/system response confirming the active thread switch.
   - Verify the Clowder panel thread ID changes or remains explicitly confirmed.
5. Send `/thread <thread-id> <run-id> lifecycle message`.
   - Expect the message routes to the requested thread and receives an agent/connector response without changing unrelated conversations.

Pass criteria:

- Every command yields visible connector/system feedback in `.sys-msg-row`, `.system-cell`, or a message row with `fromUID` equivalent to `clowder:command`.
- Thread panel state and Clowder API state agree after `/new` and `/use`.
- Command internals do not appear as normal human chat messages.

### Phase H - Multi-Agent Routing

Goal: validate SC-003 and FR-005/FR-006.

Checks:

1. In one group conversation, send `@agentA <run-id> summarize this`.
2. Send `/ask agentB <run-id> answer from another agent`.
3. Send `/focus agentA`.
4. Send an unmentioned follow-up message.
5. Send two quick consecutive mentions, one for `agentA` and one for `agentB`, without waiting for the first final reply.
6. Verify:
   - first message routes to agent A
   - `/ask` routes to agent B
   - focus persists
   - follow-up uses preferred/last-active Clowder routing, not the V2 `deepseek_ai_robot` fallback
   - concurrent or near-concurrent mention replies remain separate and do not overwrite each other

Pass criteria:

- At least two distinct Clowder agents are invoked from one IM conversation.
- Agent identity is visible in IM Web message presentation.
- Command responses appear as connector/system messages, not normal human messages.
- Streaming or delayed replies from two agents remain associated with their own trigger messages.

### Phase I - Permissions

Goal: validate SC-004 and FR-007/FR-015.

Checks:

1. Allowed group:
   - Confirm normal mention or `/ask` runs.
2. Denied group:
   - Attempt mention or `/ask`.
   - Verify no agent invocation and visible authorization response.
3. Non-admin command:
   - Attempt `/use`, `/new`, `/focus`, `/allow-group`, or `/deny-group` as a non-admin user.
   - Verify binding/focus state does not change.

Pass criteria:

- Unauthorized actions return visible user-facing denial.
- `ClowderStatusBadge` shows one of:
  - `Clowder group not allowed`
  - `Clowder admin only`
  - `Clowder denied`
- `ClowderConversationPanel` shows a disabled reason line, for example `disabled: group_not_allowed`.
- The message list contains a connector/system denial message when the command route returns `userMessage`.
- Clowder binding/thread/focus state remains unchanged after denied commands.

### Phase J - Streaming, Media, Refresh, and History

Goal: validate SC-005, SC-006, SC-007 and FR-010 to FR-016.

Checks:

1. Send a long prompt that should stream.
2. Verify IM Web shows one evolving assistant message.
3. Refresh during or immediately after streaming.
4. Verify one final message remains after history sync.
5. Send or reference supported media if the live environment has fixtures.
6. Send or reference unsupported media and verify visible unavailable fallback.
7. Simulate or observe queue-full/unavailable/timeout if safe.

Pass criteria:

- Streaming placeholder/chunk/final merges into one message.
- Refresh does not duplicate or lose the final reply.
- Media fallback is visible.
- Failure states appear within 5 seconds where applicable.

### Phase K - Network and Degraded Mode

Goal: validate visible behavior for bridge errors and temporary outages.

Checks:

1. Clowder unavailable:
   - Intercept or simulate `GET /clowder/status` or Clowder bridge calls returning `503 clowder_unavailable`.
   - Verify IM Web shows `Clowder error` or a panel error state.
2. Timeout:
   - Intercept a Clowder conversation or send route to exceed the UI timeout or return `504 clowder_timeout`.
   - Verify visible timeout or retryable state within 5 seconds.
3. Queue full:
   - Return or observe `429 agent_queue_full`.
   - Verify panel/message disabled reason maps to `agent_queue_full`.
4. Browser offline during streaming:
   - Start a streaming prompt, call `context.setOffline(true)` during chunks, then restore online.
   - Verify the UI does not create duplicate final messages after refresh.
5. TangSeng restart window, if safe:
   - If a restart is planned by the operator, send a namespaced message during the window and record whether it queues, fails visibly, or recovers.

Pass criteria:

- `503`, `504`, and `429` produce user-visible states instead of silent failures.
- Temporary browser network loss during streaming does not duplicate final messages.
- Any unsafe infrastructure manipulation is skipped and recorded.

### Phase L - Session Expiry and Unauthenticated State

Goal: verify test and UI behavior when authentication is absent or expires.

Checks:

1. Open IM Web without storage state.
   - Expect redirect to `/login` or a visible login form.
2. Expire or clear IM Web storage in a test context after login.
   - Attempt to open a conversation or Clowder panel.
   - Expect login redirect or visible API failure, not a broken blank app.
3. Open Clowder PWA in a fresh context.
   - Record whether it uses trusted local headers, anonymous local mode, or redirects.
4. Call Clowder identity-sensitive APIs without `x-cat-cafe-user`.
   - Expect default local identity or a clear auth response, depending on environment policy.

Pass criteria:

- Expired or missing sessions fail visibly.
- Browser automation stops mutating flows when login state is invalid.
- Identity strategy is recorded in evidence.

## Browser Automation Design

Use two kinds of Playwright scripts.

### Exploratory Scripts

Purpose: learn the live UI shape safely.

Output:

- `/tmp/v3-clowder-preflight.json`
- `/tmp/v3-clowder-console.json`
- `/tmp/v3-clowder-network.json`
- `/tmp/v3-clowder-desktop.png`
- `/tmp/v3-clowder-mobile.png`

Rules:

- Run with visible browser unless a headless run is explicitly requested.
- Do not submit forms or create records unless a selector and test namespace are confirmed.
- Prefer `page.getByRole`, visible text, and accessible names before CSS selectors.

### Assertion Scripts

Purpose: automate repeatable smoke checks after discovery confirms selectors and test data.

The V3 smoke files now implement the assertions below and remain gated by `RUN_V3_CLOWDER_SMOKE=1` so they do not mutate persistent data during normal test runs.

### Shared Playwright Fixtures and Selectors

Use a shared helper module for login, conversation selection, run IDs, screenshots, request summaries, and multi-account contexts.

Recommended helper file:

```text
sections/im_web/apps/chat/tests-e2e/helpers/v3-clowder.ts
```

Environment variables:

| Variable | Purpose |
|----------|---------|
| `RUN_V3_CLOWDER_SMOKE=1` | Enables V3 smoke specs |
| `TARGET_URL` | IM Web URL, default `http://localhost:3000` |
| `CLOWDER_URL` | Clowder PWA/API URL, default `http://localhost:3003` |
| `TEST_USERNAME` / `TEST_PASSWORD` | User A login |
| `TEST_B_USERNAME` / `TEST_B_PASSWORD` | User B login |
| `TEST_DIRECT_CONVERSATION` | Direct chat name or channel ID |
| `TEST_GROUP_CONVERSATION` | Group chat name or channel ID |
| `TEST_V2_CONVERSATION` | Non-Clowder V2 conversation selector/name |
| `TEST_V2_ROBOT_CONVERSATION` | V2 robot conversation selector/name, optional |
| `TEST_AGENT_A` / `TEST_AGENT_B` | Agent aliases or cat IDs |
| `CLOWDER_TEST_USER` | Header value for `x-cat-cafe-user` |
| `CLOWDER_CONNECTOR_SECRET` | Enables signed inbound API probes |

Existing selectors available today:

| Target | Selector |
|--------|----------|
| Login username | `getByPlaceholder(/手机号|账号|username/i)` |
| Login password | `getByPlaceholder(/密码|password/i)` |
| Login button | `getByRole('button', { name: /登录|安全登录|login/i })` |
| Conversation list | `.conversation-list-container` |
| Conversation item | `.conversation-item` |
| Chat shell | `.main-layout`, `.chat-view-container` |
| Message list | `.message-list` |
| Message row | `.msg-row` |
| System row | `.sys-msg-row`, `.system-cell` |
| Message input | `.input-textarea` |
| Message input shell | `.message-input-container` |
| Clowder panel button | `button[title="Clowder"]` |
| Clowder panel | `.clowder-panel` |
| Clowder panel thread value | `.clowder-panel .thread-id` |
| Clowder panel agent rows | `.clowder-panel .agent-row` |
| Clowder panel disabled reason | `.clowder-panel .muted` containing `disabled:` |
| Clowder panel error | `.clowder-panel .error-text` |
| Clowder badge | `.clowder-status-badge` |
| Clowder message metadata | `.clowder-meta`, `.clowder-badge`, `.clowder-cat` |
| Unsupported media state | `.unsupported-media` |
| V2 robot panel | `.ai-contact-panel`, `.robot-panel`, text `DeepSeek AI` |

Recommended stable `data-testid` additions before hardening:

| Target | Proposed `data-testid` |
|--------|------------------------|
| Clowder panel button | `clowder-panel-open` |
| Clowder panel | `clowder-panel` |
| Clowder state label | `clowder-status-state` |
| Thread ID | `clowder-thread-id` |
| Delivery state | `clowder-delivery-state` |
| Focus value | `clowder-focus-value` |
| Agent row | `clowder-agent-row-${catId}` |
| Disabled reason | `clowder-disabled-reason` |
| Clowder badge | `clowder-message-badge` |
| Clowder cat name | `clowder-message-cat` |
| Command/system response | `clowder-command-response` |
| Unsupported media | `clowder-unsupported-media` |

### Multi-Account Playwright Mode

Use separate browser contexts rather than multiple pages in one context.

Pattern:

```ts
const userA = await browser.newContext({ storageState: 'playwright/.auth/user-a.json' });
const userB = await browser.newContext({ storageState: 'playwright/.auth/user-b.json' });
const pageA = await userA.newPage();
const pageB = await userB.newPage();
```

If storage states do not exist, generate them in a setup step:

1. Login as user A and save `playwright/.auth/user-a.json`.
2. Login as user B and save `playwright/.auth/user-b.json`.
3. Open the same group conversation in both contexts.
4. Send from A and B with distinct run IDs.
5. Assert both contexts receive both human messages and the appropriate Clowder replies.

Do not use two pages in the same context for multi-user tests, because cookies/localStorage/session state would be shared.

### API Header Strategy

For Clowder API calls that need identity, set:

```ts
extraHTTPHeaders: {
  'x-cat-cafe-user': process.env.CLOWDER_TEST_USER || 'user-1'
}
```

For browser page requests, prefer the real PWA session. Use request-context headers for API probes only; do not inject privileged headers into normal browser navigation unless the environment explicitly requires trusted local header auth.

### Spec-Level Assertion Matrix

#### `smoke-v3-clowder-panel.spec.ts`

Purpose: Phase D panel smoke.

Steps and assertions:

1. Login and open `TEST_DIRECT_CONVERSATION` or first available conversation.
2. Click `button[title="Clowder"]`.
3. Wait for `.clowder-panel`.
4. Assert panel sections are visible:
   - text `Clowder`
   - text `Thread`
   - text `Focus`
   - text `Agents`
5. Wait for one of these stable states:
   - `.clowder-panel` contains `ready`
   - `.clowder-panel` contains `disabled:`
   - `.clowder-panel .error-text` is visible
6. Assert no clipping at desktop and mobile:
   - `.clowder-panel` bounding box width > 260
   - first `.agent-row`, if present, has non-zero width and visible text
7. Capture screenshots:
   - `/tmp/v3-clowder-panel-desktop.png`
   - `/tmp/v3-clowder-panel-mobile.png`

Minimum assertions:

```ts
await expect(page.locator('.clowder-panel')).toBeVisible();
await expect(page.locator('.clowder-panel')).toContainText(/Thread|Focus|Agents/);
await expect(page.locator('.clowder-panel .thread-id')).toBeVisible();
```

#### `smoke-v3-clowder-binding.spec.ts`

Purpose: Phase E direct/group binding.

Steps and assertions:

1. Login user A.
2. Open `TEST_DIRECT_CONVERSATION`.
3. Open Clowder panel and record `.thread-id`.
4. Send `@${TEST_AGENT_A} ${runId} direct binding smoke`.
5. Wait for exactly one `.clowder-meta` or `.clowder-badge` reply containing `Clowder`.
6. Assert reply body contains the run ID or appears after the sent row.
7. Refresh.
8. Assert the sent message and Clowder reply are present once.
9. Open `TEST_GROUP_CONVERSATION`.
10. Repeat send/wait/refresh once for group.
11. If user B credentials are present, open group as user B in a second context and assert the group message and reply are visible there too.

Minimum selectors and waits:

```ts
await expect(page.locator('.message-input-container')).toBeVisible();
await page.locator('.input-textarea').fill(message);
await page.locator('.input-textarea').press('Enter');
await expect(page.locator('.message-list').getByText(message, { exact: true }).last()).toBeVisible();
await expect(page.locator('.message-list .clowder-meta').last()).toBeVisible({ timeout: 60000 });
```

#### `smoke-v3-clowder-multi-agent.spec.ts`

Purpose: Phase H multi-agent and near-concurrent routing.

Steps and assertions:

1. Login user A and open `TEST_GROUP_CONVERSATION`.
2. Send `@${TEST_AGENT_A} ${runId} agent-a`.
3. Wait for Clowder reply whose `.clowder-cat` contains agent A display name or alias.
4. Send `/ask ${TEST_AGENT_B} ${runId} agent-b`.
5. Wait for Clowder reply whose `.clowder-cat` contains agent B display name or alias.
6. Send `/focus ${TEST_AGENT_A}`.
7. Assert a connector/system command response appears in `.sys-msg-row`, `.system-cell`, or message text.
8. Open panel and assert focus value equals agent A or panel shows agent A as preferred.
9. Send unmentioned follow-up.
10. Assert no reply row references `deepseek_ai_robot` or `DeepSeek AI` for the Clowder path.
11. Send two quick mentions:
    - `@${TEST_AGENT_A} ${runId} concurrent-a`
    - `@${TEST_AGENT_B} ${runId} concurrent-b`
12. Assert two distinct Clowder replies appear and neither replaces the other.

Minimum assertions:

```ts
await expect(page.locator('.clowder-cat').filter({ hasText: new RegExp(agentA, 'i') }).last()).toBeVisible({ timeout: 60000 });
await expect(page.locator('.clowder-cat').filter({ hasText: new RegExp(agentB, 'i') }).last()).toBeVisible({ timeout: 60000 });
await expect(page.locator('.message-list')).not.toContainText('deepseek_ai_robot');
```

#### `smoke-v3-clowder-permissions.spec.ts`

Purpose: Phase I permission denial and admin-only behavior.

Steps and assertions:

1. Login admin/owner user A and open allowed group.
2. Send `/allow-group` if the environment supports mutating authorization safely; otherwise verify current allowed state.
3. Send `@${TEST_AGENT_A} ${runId} allowed`.
4. Assert Clowder reply appears.
5. Open denied group or deny the group if safe.
6. Send `@${TEST_AGENT_A} ${runId} denied`.
7. Assert one visible denial appears through at least one channel:
   - `.clowder-status-badge` contains `Clowder group not allowed`, `Clowder denied`, or `Clowder admin only`
   - `.clowder-panel .muted` contains `disabled: group_not_allowed`
   - `.sys-msg-row` or `.system-cell` contains the Chinese/English `userMessage`
8. Login non-admin user B in a second context.
9. Attempt `/use`, `/new`, `/focus`, `/allow-group`, or `/deny-group`.
10. Assert the same denial channels appear.
11. Reopen panel as user A and verify thread/focus value did not change after user B's denied command.

Minimum assertions:

```ts
await expect(
  page.locator('.clowder-status-badge, .clowder-panel, .sys-msg-row, .system-cell')
).toContainText(/group_not_allowed|command_admin_only|permission_denied|Clowder denied|Clowder admin only|未授权|管理员/);
```

#### `smoke-v3-clowder-streaming-media.spec.ts`

Purpose: Phase J and Phase K streaming/media/degraded behavior.

Steps and assertions:

1. Login and open Clowder-enabled conversation.
2. Send a long prompt: `@${TEST_AGENT_A} ${runId} stream a long markdown answer`.
3. Wait for one Clowder message bubble.
4. During streaming, count Clowder message rows for the run ID or nearest reply identity.
5. Refresh during or immediately after streaming.
6. Assert one final Clowder reply remains.
7. If supported media fixture exists, send/upload it and assert no silent failure.
8. If unsupported media fixture exists or can be simulated, assert `.unsupported-media` is visible.
9. Use Playwright route interception for non-destructive degraded checks:
   - fulfill Clowder status with `503` and assert badge/panel error.
   - fulfill a conversation call with `504` and assert timeout text.
   - fulfill delivery state with `429` or `agent_queue_full` and assert queue-full text.
10. For browser offline streaming:
    - send prompt
    - call `context.setOffline(true)` after first visible Clowder placeholder
    - restore online
    - refresh
    - assert one final reply or a visible recoverable error, not two final replies.

Minimum assertions:

```ts
await expect(page.locator('.message-list .clowder-meta').last()).toBeVisible({ timeout: 60000 });
await page.reload();
await expect(page.locator('.message-list .clowder-meta')).toHaveCount(1, { timeout: 30000 });
await expect(page.locator('.unsupported-media')).toBeVisible({ timeout: 10000 });
```

#### New `smoke-v3-clowder-v2-regression.spec.ts`

Purpose: Phase F V2 regression safety net.

Steps and assertions:

1. Login and open `TEST_V2_CONVERSATION` or first non-Clowder conversation.
2. Send `${runId} v2 normal message`.
3. Assert message appears.
4. Refresh.
5. Assert message appears once and no `.clowder-meta` is attached to it.
6. If `TEST_V2_ROBOT_CONVERSATION` is provided:
   - open that robot conversation
   - assert `DeepSeek AI` or `.ai-contact-panel` is visible
   - send `${runId} v2 robot prompt`
   - wait for robot/AI reply
   - refresh
   - assert reply remains and does not show `.clowder-meta`

Minimum assertions:

```ts
await expect(page.locator('.message-list').getByText(message, { exact: true }).last()).toBeVisible();
await page.reload();
await expect(page.locator('.message-list').getByText(message, { exact: true })).toHaveCount(1);
await expect(page.locator('.message-list .clowder-meta').filter({ hasText: message })).toHaveCount(0);
```

#### New `smoke-v3-clowder-thread-lifecycle.spec.ts`

Purpose: Phase G thread lifecycle commands.

Steps and assertions:

1. Login and open Clowder-enabled group.
2. Send `/where`.
3. Assert connector/system response.
4. Send `/new ${runId}`.
5. Assert panel thread ID changes from previous value or command response includes new thread details.
6. Send `/threads`.
7. Assert command response lists threads.
8. Send `/use <thread-ref>`.
9. Assert command response confirms active thread.
10. Send `/thread <thread-id> ${runId} routed lifecycle`.
11. Assert a Clowder reply or connector response appears for the target thread.

Minimum assertions:

```ts
await expect(page.locator('.sys-msg-row, .system-cell, .message-list')).toContainText(/thread|where|current|当前|已切换|created|创建/);
await expect(page.locator('.clowder-panel .thread-id')).not.toContainText('Not bound');
```

Suggested command:

```bash
cd /media/leng/DiskB1/exp/seedcmp/sections/im_web/apps/chat
TARGET_URL=http://localhost:3000 RUN_V3_CLOWDER_SMOKE=1 pnpm test:e2e -- smoke-v3-clowder
```

For Clowder-only exploratory scripts, use the external Playwright runner with:

```text
CLOWDER_URL=http://localhost:3003
```

## Clowder API Live Assertions

The first browser run should include non-mutating API checks through Playwright `request`.

Required assertions:

```text
GET /api/connectors/im-web/status
- status is 200
- body.connectorId is "im-web"
- body has enabled/configured/reachable/version/featureFlags

GET /api/commands?surface=connector
- status is 200
- command list contains /status, /cats, /focus
- preferred full set also includes /ask, /new, /threads, /use, /thread, /where, /history, /allow-group, /deny-group

GET /api/connectors/im-web/agents?externalChatId=<known external chat id>
- include x-cat-cafe-user
- if binding exists: agents array has at least two entries
- if binding is missing: response is 404 or empty structured response, not 500
```

Signed inbound probes are optional until the secret is provided. If `CLOWDER_CONNECTOR_SECRET` is present, assert:

```text
POST /api/connectors/im-web/inbound
- valid signature routes or returns a documented skipped reason
- replaying the same message ID returns kind=skipped, reason=duplicate
- invalid signature returns 401 invalid_signature
```

## Evidence Template

Append one entry per run to `sections/im_web/.ai/V3.0/evidence.md`.

```markdown
### Browser Integration Run - <run-id>

- Date/time:
- Operator:
- Clowder URL:
- IM Web URL:
- Browser:
- Viewports:
- Test users:
- Test conversations:
- Agent aliases:
- Bridge status:
- Clowder status endpoint:
- Commands endpoint:
- Screenshots:
- Console errors:
- Failed network requests:

| Phase | Result | Evidence | Notes |
|-------|--------|----------|-------|
| A - Service and Browser Preflight | Pass/Fail/Skipped | screenshot/API summary | |
| B - Clowder PWA Functional Smoke | Pass/Fail/Skipped | screenshot/thread id | |
| C - Connector API Contract Smoke | Pass/Fail/Skipped | status/body summary | |
| D - IM Web UI Smoke | Pass/Fail/Skipped | screenshot/selectors | |
| E - Direct and Group Binding | Pass/Fail/Skipped | message ids/thread ids | |
| F - V2 Regression Safety Net | Pass/Fail/Skipped | message ids | |
| G - Thread Lifecycle Commands | Pass/Fail/Skipped | command responses | |
| H - Multi-Agent Routing | Pass/Fail/Skipped | agent replies | |
| I - Permissions | Pass/Fail/Skipped | denial UI evidence | |
| J - Streaming, Media, Refresh, History | Pass/Fail/Skipped | counts/screenshots | |
| K - Network and Degraded Mode | Pass/Fail/Skipped | intercepted responses/UI | |
| L - Session Expiry | Pass/Fail/Skipped | redirects/errors | |

Residual risks:
- 
```

## Evidence to Record

Append results to `sections/im_web/.ai/V3.0/evidence.md` after execution.

Record:

- Date/time and run ID.
- URLs tested.
- Browser and viewport.
- Service status endpoint summaries.
- Screenshots paths.
- Console errors and failed network requests.
- Messages sent and expected replies.
- Thread IDs, external chat IDs, and binding IDs where visible.
- Pass/fail result per phase.
- Any skipped phase and the exact missing prerequisite.

## Stop Conditions

Stop the browser run and report instead of continuing if:

- Clowder PWA at `http://localhost:3003` does not load.
- IM Web requires credentials that are not available.
- Bridge status says disabled or unconfigured.
- Required test data is unavailable: direct conversation, group conversation, two agents, or second user for multi-account phases.
- The test secret is unavailable for signed inbound API probes.
- A test would need to delete or reset persistent Redis data.
- The UI has changed enough that selectors cannot be inferred safely.
- The test would mutate production-like persisted state without a namespaced run ID.

## Proposed First Run

After this plan is approved, execute in this order:

1. Clowder PWA preflight at `http://localhost:3003`.
2. Clowder connector API live status and agent discovery.
3. IM Web UI preflight at `TARGET_URL` or `http://localhost:3000`.
4. Clowder panel browser smoke.
5. Direct/group binding smoke.
6. V2 regression safety net.
7. Thread lifecycle command smoke.
8. Multi-agent routing smoke.
9. Permission smoke.
10. Streaming/media/history smoke.
11. Network/degraded mode smoke.
12. Session expiry smoke.

If Phase A or C exposes missing configuration, stop after recording diagnostics and update the implementation or environment before running mutating E2E flows.
