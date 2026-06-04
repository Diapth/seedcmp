# V3-37: Clowder Needs A Unified Maomi Project Workspace

## Status

Open proposal. Reported from live IM Web V3.0 Clowder usage on 2026-06-04. Users want cat-generated work to live under one predictable workspace root, with a project folder per user intent, instead of scattered runtime/worktree folders.

## Created

2026-06-04

## Labels

feature, clowder, workspace, artifacts, projects, threads, coordinator, ux, architecture

## Priority

P1

## User Idea

The user wants a unified folder for cat outputs, tentatively described as:

```text
maomi_workspace/
  wedding/
  todo/
```

Example flow:

- User tells the coordinator: "做一个婚礼网页".
- Coordinator proposes or creates `maomi_workspace/wedding`.
- All source files, artifacts, previews, patches, and generated outputs for that wedding task live under that folder.
- Later, user asks for a todo app.
- Coordinator proposes or creates `maomi_workspace/todo`.
- Todo-related outputs live under that folder.

The user is unsure how this should relate to chat threads, but the desired mental model is clear: "猫猫们的产物统一放到一个文件夹下面".

## Problem

Today Clowder work can appear in several places:

- the main repo,
- temporary agent worktrees,
- `/tmp/seedcmp-*`,
- separate IDE workspace roots,
- chat attachments,
- undeclared artifacts,
- task-specific patch staging directories.

This makes it hard for users to answer simple questions:

- Where did the cats put my wedding project?
- If I ask for more wedding changes tomorrow, will they edit the same folder?
- Is this folder tied to this conversation, this task, this cat, or the whole user workspace?
- Can I safely delete or archive old generated projects?
- Why is an agent workspace showing as a separate top-level folder instead of under a known Clowder workspace?

## Proposed Concept

Introduce a user-facing "Maomi Workspace" root. The exact name can be configured, but examples should be easy to understand:

```text
<launch-or-user-dir>/maomi_workspace/
  wedding/
    .clowder/project.json
    src/
    artifacts/
    previews/
    patches/
  todo/
    .clowder/project.json
    src/
    artifacts/
    previews/
    patches/
```

## Recommended Default Location

For the current local layout, the preferred default is to put `maomi_workspace` next to the launched repo, not inside it:

```text
/home/yunyi/Desktop/Bytedance_cmp/
  seedcmp/
  maomi_workspace/
    wedding/
    todo/
```

Default resolution rule:

```text
<parent directory of launched project>/maomi_workspace
```

For example, if Clowder is launched from:

```text
/home/yunyi/Desktop/Bytedance_cmp/seedcmp
```

then the default Maomi Workspace root should be:

```text
/home/yunyi/Desktop/Bytedance_cmp/maomi_workspace
```

Rationale:

- Do not put it inside `seedcmp/` by default, because cat outputs, `node_modules`, generated apps, previews, and patches should not dirty the Clowder/IM Web source repo unless the user explicitly asks to apply them there.
- Do not put it under `/tmp`, because project outputs must be visible, durable, and inspectable.
- Do not put it directly under `~` by default, because multiple unrelated launch directories/projects would become mixed together.
- A sibling directory beside the launched repo is easy to find in the IDE and still separated from source-control status.

The root should still be configurable, for example through a setting/env var such as `CLOWDER_USER_WORKSPACE_ROOT` or `MAOMI_WORKSPACE_ROOT`, but the sibling default is the recommended local behavior.

The folder under `maomi_workspace` is a project workspace, not merely a thread folder.

Recommended relationship:

- A thread can have an `activeWorkspaceId` or `activeProjectSlug`.
- A project workspace can be linked to one or more thread ids.
- A task belongs to both a thread and, when applicable, a project workspace.
- Multiple cats working on the same user request share the same project workspace.
- A new user request in the same thread can either reuse the current workspace or create a new one after confirmation.
- A new thread may create a new workspace by default, but the user should be able to choose an existing workspace.

## Expected Behavior

- Clowder has a configured workspace root, defaulting to something user-visible such as `maomi_workspace`.
- When a user asks for a new project-like deliverable, the coordinator detects or asks for a project name.
- If the project folder does not exist, coordinator asks for confirmation before creating it, unless safe auto-create is enabled.
- Project names are normalized into slugs, for example:
  - `婚礼` -> `wedding` or user-confirmed `hunli`
  - `todo 应用` -> `todo`
- Once a workspace is selected, all cats receive it as the canonical output path.
- Artifacts and task records reference paths relative to the project workspace.
- IM Web shows the active workspace in the Clowder panel and lets users open, switch, archive, or inspect it.
- Deployment target selection can use workspace candidates, e.g. "deploy `maomi_workspace/wedding` locally".

