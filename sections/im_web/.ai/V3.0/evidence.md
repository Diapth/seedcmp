# Evidence: IM Web V3.0 Clowder Multi-Agent Connector

## Baseline

Baseline command inventory captured during Phase 1 setup, with final V3 implementation status reflected below.

| Command | Status | Notes |
|---------|--------|-------|
| `cd sections/im_web && pnpm type-check` | Pass | Phase 2 type foundation verification passed after Clowder DTO/store type additions |
| `cd sections/im_web && pnpm build` | Pass | Final build passed with Vite chunk-size warning only |
| `cd sections/im_web && pnpm test:unit` | Not run | T104 remains open; earlier full chat-unit attempt hit unrelated V2 failures |
| `cd sections/im_web && pnpm test:e2e` | Not run | T105 remains open until live TangSeng/WuKongIM/Clowder/browser environment is available |
| `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build` | Pass | Phase 2 connector scaffold verification passed after `im-web` adapter/route registration |
| `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm test:public` | Not run | Supplemented by targeted `im-web` connector tests |
| `cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder ./modules/common ./modules/robot -run 'Test(Normalize|Sign|Verify|DefaultClowder|ClowderBridgeConfigFromEnv|MessagesListen|StableStreamClientMsgNo|RobotRouting)' -count=1` | Pass | Targeted bridge, signature, listener, streaming, and robot routing coverage |

## Fixture Inventory

- IM Web reusable fixture map: `sections/im_web/apps/chat/tests/setup.ts`
- Clowder connector helper: `/media/leng/DiskB1/exp/clowder-ai/packages/api/test/im-web-connector-test-helpers.js`
- TangSeng Docker ignore verified: `sections/im/TangSengDaoDaoServer/.dockerignore`

## Phase 2 Foundation Checks

- TangSeng HMAC helper RED: `cd sections/im/TangSengDaoDaoServer && go test ./modules/common -run 'Test(Sign|Verify|DefaultClowder)'` failed before implementation with missing helper symbols.
- TangSeng HMAC helper GREEN: `cd sections/im/TangSengDaoDaoServer && go test ./modules/common -run 'Test(Sign|Verify|DefaultClowder)'` passed.
- IM Web type foundation: `cd sections/im_web && pnpm type-check` passed.
- Clowder connector scaffold: `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build` passed.

## Story Evidence

### US1 - Route IM Conversations Into Clowder Threads

- Recorded: 2026-05-28 14:12 CST
- Fresh verification:
  - Pass - `cd sections/im_web && pnpm type-check`
  - Pass - `cd sections/im_web && pnpm build` with Vite chunk-size warning only
  - Pass - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderBridgeContracts.test.ts tests/clowderMessageStore.test.ts tests/messageActions.test.ts --pool=threads --poolOptions.threads.singleThread=true` passed 24 tests
  - Pass - `cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder ./modules/common -run 'Test(Normalize|Sign|Verify|DefaultClowder)'`
  - Pass - `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build && node --test test/im-web-outbound-adapter.test.js test/im-web-inbound-bridge.test.js` passed 5 tests
- TangSeng message event wiring TDD RED: `go test ./modules/common ./modules/clowder -run 'TestClowderBridgeConfigFromEnv|TestMessagesListenForwardsConfiguredMessages'` failed because `ClowderBridgeConfigFromEnv` was missing.
- TangSeng message event wiring GREEN:
  - Pass - `go test ./modules/common ./modules/clowder -run 'TestClowderBridgeConfigFromEnv|TestMessagesListenForwardsConfiguredMessages|Test(Normalize|Sign|Verify|DefaultClowder)'`
  - Pass - `go test ./modules/message -run '^$'` compiled message package and Clowder listener wiring.
- TangSeng message test blocked by local DB: `go test ./modules/message -run 'TestMessageSync$'` reached route registration and logged the Clowder bridge as disabled/unconfigured, then failed on existing MySQL root access (`Access denied for user 'root'@'localhost'`) while querying offsets.
- Contract tests: Pass - `node --test test/im-web-inbound-bridge.test.js`
- Outbound adapter TDD RED: `pnpm build && node --test test/im-web-outbound-adapter.test.js` built successfully, then failed because no HTTP callback was sent and non-2xx callbacks were not surfaced.
- Outbound adapter GREEN: Pass - `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build && node --test test/im-web-outbound-adapter.test.js test/im-web-inbound-bridge.test.js` passed 5 tests across inbound and outbound suites.
- IM Web type-check: Pass - `cd sections/im_web && pnpm type-check`
- IM Web build: Pass - `cd sections/im_web && pnpm build` with Vite chunk-size warning only.
- IM Web targeted tests: Pass - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderBridgeContracts.test.ts tests/clowderMessageStore.test.ts --pool=threads --poolOptions.threads.singleThread=true`
- IM Web Clowder message merge TDD RED: `pnpm exec vitest run tests/clowderMessageStore.test.ts --pool=threads --poolOptions.threads.singleThread=true` failed because Clowder durable replies did not merge into local streaming placeholders.
- IM Web Clowder message merge GREEN: Pass - `pnpm exec vitest run tests/clowderMessageStore.test.ts --pool=threads --poolOptions.threads.singleThread=true` passed 3 tests.
- IM Web V2 AI regression: Pass - `pnpm exec vitest run tests/messageActions.test.ts --pool=threads --poolOptions.threads.singleThread=true` passed 19 tests.
- TangSeng tests: Pass - `cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder ./modules/common -run 'Test(Normalize|Sign|Verify|DefaultClowder)'`
- Clowder tests: Pass - API build, inbound bridge contract, and outbound adapter signed callback tests.
- Full chat unit residual risk: `cd sections/im_web && pnpm --filter chat test:unit -- clowderBridgeContracts.test.ts` also ran unrelated chat tests; new Clowder tests passed, while existing V2 tests failed in `tests/filePreviewVoiceAiContracts.test.ts` (`sandbox="allow-scripts"`) and `tests/largeHistory.test.ts` (`bottomSpacerHeight`). These were not introduced by the V3 Clowder changes.
- Smoke: Pending
- Review: Pass for US1 contract/scaffold scope; production message listener wiring and runnable smoke remain tracked as T027/T023.

