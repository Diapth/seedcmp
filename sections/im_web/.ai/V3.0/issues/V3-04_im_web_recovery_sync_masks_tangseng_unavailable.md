# V3-04 - IM Web Recovery Sync Masks TangSeng Unavailable

## Status
Resolved on 2026-05-28.

## Severity
P0 - user-facing session recovery regression.

## Symptom
The logged-in IM Web session could show an empty conversation list with the recovery banner still indicating sync activity. In the observed environment, WuKongIM and Clowder were running, but TangSengDaoDaoServer HTTP API was not listening on `:8090`, so conversation and group recovery could not fetch persisted state.

## Root Cause
`conversationStore.syncConversations()` and `groupStore.fetchMyGroups()` caught TangSeng API failures and returned normally. During SDK recovery this allowed `recoverAfterReconnect()` to continue and potentially mark recovery as complete even though the conversation/group sync failed.

The repo also has same-basename `.js` store files beside `.ts` files, so the runtime mirror had to be aligned with the TypeScript source.

## Fix
- Added `throwOnError` recovery mode to conversation and group sync helpers.
- SDK recovery now calls sync helpers with `throwOnError: true`, so TangSeng failures set recovery state to `failed` instead of being masked.
- Normal page-level sync calls keep the existing forgiving behavior.
- Aligned `conversationStore.js` and `groupStore.js` with the TypeScript source.

## Evidence
- RED: `cd sections/im_web/apps/chat && pnpm exec vitest run tests/recoveryFailureState.test.ts --config vitest.config.ts` failed because `recoverAfterReconnect()` resolved `undefined` when `conversation/sync` or `group/my` failed.
- GREEN: same command passed after the fix.
- Regression: `cd sections/im_web/apps/chat && pnpm exec vitest run tests/recoveryFailureState.test.ts tests/offlineQueue.test.ts tests/sdkRecovery.test.ts tests/groupOfflineUnreadRetention.test.ts --config vitest.config.ts` passed 8 tests across 4 files.
- Type check: `cd sections/im_web && pnpm type-check` passed.
- Service recovery: TangSengDaoDaoServer started and `GET http://100.79.157.76:8090/v1/health` returned `{"db":"up","redis":"up","status":"up"}`.
- Browser visual audit: `sections/im_web/.ai/V3.0/tests-e2e/conversation-loss-audit-20260528-2316/` shows `leng_test_updated` logged in, conversation list restored, no `暂无聊天会话`, `conversation/sync` 200, no page errors, no failed requests, and no 4xx/5xx responses in the captured 8090/3004 traffic.
