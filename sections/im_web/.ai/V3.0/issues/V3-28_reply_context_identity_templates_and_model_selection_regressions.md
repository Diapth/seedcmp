# V3-28: Reply Context, Sender Identity, Role Template, And Codex Model Selection Regressions

## Status

Open. Reported from the live IM Web V3.0 + Clowder coordinator flow on 2026-06-02. This is a follow-up to the recent coordinator/default-reply work and to V3-27's cat-template issue.

## Created

2026-06-02

## Labels

bug, feature, clowder, coordinator, cats, reply, identity, role-template, model-selection, regression, ux

## Priority

P0

## User Report

The current group Clowder/coordinator experience has four visible problems:

1. After using `引用回复`, the quoted message does not trigger a meaningful assistant response. The quoted preview also remains pinned at the bottom input area after sending instead of clearing or becoming part of the sent message row.
2. After the user sends a message, the frontend message identity becomes unstable. The same "other side" can briefly show the human user, `PM`, or `协调者`, and the avatar/name can change during placeholder, streaming, finalization, or refresh.
3. The `新增猫猫` role-template dropdown has duplicated templates and still does not fully follow `seedcmp/sections/clowder-ai/cat-template.json`. The live dropdown now shows repeated `布偶猫` and `质检猫` rows plus `协调者`.
4. The Codex startup/create-cat flow should let the user choose a model on top of the default model. For example, the UI should support choosing among available model options such as `GPT-5.5`, `GPT-5.4`, and `GPT-5.4-Mini`, while keeping a sensible default.

## Impact

- Users expect quoted reply to carry conversational context. If Clowder does not route or reason over the quote, replies like `?` become contextless and look ignored.
- A sticky quote preview at the bottom makes users think they are still replying to the old message, causing accidental quoted sends.
- Sender identity instability makes the transcript untrustworthy: users cannot tell whether the response came from the human, PM alias, or coordinator agent.
- Duplicate role templates make cat creation confusing and can lead to cloning the wrong template.
- If Codex model choice is hidden behind manual text input or not exposed at all, users cannot select the desired quality/cost/speed profile when creating a cat.

## Related Issues

- `V3-27_conversation_delete_and_cat_template_regressions.md` tracks missing/incomplete role-template coverage.
- `V3-26_group_cat_context_menu_markdown_auto_reply_identity_regressions.md` tracks earlier group identity and context-menu regressions.
- `V3-25_clowder_cat_onboarding_context_menus_and_group_auto_reply.md` defines the broader cat onboarding and group auto-reply contract.
- `V3-23_group_clowder_cat_state_and_digest_identity_recovery.md`, `V3-21_clowder_cat_sender_name_false_slash_inference.md`, and `V3-19_cat_group_multi_user_identity_mention_file_and_thinking_order_regressions.md` contain prior identity recovery work that should not regress.

## Reproduction Notes

### 1. Quoted Reply Does Not Produce A Contextual Assistant Response

1. Open a group chat with Clowder/coordinator auto-reply enabled.
2. Right-click or otherwise quote a Clowder/coordinator message.
3. Send a short response such as `?`, `阿达`, or another context-dependent reply.
4. Observe whether Clowder/coordinator receives enough quoted context to answer.
5. Observe whether the quote preview clears from the input area after the send.
6. Inspect whether the sent message row contains the quoted reference in the correct position.

### 2. Sender Name/Avatar Changes After Sending

1. In the same group chat, send a message that triggers the coordinator.
2. Watch the placeholder/thinking row, streamed row, final message, sidebar digest, and refreshed history.
3. Observe that the display identity can shift between the human user, `PM`, and `协调者`.

### 3. Role Template Dropdown Has Duplicates

1. Open `联系人 -> 新增猫猫`.
2. Open `猫猫设置 -> 角色模板`.
3. Observe duplicated entries, for example:
   - `布偶猫 · 架构设计、写代码一把手`
   - `质检猫 · Review、找 bug、coding 落地`
   - `协调者 · 需求澄清、任务拆分、并行调度、结果合成、交付闭环`
   - `布偶猫 · 架构设计、写代码一把手`
   - `质检猫 · Review、找 bug、coding 落地`