### US2 - Manage Multi-User Group Access and Permissions

- Recorded: 2026-05-28 14:48 CST
- Permission policy TDD RED: `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build && node --test test/im-web-permissions.test.js` failed because `ImWebPermissionPolicy` did not exist.
- Clowder tests: Pass - `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build && node --test test/im-web-inbound-bridge.test.js test/im-web-permissions.test.js` passed 6 tests.
- TangSeng role tests: Pass - `cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder -run 'TestNormalizeInboundMessageBuildsExternalChatAndSender|TestNormalizeGroupRoleSnapshot'`.
- IM Web permission TDD RED: `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderPermissionState.test.ts --pool=threads --poolOptions.threads.singleThread=true` failed because `allowGroup`/`denyGroup` actions and denied disabled reasons were missing.
- IM Web tests: Pass - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderPermissionState.test.ts --pool=threads --poolOptions.threads.singleThread=true` passed 2 tests.
- Smoke: Added environment-gated Playwright spec `tests-e2e/smoke-v3-clowder-permissions.spec.ts`; not executed because `RUN_V3_CLOWDER_SMOKE` and the multi-service environment are not available.
- Final verification update: Pass - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderPermissionState.test.ts tests/clowderAgentDirectory.test.ts tests/clowderCommandContracts.test.ts tests/clowderMessagePresentation.test.ts tests/clowderPanel.test.ts tests/clowderControlStore.test.ts tests/clowderStreamingMerge.test.ts tests/clowderMediaFallback.test.ts tests/clowderHistoryRecovery.test.ts --pool=threads --poolOptions.threads.singleThread=true` includes the permission UI regression and passed.
- Final Clowder update: Pass - `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build && node --test test/im-web-webhook-response-mapping.test.js test/im-web-agent-directory-route.test.js test/im-web-multi-agent-routing.test.js test/im-web-streaming-adapter.test.js test/rich-block-plaintext.test.js test/im-web-permissions.test.js` includes permission response mapping and passed 11 tests across 6 suites.
- Review: Pass for tested permission policy/store/UI state scope. Group role snapshots are injected by the TangSeng message listener into `MessagesListenWithRoles`; command denial responses map to visible IM Web states.

### US3 - Connect Multiple Clowder Agents From One IM Conversation

