# V3-35 解决计划：Clowder Kanban Does Not Show Created Tasks

## 1. 问题现象

2026-06-04 的 IM Web V3.0 Clowder coordinator 直聊中，聊天 transcript 显示协调者已经创建任务：

- `已建任务 0001780553055141-000007-34422e45：制作婚礼网页首版。`
- 分配对象显示为 `@前端`。

但同一页面右侧 Clowder 面板的 `看板` tab 仍显示：

- `Clowder ready`
- `还没有任务。让协调者分配任务后,这里会显示各猫的工作状态。`

代码现状能解释这个用户可见矛盾：

- `apps/chat/src/components/ProjectKanbanPanel.vue` 直接请求 `GET clowder/thread/:threadId/tasks`，把 `response.data.tasks` 渲染为四列。成功返回空数组时直接显示空态。
- `ProjectKanbanPanel.vue` 的刷新入口只有 mounted、`threadId` watch、手动 `刷新` 和 10 秒 polling；没有订阅 `task_created/task_updated`，也没有从聊天里出现的 task id 触发结构化刷新。
- `apps/chat/src/components/ClowderConversationPanel.vue` 只把 `conversation.binding.threadId` 作为 `boundThreadId` 传给看板，没有校验这个 thread 是否就是 coordinator 创建任务时的 invocation thread。
- TangSeng proxy 确实存在 `GET /v1/clowder/thread/:threadId/tasks` 到 Clowder API `GET /api/threads/:threadId/tasks` 的转发，并保留 upstream status code。
- Clowder API 的 `GET /api/threads/:threadId/tasks` 读取 `taskStore.listByThread(threadId)`；callback `POST /api/callbacks/create-task` 则把任务写到 `actor.threadId`。
- MCP `cat_cafe_create_task` 没有 `threadId` 入参，符合“任务属于当前 invocation thread”的设计。因此只要 `actor.threadId` 与 IM 面板的 `boundThreadId` 不一致，看板就会空。

## 2. 根因判断

当前最可能的根因不是 task store 完全没写入，而是“任务创建 thread”和“面板查询 thread”之间没有端到端一致性约束。

已确认的链路事实：

- 看板事实源是 `GET /api/threads/:threadId/tasks`，不是聊天文本。
- task 创建事实源是 `taskStore.create({ threadId: actor.threadId, ... })`。
- `cat_cafe_create_task` 只接受 title、owner、coordination 等业务字段，不允许猫猫手填 threadId。
- `ProjectKanbanPanel.vue` 不在 datasource store 中维护 task state，也没有 `route_failed`、`thread_binding_mismatch`、`created_task_missing` 等诊断态。
- `ConnectorCommandLayer.handleNew()` 会创建并绑定 conversation thread，但 `ConnectorRouter` command 分支会把 command exchange 存入 Hub thread；`ImWebInboundHandler` 对 command result 返回 `processed`，`/api/connectors/im-web/inbound` 的 processed 分支又返回 `{ kind: "routed", messageId }`，不带 threadId。这会让 TangSeng `bindConversation()` 依赖的 `/new` 返回值存在歧义或空 threadId 风险。
- TangSeng 显式发送路径 `sendInboundTextWithRouting()` 对虚拟猫猫直聊使用 `externalChatIDForUser()`，会生成用户隔离的 fake direct externalChatId；但通用 `NormalizeInboundMessage()` 直接用 `fmt.Sprintf("%d:%s", channelType, channelID)`。如果 live 直聊消息走到不同入口，可能出现两个 externalChatId 对应两个 Clowder thread。

需要在修复前用 live 数据验证的点：

- `0001780553055141-000007-34422e45` 是否真实存在于 `TaskStore`。
- 该 task 的 `threadId/userId/ownerCatId/status/coordinationId`。
- 当前 IM 面板 `boundThreadId`，即 `GET /v1/clowder/conversation?channelId=clowder_cat:coordinator&channelType=1` 返回的 binding thread。
- 该 direct conversation 的 `externalChatId` 是否为用户 fake channel 形态。
- coordinator 创建任务时的 invocation record 中 `threadId` 是否等于面板 `boundThreadId`。
- `@前端` 是否能解析成有效 `ownerCatId`。即使 owner 为空，任务也应该出现在看板；owner 解析失败则 callback 应返回错误，不能让聊天误报“已建任务”。

与其他 issue 的关联：

