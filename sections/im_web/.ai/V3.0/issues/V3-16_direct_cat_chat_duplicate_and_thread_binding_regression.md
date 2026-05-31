# V3-16: Direct Cat Chat Duplicates Sends And Routes Replies To Clowder AI

## Status

Implemented and verified on 2026-05-30.

## User Report

In a `布偶猫` direct chat, sending `你好` displays two outgoing messages at once. The Clowder reply is delivered in the `Clowder AI` conversation instead of the `布偶猫` conversation, and the reply says `当前没有绑定的 thread，请先发送消息创建 thread。`

Screenshots supplied in chat on 2026-05-30 show:

- `布偶猫` direct conversation with two identical outgoing `你好` bubbles.
- `Clowder AI` conversation receiving a command-style error response while the cat direct chat remains without the cat reply.

## Acceptance Criteria

- Sending one text message in a direct cat conversation creates one visible outgoing user message.
- Direct cat messages must route as normal connector messages that can auto-create a thread, not as `/ask` commands that require an existing binding.
- Direct cat routing must still target the selected cat.
- Clowder replies for direct cat conversations must return to that cat conversation, not the generic `Clowder AI` conversation.
- Direct cat conversations should display the cat-facing name (for example `布偶猫`) instead of raw routing IDs such as `opus` or `clowder_cat:opus`.
- Browser evidence must cover the duplicate-send and direct-cat-reply path.

## Notes

This is a regression follow-up to V3-15.

## Root Cause

Two regressions combined into the user-visible failure:

- Direct-cat bridge messages were rewritten as `/ask <cat> ...`. Clowder treats `/ask` as a command path that requires an already bound thread, so first-time direct cat messages returned `当前没有绑定的 thread，请先发送消息创建 thread。` and the response surfaced under the generic `Clowder AI` command conversation.
- After the local optimistic IM send, the UI immediately or quickly synced server history. The persisted IM message can return with the SDK/server `client_msg_no` instead of the web optimistic `clientMsgNo`, so the history merge treated it as a second outgoing row.
- In real-account verification with `18337488675`, the corrected normal connector route exposed a second server-side regression: outbound callbacks with `externalChatId` shaped like `1:<user>@clowder_cat:<cat>` were overwritten by `DefaultOwnerUserID` before the fake direct channel was resolved. That changed the outgoing sender back to `clowder_ai`, so the cat reply landed in the generic Clowder AI conversation.
- The same real-account history showed raw virtual cat IDs in the chat header/sidebar. `/conversation/sync` and `/users/clowder_cat:*` can preheat channel cache with `clowder_cat:opus`, while the current cat directory no longer contains `opus`; the only durable display clue in that history is the earlier streaming prefix `【布偶猫🐱】`.

## Fix

- `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`
  - Direct-cat and targeted group messages now use normal mention text (`@opus ...`) instead of `/ask`, allowing Clowder to auto-create/bind the thread through the normal connector route.
- `sections/im/TangSengDaoDaoServer/modules/clowder/outbound.go`
  - Resolves fake direct channels before applying the default recipient fallback.
  - Preserves virtual cat senders (`clowder_cat:<cat>`) when delivering outbound callbacks back to IM Web.
- `sections/im_web/apps/chat/src/components/MessageInput.vue`
  - Added a send guard to prevent re-entrant sends.
  - Moved Clowder bridge dispatch behind `sendClowderRouteMessage`.
  - Removed the immediate post-bridge `syncMessages`; delayed polling remains for eventual replies.