- Recorded: 2026-05-28 15:45 CST
- Clowder multi-agent routing TDD: Pass - `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build && node --test test/im-web-webhook-response-mapping.test.js test/im-web-agent-directory-route.test.js test/im-web-multi-agent-routing.test.js test/im-web-streaming-adapter.test.js test/rich-block-plaintext.test.js test/im-web-permissions.test.js` passed 11 tests across 6 suites.
- IM Web agent and command tests: Pass - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderPermissionState.test.ts tests/clowderAgentDirectory.test.ts tests/clowderCommandContracts.test.ts tests/clowderMessagePresentation.test.ts tests/clowderPanel.test.ts tests/clowderControlStore.test.ts tests/clowderStreamingMerge.test.ts tests/clowderMediaFallback.test.ts tests/clowderHistoryRecovery.test.ts --pool=threads --poolOptions.threads.singleThread=true` passed 14 tests across 9 files.
- TangSeng robot routing regression: Pass - `cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder ./modules/common ./modules/robot -run 'Test(Normalize|Sign|Verify|DefaultClowder|ClowderBridgeConfigFromEnv|MessagesListen|StableStreamClientMsgNo|RobotRouting)' -count=1`.
- Smoke: Added environment-gated Playwright spec `tests-e2e/smoke-v3-clowder-multi-agent.spec.ts`; not executed because `RUN_V3_CLOWDER_SMOKE` and the full multi-service environment are not available in this session.
- Review: Pass for mention, `/ask`, `/focus`, preferred-cat, agent-directory, and V3 no-hardcoded-DeepSeek routing coverage.

### US4 - Provide IM-Side Thread and Agent Controls

- Recorded: 2026-05-28 15:45 CST
- IM Web panel/control tests: Pass - targeted Vitest command above includes `clowderPanel.test.ts` and `clowderControlStore.test.ts`.
- Status route mapping: Pass - final Clowder API targeted command above validates `/api/connectors/im-web/status`; TangSeng `/v1/clowder/status` is covered by targeted Go package compilation and bridge tests.
- IM Web type-check/build: Pass - `cd sections/im_web && pnpm type-check`; Pass - `cd sections/im_web && pnpm build` with Vite chunk-size warning only.
- Smoke: Added environment-gated Playwright spec `tests-e2e/smoke-v3-clowder-panel.spec.ts`; not executed because the browser smoke environment is not running.
- Review: Pass for panel state, disabled reasons, focus/thread actions, agent directory state, and health/status visibility.

### US5 - Preserve Streaming, Media, and History Behavior

- Recorded: 2026-05-28 15:45 CST
- IM Web streaming/media/history tests: Pass - targeted Vitest command above includes `clowderStreamingMerge.test.ts`, `clowderMediaFallback.test.ts`, and `clowderHistoryRecovery.test.ts`.
- Clowder streaming/media tests: Pass - final Clowder API targeted command above includes `im-web-streaming-adapter.test.js` and `rich-block-plaintext.test.js`.
- TangSeng streaming/media tests: Pass - `cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder ./modules/common ./modules/robot -run 'Test(Normalize|Sign|Verify|DefaultClowder|ClowderBridgeConfigFromEnv|MessagesListen|StableStreamClientMsgNo|RobotRouting)' -count=1`.
- Smoke: Added environment-gated Playwright spec `tests-e2e/smoke-v3-clowder-streaming-media.spec.ts`; not executed because the live bridge, WuKongIM, TangSeng, Clowder, and browser accounts are not available.
- Review: Pass for stable stream `clientMsgNo`, duplicate-final prevention, unsupported media fallback, visible delivery states, reconnect, and large-history ordering coverage.

## Final Verification

- IM Web targeted tests: Pass - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderPermissionState.test.ts tests/clowderAgentDirectory.test.ts tests/clowderCommandContracts.test.ts tests/clowderMessagePresentation.test.ts tests/clowderPanel.test.ts tests/clowderControlStore.test.ts tests/clowderStreamingMerge.test.ts tests/clowderMediaFallback.test.ts tests/clowderHistoryRecovery.test.ts --pool=threads --poolOptions.threads.singleThread=true` passed 14 tests across 9 files.
- IM Web type-check: Pass - `cd sections/im_web && pnpm type-check`
- IM Web build: Pass - `cd sections/im_web && pnpm build` with Vite chunk-size warning only.
- IM Web full unit suite: Pass - `cd sections/im_web && pnpm test:unit` passed 132 tests across 48 files.
- IM Web E2E smoke: Pass - `cd sections/im_web/apps/chat && pnpm exec playwright test --config playwright.config.ts --reporter=line` passed 8 default runnable smoke tests and skipped 8 live V3 specs gated by `RUN_V3_CLOWDER_SMOKE`.
- IM Web V3 full transcript smoke: Pass - `cd sections/im_web/apps/chat && RUN_V3_CLOWDER_SMOKE=1 TEST_AGENT_A=codex CLOWDER_URL=http://127.0.0.1:3004 CLOWDER_CONNECTOR_SECRET=dev-im-web-secret pnpm exec playwright test tests-e2e/smoke-v3-clowder-full-transcript.spec.ts --config playwright.config.ts --reporter=line` passed 1 Chromium test. Evidence: `sections/im_web/.ai/V3.0/tests-e2e/v3-full-transcript-20260529083444/result.json`.
- Clowder API build and targeted connector tests: Pass - `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build && node --test test/im-web-webhook-response-mapping.test.js test/im-web-agent-directory-route.test.js test/im-web-multi-agent-routing.test.js test/im-web-streaming-adapter.test.js test/rich-block-plaintext.test.js test/im-web-permissions.test.js` passed 11 tests across 6 suites.
- TangSeng bridge tests: Pass - `cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder ./modules/common ./modules/robot -run 'Test(Normalize|Sign|Verify|DefaultClowder|ClowderBridgeConfigFromEnv|MessagesListen|StableStreamClientMsgNo|RobotRouting)' -count=1`.

