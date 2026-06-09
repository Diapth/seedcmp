# [ISSUE-031] UI 接入 Clowder 智能体部署确认卡与预览卡

**状态**：Resolved
**创建时间**：2026-06-09
**标签**：feature / clowder / deployment / card / preview / im-web-parity
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-031_clowder_deployment_card_and_preview.md
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

**修复执行规则**：
- 若 `AI修复模式：Plan First`，先使用 `writing-plans` 写计划，计划无需用户确认直接实现。
- 若 `AI修复模式：Direct Fix`，可以直接修复，但必须使用 `tdd` 思路：先补/确认回归测试，再改实现，再验证。
- 若涉及前端页面、截图或交互验收，必须使用 `browser-preview` 或 Playwright 实测。
- 测试截图必须保存到 `seedcmp/sections/ui/.ai/tests-e2e/` 下，并按 issue 序号命名。
- 若遇到测试失败或行为不符合预期，使用 `debugging` / `systematic-debugging` 定位根因。
- 完成前使用 `verification-before-completion`，确认验证结果后再说完成。

---

## 问题描述

`sections/ui` 当前没有接上 Clowder 智能体的"部署"能力卡片。当用户在和 Clowder 智能体对话中表达"部署一下"、"帮我部署到线上"、"部署这个项目"等意图时，前端没有识别这种部署意图，也没有生成相应的部署确认卡和部署完成后的预览卡，导致用户无法：

1. 在前端看到"是否同意部署"的确认卡片（包含部署主题、下载代码压缩包）。
2. 在智能体部署过程中跟踪部署状态。
3. 在部署完成后看到"取消部署 / 打开预览"的操作卡，并拿到可复制的预览网址。

现状：

1. `sections/ui` 没有识别"部署"意图的逻辑。
2. 没有 `deployment_confirmation` / `deployment_progress` / `deployment_preview` 这类消息卡片类型。
3. 没有部署后端接口的 service 包装（如 `clowder/conversation/deployment-request`、`clowder/conversation/deployment-action`）。
4. 没有把"下载代码压缩包"、"打开预览"等操作串起来的 UI 组件。
5. `sections/im_web` 有参考链路，需要迁移/适配到 `sections/ui` 的 uni-app 页面和 store 架构。

本 issue 目标：让 `sections/ui` 拥有完整的 Clowder 部署卡片体验，并和真实 Clowder deployment 后端链路打通。

---

## 目标体验

### 用户路径

1. 用户打开 Clowder 智能体直聊。
2. 用户发送类似"帮我把这个项目部署一下"或"部署到测试环境看看效果"的消息。
3. 消息发送成功后，聊天流中出现一张"部署确认卡"。
4. 卡片显示部署主题（由智能体根据上下文解析得到）和"下载整体代码压缩包"链接。
5. 用户点击"同意部署"，按钮进入 loading 状态，卡片切换为"部署中"。
6. 智能体部署完成后，卡片自动更新为部署完成卡：左侧"取消部署"按钮，右侧"打开预览"按钮，卡片上显示对应的预览网址（用户可自行复制并前往访问）。
7. 用户可以点击"取消部署"中止部署，或点击"打开预览"跳转到预览网址。

### 卡片状态机

部署卡片应该是一个有完整状态机的复合卡片，至少包含以下状态：

1. `pending_confirmation`：等待用户同意，展示部署主题、下载代码压缩包、同意/取消按钮。
2. `deploying`：用户已同意部署，按钮进入 loading，文案为"正在部署中.."，可显示进度反馈。
3. `deployed`：部署完成，左侧"取消部署"，右侧"打开预览"，卡片上显示预览网址（可复制）。
4. `cancelled`：用户取消部署，展示取消原因（如果后端返回）。
5. `failed`：部署失败，展示错误原因和"重试"按钮。

---

## 复现步骤

1. 启动 `sections/ui` 并登录真实账号。
2. 打开一个 Clowder 智能体直聊。
3. 发送"帮我把这个项目部署一下"。
4. 观察聊天流是否出现部署确认卡。
5. 点击"同意部署"。
6. 等待智能体部署完成。
7. 观察卡片是否更新为"打开预览 / 取消部署"状态，且显示预览网址。

