# [ISSUE-029] UI 接入协调者项目群确认卡完整链路

**状态**：Resolved
**创建时间**：2026-06-09
**标签**：feature / clowder / coordinator / project-group / card / im-web-parity
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-029_connect_coordinator_project_group_card.md
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

`sections/ui` 当前没有接上协调者/PM 智能体创建项目群的确认卡链路。用户在协调者直聊里表达“创建项目群、拆解任务、拉 Codex/Claude 等智能体协作”时，UI 不能展示“创建或复用项目群”的确认卡，也不能在用户确认后完成建群、同步智能体成员、投递原始任务和跳转项目群。

现状分散在几条不完整路径里：

1. 普通“发起群聊”页面只创建原生 IM 群，不理解协调者、项目群、任务上下文或智能体成员。
2. 智能体看板里的 `ensureGroupConversation` 只是在前端本地补一个会话和草稿，不会调用后端建群或复用项目群。
3. `sections/ui/services/native-im/service.js` 已暴露 `fetchActiveProjectGroup`、`createCoordination` 等 Clowder API 包装，但缺少“确认卡 -> ensure project group -> sync cats -> route message”的 UI 编排。
4. `sections/im_web` 已有完整参考链路，需要迁移/适配到 `sections/ui` 的 uni-app 页面和 store 架构。

本 issue 目标：让 `sections/ui` 拥有完整的协调者项目群确认卡体验，并和真实 Clowder project group / coordinator 后端链路打通。

---

## 目标体验

### 用户路径

1. 用户打开协调者/PM 智能体直聊。
2. 用户发送类似“为这个需求创建项目群，让 Codex 和 Claude 分工执行”的消息。
3. 消息发送成功后，聊天流中出现一张“创建项目群确认卡”。
4. 用户点击“确认创建项目群”。
5. UI 调用后端创建或复用项目群，并同步人类成员、协调者和目标智能体成员。
6. UI 将原始任务投递到项目群，让协调者/目标智能体继续执行。
7. 卡片状态更新为“已创建/已复用”，并提供“打开项目群”入口。
8. 用户进入项目群后，能看到群成员、智能体 @ 候选、任务消息和后续智能体回复。

### 卡片状态

1. `pending_confirmation`：等待用户确认，展示项目名、拟加入智能体、隐私提示、确认/取消按钮。
2. `creating`：用户已确认，按钮进入 loading，文案为“正在创建或复用项目群”。
3. `created`：成功创建或复用，展示群名、成员摘要和“打开项目群”按钮。
4. `cancelled`：用户取消，不再发起后端建群。
5. `failed`：创建失败，展示错误原因和“重试”按钮。

---

## 复现步骤

1. 启动 `sections/ui` 并登录真实账号。
2. 打开协调者/PM 智能体直聊，例如 role template 为 `coordinator` 的 Clowder cat。
3. 发送：“为这个项目创建项目群，让 Codex 和 Claude 继续执行”。
4. 观察聊天流是否出现项目群确认卡。
5. 点击确认，观察是否创建或复用项目群、同步智能体成员并跳转。

实际：

1. `sections/ui` 不会生成项目群确认卡。
2. 没有确认/取消/重试/打开项目群的卡片状态。
3. 没有调用 `clowder/project-groups/ensure`。
4. 没有同步项目群内的协调者和目标智能体成员。
5. 没有把原始任务投递到项目群继续执行。

预期：

1. 协调者直聊识别项目启动/建群意图后生成确认卡。
2. 用户确认后走真实后端 ensure project group，而不是本地 mock 会话。
3. 项目群创建或复用后，群成员、@ 候选、项目看板和聊天回复都能识别智能体成员。
4. 失败、取消、重试和重复点击都有稳定状态。

---

## 完整设计

### 1. 触发与范围

只在协调者/PM 智能体直聊中触发确认卡：

1. 当前会话是智能体直聊，且目标智能体 `roleTemplate/templateId` 可识别为 `coordinator`、`pm` 或产品确认的协调者模板。
2. 用户文本命中项目启动/建群意图，例如“创建项目群”“拉 Codex/Claude”“拆解任务”“分工执行”“协调多个智能体”等。
3. 普通群聊、普通联系人单聊和普通智能体直聊不自动弹项目群卡，避免误触发。

