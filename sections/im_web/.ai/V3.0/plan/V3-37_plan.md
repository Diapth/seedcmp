# V3-37 解决计划：Clowder Needs A Unified Maomi Project Workspace

## 1. 问题现象

用户希望猫猫产出的项目都放到一个可预测的用户工作区，例如：

```text
/home/yunyi/Desktop/Bytedance_cmp/
  seedcmp/
  maomi_workspace/
    wedding/
    todo/
```

用户心智模型是：

- “做一个婚礼网页”对应 `maomi_workspace/wedding`。
- 后续继续改婚礼网页时仍使用同一个 `wedding` 项目文件夹。
- 再做 todo app 时新建或切换到 `maomi_workspace/todo`。
- tasks、artifacts、previews、patches、deployment target 都能指向同一个项目工作区。

当前代码里已经有若干“workspace”相关概念，但它们不是 V3-37 需要的用户项目工作区：

- `ThreadStore` 只有 `projectPath: string`，没有 `activeWorkspaceId`、`linkedWorkspaceIds` 或项目 workspace 绑定模型。
- `ConnectorRouter` 为新的 IM 外部 conversation 创建 thread 时使用 `findMonorepoRoot()` 作为 `projectPath`。这会把 coordinator 直聊默认绑定到 Clowder/seedcmp 源码仓库，而不是用户生成项目目录。
- `resolveProjectRuntimeRoot()` 默认把 runtime root 放在 `thread.projectPath/.clowder`，或显式 env root 下的 project-specific child；它解决的是 V3-32 的 runtime workspace 归属，不是“用户项目根目录”。
- `invoke-single-cat.ts` 从 `thread.projectPath` 推导 agent `workingDirectory`，并在 runtime root 下登记 per-invocation `agent_workspace`：`workspaces/<threadId>/<invocationId>`。这类目录是执行痕迹，不是用户想长期维护的 `wedding/` 项目。
- `RuntimeWorkspaceStore` 保存 `agent_workspace/patch_staging/cache` 等记录，并写 `.clowder-workspace.json` sidecar；没有 `MaomiWorkspace` 数据模型，也没有用户可选项目列表。
- `thread-workspaces.ts` 只列出某个 thread 的 runtime workspaces，并诊断是否在 project runtime root 下；不能创建、绑定、切换、归档项目 workspace。
- `CoordinatorKickoffCard.vue` 文案写“项目路径(workspace 内)”，但实际让用户手填绝对路径，并直接 `POST /v1/threads` 创建 group thread；没有推荐 `maomi_workspace/<slug>`、没有 slug collision handling、没有“选择已有 workspace”。
- `CoordinatorKickoff` 类型只有 `coordinationId/messageId/suggestedCats/reason/createdAt`，没有 project slug、workspace proposal、source intent。
- `TaskItem` 只有 `threadId/coordinationId/artifactRefs`，没有 `workspaceId` 或 `workspaceRelativePath`。
- `ProjectKanbanPanel.vue` 和 `ProjectArtifactsPanel.vue` 都只按 `threadId` 查询，不支持按 active workspace 分组或诊断 workspace mismatch。

## 2. 根因判断

V3-37 的根因是多个“工作区”概念被复用了同一个 `projectPath/workspace` 词，但缺少用户项目 workspace 这一层事实源。

需要拆开的概念：

- launched repo/root：当前运行 Clowder/IM Web 的源码仓库，例如 `seedcmp/`。
- user project workspace root：用户可见总目录，例如 `Bytedance_cmp/maomi_workspace/`。
- Maomi project workspace：某个用户项目目录，例如 `maomi_workspace/wedding/`。
- thread binding：某个 conversation/thread 当前正在讨论哪个 project workspace。
- runtime workspace：某次 invocation、QA、patch、cache 的执行目录，例如 `wedding/.clowder/workspaces/<thread>/<invocation>`。
- artifact/task/deployment metadata：结构化记录应同时带 `threadId` 和 `workspaceId`。

当前系统把 `thread.projectPath` 同时当成：

- agent `workingDirectory`
- artifact path 边界
- project grouping key
- runtime root resolver 输入
- connector 新 thread 的默认项目根

这会导致用户请求“做婚礼网页”时，系统无法明确回答“文件应该写到哪里”。如果继续只修改 runtime root，最多能避免 `/tmp` 泄漏，仍不能提供 `maomi_workspace/wedding` 这样的稳定项目目录。

与其他 issue 的关联：

