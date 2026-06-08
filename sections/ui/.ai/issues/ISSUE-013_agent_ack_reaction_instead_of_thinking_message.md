# [ISSUE-013] 智能体收到消息后用表情反应表示思考中

**状态**：Resolved
**创建时间**：2026-06-08
**标签**：feature, clowder, agent, reaction, ux
**AI修复模式**：Direct Fix
**计划路径**：N/A

---

## 问题描述

与智能体对话时，智能体不应再额外发送一条“思考中/正在思考...”消息。新的交互要求是在用户消息上添加表情 reaction，表示智能体已收到消息并正在思考。

预期体验：

1. 用户发送消息后，消息气泡保持在聊天记录中。
2. 智能体收到请求后，在该用户消息上添加一个明确的 reaction，例如 `👀`、`🤔` 或产品确认的表情。
3. reaction 表示“已收到/正在思考”，直到智能体开始输出或 final 到达。
4. 不再出现独立的“正在思考...”文本气泡。

---

## 复现步骤

1. 打开智能体直聊或包含智能体的群聊。
2. 发送一条需要智能体回复的文本消息。
3. 观察用户消息下方是否出现来自智能体的 reaction。
4. 观察是否还出现单独的“正在思考...”消息。
5. 等待智能体回复完成，检查 reaction 与最终回复的状态是否合理。

实际：当前流式 placeholder 会生成“正在思考...”消息，或者没有把收到状态绑定到用户消息上。

预期：用户消息上出现智能体 reaction，独立 thinking 气泡不再出现。

---

## 相关代码

```text
sections/ui/components/chat/MessageReactions.vue
- 已有消息 reaction 展示组件，可复用为智能体 ack/思考状态展示。

sections/ui/stores/message.js
- reactMessage 当前用于本地用户手动添加 reaction。
- receiveAgentReplyEvent / startClowderMarkdownStream 当前会通过 placeholder/chunk/final 创建智能体回复消息。

sections/ui/services/native-im/message-state.js
- applyReactionEventIntoList 已存在，可用于把后端 reaction/ack 事件应用到目标消息。
- mergeAgentReplyEventIntoList 当前 placeholder 默认生成“正在思考...”文本，需要改为不创建独立 thinking 文本。

sections/ui/pages/chat/index.vue
sections/ui/pages/chat/detail.vue
- handleSendMessage 发送后应能记录用户 prompt 的 message identity，方便把智能体 ack reaction 精确挂到该消息上。
```

---

## 根因分析

旧模型把智能体状态当作一条消息处理：placeholder 阶段显示“正在思考...”，chunk/final 再合并成最终回复。新模型要求把“收到/思考中”视为目标用户消息的状态或 reaction，而不是聊天时间线里的独立消息。

需要补齐两件事：

1. 用户发送消息后保留可追踪的目标消息 identity，包括 `id/clientMsgNo/messageId`。
2. 智能体 ack/thinking 事件通过 `targetMessageId` 或发送时返回的关联键，写入用户消息的 `reactions`，而不是创建 placeholder 文本消息。

---

## 问题列表（Q&A 迭代）

### Q1: 表情由谁添加？
**A1**: 优先使用后端 Clowder ack/reaction 事件。如果后端暂未返回，可在发送成功后以前端本地状态临时添加，并在后端事件到达后去重合并。

### Q2: reaction 是否需要显示成员列表？
**A2**: 可以沿用现有 reaction 展示，但 userId 应归属于智能体，例如 `clowder` 或具体 cat id，点击成员列表时能显示智能体名称。

### Q3: 智能体开始流式输出后 reaction 是否保留？
**A3**: 可以保留作为“已处理过”的状态，也可以在 final 后替换为完成态 reaction；本 issue 最低要求是不再显示独立“正在思考...”气泡。

---

## 验收标准

- 用户发送给智能体的消息下方出现智能体 reaction，表达“收到/正在思考”。
- 不再新增独立的“正在思考...”文本气泡。
- reaction 不会把用户自己的 reaction 状态误判为当前用户手动点赞。
- 直聊和群聊 @ 智能体场景都能把 reaction 挂到正确的用户消息上。
- 刷新或历史恢复后，若后端提供 reaction/ack 事件，应能恢复；若后端不提供，至少不会出现重复 thinking 气泡。

---

## 建议测试

```bash
npm run test:native-im
npm run build:h5
npm run test:smoke
```

补充单测/集成测试：

1. `applyReactionEventIntoList` 能按 `targetMessageId/clientMsgNo/messageId` 命中用户消息。
2. placeholder/thinking 事件不会创建独立文本气泡。
3. 同一个智能体重复 ack 不会累加重复 userId/count。

---

## 修复记录

### 2026-06-08

已完成以下修复：

1. `sections/ui/services/native-im/message-state.js`
   - `mergeAgentReplyEventIntoList` 在 placeholder 阶段不再创建“正在思考...”文本气泡。
   - placeholder 携带 `targetMessageId` 时，改为通过 `applyReactionEventIntoList` 给用户消息添加智能体 reaction，默认表情为 `👀`。
   - `createClowderMarkdownStreamEvents` 支持透传 `targetMessageId`，让本地 demo 流也能把 ack 绑定到用户消息。

2. `sections/ui/pages/chat/index.vue`
   - 本地 Clowder demo 流在发送消息返回后使用用户消息 id 作为 reaction 目标。

3. `sections/ui/pages/chat/detail.vue`
   - 移动详情页同样使用用户消息 id 启动本地 Clowder demo 流 ack。

4. `sections/ui/tests/native-im.test.mjs`
   - 增加 placeholder ack 只添加 reaction、不新增 thinking 文本气泡的回归测试。

---

## 测试结果

```bash
npm run test:native-im
# pass 35, fail 0

npm run build:h5
# DONE Build complete

npm run test:smoke
# sections/ui smoke test passed
```

浏览器可视化验证：

```text
URL: http://localhost:5173/#/pages/chat/index
截图:
seedcmp/sections/ui/.ai/tests/issue-012-014-02-reaction-no-thinking.png
```

验证结果：用户消息下方可见 `👀` reaction；页面文本中未出现“正在思考”。受限于本地未接真实 Clowder/TangSeng 后端，本次浏览器验证使用本地可控事件注入。

---

## 关闭备注

已通过浏览器可视化验证。真实后端环境上线前仍建议补一轮直聊和群聊 @ 智能体的真实账号验收。
