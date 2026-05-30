# V3-15: Clowder Cats Should Behave As Contacts And Group Members

## Status

Implemented and verified on 2026-05-30 in `codex/v3-15-clowder-cats`.

Browser evidence uses mocked TangSeng/Clowder bridge responses for the new frontend contract because the live signed bridge smoke environment is not part of this workspace session.

## Implementation Record

### Root Cause

IM Web had a single fixed `clowder_ai` robot shortcut and conversation route, but no durable per-cat contact identity, no direct cat conversation mapping, no connected-cat group membership model, and no generated prompt context that combined human and cat members for group routing.

### Fix Summary

- Added a durable Clowder cat contact identity model in datasource state:
  - contact/direct conversation id: `clowder_cat:<catId>`
  - outbound sender id: `clowder_cat_<catId>`
  - history grouping key: `clowder-cat:<catId>`
  - contact fields for aliases, avatar, personality, capability, availability, source, and connected state.
- Added browser-facing Clowder cat APIs for directory load, existing-cat connect, create-and-connect, group cat sync, and richer conversation message routing metadata.
- Updated Contacts to show `Clowder 猫猫`, list routable cats, connect existing cats, and create/connect a cat from an inline form.
- Updated direct conversation/channel handling so connected cats open as stable local-only direct conversations and render channel metadata without remote lookup.
- Updated group creation to select humans and connected cats together, create the TangSeng group with human members, then sync durable group-to-cat membership and generated prompt context.
- Updated group member list to show cat members and support removing a cat from group routing while preserving normal human member controls.
- Updated message input mention autocomplete to include cat members and send `targetCatIds` plus prompt context to Clowder routing for mixed groups.
- Documented the identity, cat contact, group sync, and prompt context contracts in the V3 bridge and adapter contract docs.

### Files Touched

- `sections/im_web/packages/datasource-vue/src/api/clowder.ts`
- `sections/im_web/packages/datasource-vue/src/stores/clowderCatContacts.ts`
- `sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts`
- `sections/im_web/packages/datasource-vue/src/stores/channelStore.ts`
- `sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts`
- `sections/im_web/packages/datasource-vue/src/stores/clowderTypes.ts`
- `sections/im_web/packages/datasource-vue/src/index.ts`
- `sections/im_web/packages/contacts-vue/src/views/ContactList.vue`
- `sections/im_web/apps/chat/src/views/CreateGroupPage.vue`
- `sections/im_web/apps/chat/src/views/GroupMemberList.vue`
- `sections/im_web/apps/chat/src/components/MessageInput.vue`
- `sections/im_web/.ai/V3.0/contracts/im-web-clowder-bridge.md`
- `sections/im_web/.ai/V3.0/contracts/im-web-adapter-interface.md`
- `sections/im_web/apps/chat/tests/clowderCatContacts.test.ts`
- `sections/im_web/apps/chat/tests/clowderMixedGroupPrompt.test.ts`
- `sections/im_web/apps/chat/tests/clowderGroupMemberList.test.ts`
- Updated existing V3 contact, group creation, and routing tests.

### Verification Evidence

- `cd sections/im_web && pnpm type-check`
  - Result: exit 0.
- `cd sections/im_web && pnpm build`
  - Result: exit 0; Vite completed production build.
  - Note: existing large chunk warning remains.
- `cd sections/im_web && pnpm test:unit`
  - Result: exit 0; 54 test files, 156 tests passed.
  - Note: `recoveryFailureState` intentionally logs simulated unavailable backend errors while passing.
- `cd /home/leng/.codex/skills/playwright-skill && node run.js /tmp/playwright-test-v3-15-clowder-cats.js`
  - Result: exit 0.
  - Screenshots:
    - `assets/screenshots/v3-15-clowder-cat-contacts.png`
    - `assets/screenshots/v3-15-mixed-group-picker.png`

## Labels

feature, clowder, contacts, groups, multi-agent, prompt

## Priority

P1

## User Request

Clowder AI 中的每一只猫猫本质上都是一个联系人：它们有不同性格、不同可调用能力，也需要避免用户总是通过 `/` 命令操作或误用命令。IM Web 应该把猫猫纳入联系人体系，并支持把猫猫和人一起拉入群聊，在群内通过统一提示词告诉每只猫猫当前群里有哪些人和猫、可以 `@` 谁。