- 与 V3-35 强关联：看板目前只按 conversation-bound `threadId` 查询。V3-37 落地后，task 应同时记录 `threadId + workspaceId`。这不会替代 V3-35 的 thread 一致性修复，但能让看板按项目 workspace 分组，并在 task 落到同 workspace 但不同 thread 时给出 `thread/workspace mismatch` 诊断。
- 与 V3-31 强关联：artifact 不应只依赖 `thread.projectPath` 和字符串 `artifactRefs`；应该记录 `workspaceId + relativePath`，否则产物 tab 无法稳定展示项目文件。
- 与 V3-32 强关联：V3-32 的 runtime workspace 应成为 Maomi project workspace 内部的 `.clowder/runtime/workspaces/...`，而不是独立的用户项目模型。
- 与 V3-36 强关联：deployment target 候选应来自 active workspace，例如 `maomi_workspace/wedding`、该 workspace 的 preview route 或 build artifact。

## 3. 影响范围

- Clowder API：
  - 新增 Maomi workspace root resolver、project workspace store、thread binding store/routes
  - `ThreadStore` / `TaskStore` / artifact routes
  - `ConnectorRouter` / `ConnectorCommandLayer`
  - `invoke-single-cat.ts`
  - `runtime-workspaces/*`
  - coordinator kickoff/proposal flow
- MCP/callback：
  - task create/update callback metadata
  - artifact declaration metadata
  - callback env 中的 workspace path/id
- TangSeng bridge：
  - Maomi workspace REST proxy
  - conversation binding diagnostics
- IM Web：
  - `ClowderConversationPanel.vue`
  - `CoordinatorKickoffCard.vue`
  - `ProjectKanbanPanel.vue`
  - `ProjectArtifactsPanel.vue`
  - `clowderStore.ts` / `clowder.ts`
  - deployment card target candidates
- 磁盘与安全：
  - workspace root 默认位置
  - slug/path validation
  - archive/discard/reveal 操作
  - `.gitignore` 与 generated output 隔离

## 4. 推荐修复方案

新增“Maomi project workspace”作为独立数据模型，不要把它直接等同于 runtime workspace。

推荐默认位置：

```text
<parent directory of launched project>/maomi_workspace
```

当前本地布局中，如果 launched project 是：

```text
/home/yunyi/Desktop/Bytedance_cmp/seedcmp
```

默认 workspace root 应为：

```text
/home/yunyi/Desktop/Bytedance_cmp/maomi_workspace
```

配置优先级建议：

1. `MAOMI_WORKSPACE_ROOT`
2. `CLOWDER_USER_WORKSPACE_ROOT`
3. runtime/launch config 中的 `userWorkspaceRoot`
4. `<parent of launched project>/maomi_workspace`

推荐目录结构：

```text
maomi_workspace/
  wedding/
    .clowder/
      project.json
      runtime/
        workspaces/
        cache/
        patches/
    src/
    artifacts/
    previews/
    patches/
  todo/
    .clowder/
      project.json
```

推荐数据模型：

```ts
interface MaomiWorkspace {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  rootPath: string;
  relativePath: string;
  sourceIntent?: string;
  linkedThreadIds: string[];
  linkedTaskIds: string[];
  createdBy: 'user' | 'coordinator' | 'cat' | 'system';
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  status: 'active' | 'archived' | 'discarded';
}

interface ThreadWorkspaceBinding {
  threadId: string;
  userId: string;
  activeWorkspaceId: string | null;
  recentWorkspaceIds: string[];
  updatedAt: number;
}
```

短期兼容策略：

- 新增 `MaomiWorkspaceStore` 和 `ThreadWorkspaceBindingStore`，不要一开始强行把所有字段塞进 `ThreadStore.projectPath`。
- agent invocation resolver 优先读取 thread 的 active workspace root；没有 active workspace 时再 fallback 到 `thread.projectPath`。
- 对现有依赖 `thread.projectPath` 的 route，可在 workspace 绑定后把 effective project path 解析为 active workspace root。
- `thread.projectPath` 可以临时镜像 active workspace root 以兼容旧 API，但 plan 中要明确：长期事实源是 `ThreadWorkspaceBinding.activeWorkspaceId`。

## 5. 具体实施步骤

1. 建立 Maomi workspace root resolver。
   - 新增 `domains/maomi-workspaces/workspace-root.ts` 或等价模块。
   - 输入 launched project root、env、userId，输出 `workspaceRoot`。
   - 默认使用 `<parent of launched project>/maomi_workspace`。
   - 确保 root 不在 `seedcmp/` 源码仓库内，除非用户显式配置。
   - 创建 root 时写入轻量 metadata，例如 `.clowder-root.json`，记录 createdAt、runtime version、source。