## Browser Acceptance

### Multi-Account Visual Regression Run - v3-multi-account-visual-20260531081933

- Date/time: 2026-05-31 16:19 CST
- IM Web URL: `http://localhost:3000`
- TangSeng API preflight: `GET http://localhost:8090/v1/health` returned 200 with `db/redis/status: up`
- Clowder URL: `http://localhost:3003`
- Clowder preflight: `GET /api/connectors/im-web/status` returned 200 with `connectorId: im-web`, `enabled/configured/reachable: true`
- Accounts: `18337488675`, `13733632709`
- Shared group used for the successful two-account visual flow: `TestGroup1`
- Command: `TARGET_URL=http://localhost:3000 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 TEST_B_USERNAME=13733632709 TEST_B_PASSWORD=123456 TEST_GROUP_CONVERSATION=TestGroup1 node /home/leng/.codex/skills/playwright-skill/run.js /tmp/playwright-v3-multi-account-visual.js`
- Result: Pass. A and B both logged in, opened the same group, A sent a namespaced message, B received it, B still saw it after reload, middle-position `@` mention popup was visible, Clowder panel opened with width 419px, console errors 0, page errors 0, failed network requests 0.
- Evidence directory: `sections/im_web/.ai/V3.0/tests-e2e/v3-multi-account-visual-20260531081933/`
  - `00-a-after-login.png`
  - `00-b-after-login.png`
  - `01-a-group-open.png`
  - `02-b-group-open.png`
  - `03-a-after-send.png`
  - `04-b-after-receive.png`
  - `05-b-after-reload.png`
  - `06-a-mention-middle.png`
  - `07-a-clowder-panel.png`
  - `result.json`

### V3 Live Smoke Suite Attempt - 2026-05-31 16:14 CST

- Command: `RUN_V3_CLOWDER_SMOKE=1 TARGET_URL=http://localhost:3000 CLOWDER_URL=http://localhost:3003 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 TEST_B_USERNAME=13733632709 TEST_B_PASSWORD=123456 TEST_GROUP_CONVERSATION=集群 TEST_AGENT_A=codex TEST_AGENT_B=ragdoll CLOWDER_TEST_USER=18337488675 CLOWDER_CONNECTOR_SECRET=dev-im-web-secret pnpm exec playwright test tests-e2e/smoke-v3-clowder-panel.spec.ts tests-e2e/smoke-v3-clowder-binding.spec.ts tests-e2e/smoke-v3-clowder-multi-agent.spec.ts tests-e2e/smoke-v3-clowder-permissions.spec.ts tests-e2e/smoke-v3-clowder-streaming-media.spec.ts tests-e2e/smoke-v3-clowder-v2-regression.spec.ts tests-e2e/smoke-v3-clowder-thread-lifecycle.spec.ts --config playwright.config.ts --reporter=line`
- Result: Fail - 7 tests total, 5 failed, 2 skipped.
- Failure summary:
  - Binding smoke timed out waiting for an additional Clowder reply count after sending `@codex ... direct binding smoke`.
  - Multi-agent smoke expected the latest cat badge to contain `codex`, but the last visible cat was `布偶猫`.
  - Panel smoke found `.clowder-panel` width `249.609375`, below the test threshold of 260.
  - Streaming/media degraded-mode route interception did not surface `error|unavailable|clowder_unavailable` text.
  - V2 regression smoke sent a non-Clowder message but did not find it after reload.
