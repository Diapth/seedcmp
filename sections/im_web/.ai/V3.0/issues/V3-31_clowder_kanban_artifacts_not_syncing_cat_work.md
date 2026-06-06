# V3-31: Clowder Kanban And Artifacts Stay Empty While Cats Are Working

## Status

Open. Reported from the live IM Web V3.0 + Clowder coordinator/cat flow on 2026-06-04. The chat transcript shows cats actively working and reporting completed deliverables, but the Clowder board/artifacts UI remains empty.

## Created

2026-06-04

## Labels

bug, clowder, kanban, artifacts, tasks, coordinator, cats, thread-binding, regression, ux

## Priority

P0

## User Report

The Clowder board in IM Web feels decorative instead of functional. Cats are clearly doing work in the chat, but the board still shows nothing and the artifact panel has no outputs.

The live screenshots show a cat reporting:

- implementation and QA are complete,
- three tasks are marked done,
- unit tests passed `vitest 4/4`,
- lint passed,
- a page was delivered at `/showcase/wedding-invite`,
- files were created under a source path,
- a zip attachment was sent as `wedding-invite-final-20260604.zip`.

The user-visible result is: "左边的Clowder看板成了摆设，猫猫明明已经在干活了，为什么还是什么都没有，产物也没有".

## Impact

- Users cannot see task progress, owner assignment, blocked state, or done state outside the raw chat transcript.
- Users cannot discover generated artifacts from the Clowder panel even after the cat claims files were produced.
- PM/coordinator workflows lose their main value: the visible work board does not reflect the actual work.
- The system can say "done" while the structured task/artifact UI remains empty, creating a trust gap.

## Related Issues

- `V3-24_live_smoke_clowder_binding_agent_panel_degraded_and_history_regressions.md` tracked earlier Clowder panel and binding regressions.
- `V3-28_reply_context_identity_templates_and_model_selection_regressions.md` tracks nearby coordinator/reply identity problems.
- `V3-30_clowder_local_preview_listen_eperm.md` tracks the separate local preview startup failure where the cat attempted `127.0.0.1:4301` but the environment returned `listen EPERM`.

## Reproduction Notes

1. Open a Clowder-enabled conversation in IM Web.
2. Ask a coordinator/cat to complete a multi-step deliverable that writes files.
3. Watch the chat transcript while cats report progress, tests, and final artifacts.
4. Open the Clowder panel.
5. Click `看板`.
6. Observe whether tasks appear in `进行中`, `阻塞中`, `待办`, or `已完成`.
7. Click `产物`.
8. Observe whether generated files, preview routes, source paths, or zip attachments appear.

## Expected Behavior

- When cats start work, the Clowder board should show the active task/invocation within the polling interval.
- When cats complete work, tasks should move to `已完成` and preserve owner cat, title, reason, timestamps, dependencies, and artifact references.
- Generated files should appear in `产物` without requiring the user to search the chat transcript.
- If cats produce files but fail to declare artifacts, the UI should show an "undeclared output" or "artifact declaration missing" warning rather than an empty panel.
- The panel should clearly distinguish these states:
  - no Clowder thread is bound,
  - thread is bound but no tasks exist,
  - tasks exist but artifacts are missing,
  - artifact route failed,
  - artifacts exist but preview/download is unavailable.
- The board should track both coordinator-created tasks and direct cat work, not only one narrow path.

## Acceptance Criteria

- A live Clowder task appears on the IM Web `看板` tab while the cat is working.
- A completed Clowder task moves to `已完成` after the cat reports done.
- The board includes the responsible cat identity and does not collapse all work under an anonymous/default owner.
- A generated deliverable such as `/showcase/wedding-invite` appears in the `产物` tab after completion.
- A zip attachment delivered in chat is cross-linked from the `产物` tab when it belongs to the same thread/task.
- If no `cat_cafe_declare_artifact` call happened, IM Web surfaces a clear missing-declaration state and gives maintainers enough metadata to debug it.
- `ProjectKanbanPanel` and `ProjectArtifactsPanel` refresh on active thread changes, message completion, and manual refresh.
- Wrong or missing thread binding does not look like an empty board; it shows the binding problem and recovery action.
- Browser evidence covers the exact live flow: cat starts work, board updates, cat finishes, artifacts appear.

## Suspected Areas

```text
sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue
sections/im_web/apps/chat/src/components/ProjectKanbanPanel.vue
sections/im_web/apps/chat/src/components/ProjectArtifactsPanel.vue
sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
sections/im_web/packages/datasource-vue/src/api/clowder.ts
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/clowder-ai/packages/api/src/domains/cats/services/stores/ports/TaskStore.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/artifact-tracking.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/lead-agent-selector.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/route-helpers.ts
sections/clowder-ai/packages/mcp-server/src/tools/callback-tools.ts
```

## Investigation Checklist

- Confirm whether the current conversation has `conversation.binding.threadId`. If not, the panel should not render empty board state as if the thread were valid.
- Query `GET clowder/thread/:threadId/tasks` and `GET clowder/thread/:threadId/artifacts` for the bound thread used by the panel.
- Compare the bound thread id against the thread id shown in Clowder logs and the cat's final message.
- Confirm whether cats/coordinator call `cat_cafe_create_task`, `cat_cafe_update_task`, and `cat_cafe_declare_artifact` during this workflow.
- Check whether artifacts are declared under the wrong thread id, wrong owner user, wrong coordination id, or wrong project path.
- Check whether `ProjectKanbanPanel` polling starts only after the tab mounts and whether it refreshes when messages finish.
- Check whether `ProjectArtifactsPanel` only lists explicitly declared artifacts and ignores rich file blocks sent in the IM transcript.
- Check whether the Clowder/TangSeng proxy hides 401/403/404 task/artifact route errors behind a generic empty list.

## Regression Coverage Required

- Store/API test for task route proxy: bound thread with tasks returns non-empty task list to IM Web.
- Store/API test for artifact route proxy: bound thread with declared artifacts returns non-empty artifact list to IM Web.
- Component test for `ProjectKanbanPanel` rendering tasks in all four statuses with owner cat badges.
- Component test for `ProjectArtifactsPanel` rendering declared code/doc/preview/file artifacts.
- Component test proving missing thread binding renders a binding error, not an empty board.
- Integration test where a Clowder rich file block in chat is cross-linked or at least diagnosed when not present in the artifact ledger.
- Browser smoke for a real coordinator task that produces a file and then verifies board + artifacts tabs.

## Required Verification

```bash
cd sections/im_web
pnpm type-check
pnpm test:unit
```

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/clowderPanel.test.ts tests/clowderControlStore.test.ts tests/clowderBridgeContracts.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

```bash
cd sections/im/TangSengDaoDaoServer
go test -count=1 ./modules/clowder
```

```bash
cd sections/clowder-ai/packages/api
pnpm test -- task-progress-route threads-endpoint queue-processor
```

## Notes

The Clowder prompt already tells cats that files must be declared with `cat_cafe_declare_artifact` or users will not see them in the artifact panel. This issue should verify both halves of that contract: cats/tooling must declare artifacts, and IM Web must make declared or missing-declaration states visible instead of leaving the panel empty.
