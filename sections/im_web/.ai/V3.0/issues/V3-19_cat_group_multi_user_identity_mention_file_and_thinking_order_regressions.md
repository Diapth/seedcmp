# V3-19: Cat Group Multi-User Identity, Mention, File, And Thinking Order Regressions

## Status

Fixed and verified on 2026-05-30.

## Created

2026-05-30

## Labels

bug, clowder, cat-groups, multi-user, mention, media, streaming, ordering

## Priority

P0

## User Report

In a multi-user cat group chat, several regressions make the group hard to use and hard to reason about:

1. Different users see different avatars and ids for the same cat. In some cases a cat appears with a human user's avatar, so users cannot tell which participant sent a message.
2. `@` mention autocomplete only works when `@` is at the beginning of the input. If `@` is in the middle or at the end of text, the mention target popup does not appear. After selecting a concrete mention target, the popup can remain open instead of closing.
3. Clowder AI cats cannot send the intended file correctly. The chat receives a file path, file name text, or screenshot-like content rather than a usable file attachment/card.
4. After a user `@` mentions a cat, the cat's "thinking" message stays pinned at the deepest/bottom position. When another user sends a new message while the cat is still thinking, the new user message should push the thinking placeholder upward. When the cat finishes, the final reply should be sent normally without leaving a stale bottom-pinned thinking row.

Screenshots were supplied in chat on 2026-05-30. They show:

- Group rows where cat identity/avatars differ across accounts.
- `@布偶猫` working at the start of text but not reliably in other positions.
- File-send attempts producing `ordering-demo.tar.gz`, `/uploads/ordering-demo.tar.gz`, or screenshot/content text rather than a proper downloadable file message.
- A cat thinking row that does not move out of the newest-message position when later user messages arrive.

## Impact

- Multi-user group conversations become ambiguous because users cannot distinguish cats from humans or from each other.
- Group mention routing is unreliable unless users place `@` at the very beginning of the message.
- File collaboration through cats is effectively broken for generated archives and other attachments.
- Long-running cat replies distort timeline order. The group appears to show the cat thinking after newer user messages, even when the thinking state was triggered earlier.

## Related Issues

- V3-15 added Clowder cats as contacts, direct conversations, and group members.
- V3-17 fixed direct cat prompt/reply ordering when a user message rendered below an assistant reply.
- V3-18 implemented cat group routing, media, streaming, markdown-it tables, cat-only groups, and group cat membership.
- V2-13 and V2-16 covered earlier file URL/card regressions in non-Clowder media sends.

This issue tracks new live multi-user group regressions after the V3-18 implementation pass.

## Reproduction Notes

### 1. Cat Identity Mapping Differs Per User

1. Start or open a multi-user group that includes at least one connected Clowder cat.
2. Log in as two different real users who are members of the same group.
3. Have one user `@` a cat and wait for a cat reply.
4. Compare the message list and conversation list on both accounts.
5. Actual: the same cat may display with different ids/avatars, or a cat may render using a human user's avatar.
6. Expected: every account sees the same cat display name, stable cat id, and cat avatar/fallback avatar for the same cat message.

### 2. Mention Popup Only Works At Input Start

1. Open a group with human members and connected cats.
2. Type `@` as the first character.
3. Confirm the mention popup appears.
4. Clear or continue typing, then type text such as `你好 @` or `请 @布偶猫 看看`.
5. Actual: the mention popup does not appear, or does not track the mention query unless `@` starts the input.
6. Select a mention target when the popup does appear.
7. Actual: after target selection, the popup can remain open.
8. Expected: mention detection works at the beginning, middle, or end of the input, and selecting a target inserts the mention and closes the popup.

### 3. Cat File Delivery Is Not A Usable Attachment

1. In a group, ask a cat to package or send a file, for example a generated project archive.
2. Wait for the cat response.
3. Actual: the group receives a plain filename/path such as `ordering-demo.tar.gz` or `/uploads/ordering-demo.tar.gz`, or the cat sends screenshot/content text rather than a proper file message.
4. Expected: supported files render as durable IM file cards with filename, size when available, URL/download metadata, sender cat identity, and stable history behavior after refresh.

