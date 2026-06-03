# V3-29 解决计划：Deployment Confirmation Card Cannot Be Actioned From IM Web

## 1. 问题现象

用户在 IM Web 的 Clowder/cat/coordinator 会话中输入部署请求后，聊天区出现部署确认卡片，但无法完成部署确认流程。issue 截图中可见卡片标题为 `Deployment / 待确认`，内容为 `确认部署`，目标与环境显示为 `待确认目标`、`待确认环境`，并展示 `确认`、`取消` 按钮；右侧还出现一个蓝色 `部署` 操作入口。

当前代码已具备一个前端局部链路：

- `apps/chat/src/utils/deploymentIntent.ts` 会识别 `部署/上线/发布/deploy` 等关键词，并在无法解析时返回 `待确认目标`、`待确认环境`。
- `apps/chat/src/components/MessageInput.vue` 的 `handleSend()` 在检测到部署意图时只插入本地卡片，不再调用普通 `sendClowderRouteMessage()`。
- `packages/base-vue/src/components/messages/CardCell.vue` 会渲染部署卡片并发出 `confirm/cancel` action。
- `apps/chat/src/components/MessageList.vue` 的 `handleDeploymentCardAction()` 会接收 action，并在确认时调用 `clowderStore.sendConversationMessage()` 发送一条普通文本消息。

但这些代码只能说明“有本地按钮和普通消息回传”，不能证明真实点击后 Clowder 会收到结构化部署审批，也不能处理缺失目标/环境的情况。

## 2. 根因判断

初步判断不是单一 CSS 点击问题，而是部署确认链路的产品状态机和后端契约不完整。

已确认的代码证据：

- 欠指定请求也会生成可点击卡片：`detectDeploymentIntent()` 对 `帮我部署` 会返回 `shouldConfirm: true`，同时 target/environment 是占位文本。
- `CardCell.vue` 的 `deploymentActionDisabled` 只按 `confirmed/running/cancelled` 禁用，不检查 `待确认目标` 或 `待确认环境`，所以 UI 允许用户“确认一个未指定部署”。
- `MessageInput.vue` 在 `needsDeploymentConfirmation` 为 true 时，只调用 `addDeploymentConfirmationCard()`，没有把初始部署意图作为结构化 intent 发送给 Clowder 建立 pending approval。
- `MessageList.vue` 确认时发送的是普通文本 `用户已确认部署：...`，缺少稳定的 `deploymentRequestId/blockId/actionId/threadId/messageId/target/environment` 等结构化字段。Clowder 可能把它当作普通聊天消息，而不是审批回调。
- `MessageList.vue` 取消时只更新本地卡片状态并 toast `已取消部署`，没有向 Clowder 发送取消事件。
- 当前测试 `apps/chat/tests/deploymentCard.test.ts` 主要检查源码字符串和基础渲染，没有真实点击事件、payload、幂等、错误回滚或 Clowder 路由断言。
- 代码搜索未在 IM Web 侧找到独立的蓝色 `部署` 按钮实现，截图中的入口可能来自 rich block、右侧 dock、浏览器状态或外部 UI。需要后续用 DOM/Playwright 定位它的真实来源。

与其他 issue 的关联：

- 与 V3-31 共用“聊天 UI 与 Clowder runtime 结构化状态没有可靠桥接”的根因。
- 与 V3-32 相关：如果部署实际作用于某个 agent workspace 或 runtime checkout，审批 payload 必须包含可审计的 workspace/project reference，不能只发送自然语言。

## 3. 影响范围

- IM Web 中所有 Clowder/cat/coordinator 会话的部署确认流程。
- 部署、发布、上线等高风险操作的审批、取消、重试和审计记录。
- 欠指定部署请求的字段收集流程。
- `CardCell.vue` 的 interactive card 行为以及 `MessageList.vue` 的 rich action 处理。
- TangSeng `modules/clowder` 到 Clowder API 的 conversation/message 或 future command proxy。
- Clowder side 的 interactive block / permission / deployment command registry。

## 4. 推荐修复方案

建立一个明确的部署确认状态机和结构化命令契约，而不是继续依赖普通文本“用户已确认部署”。

推荐状态：

- `needs_fields`：目标或环境缺失，不能确认部署。
- `pending_confirmation`：字段完整，等待用户确认。
- `confirmed`：用户已确认，Clowder 已收到确认请求。
- `running`：Clowder 已开始执行。
- `succeeded` / `failed` / `cancelled`：最终状态。

推荐数据结构：

- `deploymentRequestId`：由 IM Web 生成或 Clowder 返回的稳定 id。
- `sourceMessageId/clientMsgNo`：原始用户消息。
- `cardMessageId/clientMsgNo`：确认卡片消息。
- `threadId`、`channelId`、`channelType`、`connectorId`。
- `target`、`environment`、`missingFields`。
- `action`：`confirm` 或 `cancel`。
- `actionId` / `nonce`：防重复点击和重放。
- `actorUserId` 和时间戳。
- 可选 `workspaceRef` / `projectPath`，用于 V3-32 后续 workspace 审计。

UI 策略：

