# V3-32: Runtime And Agent Work Directories Need Project-Scoped Paths

## Status

Open. Reported from the live IM Web V3.0 + Clowder coding flow on 2026-06-04. Follow-up review clarified that the `/tmp/seedcmp-*` directories are not all accidental garbage: they appear to include runtime caches, validation checkouts, agent workspaces, QA/staging copies, and patch staging output. The real issue is path policy: project-specific runtime and agent work should live under the user's launch/project directory or a configured project runtime directory, not scattered in `/tmp`.

## Created

2026-06-04

## Labels

bug, clowder, workspace, runtime, worktree, artifacts, lifecycle, observability, cleanup, regression

## Priority

P0

## User Report

The user found several `seedcmp-*` directories under `/tmp` after asking cats to produce code and deliverables:

```bash
ls /tmp/seedcmp-
```

Observed:

```text
seedcmp-coordinator-todo-app/
seedcmp-go-build-cache/
seedcmp-main-check.8bLpd5/
seedcmp-main-patch/
seedcmp-wedding-fix.BufuZz/
seedcmp-wt-wedding-qa-fix/
```

Initial concern was that generated code was leaking outside the project workspace. After inspection, the better framing is: Clowder/agents are creating useful runtime and work artifacts, but the path root is wrong and invisible. These should be placed under a predictable project-scoped root, then classified, surfaced, linked, and cleaned in a trustworthy way.

## Local Classification

Current local evidence suggests these directories have different lifecycle meanings:

| Path | Size | Observed role | Notes |
|---|---:|---|---|
| `/tmp/seedcmp-go-build-cache` | 472M | Rebuildable Go build cache | Safe in principle if documented, TTL-managed, and excluded from artifact/work output. |
| `/tmp/seedcmp-main-check.8bLpd5` | 597M | Clean validation/baseline checkout | Git checkout on `main`, remote `git@github.com:Diapth/seedcmp.git`, no dirty status observed. Likely runtime verification state. |
| `/tmp/seedcmp-main-patch` | 116K | Patch staging | Contains `0001-IM-Web.patch`; should be linked to the task/result if it is an agent output. |
| `/tmp/seedcmp-coordinator-todo-app` | 2.7G | Agent implementation workspace | Full git checkout on branch `yunyi`, remote points at `/home/yunyi/Desktop/Bytedance_cmp/seedcmp`, with uncommitted todo-app changes. |
| `/tmp/seedcmp-wedding-fix.BufuZz/checkout` | part of 417M | Agent/QA fix checkout | Git checkout on branch `yunyi`, remote points at the local seedcmp repo, with untracked wedding invite output and `node_modules`. |
| `/tmp/seedcmp-wt-wedding-qa-fix` | 84K | Partial QA/staging copy | Contains a small `sections/clowder-ai` tree; not observed as a git root. |

Dirty status examples:

```text
/tmp/seedcmp-coordinator-todo-app
A sections/clowder-ai/packages/web/src/app/todo/page.tsx
M sections/clowder-ai/packages/web/src/components/ActivityBar.tsx
M sections/clowder-ai/packages/web/src/components/AppShell.tsx
A sections/clowder-ai/packages/web/src/components/todo/TodoApp.tsx
A sections/clowder-ai/packages/web/src/components/todo/__tests__/todo-model.test.ts
A sections/clowder-ai/packages/web/src/components/todo/todo-model.ts
```

```text
/tmp/seedcmp-wedding-fix.BufuZz/checkout
?? sections/clowder-ai/packages/web/node_modules
?? sections/clowder-ai/packages/web/src/app/showcase/wedding-invite/
```

## Problem

The existence of runtime/work directories is not necessarily wrong. The issue is that project-specific directories are being created under a surprising global temp location instead of a project-scoped root.

- IM Web does not show which task/thread/cat created each runtime directory.
- The Clowder board can stay empty even while an agent workspace contains dirty generated work.
- The artifacts panel does not explain whether outputs live in the bound project, an agent worktree, a patch staging directory, or a disposable cache.
- Final chat replies can mention a deliverable, but the corresponding source path may exist only in an untracked `/tmp` checkout.
- Cleanup is unsafe because cache, baseline checkout, patch output, and uncommitted agent work have different deletion semantics.
- Disk usage grows into gigabytes without an owner, TTL, cleanup policy, or UI affordance.
- Users cannot predict where Clowder will put runtime state because the path is not derived from the launch directory or project runtime directory.