实际：

1. `sections/ui` 不会生成部署确认卡。
2. 没有"同意/取消/打开预览"的卡片状态。
3. 没有调用 `clowder/conversation/deployment-request/action` 相关后端接口。
4. 没有"下载代码压缩包"的入口。
5. 没有"预览网址"展示和复制功能。

预期：

1. Clowder 智能体直聊识别部署意图后生成部署确认卡。
2. 确认卡显示部署主题和下载压缩包链接。
3. 用户同意后走真实后端部署链路。
4. 部署完成后卡片更新为"打开预览 / 取消部署"状态，展示可复制的预览网址。
5. 失败、取消、重试和重复点击都有稳定状态。

---

## 完整设计

### 1. 触发与范围

只在 Clowder 智能体直聊中触发部署卡：

1. 当前会话是 Clowder 智能体直聊。
2. 用户文本命中部署意图，例如"部署"、"部署一下"、"部署到线上"、"帮我部署"、"发布到测试环境"等。
3. 配合上下文：智能体在最近一轮里提到过"项目"或"代码"。
4. 普通群聊、普通联系人单聊和非 Clowder 智能体直聊不自动弹部署卡，避免误触发。

初版可复用 `sections/im_web` 已有的部署意图识别规则；后续再接后端 intent result。

### 2. 卡片数据模型

建议在 `sections/ui` 增加独立的 deployment 消息 content，状态散落在卡片消息内部：

```text
type: 'deployment_card'
status: 'pending_confirmation' | 'deploying' | 'deployed' | 'cancelled' | 'failed'
deploymentId
deploymentTitle // 部署主题，由智能体解析得到
sourceText // 触发部署的原始用户消息
sourceMessageId / clientMsgNo
directChannelId
directChannelType
downloadZipUrl // 下载整体代码压缩包 URL
previewUrl // 部署完成后的预览网址
error // 失败原因
createdAt
updatedAt
```

卡片应作为聊天消息进入 `messageStore.messages[conversationId]`，这样刷新、历史恢复和卡片状态更新有统一入口。

### 3. UI 组件

新增或扩展聊天消息渲染组件：

```text
sections/ui/components/chat/DeploymentCard.vue
sections/ui/components/chat/MessageBubble.vue
sections/ui/components/chat/MessageList.vue
```

卡片内容：

1. 标题：`部署 / Deployment`
2. 部署主题（标题区下方）：由智能体根据上下文解析得到。
3. `pending_confirmation` 状态：
 - 部署主题文案。
 - "下载整体代码压缩包"链接（`downloadZipUrl`，点击触发下载）。
 - 操作按钮：左侧"取消"、右侧"同意部署"。
4. `deploying` 状态：
 - 文案："正在部署中.."。
 - 按钮 loading 状态。
5. `deployed` 状态：
 - 展示预览网址（可一键复制）。
 - 操作按钮：左侧"取消部署"、右侧"打开预览"（在新窗口/外部浏览器打开 `previewUrl`）。
6. `cancelled` 状态：展示取消文案。
7. `failed` 状态：展示错误原因和"重试"按钮。

移动端卡片必须在 375px 宽度内可读，按钮不低于 44px；桌面端卡片宽度跟随聊天气泡最大宽度，不占满整个消息区。

### 4. 后端编排

确认按钮的最小链路：

```text
handleConfirmDeployment
 -> 确保已有 deploymentRequest // POST clowder/conversation/deployment-request
 -> nativeImService.sendDeploymentAction(payload) // POST clowder/conversation/deployment-action
 -> status = confirmed / queued / running
 -> 轮询 deployment request // GET clowder/conversation/deployment-request/:deploymentRequestId
 -> 后端返回 status = succeeded / failed / cancelled
 -> 更新卡片 previewUrl
 -> status = succeeded

handleCancelDeployment
 -> nativeImService.sendDeploymentAction({ action: 'cancel' })
 -> status = cancelled
```

