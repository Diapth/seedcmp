# V3-18: Cat Group Chats Need Cat-Only Creation, @ Routing, Context, Media, Streaming, And Markdown-It Tables

## Status

Implemented and verified on 2026-05-30.

Live cat-only group bridge smoke was run on `http://100.79.157.76:3000` with account `18337488675`. Verification uses focused IM Web unit/contract coverage, TangSeng bridge contract coverage, Clowder command-layer coverage, build/type gates, markdown rendering evidence, and browser screenshots of a real cat group reply landing in group history with cat sender attribution, correct prompt/reply order, `@` cat autocomplete before opening group details, group member cat add/remove controls, and the required cat runtime platform selector.

## User Report

User wants IM Web cat group chats to support the following product behavior:

1. When creating a group chat for cats, inviting real human members should be optional.
2. Inside a cat group chat, users can `@` a cat to make that specific cat reply.
3. The mentioned cat must be able to read the full group chat context, not only the latest mention text.
4. Other real human group members can also `@` cats and trigger cat replies.
5. Cats can send files, images, and text content in the group chat.
6. Cat streaming output must be adapted for group chat.
7. Markdown table rendering is currently broken. The supplied screenshot shows a pipe table rendered as plain paragraphs. Replace the hand-written markdown renderer with `markdown-it` by installing the npm package instead of extending the custom parser.

Screenshot supplied in chat on 2026-05-30 shows:

- A `Clowder` message introducing a `Cat Cafe 大家庭`.
- A markdown table for cat members rendered as raw pipe text:
  - `| 猫猫 | 模型 | 擅长 |`
  - `|------|------|------|`
  - rows such as `| Codex @codex | DeepSeek V4 Flash | 架构设计、写代码一把好手 |`
- The expected behavior is a real markdown table with readable columns, borders, spacing, and wrapping inside the message bubble.

## Impact

Cat group chats are currently limited by assumptions from mixed human/cat groups and direct cat routing:

- Users cannot create a cat-only group without selecting a real person.
- Group `@` routing is incomplete unless it can target cats from both the creator and other human members.
- Cat replies risk losing prior group context, which makes multi-turn group collaboration unreliable.
- Streaming replies may duplicate, reorder, or finalize incorrectly in a group timeline unless explicitly covered.
- Cat-generated rich output is incomplete if files/images/text are not delivered through the group path.
- Broken markdown tables make Clowder team introductions and structured responses hard to read.

## Root Cause

Several V3 cat paths were present but stopped short of the product behavior required here:

