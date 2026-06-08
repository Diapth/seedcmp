# V3-22 Conversation Sync Empty State After Backend Gap

## Status

Resolved on 2026-06-01

## Problem

During manual testing on `http://localhost:3000`, account `18337488675` showed an empty conversation list (`暂无聊天会话`) even though the account still had group and direct conversation history.

The same session also showed a connection banner like `在线 [object Object]`.

## Root Cause

- The chat dev server on port `3000` was alive, but TangSengDaoDao API on `8090` was not listening.
- Vite proxied `/v1/*` requests to the missing backend, so startup sync requests failed with empty `500` responses.
- `ConversationList` swallowed the initial sync failure and rendered the empty-state copy, which made a backend outage look like deleted chat history.
- SDK recovery stored raw error objects with `String(err)`, which rendered as `[object Object]`.

## Fix

- Restarted TangSengDaoDao API from the current repo in tmux session `tangseng-v3-seedcmp`.
- Added explicit conversation sync failure UI with a retry action and automatic retry backoff.
- Updated startup conversation loading to call sync APIs with `throwOnError: true`, so failures reach the UI instead of falling through to the empty state.
- Normalized SDK recovery/connect-address errors before writing `lastError`, avoiding `[object Object]` in the connection banner.

## Verification

- `curl http://localhost:3000/v1/common/appconfig` -> `200`
- `curl http://127.0.0.1:8090/v1/common/appconfig` -> `200`
- `pnpm --filter chat exec vitest run tests/notificationUnread.test.ts tests/sdkRecovery.test.ts --pool=threads --poolOptions.threads.singleThread=true` -> 2 files / 3 tests passed
- `pnpm type-check` -> passed
- Playwright resync check against `18337488675` -> 29 conversations loaded, `集群` first, no `/v1` 4xx/5xx failures, no toast messages

## 2026-06-01 Reverification

This issue is still covered by the current regression suite. The conversation sync failure UI and SDK recovery error normalization remain in place.

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/notificationUnread.test.ts tests/sdkRecovery.test.ts tests/clowderGroupIdentityRecovery.test.ts tests/clowderAgentDirectory.test.ts tests/clowderGroupMemberList.test.ts tests/conversationPresentation.test.ts tests/clowderMessageStore.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

Result: 7 files / 33 tests passed.

```bash
cd sections/im_web
pnpm type-check
pnpm build
```

Result: type-check passed; build passed with the existing Vite CJS deprecation and chunk-size warnings.