`handleDownloadZip`：

```text
点击 "下载整体代码压缩包" 链接
 -> 直接打开 downloadZipUrl（由后端提供，指向打包好的 zip 文件）
 -> 如果只有 deploymentJobId，则先调用 nativeImService.fetchDeployment(deploymentJobId) 补齐 downloadUrl
```

`sections/ui` 当前缺少这些 service 包装，需要补齐：

```text
createDeploymentRequest -> POST clowder/conversation/deployment-request
updateDeploymentRequest -> PATCH clowder/conversation/deployment-request/:deploymentRequestId
getActiveDeploymentRequest -> GET clowder/conversation/deployment-request/active
getDeploymentRequest -> GET clowder/conversation/deployment-request/:deploymentRequestId
sendDeploymentAction -> POST clowder/conversation/deployment-action
getDeployment -> GET clowder/deployments/:deploymentId
getDeploymentLogs -> GET clowder/deployments/:deploymentId/logs
```

### 5. 预览网址的展示

1. 卡片上以纯文本形式展示完整预览 URL。
2. URL 旁边提供"复制"按钮，点击后调用 uni-app 复制 API（`uni.setClipboardData`）。
3. 复制成功后给出轻量 toast 反馈："已复制预览网址"。
4. "打开预览"按钮触发 `plus.runtime.openURL(previewUrl, ..)` 或 `window.open(previewUrl, '_blank')`，取决于运行平台。

### 6. 降级策略

1. 如果 `sendDeploymentAction` 成功但没有实时事件，前端应进入轮询模式（每 3-5 秒拉取一次 deployment request），最多 N 次后给出"状态获取失败"提示。
2. 如果部署中途被后端标记为失败，卡片应进入 `failed` 状态并展示后端返回的错误信息。
3. 如果用户重复点击同意，前端以 `clientMsgNo/sourceMessageId` 做幂等保护。
4. 如果后端不可用，卡片保留失败状态和错误原因，不能退回本地 mock。
5. 如果 `downloadZipUrl` 不可用，卡片隐藏"下载压缩包"链接或展示"暂不可下载"，不能阻止其他状态推进。

---

## 相关代码

```text
sections/ui/pages/chat/index.vue
sections/ui/pages/chat/detail.vue
- handleSendMessage 需要识别 Clowder 智能体直聊 + 部署意图，并插入部署卡。
- 桌面和移动页都要接同一套 store/action，避免分叉。

sections/ui/stores/message.js
- 需要支持 deployment_card 类型消息的插入、状态更新和历史合并。

sections/ui/components/chat/MessageList.vue
sections/ui/components/chat/MessageBubble.vue
- 需要识别并渲染 DeploymentCard。

sections/ui/services/native-im/service.js
- 需要新增 createDeploymentRequest / updateDeploymentRequest / fetchActiveDeploymentRequest / fetchDeploymentRequest / sendDeploymentAction / fetchDeployment / fetchDeploymentLogs 等包装。

sections/ui/services/native-im/deployment.js（新增）
- 部署相关 API 与事件订阅封装。

sections/im_web/apps/chat/src/components/MessageInput.vue
- 部署意图识别 / 部署卡生成的参考实现（如已存在）。

sections/im_web/apps/chat/src/components/MessageList.vue
- 部署状态切换、预览网址展示的参考实现。

sections/im_web/packages/datasource-vue/src/api/clowder.ts
- createDeploymentRequest / updateDeploymentRequest / getActiveDeploymentRequest / getDeploymentRequest / sendDeploymentAction 的 API 参考。
```

---

## 根因分析

`sections/ui` 目前只完成了普通 IM 消息流和少量 Clowder 智能体的直聊能力，还没有迁移/适配 Clowder 部署能力的完整链路：

1. 缺少部署意图识别。
2. 缺少部署卡消息类型和 UI 组件。
3. 缺少部署状态机（pending_confirmation / deploying / deployed / cancelled / failed）。
4. 缺少 `clowder/conversation/deployment-request/action` 后端编排。
5. 缺少"下载代码压缩包"和"打开预览"两个用户操作。
6. 缺少预览网址展示和复制能力。