- `CreateGroupPage.vue` allowed selecting connected Clowder cats, but still enforced at least one invited real human contact before creating the group.
- TangSeng `groupReq.Check()` and `groupCreate()` also rejected empty `members`, even though a cat-only group should still create a real TangSeng group with the current user as creator and the cats synced through the Clowder cat-membership side channel.
- Group `@cat` routing could send `targetCatIds`, but the prompt context was only the static group prompt from cat sync. It did not include a recent group transcript with sender attribution at send time.
- Clowder outbound media normalized images, but `media.type = file` still fell through as a text payload instead of a durable file message.
- `renderMarkdown()` was a hand-written line parser, so markdown pipe tables were emitted as plain `<p>| ... |</p>` rows.
- Live bridge smoke exposed one additional group-delivery issue: WuKongIM group channels do not include virtual `clowder:<cat>` senders in the group subscriber datasource, so outbound group replies sent from the virtual cat UID were accepted by TangSeng but did not appear in group history. WuKongIM request-scoped `subscribers` are only valid for `sync_once` temporary command sends, so the durable group fix must use a real group member as the transport sender while preserving cat identity in the payload/UI.
- After using a real member transport sender, final Clowder replies without explicit `catDisplayName` still displayed as the transport user in group UI. The frontend only inferred cat identity from explicit fields or `【猫名】` prefixes, while the live final reply carried its cat marker as a trailing `[布偶猫/...]` suffix.
- The group chat input did not load durable Clowder group-cat membership on conversation open or before showing the `@` popup. The state was usually loaded only after opening group settings/member details, which explained the intermittent "cat appears after opening group details" behavior.
- Streaming placeholder rows from Clowder could arrive as persisted connector messages with server-generated `client_msg_no` values, so `messageStore` did not treat them as stream merge candidates. In group timelines the placeholder could remain above the human prompt until a later sync.
- Existing group member pages listed and removed cat members, but had no add-cat action. The same page also used a narrower role check than the group drawer, so owner/admin actions could be hidden if `groupInfo` lacked the expected role shape.
- Group settings still exposed only `邀请成员` in the quick-action area. That action is for real TangSeng users and opens UID/phone search, so adding cats was discoverable only through `群成员 -> 查看全部 -> 添加猫猫`.
- Live final reply text also appeared in an inline slash-signature form such as `布偶猫/宪宪已收到... [宪宪/deepseek...]`, which the first suffix-only identity inference did not parse.
- Direct cat conversation summaries and channel cache still only trusted explicit cat display metadata or earlier stream prefixes. When a direct cat final reply only carried the cat marker as a trailing `[宪宪/deepseek-v4-flash🐾]` suffix, the header/list title could fall back to the raw cat id `opus` while the message bubble showed `宪宪`.
- The IM Web "新增猫猫" console did not expose Clowder's required runtime platform. TangSeng therefore sent `/cats new <name> <alias>` without `--platform codex|claude-code`, and Clowder's cat creator picked an arbitrary template cat instead of creating a Codex/OpenAI or Claude Code/Anthropic backed cat. Cats created through that path could be connected in the UI but had no reliable runtime identity for replies.

## Fix

- `sections/im_web/packages/base-vue/src/utils/markdown.ts`
  - Replaced the custom parser with `markdown-it`.
  - Preserved safe default rendering with raw HTML disabled.
  - Kept existing fenced code block wrappers, copy buttons, and HTML preview action for fenced `html` blocks.
  - Kept external links opening with `target="_blank"` and `rel="noopener noreferrer"`.
- `sections/im_web/packages/base-vue/src/components/messages/TextCell.vue`
  - Added markdown table styling for message bubbles with visible borders, wrapping, and horizontal overflow containment.
- `sections/im_web/apps/chat/src/components/ChatSidePreview.vue`
  - Added matching table styling for markdown side preview.
- `sections/im_web/apps/chat/src/views/CreateGroupPage.vue`
  - Removed the frontend requirement for at least one invited real human member.
  - Cat-only groups still require a group name and at least one selected member; the current user remains the real group creator.
- `sections/im/TangSengDaoDaoServer/modules/group/api.go`
  - Allowed `/v1/group/create` with an empty `members` list.
  - Still validates non-empty invited-member lists against friend rules when members are provided.
  - The creator is appended as the real group member after validation, enabling creator + cats groups.
- `sections/im_web/apps/chat/src/components/MessageInput.vue`
  - Added `buildClowderPromptContext()` for group Clowder sends.
  - The context now combines the durable group prompt, target cat ids, current message, and the last 12 visible group messages with sender names/cat display names.
  - Added `ensureGroupMentionMembersLoaded()` so group human members and durable cat members are loaded when entering a group and before the `@` popup opens.
- `sections/im/TangSengDaoDaoServer/modules/clowder/outbound.go`
  - Added `media.type = file` normalization to WuKongIM file content with URL, filename, size, connector metadata, and cat sender metadata.
  - Added group virtual-cat outbound transport normalization: durable group replies from virtual Clowder senders now use the first real active group member as the WuKongIM transport sender, without request-scoped `Subscribers`, while preserving Clowder/cat metadata in the message payload.
- `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`
  - Loads active real group members for virtual-cat group outbound callbacks before sending the durable WuKongIM message.
- `sections/im_web/apps/chat/src/components/MessageList.vue`
  - Treats Clowder connector messages as assistant-side messages even when the transport `fromUID` is the current user.
  - Infers group cat sender labels from explicit metadata, `【猫名】` prefixes, direct-cat channel cache, final reply suffixes like `[布偶猫/宪宪 deepseek-v4-flash]`, and inline slash signatures like `布偶猫/宪宪已收到...`.