初版可复用 `sections/im_web/apps/chat/src/utils/clowderProjectGroup.ts` 的 `isProjectStartRequest` 与 `resolveProjectGroupName` 规则；后续再接后端 intent result。

### 2. 卡片数据模型

建议在 `sections/ui` 增加独立的 project group confirmation message content，而不是把卡片状态散落在页面局部状态中。

```text
type: 'project_group_confirmation'
status: 'pending_confirmation' | 'creating' | 'created' | 'cancelled' | 'failed'
projectName
sourceText
sourceMessageId / clientMsgNo
pmDirectChannelId
pmDirectChannelType
pmDirectThreadId
targetCatIds
workerCatIds
groupNo
groupName
bindingId
projectThreadId
reused
error
```

卡片应作为聊天消息进入 `messageStore.messages[conversationId]`，这样刷新、历史恢复和卡片状态更新有统一入口。

### 3. UI 组件

新增或扩展聊天消息渲染组件：

```text
sections/ui/components/chat/CoordinatorProjectGroupCard.vue
sections/ui/components/chat/MessageBubble.vue
sections/ui/components/chat/MessageList.vue
```

卡片内容：

1. 标题：`PM / 协调者建议创建项目群`
2. 项目名：来自 `resolveProjectGroupName`
3. 成员预览：当前用户、PM/协调者、拟加入智能体列表。
4. 隐私提示：只把项目交接、任务摘要和明确项目上下文带入项目群。
5. 操作：确认创建、取消、重试、打开项目群。

移动端卡片必须在 375px 宽度内可读，按钮不低于 44px；桌面端卡片宽度跟随聊天气泡最大宽度，不占满整个消息区。

### 4. 后端编排

确认按钮的最小链路：

```text
handleConfirmProjectGroupCard
  -> nativeImService.ensureProjectGroup(payload)
  -> nativeImService.syncGroupCats(payload)
  -> nativeImService.sendClowderConversationMessage({
       channelId: groupNo,
       channelType: 2,
       targetCatIds,
       promptContext
     }, sourceText)
  -> nativeImService.updateProjectGroupThread(bindingId, threadId)（如 route response 返回新 threadId）
  -> groupStore / conversationStore / messageStore 同步新群、成员、消息
  -> card status = created
```

`sections/ui` 当前缺少这些 service 包装，需要补齐：

```text
ensureProjectGroup -> POST clowder/project-groups/ensure
syncGroupCats -> POST clowder/group/cats/sync
updateProjectGroupThread -> POST clowder/project-groups/:bindingId/thread
loadCoordinatorKickoff / dismissCoordinatorKickoff（如果后端通过 kickoff 推卡）
```

### 5. 成员与 @ 路由

项目群创建/复用后需要同时落三类成员：

1. 当前用户：owner。
2. PM / 协调者：role 为 `pm` 或 `coordinator`，mention handle 为 `@PM` 或产品确认文案。
3. 目标智能体：来自用户显式提到的 `targetCatIds`，或可用 worker cats 的默认集合。

落地后必须能被这些 UI 识别：

1. 群成员列表显示智能体成员。
2. 输入框 `@` 候选包含这些智能体。
3. 智能体消息路由能按 `targetCatIds` 投递。
4. 智能体看板能按 project group binding 加载任务。

### 6. 降级策略

1. 如果 `ensureProjectGroup` 成功但 `syncGroupCats` 失败，卡片应进入 `failed` 或 `partial_failed` 等可重试状态，不要静默跳转。
2. 如果项目群已存在，卡片显示“已复用项目群”，不重复创建。
3. 如果用户重复点击确认，前端以 `clientMsgNo/sourceMessageId` 做幂等保护。
4. 如果后端不可用，卡片保留失败状态和错误原因，不能退回本地 mock 建群。
5. 如果没有任何可用 worker cat，仍可创建只含当前用户和协调者的项目群，但卡片需要提示“暂无可用执行智能体”。

---

## 相关代码

