# V3-31 解决计划：Clowder Kanban And Artifacts Stay Empty While Cats Are Working

## 1. 问题现象

IM Web 的 Clowder 面板中，猫猫在聊天 transcript 里已经报告实现、QA、测试和最终交付，甚至发送了 `wedding-invite-final-20260604.zip`，但 `看板` tab 仍显示空任务，`产物` tab 也没有输出。

当前实现可以解释这个现象：

- `apps/chat/src/components/ProjectKanbanPanel.vue` 只调用 `GET clowder/thread/:threadId/tasks`，返回空数组时直接显示“还没有任务”。
- `apps/chat/src/components/ProjectArtifactsPanel.vue` 只调用 `GET clowder/thread/:threadId/artifacts`，返回空数组时直接显示“还没有产物”。
- `ProjectArtifactsPanel.vue` 空态提示说文件会通过 `cat_cafe_declare_artifact` 自动出现，但仓库搜索未找到同名 MCP 工具注册；Clowder API 只有 `POST /api/threads/:threadId/artifacts` REST route。
- `packages/mcp-server/src/tools/callback-tools.ts` 已有 `cat_cafe_create_task`、`cat_cafe_update_task`、`cat_cafe_list_tasks`，但没有 `cat_cafe_declare_artifact`。
- `sections/clowder-ai/packages/api/src/routes/thread-tasks.ts` 的 artifact GET 只遍历 task 的 `artifactRefs`，并且对有 `projectPath` 的 thread 会静默过滤不存在或不在 projectPath 下的文件。
- 聊天文件卡片来自 message/rich block/media delivery，与 task `artifactRefs` 没有自动 cross-link。

## 2. 根因判断

根因是“聊天完成信号”和“结构化项目状态”之间没有可靠写入契约。

具体判断：

- 看板只展示 task store 中的 task。猫猫如果没有调用 `cat_cafe_create_task` 或 `cat_cafe_update_task`，聊天里说“完成 3 个任务”不会自动生成看板任务。
- 产物 tab 只展示 task `artifactRefs` 推导出的 artifacts。聊天里发了文件卡片或文字路径，不等于 artifact ledger 有记录。
- 提示词要求 `cat_cafe_declare_artifact`，但 MCP 侧缺少该工具，导致猫猫即使遵守提示也无法通过同名工具声明产物。
- REST `POST /api/threads/:threadId/artifacts` 要求 `userId/path/ownerCatId`，并检查文件必须存在且在 thread projectPath 内。若产物在 agent isolated workspace 或 `/tmp` checkout 内，会被拒绝或 GET 时被过滤。这与 V3-32 直接相关。
- `ProjectKanbanPanel` 和 `ProjectArtifactsPanel` 把 route 错误、thread binding 错误、没有任务、没有声明、文件被过滤都压成近似空态，用户无法判断哪里断了。
- `ClowderConversationPanel.vue` 只用 `conversation.binding.threadId` 决定能否打开 tab，未对“绑定 thread 与 cat 实际工作 thread 不一致”做诊断。

与其他 issue 的关联：

- V3-30：猫猫尝试启动 `127.0.0.1:4301` 本地预览，但当前环境禁止监听端口并返回 `listen EPERM`；这是独立的 preview server 启动失败，不是文件卡片 URL 权限问题。
- V3-32：agent workspaces 和 patch staging 可能在 `/tmp`，现有 artifact route 不允许把这些路径作为 bound project artifact 展示。
- V3-29：同样属于 IM Web 交互/状态没有以结构化事件可靠写入 Clowder runtime 的问题。

## 3. 影响范围

- IM Web Clowder 面板的 `看板`、`产物`、overview 状态。
- Clowder task store、callback task routes、MCP server 工具列表。
- Clowder thread artifact REST route 和 TangSeng proxy。
- Outbound rich block/file delivery 与 artifact ledger 的关联。
- 多猫协作中 coordinator 创建任务、直接 cat 工作、agent workspace 交付、patch 输出等流程。