- 与 V3-31 共用根因：聊天协作状态和结构化 task/artifact 面板缺少可靠契约，UI 又把断裂显示成空态。
- 与 V3-32 有间接关联：如果 coordinator 或执行猫实际在另一个 runtime/project thread 下工作，task/artifact 也会落到另一个 thread 或 workspace。
- V3-35 比 V3-31 更窄，强约束是“聊天已经出现结构化 task id 后，同一 conversation 的看板必须显示该 task，或显示明确的绑定/查询错误”。

## 3. 影响范围

- IM Web 前端：
  - `ClowderConversationPanel.vue`
  - `ProjectKanbanPanel.vue`
  - `packages/datasource-vue/src/stores/clowderStore.ts`
  - `packages/datasource-vue/src/api/clowder.ts`
- TangSeng Clowder bridge：
  - `modules/clowder/api.go`
  - `modules/clowder/normalize.go`
  - `modules/clowder/listener.go`
  - `modules/clowder/client.go`
- Clowder API：
  - `routes/thread-tasks.ts`
  - `routes/tasks.ts`
  - `routes/callback-task-routes.ts`
  - `routes/connector-webhooks.ts`
  - `infrastructure/connectors/ImWebInboundHandler.ts`
  - `infrastructure/connectors/ConnectorRouter.ts`
  - `infrastructure/connectors/ConnectorCommandLayer.ts`
  - connector binding store
- MCP server：
  - `packages/mcp-server/src/tools/callback-tools.ts`
- 回归测试：
  - API task callback tests
  - TangSeng proxy/binding tests
  - IM Web component/store tests
  - direct `clowder_cat:coordinator` browser smoke

## 4. 推荐修复方案

先修“同一 conversation 的绑定 thread 必须是 task 创建 thread”这个不变量，再补 UI 诊断和刷新。

推荐分三层落地：

1. 绑定一致性层。
   - 为 IM Web direct virtual cat conversation 建立唯一 canonical externalChatId resolver。
   - 所有 TangSeng 入口，包括显式 `/v1/clowder/conversation/message`、`/new`、通用 message listener，都必须使用同一 resolver。
   - `/new`、`/use`、`/thread` 等 command 返回给 IM Web 的 threadId 必须是 conversation thread，不是 Hub thread，也不能被 processed wrapper 丢掉。
   - `ClowderConversationPanel` 只绑定 conversation thread；Hub thread 只能作为诊断字段显示。

2. task 查询诊断层。
   - `GET /api/threads/:threadId/tasks` 返回 `{ threadId, tasks, diagnostics }`，至少包含 `taskCount`、`queryThreadId`、可选 `binding`。
   - 对 IM Web proxy 继续保留 401/403/404/502 status，不转成 `{ tasks: [] }`。
   - 前端 `fetchThreadTasks` 区分 `success_empty`、`route_failed`、`not_bound`、`thread_binding_mismatch`、`created_task_missing`。
   - 如果聊天中出现 task id 但当前 thread tasks 不含该 id，只把聊天 task id 当诊断信号：查询 `GET /api/tasks/:id` 或后端 diagnostic endpoint，确认该 task 是否属于另一个 thread。不要根据聊天文本伪造看板行。

3. 刷新与事件层。
   - 将 task fetching 从 `ProjectKanbanPanel.vue` 内联逻辑移入 datasource store，例如 `fetchThreadTasks(threadId, options)`，保留 `lastRefreshAt/error/diagnostics`。
   - `ProjectKanbanPanel` 在 mounted、threadId 变化、tab 激活、手动刷新、聊天里出现 task-created 信号、Clowder delivery final/cleanup、`task_created/task_updated` socket event 时刷新。
   - 当前 polling 可以保留为兜底，但需要在组件 unmount 时清理 interval，不能只靠 `beforeunload`。

## 5. 具体实施步骤

1. 先做 live 取证，不改逻辑。
   - 在浏览器 URL 和 `ClowderConversationPanel` overview 中记录 `channelId=clowder_cat:coordinator`、`channelType=1`、`boundThreadId`。
   - 请求 `GET /v1/clowder/thread/:boundThreadId/tasks`，确认是 200 空数组、非 2xx 错误，还是 response shape 异常。
   - 在 Clowder API 侧查询 `GET /api/tasks/0001780553055141-000007-34422e45`。若没有现成内部 route，可临时用 Redis/task store inspection 或测试 helper 取证。
   - 比较 task 的 `threadId` 与 `boundThreadId`。若不同，记录两个 thread 的 connector binding、hubThreadId、externalChatId。
   - 查 invocation registry，确认创建 task 的 callback principal 对应的 `actor.threadId`。