## Problem

当前 V3.0 已支持 Clowder connector、猫猫目录、`/cats new`、`/ask`、`/focus` 和多 agent 路由，但 IM Web 仍把 Clowder 更像一个单独的 AI/机器人入口，而不是通讯录中的多个可选联系人。

这会带来几个产品和交互问题：

- 用户需要记住 `/cats`、`/cats new`、`/ask`、`/focus` 等命令，误用命令的概率高。
- 不同性格/能力的猫猫没有像普通联系人一样被展示、搜索、选择、邀请、备注或查看资料。
- 群聊中“有哪些人、有哪些猫、谁可以被 @”主要依赖 Clowder 线程/路由上下文，IM Web 没有一个明确的群成员模型和群级提示词生成规则。
- 新建猫猫与添加已有猫猫是两个不同意图，但当前 UI 没有清晰拆分入口。

## Recommended Delivery Order

This feature should be delivered from identity and routing foundations outward. The final product is contact/group UX, but the first implementation slice should not be UI-heavy.

1. **Identity and contract foundation**: decide and document cat contact IDs, direct conversation IDs, outbound sender identity, history grouping, and Clowder-to-IM binding ownership.
2. **Read-only cat contact directory**: show existing routable Clowder cats under Contacts without creating, inviting, or mutating cats yet.
3. **Add existing cat and direct chat**: let users add an existing cat as an IM-side contact, open its direct conversation, and receive replies rendered with that cat identity.
4. **Create cat and connect**: add the higher-risk create flow after existing-cat routing is stable, including alias conflict, timeout, not-routable, and registry sync states.
5. **Mixed human/cat group membership**: allow group creation/member editing to include human contacts and connected cat contacts, with durable group-to-cat membership metadata.
6. **Group prompt generation and sync**: generate the unified group prompt from the stable mixed-member model, then refresh it on member, alias, permission, and availability changes.
7. **UX, permission, and failure hardening**: add mention autocomplete, consent/visibility copy, admin policy controls, proactive reply rules, audit badges, and recovery surfaces.

## Capability Details

The capability descriptions below describe the target product behavior. Implementation should follow the delivery order above so each slice has a small independent acceptance path.

### 1. Treat Every Clowder Cat As A Contact

IM Web should expose each routable Clowder cat as a contact-like entry under Contacts.

Required contact fields:

- stable IM-side contact id, e.g. `clowder_cat:<catId>`
- Clowder `catId`
- display name
- aliases / mention names
- avatar or generated fallback avatar
- personality summary
- capability summary
- availability state
- source: existing Clowder cat, runtime-created cat, or disconnected/stale cat

Cats should be searchable and selectable like contacts, while still being visually marked as Clowder cats so users do not confuse them with human accounts.

### 2. Add Cats From Contacts With Two Entry Points

The Contacts page should provide a Clowder cat management entry below the existing contact/group/robot actions.

Supported flows:

1. **添加已有猫猫**: browse/search the Clowder agent directory, select one or more existing cats, then add them as IM contacts.
2. **在 Clowder AI 中创建猫猫并连接**: create a new Clowder cat from IM Web, configure name/alias/personality/capabilities, then connect it as an IM contact after Clowder confirms the cat is routable.

The second flow should call Clowder-owned cat creation APIs/commands and only persist the IM contact binding after Clowder returns a stable `catId`.

### 3. Invite Cats And Humans Into The Same Group

Group creation and group member management should allow selecting both human contacts and Clowder cat contacts.

Expected behavior:

- The group member list shows humans and cats together.
- Cats receive durable group membership metadata, not only transient thread preferred-cat state.
- Human members can mention cats by display name or alias.
- Cats can mention humans and other cats if the group prompt says those targets are available.
- Removing a cat from a group stops future routing to that cat from the group without deleting the Clowder cat itself.

### 4. Maintain A Unified Group Prompt

Each mixed human/cat group should have a generated group prompt that Clowder receives with inbound group messages or stores in the bound thread context.

The prompt should include:

