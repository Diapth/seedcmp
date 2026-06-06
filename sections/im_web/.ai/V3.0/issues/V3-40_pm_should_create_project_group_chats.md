# V3-40: PM Should Create Project Group Chats Instead Of Pulling Agents Into The Direct PM Chat

## Status

Open. Reported from live IM Web V3.0 Clowder PM/coordinator usage on 2026-06-06. When a user starts project work with the PM, the PM should create a dedicated project group chat and invite the required agents plus the user. The current PM direct conversation should remain a PM/user feedback channel, not become the place where other agents are pulled in.

## Created

2026-06-06

## Labels

bug, clowder, pm, coordinator, group-chat, project-chat, agent-routing, membership, conversation-model, ux, architecture

## Priority

P0

## User Report

The user-visible requirement:

```text
当用户和 PM 对话的时候，PM 应该创建新的群聊，而不是在当前对话把各智能体拉进来。
当前对话只能是 PM 和用户对话交流反馈，其他的智能体交流应该在群聊里面。
群名称即为项目名称，由 PM 主动创建和拉取成员，用户也必须在里面。
```

## Problem

The PM/coordinator direct conversation is currently doing too much. It can become both:

- the user's private planning/feedback channel with the PM,
- the project execution room where worker agents are invited or addressed.

This creates an unclear conversation model:

- Users cannot tell whether they are privately giving feedback to PM or speaking to the whole agent team.
- Worker-agent discussion can clutter the PM/user feedback channel.
- Project membership becomes implicit and hard to inspect.
- The Kanban/artifact/thread binding can point to the wrong conversation if tasks are created from PM direct chat but execution happens elsewhere.
- There is no durable project room named after the project, so later continuation, group history, and member management are harder.

## Expected Behavior

When a user and PM agree to start a project-like task, the PM should create or select a dedicated project group chat.

Rules:

- The PM direct chat remains a 1:1 PM/user channel for requirements, status summaries, decisions, and feedback.
- Worker agents should not be pulled into the PM direct chat as active participants.
- PM should create a new group chat for the project when no suitable project group exists.
- The group name should be the project name, for example `婚礼`, `todo`, `Maomi Workspace`, or the resolved project/workspace display name.
- The user must be a member of the project group.
- PM must be a visible member of the project group.
- PM must invite the relevant worker agents into that group based on task needs.
- Internal routing may deliver PM messages, but PM-authored coordination messages should appear in the group under the PM identity.
- Worker-agent collaboration, task execution, file/artifact delivery, and cross-agent discussion should happen in the project group.
- PM can post a short handoff/link in the direct chat, for example: `我已创建项目群「婚礼」，后续执行会在群里进行。`
- If a matching project group already exists, PM should reuse it after confirming or clearly indicating reuse.

## Conversation Contract

### PM Direct Chat

Allowed:

- gather requirements,
- ask clarifying questions,
- propose project name/workspace,
- create or select project group,
- summarize progress,
- ask for approval,
- route user feedback back into the project group.

Not allowed:

- silently adding worker agents into the PM direct conversation,
- turning the PM direct chat into a multi-agent execution room,
- storing primary project execution state only on the PM direct thread.

### Project Group Chat

Required:

- group name equals the project name or selected workspace/project display name,
- user is included as a real TangSeng group member,
- PM/coordinator is included as a visible group member,
- PM-authored task assignment, status, and coordination messages appear under the PM identity,
- users can mention or address PM inside the project group,
- selected worker agents are included as Clowder group cat members,
- tasks, Kanban state, artifacts, previews, and file delivery are bound to this project group/thread,
- future project continuation reuses the same group unless the user explicitly starts a new project.

## Acceptance Criteria

- Starting a project from PM direct chat creates a new group chat named after the project.
- The created group includes the requesting user.
- The created group includes the PM/coordinator as a visible member.
- The created group includes the required worker agents as visible cat members.
- PM-authored coordination messages in the project group render with PM sender identity, not as anonymous/system/routing messages.
- The user can `@PM` or otherwise clearly address PM inside the project group.
- Worker-agent task messages appear in the project group, not in the PM direct chat.
- The PM direct chat receives only a handoff/summary/link to the project group.
- The Clowder panel and Kanban bind to the project group thread for execution state.
- If a project group already exists for the selected workspace/project, PM reuses it instead of creating duplicates.
- The user can open the group from the PM handoff message.
- Refresh/history sync preserves the PM direct chat vs project group separation.
- Direct cat conversations remain available for explicit 1:1 cat chats, but PM-created project work defaults to the project group model.

## Relationship To Existing Issues

- Related to `V3-15_clowder_cats_as_contacts_and_group_members.md`: project groups depend on cats being valid group members.
- Related to `V3-18_cat_group_chat_mentions_context_media_and_markdown_it.md`: project execution happens in cat-capable group chats.
- Related to `V3-35_clowder_kanban_missing_created_tasks.md`: created tasks should bind to the project group thread, not an ambiguous PM direct thread.
- Related to `V3-37_clowder_unified_maomi_project_workspace.md`: project group name and binding should align with the active Maomi workspace/project.
- Related to `V3-39_clowder_agent_artifact_storage_boundaries.md`: project groups should be the user-facing collaboration surface for workspace artifacts and file delivery.

## Suspected Areas