## Impact

- Users cannot tell whether the canonical deliverable is in the main project, an agent worktree, a patch file, or a temporary checkout.
- Agents can complete work in an isolated workspace while the visible project and IM Web artifact panel show nothing.
- QA/PM cannot safely decide whether to apply, preview, archive, or discard a generated output.
- Automatic cleanup could delete useful agent work if runtime directories are not classified.
- Never cleaning them causes disk growth and stale worktrees.
- Security and audit assumptions weaken when a workspace path outside the bound project root becomes part of the delivery flow without metadata.
- Multiple projects using the same host can collide under `/tmp/seedcmp-*`, making ownership and cleanup ambiguous.

## Related Issues

- `V3-31_clowder_kanban_artifacts_not_syncing_cat_work.md` tracks the UI symptom where work and artifacts do not appear in the Clowder panel.
- `V3-30_clowder_local_preview_listen_eperm.md` tracks the separate local preview startup failure caused by `listen EPERM` when the cat attempted `127.0.0.1:4301`.
- `V3-29_deployment_confirmation_button_unusable.md` tracks another missing action bridge between chat UI and Clowder runtime state.

## Reproduction Notes

1. Start from the main project workspace:

   ```text
   /home/yunyi/Desktop/Bytedance_cmp/seedcmp
   ```

2. Ask a Clowder cat/coordinator to implement a code-producing task.
3. Wait until the cat reports implementation, QA, file paths, patch output, or final deliverables.
4. Inspect `/tmp/seedcmp-*`.
5. For each directory, inspect:

   ```bash
   du -sh /tmp/seedcmp-*
   git -C <dir-or-checkout> status --short
   git -C <dir-or-checkout> remote -v
   ```

6. Open IM Web's Clowder board and artifacts panel.
7. Observe whether the runtime directory, dirty files, patch output, and cleanup/apply actions are visible.
8. Observe whether the runtime/work directory is under the launch/project root or a surprising global temp root.

## Expected Behavior

- Clowder may use isolated runtime directories and worktrees, but project-specific paths must be rooted under the user launch directory, the bound project directory, or an explicit project runtime directory.
- Recommended default layout should be predictable, for example:
  - `<project>/.clowder/runtime/`
  - `<project>/.clowder/workspaces/`
  - `<project>/.clowder/cache/`
  - `<project>/.clowder/patches/`
- If the runtime must avoid writing inside the git checkout, it should use a sibling or configured root derived from the launch/project path, such as `<launch-dir>/.clowder-runtime/<project-id>/`.
- `/tmp` should not be the default home for project-specific checkouts, patch staging, QA copies, or final/source artifacts.
- `/tmp` is acceptable only for truly disposable process temp files or documented rebuildable cache that has no user deliverable value and is safe to delete.
- Metadata should include type, project root, thread id, task id, owner cat, created time, last activity time, size, git branch, dirty status, artifact refs, and cleanup policy.
- Rebuildable cache directories such as Go build cache should be marked as cache and TTL-cleanable.
- Baseline/validation checkouts should be marked as verification workspaces and cleaned automatically when no longer referenced.
- Agent implementation workspaces should be surfaced in IM Web with the responsible cat, task, changed files, and apply/import/discard actions.
- Patch staging directories should be surfaced as artifacts or change proposals, not left as anonymous files under `/tmp`.
- Final deliverables should be declared from the bound project or a registered agent workspace; IM Web should never silently hide that the deliverable lives in an isolated runtime checkout.
- Cleanup must be type-aware: cache and expired clean checkouts can be automatic; dirty agent workspaces require an explicit discard/apply/archive decision.

## Acceptance Criteria

- No project-specific Clowder runtime checkout, agent workspace, QA staging copy, patch staging directory, or final/source artifact is created directly under `/tmp` by default.
- Runtime/work paths are derived from the launch directory, bound project directory, or explicit config such as `CLOWDER_PROJECT_RUNTIME_ROOT`.
- Existing runtime categories have project-scoped locations:
  - caches under a documented cache directory,
  - validation checkouts under a runtime verification directory,
  - agent workspaces under a runtime workspaces directory,
  - patches under a runtime patches/artifacts directory.
