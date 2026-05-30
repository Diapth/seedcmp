# V3-20: Group Chat Recent History Window Loss

## Status

Fixed and verified.

## Created

2026-05-30

## Labels

bug, history, group-chat, sync, recovery

## Priority

P0

## User Report

The `集群` group chat rendered only messages around 23:00. The user later clarified that the test account `18337488675` still could not receive/view the group messages before 23:00, even though the backend retained them.

The same clarification also showed follow-up Clowder file rows from `布偶猫` displaying as a normal human user. That identity regression is recorded under V3-19 and verified again here because it affected the same visible history window.

## Impact

- Users cannot trust the chat timeline after realtime activity, refresh, or reopening a group.
- Earlier context disappears, making file/reply conversations look deleted.
- Clowder follow-up attachment rows become confusing when they render as the human transport sender instead of the cat.

## Evidence From 18337488675

Direct API checks against the `18337488675` test account found:

- Logged-in uid: `6db8b65b3ae94092badfeb82e47c06f7`.
- Target group: `cec409c5b5db4399a27358e76eb587b1` / `集群`.
- `message/channel/sync` with `start_message_seq: 0` returned only seq `72-101`.
- `message/channel/sync` with `start_message_seq: 1` returned seq `1-30`, including the pre-23:00 messages shown missing in the UI.
- Additional pages `31`, `61`, and `91` completed the visible window.

So the backend data was present; the frontend was not hydrating the visible history window after receiving the backend latest page.

## Root Cause

`messageStore.syncMessages()` previously performed one incremental request from the local maximum `messageSeq`.

That failed in two related cases:

1. If local state contained only newer realtime rows, `syncMessages()` requested after that high sequence and received an empty increment, leaving older recent rows absent.
2. If local state was empty, `start_message_seq: 0` asked the backend for the latest page only. For the real group that meant seq `72-101`; older visible rows such as seq `1-71` were never requested.

The initial V3-20 fix only retried `start_message_seq: 0`, which still returned the latest 30 rows. The corrected fix hydrates the active chat's visible history window by paging forward from the calculated target start.

## Fix

Updated `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`:

- Added a bounded visible-history hydration path with a 300-message cap.
- Kept the normal incremental sync first.
- When explicitly requested by an active chat view, calculate the target window from the highest known positive `messageSeq`.
- Fetch missing pages with forward starts such as `1`, `31`, `61`, and `91`.
- Merge all pages through the existing de-duplication/sort path.
- Keep background/reconnect sync on the latest page unless `{ hydrateVisibleHistory: true }` is passed.

Updated active chat callers:

- `sections/im_web/apps/chat/src/views/ChatView.vue`
  - Passes `{ hydrateVisibleHistory: true }` when opening or switching conversations.
- `sections/im_web/apps/chat/src/components/MessageInput.vue`
  - Passes `{ hydrateVisibleHistory: true }` for delayed Clowder conversation resync after sending.

The extra guard prevents reconnect recovery from paging 300 messages for every conversation in the sidebar.

## Regression Coverage

Updated `sections/im_web/apps/chat/tests/messageStoreDailyMessaging.test.ts` with:

- `backfills the recent history window when local channel state only has newer realtime messages`
- `hydrates the visible recent history when the server latest window starts after earlier messages`
- `keeps background sync to the latest page unless visible history hydration is requested`

The long-history test reproduces the live backend shape: first page `72-101`, followed by `1-30`, `31-60`, `61-90`, and `91-101`.

## Browser Evidence

Headless Playwright audit:

```bash
IM_WEB_URL=http://127.0.0.1:5174 IM_WEB_AUDIT_DIR=sections/im_web/.ai/V3.0/tests-e2e/v3-20-history-20260531000045 HEADLESS=true node /home/leng/.codex/skills/playwright-skill/run.js /tmp/im-web-v3-20-history-audit.js
```

Result:

- Account: `18337488675` (`leng_test_updated`)
- Route: `/chat/conversation/cec409c5b5db4399a27358e76eb587b1/2`
- Target group sync starts: `0, 0, 1, 31, 61, 91, 101`
- Body included pre-23:00 content:
  - `@布偶猫  你好`
  - `协调人员给我做一个点餐小程序`
  - `还是个人练习项目/演示 demo`
- File rows containing `ordering-demo.tar.gz` displayed with label/avatar fallback `布偶猫`, not `yunyi`.
- Console errors: `0`
- Page errors: `0`
- Failed requests: `0`
- Non-target conversations with `start_message_seq > 0`: `0`

Evidence files:

- `sections/im_web/.ai/V3.0/tests-e2e/v3-20-history-20260531000045/summary.md`
- `sections/im_web/.ai/V3.0/tests-e2e/v3-20-history-20260531000045/result.json`
- `sections/im_web/.ai/V3.0/tests-e2e/v3-20-history-20260531000045/group-history.png`

## Verification

Focused regression:

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/messageStoreDailyMessaging.test.ts tests/clowderMessagePresentation.test.ts tests/clowderMessageStore.test.ts tests/clowderStreamingMerge.test.ts tests/groupOfflineUnreadRetention.test.ts --config vitest.config.ts
```

Result: PASS, 5 files / 45 tests.

Required gates:

```bash
cd sections/im_web
pnpm type-check
pnpm test:unit
pnpm build
```

Results:

- `pnpm type-check`: PASS.
- `pnpm test:unit`: PASS, 57 files / 195 tests. Existing negative-path stderr from recovery/draft tests was expected; exit code was 0.
- `pnpm build`: PASS. Vite emitted the existing large chunk warning.

## Close Notes

Resolved. The active group chat now hydrates the visible history window instead of showing only the backend latest page, and background/reconnect sync avoids unnecessary historical pagination for unrelated conversations.