- group name and group id
- human members: id, display name, role, and mention handle
- cat members: cat id, display name, aliases, personality summary, and mention handle
- current allowed `@` targets
- group rules, including whether cats may answer proactively or only when mentioned
- privacy and safety boundaries, including which user metadata is visible to cats

Prompt updates should be triggered by group member changes, cat rename/alias changes, group rename, permission changes, and cat availability changes.

## What Else Is Missing

The core idea is good; the missing pieces are mostly lifecycle, safety, and consistency details:

1. **Identity mapping**: decide whether a cat is delivered as one shared robot account with metadata or one durable robot account per cat. Existing V3 adapter contract prefers one robot account per cat, e.g. `clowder_cat_codex`, with an MVP fallback of one shared `clowder_agent`.
2. **Contact lifecycle**: define sync, stale, disconnect, reconnect, rename, delete, and avatar refresh behavior between Clowder cat registry and IM Web contacts.
3. **Alias conflict rules**: prevent duplicate `@` aliases across humans and cats in the same group, and show a recoverable UI state when Clowder reports a conflict.
4. **Permission model**: define who can add cats, create cats, connect cats, remove cats, edit group prompt rules, and allow proactive cat replies.
5. **Consent and visibility**: make it clear to human group members when cats are present and what group/member metadata is shared with Clowder.
6. **Failure states**: handle Clowder unavailable, cat creation timeout, cat not routable after creation, stale contact binding, cat removed from Clowder, and group prompt sync failure.
7. **Mention UX**: add autocomplete for human and cat `@` targets in mixed groups; avoid forcing users back to slash commands for routine routing.
8. **Auditability**: show which cat replied, which message triggered the reply, and whether the reply used mention, focus, preferred-cat, or default routing.
9. **Test data and smoke environment**: acceptance needs at least two human accounts and at least two Clowder cats, including one existing cat and one runtime-created cat.

## Functional Requirements

- **FR-001**: The implementation MUST define a durable cat identity model covering IM-side contact id, direct conversation id, outbound sender identity, history grouping, and Clowder binding ownership before adding user-facing mutation flows.
- **FR-002**: IM Web MUST expose routable Clowder cats as read-only contact-like entries under Contacts without copying Clowder registry ownership into browser state.
- **FR-003**: IM Web MUST support adding an existing Clowder cat as an IM contact.
- **FR-004**: A connected cat contact MUST support opening a direct IM conversation whose replies render with stable cat identity, not only generic `Clowder AI`.
- **FR-005**: IM Web MUST support creating a new Clowder cat from the Contacts flow and connecting it as an IM contact after Clowder returns a stable `catId`.
- **FR-006**: Group creation/member editing MUST allow selecting human contacts and connected Clowder cat contacts together.
- **FR-007**: Mixed groups MUST maintain a durable mapping of included `catId`s for that IM group.
- **FR-008**: Mixed groups MUST generate or refresh a group prompt that lists human members, cat members, allowed mention targets, and group rules.
- **FR-009**: Inbound group messages MUST include enough sender, member, and prompt context for Clowder cats to know who is in the group and who can be mentioned.
- **FR-010**: Removing a cat from a group MUST stop routing future group messages to that cat while preserving past messages.
- **FR-011**: Slash commands may remain as power-user shortcuts, but normal add/invite/mention/focus flows MUST be available from UI controls.

## Suggested UX Surfaces

- Contacts quick action: `Clowder 猫猫`
- Cat directory page: existing cats, connected cats, unavailable cats
- Cat creation dialog: name, alias, personality, capability/provider preset, connect after create
- Cat profile drawer: aliases, personality, capabilities, availability, connected groups
- Group creation/member picker: humans and cats in one selector, with cat badges
- Group settings: cat members, group prompt preview, who may edit prompt rules, proactive reply toggle
- Message composer: `@` autocomplete containing both humans and cats

## Related Areas