4. Compare against `sections/clowder-ai/cat-template.json`, which currently has three `roleTemplates` and three `breeds`.

### 4. Codex Model Cannot Be Selected Clearly

1. Open `新增猫猫`.
2. Choose platform `Codex`.
3. Try to choose a model from known or available Codex model options.
4. Observe whether the form offers a validated model selector and whether the chosen model is sent to TangSeng/Clowder cat creation.

## Expected Behavior

- Quoted replies should route with quote context. If the quote target is a Clowder/cat/coordinator message, the routing policy should treat the new message as continuing that agent thread even when the new text is short.
- The Clowder prompt context should include the quoted message author, text, message id/seq, and resolved target agent when available.
- The quote preview in the input area should clear immediately after the local send succeeds. If Clowder routing later fails, the already-sent quote should not remain stuck in the composer.
- The sent message row should render the quote reference inside the message row, not as a persistent bottom composer element.
- Sender identity must be canonical and stable across optimistic placeholder, thinking, streaming chunks, final callback, history sync, sidebar digest, and refresh.
- `PM` and `协调者` must not fight each other as separate display identities unless they represent distinct agents. If `PM` is only the coordinator nickname, presentation should choose one canonical display name and preserve aliases only as metadata.
- Human sender identity must never overwrite a Clowder/cat/coordinator reply, even if the user sends another message while the assistant is thinking.
- Role templates should be derived from the intended source of truth in `cat-template.json` without duplicates. A role template and a breed/connected cat that refer to the same logical role should collapse to one option.
- The role-template selector should distinguish template identity (`roleTemplateId`) from runtime cat identity (`catId`) so `ragdoll`, `opus`, and display-name duplicates do not produce repeated rows.
- Codex cat creation should expose a model selector with a default value and allowed model options. The selected model should be persisted into the created cat config and passed through the existing `--model` creation path.

## Acceptance Criteria

- Quoting a Clowder/coordinator message and sending `?` triggers a contextual Clowder/coordinator response instead of being treated as an unrelated human message.
- The input quote preview clears after the user message is sent, even if the downstream Clowder route is still pending.
- A failed Clowder route surfaces an error or retry state without reattaching the old quote preview.
- The sent message displays its quote reference exactly once in the message row and remains correct after refresh.
- Cat/coordinator reply rows keep the same avatar and display name from placeholder through final message and after reload.
- The sidebar digest, message row header, card header, and Clowder badge all agree on the same canonical sender for the same message.
- `PM` is either normalized to `协调者` or deliberately shown as the coordinator nickname in a consistent way; it must not alternate row by row.
- The role-template dropdown contains exactly one visible option per cloneable template from `cat-template.json` unless an entry is intentionally disabled with a clear reason.
- Duplicates from merging explicit templates and legacy disconnected agents are removed by stable logical key, not by display name alone.
- Selecting `协调者` as a template creates a new cat from the coordinator role without accidentally routing to the built-in coordinator identity.
- Codex platform shows a model selector seeded from default/allowed model metadata. Users can keep the default or choose another available model.
- The chosen Codex model is included in the create-cat request as `defaultModel`, passed through TangSeng's `/cats new ... --model <model>` command, and stored by Clowder in the runtime catalog.
- Invalid or unavailable model choices are disabled or rejected with a visible validation message.

## Suspected Areas

