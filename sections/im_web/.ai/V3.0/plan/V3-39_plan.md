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
