# V3-10: Cross-device Draft Sync Leaves Sent Text And AI Messages Lack Core Actions

## Status

Resolved on 2026-05-29

## Severity

High

## Finding

IM Web still has three user-facing gaps in the Clowder/AI chat workflow:

1. When a browser on one IP sends text that had been saved as a draft, another logged-in browser on a different IP can still show the old draft in the send box instead of clearing it.
2. Clowder/AI messages do not expose the full visible thought/transcript output returned by Clowder. Tool-call rendering can be skipped for now, but the user-visible thinking/progress text should not be truncated or hidden.
3. AI messages do not yet support the expected message actions and media behavior: right-click copy, AI file sending, and image preview.

## Impact

- Users can accidentally resend already-sent text after switching devices or browsers.
- Long Clowder tasks are harder to audit because the visible thought/progress output is incomplete.
- AI chat feels inconsistent with normal IM messages because users cannot copy AI answers through the context menu, send files through AI/Clowder flows, or preview images returned or sent in the AI conversation.

## Expected

### Cross-device Draft Clearing

- Draft state must be keyed by conversation and cleared when the same draft text is successfully sent from any logged-in browser/device.
- After browser A sends the draft, browser B should clear the send box after sync/reconnect/conversation refresh.
- Clearing a sent draft must not delete unrelated unsent text typed later on browser B.

### Full Clowder Visible Thought Output

- AI/Clowder message rendering should show all available visible thought/transcript blocks returned by the connector.
- Tool calls may be omitted in this iteration.
- The UI must not expose hidden model chain-of-thought that is not present in the Clowder message payload; only returned/displayable transcript content should render.

### AI Message Actions And Media

- Right-clicking an AI message should expose a copy action and copy the AI message body.
- AI/Clowder conversations should support sending files through the existing IM file-send path or a compatible Clowder media fallback path.
- Images in AI/Clowder conversations should open in the existing image preview viewer.

## Reproduction

### Draft Sync

1. Log in to the same IM account in browser A and browser B from different IPs or browser contexts.
2. Open the same conversation.
3. Type a draft in browser A and let it persist.
4. Send that draft from browser A.
5. Open or refresh the same conversation in browser B.

Observed: browser B can still show the sent draft in the input box.

### AI Message Actions

1. Open `Clowder AI`.
2. Send a prompt that returns a multi-paragraph AI reply.
3. Right-click the AI reply.
4. Try to copy the message from the context menu.

Observed: copy is missing or not wired for AI messages.

### AI File And Image Preview

1. Open `Clowder AI`.
2. Send a file or image, or receive an image/media fallback from the AI flow.
3. Click the image/file cell.

Observed: file send and image preview behavior is incomplete or inconsistent with normal IM conversations.

## Acceptance

- A two-browser Playwright smoke proves draft text sent in browser A is cleared in browser B without clearing unrelated new text.
- A unit/store test proves sent-draft clear events are scoped to the correct `channelId` and `channelType`.
- A rendering test proves all visible Clowder thought/transcript blocks in the message payload are displayed, while tool calls may remain hidden.
- A UI test proves right-click copy works on AI messages.
- A media test proves AI/Clowder file sending reaches the existing send pipeline or a documented fallback.
- A browser smoke proves AI/Clowder images open in the preview viewer.

## Related Areas

- `sections/im_web/apps/chat/src/components/MessageInput.vue`
- `sections/im_web/apps/chat/src/components/MessageList.vue`
- `sections/im_web/packages/base-vue/src/components/messages/TextCell.vue`
- `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
- `sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts`
- `sections/im_web/packages/datasource-vue/src/api/clowder.ts`

## Resolution

- Cross-browser draft sync now applies remote empty draft values and `MessageInput` reacts to conversation draft changes without overwriting newer local typing.
- Clowder text rendering now includes visible thought/transcript aliases from message content and metadata. This only renders transcript fields present in the Clowder payload; it does not reveal hidden model chain-of-thought.
- AI/Clowder text messages can be copied from the right-click context menu, including visible transcript text.
- AI/Clowder conversations keep the existing media send pipeline enabled, and image messages emit preview events into the right-side preview dock.

## Verification Evidence

- Unit test command: `pnpm --filter chat test:unit -- clowderVirtualConversationDraft.test.ts clowderMessagePresentation.test.ts messageMediaCells.test.ts`
- Build command: `pnpm --filter chat build`
- Browser smoke command: `TARGET_URL=http://localhost:3000 HEADLESS=1 node run.js /tmp/playwright-test-v3-10-ai-actions.js`
- Browser smoke evidence: `sections/im_web/.ai/V3.0/tests-e2e/v3-10-ai-actions-20260529142706`
