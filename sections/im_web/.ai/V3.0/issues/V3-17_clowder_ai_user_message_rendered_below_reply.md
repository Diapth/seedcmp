# V3-17: Clowder AI User Message Can Render Below Assistant Reply

## Status

Fixed and verified on 2026-05-30.

## User Report

In a direct conversation with `布偶猫`, and possibly with other Clowder AI members, the visible message order can invert: the user's outgoing message is rendered lower in the message list than the AI response/thinking row that it triggered.

Screenshot supplied in chat on 2026-05-30 shows:

- The conversation timestamp reads `今天 16:51`.
- A `布偶猫` Clowder thinking card appears near the upper-left of the message area with `【布偶猫🐱】 🫢 思考中...`.
- The user's outgoing `你好` bubble appears to the right, but visually below the AI thinking card.

Expected behavior: the user's prompt should appear before the assistant thinking, streaming, or final reply in the conversation timeline.

## Impact

The inverted order makes it look like the AI started replying before the user sent the message. This is especially confusing in direct cat chats because the assistant thinking card is visually tied to the user's prompt and should preserve conversational causality.

## Related Issues

- V3-16 fixed duplicate direct-cat sends and replies being routed to `Clowder AI`.
- This issue is a separate ordering/rendering regression: even when the message routes to the direct cat conversation, the message list can display the assistant row above the triggering user row.

## Initial Investigation Notes

Likely areas to inspect:

- Message sorting and merge rules in `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`.
- Rendering order in `sections/im_web/apps/chat/src/components/MessageList.vue`.
- Direct-cat send and Clowder bridge timing in `sections/im_web/apps/chat/src/components/MessageInput.vue`.
- Timestamp and sequence fields for optimistic user messages, SDK self-echoes, persisted history rows, and Clowder thinking/streaming placeholder rows.

The suspected failure mode is that the Clowder thinking/assistant row can receive a sort key that places it before the optimistic or persisted user row, especially when bridge callbacks, SDK ACK/self-echo, and history sync arrive close together or out of order.

## Root Cause

`messageStore.sortMessagesForChannel()` sorted most conversations by confirmed `messageSeq` first, treating local optimistic messages with `messageSeq = 0` as `Infinity`.

In direct Clowder cat/member conversations, the user's outgoing prompt can still be a local optimistic row while the Clowder thinking or assistant row has already arrived from history/realtime with a positive `messageSeq`. The sequence-first comparator then placed the assistant row above the user row even when the assistant row had a later timestamp.

The existing DeepSeek direct AI conversation already used a time-first ordering guard for this kind of local-AI flow. Clowder direct AI conversations had not been included in that guard.

## Fix

- `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
  - Added `isAiDirectChannel()` for direct AI timelines:
    - `deepseek_ai_robot`
    - `clowder_ai` / legacy `clowder:*`
    - `clowder_cat:*`
  - Direct AI timelines now sort by timestamp first.
  - When two rows share a timestamp, user rows sort before AI assistant rows.
  - Non-AI/non-Clowder conversations keep the existing sequence-first ordering.
- `sections/im_web/apps/chat/tests/clowderMessageStore.test.ts`
  - Added a regression where a pending direct-cat prompt and a persisted Clowder thinking row are present together.
  - The test failed before the fix with order `思考中...`, then `你好`, and passes after the fix with `你好` first.

## Acceptance Criteria

- In a direct `布偶猫` conversation, sending one text message always renders the outgoing user bubble before any Clowder thinking, streaming, or final assistant row triggered by that text.
- The same ordering guarantee applies to other Clowder AI member direct conversations.
- Refresh, reconnect, and delayed history sync preserve the same user-then-assistant order.
- Ordering remains stable when optimistic messages are upgraded to persisted messages or merged with SDK self-echo/history rows.
- The fix does not reintroduce duplicate outgoing messages or route direct-cat replies back to the generic `Clowder AI` conversation.
- Browser evidence includes a direct-cat send where the user prompt and assistant thinking/final reply are visible in the correct order.

## Suggested Regression Coverage

- Add or extend a Vitest regression around message-store sorting/merge when a user optimistic row and Clowder assistant placeholder have close or conflicting timestamps.
- Add browser smoke coverage for a direct cat send, asserting the visible vertical order is user message first, assistant thinking/final row second.

## Verification

- Red test before fix:
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderMessageStore.test.ts --config vitest.config.ts`
  - Result: exit 1; new V3-17 regression failed with received order `['【布偶猫🐱】🤔 思考中...', '你好']`.
- Targeted regression after fix:
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderMessageStore.test.ts --config vitest.config.ts`
  - Result: exit 0; 1 file, 8 tests passed.
- Related message tests:
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderMessageStore.test.ts tests/clowderMessagePresentation.test.ts tests/messageActions.test.ts --config vitest.config.ts`
  - Result: exit 0; 3 files, 37 tests passed.
- Type check:
  - `cd sections/im_web && pnpm type-check`
  - Result: exit 0.
- Build:
  - `cd sections/im_web && pnpm build`
  - Result: exit 0; Vite build completed with the existing large chunk warning.
- Unit suite:
  - `cd sections/im_web && pnpm test:unit`
  - Result: exit 0; 57 files, 168 tests passed.
  - Note: `recoveryFailureState` intentionally logs simulated unavailable backend errors while passing.
- Browser evidence:
  - Started Vite locally at `http://127.0.0.1:3000`.
  - Command: `cd /home/leng/.codex/skills/playwright-skill && TARGET_URL=http://127.0.0.1:3000 node run.js /tmp/playwright-test-v3-17-direct-cat-order.js`
  - Result: exit 0; `PASS v3-17-direct-cat-order-20260530090031`.
  - Screenshot: `assets/screenshots/v3-17-direct-cat-order-20260530090031.png`
  - Result JSON: `assets/screenshots/v3-17-direct-cat-order-20260530090031-result.json`
  - Browser measured prompt row `y = 120.640625` and Clowder thinking row `y = 169.640625`, confirming the user prompt renders above the assistant thinking row.