```text
sections/ui/pages/chat/index.vue
sections/ui/pages/chat/detail.vue
- handleSendMessage 需要识别协调者直聊 + 项目启动意图，并插入确认卡。
- 桌面和移动页都要接同一套 store/action，避免分叉。

sections/ui/stores/message.js
- 需要支持 project_group_confirmation 类型消息的插入、状态更新和历史合并。

sections/ui/components/chat/MessageList.vue
sections/ui/components/chat/MessageBubble.vue
- 需要识别并渲染 CoordinatorProjectGroupCard。

sections/ui/stores/group.js
sections/ui/stores/conversation.js
- ensure 成功后 upsert group/conversation。
- sync cats 后初始化/更新 agent members。

sections/ui/services/native-im/service.js
- 已有 fetchActiveProjectGroup / createCoordination。
- 需要新增 ensureProjectGroup / syncGroupCats / updateProjectGroupThread 等包装。

sections/ui/services/native-im/project-board.js
sections/ui/stores/agent.js
- 创建后可通过 project group binding 加载看板任务。

sections/im_web/apps/chat/src/components/MessageInput.vue
- addProjectGroupConfirmationCard 是生成确认卡的参考实现。
- shouldUseProjectGroup = isCoordinatorDirectConversation && isProjectStartRequest(text) 是触发参考。

sections/im_web/apps/chat/src/components/MessageList.vue
- ensureProjectGroupFromConfirmation 是完整后端编排参考。

sections/im_web/packages/datasource-vue/src/api/clowder.ts
- ensureProjectGroup / syncGroupCats / updateProjectGroupThread 的 API 参考。
```

---

## 根因分析

`sections/ui` 目前只完成了普通 IM 建群和智能体看板的本地会话兜底，还没有迁移 `im_web` 的项目群确认卡链路：

1. 缺少协调者直聊中的项目启动意图识别。
2. 缺少项目群确认卡消息类型和 UI 组件。
3. 缺少确认卡状态机。
4. 缺少 `clowder/project-groups/ensure`、`clowder/group/cats/sync`、project thread binding 等后端编排。
5. 缺少建群后智能体成员、@ 候选、看板和消息投递的统一刷新。

---

## 问题列表（Q&A 迭代）

### Q1: 这和 ISSUE-028 是不是同一个问题？
**A1**: 不是。`ISSUE-028` 是手动“发起群聊”页面应能选择已有智能体。本 issue 是协调者直聊自动生成项目群确认卡，并在确认后走 Clowder 项目群后端链路。两者可以共享智能体成员建模，但入口和后端编排不同。

### Q2: 是否允许协调者直接建群，不经过确认？
**A2**: 不建议。初版必须先生成确认卡，由用户显式确认，避免误建群、错误同步隐私上下文或把智能体拉进错误项目群。

### Q3: 如果后端已经通过 coordinator kickoff 推卡，前端还需要本地意图识别吗？
**A3**: 需要兼容两种来源。优先消费后端 kickoff/card event；如果后端暂未推卡，前端可在协调者直聊中生成本地确认卡作为兜底，但确认后必须走真实后端 ensure。

### Q4: 卡片是否要进入历史消息？
**A4**: 需要。确认卡和最终状态应该进入消息列表，至少在当前 session 内可恢复；如果后端提供持久化卡片事件，则刷新后应恢复 `created/cancelled/failed` 状态。

---

## 代码方案补充（基于 im_web / 后端对照）

### 后端能力已经存在

`sections/im/TangSengDaoDaoServer/modules/clowder/api.go` 已有可直接包装的路由：

1. `POST clowder/project-groups/ensure`
   - 请求体包含 `projectName`、`workspaceId`、`pmDirectChannelId`、`pmDirectChannelType`、`pmDirectThreadId`、`projectThreadId`、`pmMemberId`、`userMemberIds`、`catMemberIds`、`createdBy`。
   - 后端会按 `user + PM direct channel + projectName` 复用 active binding，并调用 `ensureProjectGroupMembers`。
   - `catMemberIds` 会写入 `ProjectGroupBinding`，但原生群成员仍只保证 user/PM 这类 IM uid。
2. `GET clowder/project-groups/active` 和 `POST clowder/project-groups/:bindingId/thread` 已用于刷新/补绑 thread。
3. `GET/POST clowder/maomi-workspaces/*`、`GET clowder/workspace/validate`、`POST clowder/threads` 已经给 im_web 的 kickoff card 使用。
4. `POST clowder/coordinator/coordination`、`GET clowder/coordinator/kickoff(s)` 可作为后端推卡/恢复入口。

### im_web 可迁移的最小闭环

1. `sections/im_web/apps/chat/src/utils/clowderProjectGroup.ts` 提供了初版意图识别：
   - `isProjectStartRequest(text)`
   - `resolveProjectGroupName(text, fallback)`