- `sections/im_web/packages/base-vue/src/components/messages/TextCell.vue`
  - Infers the Clowder bubble cat label from the same final reply suffix/inline slash formats, so the bubble badge shows the cat rather than generic `Clowder`.
- `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
  - Treats Clowder `stream.state = placeholder|chunk` group messages as stream merge candidates even when they were already persisted by the server.
  - Keeps a group Clowder thinking placeholder after the nearby human prompt, and merges placeholder/chunk/final into one durable assistant message.
  - Updates direct cat conversation summaries and channel cache from explicit metadata, earlier history, `【猫名】` prefixes, inline slash signatures, and trailing `[猫名/模型]` suffixes so the list/header identity does not fall back to the raw cat id.
- `sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts`
  - Applies the same direct cat display-name inference when creating or syncing conversation summaries directly from the last message payload.
- `sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts`
  - Added `addGroupCat()` and shared serialization for add/remove sync.
  - Rebuilds the durable group-cat prompt after group cat membership changes.
- `sections/im_web/apps/chat/src/views/GroupMemberList.vue`
  - Added connected-cat add control for existing groups.
  - Kept remove control and aligned owner/admin permission detection with the group settings drawer.
- `sections/im_web/packages/base-vue/src/components/GroupSettingsDrawer.vue`
  - Added a direct `添加猫猫` quick action for owners/admins, routing to the existing member management page where connected cats can be selected and added.
- `sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue`
  - Added a required `运行平台` selector with `Codex` and `Claude Code`.
  - Keeps `创建猫猫并连接` disabled until the user enters a name and chooses a platform.
  - Sends the selected `clientId` through the create-and-connect request.
- `sections/im_web/packages/datasource-vue/src/api/clowder.ts`
  - Made `clientId: 'openai' | 'anthropic'` required for `ClowderCreateCatRequest`.
- `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`
  - Accepts `clientId` / `platform`, normalizes `openai|codex` to `--platform codex` and `anthropic|claude|claude-code` to `--platform claude-code`.
  - Rejects create-cat requests without a platform using `platform_required`.
- `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts`
  - Requires `/cats new <猫名> [@别名] --platform codex|claude-code`.
  - Passes the normalized `clientId` into the injected cat creator instead of silently creating an unbound runtime cat.
- `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/infrastructure/connectors/ImWebCatCreator.ts`
  - Uses the requested `clientId` to choose a matching template cat, so Codex-created cats bind to the Codex/OpenAI runtime and Claude Code-created cats bind to the Anthropic runtime.
- Dependencies:
  - Added `markdown-it` to `@tsdaodao/base-vue`.
  - Added `@types/markdown-it` for `vue-tsc`.

## Regression Coverage Added

- `sections/im_web/apps/chat/tests/filePreviewVoiceAiContracts.test.ts`
  - `renderMarkdown()` renders pipe tables as `<table>`, `<thead>`, `<tbody>`, `<th>`, and `<td>`.
- `sections/im_web/apps/chat/tests/contactGroupCreationState.test.ts`
  - Cat-only group creation no longer contains the invited-human validation.
- `sections/im_web/apps/chat/tests/clowderMixedGroupPrompt.test.ts`
  - Store routing forwards `targetCatIds` and `promptContext`.
  - Message input builds group prompt context from prompt metadata and recent messages.
  - Existing groups can add connected cats and resync durable membership/prompt state.
- `sections/im/TangSengDaoDaoServer/modules/clowder/outbound_test.go`
  - Clowder file outbound payloads become WuKongIM file messages in group channels.
  - Virtual cat group outbounds choose a real group member transport sender and do not set request-scoped `Subscribers`.
- `sections/im_web/apps/chat/tests/clowderMessagePresentation.test.ts`
  - Group Clowder replies transported by the current user stay on the assistant side.
  - Final replies with only a `[猫名/...]` suffix or `猫名/代理名...` inline signature infer the cat sender name in both the message list and Clowder bubble badge.
- `sections/im_web/apps/chat/tests/clowderAiContactRouting.test.ts`
  - Group chat input loads durable cat membership before showing mention targets.
- `sections/im_web/apps/chat/tests/clowderStreamingMerge.test.ts`
  - Group Clowder thinking placeholders sort after the user question.
  - Persisted Clowder placeholders merge into the final streamed group reply.
- `sections/im_web/apps/chat/tests/clowderMessageStore.test.ts`
  - Direct cat list/header titles are derived from cat metadata, previous stream prefixes, and final reply suffixes such as `[宪宪/deepseek-v4-flash🐾]`.
  - Conversation creation from a final reply suffix also updates the channel cache, preventing `opus` title fallback after refresh/sync.
- `sections/im_web/apps/chat/tests/clowderGroupMemberList.test.ts`
  - Existing group member page exposes add/remove cat controls and owner/admin permission fallback.
  - Group settings drawer exposes a clear `添加猫猫` shortcut instead of making users discover it through `查看全部`.
- `sections/im_web/apps/chat/tests/clowderCatConsole.test.ts`
  - New-cat console exposes the required platform selector and forwards the narrowed `clientId`.
- `sections/im/TangSengDaoDaoServer/modules/group/api_test.go`
  - `groupReq.Check()` accepts empty members for creator-only/cat-side-channel groups.
- `sections/im/TangSengDaoDaoServer/modules/clowder/proxy_test.go`
  - `buildCreateCatCommand()` requires and normalizes the selected runtime platform.
- `/media/leng/DiskB1/exp/clowder-ai/packages/api/test/connector-command-layer-cats-new.test.js`
  - `/cats new` rejects missing platform and forwards `claude-code` as `clientId = anthropic`.
- `/media/leng/DiskB1/exp/clowder-ai/packages/api/test/connector-command-layer.test.js`
  - `/cats new` creates through the injected runtime cat creator with `clientId = openai` for Codex.

## Related Issues

- V3-15 added Clowder cats as contacts and mixed human/cat group members.
- V3-16 fixed direct cat duplicate sends, first-message thread binding, and reply routing.
- V3-17 fixed direct cat user/assistant ordering.
- This issue extends the V3 cat model from direct and mixed-group basics to cat-only and multi-human group collaboration.

## Requirements

### 1. Cat-Only Group Creation

- Group creation must allow selecting one or more connected cats with zero real human invitees beyond the current user.
- The current user remains the real owner/creator/admin of the TangSeng group.
- The group member model must distinguish:
  - real TangSeng members
  - virtual Clowder cat members
  - creator/admin ownership
- Empty groups are still invalid: at least one real current user or one selected cat must be present according to the product model.
- UI validation and backend bridge validation must not require an invited real contact when cats are selected.

### 2. Group @ Cat Routing

- Mention autocomplete in cat groups must include cats and humans.
- Sending `@<cat>` in a group must route to the corresponding Clowder cat.
- Routing must work for:
  - the group creator
  - other real human group members
  - groups with only creator + cats
  - mixed human/cat groups
- Multiple cat mentions in one message should either route deterministically to the mentioned cats or show a clear unsupported state if multi-target routing is not implemented in the first slice.
- Messages that mention no cat should preserve the existing group behavior and should not accidentally invoke a cat unless group focus/proactive policy explicitly allows it.

### 3. Full Group Context For Cats

- The inbound Clowder payload for group cat mentions must include enough context for the cat to understand the group conversation:
  - group id / external chat id
  - group display name
  - sender identity and display name
  - human members
  - cat members
  - mention targets
  - recent message history or a documented context window
- Context must include previous messages from all real users and cats in that group, subject to the chosen history/window policy.
- Context must preserve sender attribution so the cat can tell who said what.
- Refresh/reconnect/history sync must preserve the binding between the IM group and the Clowder thread.

### 4. Other Humans Can @ Cats

- Any real group member with permission should be able to mention a cat and receive a cat reply in the same group.
- The bridge must not hard-code routing to only the group creator.
- Replies should be delivered to the group timeline, not to the creator's direct cat conversation or the generic `Clowder AI` conversation.
- Sender attribution should show the correct cat identity in the group message list.

### 5. Cat Group Media Sending

- Cat outbound delivery in groups must support:
  - text
  - markdown text
  - images
  - files
- Unsupported Clowder rich blocks or unsupported file types must render a visible fallback rather than silently disappearing.
- Image/file messages sent by cats must use the same group timeline, sender identity, durable message normalization, and refresh behavior as text replies.
- Browser UI should display cat-sent image/file bubbles using existing IM Web media components where possible.

### 6. Group Streaming Output

- Streaming cat replies in group chats must update one visible assistant/cat message instead of appending one row per chunk.
- Finalization must merge the streaming placeholder/chunks into one durable message after refresh/reconnect.
- Streaming state must preserve group sender identity, target cat identity, and message ordering:
  - human prompt before cat thinking/stream/final row
  - no duplicate final message after history sync
  - no stream row leakage into `Clowder AI` or a direct cat conversation

### 7. Markdown-It Rendering

- Install `markdown-it` in the IM Web package that owns the renderer.
- Replace the custom hand-written markdown parsing in `sections/im_web/packages/base-vue/src/utils/markdown.ts` with `markdown-it`.
- Keep existing IM Web markdown affordances where still required:
  - HTML escaping / safe rendering
  - code block copy action
  - HTML preview action for fenced `html` code blocks
  - link handling consistent with current security expectations
- Markdown tables must render as `<table>` structures with usable styling in:
  - normal message bubbles
  - AI/cat message bubbles
  - streaming messages as chunks accumulate
  - markdown file preview / side preview if it shares the renderer
- Add CSS for markdown tables so columns are readable, borders are visible, long text wraps, and the table does not overflow narrow message bubbles.

## Suggested Delivery Order

1. Add failing markdown renderer tests for pipe tables, then introduce `markdown-it` and table styling.
2. Add group creation validation tests for creator + cats with no invited real contacts.
3. Add bridge/store tests for group `@cat` routing from creator and another human member.
4. Add context payload contract tests that prove group history and sender attribution are forwarded to Clowder.
5. Add group streaming merge tests for placeholder/chunk/final behavior.
6. Add media outbound contract/UI tests for cat-sent images and files in group timelines.
7. Run browser smoke for a cat-only group and a mixed group with two humans mentioning cats.

## Acceptance Criteria

- [x] A user can create a group that contains cat members without inviting any additional real human contact.
- [x] In that group, the creator can `@` a cat and route the request with the group prompt context.
- [x] Another real human member in a mixed group can `@` a cat through the same `targetCatIds` and group context route.
- [x] The cat receives group context with sender attribution and recent group history using a 12-message context window.
- [x] Cat text, markdown, image, and file outbound messages normalize for group chat.
- [x] Streaming cat replies in group chats render as one updating message and finalize into one durable message through existing Clowder stream merge coverage.
- [x] Markdown pipe tables render as actual tables instead of raw pipe paragraphs.
- [x] The markdown renderer uses `markdown-it`; no new custom table parser is introduced.
- [x] Existing direct cat behavior from V3-16 and V3-17 remains covered by related regression tests.
- [x] New cats cannot be created from IM Web without choosing Codex or Claude Code, and the selected platform reaches the Clowder runtime cat creator.

## Verification

- Red tests before fix:
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/filePreviewVoiceAiContracts.test.ts --config vitest.config.ts`
    - Result: exit 1; table test failed because output contained raw pipe paragraphs and no `<table>`.
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/contactGroupCreationState.test.ts --config vitest.config.ts`
    - Result: exit 1; cat-only test failed because `CreateGroupPage.vue` still contained `请选择至少一个真人联系人作为群成员`.
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderMixedGroupPrompt.test.ts --config vitest.config.ts`
    - Result: exit 1 after adding the message-input context test; `buildClowderPromptContext` was missing.
  - `cd sections/im/TangSengDaoDaoServer && go test -count=1 ./modules/clowder`
    - Result: exit 1 after adding file outbound coverage; file media still normalized as text.
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderMessagePresentation.test.ts --config vitest.config.ts`
    - Result: exit 1 after adding live-suffix identity coverage; the list displayed `Creator` and the bubble displayed `Clowder` instead of `布偶猫`.
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderAiContactRouting.test.ts tests/clowderStreamingMerge.test.ts tests/clowderMixedGroupPrompt.test.ts tests/clowderGroupMemberList.test.ts --config vitest.config.ts`
    - Result: exit 1 after adding the 2026-05-30 follow-up regressions; failures confirmed missing input-side group cat loading, missing existing-group add-cat API/UI, placeholder ordering above the user prompt, and placeholder/final duplication.
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderMessagePresentation.test.ts tests/clowderGroupMemberList.test.ts --config vitest.config.ts`
    - Result: exit 1 after adding the inline slash-signature and group-member permission regressions; final replies displayed `宪宪` instead of `布偶猫`, and the member page lacked the aligned owner/admin role fallback.
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderCatConsole.test.ts --config vitest.config.ts`
    - Result: exit 1 after adding platform coverage; the console did not contain `form.clientId` or platform choices.
  - `cd sections/im/TangSengDaoDaoServer && go test -count=1 ./modules/clowder -run TestBuildCreateCatCommandRequiresAndNormalizesClientPlatform`
    - Result: exit 1 after adding the platform command contract; `ClientID` and `buildCreateCatCommand` were missing.
  - `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/connector-command-layer-cats-new.test.js`
    - Result: exit 1 after adding missing-platform coverage; `/cats new 审查猫 @review` still created a cat instead of returning usage.
