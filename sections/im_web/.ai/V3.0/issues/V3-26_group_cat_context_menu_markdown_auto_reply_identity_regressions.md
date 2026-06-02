# V3-26: Group Cat Context Menu, Markdown, Auto Reply Context, Reply Identity, And Deploy Card Regressions

## Status

Implemented in working tree. Focused live browser audit against account `18337488675` and the `集群` group passed for cat mention, cat identity, message context menu, avatar context menu, and conversation context menu. Dedicated two-account Playwright smoke remains pending because the local run did not provide `RUN_V3_CLOWDER_SMOKE` and the full smoke environment variables.

## Created

2026-06-02

## Labels

bug, feature, clowder, cats, group-chat, context-menu, mention, markdown, auto-reply, identity, deploy-card

## Priority

P0

## User Report

The latest group cat chat path still has several user-visible regressions:

1. Right-click menus disappear almost immediately. The custom menu does not stay open and the browser native context menu can replace it. Right-click avatar mention only works when holding right-click and then left-clicking. If the user clicks `@TA` but that mention cannot be sent, the right-click-avatar `@` action can remain disabled forever.
2. Markdown rendering is adapted in direct chats, but not in group chats. When users speak in group conversations, markdown content still appears in the unadapted state.
3. Cats do not reliably respond based on group context. Example: after the group already contains a message such as `猫猫，请介绍自己`, the cat still cannot infer from the existing context that it should introduce itself and auto reply.
4. When a cat is replying and a human user suddenly sends another message, the in-progress or final cat reply can switch to that human user's avatar and display name instead of keeping the cat identity.
5. The markdown and wrong-name/avatar problems may be a loading or realtime-rendering issue, because after refreshing the page the same messages render markdown and cat identity correctly.
6. When a user has a deployment need, the chat should show a dedicated deployment card UI and require the user to confirm whether to deploy instead of treating deployment as a plain text reply or implicit action.

## Impact

- Group member avatar actions are unreliable and can become permanently disabled within the session.
- Users see inconsistent markdown behavior between direct and group chats.
- Group cat auto-reply feels non-contextual and misses obvious prompts from recent history.
- Cat replies can be visually attributed to the wrong human, which makes the transcript untrustworthy.
- Initial realtime rendering can disagree with refreshed history rendering, making the UI feel nondeterministic.
- Deployment intent can be missed or acted on ambiguously without an explicit confirmation surface.

## Related Issues

- `V3-25_clowder_cat_onboarding_context_menus_and_group_auto_reply.md` introduced the broader native context-menu and soft auto-reply product contract. This issue tracks regressions still visible after that work.
- `V3-18_cat_group_chat_mentions_context_media_and_markdown_it.md` covered group mentions and markdown-it behavior.
- `V3-19_cat_group_multi_user_identity_mention_file_and_thinking_order_regressions.md` covered multi-user group identity and mention regressions.
- `V3-21_clowder_cat_sender_name_false_slash_inference.md` and `V3-23_group_clowder_cat_state_and_digest_identity_recovery.md` covered earlier cat identity recovery problems.

## Reproduction Notes

1. Open a group chat with at least one human user and one Clowder cat.
2. Right-click another human member's avatar.
3. Observe whether the custom avatar menu remains open without holding the mouse button, whether the browser native context menu appears, and whether `@TA` can be clicked normally.
4. Click `@TA`, attempt to send, then retry avatar right-click if the mention send path fails.
5. Send or receive markdown content in the same group and compare rendering with a direct chat markdown message.
6. Put a recent message such as `猫猫，请介绍自己` in the group context, then verify whether the cat auto-reply policy can route a response without requiring a fresh manual `@`.
7. While a cat response is streaming or pending, send another human message from a different user and inspect the cat reply row's avatar/name before and after finalization and refresh.
8. Refresh the page after observing wrong markdown or wrong cat identity and compare the refreshed history row against the pre-refresh realtime row.
9. Ask a cat for deployment or provide deployment intent in a group conversation and verify whether a deployment confirmation card appears.

## Expected Behavior