- 字段缺失时不要展示可误解的主按钮，或将“确认”置为 disabled 并展示明确原因；提供补充字段的输入/追问入口。
- 字段完整时卡片和右侧/浮动 `部署` 入口必须共用同一个 action handler。
- 确认和取消都必须发送结构化 action 给 Clowder，并根据后端响应更新状态。
- 失败时回到 retryable 状态，并显示 inline error 或 toast。

## 5. 具体实施步骤

1. 梳理截图中蓝色 `部署` 的真实 DOM 来源。
   - 用 Playwright 定位按钮 selector、父层级、z-index、事件监听。
   - 如果它来自部署卡片外的重复入口，合并到卡片 action；如果是无效遗留入口，移除。

2. 定义前后端部署 action contract。
   - 在 `packages/datasource-vue/src/api/clowder.ts` 增加 `confirmDeployment()` / `cancelDeployment()` 或统一 `sendDeploymentAction()`。
   - TangSeng 在 `modules/clowder/api.go` 增加 proxy endpoint，例如 `POST /v1/clowder/conversation/deployment-action`。
   - Clowder API 增加对应 command/callback route，返回标准状态和错误码。

3. 调整 deployment intent 创建流程。
   - `MessageInput.vue` 检测到部署请求后，先生成 `deploymentRequestId`。
   - 若目标/环境缺失，将卡片状态设为 `needs_fields`，并保存 `missingFields`。
   - 若字段完整，状态为 `pending_confirmation`。
   - 不要仅依赖本地卡片；必要时向 Clowder 发送 `deployment_intent_created`，让后端也能登记 pending action。

4. 调整 `CardCell.vue`。
   - 根据 `missingFields` 禁用确认按钮并展示禁用原因。
   - `cancel` 在 `needs_fields/pending_confirmation/failed` 状态仍应可用。
   - 按钮应有真实 accessible name，并保留键盘可操作性。

5. 调整 `MessageList.vue` action handler。
   - `confirm` 和 `cancel` 都走统一结构化 API。
   - 使用 `deploymentRequestId + action` 做幂等键，而不是只用 `clientMsgNo`。
   - 先进入 `submitting` 或 `confirmed_pending_ack`，后端成功后再切 `confirmed/running/cancelled`。
   - 后端失败时恢复到可重试状态并保留错误信息。

6. 打通 Clowder runtime。
   - Clowder 侧将 deployment action 识别为审批事件，而不是普通用户文本。
   - 如果目标/环境缺失，返回 `missing_fields`，由 IM Web 更新为字段收集态。
   - 执行状态变化通过 outbound/bridge 回写卡片状态。

7. 持久化和历史恢复。
   - 卡片内容必须能通过 message history 恢复。
   - 刷新后仍能看到 request id、审批人、目标、环境、最终状态。

## 6. 验证方式与回归测试建议

单元/组件测试：

- `CardCell.vue`：点击确认/取消时断言 emitted payload；字段缺失时确认不可点击且有原因；取消仍可点击。
- `MessageList.vue`：mock `clowderStore.sendDeploymentAction()`，断言 confirm/cancel 各调用一次，payload 包含 request id、thread/channel、target/environment、actionId。
- `deploymentIntent.test.ts`：覆盖 `帮我部署`、`部署到生产环境`、`deploy cat-cafe-web to staging`、否定/讨论句。
- `clowderCommandContracts.test.ts`：验证 TangSeng/Clowder proxy contract 字段和错误码。

浏览器回归：

- 完整请求：发送 `deploy cat-cafe-web to staging`，点击确认，观察卡片进入 confirmed/running，Clowder 收到结构化 action。
- 欠指定请求：发送 `帮我部署`，确认按钮不可误点，UI 提示补全目标和环境。
- 取消路径：点击取消，Clowder 收到 cancellation，卡片刷新后保持 cancelled。
- 重复点击：快速双击确认，只产生一个后端 action。
- 失败路径：模拟 500/timeout，卡片显示错误并允许重试。

建议命令：

```bash
cd seedcmp/sections/im_web
pnpm type-check
pnpm test:unit
```

```bash
cd seedcmp/sections/im_web/apps/chat
pnpm exec vitest run tests/deploymentCard.test.ts tests/clowderCommandContracts.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

```bash
cd seedcmp/sections/im/TangSengDaoDaoServer
go test -count=1 ./modules/clowder
```

```bash
cd seedcmp/sections/clowder-ai/packages/api
pnpm test -- command-registry callback-routes
```

## 7. 风险点与注意事项

- 不要让 `待确认目标/待确认环境` 作为真实部署参数进入执行路径。
- 不要只修 CSS 或按钮点击；必须证明 Clowder 收到结构化审批。
- 不要把取消当成本地 UI 状态，取消也属于高风险操作审计。
- 需要处理旧消息历史中的无 request id 部署卡片，可显示为 legacy/unactionable 并提供重新发起。
- 如果保留普通文本确认作为兼容路径，也必须加明确的 `metadata.intent = deployment_confirmed`，避免模型误判。
- 注意 V3-31/V3-32：部署结果、运行工作区和产物都应关联到同一 thread/task/workspace ledger，避免审批完成但看板/产物仍为空。
