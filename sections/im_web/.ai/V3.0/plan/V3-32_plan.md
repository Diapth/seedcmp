# V3-32 解决计划：Runtime And Agent Work Directories Need Project-Scoped Paths

## 1. 问题现象

用户在主项目 `/home/yunyi/Desktop/Bytedance_cmp/seedcmp` 发起代码生成/交付任务后，发现 `/tmp` 下出现多个 `seedcmp-*` 目录：

- `/tmp/seedcmp-go-build-cache`
- `/tmp/seedcmp-main-check.8bLpd5`
- `/tmp/seedcmp-main-patch`
- `/tmp/seedcmp-coordinator-todo-app`
- `/tmp/seedcmp-wedding-fix.BufuZz/checkout`
- `/tmp/seedcmp-wt-wedding-qa-fix`

issue 已经初步分类：其中既有可重建缓存、baseline checkout，也有 dirty agent workspace、patch staging、QA/staging copy。核心问题不是“所有 `/tmp` 目录都应删除”，而是项目相关 runtime/work 输出没有项目级路径策略、没有登记、没有展示、没有清理生命周期。

当前代码相关证据：

- Clowder thread 创建支持 `projectPath`，`routes/threads.ts` 会校验并保存。
- `invoke-single-cat.ts` 会从 `thread.projectPath` 推导 `workingDirectory` 并传给 agent service。
- `utils/project-path.ts` 默认 denylist 不禁止 `/tmp`；legacy allowlist 还显式包含 `/tmp`、`/private/tmp`、`/workspace`。
- `workspace-security.ts` 有 git worktree/linked roots registry，但这是 workspace UI 路径解析，不是 agent runtime workspace ledger。
- 多处 provider 使用 `tmpdir()` 创建一次性配置或临时文件，如 Claude/Codex MCP config、isolated home、Pandoc 临时文件、Outbound data URI。这些不一定是错误，但需要与项目工作区分。
- `thread-tasks.ts` 的 artifact declaration 要求文件在 `thread.projectPath` 内；这会让 isolated workspace 或 `/tmp` checkout 中的产物无法作为正式 artifact 进入面板。

## 2. 根因判断

根因是 Clowder 缺少“项目运行目录 root resolver + runtime workspace registry + 类型化清理策略”。

具体判断：

- 目前只有 `thread.projectPath` 作为 agent 的工作目录提示，没有统一的 `projectRuntimeRoot` 用于隔离 checkout、QA copy、patch staging、cache。
- agent 或脚本如果需要临时 worktree，很容易自行选择 `/tmp/seedcmp-*`，系统没有统一 helper 或环境变量约束它们必须落在项目 scoped root。
- `/tmp` 被路径安全策略视为可接受位置，适合一次性 temp/cache，但不适合默认承载项目代码工作区和 final/source artifact。
- 没有 workspace metadata store，所以 IM Web 无法知道某个目录属于哪个 thread/task/cat/invocation，也无法显示 dirty files、size、branch、patch refs。
- cleanup 无法安全自动化，因为 cache、clean baseline checkout、dirty agent workspace、patch staging 的删除语义完全不同。
- V3-31 的 artifact route 只认 bound project path，导致 agent 在 isolated workspace 里完成工作后，聊天能说完成，但看板/产物看不到。

与其他 issue 的关联：

- V3-31 是 UI 结果：工作已经发生，但 task/artifact 面板为空。
- V3-30 是交付收口结果：本地预览尝试绑定 `127.0.0.1:4301`，但当前环境禁止监听端口并返回 `listen EPERM`。
- V3-29 如果部署作用于 runtime workspace，也需要在审批 payload 中带 workspace/project reference。

## 3. 影响范围

- Clowder API 的 thread/projectPath、agent invocation、QueueProcessor、provider 启动环境。
- MCP server 的 shell/file/workspace 工具默认 cwd 和 allowed roots。
- workspace UI/API：worktrees、linked roots、git status/diff、terminal/tmux panes。
- artifact declaration、patch staging、generated file delivery。
- IM Web Clowder panel 的看板、产物、workspace 展示和 cleanup/apply 操作。
- 磁盘占用、安全审计、跨项目隔离和自动清理。

## 4. 推荐修复方案

引入项目级 runtime root，并将所有项目相关 runtime/work directory 登记到 metadata ledger。

