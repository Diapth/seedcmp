# V3-39: Clowder Needs Clear Boundaries For Agent Artifact Storage

## Status

Open proposal. Reported from live IM Web V3.0 Clowder usage on 2026-06-05 after discussing where agent-generated files should live: inside `seedcmp/sections/clowder-ai/.clowder/workspaces`, inside a user-facing `maomi_workspace`, or only as web-side downloadable attachments.

## Created

2026-06-05

## Labels

proposal, clowder, artifacts, files, workspace, maomi-workspace, runtime-workspace, attachments, architecture, ux

## Priority

P1

## User Question

The user asked:

```text
你认为在 seedcmp 项目里面，智能体产生的文件，是应该 seedcmp/sections/clowder-ai/.clowder/workspaces 放在这里，还是 maomi_workspace 这里呢，或者是无所谓，反正用户只看 web 端的文件
```

The product decision should not be "无所谓". Even if users primarily consume files through Web attachment cards, the backend source location determines durability, traceability, cleanup, deployment, future edits, and whether the source repo gets polluted by generated user projects.

## Problem

Clowder currently has several possible places for agent-produced files:

- internal runtime/worktree directories such as `sections/clowder-ai/.clowder/workspaces`,
- user-facing project folders such as `maomi_workspace`,
- temporary folders such as `/tmp`,
- Clowder upload/public media folders,
- IM Web/TangSeng file attachments,
- artifact records in thread/task metadata.

Without a clear boundary, the same file can be treated inconsistently:

- an agent may create a real file in an internal scratch directory,
- the chat may claim the file was sent,
- the web UI may only receive text,
- future tasks may not know where to continue editing,
- generated files may dirty the `seedcmp` source repo,
- cleanup rules may delete files the user expected to keep.

## Proposed Policy

Separate agent files into three explicit layers.

### 1. Internal Runtime Workspace

```text
seedcmp/sections/clowder-ai/.clowder/workspaces
```

Purpose:

- agent scratch space,
- isolated worktrees,
- temporary execution state,
- runtime caches,
- provider/session internals,
- transient staging before an artifact is declared or published.

This directory should be considered Clowder implementation detail. It should not be the long-term home for user-facing project deliverables.

### 2. User Project Workspace

Recommended default for the current local layout:

```text
/home/yunyi/Desktop/Bytedance_cmp/maomi_workspace
```

Purpose:

- durable user-facing projects,
- generated source files,
- project archives before publication,
- screenshots/reports that belong to a project,
- previews/deployment targets,
- metadata linking thread ids, task ids, artifacts, and cats.

Example:

```text
maomi_workspace/
  wedding/
    .clowder/project.json
    src/
    artifacts/
    previews/
  todo/
    .clowder/project.json
    src/
    artifacts/
    previews/
```

User-facing project outputs should be created here by default, not inside `seedcmp/sections/clowder-ai/.clowder/workspaces`.

### 3. Web Delivery Attachment

Purpose:

- browser-usable downloadable file cards,
- public or authenticated media URLs,
- preview/download metadata,
- durable IM history payloads.

When a user asks "打包发给我", Clowder should package from the chosen user workspace or artifact source, publish the result to a web-accessible media/upload route, and send a structured IM file payload. The web attachment should reference the source workspace/artifact in metadata, but the browser should not depend on a local filesystem path.

## Expected Behavior

- Clowder distinguishes internal runtime files, user project files, and delivered web attachments.
- Agent scratch files may be created under `.clowder/workspaces`, but promoted deliverables must be declared as artifacts and copied/moved/published to the proper layer.
- Project-like deliverables default to `maomi_workspace/<project>` or another configured user workspace root.
- Chat-delivered files are published to a browser-usable URL and rendered as IM Web file cards.
- Artifact metadata records both:
  - source location, such as `workspaceId`, `relativePath`, `artifactId`,
  - delivery location, such as `url`, `contentType`, `size`, `downloadName`.
- Internal runtime cleanup must not delete user project files or web attachment files.
- User workspace cleanup/archive must not break historical web attachments unless explicitly allowed.
- IM Web can show the active project workspace separately from individual sent/downloadable files.

## Recommended Decision

Use this contract:

```text
seedcmp/sections/clowder-ai/.clowder/workspaces  = internal runtime/scratch
/home/yunyi/Desktop/Bytedance_cmp/maomi_workspace = durable user project source
IM Web file card / uploads URL                    = user delivery surface
```

