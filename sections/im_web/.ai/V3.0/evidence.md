# Evidence: IM Web V3.0 Clowder Multi-Agent Connector

## Baseline

Baseline command inventory captured during Phase 1 setup. Execution remains pending until implementation dependencies for each slice are ready.

| Command | Status | Notes |
|---------|--------|-------|
| `cd sections/im_web && pnpm type-check` | Pass | Phase 2 type foundation verification passed after Clowder DTO/store type additions |
| `cd sections/im_web && pnpm build` | Pending | Required before implementation completion |
| `cd sections/im_web && pnpm test:unit` | Pending | Required before implementation completion |
| `cd sections/im_web && pnpm test:e2e` | Pending | Run once bridge and services are available |
| `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build` | Pass | Phase 2 connector scaffold verification passed after `im-web` adapter/route registration |
| `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm test:public` | Pending | Supplement with targeted connector tests |
| `cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder ./modules/common` | Pending | Becomes runnable after bridge package exists |

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

- Permission tests: Pending
- IM Web tests: Pending
- TangSeng tests: Pending
- Clowder tests: Pending
- Smoke: Pending
- Review: Pending

### US3 - Connect Multiple Clowder Agents From One IM Conversation

- Multi-agent routing tests: Pending
- IM Web tests: Pending
- Clowder tests: Pending
- Smoke: Pending
- Review: Pending

### US4 - Provide IM-Side Thread and Agent Controls

- Component/store tests: Pending
- Health/status tests: Pending
- Smoke: Pending
- Review: Pending

### US5 - Preserve Streaming, Media, and History Behavior

- Streaming tests: Pending
- Media fallback tests: Pending
- V2 regression tests: Pending
- Smoke: Pending
- Review: Pending

## Final Verification

- IM Web type-check: Pass - current scaffold passes `cd sections/im_web && pnpm type-check`
- IM Web build: Pass - current scaffold passes `cd sections/im_web && pnpm build` with Vite chunk-size warning only
- IM Web unit tests: Pending
- IM Web E2E smoke: Pending
- Clowder API build: Pass - current scaffold passes `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build`
- Clowder connector tests: Pass - current targeted `im-web` inbound/outbound connector tests pass
- TangSeng bridge tests: Pending