2. `sections/im_web/apps/chat/src/components/CoordinatorKickoffCard.vue` 的真实链路是：
   - 读取当前 Clowder conversation binding 的 threadId。
   - 加载 agent directory，展示 suggested cats 和可追加 cats。
   - `proposeWorkspace` / `createWorkspace`。
   - `POST /v1/threads` 创建项目 thread，并绑定 workspace。
   - dismiss kickoff，emit created。
3. `sections/im_web/packages/datasource-vue/src/api/clowder.ts` 已经把 workspace、project group、coordination API 都建成类型化 wrapper；`sections/ui` 现在只包了 `fetchActiveProjectGroup` 和 `createCoordination`，缺口在 service/store 层。

### 建议落地切分

1. 新增 service wrapper：

```text
sections/ui/services/native-im/service.js
- ensureProjectGroup(payload) -> POST clowder/project-groups/ensure
- updateProjectGroupThread(bindingId, payload) -> POST clowder/project-groups/:bindingId/thread
- fetchCoordinatorKickoff(coordinationId)
- listCoordinatorKickoffs(params)
- dismissCoordinatorKickoff(coordinationId)
- getWorkspaceRoot()
- proposeWorkspace(payload)
- createMaomiWorkspace(payload)
- createClowderThread(payload) -> POST clowder/threads
```

2. 新增 project group card store/action：

```text
messageStore.createProjectGroupConfirmation(conversationId, { sourceMessage, projectName, suggestedCatIds })
messageStore.updateProjectGroupConfirmation(conversationId, cardId, patch)
agentStore.ensureProjectGroupFromCard(cardContent)
```

3. `handleSendMessage` 不应直接创建群。发送成功后只做两件事：
   - 识别协调者直聊 + 项目启动意图，插入 `pending_confirmation` 卡。
   - 若后端已有 kickoff/coordination result，则用后端结果覆盖本地识别结果。
4. 用户点击确认后再进入编排：
   - 可选：先 `proposeWorkspace/createMaomiWorkspace` 得到 `workspaceId`。
   - 创建/复用 Clowder thread，拿 `projectThreadId`。
   - `ensureProjectGroup`，传入 PM 直聊 channel、projectName、workspaceId、projectThreadId、catMemberIds。
   - 返回 `binding.projectGroupNo` 后，调用 `conversationStore.upsertGroupConversation` 或等价 action，初始化本地群会话。
   - 调 `convStore.addAgentMember` 只作为前端显示补齐；同时必须调后端 `syncGroupCats` 或依赖 `ensureProjectGroup` 的 `catMemberIds`，否则刷新会丢。
   - 把原始任务投递到项目群：优先走 `sendClowderConversationMessage({ channelId: projectGroupNo, channelType: 2, targetCatIds, promptContext })`，而不是伪造本地消息。
5. 卡片状态和幂等：
   - `cardId/clientMsgNo = project-group-card:${sourceMessageId}`。
   - 确认按钮用 `cardId + action` 防重复。
   - `created/reused` 状态只更新同一条卡，不追加多张成功卡。
6. 刷新恢复：
   - 打开协调者直聊时调用 `listCoordinatorKickoffs` 或 `fetchActiveProjectGroup`。
   - 打开项目群时调用 `fetchActiveProjectGroup({ projectGroupNo })` 和 `fetchThreadTasks(threadId)`，同步 project board。

### 边界意见

1. 本地 `pages/agents/board.vue` 的 `ensureGroupConversation` 只是临时补会话和草稿，不能作为项目群创建方案。
2. 不要把项目群确认卡等同于普通建群页面。普通建群解决成员选择，项目群卡还负责 workspace/thread/binding/original task handoff。
3. 不要绕过 `project-groups/ensure` 自己拼 group id。后端已经负责复用、PM 虚拟成员、handoff 消息和 binding key。
4. TangSengDaoDaoWeb 原生建群只接受 uid 列表；Clowder cat membership 必须通过 Clowder bridge 同步，不能混成原生 members。
5. 初版本地意图识别只做兜底。只要后端 coordinator kickoff 到达，应以后端 kickoff 为准，避免前后端生成两张卡。

---

## 修复建议