In short: agents may work in `.clowder/workspaces`, but user assets should settle in `maomi_workspace`; when the user asks to receive a file, Clowder should publish it as a real Web attachment.

## Acceptance Criteria

- A documented artifact storage policy exists and is referenced by the Clowder agent invocation and connector file-delivery flows.
- Clowder can resolve:
  - internal runtime workspace root,
  - user project workspace root,
  - public/upload delivery root.
- New project files are not written under `seedcmp/sections/clowder-ai/.clowder/workspaces` as their durable source unless explicitly marked as internal/transient.
- New user project files default to the configured `maomi_workspace` root.
- Sending a file to Web creates a structured attachment with a browser-usable URL and metadata linking back to the source artifact/workspace.
- Artifact records distinguish `sourcePath`/`workspaceRelativePath` from `deliveryUrl`.
- Cleanup jobs have separate policies for runtime scratch, user workspace artifacts, and web-delivered media.
- IM Web can display where a file came from without exposing confusing internal runtime paths as the primary user concept.

## Relationship To Existing Issues

- Extends `V3-37_clowder_unified_maomi_project_workspace.md` by clarifying the boundary between internal Clowder runtime workspaces and user-facing Maomi Workspace folders.
- Supports `V3-38_clowder_agent_files_not_delivered_to_web.md` by defining where a file should be sourced from before being published as a Web attachment.
- Related to `V3-32_clowder_workspace_outputs_leak_to_tmp.md`, which says project outputs should not disappear into temp/runtime-only locations.
- Related to `V3-31_clowder_kanban_artifacts_not_syncing_cat_work.md`, because artifact records must point to the correct source/delivery locations.

## Suspected Areas

```text
sections/clowder-ai/packages/api/src/domains/runtime-workspaces/
sections/clowder-ai/packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts
sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/route-helpers.ts
sections/clowder-ai/packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts
sections/clowder-ai/packages/api/src/infrastructure/connectors/adapters/ImWebAdapter.ts
sections/clowder-ai/packages/api/src/routes/thread-workspaces.ts
sections/clowder-ai/packages/api/src/routes/callback-task-routes.ts
sections/clowder-ai/packages/mcp-server/src/tools/callback-tools.ts
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/im/TangSengDaoDaoServer/modules/clowder/outbound.go
sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue
sections/im_web/apps/chat/src/components/ProjectArtifactsPanel.vue
sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
```

## Investigation Checklist

- List every place Clowder currently writes agent-generated files and classify it as runtime, user workspace, upload/media, or unknown.
- Check whether `.clowder/workspaces` is inside a source-controlled repo and whether generated files can dirty `git status`.
- Define configuration/env vars for:
  - internal runtime root,
  - user workspace root,
  - upload/public delivery root.
- Decide promotion semantics: when does a runtime file become a user artifact?
- Decide copy vs move behavior when promoting from runtime scratch to `maomi_workspace`.
- Decide whether archives requested by the user are stored under `maomi_workspace/<project>/artifacts` before upload.
- Ensure direct chats, group chats, coordinator tasks, and cat task callbacks use the same artifact policy.
- Ensure generated file paths shown to users never default to internal `.clowder/workspaces` paths unless in diagnostics/debug UI.
- Ensure historical Web attachments survive runtime workspace cleanup.

## Regression Coverage Required

- Unit test for resolving internal runtime root vs user workspace root vs upload root.
- Unit test proving project deliverables default to `maomi_workspace`, not `.clowder/workspaces`.
- Artifact metadata test proving `sourcePath` and `deliveryUrl` are distinct fields.
- Connector test proving a file can be packaged from `maomi_workspace`, published to a Web URL, and sent as a file attachment.
- Cleanup-policy test proving deleting runtime scratch does not remove user workspace artifacts or historical web attachments.
- Browser smoke: generate a project artifact, view it in the Clowder panel as part of the active Maomi Workspace, then request "打包发给我" and verify the resulting IM Web file card downloads successfully.

## Notes

This issue is about ownership and lifecycle, not only path naming. Web delivery can hide local paths from the user, but the system still needs a stable source-of-truth boundary so agents know where to continue work and Clowder knows what can be cleaned up safely.

---

# Implementation Plan

## 0. Current State (grounding)

The three layers proposed above already exist as separate primitives in code — the gap is that they are not unified behind one documented policy, artifact records do not distinguish source vs delivery, and cleanup has no per-layer rules.