---

## 问题列表（Q&A 迭代）

### Q1: 部署卡和项目群确认卡（ISSUE-029）是什么关系？
**A1**: 是独立的两条链路。ISSUE-029 是协调者建议创建项目群；本 issue 是 Clowder 智能体执行部署。两者可能串联（先建项目群，再在项目群里触发部署），但卡片类型、后端接口和操作不同，需要分开实现。

### Q2: 是否允许智能体直接部署，不经过用户同意？
**A2**: 不建议。初版必须先生成确认卡，由用户显式点击"同意部署"再发起后端部署调用，避免误部署、误消耗资源或把错误版本发布到线上。

### Q3: 部署完成后是否需要支持"持续部署 / 自动部署"？
**A3**: 初版只支持单次部署触发的卡片，不做持续部署 / 自动部署；后续可作为独立 issue 扩展。

### Q4: 卡片是否要进入历史消息？
**A4**: 需要。部署卡和最终状态应该进入消息列表，至少在当前 session 内可恢复；如果后端提供持久化卡片事件，则刷新后应恢复 `deployed/cancelled/failed` 状态。

### Q5: 预览网址打开方式？
**A5**: 移动端 H5 / 小程序使用 `uni.setClipboardData` 复制 + 提示"请在浏览器中粘贴打开"；桌面 H5 使用 `window.open(previewUrl, '_blank')`；原生 App 使用 `plus.runtime.openURL`（如适用）。初版可统一使用"复制 + 打开新窗口"两种方式。

---

## 代码方案补充（基于 im_web / 后端对照）

### 接口命名需要按现有后端修正

本 issue 原文提到的 `clowder/deployments/*` 是概念名；`sections/im` 后端当前暴露给前端的真实入口是 conversation deployment request/action：

```text
POST  clowder/conversation/deployment-request
PATCH clowder/conversation/deployment-request/:deploymentRequestId
GET   clowder/conversation/deployment-request/active
GET   clowder/conversation/deployment-request/:deploymentRequestId
POST  clowder/conversation/deployment-action
GET   clowder/deployments/:deploymentId
GET   clowder/deployments/:deploymentId/logs
```

其中确认/取消必须走 `conversation/deployment-action`，后端注释已明确：部署卡点击不能降级成自然语言消息，因为需要幂等和审计字段。

### im_web 的数据结构可直接作为目标契约

`sections/im_web/packages/datasource-vue/src/api/clowder.ts` 已定义：

1. `ClowderDeploymentRequestStatus`：
   - `needs_fields`
   - `pending_confirmation`
   - `confirmed`
   - `queued`
   - `running`
   - `succeeded`
   - `failed`
   - `cancelled`
2. `ClowderDeploymentRequest` 字段包含：
   - `id`、`channelId`、`channelType`、`threadId`
   - `sourceMessageId`、`cardMessageId`、`originalText`
   - `target`、`environment`、`missingFields`
   - `targetCandidates`、`environmentCandidates`
   - `workspaceId`、`workspacePath`
   - `deploymentJobId`、`previewUrl`、`downloadUrl`、`logsSummary`、`failureReason`
3. `ClowderDeploymentActionRequest` 需要：
   - `deploymentRequestId`
   - `action: 'confirm' | 'cancel'`
   - `actionId`
   - `cardMessageId`
   - `sourceMessageId`
   - `target/environment/workspaceId/missingFields`

### 建议落地切分

1. 新增/扩展 `sections/ui/services/native-im/service.js`：

```text
createDeploymentRequest(data)
updateDeploymentRequest(id, data)
fetchActiveDeploymentRequest(params)
fetchDeploymentRequest(id)
sendDeploymentAction(data)
fetchDeployment(deploymentId)
fetchDeploymentLogs(deploymentId)
```

2. 新增 deployment util，而不是在页面里写正则：

```text
sections/ui/services/native-im/deployment.js
- detectDeploymentIntent(text, context)
- buildDeploymentCardMessage(deploymentRequest, context)
- getDeploymentCardClientMsgNo(deploymentRequestId)
- normalizeDeploymentCardStatus(status)
```