- Error contexts: `sections/im_web/apps/chat/test-results/*/error-context.md`

### Default E2E Regression Run - 2026-05-31 16:13 CST

- Command: `cd sections/im_web/apps/chat && pnpm exec playwright test --config playwright.config.ts --reporter=line`
- Result: Pass for default runnable suite: 8 passed, 11 skipped. V3 live specs remained skipped because `RUN_V3_CLOWDER_SMOKE` was not set for this baseline run.

### V3 Browser Integration Run - v3-smoke-20260528-1715

- Date/time: 2026-05-28 17:15 CST
- Clowder URL: `http://localhost:3003`
- IM Web URL: `http://localhost:3000` started by Playwright webServer
- Command: `RUN_V3_CLOWDER_SMOKE=1 CLOWDER_URL=http://localhost:3003 pnpm exec playwright test tests-e2e/smoke-v3-clowder-panel.spec.ts tests-e2e/smoke-v3-clowder-binding.spec.ts tests-e2e/smoke-v3-clowder-multi-agent.spec.ts tests-e2e/smoke-v3-clowder-permissions.spec.ts tests-e2e/smoke-v3-clowder-streaming-media.spec.ts tests-e2e/smoke-v3-clowder-v2-regression.spec.ts tests-e2e/smoke-v3-clowder-thread-lifecycle.spec.ts --reporter=line`
- Result: Fail - 7 tests total, 6 failed, 1 skipped.
- Summary: `sections/im_web/.ai/V3.0/tests-e2e/v3-smoke-20260528-1715/summary.md`
- Issues opened:
  - `sections/im_web/.ai/V3.0/issues/V3-01_im_web_smoke_login_backend_unreachable.md`
  - `sections/im_web/.ai/V3.0/issues/V3-02_clowder_prod_pwa_missing_im_web_connector_api.md`
  - `sections/im_web/.ai/V3.0/issues/V3-03_acceptance_environment_missing_second_agent_and_test_data.md`
- Service probes:
  - Pass - `GET http://localhost:3003/api/health` returned 200.
  - Pass - `GET http://localhost:3003/api/commands?surface=connector` returned 200 and included connector commands.
  - Pass - `GET http://localhost:3003/api/cats` returned 200 with one cat.
  - Fail - `GET http://localhost:3003/api/connectors/im-web/status` returned 404.
  - Fail - `GET http://localhost:3003/api/connectors/im-web/agents?externalChatId=2:test` returned 404.
  - Fail - `curl --noproxy '*' http://localhost:8090/v1/user/login` could not connect; browser login remained on `/login`.

### V3 Recovery Visual Audit - conversation-loss-audit-20260528-2316

- Date/time: 2026-05-28 23:16 CST
- IM Web URL: `http://localhost:3000`
- TangSeng API: `http://localhost:8090/v1`
- Clowder API: `http://127.0.0.1:3004`
- User: `leng_test_updated` / `008618337488675`
- Root cause found: TangSengDaoDaoServer HTTP API was not listening on `:8090`; IM recovery helpers masked sync failures.
- Fix evidence:
  - RED/GREEN: `cd sections/im_web/apps/chat && pnpm exec vitest run tests/recoveryFailureState.test.ts --config vitest.config.ts`
  - Regression: `cd sections/im_web/apps/chat && pnpm exec vitest run tests/recoveryFailureState.test.ts tests/offlineQueue.test.ts tests/sdkRecovery.test.ts tests/groupOfflineUnreadRetention.test.ts --config vitest.config.ts` passed 8 tests.
  - Type check: `cd sections/im_web && pnpm type-check` passed.
- Service evidence:
  - `GET http://localhost:8090/v1/health` returned `{"db":"up","redis":"up","status":"up"}`.
  - `GET http://127.0.0.1:3004/api/commands?surface=connector` returned 200 and includes `/cats | /cats new <猫名> [@别名]`.
- Browser evidence directory: `sections/im_web/.ai/V3.0/tests-e2e/conversation-loss-audit-20260528-2316/`
  - `01-login.png`
  - `02-after-login.png`
  - `03-chat-refresh.png`
  - `audit.json`
- Browser result: Pass. Conversation list restored, `暂无聊天会话` absent, `conversation/sync` returned 200 with persisted conversations, request failures 0, page errors 0, 8090/3004 4xx/5xx responses 0.
- Issue record: `sections/im_web/.ai/V3.0/issues/V3-04_im_web_recovery_sync_masks_tangseng_unavailable.md`