| Layer | Existing resolver | Env / default | Marker |
|---|---|---|---|
| Runtime / scratch | `domains/runtime-workspaces/project-runtime-root.ts` → `resolveProjectRuntimeRoot()` | `CLOWDER_PROJECT_RUNTIME_ROOT` / `CAT_CAFE_PROJECT_RUNTIME_ROOT` → fallback `<projectRoot>/.clowder` | — |
| User project workspace | `domains/maomi-workspaces/workspace-root.ts` → `resolveMaomiWorkspaceRoot()` | `MAOMI_WORKSPACE_ROOT` / `CLOWDER_USER_WORKSPACE_ROOT` → fallback sibling `maomi_workspace` | `.clowder-root.json` |
| Web delivery | `infrastructure/connectors/OutboundDeliveryHook.ts` → `publishLocalFileReference()` / `maybeCreateWorkspaceArchive()` | `UPLOAD_DIR` → `/uploads/<stem>.<ext>` | — |

Key observations from the code:
- `OutboundDeliveryHook.maybeCreateWorkspaceArchive()` already locates the user workspace via the `.clowder-root.json` marker and packages a `.tar.gz` into `tmpdir()` before publishing to `/uploads/`. This is the "打包发给我" path the reference spec exercises.
- `invoke-single-cat.ts` already injects `MAOMI_WORKSPACE_ROOT` into the callback env (line ~826) and threads `artifactSearchRoots` through `QueueProcessor` → `OutboundDeliveryHook`.
- There is **no** single module that exposes all three roots together, **no** artifact record that stores `sourcePath` + `deliveryUrl` as distinct fields, and **no** cleanup policy separating the three.

## 1. Scope of this change

1. Add a single **artifact storage policy** module that resolves and exposes all three roots and is the one referenced contract.
2. Make artifact records distinguish `sourcePath` / `workspaceRelativePath` from `deliveryUrl`.
3. Add per-layer cleanup policy boundaries (runtime scratch vs user workspace vs delivered media).
4. Default new user project deliverables to `maomi_workspace`, never to `.clowder/workspaces` as durable source.
5. Add an automated browser E2E (login → create Codex OAuth cat → generate artifact → "打包发给我" → verify download + provenance), modeled on `apps/chat/tests-e2e/verify-file-delivery.spec.ts`.

Out of scope: changing the TangSeng Go connector, redesigning the kanban UI. Those are tracked in V3-31 / V3-38.

## 2. Backend changes

### 2.1 Unified policy module
- New file `sections/clowder-ai/packages/api/src/domains/artifacts/artifact-storage-policy.ts`:
  - `resolveArtifactStoragePolicy({ projectPath, launchedProjectRoot, env })` returns
    `{ runtimeRoot, userWorkspaceRoot, deliveryRoot, sources }` by composing the existing
    `resolveProjectRuntimeRoot()` + `resolveMaomiWorkspaceRoot()` + `getDefaultUploadDir()`.
  - Helper `classifyPath(absPath)` → `'runtime' | 'userWorkspace' | 'delivery' | 'unknown'` for diagnostics and cleanup guards.
  - Helper `isDurableUserAsset(absPath)` → false when the path is under the runtime root, true when under the user workspace root.
- Keep size limit ≤200 lines (repo rule); split helpers into `artifact-path-classify.ts` if needed.

### 2.2 Artifact record fields
- Extend the artifact metadata type (search `artifactId` / `relativePath` in `domains/cats` + `routes/thread-workspaces.ts`, `callback-task-routes.ts`) to carry both:
  - source: `workspaceId`, `workspaceRelativePath`, `sourcePath`, `artifactId`
  - delivery: `deliveryUrl`, `contentType`, `size`, `downloadName`
- In `OutboundDeliveryHook`, when publishing (`publishLocalFileReference` / `maybeCreateWorkspaceArchive`), record the resolved `sourcePath` alongside the returned `/uploads/...` `deliveryUrl` so the two are never conflated.

### 2.3 Default deliverables to user workspace
- In `invoke-single-cat.ts` / `route-helpers.ts`, ensure the agent's declared durable deliverables resolve under `userWorkspaceRoot`, not `runtimeRoot`. Promotion semantics: a runtime scratch file becomes a user artifact when explicitly declared/published — copy (not move) into `maomi_workspace/<project>/artifacts` before upload.