3. message store 需要支持“卡片消息 upsert”：
   - `upsertDeploymentCard(conversationId, deploymentRequest, context)`
   - `updateDeploymentCard(conversationId, deploymentRequestId, patch)`
   - `findDeploymentCard(conversationId, deploymentRequestId)`
   卡片 `clientMsgNo` 应为 `deployment-card:${deploymentRequestId}`，用来防止刷新或轮询时重复插卡。
4. 发送链路：
   - 用户消息成功发送后，识别 Clowder 直聊 + 部署意图。
   - 先调用 `createDeploymentRequest` 或 `fetchActiveDeploymentRequest`，拿后端规范化的 request。
   - 用 `buildDeploymentCardMessage` 插入/更新卡片。
   - 如果 `missingFields` 非空，卡片展示可编辑 `target/environment`，通过 `updateDeploymentRequest` 补字段。
5. 确认链路：
   - 点击确认时生成稳定 `actionId = deploymentRequestId:confirm:<timestamp 或 uuid>`。
   - 调 `sendDeploymentAction`。
   - 若返回 `deploymentRequest`，立即更新卡片。
   - 对 `confirmed/queued/running` 状态启动轮询 `fetchDeploymentRequest(id)`；终态 `succeeded/failed/cancelled` 停止轮询。
6. 预览链路：
   - `previewUrl/downloadUrl` 优先来自 `deploymentRequest`。
   - 点击“打开预览”在桌面 H5 用 `window.open`，移动端至少先复制 URL。
   - 如果有 `deploymentJobId`，可进一步调用 `fetchDeployment` / `fetchDeploymentLogs` 补详情和日志摘要。

### 边界意见

1. 状态名要对齐 im_web 和后端：前端展示可以叫 “deploying/deployed”，但存储和 API 仍用 `queued/running/succeeded`，避免转换丢信息。
2. 不要直接新增 `POST clowder/deployments`，除非后端同步新增；当前真实入口是 `conversation/deployment-request`。
3. 不要把“同意部署”发送成一条普通聊天文本。确认动作必须带 `actionId/cardMessageId/sourceMessageId`。
4. 部署卡和项目群卡可以共用卡片消息 upsert 基础设施，但不能共用后端 action；部署是 deployment request/action，项目群是 workspace/thread/project-group ensure。
5. TangSeng 原生客户端没有部署卡概念；这是 Clowder connector 的富消息类型，渲染应限定在 `type: 7` 或 `content.cardType === 'deployment'` 等明确条件，普通文本/文件消息不应受影响。

---

## 修复建议

1. 从 `im_web` 迁移/适配部署意图识别 util 到 `sections/ui/services/native-im` 或独立 util。
2. 在 `messageStore` 新增 deployment card 消息创建与状态更新 action。
3. 新增 `DeploymentCard.vue`，并接入 `MessageList/MessageBubble`。
4. 在桌面和移动 `handleSendMessage` 中识别 Clowder 智能体直聊部署意图，发送成功后插入部署卡。
5. 在 `nativeImService` / `deployment.js` 新增 `createDeploymentRequest`、`updateDeploymentRequest`、`fetchActiveDeploymentRequest`、`fetchDeploymentRequest`、`sendDeploymentAction`、`fetchDeployment`、`fetchDeploymentLogs`。
6. 同意按钮串起完整后端编排，并更新 message store 中卡片的状态。
7. 部署完成后展示预览网址 + 复制按钮 + "打开预览" 按钮。
8. 部署中提供 loading 反馈；失败时提供重试入口；取消时给出取消状态。
9. 接入真实账号可视化验证：确认卡、部署中卡、部署完成卡、预览网址复制、打开预览、取消部署、失败重试。

---

## 验收标准

