# [ISSUE-011] 智能体页面接入后端 Clowder AI 并验收多智能体群聊与看板

**状态**：Open
**创建时间**：2026-06-08
**标签**：feature, clowder, agent, streaming, multi-account, kanban
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-011_agent_page_clowder_ai_backend_sync.md

---

## 问题描述

`sections/ui` 智能体页面目前未完整同步后端 Clowder AI 能力。需要接入后端 Clowder AI，支持智能体页展示、添加和使用智能体；支持与 Clowder AI 进行直聊和群聊对话；支持 Clowder AI 猫猫流式 Markdown 返回；并通过多账号验收 Clowder AI 群聊多智能体功能和看板功能。

---

## 复现步骤

1. 打开 `sections/ui` 智能体页面。
2. 检查是否能从后端 Clowder AI 拉取猫猫/智能体目录、连接状态、可用能力和不可用原因。
3. 在智能体页面新增一个智能体，并尝试进入直聊使用。
4. 在直聊中向 Clowder AI 或指定猫猫发送消息，观察是否出现流式 Markdown 回复并最终固化为一条消息。
5. 使用两个或多个账号进入同一个群聊，添加多个 Clowder AI 智能体。
6. 在群聊中分别通过 @、命令或焦点智能体触发不同猫猫回复，检查多账号身份归因、去重和流式合并。
7. 打开看板功能，检查 Clowder AI 相关任务/会话/智能体状态是否能被创建、同步、更新和多账号可见。

---

## 相关代码

可重点参考：

```text
sections/ui/pages/agents/
- 智能体列表、新增智能体、智能体详情和使用入口。

sections/ui/pages/chat/
- 智能体直聊、群聊消息展示、流式回复合并和 Markdown 渲染。

sections/ui/services/native-im/
- native IM 消息发送、会话同步、群聊成员、当前账号身份归因和消息状态。

sections/ui/services/clowder/
- 如不存在，需要新增或补齐 Clowder AI API client、状态同步和事件映射。

sections/ui/.ai/issues/ISSUE-006_system_agent_recognition_and_agent_page.md
- 智能体识别和智能体页展示要求。

sections/ui/.ai/issues/ISSUE-007_agent_addition_flow.md
- 智能体添加和创建后直聊入口要求。

sections/ui/.ai/issues/ISSUE-008_agent_streaming_and_file_reply.md
- 智能体流式回复和结构化文件回复要求。

sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
- Clowder 状态、agent directory、cat directory、group cats、focus、permission 和创建连接经验。

sections/im_web/apps/chat/src/components/MessageInput.vue
- Clowder AI 路由、@ 智能体、命令和项目群/智能体输入体验参考。

sections/im_web/apps/chat/src/components/MessageList.vue
- Clowder 流式回复、Markdown、文件/卡片消息和多类型消息展示参考。
```

---

## 根因分析

当前 `sections/ui` 已有智能体页和部分 IM 能力，但智能体数据源、创建流程、会话使用、流式回复、多账号群聊验收和看板联动仍缺少统一的 Clowder AI 后端契约。若只在前端维护静态智能体或模拟消息，无法验证真实猫猫状态、权限、群聊多智能体路由、流式事件和看板同步。

---

## 需求范围

- 智能体页面从后端 Clowder AI 同步智能体/猫猫目录，显示名称、头像、平台、能力、连接状态、可用状态和不可用原因。
- 智能体页面支持新增智能体，并在创建成功后同步为可使用的智能体入口。
- 支持从智能体页面进入直聊，向 Clowder AI 或指定猫猫发送消息并收到回复。
- 支持 Clowder AI 猫猫流式返回，流式阶段合并为同一条可见消息，final 阶段固化，刷新后不重复。
- 支持在群聊中添加和使用多个智能体，能够按 @、命令、焦点智能体或后端路由触发不同猫猫。
- 支持多账号测试群聊多智能体功能，确保不同账号发送者身份、权限、回复归因和消息去重正确。
- 支持看板功能与 Clowder AI 联动，至少覆盖任务/卡片创建、状态同步、智能体参与记录和多账号可见性。
- Clowder AI 不可用、权限不足、群聊未授权、创建失败、流式中断和看板同步失败时，需要有明确可见状态。

---

## 验收标准

- 智能体页面能展示后端 Clowder AI 返回的真实智能体/猫猫列表，而不是纯本地 mock。
- 新增智能体成功后，列表、直聊入口和可加入群聊入口均可见并可使用。
- 直聊发送消息后，Clowder AI 猫猫能以流式 Markdown 形式返回，最终只保留一条完整回复。
- 群聊中至少两个账号、两个智能体可同时参与，@ 不同智能体能路由到对应猫猫。
- 多账号场景下，人类发送者、智能体发送者、群成员身份和消息时间线显示正确。
- 刷新、重连或重新进入会话后，历史消息、流式 final 消息和看板状态不重复、不丢失。
- 看板中 Clowder AI 相关卡片/任务状态可创建、更新，并在多账号视角下同步可见。
- 所有失败态均有用户可理解的提示，并且不会破坏普通 IM 消息发送。

---

## 问题列表（Q&A 迭代）

### Q1: 智能体页是否可以继续显示本地 mock 智能体？
**A1**: 可以保留演示兜底，但真实登录/接入后端时必须优先使用 Clowder AI 后端数据，并清晰标注 unavailable/mock 状态。

### Q2: 多智能体群聊至少需要覆盖几个智能体？
**A2**: 至少两个 Clowder AI 猫猫/智能体，且能在同一个群聊里被不同账号分别触发。

### Q3: 看板功能是否必须覆盖完整项目管理能力？
**A3**: 本 issue 只要求 Clowder AI 相关的最小闭环：创建/同步/更新卡片或任务、展示智能体参与记录、多账号可见。

---

## 建议实现拆分

1. 补齐 `sections/ui` Clowder AI API client 和状态 store，优先同步 status、agent directory、cat directory、conversation binding、group cats 和 board/kanban 状态。
2. 改造智能体页数据源，支持真实 Clowder AI 智能体展示、新增、连接、直聊入口和群聊添加入口。
3. 打通直聊消息发送到 Clowder AI 后端，并复用现有消息 store 的 pending、ACK、去重、Markdown 渲染和流式合并能力。
4. 打通群聊多智能体路由，覆盖 @、命令、焦点智能体、权限失败和不可用状态。
5. 打通看板功能与 Clowder AI 后端状态同步，保证卡片/任务更新可持久化并多账号可见。
6. 增加多账号 Playwright/手工验收脚本，覆盖直聊、群聊多智能体、流式回复、刷新重连和看板同步。

---

## 测试计划

- 单测：Clowder API client、智能体目录归一化、创建智能体结果映射、流式 reply event 合并、群聊多智能体路由状态、看板状态归一化。
- 集成测试：登录态下智能体列表同步、创建智能体、进入直聊、发送消息、收到流式 final、刷新后无重复。
- 多账号验收：至少两个账号进入同一群聊，添加至少两个智能体，分别 @ 不同智能体并验证回复归因。
- 看板验收：由一个账号创建或更新 Clowder AI 相关卡片/任务，另一个账号刷新后可见同一状态。
- 回归命令：`npm run test:native-im`、`npm run build:h5`、`npm run test:smoke`，并补充 Clowder AI 后端联调脚本输出。

---

## 关闭备注

关闭前需附上直聊流式回复、多账号群聊多智能体、智能体新增可使用、看板多账号同步四类证据，并记录所使用的后端 Clowder AI 环境、账号、群聊和智能体样本。