- Targeted tests after fix:
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/filePreviewVoiceAiContracts.test.ts tests/contactGroupCreationState.test.ts tests/clowderMixedGroupPrompt.test.ts tests/clowderMessageStore.test.ts tests/clowderMessagePresentation.test.ts --config vitest.config.ts`
    - Result: exit 0; 5 files, 37 tests passed.
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderMessagePresentation.test.ts tests/clowderMessageStore.test.ts tests/clowderMediaFallback.test.ts tests/markdownCopyFallback.test.ts tests/filePreviewVoiceAiContracts.test.ts --config vitest.config.ts`
    - Result: exit 0; 5 files, 33 tests passed.
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderMessageStore.test.ts --config vitest.config.ts`
    - Result: exit 0; 1 file, 10 tests passed after the direct cat `[宪宪/模型]` suffix title regression was added.
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderMessageStore.test.ts tests/clowderMessagePresentation.test.ts tests/clowderVirtualConversationDraft.test.ts --config vitest.config.ts`
    - Result: exit 0; 3 files, 31 tests passed.
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderGroupMemberList.test.ts --config vitest.config.ts`
    - Result: exit 0; 1 file, 2 tests passed after adding the group-settings `添加猫猫` shortcut coverage.
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderAiContactRouting.test.ts tests/clowderStreamingMerge.test.ts tests/clowderMixedGroupPrompt.test.ts tests/clowderGroupMemberList.test.ts tests/clowderMessagePresentation.test.ts --config vitest.config.ts`
    - Result: exit 0; 5 files, 30 tests passed.
  - `cd sections/im_web/apps/chat && pnpm exec vitest run tests/clowderCatConsole.test.ts tests/clowderGroupMemberList.test.ts --config vitest.config.ts`
    - Result: exit 0; 2 files, 4 tests passed after adding the platform selector and preserving the group settings add-cat shortcut.
  - `cd sections/im/TangSengDaoDaoServer && go test -count=1 ./modules/clowder`
    - Result: exit 0.
  - `cd sections/im/TangSengDaoDaoServer && go test -count=1 ./modules/clowder -run TestBuildCreateCatCommandRequiresAndNormalizesClientPlatform`
    - Result: exit 0.
  - `cd sections/im/TangSengDaoDaoServer && go test -count=1 ./modules/group -run TestGroupReqAllowsEmptyMembersForCreatorOnlyGroup`
    - Result: exit 0.
  - `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/connector-command-layer-cats-new.test.js`
    - Result: exit 0; 3 tests passed.
  - `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/connector-command-layer.test.js test/connector-command-layer-cats-new.test.js`
    - Result: exit 0; 106 tests passed.