- `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
  - Added merge logic for persisted own messages that match a local optimistic row by sender/text/time even when server `client_msg_no` differs.
  - This keeps one visible outgoing bubble after delayed sync upgrades the optimistic row to the durable server message.
  - Derives direct-cat display names from cat metadata or earlier streaming prefixes, then updates the conversation summary and channel cache.
- `sections/im_web/packages/datasource-vue/src/stores/channelStore.ts`
  - Resolves virtual cat channel display before returning cached raw user records.
  - Loads the cat directory when the cache only knows a raw virtual cat ID.
- `sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts`
  - Tolerates empty cat-directory responses while preserving the local fallback path.
- `sections/im_web/apps/chat/vitest.config.ts`
  - Aligns Vitest extension resolution with Vite so TS sources win over stale generated `.js` siblings.
- Regression tests added/updated:
  - `sections/im_web/apps/chat/tests/clowderDirectCatSendRegression.test.ts`
  - `sections/im_web/apps/chat/tests/clowderMessageStore.test.ts`
  - `sections/im_web/apps/chat/tests/clowderAiContactRouting.test.ts`
  - `sections/im/TangSengDaoDaoServer/modules/clowder/proxy_test.go`
  - `sections/im/TangSengDaoDaoServer/modules/clowder/outbound_test.go`

## Browser Evidence

Command:

```bash
cd /home/leng/.codex/skills/playwright-skill && TARGET_URL=http://localhost:3000 node run.js /tmp/playwright-test-v3-16-direct-cat-regression.js
```

Result: exit 0, `PASS v3-16-direct-cat-regression-current`.

Accounts: `acct_a`, `acct_b`.

Checks:

- Account A direct-cat send renders one outgoing bubble.
- Account A delayed/persisted direct-cat history still keeps one outgoing bubble.
- Account A cat reply is visible in the `布偶猫` direct conversation.
- `Clowder AI` conversation does not receive the direct-cat error/reply.
- Account B direct-cat history is isolated from Account A.

Artifacts:

- `sections/im_web/.ai/V3.0/assets/screenshots/v3-16-direct-cat-regression-current-a-one-send.png`
- `sections/im_web/.ai/V3.0/assets/screenshots/v3-16-direct-cat-regression-current-a-direct-reply.png`
- `sections/im_web/.ai/V3.0/assets/screenshots/v3-16-direct-cat-regression-current-clowder-ai-clean.png`
- `sections/im_web/.ai/V3.0/assets/screenshots/v3-16-direct-cat-regression-current-b-direct-reply.png`
- `sections/im_web/.ai/V3.0/assets/screenshots/v3-16-direct-cat-regression-current-result.json`

The browser probe reproduced the duplicate outgoing row before the message-store merge fix, then passed after the merge fix.

### Real Account Evidence: `18337488675`

The user reported the mock/multi-account probe was insufficient, so the flow was retested against the real account `18337488675`.

Failed/partial artifacts kept for regression context:

- `sections/im_web/.ai/V3.0/assets/screenshots/v3-16-real-18337488675-20260530082524-result.json`
  - Before restarting the updated backend, the running server still sent `/ask`; `Clowder AI` received three historical `当前没有绑定的 thread` errors.
- `sections/im_web/.ai/V3.0/assets/screenshots/v3-16-real-18337488675-20260530082715-result.json`
  - After restarting the backend, direct-cat send was no longer duplicated and the `/ask` thread error was no longer created, but the final AI reply for `V3-16真实账号复测-1780129635323` still landed in `Clowder AI`.

Passing artifacts after the outbound fake-channel fix:

- `sections/im_web/.ai/V3.0/assets/screenshots/v3-16-real-18337488675-20260530083115-result.json`
  - Sent `V3-16真实账号复测-1780129875021` to `clowder_cat:opus`.
  - Direct cat visible send count: `1`.
  - Direct cat thread error count: `0`.
  - Clowder AI count for the new unique text: `0`.
- `sections/im_web/.ai/V3.0/assets/screenshots/v3-16-real-18337488675-inspect-20260530083205-result.json`
  - Read-only follow-up after the final callback completed.
  - Direct cat count for the unique text: `2` (`1` user message plus `1` final cat reply quoting the text).
  - Clowder AI count for the unique text: `0`.
  - Direct cat thread error count: `0`.
- `sections/im_web/.ai/V3.0/assets/screenshots/v3-16-real-cat-display-20260530084910-result.json`
  - Read-only real-account check after the display-name fix.
  - Header name: `布偶猫`.
  - Active sidebar conversation name: `布偶猫`.

Historical Clowder AI thread-error rows remain in the account history, but the final passing run did not add a new one.

## Verification

- `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderMessageStore.test.ts --config vitest.config.ts`
  - Result: exit 0; 1 file, 4 tests passed.
- `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderDirectCatSendRegression.test.ts tests/clowderRemoteDisplay.test.ts tests/clowderMessageStore.test.ts tests/clowderMessagePresentation.test.ts tests/clowderAiContactRouting.test.ts tests/clowderCatContacts.test.ts --config vitest.config.ts`
  - Result: exit 0; 6 files, 21 tests passed.
- `cd sections/im_web && pnpm test:unit`
  - Result: exit 0; 57 files, 163 tests passed.
  - Note: `recoveryFailureState` intentionally logs simulated unavailable backend errors while passing.
- `cd sections/im_web && pnpm type-check`
  - Result: exit 0.
- `cd sections/im_web && pnpm build`
  - Result: exit 0; Vite production build completed with the existing large chunk warning.
- `cd sections/im/TangSengDaoDaoServer && go test -count=1 ./modules/clowder`
  - Result: exit 0.
- `cd /home/leng/.codex/skills/playwright-skill && TARGET_URL=http://localhost:3000 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 node run.js /tmp/playwright-test-v3-16-real-18337488675.js`
  - Result: exit 0; final run `v3-16-real-18337488675-20260530083115`.
- `cd /home/leng/.codex/skills/playwright-skill && TARGET_URL=http://localhost:3000 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 TEST_MESSAGE='V3-16真实账号复测-1780129875021' node run.js /tmp/playwright-inspect-v3-16-real-18337488675.js`
  - Result: exit 0; read-only inspect run `v3-16-real-18337488675-inspect-20260530083205`.
- `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderMessageStore.test.ts tests/clowderContactEntry.test.ts --config vitest.config.ts`
  - Result: exit 0; 2 files, 12 tests passed.
- `cd /home/leng/.codex/skills/playwright-skill && TARGET_URL=http://localhost:3000 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 node run.js /tmp/playwright-inspect-v3-16-cat-display-name.js`
  - Result: exit 0; real-account display run `v3-16-real-cat-display-20260530084910`.