- `sections/im_web/packages/contacts-vue/src/views/ContactList.vue`
- `sections/im_web/packages/contacts-vue/src/stores/robotConfigStore.ts`
- `sections/im_web/packages/datasource-vue/src/api/clowder.ts`
- `sections/im_web/packages/datasource-vue/src/stores/clowderControlStore.ts`
- `sections/im_web/apps/chat/src/components/MessageInput.vue`
- `sections/im_web/apps/chat/src/components/ClowderPanel.vue`
- `sections/im_web/.ai/V3.0/contracts/im-web-clowder-bridge.md`
- `sections/im_web/.ai/V3.0/contracts/im-web-adapter-interface.md`

## Acceptance Criteria

### Phase 0: Identity Contract

- [ ] Cat contact identity, direct conversation identity, outbound sender identity, and history grouping are documented in the bridge/adapter contracts.
- [ ] The chosen identity model states whether the implementation uses one robot account per cat or a shared robot account plus cat metadata.

### Phase 1: Read-only Cat Directory

- [ ] Contacts shows a Clowder cat entry point and lists at least two routable cats from Clowder.
- [ ] Cat entries include display name, alias, availability, personality/capability summary, and a visible Clowder cat badge.
- [ ] Search can find Clowder cat contacts without requiring `/cats`.

### Phase 2: Add Existing Cat And Direct Chat

- [ ] Adding an existing cat creates a stable IM-side cat contact and opens a direct conversation for that cat.
- [ ] Sending a direct message to that cat routes through Clowder and renders the reply with that cat identity.
- [ ] Refresh/history sync preserves the cat identity and does not collapse the reply into generic `Clowder AI`.

### Phase 3: Create Cat And Connect

- [ ] Creating a cat from IM Web returns a Clowder `catId`, appears in the Clowder directory, and becomes an IM-side contact without requiring manual `/cats new`.
- [ ] Failure tests cover Clowder unavailable, duplicate alias, cat creation timeout, not-routable after creation, and stale cat contact binding.

### Phase 4: Mixed Human/Cat Groups

- [ ] Group creation can select one human and two connected cat contacts, then creates a mixed group with all members visible.
- [ ] Sending `@猫猫A ...` in a mixed group routes only to 猫猫A and renders the reply with 猫猫A identity.
- [ ] Removing a cat from the group prevents future routing to that cat while preserving historical messages.

### Phase 5: Group Prompt

- [ ] The generated group prompt includes humans, cats, aliases, allowed mention targets, group rules, and privacy boundaries.
- [ ] The prompt updates after adding/removing a cat, renaming a cat alias, changing group name, changing permissions, or receiving cat availability changes.

### Phase 6: UX And Policy Hardening

- [ ] The mixed group composer autocompletes both human and cat mentions.
- [ ] Permission tests prove non-admin users cannot add/remove cats or edit group prompt rules when group policy forbids it.
- [ ] Human members can see that cats are present and what member metadata is shared with Clowder.
- [ ] Message UI shows which cat replied, which message triggered it, and whether routing used mention, focus, preferred-cat, or default routing.

## Open Questions

1. Should cat contacts be globally visible to all IM users, or scoped per Clowder owner / IM account / organization?
2. Should direct conversations with a cat map to `externalChatId=1:clowder_cat:<catId>` or reuse the existing `clowder_ai` hub plus preferred cat?
3. Should cats be full TangSeng group members at the server level, or IM Web virtual members backed by Clowder routing metadata?
4. Should cats be allowed to reply proactively in a group, or only when explicitly mentioned / focused?
5. Which fields from human profiles are allowed in the group prompt by default: display name only, role, avatar, phone/account id, or custom nickname?

## Suggested Test Coverage

- Phase 0 contract tests for cat contact id, direct conversation id, outbound sender identity, and history merge keys.
- Phase 1 contact store test for mapping Clowder agent directory entries into read-only cat contacts.
- Phase 2 direct-chat tests for adding an existing cat, sending a message, rendering cat identity, and preserving history after refresh.
- Phase 3 API contract tests for create-and-connect cat flow and all create failure states.
- Phase 4 group member store and routing tests for mixed human/cat member lists and targeted mention.
- Phase 5 prompt builder unit tests for deterministic group prompt output and updates.
- Phase 6 mention parser/autocomplete, permission, consent, and audit display tests.
- Playwright smoke should follow the same phase order: directory, add existing cat, direct chat, create cat, mixed group, prompt update, refresh history, remove one cat.
