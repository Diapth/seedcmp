# V3-36 解决计划：Deployment Card Has No Way To Choose Target Or Environment

## 1. 问题现象

2026-06-04 的 IM Web V3.0 Clowder 部署流程中，用户输入部署意图后，聊天区出现部署确认卡片：

- `Deployment`
- `确认部署`
- `目标: 待确认目标`
- `环境: 待确认环境`
- `请先补充部署目标、部署环境`
- `确认` 按钮被禁用或不可操作，`取消` 可见

用户随后在普通聊天中补充：

```text
部署婚礼，环境是本地
```

以及：

```text
你来部署吧，给我网页
```

但现有 UI 没有输入框、选择器、quick reply 或“编辑字段”入口来补全 `target/environment`。普通 follow-up 也不会更新已有 pending deployment card，而是可能再次走 `detectDeploymentIntent()` 并插入新的不完整卡片。

当前代码能解释这个现象：

- `apps/chat/src/utils/deploymentIntent.ts` 只在发送当下解析一段文本，返回 `target/environment/missingFields`。它没有 pending request 上下文，也不负责把 follow-up 合并到已有卡片。
- `detectEnvironment()` 只识别 `production/staging/testing/development` 等环境，不识别用户报告中的 `本地/local`。
- `MessageInput.vue` 的 `handleSend()` 检测到部署意图后直接 `addDeploymentConfirmationCard()`，创建的是本地消息卡片；没有先在 Clowder 后端登记 pending deployment request，也没有查询当前 conversation 是否已有待补全请求。
- `CardCell.vue` 对 deployment card 只渲染静态 `目标/环境` 文本和 `confirm/cancel` 两个 action；没有 field schema、输入控件或字段更新事件。
- `MessageList.vue` 的 `handleDeploymentCardAction()` 在 `needs_fields` 或 `missingFields.length > 0` 时只 toast `请先补充部署目标和环境`，但没有任何补充入口。
- `packages/datasource-vue/src/api/clowder.ts` 与 `clowderStore.ts` 只有 `sendDeploymentAction()`，请求类型虽然能携带 `target/environment`，但 action 只有 `confirm/cancel`，没有 `update_fields`。
- TangSeng `conversationDeploymentAction()` 只是把 card click 透明转发到 Clowder。
- Clowder `routes/connector-deployment-action.ts` 只用进程内 `Map` 记录 `confirm/cancel` action idempotency，并根据 body 判断 `needs_fields`；它不是持久 pending request store，也不会更新聊天卡片。

## 2. 根因判断

V3-36 的根因不是文案不清楚，而是部署确认状态机缺少“字段收集”和“pending request 归并”两段关键链路。

已确认的关键断点：

- 部署卡片是一次性本地渲染结果，不是一个可被后续消息和 UI 控件共同更新的结构化请求。
- `deploymentRequestId` 只存在于本地卡片内容和 confirm/cancel action 中；后端没有按 request id 保存 `target/environment/status/missingFields` 的事实源。
- follow-up 文本没有先匹配“当前 conversation/thread 是否存在 active deployment request”，因此 `部署婚礼，环境是本地` 会被当作新的部署意图，而不是补全旧请求。
- `本地` 没有进入环境枚举，导致用户已经提供的环境仍会被判为缺失。
- target 候选没有从当前 thread/workspace/artifact/task 上下文生成，用户只能猜“目标”应该填项目名、页面名、路径、artifact 还是 route。
- `confirm` 已经被 V3-29 方向改为结构化 action，但 V3-36 要求的是 action 之前的字段收集、状态持久化和卡片更新。

与其他 issue 的关联：

- 与 V3-29 相邻：V3-29 解决“确认/取消点击如何路由”，V3-36 解决“确认前如何补齐 target/environment”。
- 与 V3-37 强关联：部署 `target` 应优先从 active Maomi project workspace、已登记 artifact、preview route 中给候选，例如 `maomi_workspace/wedding`。
- 与 V3-35/V3-31 同类：聊天 transcript、右侧结构化面板和 Clowder runtime 之间缺少同一个事实源，导致用户看见“系统要求补信息”，但没有可操作状态。