- Required IM Web gates:
  - `cd sections/im_web && pnpm type-check`
    - Result: exit 0.
  - `cd sections/im_web && pnpm build`
    - Result: exit 0; Vite completed production build with the existing large chunk warning.
  - `cd sections/im_web && pnpm test:unit`
    - Result: exit 0; 57 files, 187 tests passed.
    - Note: `recoveryFailureState` intentionally logs simulated unavailable backend errors while passing.
- Browser evidence:
  - Auto-detected `http://localhost:9000` was MinIO, not IM Web, so a temporary Vite dev server was started at `http://127.0.0.1:3000`.
  - Ran the markdown table check headless because the current environment has no XServer:
    - `cd /home/leng/.codex/skills/playwright-skill && TARGET_URL=http://127.0.0.1:3000 node run.js /tmp/playwright-test-v3-18-markdown-table.js`
    - Result: exit 0; `PASS v3-18-markdown-table`.
    - Screenshot: `assets/screenshots/v3-18-markdown-it-table.png`.
  - Ran live cat-only group create/send smoke on `http://100.79.157.76:3000` as `18337488675`:
    - `TARGET_URL=http://100.79.157.76:3000 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 node /home/leng/.codex/skills/playwright-skill/run.js /tmp/playwright-v3-18-cat-only-create-send.js`
    - Result: exit 0; group `V3-18猫群自动-1780143214098`, group id `75ab7c536d4b4c4eb21639df828dbedd`.
    - Evidence showed placeholder, user message, and final cat reply present in the group timeline.
    - Screenshots:
      - `assets/screenshots/v3-18-cat-only-create-send-20260530121334-01-picker.png`
      - `assets/screenshots/v3-18-cat-only-create-send-20260530121334-02-created.png`
      - `assets/screenshots/v3-18-cat-only-create-send-20260530121334-03-after-send.png`
      - `assets/screenshots/v3-18-cat-only-create-send-20260530121334-04-after-wait.png`
      - `assets/screenshots/v3-18-cat-only-create-send-20260530121334-result.json`
  - Ran follow-up live cat group regression smoke for the 2026-05-30 bug list:
    - `TARGET_URL=http://100.79.157.76:3000 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 node /home/leng/.codex/skills/playwright-skill/run.js /tmp/playwright-v3-18-cat-group-regression.js`
    - Result: exit 0; group `V3-18猫群回归-1780145563388`, group id `05fc38114d844399ab56ef0bee99a2e6`.
    - Evidence:
      - `mentionCatVisibleBeforeOpeningDetails = true`.
      - `placeholderAfterQuestion = true`; final DOM rows show the human prompt first and one left-side cat reply second.
      - `catAddControlVisible = true`.
      - `catRemoveControlCount = 1`.
    - Screenshots:
      - `assets/screenshots/v3-18-cat-group-regression-20260530125243-01-mention.png`
      - `assets/screenshots/v3-18-cat-group-regression-20260530125243-02-after-send.png`
      - `assets/screenshots/v3-18-cat-group-regression-20260530125243-03-after-wait.png`
      - `assets/screenshots/v3-18-cat-group-regression-20260530125243-04-members.png`
      - `assets/screenshots/v3-18-cat-group-regression-20260530125243-result.json`
    - Note: browser network log includes expected aborts from navigation/closing the page and three existing 400 console entries; the verified V3-18 assertions above passed and the screenshots show the corrected user-visible state.
  - Reopened the same live group after the final sender-attribution UI fix:
    - `TARGET_URL=http://100.79.157.76:3000 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 TEST_GROUP_ID=75ab7c536d4b4c4eb21639df828dbedd node /home/leng/.codex/skills/playwright-skill/run.js /tmp/playwright-v3-18-open-existing-cat-group.js`
    - Result: exit 0.
    - Row evidence: both placeholder and final reply are left-side `.msg-row`, with `senderLabel = 布偶猫` and `clowderCat = 布偶猫`; the user prompt remains `.msg-row is-me`.
    - Screenshot: `assets/screenshots/v3-18-existing-cat-group-20260530122640.png`.
    - Result JSON: `assets/screenshots/v3-18-existing-cat-group-20260530122640-result.json`.
  - Opened the live direct cat conversation `clowder_cat:opus` after the direct title/cache fix:
    - `TARGET_URL=http://100.79.157.76:3000 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 node /home/leng/.codex/skills/playwright-skill/run.js /tmp/playwright-v3-18-direct-cat-identity.js`
    - Result: exit 0.
    - Evidence: `headerCandidates` contains `宪宪`, `leftCandidates` contains `宪宪`, and `hasOpusExact = false`.
    - Screenshot: `assets/screenshots/v3-18-direct-cat-identity-20260530132902.png`.
    - Result JSON: `assets/screenshots/v3-18-direct-cat-identity-20260530132902-result.json`.
  - Opened the live new-cat console after the platform fix:
    - `TARGET_URL=http://100.79.157.76:3000 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 node /home/leng/.codex/skills/playwright-skill/run.js /tmp/playwright-v3-18-cat-console-platform.js`
    - Result: exit 0.
    - Evidence: selector options are `请选择 Codex 或 Claude Code`, `Codex`, and `Claude Code`; create button is disabled before platform selection and enabled after entering a name and selecting Codex.
    - Screenshot: `assets/screenshots/v3-18-cat-console-platform-20260530T143250.png`.
    - Result JSON: `assets/screenshots/v3-18-cat-console-platform-20260530T143250-result.json`.
