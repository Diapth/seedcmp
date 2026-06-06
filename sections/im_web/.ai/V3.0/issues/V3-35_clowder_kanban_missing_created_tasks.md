# V3-35: Clowder Kanban Does Not Show Created Tasks

## Status

Open. Reported from the live IM Web V3.0 Clowder coordinator conversation on 2026-06-04. The chat transcript says a task was created, but the right-side Clowder `看板` tab still renders the empty-board state.

## Created

2026-06-04

## Labels

bug, clowder, kanban, tasks, coordinator, thread-binding, proxy, refresh, regression, ux

## Priority

P0

## User Report

In a direct Clowder coordinator conversation, the coordinator accepted the user's request and reported:

- `已建任务 0001780553055141-000007-34422e45：制作婚礼网页首版。`
- The task was assigned to `@前端`.

However, the Clowder panel on the same page shows:

- `Clowder ready`
- `看板`
- `还没有任务。让协调者分配任务后,这里会显示各猫的工作状态。`

The user-visible problem is: "已经创建了任务，但是看板还是没有任务".

## Impact

- The coordinator can claim task creation while the project board still looks empty.
- Users cannot trust the board as the source of truth for active work.
- Follow-up routing becomes confusing because the transcript says there is a task, but the UI says there is none.
- This hides whether the task was created under the wrong thread, wrong owner, wrong conversation binding, or simply not refreshed.

## Relationship To Existing Issues

- Related to `V3-31_clowder_kanban_artifacts_not_syncing_cat_work.md`, but narrower.
- V3-31 covers broad "cats are working but board/artifacts stay empty".
- This issue specifically covers the stronger invariant: once a task id is created and shown in chat, the same conversation's `看板` must show it or show a concrete binding/query error.

## Expected Behavior

- If the chat transcript emits a created task id for the current conversation, the Clowder `看板` tab should show that task in the correct column.
- The task row should include title, status, owner cat, and task id or short id.
- If the task belongs to a different Clowder thread than the currently bound conversation, the panel should show a thread-binding mismatch diagnostic instead of an empty board.
- If the task API/proxy fails, the panel should show the upstream error, not "还没有任务".
- Manual `刷新`, tab activation, active conversation change, and task-created chat events should all refresh the board.

## Acceptance Criteria

- After coordinator creates task `0001780553055141-000007-34422e45`, `GET clowder/thread/:threadId/tasks` for the conversation-bound thread returns that task.
- `ProjectKanbanPanel` renders the task without requiring a full page reload.
- Empty state appears only when the bound thread truly has zero tasks and the task route returned successfully.
- A task created under a different thread id surfaces a visible `thread_binding_mismatch` diagnostic.
- 401/403/404/502 from the TangSeng or Clowder task route is not converted to an empty task list.
- Regression test covers a coordinator-created task appearing in `看板` for a `clowder_cat:coordinator` direct conversation.

## Suspected Areas

```text
sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue
sections/im_web/apps/chat/src/components/ProjectKanbanPanel.vue
sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
sections/im_web/packages/datasource-vue/src/api/clowder.ts
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/clowder-ai/packages/api/src/routes/thread-tasks.ts
sections/clowder-ai/packages/api/src/routes/tasks.ts
sections/clowder-ai/packages/api/src/routes/callback-task-routes.ts
sections/clowder-ai/packages/mcp-server/src/tools/callback-tools.ts
```

## Investigation Checklist

- Capture the IM Web conversation id from the URL: `clowder_cat:coordinator/1`.
- Resolve the conversation's Clowder binding thread id used by `ClowderConversationPanel`.
- Query the board route for that exact thread id:
  - browser route: `GET /v1/clowder/thread/:threadId/tasks`
  - upstream route: `GET /api/threads/:threadId/tasks`
- Locate task `0001780553055141-000007-34422e45` in Clowder `TaskStore`.
- Compare the task's `threadId`, `userId`, `ownerCatId`, and status with the conversation binding.
- Confirm whether coordinator task creation writes to `/api/tasks`, `/api/callbacks/...`, or only posts a text line in chat.
- Confirm whether the task is created under the coordinator hub thread instead of the active IM Web direct conversation thread.
- Confirm whether `ProjectKanbanPanel` refreshes after task-created messages and after clicking `刷新`.
- Confirm whether TangSeng proxy preserves non-2xx task route responses or normalizes them into `{ tasks: [] }`.
- Check whether direct virtual cat conversations (`clowder_cat:*`) use a different binding path than group/direct human conversations.

## Regression Coverage Required

- API/store test: task created for a bound thread is returned by `GET /api/threads/:threadId/tasks`.
- TangSeng proxy test: `GET /v1/clowder/thread/:threadId/tasks` forwards successful task lists and preserves upstream errors.
- Store test: `fetchThreadTasks` distinguishes `empty`, `route_failed`, and `thread_binding_mismatch`.
- Component test: `ProjectKanbanPanel` renders a coordinator-created task for the current thread.
- Component test: empty-board copy does not render when route failed or binding is missing/mismatched.
- Browser smoke: in `clowder_cat:coordinator` direct conversation, ask coordinator to create a task, then assert the `看板` tab shows the created task id/title.

## Notes

This issue should not be solved by parsing task ids from chat text and faking board rows. The board must read from the structured task source of truth. Chat text can be used as a diagnostic signal to detect when task creation and board queries disagree.