## 4. 推荐修复方案

建立一个真实的 task/artifact ledger 闭环，并让 IM Web 能区分“没有数据”和“数据同步断裂”。

核心方案：

- 实现 `cat_cafe_declare_artifact` MCP 工具，并接入 Clowder API 的 artifact declaration route。
- 将 artifacts 从“task.artifactRefs 的字符串推导”升级为结构化记录，或至少在 task artifactRefs 之外附加可查询 metadata。
- 任务创建/更新和 artifact 声明都广播可订阅事件；IM Web 可以继续 polling，但应在消息完成、tab 切换、thread 变化时主动刷新。
- 对聊天 rich file block 做 cross-link：如果同 thread 有文件卡片但没有 artifact declaration，artifact panel 显示“聊天附件未登记为产物”的诊断项，而不是空白。
- 对绑定问题、route 错误、文件被过滤、未声明产物分别显示不同状态。

建议结构：

```ts
interface ThreadArtifactRecord {
  id: string;
  threadId: string;
  taskId?: string;
  ownerCatId: string;
  kind: 'code' | 'doc' | 'image' | 'preview' | 'file' | 'patch' | 'workspace' | 'other';
  path?: string;
  absolutePath?: string;
  url?: string;
  downloadUrl?: string;
  previewUrl?: string;
  workspaceId?: string;
  source: 'declared' | 'chat_file' | 'workspace_scan' | 'patch_staging';
  status: 'available' | 'missing' | 'outside_project' | 'undeclared' | 'forbidden';
  description?: string;
  createdAt: number;
}
```

## 5. 具体实施步骤

1. 确认 live thread binding。
   - 在 IM Web panel 中记录 `boundThreadId`。
   - 查询 `GET /v1/clowder/thread/:threadId/tasks` 和 `/artifacts`。
   - 与 Clowder logs、cat final message、outbound payload 中的 thread id 对齐。

2. 实现 `cat_cafe_declare_artifact`。
   - 在 `packages/mcp-server/src/tools/callback-tools.ts` 增加 input schema 和 handler。
   - Handler 调用 callback endpoint，例如 `POST /api/callbacks/declare-artifact`。
   - API route 从 callback auth 推导 `threadId/userId/catId`，避免让猫猫手填 userId。
   - 内部复用或抽取 `thread-tasks.ts` 中 artifact attach 逻辑。

3. 改造 artifact 存储与 GET route。
   - 短期可以继续写入 task `artifactRefs`，但 GET response 必须带 `status/reason/source`。
   - 中期新增 `ArtifactStore`，避免把 kind、description、URL、workspaceId 全塞进字符串 refs。
   - `GET /api/threads/:threadId/artifacts` 不要静默过滤；文件缺失、越界、没有 projectPath 时返回诊断记录。

4. 让 task 创建成为 coordinator 工作流的硬约束。
   - coordinator kickoff / lead-agent dispatch 时自动创建 root task 或 coordination task。
   - cat 开始执行时自动创建/更新 `doing` task，结束时更新 `done/blocked`。
   - 对未调用 task 工具但有 agent invocation 的情况，系统自动生成 `invocation` task 或 warning。

5. cross-link 聊天文件卡片。
   - 在 Clowder outbound delivery 或 IM Web message ingestion 中提取 rich file blocks。
   - 如果同 thread 没有 matching artifact，artifact panel 显示 `source: chat_file, status: undeclared`。
   - 对聊天文件卡片可作为 undeclared artifact 诊断项出现；不要把 V3-30 的本地 preview `listen EPERM` 误归因为 artifact URL 问题。