- Environment-limited check:
  - `cd sections/im/TangSengDaoDaoServer && go test -count=1 ./modules/clowder ./modules/group`
    - Result: exit 1 in `modules/group` before exercising this issue's assertions because the broader package test opens local MySQL as `root`: `Access denied for user 'root'@'localhost'`.
  - `cd sections/im/TangSengDaoDaoServer && go test -count=1 ./modules/group -run 'TestGroupCreate|TestGroupCreateAllowsCreatorOnlyGroup'`
    - Result: exit 1 before exercising the assertions because `testutil.NewTestServer()` could not connect to local MySQL: `Access denied for user 'root'@'localhost'`.
    - The non-DB request validation test above was used as the runnable local verification for this session.

## Suggested Regression Coverage

- Unit test: `renderMarkdown()` renders a pipe table as `<table>`, `<thead>`, `<tbody>`, `<th>`, and `<td>`.
- Unit/component test: table markdown stays contained inside `TextCell.vue` message bubbles on narrow widths.
- Unit test: cat-only group creation allows selected cats with no invited real contacts.
- Store/contract test: group `@cat` from the creator routes to the target cat and binds the group thread.
- Store/contract test: group `@cat` from another real member routes with that member's identity.
- Store/contract test: Clowder inbound payload includes group members, cat members, mention targets, and recent history.
- Store test: group streaming chunks update one message and final history sync does not duplicate it.
- Component/store test: cat-sent image and file messages render under the cat sender in a group.
- Browser smoke: create cat-only group, mention a cat, verify markdown table rendering.
- Browser smoke: second real member mentions a cat in a mixed group, verify reply lands in group and includes context.

## Implementation Notes

- Prefer extending the V3-15 cat contact/group model instead of adding a separate cat-group-only identity model.
- Keep TangSeng/WuKongIM as the durable IM message source and Clowder as the thread/routing/context authority, matching the V3.0 plan.
- Do not expose Clowder secrets in browser code.
- Avoid custom markdown table parsing; use `markdown-it` and adapt existing code block actions around its renderer rules.
- Check whether `markdown-it` belongs in `sections/im_web/package.json` workspace dependencies or `packages/base-vue/package.json`, then keep imports aligned with the package that owns `renderMarkdown()`.

## Labels

feature, clowder, cats, groups, mentions, streaming, media, markdown

## Priority

P1