2. 建立 project slug resolver。
   - 从用户意图、coordinator recommendation 或 UI 输入生成 slug。
   - 中文 intent 不要无脑用原文路径；推荐由 coordinator/LLM 提议英文 slug，例如 `婚礼` -> `wedding`。
   - 无法可靠翻译时使用 `project-<shortHash>` 或用户确认的拼音 slug。
   - slug 必须只允许 `[a-z0-9][a-z0-9._-]{0,62}`，禁止 `..`、斜杠、控制字符和 Windows 保留名。
   - collision 时提示 `wedding-2`、`wedding-20260604` 或选择已有 workspace。

3. 建立 MaomiWorkspaceStore。
   - 接口支持：
     - `propose(userId, intentText, threadId?)`
     - `create(userId, slug, displayName, sourceIntent, createdBy)`
     - `get(id)`
     - `listByUser(userId, { status })`
     - `findBySlug(userId, slug)`
     - `linkThread(workspaceId, threadId)`
     - `linkTask(workspaceId, taskId)`
     - `archive/discard/restore`
   - Redis 可用时持久化；in-memory 用于测试。
   - 每个 workspace 目录写 `.clowder/project.json`，包含 `id/userId/slug/displayName/linkedThreadIds/linkedTaskIds/createdAt/updatedAt`。
   - store 启动时可扫描 `.clowder/project.json` 做恢复，但不要把任意目录自动当成 workspace。

4. 建立 ThreadWorkspaceBindingStore 和 routes。
   - Clowder API：
     - `GET /api/maomi-workspaces/root`
     - `POST /api/maomi-workspaces/propose`
     - `POST /api/maomi-workspaces`
     - `GET /api/maomi-workspaces`
     - `GET /api/maomi-workspaces/:id`
     - `POST /api/maomi-workspaces/:id/archive`
     - `GET /api/threads/:threadId/workspace-binding`
     - `PUT /api/threads/:threadId/workspace-binding`
   - TangSeng proxy：
     - `/v1/clowder/maomi-workspaces/...`
     - `/v1/clowder/thread/:threadId/workspace-binding`
   - response 必须包含 `workspaceId/rootPath/relativePath/displayName/status` 和 diagnostics。

5. 改造 coordinator project kickoff。
   - `CoordinatorKickoff` 增加 `workspaceProposal`：

```ts
interface WorkspaceProposal {
  displayName: string;
  slug: string;
  rootPath: string;
  relativePath: string;
  sourceIntent: string;
  confidence: number;
  collision?: 'none' | 'existing_active' | 'existing_archived' | 'slug_taken';
}
```

   - `maybeEmitCoordinatorKickoff()` 在解析 coordinator recommendation 后，同时解析/请求 workspace proposal。
   - `CoordinatorKickoffCard.vue` 不再让用户猜绝对路径；默认展示 `maomi_workspace/wedding`，提供 `创建`、`改名`、`选择已有`、`取消`。
   - 用户确认后先创建/bind workspace，再创建 project group thread 或绑定当前 conversation。
   - 需要支持“先在 coordinator 直聊里绑定 workspace，之后再建群聊”的路径。

6. 改造 conversation 和 command binding。
   - `/new`、`/use`、project group kickoff 创建 thread 时，应能带 `workspaceId` 或 `workspaceSlug`。
   - direct virtual cat chat、coordinator chat、group chat 都通过同一个 `ThreadWorkspaceBindingStore` 读取 active workspace。
   - 如果同一 thread 里用户提出不相关新项目，coordinator 应问：
     - “继续使用 `wedding`，还是创建新的 `todo` 工作区？”
   - 如果用户选择已有 workspace，新 thread 可以 link 到同一 workspace，不复制文件。

7. 改造 agent invocation。
   - `invoke-single-cat.ts` 解析 working directory 时优先：
     1. thread active Maomi workspace root
     2. thread.projectPath
     3. bootcamp workspace
     4. none/default
   - callback env 增加：

```text
MAOMI_WORKSPACE_ID
MAOMI_WORKSPACE_ROOT
MAOMI_PROJECT_ROOT
CAT_CAFE_PROJECT_ROOT=<active workspace root>
CLOWDER_PROJECT_RUNTIME_ROOT=<active workspace root>/.clowder/runtime
```

   - `resolveProjectRuntimeRoot()` 对 active workspace root 继续工作，默认 runtime root 应落在 `wedding/.clowder` 或 `wedding/.clowder/runtime`。
   - system prompt 明确：canonical project files 写在 active workspace root 内；临时/patch/QA work 写在 `.clowder/runtime` 下。