```text
sections/im_web/apps/chat/src/components/MessageInput.vue
sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue
sections/im_web/apps/chat/src/components/ProjectKanbanPanel.vue
sections/im_web/apps/chat/src/views/CreateGroupPage.vue
sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
sections/im_web/packages/datasource-vue/src/stores/groupStore.ts
sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts
sections/im_web/packages/datasource-vue/src/api/clowder.ts
sections/im/TangSengDaoDaoServer/modules/group/api.go
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/clowder-ai/packages/api/src/infrastructure/connectors/ConnectorRouter.ts
sections/clowder-ai/packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/route-helpers.ts
sections/clowder-ai/packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts
sections/clowder-ai/packages/api/src/domains/cats/services/stores/ports/TaskStore.ts
sections/clowder-ai/packages/mcp-server/src/tools/callback-tools.ts
```

## Actual Entry Points Confirmed

- PM/coordinator 直聊入口在 `sections/im_web/apps/chat/src/components/MessageInput.vue`：
  - `CLOWDER_COORDINATOR_CAT_ID = 'coordinator'` 负责群聊默认协调者路由。
  - `isClowderCatConversation` 会把 `clowder_cat:*` 直聊发送到 Clowder。
  - `sendClowderRouteMessage` 当前按当前 `channelId/channelType` 调 `clowderStore.sendConversationMessage`，所以 PM 直聊会继续进入 PM direct thread。
- Clowder bridge 入口在 `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`：
  - `conversationMessage` 直接调用 `sendInboundTextWithRouting(req.ChannelID, req.ChannelType, ...)`。
  - `sendInboundTextWithRouting` 生成 `externalChatIdForUser(channelID, channelType, userID)`，因此只要把 channel 切到项目群，Clowder worker outbound 就会自然回到群聊。
  - `outbound` 已能把 `ChannelTypeGroup` 的虚拟 Clowder sender 写回群聊，并为 `clowder_cat:*` sender 自动补虚拟用户。
- 群聊创建/成员入口在 `sections/im/TangSengDaoDaoServer/modules/group/api.go` 与 `sections/im_web/packages/datasource-vue/src/stores/groupStore.ts`：
  - `group/create` 创建 TangSeng 群并把创建者加入群。
  - `groups/:group_no/members` 能继续添加真实 UID 成员。
  - Clowder cats 不是 TangSeng 真成员，当前通过 `clowder/group/cats/sync` 和 `groupCatMemberships` 暴露为猫猫群成员。
- 看板/产物绑定入口在 `sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue`：
  - `boundThreadId` 来自当前 conversation binding。
  - `ProjectKanbanPanel` 和 `ProjectArtifactsPanel` 都使用 `boundThreadId`，因此 PM direct 面板需要能发现并跳转/指向 project group binding，避免继续查询 direct thread。

结论：短期最小修复点是让 PM direct 触发项目请求时先确保 TangSeng 项目群和 PM 虚拟成员，再把 Clowder route message 发送到项目群 channel；Clowder connector router 本身可以复用现有 externalChatId 绑定机制。

## Investigation Checklist

- Identify the current PM/coordinator project-start path and whether it creates tasks in the PM direct thread.
- Check whether PM has an API/tool to create an IM group and add real users plus Clowder cat members.
- Check whether the group creation path can derive the requesting user from the PM direct conversation.
- Check whether PM/coordinator can be represented as a stable visible group member with sender identity, avatar/fallback avatar, and mention target.
- Decide how PM resolves the project name from the user request, selected workspace, or task title.
- Decide how to store `pmDirectThreadId -> projectGroupId/projectThreadId` binding.
- Decide when PM should reuse an existing project group versus create a new one.
- Confirm whether the Kanban/artifact panel should follow the project group binding when opened from the PM direct chat.
- Check whether group membership creation is atomic enough to avoid a group without the user or without required agents.
- Confirm how PM posts the handoff message and deep-link to the new project group.
- Ensure later user feedback in PM direct chat can be routed into the project group without exposing unrelated PM/user private context to all agents.

## Regression Coverage Required

- Coordinator/PM routing test: project start from PM direct chat creates/selects a project group instead of adding agents to the direct chat.
- Group creation test: created group name equals resolved project name and includes the user.
- Membership test: PM/coordinator is added as a visible group member.
- Membership test: required worker agents are added as Clowder group cat members.
- Presentation test: PM coordination messages render under PM identity and the user can address PM in the project group.
- Binding test: tasks/artifacts/Kanban records are associated with the project group thread.
- Store/UI test: PM direct chat shows a handoff/link to the project group.
- Browser smoke: ask PM to start a project, verify a new group named after the project appears, verify the user and agents are members, and verify agent messages land in that group.

## Implementation Notes

### Stage 3: Project Group Execution Thread Binding

- `conversation/message` already returns the Clowder route response with `threadId`; `MessageInput.vue` now captures that response when a PM direct project kickoff is routed into the project group.
- The bridge exposes `GET /v1/clowder/project-groups/active` and `POST /v1/clowder/project-groups/:bindingId/thread` so the project-group binding can persist the project execution `threadId` without re-sending the PM direct handoff message.
- `ClowderConversationPanel.vue` resolves PM/coordinator direct views through the active project group binding. When a PM direct conversation has an active binding, coordination, Kanban, artifacts, workspace binding, agent directory, and observed task ids use the project group channel/thread instead of the PM direct thread.
- The PM direct panel now shows the active project group and provides an entry to open the group conversation, while the PM direct chat remains the private feedback channel.

## Notes

Do not solve this by only changing copy in the PM direct chat. The core requirement is a conversation topology change: PM/user direct chat is for coordination and feedback; project execution happens in a named group that includes the user and the relevant agents.
