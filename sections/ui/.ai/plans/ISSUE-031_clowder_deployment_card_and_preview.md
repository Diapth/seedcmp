# ISSUE-031 Clowder 部署确认卡与预览卡实施计划

**Issue**：`sections/ui/.ai/issues/ISSUE-031_clowder_deployment_card_and_preview.md`
**Goal**：在 Clowder 智能体直聊中识别部署意图，创建部署确认卡，用户确认后调用真实 deployment request/action，终态展示预览 URL、复制和打开入口。
**AI修复模式**：Plan First
**前端验证**：Yes，必须覆盖桌面 Web viewport 和移动端 viewport。
**非目标**：不新增不存在的 `POST clowder/deployments`；不把“同意部署”降级为普通聊天文本。

---

## 现象与根因

`sections/ui` 缺少部署意图识别、部署卡消息类型、状态机、后端 request/action wrapper 与预览 URL 操作。后端真实入口已经在 `sections/im` 中暴露为 `clowder/conversation/deployment-request` 和 `clowder/conversation/deployment-action`。

## 受影响模块

- `sections/ui/services/native-im/service.js`
- `sections/ui/services/native-im/deployment.js`（新增）
- `sections/ui/stores/message.js`
- `sections/ui/pages/chat/index.vue`
- `sections/ui/pages/chat/detail.vue`
- `sections/ui/components/chat/MessageBubble.vue`
- `sections/ui/components/chat/DeploymentCard.vue`（新增）
- `sections/ui/tests/native-im.test.mjs`

参考：

- `sections/im_web/packages/datasource-vue/src/api/clowder.ts`
- `sections/im_web/apps/chat/src/components/MessageInput.vue`
- `sections/im_web/apps/chat/src/components/MessageList.vue`
- `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`
- `sections/clowder-ai/packages/api/src/routes/connector-deployment-requests.ts`
- `sections/clowder-ai/packages/api/src/routes/connector-deployment-action.ts`

## 推荐设计

卡片存储内容使用 `content.type = 7`、`cardType = 'deployment'`，API 状态保持后端命名：`pending_confirmation`、`confirmed`、`queued`、`running`、`succeeded`、`failed`、`cancelled`。UI 可把 `queued/running` 展示为“部署中”，把 `succeeded` 展示为“部署完成”，但 store 里不丢弃原始状态。

发送消息后：

1. 识别 Clowder 直聊 + 部署意图。
2. 调 `createDeploymentRequest` 或 `fetchActiveDeploymentRequest` 获得后端规范 request。
3. `messageStore.upsertDeploymentCard` 插入卡片。
4. 否定表达如“不部署/先不部署”不能触发部署卡。

用户确认后：

1. `sendDeploymentAction({ action: 'confirm', actionId, cardMessageId, sourceMessageId })`。
2. 根据返回 request 更新卡片。
3. `confirmed/queued/running` 时轮询 `fetchDeploymentRequest(id)`。
4. 终态停止轮询。

## 阶段计划

### Phase 1：部署 service 与 util 红绿测试

**Files**

- Create: `sections/ui/services/native-im/deployment.js`
- Modify: `sections/ui/services/native-im/service.js`
- Test: `sections/ui/tests/native-im.test.mjs`

**TDD**

1. 新增失败测试：
   - `detects deployment intent in clowder direct chat text`
   - `native service uses conversation deployment request endpoints`
   - `deployment action posts idempotent confirm payload`
2. 运行 `npm run test:native-im`，确认缺失失败。
3. 实现 service wrapper：
   - `createDeploymentRequest`
   - `updateDeploymentRequest`
   - `fetchActiveDeploymentRequest`
   - `fetchDeploymentRequest`
   - `sendDeploymentAction`
   - `fetchDeployment`
   - `fetchDeploymentLogs`
4. 再跑 `npm run test:native-im`。

**阶段提交示例**：`接入 Clowder 部署服务接口`

### Phase 2：部署卡消息状态机

**Files**

- Modify: `sections/ui/stores/message.js`
- Test: `sections/ui/tests/native-im.test.mjs`

**TDD**

1. 新增失败测试：
   - `upserts one deployment card for the same deployment request`
   - `maps running request to deploying card view`
   - `keeps previewUrl and downloadUrl after succeeded`
2. 实现 `upsertDeploymentCard`、`updateDeploymentCard`、`findDeploymentCard`。
3. 使用 `deployment-card-${deploymentRequestId}` 作为幂等 `clientMsgNo`。
4. 必备字段：`status`、`statusLabel`、`target`、`environment`、`deploymentRequestId`、`deploymentJobId`、`previewUrl`、`downloadUrl`、`logsSummary`、`failureReason`、`missingFields`、`targetCandidates`、`environmentCandidates`。

**阶段提交示例**：`实现部署卡消息状态机`

### Phase 3：卡片组件与发送链路

**Files**

- Create: `sections/ui/components/chat/DeploymentCard.vue`
- Modify: `sections/ui/components/chat/MessageBubble.vue`
- Modify: `sections/ui/pages/chat/index.vue`
- Modify: `sections/ui/pages/chat/detail.vue`

**Implementation**

1. 桌面和移动发送成功后调用同一 action 插入部署卡。
2. 卡片支持取消、同意部署、重试、复制预览 URL、打开预览。
3. `window.open` 仅在 H5 可用时调用；移动端至少复制 URL 并 toast。
4. 空/失败状态不遮挡普通消息流。

**阶段提交示例**：`渲染 Clowder 部署确认卡`

### Phase 4：验证与证据

**Verification**

```bash
cd sections/ui && npm run test:native-im
cd sections/ui && npm run build:h5
PATH=/home/yunyi/go1.22/go/bin:$PATH bash scripts/start-im-clowder.sh start
```

Playwright/browser 证据保存到：

```text
sections/ui/.ai/tests/ISSUE-031-<timestamp>/
```

必须保存：

- `desktop-1440x900-deployment-confirm.png`
- `desktop-1440x900-deployment-preview.png`
- `mobile-375x844-deployment-confirm.png`
- `mobile-375x844-deployment-preview.png`
- `browser-console.json`
- `request-log.json`
- `result.json`

**阶段提交示例**：`完成部署卡浏览器验收`

## 风险与回滚

- 后端若返回 `needs_fields` 或 `missingFields`，卡片要展示缺字段状态，不能直接确认。
- 若无实时事件，使用轮询；轮询失败进入 `failed`，不伪造成功预览。
- 回滚可关闭发送链路触发，保留 service wrapper。

## Done

- ISSUE-031 文档状态更新为 `Resolved`。
- 自动化测试、build、桌面/移动截图证据通过。
- 中文 commit 完成。
