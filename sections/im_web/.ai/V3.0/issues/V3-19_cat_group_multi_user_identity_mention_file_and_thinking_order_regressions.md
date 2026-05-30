# V3-19: Cat Group Multi-User Identity, Mention, File, And Thinking Order Regressions

## Status

Open.

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

## Initial Analysis

Root cause is not confirmed yet. Likely failure modes to investigate:

- Cat group outbounds may still use a real group member as the WuKongIM transport sender, and some UI paths may fall back to that transport user's avatar/id instead of Clowder cat metadata.
- Cat identity inference may depend on each viewer's local channel/contact cache, causing different users to resolve the same cat message differently.
- Mention parsing may use a regex or cursor check that only recognizes `@` at the beginning of the input, instead of the active token before the caret.
- Mention selection state may not reset `mentionVisible`, query text, selected index, or composition/caret state after insertion.
- Clowder outbound file normalization may be receiving text-only file references, relative `/uploads/...` paths, or unsupported media block shapes and falling back to text instead of a file content type.
- Group stream/thinking placeholder sorting may treat active placeholders as bottom-pinned assistant rows instead of normal timestamped rows, or may merge persisted placeholders/finals using a sort key that ignores newer human messages.

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

## Suggested Regression Coverage

- Add a store/presentation test proving the same Clowder group message resolves the same cat identity for two simulated viewers with different local human user/channel caches.
- Add `MessageInput` tests for mention detection in:
  - `@布偶猫 你好`
  - `你好 @布偶猫`
  - `请 @布偶猫 看看`
  - trailing `你好 @`
- Add a mention selection test that verifies the popup closes after target insertion.
- Add bridge/outbound tests for file media blocks and text-only file references, including relative `/uploads/...` URLs if those are expected from Clowder.
- Add `messageStore` sorting tests where:
  - user prompt at T1 creates thinking placeholder at T2.
  - another user message arrives at T3.
  - the list order is prompt, thinking placeholder, newer user message.
  - final reply at T4 removes/merges the placeholder without leaving stale rows.

## Verification Plan

1. Reproduce with two live browser accounts in the same group.
2. Capture before/after screenshots under `assets/screenshots/`.
3. Run focused Vitest coverage for the touched store/component contracts.
4. Run:

```bash
cd sections/im_web && pnpm type-check
cd sections/im_web && pnpm build
```

5. If bridge code changes:

```bash
cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder
```

6. If Clowder connector behavior changes:

```bash
cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build
```

## Close Notes

Pending.