推荐默认布局：

```text
<project>/.clowder/
  runtime/
    verification/
    qa/
  workspaces/
    <thread-id>/<task-id-or-invocation-id>/
  cache/
    go-build/
    npm/
  patches/
    <thread-id>/
  artifacts/
    <thread-id>/
```

如果不能写入 git checkout，可使用 sibling root：

```text
<launch-dir>/.clowder-runtime/<project-id>/
```

配置优先级：

1. `CLOWDER_PROJECT_RUNTIME_ROOT` 或 `CAT_CAFE_PROJECT_RUNTIME_ROOT`
2. thread/project 配置中的 runtimeRoot
3. `<project>/.clowder`
4. `<launch-dir>/.clowder-runtime/<project-id>`

核心 metadata：

```ts
interface RuntimeWorkspaceRecord {
  id: string;
  type: 'cache' | 'verification_checkout' | 'agent_workspace' | 'qa_workspace' | 'patch_staging' | 'artifact_staging';
  projectRoot: string;
  runtimeRoot: string;
  path: string;
  threadId?: string;
  taskId?: string;
  invocationId?: string;
  ownerCatId?: string;
  branch?: string;
  gitHead?: string;
  dirtyStatus?: 'clean' | 'dirty' | 'unknown';
  changedFiles?: string[];
  sizeBytes?: number;
  createdAt: number;
  lastActivityAt: number;
  cleanupPolicy: 'ttl_auto' | 'on_task_close' | 'manual_required' | 'archive_required';
  artifactRefs?: string[];
}
```

## 5. 具体实施步骤

1. 建立 runtime root resolver。
   - 新增 `ProjectRuntimeRootResolver`，输入 `projectPath/threadId/userId`，输出 project-scoped runtime root。
   - 校验 root 必须在 project root 或 configured sibling root 下。
   - 明确 `/tmp` 只能作为 process temp fallback，不能作为 project-specific runtime 默认值。

2. 建立 runtime workspace registry。
   - 新增 `RuntimeWorkspaceStore`，支持 create/update/listByThread/listByTask/listByProject/markClean/markDirty/cleanup。
   - 可以先用 Redis 或已有 store pattern，测试环境可用 in-memory。
   - 创建目录时写入 `.clowder-workspace.json` sidecar，便于进程重启后恢复。

3. 替换 ad hoc workspace 创建入口。
   - QueueProcessor / agent routing / provider invocation 需要 isolated checkout 时，调用统一 helper。
   - helper 按类型创建 `agent_workspace`、`verification_checkout`、`qa_workspace`、`patch_staging`。
   - 将 runtime root、workspace id、path 注入 agent prompt/env，例如 `CLOWDER_PROJECT_RUNTIME_ROOT`、`CLOWDER_WORKSPACE_ID`。
   - MCP `ALLOWED_WORKSPACE_DIRS` 包含 bound project root 和已登记 runtime workspace，而不是宽泛依赖 `/tmp`。

4. 约束 agent 行为。
   - 更新 coordinator/agent system prompt：项目 worktree、patch、QA copy 必须创建在 runtime root 下。
   - 对常见命令模板或工具说明增加“不要使用 `/tmp/seedcmp-*` 作为项目工作区”的约束。
   - `cat_cafe_shell_exec` 默认 cwd 继续指向 workspace root，但如果需要隔离工作区必须使用 registered workspace path。

5. 分类处理现有 tmp 用途。
   - 保留真正 disposable 的 tmpdir 用法，如短期 config、data URI、Pandoc intermediate，但设置 TTL 或 finally cleanup。
   - Go build cache 归类为 `cache`，移动/配置到 `.clowder/cache/go-build` 或明确 TTL。
   - baseline checkout 归类为 `verification_checkout`，任务结束或 TTL 后自动清理。
   - dirty agent workspace 归类为 `agent_workspace`，必须 manual apply/export/discard/archive。
   - patch staging 归类为 `patch_staging`，作为 artifact/proposal 暴露。

6. 允许 artifact 引用 registered workspace。
   - 配合 V3-31，`cat_cafe_declare_artifact` 支持 `workspaceId + relativePath`。
   - 若文件不在 bound project 但在 registered workspace，artifact 状态为 `workspace_artifact`，UI 提供 apply/export/discard，而不是伪装成 project file。
   - patch 文件进入 `patches` 或 `artifact_staging` 并显示在产物 tab。

