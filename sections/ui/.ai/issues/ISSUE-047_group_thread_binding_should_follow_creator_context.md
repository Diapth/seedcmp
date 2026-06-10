# [ISSUE-047] 群聊 thread 绑定应按建群来源继承上下文

**状态**：Resolved
**创建时间**：2026-06-11
**标签**：bug, feature, clowder, group-chat, thread-binding, coordinator, pm
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-047_group_thread_binding_should_follow_creator_context.md
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

**修复执行规则**：
- 若 `AI修复模式：Plan First`，先使用 `writing-plans` 写计划，计划无需用户确认直接实现。
- 必须先补/确认回归测试，再改实现，再验证。
- 若涉及前端页面、截图或交互验收，必须使用 `browser-preview` 或 Playwright 实测。
- 测试截图必须保存到 `seedcmp/sections/ui/.ai/tests-e2e/` 下，并按 issue 序号命名。
- 若遇到测试失败或行为不符合预期，使用 `debugging` / `systematic-debugging` 定位根因。
- 完成前使用 `verification-before-completion`，确认验证结果后再说完成。

---

## 问题描述

群聊创建后，Clowder thread 绑定规则需要区分建群来源：

1. 如果群聊由普通用户主动创建，应直接为该群分配一个新的 Clowder thread。
2. 如果群聊由 PM/协调者创建，群聊 thread 不应重新开一个孤立 thread，而应绑定到协调者当前承接项目的 thread。
3. PM/协调者拉入群聊的其他智能体，也必须绑定并工作在这个同一个 thread 上。

当前截图中的项目群「驱蚊器」已经包含用户、协调者与其他智能体成员，但需要保证该群不是独立漂移到新 thread，也不是每个智能体各自开 thread；它应该共享 PM/协调者建群时的项目执行 thread。

---

## 复现步骤

1. 在 `http://localhost:5173/#/pages/chat/index` 打开 AgentHub IM。
2. 从 PM/协调者直聊发起一个需要多智能体参与的项目任务。
3. 观察 PM/协调者创建项目群，并拉入用户与相关智能体。
4. 打开项目群，向群内发送消息或让智能体继续执行任务。
5. 检查群聊 Clowder binding、Kanban/产物、智能体回复所使用的 `threadId`。

---

## 期望行为

### 用户主动建群

1. 用户通过 UI 创建普通群聊并选择智能体成员时，系统为这个群创建一个新的 Clowder thread。
2. 该群内所有 Clowder 智能体消息、任务、看板、产物都绑定到这个新 thread。
3. 刷新页面或历史同步后，群聊仍使用同一个 thread，不重复创建。

### PM/协调者建群

1. PM/协调者从直聊中识别项目任务并创建项目群时，项目群必须继承协调者当前项目执行 thread。
2. 群聊 binding 中的 `threadId` 应等于 PM/协调者用于该项目的 `threadId`，而不是新建一个无上下文 thread。
3. 被拉入群聊的其他智能体都在同一个 inherited thread 下接收上下文、执行任务、写入任务/产物状态。
4. PM/协调者直聊仍作为用户反馈与入口；项目群作为同一 thread 的协作表面。
5. 群聊信息面板、成员列表、Kanban、产物面板和消息投递都必须显示/使用同一个绑定关系。

---

## 相关代码

```text
sections/ui/services/native-im/service.js
sections/ui/services/native-im/conversation-state.js
sections/ui/stores/conversation.js
sections/ui/stores/group.js
sections/ui/stores/message.js
sections/im/TangSengDaoDaoServer/modules/clowder/api.go
sections/im/TangSengDaoDaoServer/modules/clowder/listener.go
sections/clowder-ai/packages/api/src/infrastructure/connectors/ConnectorRouter.ts
sections/clowder-ai/packages/api/src/infrastructure/connectors/ConnectorThreadBindingStore.ts
sections/clowder-ai/packages/api/src/infrastructure/connectors/OutboundDeliveryHook.ts
```

---

## 相关背景

- `ISSUE-041` 已解决新建 PM/自定义智能体直聊自动绑定 thread 的问题。
- `ISSUE-043` 已强化 PM/协调者不得自己执行任务，必须派活并汇总。
- `V3-40_pm_should_create_project_group_chats.md` 已确立 PM/协调者应创建项目群，而不是把执行智能体拉进 PM 直聊。
- 本 issue 是 V3-40 之后的绑定语义补齐：项目群是新的 IM 协作表面，但 Clowder 执行上下文应继承 PM/协调者的项目 thread。

---

## 根因分析

实际根因：