2. 统一 IM Web externalChatId。
   - 抽出 TangSeng 侧 canonical resolver，例如 `externalChatIDForUser(channelID, channelType, userID)`，让通用 listener 也能拿到 userId 并复用。
   - 对虚拟猫猫直聊 `clowder_cat:*`、`clowder:*`、`clowder_ai`，强制使用用户 fake channel externalChatId。
   - 增加测试覆盖：
     - 显式 `sendInboundTextWithRouting("clowder_cat:coordinator", 1, user)` 的 externalChatId。
     - `MessagesListenWithRoles` 或新增 listener normalization path 对同一输入生成同一个 externalChatId。
     - group conversation 不受影响，仍是 `2:<groupId>`。

3. 修复 command route threadId 返回契约。
   - 在 `ConnectorRouter` command result 中保留 `contextThreadId` 或 `newActiveThreadId`，并把它作为 IM Web inbound response 的 conversation `threadId`。
   - Hub thread 仍可存 command exchange，但应作为 `hubThreadId` 或 metadata 返回，不能覆盖 conversation thread。
   - `ImWebInboundHandler` 不要把带 conversation thread 的 command result 降级成只有 `messageId` 的 `processed`。
   - `/api/connectors/im-web/inbound` 的 processed/command response 不应伪装成 `{ kind: "routed" }` 却缺 `threadId`；要么返回明确 `kind: "command"`，要么返回 `{ kind: "routed", threadId, messageId }`。
   - TangSeng `bindConversation()` 在 `/new` 后应以 binding lookup 或 agent directory lookup 作为最终 threadId 校验，避免使用空 threadId 生成 binding。

4. 加强 task route 的绑定诊断。
   - `thread-tasks.ts` 的 `GET /api/threads/:threadId/tasks` 返回 `threadId` 和 `tasks`，并可选返回 `diagnostics`。
   - 如果传入 `expectedTaskId` 或 `observedTaskIds`，route 可以检查这些 task 是否存在，以及是否属于当前 thread；不匹配时返回 `thread_binding_mismatch`。
   - 保留 `GET /api/tasks/:id`，让前端或测试能定位单个 task 的真实 `threadId`。
   - 确认 401/403/404/502 都保留 status 和 body。TangSeng proxy 当前已经 `ctx.Data(res.StatusCode, ...)`，需要补测试确保不会回归。

5. 改造 IM Web task store 和看板状态。
   - 在 `packages/datasource-vue/src/api/clowder.ts` 增加 task response 类型和 `getThreadTasks()`。
   - 在 `clowderStore.ts` 或独立 `clowderTaskStore.ts` 中实现 `fetchThreadTasks(threadId, options)`。
   - 状态模型建议：

```ts
type ThreadTaskLoadState =
  | { state: 'not_bound' }
  | { state: 'loading'; threadId: string }
  | { state: 'success'; threadId: string; tasks: TaskItem[]; diagnostics?: TaskDiagnostics }
  | { state: 'success_empty'; threadId: string; diagnostics?: TaskDiagnostics }
  | { state: 'route_failed'; threadId: string; status?: number; error: string }
  | { state: 'thread_binding_mismatch'; threadId: string; expectedTaskId: string; actualThreadId: string };
```

   - `ProjectKanbanPanel.vue` 改为消费 store 状态，不再把“成功空数组”和“请求失败/绑定不一致”混成空态。
   - 看板任务卡展示 title、status、owner、task id 或 short id。无 owner 时仍展示任务，不应因为 ownerCatId 为空消失。

6. 增加刷新触发。
   - `ClowderConversationPanel` 切到 `kanban` tab 时调用刷新。
   - active conversation 改变时刷新。
   - 手动 `刷新` 保留。
   - 若 IM Web 能拿到 Clowder websocket 或 TangSeng relay 的 `task_created/task_updated`，收到相同 threadId 的事件立即刷新。
   - 如果暂时没有事件 relay，聊天消息中出现 task id 时只触发一次结构化 refresh 和 diagnostic check，不直接生成 UI 行。
   - `ProjectKanbanPanel` 使用 `onUnmounted` 清理 polling interval。