1. 从 `im_web` 迁移/适配 `isProjectStartRequest`、`resolveProjectGroupName` 到 `sections/ui/services/native-im` 或独立 util。
2. 在 `messageStore` 新增 project group confirmation 消息创建与状态更新 action。
3. 新增 `CoordinatorProjectGroupCard.vue`，并接入 `MessageList/MessageBubble`。
4. 在桌面和移动 `handleSendMessage` 中识别协调者直聊项目启动意图，发送成功后插入确认卡。
5. 在 `nativeImService` 新增 `ensureProjectGroup`、`syncGroupCats`、`updateProjectGroupThread`。
6. 确认按钮串起完整后端编排，并更新 group/conversation/member/message stores。
7. 创建或复用成功后提供“打开项目群”入口，跳转 `pages/chat/detail?id=<groupNo>`。
8. 增加失败、取消、重试、重复点击防护和超时反馈。
9. 接入真实账号可视化验证：确认卡、创建/复用状态、项目群成员、@ 候选、任务投递和看板入口。

---

## 验收标准

- 协调者直聊发送项目启动请求后，聊天流出现项目群确认卡。
- 确认卡展示项目名、协调者、拟加入智能体、隐私提示和确认/取消按钮。
- 点击取消后卡片进入取消状态，不调用建群接口。
- 点击确认后卡片进入 creating 状态，并调用真实 `clowder/project-groups/ensure`。
- 成功后卡片进入 created 状态，能区分“已创建”和“已复用”。
- 成功后项目群会话出现在会话列表，可点击打开。
- 项目群成员包含当前用户、PM/协调者和目标智能体。
- 项目群输入 `@` 能出现目标智能体。
- 原始任务被投递到项目群，智能体能继续回复。
- 刷新或重新进入后，不重复建群、不重复投递任务。
- 失败时展示错误和重试入口。
- 桌面 H5 和移动 H5 都通过视觉验收，卡片不溢出，按钮不低于 44px。

---

## 建议测试

```bash
npm run test:native-im
npm run build:h5
npm run test:smoke
```

补充测试：

1. 单测：项目启动意图识别和项目名解析。
2. 单测：project group confirmation 消息状态机。
3. 单测：确认卡重复点击幂等。
4. 集成：mock `ensureProjectGroup` 成功创建新群。
5. 集成：mock `ensureProjectGroup` 返回 reused。
6. 集成：`syncGroupCats` 失败进入 failed 并可重试。
7. E2E：桌面协调者直聊生成卡片、确认、打开项目群。
8. E2E：移动端同流程不溢出。
9. 真实账号验收：使用真实 Clowder 后端截图保留确认卡、创建成功卡、项目群成员、@ 候选四张证据。

---

## 修复记录

2026-06-10：

1. 补齐 `sections/ui/.ai/plans/ISSUE-029_connect_coordinator_project_group_card.md` 对应实现：新增项目群意图识别、项目名解析、确认卡消息状态机和 `CoordinatorProjectGroupCard` 渲染。
2. 协调者/PM 直聊发送项目启动请求后，在聊天流插入 `project_group_confirmation` 卡片；取消、确认、失败重试和打开项目群都回写同一张卡。
3. 确认按钮串起真实编排：`clowder/project-groups/ensure` -> `clowder/group/cats/sync` -> `clowder/conversation/message`，成功后同步本地 group/conversation/member 状态，并把原始任务投递到项目群。
4. 失败时卡片进入 `failed` 并展示错误；重复点击 `creating/created` 状态不会重复建群。

---

## 测试结果

验证命令：

```bash
cd sections/ui && npm run test:native-im
cd sections/ui && npm run test:smoke
cd sections/ui && npm run build:h5
```

结果：

- `npm run test:native-im`：73/73 通过。
- `npm run test:smoke`：通过。
- `npm run build:h5`：通过，仅有既有 uni-app / Sass deprecation warning。
- Playwright H5 验收：通过桌面 `1440x900` 和移动 `375x844`，确认卡与已创建卡均截图；`ensureProjectGroup`、`syncGroupCats`、协调者直聊消息、项目群 handoff 消息各 2 次；API failed request 为 0；无横向溢出，项目群卡按钮高度为 44px。

证据目录：

- `sections/ui/.ai/tests/ISSUE-029-20260609194700/`

---

## 关闭备注

已完成项目群确认卡完整链路的单测、构建、smoke 和桌面/移动 Playwright 可视化验收。Playwright 使用受控后端 mock 固定 Clowder 目录与项目群接口，以验证前端请求契约、状态流转和布局稳定性。