1. PM/协调者直聊的 `threadId` 没有稳定写入项目群确认卡，确认创建项目群时只能按普通群聊外部会话懒创建 Clowder binding。
2. `normalizeConversation()` 在刷新/历史同步后没有保留 `threadId/directThreadId/projectThreadId`，PM 直聊上下文可能丢失，后续卡片无法继承项目 thread。
3. TangSeng IM bridge 的项目群同步与群消息投递没有把 inherited `projectThreadId` 透传到 Clowder inbound payload。
4. Clowder connector 收到 IM Web group inbound 时忽略外部传入的 `threadId`，导致 `im-web + 2:<groupId>` 被绑定到新建 thread。

---

## 问题列表（Q&A 迭代）

### Q1: 普通用户建群和 PM/协调者建群的差别是什么？
**A1**: 普通用户建群是新的协作空间，应创建新 thread；PM/协调者建群是把已有项目执行上下文搬到群聊表面，应继承协调者当前项目 thread。

### Q2: 其他智能体是否应该各自绑定自己的 thread？
**A2**: 不应该。被 PM/协调者拉入项目群的智能体必须共享项目群绑定的同一个 thread，避免上下文、任务、产物分裂。

### Q3: PM 直聊和项目群是否是两个不同 thread？
**A3**: 用户反馈入口和项目群是两个 IM 会话表面，但项目执行状态应以 PM/协调者建群时的项目 thread 为准；项目群 binding 必须指向该 thread。

---

## 验收标准

1. 用户主动创建含智能体的群聊时，会生成新的 group thread binding。
2. PM/协调者创建项目群时，群聊 binding 继承协调者项目 `threadId`。
3. 群内所有智能体后续消息、任务、看板、产物都写入同一个 inherited `threadId`。
4. PM/协调者直聊中打开项目群入口后，群聊信息面板与 Clowder 面板展示的 thread 一致。
5. 刷新页面、重新进入群聊、历史同步后不会新建第二个 thread。
6. 若继承失败，UI/系统消息必须显示可诊断错误，不能静默创建一个错误 thread。
7. 自动化测试覆盖用户建群新 thread 与 PM/协调者建群继承 thread 两条路径。
8. Playwright 实测覆盖 PM/协调者建群后，群聊中的智能体回复和 Kanban/产物使用同一 thread。

---

## 修复记录

### 2026-06-11

已修复：

1. 前端项目群确认卡从 PM/协调者直聊会话或 agent binding 解析 `threadId`，同时写入 `pmDirectThreadId` 与 `projectThreadId`。
2. 前端会话 normalizer 保留 direct/project thread 字段，刷新后不会丢失 PM 当前项目执行 thread。
3. 项目群确认后调用 `syncGroupCats` 时带上 `projectThreadId/projectBindingId`，首条项目群 Clowder 消息也带同一个 `threadId`。
4. TangSeng Clowder bridge 扩展 group cat sync 与 inbound message payload，项目群绑定缺少 `projectThreadId` 时回退到 `pmDirectThreadId`。
5. Clowder IM Web connector 支持 inherited `threadId`，在群 external chat 首次进入时绑定/修复到已有项目 thread，不再创建孤立 thread。
6. TangSeng 群消息 listener 对已同步的项目群自动补齐 `ProjectThreadID`，后续群内消息继续投递到 inherited thread。
7. Clowder connector 不再用本地 registry 过滤 IM Web 显式 `targetCatIds`，避免项目群同步来的猫 ID 被误丢导致路由回默认猫。
8. 增加 UI、Go、Clowder connector 回归测试，并补桌面/移动 Playwright 可视化证据。

---

## 测试结果

```bash
cd sections/ui && npm run test:native-im
# pass: 109/109

cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder
# pass

cd sections/clowder-ai && pnpm --filter @cat-cafe/api exec tsc -p tsconfig.json
# pass

cd sections/clowder-ai && node --test packages/api/test/im-web-inbound-bridge.test.js
# pass: 6/6

cd sections/ui && npm run build:h5
# pass

node sections/ui/.ai/tests/ISSUE-047-20260611014758/verify-project-group-thread-binding.mjs
# pass: desktop + mobile Playwright verification
```

---

## 关闭备注

证据目录：

- 自动化日志与 Playwright 原始结果：`sections/ui/.ai/tests/ISSUE-047-20260611014758/`
- 双端截图与浏览器验收归档：`sections/ui/.ai/tests-e2e/ISSUE-047-20260611014758/`

关键证据：

- `desktop-01-pm-thread.png` / `mobile-01-pm-thread.png`：PM 直聊保留 inherited thread。
- `desktop-02-project-group-created.png` / `mobile-02-project-group-created.png`：项目群确认卡创建成功。
- `api-calls.json`：`ensureProjectGroup`、`syncGroupCats`、首条群 Clowder 消息均使用 `thread-pm-project-issue047`。
- `result.json`：16 条桌面/移动断言全部通过。