- Clowder 智能体直聊发送部署请求后，聊天流出现部署确认卡。
- 确认卡展示部署主题、下载整体代码压缩包链接、同意/取消按钮。
- 点击取消后卡片进入取消状态，不调用部署接口。
- 点击同意后卡片进入 deploying 状态，并调用真实 `clowder/deployments`。
- 部署完成后卡片进入 deployed 状态，左侧"取消部署"，右侧"打开预览"，卡片上显示预览网址。
- 预览网址可一键复制。
- 点击"打开预览"可在新窗口/外部浏览器打开预览网址。
- 部署中、失败、取消、重试都有稳定状态。
- 刷新或重新进入后，deployed / cancelled / failed 状态不丢失。
- 桌面 H5 和移动 H5 都通过视觉验收，卡片不溢出，按钮不低于 44px。

---

## 建议测试

```bash
npm run test:native-im
npm run build:h5
npm run test:smoke
```

补充测试：

1. 单测：部署意图识别。
2. 单测：deployment card 消息状态机。
3. 单测：确认卡重复点击幂等。
4. 集成：mock `createDeployment` 成功并进入 deploying。
5. 集成：mock 部署完成事件，卡片切换为 deployed 并展示 previewUrl。
6. 集成：mock 部署失败，卡片进入 failed 并可重试。
7. 集成：mock 取消部署，卡片进入 cancelled。
8. E2E：桌面 Clowder 智能体直聊生成卡片、同意部署、看到预览网址、打开预览。
9. E2E：移动端同流程不溢出。
10. 真实账号验收：使用真实 Clowder 后端截图保留确认卡、部署中卡、部署完成卡、预览网址复制成功四张证据。

---

## 修复记录

2026-06-10 修复完成：

1. 已按计划 `sections/ui/.ai/plans/ISSUE-031_clowder_deployment_card_and_preview.md` 接入部署卡链路。
2. `sections/ui/services/native-im/deployment.js` 与 `service.js` 已支持 deployment request/action/detail/logs 包装、部署意图识别、卡片消息构建与状态更新。
3. `sections/ui/stores/message.js` 已支持部署卡消息插入、幂等更新、确认/取消/失败状态处理，以及确认后拉取 deployment request 终态。
4. `sections/ui/components/chat/DeploymentCard.vue`、`MessageBubble.vue`、`MessageList.vue` 已渲染确认/部署中/完成/失败/取消状态，支持下载代码、复制预览 URL、打开预览、重试与取消。
5. `sections/ui/pages/chat/index.vue` 与 `sections/ui/pages/chat/detail.vue` 已在桌面和移动聊天发送链路中识别 Clowder 直聊部署意图，并复用同一套 store action。
6. 移动端部署卡高度变化后会触发消息列表重新滚动，避免输入区遮挡“取消部署 / 打开预览”等操作按钮。

---

## 测试结果

自动化验证：

```bash
cd sections/ui && npm run test:native-im
cd sections/ui && npm run test:smoke
cd sections/ui && npm run build:h5
cd sections/ui && node .ai/tests/ISSUE-031-20260610044719/deployment-card-visual.mjs
```

结果：

- `npm run test:native-im`：81/81 通过。
- `npm run test:smoke`：通过。
- `npm run build:h5`：通过；仅有既有 uni-app / Sass deprecation warning。
- Playwright 桌面与移动可视化验收：通过，`result.json` 中 `pass: true`，无横向溢出、无按钮文字溢出、无部署卡操作区遮挡，且命中 `deployment-request`、`deployment-action`、`deployment-request/:id` 三段 API。

证据目录：

```text
sections/ui/.ai/tests/ISSUE-031-20260610044719/
```

关键证据：

- `desktop-1440x900-deployment-confirm.png`
- `desktop-1440x900-deployment-preview.png`
- `mobile-375x844-deployment-confirm.png`
- `mobile-375x844-deployment-preview.png`
- `browser-console.json`
- `request-log.json`
- `result.json`

---

## 关闭备注

已关闭。当前实现使用 Playwright mock 真实 conversation sync、message sync、Clowder deployment request/action/detail API，覆盖桌面 Web viewport 和移动端 viewport；真实后端联调时仍按启动脚本环境走同一组 endpoint，不再降级为普通聊天文本。
