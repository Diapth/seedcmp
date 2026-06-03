# V3-27: Conversation Delete Fails And New Cat Role Template List Is Incomplete

## Status

Open. Reported from the live IM Web V3.0 flow on 2026-06-02. This issue is a regression/follow-up to the V3-25 context-menu and cat-onboarding work: the product surfaces exist, but the current browser behavior is still incomplete.

## Created

2026-06-02

## Labels

bug, clowder, cats, onboarding, conversation-list, context-menu, regression, ux

## Priority

P1

## User Report

Two user-visible problems remain in the current IM Web + Clowder cat flow:

1. Conversations cannot be deleted from the conversation list. The right-click menu has a `删除会话` action, but the conversation is not reliably removed or can come back after sync/reload.
2. The `新增猫猫` page only shows two role templates in the `角色模板` dropdown. The user expects the available Clowder cat role templates to be broader than the two visible entries, especially now that coordinator/default cat roles have been added.

Screenshots from the live browser session show:

- The conversation list still contains existing direct/group/cat conversations after the user tries to manage them.
- `新增猫猫 -> 猫猫设置 -> 角色模板` only lists:
  - `布偶猫 · 架构设计、写代码一把好手`
  - `Codex · Review、找 bug、coding 落地`

## Impact

- Users cannot clean up stale or accidental conversations, so the left conversation list keeps growing and old Clowder/cat test rows remain visible.
- Conversation delete/hide semantics feel unreliable because the UI exposes actions that do not produce durable results.
- New cat onboarding is artificially constrained. Users can only clone two visible templates instead of choosing from all role templates or built-in cat roles.
- The template gap makes newly added roles such as `coordinator` feel unavailable from IM Web even if they exist in Clowder configuration.

## Related Issues

- `V3-25_clowder_cat_onboarding_context_menus_and_group_auto_reply.md` specified conversation right-click delete/hide and richer cat onboarding.
- `V3-26_group_cat_context_menu_markdown_auto_reply_identity_regressions.md` tracked the previous live regression batch around context menus and group cat behavior.
- `V3-15_clowder_cats_as_contacts_and_group_members.md` introduced cats as native contacts and group members.

## Reproduction Notes

### 1. Cannot Delete Conversation

1. Open IM Web at `http://127.0.0.1:3000`.
2. In the left conversation list, right-click a conversation row such as a direct cat conversation, `Clowder AI`, or a group chat.
3. Click `删除会话`.
4. Observe whether the row disappears immediately.
5. Refresh the page or let conversation sync/recovery run.
6. Observe whether the deleted row returns.

### 2. New Cat Template Dropdown Only Has Two Options

1. Open the contacts tab.
2. Enter `新增猫猫`.
3. Open `猫猫设置 -> 角色模板`.
4. Observe that the dropdown only contains two template options.
5. Compare that list against Clowder's configured cat/template catalog and recently added roles.

## Expected Behavior

- `删除会话` should remove the selected conversation from the sidebar immediately and durably according to the intended IM semantics.
- If backend deletion fails, the UI must show a visible error and either roll back the optimistic removal or clearly mark that only local removal happened.
- Deleted conversations should not be re-added by `syncConversations`, `syncGroupConversations`, group recovery, message history recovery, or Clowder digest recovery unless a new incoming message or explicit reopen action makes that behavior intentional.
- `隐藏会话` should remain separate from `删除会话`: hide can be local/extra-backed and reversible, while delete should follow the backend recent-conversation delete contract.
- `新增猫猫` should show all usable role templates, not only two disconnected contacts.
- Existing connected cats, seed/runtime roles, and built-in templates should be represented consistently as template choices when they are valid for cloning a new cat.
- Template options should distinguish between "connect this existing cat" and "use this role as a template to create a new cat" so users do not lose available role templates after connecting cats.

## Acceptance Criteria

