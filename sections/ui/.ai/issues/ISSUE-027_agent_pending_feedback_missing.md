# [ISSUE-027] 智能体等待回复期间无可见反馈

**状态**：Resolved
**创建时间**：2026-06-09
**标签**：bug / clowder / agent / ux / pending
**AI修复模式**：Direct Fix
**计划路径**：N/A
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

真实智能体会话中，用户发送消息后，在智能体开始回复前没有任何“已收到 / 正在思考 / 正在生成”的可见反馈。用户只能看到自己刚发送的消息，容易误判为页面卡住、消息没有送达，或智能体没有响应。

预期体验：

1. 用户发送给智能体的消息成功落到聊天记录后，页面应立即进入明确等待态。
2. 等待态优先绑定在用户消息上，例如显示智能体 reaction 或轻量 pending 标记。
3. 等到智能体首个 chunk/final 回复到达后，等待态应自动清理或更新为完成态。

---

## 复现步骤

1. 启动 `sections/ui`，登录真实账号，并进入一个智能体直聊会话。
2. 向智能体发送一条文本消息。
3. 停留在当前聊天页等待智能体回复。
4. 观察从发送成功到智能体回复出现前，用户消息或聊天区域是否有可见等待反馈。

实际：

1. 当前页面没有 reaction、typing、thinking indicator、loading dots 等等待反馈。
2. 用户无法判断智能体是否已经收到请求、正在思考，还是请求失败。

预期：

1. 发送成功后 1 秒内出现可见等待反馈。
2. 等待反馈应与当前会话和目标用户消息绑定。
3. 首个回复片段或 final 到达后，等待反馈应自动清理或转为完成状态。

---

## 相关代码

```text
sections/ui/stores/message.js
- receiveAgentReplyEvent 会调用 mergeAgentReplyEventIntoList 合并智能体 placeholder/chunk/final。
- startClowderMarkdownStream 只用于本地 demo 流，真实后端场景不能依赖它提供等待反馈。

sections/ui/services/native-im/message-state.js
- applyReactionEventIntoList 已支持把 reaction 挂到目标消息。
- mergeAgentReplyEventIntoList 的 placeholder 可作为 ack/thinking 事件入口。
- shouldStartLocalClowderStream 只控制本地 mock 流，不应决定真实等待态是否存在。

sections/ui/pages/chat/index.vue
sections/ui/pages/chat/detail.vue
- handleSendMessage 发送成功后拿到 localMessage，可用其 id/messageId/clientMsgNo 创建 pending 状态。
- 桌面和移动聊天页都需要同样的等待态逻辑。

sections/ui/.ai/issues/ISSUE-013_agent_ack_reaction_instead_of_thinking_message.md
- 已约定智能体收到消息后优先用 reaction 表示“正在思考”，不再新增独立 thinking 文本气泡。
```

---

## 根因分析

待调查。初步判断是发送给真实智能体后的本地 pending state 没有稳定建立：

1. `ISSUE-013` 已实现“placeholder 不新增独立 thinking 文本气泡”，但真实发送链路需要同步补上用户可见的 ack/reaction。
2. 当前页面只有本地 demo stream 才会主动制造 placeholder/reaction；真实后端链路如果没有立刻返回 ack 或首个 stream event，页面就没有任何等待态。
3. 发送成功后已经能拿到本地消息 identity，应可先创建临时 pending reaction，再由真实 ack/chunk/final 去重、清理或覆盖。

---

## 问题列表（Q&A 迭代）

### Q1: 等待态应该用 reaction 还是独立 thinking 消息？
**A1**: 优先沿用 `ISSUE-013` 的结论：在用户消息下方显示智能体 reaction，表达“已收到/正在思考”。不要恢复独立的“正在思考...”文本消息。

### Q2: 后端暂时没有 ack 事件怎么办？
**A2**: 前端可在发送成功后创建本地临时 pending reaction，并在真实 ack/chunk/final 到达后去重合并或清理。

### Q3: 如果智能体长时间没有回复怎么办？
**A3**: pending 状态应有超时策略，例如展示“仍在等待”或“回复可能失败”，并允许用户重试，而不是无限保持静默。