- Custom right-click menus prevent the browser native menu, remain visible after `contextmenu`, and close only after a menu action, outside click, Escape, route change, or conversation change.
- Avatar `@TA` is a normal click action, does not require holding right-click, and never leaves the menu action permanently disabled after a failed send.
- Group markdown rows use the same safe markdown renderer, code/table/list styling, and containment rules as direct chats.
- Group cat auto-reply uses recent context, quoted/replied messages, and explicit or soft cat triggers to decide whether the cat should respond.
- A cat-authored placeholder, streaming chunk, final message, and recovered history row keep the same cat avatar/display name even if another human sends a message during the reply.
- Realtime message rows, streaming rows, finalized rows, and refreshed history rows use the same normalization path for markdown and cat identity.
- Deployment intent is represented by a structured deployment card with explicit confirm/cancel actions before any deployment operation is triggered.

## Acceptance Criteria

- Right-clicking a group member avatar opens the IM Web custom menu, suppresses the browser native context menu, and the menu stays open long enough to click actions normally.
- `@TA` inserts the correct mention token and mention UID for both `uid` and `member_uid` member shapes.
- If mention insertion or sending fails, the avatar `@TA` action resets to an enabled/retryable state after the failure is surfaced.
- Group markdown messages render with the same markdown component and safe formatting behavior as direct chat messages.
- Markdown rendering remains stable for cat replies, human messages, streamed replies, recovered history rows, and refreshed group history.
- Markdown and cat identity look correct before refresh and after refresh; a reload must not be required to repair rendering.
- A prior or recent group message like `猫猫，请介绍自己` can trigger the intended cat introduction response when group soft auto-reply is enabled and the target cat is unambiguous.
- Ordinary human-to-human messages still do not trigger cats unless the context policy says the conversation is continuing a cat thread.
- Cat reply identity is pinned from the Clowder/cat payload when the reply is created and is not overwritten by the most recent human sender while streaming, finalizing, syncing, or refreshing.
- Browser or Playwright smoke covers the interrupt case: user A triggers a cat reply, user B sends a message during the reply, and the cat row still shows the cat avatar/name.
- When the assistant detects deployment intent, it renders a deployment card in the message stream rather than only markdown/plain text.
- The deployment card clearly shows the target/project, environment or destination when known, current readiness/status, and confirm/cancel actions.
- Deployment is not executed until the user explicitly confirms from the deployment card.
- Cancelling or failing a deployment card returns the card to a retryable, non-stuck state and preserves the surrounding conversation context.

## Suspected Areas

```text
sections/im_web/apps/chat/src/components/MessageList.vue
sections/im_web/apps/chat/src/components/MessageInput.vue
sections/im_web/apps/chat/src/components/MessageBubble.vue
sections/im_web/apps/chat/src/components/MarkdownRenderer.vue
sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue
sections/im_web/apps/chat/src/views/ChatView.vue
sections/im_web/packages/base-vue/src/components/messages/CardCell.vue
sections/im_web/packages/datasource-vue/src/contentTypes/index.ts
sections/im_web/packages/base-vue/src/utils/clowderMessageIdentity.ts
sections/im_web/packages/datasource-vue/src/stores/messageStore.ts
sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts
sections/im_web/packages/datasource-vue/src/api/clowder.ts
sections/im/TangSengDaoDaoServer/modules/clowder
/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors
```

## Investigation Checklist

- Verify all `contextmenu` handlers call `preventDefault()` and `stopPropagation()` before menu state is updated.
- Check whether menu visibility is tied to `mouseup`, `blur`, or document click handlers that also fire for the opening right-click.
- Audit disabled/loading state for avatar mention actions and ensure `finally` resets transient state.
- Compare group message rendering branches against direct-chat branches and remove divergent markdown fallbacks.
- Inspect group context window construction for soft auto-reply and confirm it includes recent human messages before the current send.
- Trace cat identity fields from local placeholder creation through streaming chunk merge, final ACK, history sync, and conversation digest update.
- Confirm human messages arriving during cat streaming cannot become the "nearby identity" source for the cat row.
- Compare the realtime row normalization path with the post-refresh history hydration path, especially for markdown renderer selection and cat identity fallback.
- Decide whether deployment cards are a new message content type, a Clowder structured payload rendered by `MessageBubble`, or an extension of existing card message content.
- Ensure deployment card confirm/cancel actions are idempotent and cannot trigger duplicate deployments from double-clicks, refresh, or replayed websocket events.

## Regression Coverage Required