7. 修复 coordinator 任务创建提示和失败回显。
   - coordinator system prompt 或 tool result handling 必须要求：只有 `cat_cafe_create_task` 返回成功 task id 后，才能在聊天里说“已建任务”。
   - 如果 owner 解析失败、callback 401/403、task route 失败，聊天中要回显失败原因，不得生成看似成功的 task id。
   - 对 `@前端` 这类角色名，确认能解析到稳定 catId；不能解析时创建 unassigned task 或返回明确错误，二选一，不要静默失败。

8. 增加可观察性。
   - 在 task create callback 日志中记录 `taskId/threadId/userId/ownerCatId/invocationId/coordinationId`。
   - 在 IM Web task query 失败或 mismatch 时记录 `channelId/channelType/externalChatId/boundThreadId/expectedTaskId/actualThreadId`。
   - 在 Clowder panel overview 可临时显示 `Thread`、`HubThread`、`ExternalChat` 诊断字段，方便确认绑定。

## 6. 验证方式与回归测试建议

后端/API 测试：

- `callback-task-routes.ts`：`POST /api/callbacks/create-task` 用 invocation principal 的 `threadId` 写入任务，随后 `GET /api/threads/:threadId/tasks` 返回该任务。
- `tasks.ts`：`GET /api/tasks/:id` 可以查到 task，并包含 `threadId/ownerCatId/status`。
- `thread-tasks.ts`：`GET /api/threads/:threadId/tasks?expectedTaskId=...` 对不同 thread 的 task 返回 `thread_binding_mismatch` 诊断。
- `connector-webhooks.ts` + `ImWebInboundHandler.ts`：IM Web `/new` command response 带 conversation threadId；Hub thread 不覆盖 conversation thread。
- `ConnectorCommandLayer.ts`：`/new`、`/use`、`/thread` binding 更新后 response 的 threadId 是新绑定 thread。
- TangSeng `modules/clowder`：`proxyThreadTasks` 保留 upstream status；direct virtual cat externalChatId 在显式 send 和 listener path 一致。

前端测试：

- `ProjectKanbanPanel.vue` 在 tasks response 有任务时渲染 title、owner、status、task id。
- route 401/403/404/502 时显示错误，不显示“还没有任务”。
- success empty 时才显示空态。
- `thread_binding_mismatch` 时显示 task 属于另一个 thread 的诊断。
- tab 从 overview 切到 kanban 会触发刷新。
- `task_created/task_updated` 或聊天 task-id diagnostic signal 触发 refresh。
- 组件 unmount 后 polling interval 被清理。

端到端 smoke：

- 打开 `clowder_cat:coordinator/1` 直聊。
- 让 coordinator 创建任务“制作婚礼网页首版”并分配给前端角色。
- 捕获聊天中返回的 task id。
- 读取 panel 的 `boundThreadId`。
- 断言 `GET /v1/clowder/thread/:boundThreadId/tasks` 包含该 task id。
- 不刷新整页，切到 `看板` 后应看到任务标题、owner 和状态。
- 故意让 task 写到另一个 thread 的测试夹具应显示 `thread_binding_mismatch`，不能显示空态。

建议命令：

```bash
cd seedcmp/sections/clowder-ai/packages/api
pnpm test -- integration/task-callback tasks-route connector-thread-binding-store connector-router-hub-thread-race
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
pnpm exec vitest run tests/clowderPanel.test.ts tests/clowderBridgeContracts.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

## 7. 风险点与注意事项

- 不要通过解析聊天文本伪造看板任务。聊天中的 task id 只能用于触发刷新和 mismatch 诊断。
- 不要把 Hub thread 当成 conversation thread。Hub 可以保存 command audit，但看板必须读 conversation-bound thread。
- 不要只依赖 10 秒 polling。它可以兜底，但 P0 体验需要事件或 task-created 信号触发即时刷新。
- 不要把 upstream route failure 显示成“还没有任务”。
- owner 解析失败不能导致任务完全不可见。任务属于当前 thread 时，即使 `ownerCatId` 为空也应显示。
- direct virtual cat externalChatId 必须用户隔离，否则不同用户或不同入口会绑定到不同 thread。
- 与 V3-31/V3-32 同步时注意边界：V3-35 的验收只要求 created task 出现在看板；artifact/workspace 展示不要阻塞这个修复。