## 3. 影响范围

- IM Web：
  - `apps/chat/src/utils/deploymentIntent.ts`
  - `apps/chat/src/components/MessageInput.vue`
  - `apps/chat/src/components/MessageList.vue`
  - `packages/base-vue/src/components/messages/CardCell.vue`
  - `packages/datasource-vue/src/api/clowder.ts`
  - `packages/datasource-vue/src/stores/clowderStore.ts`
- TangSeng Clowder bridge：
  - `modules/clowder/api.go`
  - deployment request/action proxy tests
- Clowder API：
  - `routes/connector-deployment-action.ts`
  - 新增或扩展 deployment request store/route
  - connector inbound/follow-up routing
  - workspace/artifact candidate lookup
- 相关测试：
  - `apps/chat/tests/deploymentCard.test.ts`
  - `apps/chat/tests/clowderCommandContracts.test.ts`
  - TangSeng `modules/clowder`
  - Clowder API deployment request/action tests

## 4. 推荐修复方案

先建立持久的 `DeploymentRequest` 事实源，再让卡片 UI、自然语言 follow-up、confirm/cancel action 都围绕同一个 request 更新。

推荐数据结构：

```ts
interface DeploymentRequest {
  id: string;
  userId: string;
  connectorId: 'im-web';
  channelId: string;
  channelType: 1 | 2;
  threadId?: string;
  externalChatId?: string;
  sourceMessageId?: string;
  cardMessageId?: string;
  originalText: string;
  target: string | null;
  environment: 'local' | 'preview' | 'testing' | 'staging' | 'production' | 'development' | null;
  missingFields: Array<'target' | 'environment'>;
  status: 'needs_fields' | 'pending_confirmation' | 'confirmed' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  targetCandidates: DeploymentTargetCandidate[];
  environmentCandidates: DeploymentEnvironmentCandidate[];
  workspaceId?: string;
  workspacePath?: string;
  createdAt: number;
  updatedAt: number;
}

interface DeploymentTargetCandidate {
  id: string;
  label: string;
  value: string;
  source: 'active_workspace' | 'recent_workspace' | 'artifact' | 'preview' | 'task' | 'text';
  workspaceId?: string;
  path?: string;
}
```

推荐状态流：

1. 用户发送 deployment-like 文本。
2. IM Web 先查询或本地判断当前 conversation 是否有 `needs_fields/pending_confirmation` request。
3. 如果有 pending request，则把文本作为 field update 尝试解析并更新旧卡片。
4. 如果没有 pending request，则创建新的 `DeploymentRequest`，Clowder 返回 request id、字段、候选和卡片 payload。
5. 卡片在 `needs_fields` 状态下显示字段控件或 quick replies。
6. 用户通过 UI 或自然语言补齐字段后，request 状态变为 `pending_confirmation`，确认按钮启用。
7. `confirm/cancel` 继续走结构化 deployment action，但 action payload 必须引用同一个 request id 和已解析字段。

## 5. 具体实施步骤

1. 扩展 deployment parser。
   - 在 `deploymentIntent.ts` 中识别 `本地/local/localhost` 为 `environment=local`。
   - 支持 `环境是本地`、`部署婚礼，环境是本地`、`把婚礼部署到本地` 这类中文语序。
   - target parser 要避免把 `环境/本地/生产` 误吞为 target；中文逗号、空格、`到/至` 都应作为边界。
   - 输出时区分 `no_deployment_intent`、`new_deployment_request`、`deployment_field_update`，不要只返回 `shouldConfirm`。