- Unit/component coverage for avatar context menu open, action click, native menu suppression, and disabled-state recovery.
- Unit coverage for mention payload normalization across `uid` and `member_uid`.
- Group markdown rendering test that uses the same markdown fixtures as direct chat.
- Auto-reply policy test for `猫猫，请介绍自己` using recent group context.
- Identity merge test where a cat streaming reply is interrupted by a later human message.
- Pre-refresh versus post-refresh rendering test for group markdown and cat identity.
- Deployment card component/store coverage for render, confirm, cancel, failure, retry, and duplicate-click guard.
- Playwright two-account smoke for avatar mention, group markdown, contextual cat reply, interrupted cat reply identity, and deployment card confirmation.

## Required Verification

```bash
cd sections/im_web
pnpm type-check
pnpm build
```

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/messageActions.test.ts tests/clowderMixedGroupPrompt.test.ts tests/clowderAiContactRouting.test.ts tests/clowderMessagePresentation.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

```bash
cd sections/im_web/apps/chat
pnpm exec playwright test tests-e2e/smoke-v3-clowder-multi-agent.spec.ts tests-e2e/smoke-v3-clowder-v2-regression.spec.ts --config playwright.config.ts --reporter=line
```

## Notes

Do not close this issue with only static/unit evidence. The context-menu disappearance and wrong avatar/name regression both require browser evidence because they depend on real DOM events, cross-user timing, and streaming/history merge order.

## 2026-06-02 Fix Record

### Root Causes

- Avatar/message context menus were opened on `mousedown.right`. The shared `ContextMenu` then registered a document `contextmenu` listener before the browser's real `contextmenu` event fired, so the just-opened custom menu could close immediately and the native browser menu could take over.
- Clowder group streaming merge replaced a local placeholder's content with the persisted final payload. When the final payload did not repeat `catId`, `catDisplayName`, avatar, or markdown flags, the realtime row lost cat identity until refreshed history hydration recovered it.
- Soft group auto-reply only considered the current input text, reply target, focus, and last active cat. It did not inspect recent unresolved human context such as an earlier `猫猫，请介绍自己`.
- Deployment intent had no structured confirmation surface in the message stream.
- Live group Clowder rows could carry stale explicit metadata such as `catDisplayName: Codex` even when the final text signature clearly identified `布偶猫/宪宪`. Presentation code preferred the stale explicit field before inspecting the text signature.
- Group mention candidates depended on synced group-cat membership. If that membership was empty or late, browser `@` mention could omit cats even though recent live Clowder messages showed the cat in the transcript.
- Avatar `@TA` treated Clowder connector messages as unmentionable because it used the transport `fromUID` rather than the virtual `clowder_cat:<catId>` contact id.

### Fix

- Removed right-click `mousedown` menu opening from `MessageList.vue`; custom menus now open from `contextmenu` only.
- Updated `ContextMenu.vue` to suppress native context menus while a custom menu is active and to close safely on later right-clicks.
- Added Clowder stream-content merge preservation in `messageStore.ts` so final streamed replies keep local placeholder cat identity, avatar, markdown, and connector metadata.
- Extended `resolveGroupCatAutoReplyTrigger()` with recent-message context and wired `MessageInput.vue` to pass the latest group transcript summary into the policy.
- Added deployment intent detection for Clowder/cat-routed messages. Deployment requests now insert a deployment confirmation card and do not route the deployment request to Clowder until the user confirms.
- Extended `CardCell.vue` to render deployment confirmation cards with target, environment, status, confirm, and cancel actions.
- Added `MessageList.vue` deployment-card handling so confirm sends an explicit Clowder confirmation route and cancel/failure keeps the card non-stuck.
- Updated Clowder cat display-name recovery so text signatures such as `布偶猫/宪宪 在此` beat stale explicit metadata like `Codex`.
- Added group mention fallback from recent Clowder messages when synced group-cat membership is empty, preserving cat mention candidates in the browser.
- Fixed single-`@` caret handling when the browser reports `selectionStart` as `0` during input.
- Changed Clowder avatar `@TA` to emit virtual cat mention ids such as `clowder_cat:ragdoll-kn9a` instead of disabling the action for connector messages.
- Added/kept JS sidecars for runtime alignment:
  - `sections/im_web/apps/chat/src/utils/clowderGroupAutoReplyPolicy.js`
  - `sections/im_web/apps/chat/src/utils/deploymentIntent.js`