---

## 代码方案补充（基于源码对照）

### 现有能力可以复用

1. `sections/ui/services/native-im/message-state.js` 已经有两条可复用入口：
   - `mergeAgentReplyEventIntoList(..., { phase: 'placeholder', targetMessageId })` 会把 placeholder 转成目标用户消息上的 reaction。
   - `mergeNativeMessageIntoList` 遇到 `streamPhase === 'placeholder'` 时，也会优先把 placeholder 映射为 reaction；没有 `targetMessageId` 时才 fallback 到最新一条本人的文本消息。
2. `sections/ui/stores/message.js` 已暴露 `receiveAgentReplyEvent(conversationId, event)`，可以作为本地 pending reaction 的统一入口，不需要在 `MessageBubble.vue` 单独塞临时 UI。
3. `sections/ui/pages/chat/index.vue` 和 `sections/ui/pages/chat/detail.vue` 在 `handleSendMessage` 中已经能拿到 `localMessage`，其 `id / messageId / clientMsgNo` 足以作为 `targetMessageId`。
4. `shouldStartLocalClowderStream(conversation)` 当前只给非直聊 Clowder 会话开本地 demo stream，真实智能体直聊不会触发，因此等待态不能继续依赖 `startClowderMarkdownStream`。

### 建议落地切分

1. 在 `messageStore` 增加两个显式 action：
   - `startAgentPendingFeedback(conversationId, localMessage, agent)`：内部调用 `receiveAgentReplyEvent`，生成 `phase: 'placeholder'`、稳定 `streamKey: pending:${targetMessageId}`、`targetMessageId`、`emoji: '👀'`、`senderId`。
   - `clearAgentPendingFeedback(conversationId, targetMessageId, agentId)`：在首个 `chunk/final` 到达后移除本地 pending reaction，或把状态从 `pending` 改为 `answered`。
2. 需要给 reaction 增加轻量 metadata，而不是只靠 emoji：
   - `kind: 'agent_pending'`
   - `streamKey`
   - `expiresAt`
   - `localOnly: true`
   这样用户真实点的普通 reaction 不会被清理逻辑误删。
3. `handleSendMessage` 中只在可确定目标是智能体时创建 pending：
   - 智能体直聊：`isClowderDirectCatConversation(conversation)` 为 true。
   - 群聊：`mentions` 中命中 `isAgent` 成员，或 `targetCatIds` 非空。
4. 超时不应新增独立气泡。建议仍更新同一个 reaction 的展示状态，例如从 `👀` 加上 `pendingExpired: true`，由 `MessageReactions.vue` 显示“等待中/可能失败”的 tooltip 或小文案。
5. 后端 placeholder/chunk/final 到达时按 `targetMessageId + senderId/kind` 去重，优先保留真实后端事件；本地 `localOnly` pending 必须被替换或清理。

### 边界意见

1. 不要恢复独立 “正在思考...” 文本消息。`ISSUE-013` 已经把 placeholder 收敛为 reaction，继续保持消息列表干净。
2. 不要把 demo stream 当真实 ack。`startClowderMarkdownStream` 只适合本地演示，真实后端不可用时应显示 pending/失败，而不是伪造完整回复。
3. 不要用“最新一条自己的消息”作为首选绑定。只有后端事件缺少 `targetMessageId` 时才允许 fallback，否则多会话/连续发送会串消息。
4. TangSengDaoDaoWeb 原生客户端更偏向 SDK 消息状态和 typing/消息内容渲染，本 issue 是 Clowder connector 的 ack 语义扩展，不应侵入 WuKongIM 原生消息发送状态。

---

## 修复建议

1. 在 `handleSendMessage` 发送给智能体成功后，基于 `localMessage.id/messageId/clientMsgNo` 立即创建本地 pending reaction。
2. 将 pending 状态限制在当前 `conversationId + targetMessageId`，避免切换会话后泄漏。
3. 后端 ack/reaction 到达时与本地 pending 去重。
4. 首个 chunk/final 到达后清理 pending reaction，或替换成完成态 reaction。
5. 增加超时策略：长时间没有 ack/chunk/final 时给出轻量失败或重试反馈。
6. 桌面 `pages/chat/index.vue` 和移动 `pages/chat/detail.vue` 保持一致。