- Every runtime/work directory created by Clowder is registered in metadata or uses an explicitly documented cache name/policy.
- IM Web's Clowder panel exposes registered agent workspaces for the current thread/task, including path, owner, status, changed files, and size.
- The artifacts panel links to patch staging output such as `0001-IM-Web.patch` when it belongs to the current task.
- A dirty agent workspace cannot be mistaken for a completed project deliverable unless its changes are applied, exported as a patch, or explicitly archived.
- Cache directories are clearly marked rebuildable and can be cleaned by TTL without user review.
- Clean baseline checkouts are automatically cleaned after TTL or after the verification task closes.
- Dirty agent checkouts provide explicit actions: preview changed files, apply/import to bound project, export patch, discard, or archive.
- The Clowder board reflects active/finished work even when the work happened in an isolated agent checkout.
- Final chat messages include a stable deliverable link or registered workspace reference instead of only prose.
- Browser evidence covers a todo/wedding style code task and shows the runtime/work directories under the project-scoped root in the Clowder panel rather than requiring terminal inspection.
- Regression evidence proves a fresh task does not create new `/tmp/seedcmp-*` project work directories; any `/tmp` usage is limited to documented disposable temp/cache.

## Suspected Areas

```text
sections/clowder-ai/packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/route-helpers.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/artifact-tracking.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/lead-agent-selector.ts
sections/clowder-ai/packages/api/src/domains/cats/services/stores/ports/ThreadStore.ts
sections/clowder-ai/packages/mcp-server/src/tools/callback-tools.ts
sections/clowder-ai/packages/api/src/routes/workspace.ts
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue
sections/im_web/apps/chat/src/components/ProjectKanbanPanel.vue
sections/im_web/apps/chat/src/components/ProjectArtifactsPanel.vue
```

## Investigation Checklist

- Identify the creator and intended purpose of each current `/tmp/seedcmp-*` directory.
- Determine whether the directory is cache, baseline checkout, agent workspace, QA workspace, patch staging, or stale/unknown.
- Trace how the bound project path is passed to agent invocation and whether agents intentionally create local-clone workspaces.
- Find where the runtime chooses `/tmp` as the root and replace it with a launch/project-derived runtime root.
- Add/standardize configuration for the project runtime root and document precedence: explicit env/config, launch directory, bound project directory fallback.
- Confirm whether current task/artifact APIs have a place to store workspace refs and patch refs.
- Check whether `cat_cafe_declare_artifact` accepts artifacts from registered agent workspaces or only bound-project-relative paths.
- Decide the cleanup policy per type, especially for dirty agent workspaces and generated `node_modules`.
- Add a recovery/visibility route for existing untracked runtime dirs so they can be inspected before cleanup.
- Ensure cleanup UI says what will be deleted and whether dirty changes/patches exist.

## Regression Coverage Required

- Unit test for workspace registration metadata covering cache, clean checkout, dirty agent workspace, and patch staging.
- Unit test for runtime path resolution proving project-specific paths are created under the launch/project runtime root, not `/tmp`.
- API test for listing runtime/agent workspaces by thread id and task id.
- API test for cleanup policy: cache can expire automatically; dirty agent workspace requires explicit discard/apply/archive.
- Artifact declaration test proving registered agent-workspace outputs can be surfaced without pretending they are in the bound project root.
- Component test for IM Web rendering registered workspaces and patch refs in the Clowder panel/artifacts tab.
- Browser smoke where a code-producing task creates an isolated workspace under the project runtime root and the user can see changed files and choose apply/export/discard from IM Web.

## Required Verification

```bash
cd sections/clowder-ai/packages/api
pnpm test -- workspace threads-endpoint task-progress-route queue-processor
```

```bash
cd sections/clowder-ai/packages/mcp-server
pnpm test
```

```bash
cd sections/im/TangSengDaoDaoServer
go test -count=1 ./modules/clowder
```

```bash
cd sections/im_web
pnpm type-check
pnpm test:unit
```

## Notes

Do not collapse all current `/tmp/seedcmp-*` directories into one deletion rule. Some are safe rebuildable caches, some are verification checkouts, and some contain dirty agent work or patch output. The forward-looking fix is to move new runtime/work output to a project-scoped root, classify and surface it, then make cleanup type-aware. Existing `/tmp` directories can be migrated, archived, or cleaned according to that classification.