8. 扩展 task/artifact metadata。
   - `TaskItem` / `CreateTaskInput` / `UpdateTaskInput` 增加可选：

```ts
workspaceId?: string;
workspaceRelativePath?: string;
```

   - `cat_cafe_create_task` callback 从 invocation/thread binding 自动填 `workspaceId`，不要让猫猫手填。
   - `GET /api/threads/:threadId/tasks` response 可按 workspace group 返回 diagnostics：
     - `taskWorkspaceId`
     - `activeWorkspaceId`
     - `threadWorkspaceMismatch`
   - artifact declaration 应支持 `workspaceId + relativePath`，并返回 `absolutePath=rootPath/relativePath`。
   - 旧 `artifactRefs` 字符串继续兼容，但新记录应带结构化 workspace metadata。

9. 改造 IM Web Clowder panel。
   - `ClowderConversationPanel.vue` overview 显示 active workspace：
     - displayName
     - `maomi_workspace/wedding`
     - linked threads/tasks/artifacts 数量
     - `打开`、`切换`、`归档`
   - `ProjectKanbanPanel.vue`：
     - 继续以 conversation `threadId` 为主事实源，满足 V3-35。
     - 增加 workspace badge/filter。
     - 如果聊天出现 task id 但该 task 属于同 workspace 不同 thread，显示 thread/workspace mismatch 诊断，不能直接空态。
   - `ProjectArtifactsPanel.vue`：
     - 先展示 active workspace artifacts，再展示 runtime workspaces。
     - runtime workspace 与 project workspace 用不同标题，避免混淆。
   - deployment card：
     - target candidates 从 active workspace 和 artifacts 生成。

10. 与 V3-35 的联动处理。
   - 看板查询仍必须使用 conversation-bound thread；不能因为 workspace 存在就忽略 thread mismatch。
   - task create callback 自动写 `threadId + workspaceId`。
   - 看板拿到空 tasks 时，如果 active workspace 有 recent tasks 但当前 thread 没有，显示：
     - 当前 thread id
     - active workspace id/path
     - task 所属 thread id
     - 建议修复 conversation binding 或切换 thread
   - 这样 V3-37 能帮助诊断 V3-35，但不能把不同 thread 的任务偷偷混到当前看板里。

11. 与 V3-36 的联动处理。
   - deployment request 创建时读取 active workspace candidates。
   - 如果 active workspace 是 `wedding`，卡片 target 默认候选为 `maomi_workspace/wedding`。
   - 用户说 `部署婚礼，环境是本地` 时，parser 可以把 `婚礼` 匹配到 `workspace.slug/displayName/sourceIntent`。
   - confirm payload 带 `workspaceId/rootPath/environment`，部署后 artifact/preview 也写回同 workspace。

12. 迁移和兼容。
   - 已存在 `thread.projectPath=findMonorepoRoot()` 的 IM conversation 不要自动把 seedcmp 当用户项目 workspace。
   - 对历史 thread 显示 `No active workspace`，让用户选择或创建。
   - 对已有 runtime workspaces，只作为 execution records 展示，不自动提升为 Maomi project workspace。
   - 如果用户显式选择已有源码目录作为 workspace，必须清楚标注“这会修改该目录”，并通过 path validation。

## 6. 验证方式与回归测试建议

后端单元/API 测试：

- workspace root resolver：
  - env root 优先。
  - 当前布局中 launched project 为 `/home/yunyi/Desktop/Bytedance_cmp/seedcmp` 时，默认 root 是 `/home/yunyi/Desktop/Bytedance_cmp/maomi_workspace`。
  - 默认 root 不在 `seedcmp/` 内。
- slug resolver：
  - `婚礼网页` 提议 `wedding` 或用户确认 slug。
  - collision 产生明确候选，不覆盖旧目录。
  - path traversal 和非法字符被拒绝。
- `MaomiWorkspaceStore`：
  - create/list/get/linkThread/linkTask/archive。
  - 写入 `.clowder/project.json`。
  - user isolation。
- `ThreadWorkspaceBindingStore`：
  - 一个 thread 可绑定 active workspace。
  - 一个 workspace 可 link 多个 thread。
  - 切换 active workspace 后 `recentWorkspaceIds` 更新。