- Deleting a normal direct conversation removes it from the list and keeps it removed after refresh/reconnect until a new message or explicit reopen recreates it.
- Deleting a group conversation removes the recent conversation row without leaving a stale active route. If the backend can only hide group recents, the UI copy and behavior must say so.
- Deleting `Clowder AI` and direct cat conversations either works durably or shows a clear unsupported/local-only message; it must not silently fail.
- Failed backend delete requests surface a toast or inline error and do not leave the user guessing.
- `manuallyDeletedConversationKeys` or an equivalent deletion guard survives the relevant sync/recovery window if the backend does not immediately stop returning the row.
- `syncConversations`, `ensureGroupConversations`, `ensureConversationFromMessages`, and Clowder/cat recovery paths do not immediately recreate user-deleted recents.
- The `新增猫猫` role-template dropdown contains every configured cloneable role template from the Clowder catalog, including newly added built-in roles when they are intended to be cloneable.
- Connected cats are not accidentally removed from the template list just because their contact source is no longer `disconnected`.
- The UI makes unavailable/non-cloneable roles visible as disabled with a reason, or deliberately excludes them with a documented rule and test coverage.
- Browser evidence covers both flows: delete a conversation, refresh, confirm it stays gone; open `新增猫猫`, confirm the expected template count and names.

## Suspected Areas

```text
sections/im_web/apps/chat/src/views/ConversationList.vue
sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts
sections/im_web/packages/datasource-vue/src/api/index.ts
sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue
sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
sections/im_web/packages/datasource-vue/src/stores/clowderCatContacts.ts
sections/im_web/packages/datasource-vue/src/api/clowder.ts
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/clowder-ai/cat-template.json
sections/clowder-ai/packages/api/src/infrastructure/connectors/ImWebCatCreator.ts
```

## Investigation Checklist

- Confirm whether `syncApi.deleteConversation(channelId, channelType)` returns success, failure, 404, or an auth/route error in the live environment.
- Check whether `deleteConversation()` swallows remote delete failures and leaves no user-facing feedback.
- Trace how deleted rows are reintroduced by `syncConversations()`, `syncGroupConversations()`, `ensureGroupConversations()`, or `ensureConversationFromMessages()`.
- Decide whether direct Clowder/cat conversations need a local-only deletion path distinct from backend recent-conversation deletion.
- Decide whether group conversations should use backend delete, hidden extra state, or a documented local hidden fallback.
- Audit how `hiddenConversationKeys` and `manuallyDeletedConversationKeys` are reset across page reload, reconnect, login, and recovery.
- Compare Clowder's full catalog/template source against the IM Web `roleTemplateOptions` computed value.
- Verify whether `roleTemplateOptions = catContactDirectory.filter(cat => cat.source === 'disconnected')` is incorrectly treating "disconnected contact" as "role template".
- Check whether the Clowder/TangSeng `/clowder/cats` directory only emits two disconnected entries because connected/runtime-created/default roles are collapsed or filtered.
- Decide the source of truth for cloneable templates: `roleTemplates`, catalog `breeds`, agents with `source: disconnected`, or a dedicated template endpoint.

## Regression Coverage Required

- Unit/store test for `conversationStore.deleteConversation()` where backend delete succeeds and subsequent sync does not recreate the row.
- Unit/store test where backend delete fails and the UI/store exposes a recoverable error or rollback path.
- Store test for group conversation deletion/hide behavior through `syncGroupConversations()` and `ensureGroupConversations()`.
- Component test for `ConversationList.vue` right-click `删除会话` on the active conversation and navigation back to `/chat`.
- API/proxy test for the TangSeng delete conversation route used by IM Web.
- Unit test for `ClowderCatConsolePage.vue` role-template dropdown using a directory with connected, disconnected, runtime-created, and built-in coordinator/template entries.
- Store/API test that `loadCatContactDirectory({ includeUnavailable: true })` preserves cloneable templates even when some cats are already connected.
- Browser smoke for both flows using the live account: delete a conversation and refresh; open the new-cat page and assert the role-template list is complete.

## Required Verification

```bash
cd sections/im_web
pnpm type-check
pnpm test:unit
```

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/conversationList.test.ts tests/clowderCatConsole.test.ts tests/clowderCatContacts.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

```bash
cd sections/im/TangSengDaoDaoServer
go test -count=1 ./modules/clowder
```

## Notes

Do not close this issue with only static code inspection. Both reports came from live browser behavior: the conversation delete path depends on backend sync/recovery, and the template count depends on the runtime Clowder/TangSeng directory payload.