### 4. Thinking Placeholder Stays Bottom-Pinned

1. In a group, user A sends `@<cat> ...` and triggers a long-running cat response.
2. While the cat is still thinking, user A or user B sends another message.
3. Actual: the cat thinking placeholder stays at the deepest/bottom location and is not pushed up by the newer user message.
4. Expected: the thinking placeholder is sorted by its placeholder creation time and should move upward when newer user messages arrive. When the final cat reply arrives, it should replace/remove the placeholder according to the streaming merge contract without duplicate or stale thinking rows.

## Suspected Areas

```
sections/im_web/apps/chat/src/components/MessageInput.vue
sections/im_web/apps/chat/src/components/MessageList.vue
sections/im_web/packages/datasource-vue/src/stores/messageStore.ts
sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts
sections/im_web/packages/datasource-vue/src/stores/channelStore.ts
sections/im_web/packages/datasource-vue/src/stores/clowderCatContacts.ts
sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
sections/im/TangSengDaoDaoServer/modules/clowder/outbound.go
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
```

## Root Cause

- Clowder group replies use a real WuKongIM sender as transport metadata. `MessageList.vue` resolved the Clowder display name, but when the Clowder payload did not include an avatar it fell back to the transport user's cached avatar, so a cat could visually wear a human user's avatar.
- Follow-up Clowder attachment/media rows can arrive as separate connector messages with `connectorId: im-web` but without repeated `catDisplayName` metadata. Those rows were still connector messages, but the sender label fell back to the transport user, so a file card sent by `布偶猫` could render as `yunyi`.
- `MessageInput.vue` mention detection only considered `@` at the beginning or after whitespace. The watcher also re-opened the popup immediately after `selectMember()` changed `inputText`, so choosing a target could leave the popup visible.
- Clowder file rich blocks with a local upload path were delivered to the IM Web adapter with `absPath` but without a browser-usable `url`. The TangSeng callback contract can render file cards from URL metadata, so missing URL caused downstream filename/path text fallback.
- `messageStore.ts` always forced active Clowder thinking placeholders after any nearby non-assistant message in a group. That made the placeholder act bottom-pinned even when the nearby message was a newer unrelated human message rather than the original prompt.

## Fix Record

- `sections/im_web/apps/chat/src/components/MessageList.vue`
  - Clowder connector messages no longer fall back to `userStore.userCache[msg.fromUID].avatar` when no cat avatar is present. They render through the stable Clowder name plus deterministic fallback avatar instead of a human avatar.
  - Follow-up connector rows without repeated cat metadata now inherit nearby Clowder cat sender context when adjacent messages come from the same transport sender in the same short time window. This keeps file cards such as `ordering-demo.tar.gz` labeled as `布偶猫`.
- `sections/im_web/apps/chat/src/components/MessageInput.vue`
  - Added caret-based active mention token detection so `@` works at the start, middle, and end of a group draft.
  - Mention selection now replaces only the active token, restores the caret, clears the query, and suppresses the watcher once so the popup stays closed.