- agent invocation：
  - active workspace 存在时，`workingDirectory` 是 workspace root。
  - callback env 含 `MAOMI_WORKSPACE_ID/MAOMI_PROJECT_ROOT/CLOWDER_PROJECT_RUNTIME_ROOT`。
  - runtime workspace 落在 active workspace `.clowder` 下。
- task/artifact：
  - create-task callback 自动写 workspaceId。
  - thread tasks route 返回 workspace metadata。
  - artifact declaration 使用 `workspaceId + relativePath` 可解析到实际文件。

TangSeng proxy 测试：

- `/v1/clowder/maomi-workspaces` 透明转发 status/body。
- `/v1/clowder/thread/:threadId/workspace-binding` 透明转发。
- direct coordinator conversation 的 `boundThreadId` 和 workspace binding 可同时查询。

前端测试：

- `CoordinatorKickoffCard.vue` 渲染 `maomi_workspace/wedding` proposal，支持创建、改名、选择已有。
- `ClowderConversationPanel.vue` overview 显示 active workspace path。
- `ProjectKanbanPanel.vue` 展示 workspace badge，并在 task workspace/thread mismatch 时显示诊断。
- `ProjectArtifactsPanel.vue` 区分 project workspace artifacts 与 runtime workspaces。
- deployment card target candidates 包含 active workspace。

浏览器 smoke：

1. 打开 `clowder_cat:coordinator/1`。
2. 输入“做一个婚礼网页”。
3. coordinator 提议 `maomi_workspace/wedding`。
4. 用户点击 `创建`。
5. 磁盘出现：

```text
/home/yunyi/Desktop/Bytedance_cmp/maomi_workspace/wedding/.clowder/project.json
```

6. 让前端猫创建任务，断言同一 conversation 看板显示任务，task metadata 包含 `workspaceId=wedding`。
7. 让猫产出文件，断言文件在 `maomi_workspace/wedding` 下，产物 tab 可见。
8. 再输入“做一个 todo app”，UI 询问复用 `wedding` 还是创建 `todo`。
9. 创建 `todo` 后，两个项目文件夹都存在，任务/产物按 workspace 分组。
10. 部署卡片 target 候选包含 `wedding` 或 `todo`，选择后 confirm payload 带 workspaceId。

建议命令：

```bash
cd seedcmp/sections/clowder-ai/packages/api
pnpm test -- runtime-workspaces maomi-workspaces threads-endpoint integration/task-callback connector-router-hub-thread-race
```

```bash
cd seedcmp/sections/im/TangSengDaoDaoServer
go test -count=1 ./modules/clowder
```

```bash
cd seedcmp/sections/im_web
pnpm type-check
pnpm test:unit
```

```bash
cd seedcmp/sections/im_web/apps/chat
pnpm exec vitest run tests/clowderPanel.test.ts tests/deploymentCard.test.ts tests/clowderBridgeContracts.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

人工检查：

```bash
ls -la /home/yunyi/Desktop/Bytedance_cmp/maomi_workspace
find /home/yunyi/Desktop/Bytedance_cmp/maomi_workspace -maxdepth 3 -name project.json -print
git -C /home/yunyi/Desktop/Bytedance_cmp/seedcmp status --short
```

新生成项目不应污染 `seedcmp` 的 git status，除非用户明确选择把源码仓库作为 workspace。

## 7. 风险点与注意事项

- 不要把 V3-32 的 runtime workspace 当成 V3-37 的 Maomi project workspace。runtime workspace 是执行目录；project workspace 是用户项目根。
- 不要默认把 `seedcmp/` 源码仓库作为用户产物目录。当前推荐默认是 sibling `maomi_workspace/`。
- 不要只改 `resolveProjectRuntimeRoot()`。那会改变 runtime 目录，但仍没有项目 workspace store、thread binding、UI 选择和 task/artifact metadata。
- 不要让猫猫在用户确认前写入新项目目录；可先生成 proposal/card，用户确认后再创建。
- 不要用聊天文本解析来伪造 workspace/task/artifact。聊天文本只能帮助 proposal 和诊断，事实源必须是 store。
- V3-35 仍需要独立修复 thread 绑定一致性。V3-37 的 workspaceId 能帮助分组和诊断，但不能允许当前 conversation 看板混入另一个 thread 的任务。
- 归档/删除 workspace 必须显式确认；`discarded` 不应默认物理删除，至少先软删除或移动到 archive。
- slug 生成要防 path traversal、跨用户冲突、大小写冲突和 Windows 保留名。