### Files

```text
sections/im_web/apps/chat/src/components/MessageInput.vue
sections/im_web/apps/chat/src/components/MessageList.vue
sections/im_web/apps/chat/src/utils/clowderGroupAutoReplyPolicy.ts
sections/im_web/apps/chat/src/utils/clowderGroupAutoReplyPolicy.js
sections/im_web/apps/chat/src/utils/deploymentIntent.ts
sections/im_web/apps/chat/src/utils/deploymentIntent.js
sections/im_web/apps/chat/tests/clowderGroupAutoReplyPolicy.test.ts
sections/im_web/apps/chat/tests/clowderAiContactRouting.test.ts
sections/im_web/apps/chat/tests/clowderMessagePresentation.test.ts
sections/im_web/apps/chat/tests/clowderStreamingMerge.test.ts
sections/im_web/apps/chat/tests/deploymentCard.test.ts
sections/im_web/apps/chat/tests/messageActions.test.ts
sections/im_web/packages/base-vue/src/components/ContextMenu.vue
sections/im_web/packages/base-vue/src/components/messages/CardCell.vue
sections/im_web/packages/datasource-vue/src/stores/messageStore.ts
```

### Verification

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/messageActions.test.ts tests/clowderMixedGroupPrompt.test.ts tests/clowderAiContactRouting.test.ts tests/clowderMessagePresentation.test.ts tests/clowderStreamingMerge.test.ts tests/clowderGroupAutoReplyPolicy.test.ts tests/deploymentCard.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

Result: 7 files / 82 tests passed. The run still prints expected jsdom 401 noise from component mount attempts to fetch unauthenticated channel/group APIs; assertions passed.

```bash
cd sections/im_web
pnpm type-check
```

Result: passed.

```bash
cd sections/im_web
pnpm build
```

Result: passed. Existing Vite CJS deprecation and chunk-size warnings remain.

```bash
cd /home/leng/.codex/skills/playwright-skill
node run.js /tmp/im-web-v3-26-final-browser.js
```

Result against `http://localhost:3001/`, account `18337488675`, `集群` group:

- `@` button opened 16 mention candidates, including `布偶猫`.
- Picking `布偶猫` inserted `@布偶猫 ` into the textarea.
- The last Clowder cat row rendered as `布偶猫`, including the avatar fallback, sender label, Clowder metadata, and markdown body; stale `Codex` identity was not shown.
- Right-clicking the last cat avatar opened `@TA` with class `context-menu-item` and no disabled class.
- Clicking avatar `@TA` inserted `@布偶猫 ` into the textarea.
- Screenshot: `/tmp/im-web-v3-26-final-browser.png`.

```bash
cd /home/leng/.codex/skills/playwright-skill
node run.js /tmp/im-web-v3-26-audit-short.js
```

Result against `http://localhost:3001/`, account `18337488675`, `集群` group:

- Last visible cat row showed `布偶猫` instead of `Codex`.
- Message row right-click menu opened with `复制`, `设为置顶`, `查看回执`, `提醒暂不可用`, `引用回复`, `本地删除`, `双向删除`.
- Last cat avatar right-click menu opened with enabled `@TA`.
- `@` mention popup opened with 16 candidates including `布偶猫`.
- Conversation right-click menu opened with `置顶`, `消息免打扰`, `隐藏会话`, `删除会话`.
- Screenshot: `/tmp/im-web-v3-26-short-final.png`.

```bash
cd sections/im_web/apps/chat
pnpm exec playwright test tests-e2e/smoke-v3-clowder-multi-agent.spec.ts tests-e2e/smoke-v3-clowder-v2-regression.spec.ts --config playwright.config.ts --reporter=line
```

Result: 2 skipped because `RUN_V3_CLOWDER_SMOKE` and live backend/Clowder environment variables were not set.

### Remaining Evidence Needed

- Run the dedicated live V3 Clowder smoke with two accounts, a configured group, and all `RUN_V3_CLOWDER_SMOKE` environment variables enabled.
- Capture the remaining two-account-only evidence for interrupted cat reply identity across simultaneous users and deployment card confirm/cancel behavior.