- `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
  - Group placeholder ordering now only applies the prompt-before-placeholder special case when the neighboring user message looks like the prompt for that placeholder's cat. Newer unrelated user messages sort normally below the older thinking row.
- `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts`
  - File rich blocks now include `url: resolveInternalRouteUrl(fileUrl)` alongside `absPath` and filename when sent to the IM Web adapter, preserving proper file attachment metadata for the bridge.

## Acceptance Criteria

- Cat identity is deterministic across accounts in the same group:
  - same cat id
  - same display name
  - same avatar or fallback avatar
  - no cat message renders with a human user's avatar unless it is explicitly shown as transport/debug metadata outside the main sender identity.
- Mention autocomplete works for `@` at the start, middle, and end of the input, based on the caret's active token.
- Selecting a mention target inserts the correct mention text/id, closes the popup, clears the mention query, and preserves the rest of the draft text.
- Cat-sent supported files render as file message cards, not plain paths or filename-only text bubbles.
- File cards remain correct after refresh/history sync and keep cat sender metadata.
- Thinking placeholders are not bottom-pinned:
  - newer user messages appear below an earlier thinking placeholder.
  - final cat replies remove or merge the placeholder without duplicates.
  - refresh/reconnect preserves the same order and does not resurrect stale thinking rows.
- The fix includes focused regression tests for identity mapping, mention parsing/closing, file outbound normalization, and group placeholder ordering.

## Regression Coverage Added

- `sections/im_web/apps/chat/tests/clowderMessagePresentation.test.ts`
  - Covers a group Clowder cat reply sent through a human transport sender with no cat avatar and verifies the rendered avatar does not use the human cached avatar.
  - Covers a follow-up connector attachment message without repeated cat metadata and verifies it still renders as the nearby Clowder cat (`布偶猫`) instead of the transport user.
- `sections/im_web/apps/chat/tests/clowderAiContactRouting.test.ts`
  - Covers mention popup visibility for `@` in the middle/end of group drafts.
  - Covers selecting a mention target and verifies the popup closes after insertion.
- `sections/im_web/apps/chat/tests/clowderStreamingMerge.test.ts`
  - Covers a user prompt, an older Clowder thinking placeholder, and a newer human message, expecting the newer message to push the placeholder upward.
- `/media/leng/DiskB1/exp/clowder-ai/packages/api/test/outbound-delivery-hook.test.js`
  - Covers file rich-block delivery and verifies the IM Web adapter receives both `url` and `absPath`.

## Verification Results

Automated red/green:

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/clowderMessagePresentation.test.ts tests/clowderStreamingMerge.test.ts tests/clowderAiContactRouting.test.ts --config vitest.config.ts
```

Result: PASS, 3 files / 26 tests.

Follow-up sender-context regression:

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/messageStoreDailyMessaging.test.ts tests/clowderMessagePresentation.test.ts tests/clowderMessageStore.test.ts tests/clowderStreamingMerge.test.ts tests/groupOfflineUnreadRetention.test.ts --config vitest.config.ts
```

Result: PASS, 5 files / 45 tests.

```bash
cd sections/im_web
pnpm type-check
pnpm test:unit
pnpm build
```

Results:

- `pnpm type-check`: PASS.
- `pnpm test:unit`: PASS, 57 files / 195 tests.
- `pnpm build`: PASS. Vite emitted the existing chunk-size warning for the large app bundle.

Clowder connector verification:

```bash
cd /media/leng/DiskB1/exp/clowder-ai/packages/api
pnpm build
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/outbound-delivery-hook.test.js
```

Results:

- `pnpm build`: PASS.
- `outbound-delivery-hook.test.js`: PASS, 30 tests.

Browser smoke:

```bash
TARGET_URL=http://localhost:3002 node /home/leng/.codex/skills/playwright-skill/run.js /tmp/playwright-v3-19-mention-smoke.js
```

Result: PASS. The smoke logged in, opened the group chat, verified a middle-position `@` opens the mention popup, selected a target, and verified the popup closes.

Evidence:

- `sections/im_web/assets/screenshots/v3-19-mention-smoke-20260530153114-middle.png`
- `sections/im_web/assets/screenshots/v3-19-mention-smoke-20260530153114-selected.png`
- `sections/im_web/assets/screenshots/v3-19-mention-smoke-20260530153114-result.json`

Note: the browser smoke was intentionally non-sending and only mutated the draft field, then cleared it. File delivery and placeholder ordering were verified by focused unit/connector tests rather than by sending another live cat file into the shared group.

Follow-up browser evidence for account `18337488675` and group `集群`:

- `sections/im_web/.ai/V3.0/tests-e2e/v3-20-history-20260531000045/summary.md`
- `sections/im_web/.ai/V3.0/tests-e2e/v3-20-history-20260531000045/result.json`
- `sections/im_web/.ai/V3.0/tests-e2e/v3-20-history-20260531000045/group-history.png`

The audit found all visible `ordering-demo.tar.gz` file rows labeled `布偶猫` with `布` fallback avatar text.

## Close Notes

Resolved. The four reported regressions are covered by focused automated tests, IM Web type/unit/build gates, Clowder connector build/test gates, and a non-sending browser smoke for the mention popup behavior.