2. 新增 Clowder deployment request store。
   - 新建 store 接口，例如 `DeploymentRequestStore`，支持 `create/get/update/listActiveByConversation/cancel/confirm`。
   - Redis 可用时持久化；没有 Redis 时用 in-memory，但 response 和测试仍按持久接口设计。
   - idempotency key 不应只覆盖 action，还要覆盖 request 创建和字段更新。
   - 保存 `channelId/channelType/threadId/userId/sourceMessageId/cardMessageId/target/environment/missingFields/status`。

3. 新增或扩展 API contract。
   - Clowder API：
     - `POST /api/connectors/im-web/deployment-requests`
     - `PATCH /api/connectors/im-web/deployment-requests/:id`
     - `GET /api/connectors/im-web/deployment-requests/active?channelId=&channelType=`
     - `POST /api/connectors/im-web/deployment-action`
   - TangSeng proxy：
     - `POST /v1/clowder/conversation/deployment-request`
     - `PATCH /v1/clowder/conversation/deployment-request/:id`
     - `GET /v1/clowder/conversation/deployment-request/active`
     - 保留现有 `/conversation/deployment-action`，但补测试确认 status/body 透明转发。
   - IM Web datasource：
     - `createDeploymentRequest()`
     - `updateDeploymentRequestFields()`
     - `loadActiveDeploymentRequest()`
     - `sendDeploymentAction()`

4. 改造 `MessageInput.vue` 的发送流程。
   - 用户发送文本后，如果是 Clowder conversation，先调用 `clowderStore.loadActiveDeploymentRequest(conversationRef)` 或从 store cache 找 active request。
   - 如果存在 active request 且文本能解析出 target/environment，则调用 `updateDeploymentRequestFields()`，更新旧卡片，而不是 `addDeploymentConfirmationCard()`。
   - 如果文本明确表示“另一个/新的部署”，才创建新 request；否则有 pending request 时优先补字段。
   - 创建新 request 时由后端返回 request/card payload；前端再插入或更新卡片，避免只存在本地临时状态。

5. 改造 `CardCell.vue` 为可编辑 deployment card。
   - deployment content 增加 `fieldDefinitions` 或明确字段结构。
   - 缺环境时展示环境 quick replies：`本地`、`预览`、`测试`、`预发`、`生产`。
   - 缺目标时展示 target candidates；没有候选时提供短文本输入或“从当前工作区选择”入口。
   - `emit` 增加字段更新事件，例如：

```ts
(event: 'deployment-field-update', payload: {
  deploymentRequestId: string;
  field: 'target' | 'environment';
  value: string;
  message: any;
}): void;
```

   - `confirm` 在 `missingFields.length > 0` 时继续 disabled，并显示具体缺什么；字段补齐后立即 enabled。

6. 改造 `MessageList.vue` action handler。
   - 增加 `handleDeploymentFieldUpdate()`，调用 store 更新 request 并合并 response 到原卡片。
   - `handleDeploymentCardAction()` confirm 时不要再信任本地 content 的占位值，应先用 request id 读取或以后端响应为准。
   - confirm/cancel 成功后更新卡片状态；失败时保留可重试状态和 inline error。
   - 旧的 legacy deployment card 没有 request id 时，显示“请重新发起部署”或走迁移创建 request，不能静默确认。

7. 生成 target candidates。
   - 短期候选：
     - 当前 conversation bound thread 的 `projectPath`
     - V3-37 的 active workspace
     - 当前 thread 已登记 artifact/preview
     - 最近 done task 的 artifact refs
   - 中期候选：
     - `MaomiWorkspace` 列表
     - preview service 的 route/url
     - deployment profile registry
   - 候选 value 要能被后端执行，不要只传用户可读 label。

8. 防止重复卡片。
   - `DeploymentRequestStore.listActiveByConversation()` 同一 conversation 默认只允许一个 active request。
   - 新 deployment intent 到来时，如果 active request 字段未全，先更新旧 request。
   - 如果 active request 已 `pending_confirmation`，用户又说“你来部署吧”，应提示确认当前 request，而不是新建。
   - 如果用户明确“部署另一个项目/todo”，再创建新 request，并可自动 cancel/resolve 前一个。