6. 改造 IM Web 面板状态。
   - `ProjectKanbanPanel.vue` 和 `ProjectArtifactsPanel.vue` 不再只存 `items[]`，增加 `diagnostics/loading/error/lastRefreshAt`。
   - 区分 `not_bound`、`route_failed`、`no_tasks`、`no_declared_artifacts`、`undeclared_chat_files`、`filtered_artifacts`。
   - threadId 改变、tab 激活、消息流完成、手动刷新时触发 refresh。
   - 如后续有 Clowder websocket/TangSeng relay，可监听 `task_created/task_updated/artifact_declared`。

7. 修复 TangSeng proxy 透明度。
   - `/v1/clowder/thread/:threadId/tasks/artifacts` 保留 upstream status code 和 body。
   - 对 401/403/404 不要让前端误判为空数组。

8. 兼容旧数据。
   - 旧 task `artifactRefs` 字符串继续展示。
   - 旧聊天文件可作为 undeclared artifact 诊断项出现。
   - 对旧的 `cat_cafe_declare_artifact` 不存在时期产生的 transcript，可通过扫描最终消息和 rich file blocks 生成建议登记项，但不要自动宣称为已声明。

## 6. 验证方式与回归测试建议

单元/API 测试：

- MCP server：`cat_cafe_declare_artifact` 出现在 tool registry，schema 校验 path/kind/description/taskId/workspaceId。
- Callback API：declare artifact 自动使用 callback principal 的 thread/user/cat，并写入 artifact ledger。
- `thread-tasks.ts`：declared artifact、missing file、outside project、workspace artifact 都返回可诊断状态。
- `callback-task-routes.ts`：create/update task 后 `GET /api/threads/:threadId/tasks` 可见。
- TangSeng `modules/clowder`：tasks/artifacts proxy 保留错误状态，不吞成空列表。

前端测试：

- `ProjectKanbanPanel.vue` 渲染 todo/doing/blocked/done 四列和 owner cat badge。
- `ProjectArtifactsPanel.vue` 渲染 declared file、preview URL、patch、workspace artifact、undeclared chat file。
- 缺 thread binding 显示绑定问题；route 403/404 显示错误；空 task 与未声明产物分别显示不同文案。
- 消息文件 block 存在但 artifact ledger 空时，产物 tab 出现 missing declaration diagnostic。

浏览器回归：

- 发起真实多步任务，cat 开始工作后看板出现 `doing`。
- cat 完成后 task 进入 `done`。
- cat 声明 `/showcase/wedding-invite` 和 zip 文件后，产物 tab 出现对应入口。
- 如果故意不声明 artifact，产物 tab 显示“聊天附件未登记”而不是空白。
- 刷新页面后 task/artifact 状态保持。

建议命令：

```bash
cd seedcmp/sections/im_web
pnpm type-check
pnpm test:unit
```

```bash
cd seedcmp/sections/im_web/apps/chat
pnpm exec vitest run tests/clowderPanel.test.ts tests/clowderControlStore.test.ts tests/clowderBridgeContracts.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

```bash
cd seedcmp/sections/im/TangSengDaoDaoServer
go test -count=1 ./modules/clowder
```

```bash
cd seedcmp/sections/clowder-ai/packages/api
pnpm test -- callback-task-routes thread-tasks task-progress-route queue-processor
```

```bash
cd seedcmp/sections/clowder-ai/packages/mcp-server
pnpm test
```

## 7. 风险点与注意事项

- 不要只在 IM Web 上解析聊天文本来“伪造”看板完成态；结构化 task/artifact ledger 才是事实源。
- 不要继续提示猫猫使用不存在的 `cat_cafe_declare_artifact`。
- artifact GET 不应静默过滤关键问题，否则用户只会看到空面板。
- 对 `/tmp` 或 isolated workspace 中的产物，不要假装它位于 bound project；应配合 V3-32 使用 `workspaceId` 和 apply/export/discard 流程。
- 自动从聊天文件 cross-link artifact 时要标明 `undeclared`，避免审计上误认为猫猫已完成正式声明。
- 现有测试中有不少源码字符串断言，应增加真实组件交互和 API-level 测试，否则容易再次出现“代码里有但 live 不通”的回归。