```text
sections/im_web/apps/chat/src/components/MessageInput.vue
sections/im_web/apps/chat/src/components/MessageList.vue
sections/im_web/apps/chat/src/utils/clowderGroupAutoReplyPolicy.ts
sections/im_web/apps/chat/src/utils/clowderGroupAutoReplyPolicy.js
sections/im_web/packages/datasource-vue/src/stores/messageStore.ts
sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
sections/im_web/packages/datasource-vue/src/stores/clowderCatContacts.ts
sections/im_web/packages/datasource-vue/src/api/clowder.ts
sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/clowder-ai/cat-template.json
sections/clowder-ai/packages/api/src/infrastructure/connectors/ConnectorRouter.ts
sections/clowder-ai/packages/api/src/infrastructure/connectors/ImWebInboundHandler.ts
sections/clowder-ai/packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts
sections/clowder-ai/packages/api/src/infrastructure/connectors/ImWebCatCreator.ts
```

## Investigation Checklist

- Trace when `messageStore.replyTarget` is cleared. The composer should clear after local send success, not after a potentially long Clowder route completes.
- Confirm whether quoted reply metadata is included in the normal IM send payload and whether Clowder receives equivalent quote context through `promptContext`.
- Extend group auto-reply policy so `reply_to_cat` and `reply_to_coordinator` can route short contextual replies when the quoted message came from a Clowder agent.
- Check whether the quote target can resolve `catId`, `catDisplayName`, coordinator metadata, or `fromUID` shaped like `clowder:*` / `clowder_cat:*`.
- Audit identity normalization in optimistic message creation, stream merge, final ACK merge, outbound callback normalization, history hydration, and digest creation.
- Identify where `PM` is introduced: `cat-template.json` nickname, role template display, runtime catalog, content prefix, or callback metadata.
- Ensure display code prefers durable structured metadata over text-prefix guessing, except where prefix recovery is explicitly needed for old records.
- Compare `cat-template.json.roleTemplates`, `cat-template.json.breeds`, runtime catalog entries, and TangSeng `/clowder/cats` response. Decide the single cloneable-template source.
- Review `normalizeRoleTemplates()` and its merge of explicit templates with legacy `source === 'disconnected'` candidates; this likely produces duplicate display rows with different ids.
- Add a model metadata contract for Codex/Claude Code templates: default model, allowed model list, disabled reason, and account-specific availability.
- Verify the create-cat path already accepts `defaultModel` and passes `--model`; fill the missing UI/catalog validation rather than inventing a second model mechanism.

## Regression Coverage Required

- Unit test for reply auto-routing when `replyTarget` is a Clowder cat/coordinator message and the new text is short.
- Component/store test proving `replyTarget` clears immediately after `messageStore.sendMessage()` succeeds, independent of delayed Clowder routing.
- Message rendering test proving quote references render once in the sent row and do not persist in the input after send.
- Identity merge test for coordinator placeholder -> thinking -> final -> refreshed history, asserting stable `catId`, display name, and avatar.
- Regression test where a human message arrives while coordinator is streaming and does not overwrite the coordinator row identity.
- Role-template normalization test using `cat-template.json` shaped fixtures with `roleTemplates`, `breeds`, connected cats, disconnected candidates, and coordinator alias/nickname.
- UI test for `ClowderCatConsolePage.vue` showing deduped template rows and a Codex model selector.
- API/proxy test asserting `defaultModel` becomes `/cats new ... --model <model>` and is received by Clowder.
- Catalog test asserting the created cat stores the selected model and still inherits the selected role template.
- Browser smoke covering the exact live flow: quote coordinator reply, send `?`, observe response and cleared quote; send during coordinator thinking and verify identity; open new-cat page and inspect templates/model selector.

## Required Verification

```bash
cd sections/im_web
pnpm type-check
pnpm test:unit
```

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/clowderGroupAutoReplyPolicy.test.ts tests/clowderMessagePresentation.test.ts tests/clowderGroupIdentityRecovery.test.ts tests/clowderCatConsole.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

```bash
cd sections/im/TangSengDaoDaoServer
go test -count=1 ./modules/clowder
```

```bash
cd sections/clowder-ai/packages/api
pnpm run build
```

## Notes

Do not close this issue with static/unit evidence only. The quote preview sticking at the bottom and the PM/coordinator/user identity flicker are live UI timing problems and need browser evidence across optimistic render, streaming, final callback, and refresh.