### 2.4 Cleanup boundaries
- Add policy guards so runtime-scratch cleanup uses `classifyPath` and refuses to delete anything classified `userWorkspace` or `delivery`. User-workspace archive/cleanup must not unlink already-published `/uploads/...` media.

## 3. Tests

### 3.1 Unit (vitest, alongside existing api tests)
- `artifact-storage-policy.test.ts`: resolves runtime vs user vs delivery roots from env and defaults; proves user deliverables default to `maomi_workspace`, not `.clowder/workspaces`.
- Artifact metadata test: `sourcePath`/`workspaceRelativePath` and `deliveryUrl` are distinct, populated fields.
- Cleanup-policy test: deleting runtime scratch does not remove user-workspace artifacts or `/uploads/` media (via `classifyPath` guard).

### 3.2 E2E browser smoke (new spec)
New file `sections/im_web/apps/chat/tests-e2e/verify-artifact-storage-boundaries.spec.ts`, modeled on `verify-file-delivery.spec.ts` and reusing helpers from `helpers/v3-clowder.ts`:

1. **Login** — `await login(page)` (helper handles credentials/env).
2. **Automate Codex OAuth cat creation** — navigate to `/chat/clowder-cats`, delete any existing `Codex` row for a fresh state, then fill name `Codex` / mention `@codex`, select running platform `openai` (`select.nth(1)`), select add type `oauth` (`select.nth(2)`), click `创建猫猫并连接`. (Identical flow to the reference spec; the OAuth handshake is driven by the connect button.)
3. **Generate a durable project artifact** — `@codex 在 Maomi Workspace 里创建一个项目并生成一个文件`, poll for the agent reply.
4. **Provenance assertion** — the delivered file card / artifact metadata references a `maomi_workspace` source, NOT a `.clowder/workspaces` path (assert the visible path/metadata does not expose internal runtime paths as primary).
5. **Package & deliver** — `await sendChatMessage(page, '@codex 把 Maomi Workspace 打包发给我')`, poll `.message-list .msg-row` for `/maomi_workspace\.(zip|tar\.gz|gz)/`.
6. **Download assertion** — click `下载`, capture `page.waitForEvent('download')`, assert URL matches `/\/uploads\/[a-zA-Z0-9_-]+\.(zip|tar\.gz|gz)/` (proves source→delivery promotion).
7. **History recovery** — `page.reload()`, re-query rows, assert count preserved and download still works (proves delivered media survives independent of runtime scratch).

Run: `pnpm --filter chat exec playwright test tests-e2e/verify-artifact-storage-boundaries.spec.ts` (config: `apps/chat/playwright.config.ts`). Honors `TEST_USERNAME` / `TEST_PASSWORD` / `CLOWDER_URL` env from the helper.

## 4. Acceptance mapping

| Acceptance criterion | Covered by |
|---|---|
| Documented policy referenced by invocation + delivery | §2.1 module + this plan |
| Resolve runtime / user / delivery roots | §2.1 `resolveArtifactStoragePolicy` + unit test |
| No durable user files under `.clowder/workspaces` | §2.3 + §3.1 default test |
| New user files default to `maomi_workspace` | §2.3 + §3.2 step 3–4 |
| Web send → browser URL + back-link metadata | §2.2 + §3.2 step 5–6 |
| Artifact distinguishes `sourcePath` / `deliveryUrl` | §2.2 + §3.1 metadata test |
| Separate cleanup policies per layer | §2.4 + §3.1 cleanup test |
| IM Web hides confusing runtime paths | §3.2 step 4 provenance assertion |

## 5. Rollout & commit

- Implement §2 → run `pnpm check` + `pnpm lint` (Biome/types) in `packages/api`.
- Run unit tests, then the new E2E against a local stack (`CLOWDER_URL=http://localhost:3003`).
- On green, make a single Chinese commit, e.g.:

  ```text
  feat(clowder): 明确智能体产物的三层存储边界并补充端到端校验

  - 新增 artifact-storage-policy 统一解析 运行时/用户工作区/交付 三层根目录
  - 产物记录区分 sourcePath/workspaceRelativePath 与 deliveryUrl
  - 用户项目产物默认落在 maomi_workspace，运行时清理不再误删用户/交付文件
  - 新增 verify-artifact-storage-boundaries E2E：自动登录、创建 Codex OAuth 猫猫、
    生成产物、打包发送并校验下载与来源
  ```

  Commit only after tests pass; branch first if currently on the default branch.