## Acceptance Criteria

- Clowder can resolve a per-user workspace root such as `maomi_workspace`.
- Coordinator can propose a new project workspace name from user intent.
- User can approve, rename, or reject workspace creation before files are written.
- Generated files for a project are written under the selected workspace folder by default.
- Tasks, artifacts, previews, and patches include the project workspace id/path in metadata.
- IM Web displays the active workspace for the current conversation/thread.
- A thread can reuse an existing workspace without duplicating files into a new folder.
- Asking for a new unrelated project in the same thread prompts "reuse current workspace or create new one?".
- Workspace folders contain metadata linking them to thread ids, task ids, owner user, created time, and last active time.
- No user-facing project output is created in anonymous `/tmp` or unrelated top-level worktree folders by default.

## Relationship To Existing Issues

- Related to `V3-32_clowder_workspace_outputs_leak_to_tmp.md`: V3-32 says project work should not leak to `/tmp`; this issue proposes the user-facing folder model that replaces that behavior.
- Related to `V3-31_clowder_kanban_artifacts_not_syncing_cat_work.md`: board/artifact records should point to the chosen project workspace.
- Related to `V3-35_clowder_kanban_missing_created_tasks.md`: created tasks should include workspace metadata so the board can group work by project.
- Related to `V3-36_deployment_card_missing_target_environment_inputs.md`: deployment target selection can use known workspace/project candidates.

## Suggested Data Model

```ts
interface MaomiWorkspace {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  rootPath: string;
  relativePath: string;
  linkedThreadIds: string[];
  linkedTaskIds: string[];
  createdBy: 'user' | 'coordinator' | 'cat' | 'system';
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'archived' | 'discarded';
}

interface ThreadWorkspaceBinding {
  threadId: string;
  userId: string;
  activeWorkspaceId: string | null;
  recentWorkspaceIds: string[];
}
```

## UX Requirements

- First project request:
  - "我准备在 `maomi_workspace/wedding` 创建婚礼项目，可以吗？"
  - Actions: `创建`, `改名`, `选择已有`, `取消`.
- Follow-up in same project:
  - "继续使用 `wedding` 工作区".
- Ambiguous new request in same thread:
  - "这是继续修改 `wedding`，还是创建新的 `todo` 工作区？"
- Clowder panel:
  - show active workspace path,
  - show linked tasks,
  - show artifacts inside this workspace,
  - show changed files,
  - expose archive/discard only with explicit confirmation.

## Suspected Areas

```text
sections/clowder-ai/packages/api/src/domains/runtime-workspaces/
sections/clowder-ai/packages/api/src/routes/thread-workspaces.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/route-helpers.ts
sections/clowder-ai/packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts
sections/clowder-ai/packages/mcp-server/src/tools/callback-tools.ts
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue
sections/im_web/apps/chat/src/components/ProjectArtifactsPanel.vue
sections/im_web/apps/chat/src/components/ProjectKanbanPanel.vue
sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
```

## Investigation Checklist

- Decide whether the default root should be `maomi_workspace`, `.clowder/workspaces`, or configurable with a user-facing alias.
- Find current runtime workspace APIs and whether they can represent persistent user project workspaces.
- Determine how coordinator should infer a project slug from Chinese user intent.
- Determine when coordinator must ask before creating a folder.
- Decide whether workspace creation is a chat card, a Clowder panel action, or both.
- Add thread-to-workspace binding so the same thread can continue using a project workspace.
- Ensure direct cat chats, coordinator chats, and group chats all resolve the same active workspace consistently.
- Ensure artifacts and deployment target selection can enumerate known workspaces.
- Design cleanup/archive rules for old project workspaces.

## Regression Coverage Required

- Unit test for workspace root resolution.
- Unit test for project slug proposal and collision handling.
- API test for creating, binding, listing, archiving, and selecting a workspace.
- Agent invocation test proving callback env contains the selected workspace path.
- Task/artifact test proving records include workspace metadata.
- Component test for Clowder panel active workspace display and selection.
- Browser smoke: ask for wedding page, approve `maomi_workspace/wedding`, then ask for todo app and approve `maomi_workspace/todo`; verify both folders appear and artifacts/tasks are grouped correctly.

## Notes

This issue is a product/architecture proposal. It should not be solved by only changing temp directory names. The user-facing goal is a stable mental model: cats work inside named project folders under one visible workspace root, while threads and tasks reference those folders instead of owning hidden paths.