7. 增加 workspace API 和 IM Web 展示。
   - Clowder API：`GET /api/threads/:threadId/workspaces`、`GET /api/runtime/workspaces/:id/status`、`POST /apply`、`POST /export-patch`、`POST /archive`、`DELETE /discard`。
   - TangSeng proxy：`/v1/clowder/thread/:threadId/workspaces`。
   - IM Web：Clowder panel overview 或 artifacts tab 显示 runtime workspaces、dirty files、size、owner cat、cleanup/apply actions。

8. 迁移/回收现有 `/tmp/seedcmp-*`。
   - 做一次只读 scanner，按 git root、remote、branch、dirty status、size、mtime 分类。
   - 对 dirty workspace 先登记为 legacy runtime workspace，不自动删。
   - 对 clean baseline/cache 按策略迁移或 TTL 清理。
   - 对 patch staging 建 artifact ref。

9. 文档和配置。
   - 记录 runtime root 配置、目录布局、清理策略。
   - 在 `.gitignore` 或项目模板中忽略 `.clowder/runtime`、`.clowder/cache`、`.clowder/workspaces`，但保留可审计 metadata 的策略需明确。

## 6. 验证方式与回归测试建议

单元/API 测试：

- runtime root resolver：显式 env、project `.clowder`、sibling fallback，均不落到 `/tmp`。
- workspace registry：cache、verification checkout、dirty agent workspace、patch staging metadata 完整。
- cleanup policy：cache 可 TTL 自动清理；clean verification 可自动清理；dirty workspace 必须手动 apply/export/discard/archive。
- artifact declaration：`workspaceId + relativePath` 可以进入 artifact panel，但状态标记为 workspace artifact。
- project path validation：`/tmp` 不能作为 project-specific runtime 默认 root；若 explicit 配置为 `/tmp`，应要求警告或拒绝项目 work 类型。

IM Web 测试：

- Clowder panel 能渲染 registered runtime workspace，包括 path、owner、dirty status、changed files、size。
- 产物 tab 能显示 patch staging 输出，例如 `0001-IM-Web.patch`。
- dirty workspace 显示 apply/export/discard/archive 操作，cache 不显示 apply。

浏览器/端到端回归：

- 从 `/home/yunyi/Desktop/Bytedance_cmp/seedcmp` 发起 code-producing task。
- 任务执行期间新 workspace 位于 `<project>/.clowder/...` 或 configured runtime root。
- `/tmp/seedcmp-*` 不再新增项目工作区；若有 `/tmp` 使用，只能是短 TTL disposable temp/cache。
- IM Web Clowder panel 能看到 workspace、dirty files、patch/artifact refs。
- 用户可从 UI 导出 patch 或应用到 bound project。

建议命令：

```bash
cd seedcmp/sections/clowder-ai/packages/api
pnpm test -- workspace threads-endpoint task-progress-route queue-processor
```

```bash
cd seedcmp/sections/clowder-ai/packages/mcp-server
pnpm test
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

额外人工检查：

```bash
find /tmp -maxdepth 1 -type d -name 'seedcmp-*' -mmin -30 -print
```

新任务完成后该命令不应出现新的 project-specific agent workspace、QA staging、patch staging 目录。

## 7. 风险点与注意事项

- 不要写“一键删除 `/tmp/seedcmp-*`”作为修复；其中可能有未提交的 agent 工作。
- 不要把所有 `tmpdir()` 用法都视为 bug；短期 CLI config、data URI、document intermediate 可以继续用 temp，但要短 TTL/可清理。
- 如果 `.clowder/` 放在 git checkout 内，必须处理 `.gitignore`、磁盘膨胀和用户误提交风险。
- 如果 runtime root 放在 sibling 目录，必须保证路径和权限仍绑定到 project/thread，避免多项目混用。
- dirty workspace 的 apply/import 操作有覆盖用户改动风险，必须先展示 diff 并做冲突检测。
- workspace artifact 不能被表述为“已进入主项目”，除非用户明确 apply/import。
- 与 V3-31 同步实施，否则 workspace 即使登记，任务/产物面板仍可能缺少展示入口。