9. 与部署执行链路对接。
   - `connector-deployment-action.ts` 在 `confirm` 且字段完整后，不只返回 `confirmed`，还要调用或 enqueue 实际部署 command。
   - payload 包含 `target/environment/workspaceId/threadId/actionId/actorUserId`。
   - 执行状态通过 outbound 或 request polling 回写 `running/succeeded/failed`。

10. 页面刷新恢复。
   - message history 中保存 card payload 和 request id。
   - `ClowderConversationPanel` 或 message hydration 时，按 request id 拉取最新状态并合并。
   - 刷新后目标、环境、错误和确认状态不丢。

## 6. 验证方式与回归测试建议

Parser 测试：

- `部署婚礼，环境是本地` -> `target=婚礼`、`environment=local`、无 missing environment。
- `把婚礼部署到本地` -> `target=婚礼`、`environment=local`。
- `你来部署吧，给我网页` 在无 pending request 时创建欠指定请求；有 pending request 时不新建。
- 否定句 `先不要部署` 仍不是 deployment request。

API 测试：

- `POST /api/connectors/im-web/deployment-requests` 创建 `needs_fields` request 并返回候选。
- `PATCH /deployment-requests/:id` 补 `target/environment` 后状态变为 `pending_confirmation`。
- 同一 conversation 有 active request 时，重复 create 返回已有 request 或明确 `active_request_exists`。
- `POST /deployment-action` 在字段缺失时返回 `needs_fields`，字段完整时返回 `confirmed/running`。
- Redis/in-memory store 都覆盖 idempotency 和刷新恢复。

前端测试：

- `CardCell.vue` 在缺字段时渲染环境 quick replies 和 target 输入/候选。
- 点击 `本地` 后 emit `deployment-field-update`。
- 字段补齐前 `确认` disabled；补齐后 enabled。
- `MessageInput.vue` 对 `部署婚礼，环境是本地` 更新已有 card，不新增第二张 card。
- `MessageList.vue` 字段更新 API 成功后合并 `target/environment/missingFields/status`。
- API 500 时保留旧字段并显示可重试错误。

浏览器 smoke：

- 发送 `帮我部署`。
- 卡片显示 `target/environment` 缺失，并出现环境选择。
- 选择 `本地`，输入或选择 `婚礼`。
- 断言同一张卡片变为 `pending_confirmation`，确认按钮启用。
- 点击确认，Clowder 收到结构化 action，payload 包含 `target=婚礼`、`environment=local`。
- 刷新页面后卡片仍显示已解析字段，不回到 `待确认目标/待确认环境`。

建议命令：

```bash
cd seedcmp/sections/im_web/apps/chat
pnpm exec vitest run tests/deploymentCard.test.ts tests/clowderCommandContracts.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

```bash
cd seedcmp/sections/im_web
pnpm type-check
pnpm test:unit
```

```bash
cd seedcmp/sections/im/TangSengDaoDaoServer
go test -count=1 ./modules/clowder
```

```bash
cd seedcmp/sections/clowder-ai/packages/api
pnpm test -- connector-deployment-action deployment-request
```

## 7. 风险点与注意事项

- 不要只加提示文案。用户需要真实字段控件和 pending request 更新链路。
- 不要让 `待确认目标/待确认环境` 或空字符串进入确认执行。
- 不要把 follow-up 文本全部当作新部署请求；必须先尝试补全同一 conversation 的 active request。
- 不要只把 deployment request 存在前端本地消息里；刷新和跨设备需要后端事实源。
- `本地/local` 是用户报告里的明确验收点，必须进环境枚举。
- V3-37 落地后，deployment target 候选应优先使用 active Maomi workspace；V3-37 未完成前，也要用当前 thread/project/artifact 生成临时候选。
- 高风险部署确认必须保留 action idempotency、actor user、时间戳和最终执行状态。