---

## 验收标准

- 用户向智能体发送消息后，1 秒内出现可见等待反馈。
- 等待反馈挂在正确的用户消息或当前会话上，不新增独立 thinking 文本气泡。
- 首个智能体回复片段或 final 到达后，等待反馈自动清理或更新。
- 切换会话不会带走或泄漏 pending 状态。
- 桌面和移动聊天页都通过。
- 智能体直聊和群聊 @ 智能体场景都通过。

---

## 建议测试

```bash
npm run test:native-im
npm run build:h5
npm run test:smoke
```

补充自动化/手工验收：

1. 发送给智能体后立即出现 pending reaction。
2. pending reaction 命中正确的 `targetMessageId/clientMsgNo/messageId`。
3. 收到 chunk/final 后 pending 状态被清理或转完成态。
4. 切换会话后，其他会话不显示该 pending 状态。

---

## 修复记录

2026-06-10 修复完成：

1. `sections/ui/services/native-im/message-state.js` 新增本地智能体 pending feedback helper：
   - `applyAgentPendingFeedbackIntoList`
   - `clearAgentPendingFeedbackFromList`
   pending reaction 带 `kind: agent_pending`、`streamKey`、`localOnly: true`、`expiresAt`，不会和用户普通 reaction 混淆。
2. `mergeAgentReplyEventIntoList` 与 `mergeNativeMessageIntoList` 已在首个 chunk/final 回复到达时清理对应用户消息上的本地 pending reaction。
3. `sections/ui/services/native-im/normalizers.js` 已透传 Clowder stream 的 `targetMessageId`，保证真实 native stream chunk/final 能按目标消息清理 pending。
4. `sections/ui/stores/message.js` 已新增 `startAgentPendingFeedback` / `clearAgentPendingFeedback`，Clowder 直聊发送成功后立即在用户消息下方显示 👀 reaction。
5. `sections/ui/pages/chat/index.vue` 与 `sections/ui/pages/chat/detail.vue` 已在群聊 @ 智能体场景中复用同一 pending feedback action，桌面与移动路径一致。
6. 继续遵守 ISSUE-013 约束：不新增独立 “正在思考...” 文本气泡，等待态绑定在用户消息 reaction 上。

---

## 测试结果

TDD 红绿记录：

- 先新增失败测试 `local agent pending feedback is scoped and cleared by first reply chunk`，初始失败原因为 `applyAgentPendingFeedbackIntoList` / `clearAgentPendingFeedbackFromList` 不存在。
- 再新增失败测试 `native clowder reply chunk clears local pending feedback by target message id`，初始失败原因为 native stream normalizer 未透传 `targetMessageId`，随后修复。

自动化验证：

```bash
cd sections/ui && npm run test:native-im
cd sections/ui && npm run test:smoke
cd sections/ui && npm run build:h5
cd sections/ui && node .ai/tests/ISSUE-027-20260610051247/agent-pending-feedback-visual.mjs
```

结果：

- `npm run test:native-im`：83/83 通过。
- `npm run test:smoke`：通过。
- `npm run build:h5`：通过；仅有既有 uni-app / Sass deprecation warning。
- Playwright 桌面与移动可视化验收：通过，`result.json` 中 `pass: true`；桌面与移动均在发送后 1 秒内出现 `👀1` reaction，无独立 thinking 气泡，无横向溢出、无按钮/文本溢出、无失败请求。

证据目录：

```text
sections/ui/.ai/tests/ISSUE-027-20260610051247/
```

关键证据：

- `desktop-1440x900-agent-pending-feedback.png`
- `mobile-375x844-agent-pending-feedback.png`
- `browser-console.json`
- `request-log.json`
- `result.json`

---

## 关闭备注

已关闭。当前实现覆盖 Clowder 智能体直聊与群聊 @ 智能体的等待态入口；真实后端首个 chunk/final 到达时会清理本地 pending reaction，避免长期停留在“正在等待”状态。
