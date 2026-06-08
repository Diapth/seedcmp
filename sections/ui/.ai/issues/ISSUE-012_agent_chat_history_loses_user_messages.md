# [ISSUE-012] 修复智能体会话历史丢失用户消息

**状态**：Resolved
**创建时间**：2026-06-08
**标签**：bug, clowder, agent, message-history

---

## 问题描述

与智能体对话后，聊天记录会丢失用户发送的消息，重新进入会话或刷新历史时只显示智能体回复。这会破坏问答上下文，用户无法确认自己发过什么，也会导致后续智能体回复看起来像凭空出现。

预期：智能体会话中用户发送消息、智能体收到确认、流式回复和最终回复都应保留在同一条时间线中。刷新、重新进入会话、历史同步后，用户消息不应被智能体回复覆盖或过滤掉。

---

## 复现步骤

1. 打开 `sections/ui`，进入任意 Clowder AI/智能体直聊。
2. 发送一条文本消息，例如“请帮我总结当前任务”。
3. 等待智能体回复完成。
4. 切换到其他会话后再切回，或刷新浏览器后重新进入该智能体会话。
5. 观察聊天记录是否仍包含用户发送的原始消息。

实际：只显示智能体回复，用户消息消失或被历史同步结果覆盖。

预期：用户消息和智能体回复均可见，顺序为“用户消息 -> 智能体确认/思考状态 -> 智能体流式/最终回复”。

---

## 相关代码

```text
sections/ui/stores/message.js
- sendNativeMessage 先 appendLocalMessage，再通过 sendClowderConversationMessage 或 sendTextMessage 发送。
- syncNativeMessages 当前会在 synced.length > 0 时用 synced 合并 localPending，可能丢弃本地已 success 但后端历史未返回的用户消息。
- receiveAgentReplyEvent 只合并智能体回复事件，不能替代用户 prompt 的持久记录。

sections/ui/services/native-im/message-state.js
- mergeNativeMessageIntoList / mergeNativeMessageLists 负责 ACK、echo、历史同步去重。
- messageIdentityKey / contentKey / findSelfEchoIndex 应保证用户消息和智能体回复使用不同身份键。

sections/ui/services/native-im/service.js
- sendClowderConversationMessage 调用 clowder/conversation/message，返回值可能只代表用户 prompt 的投递结果，不等同于完整历史。

sections/ui/pages/chat/index.vue
sections/ui/pages/chat/detail.vue
- handleSendMessage 在 Clowder 会话中触发 sendNativeMessage，并可能同时启动本地 Clowder stream。
```

---

## 根因分析

初步怀疑历史同步时只保留了后端返回的智能体回复，导致本地已经成功发送的用户消息被替换掉。另一个风险是用户 prompt 和智能体 reply 共用了不稳定的 `id/clientMsgNo/messageId/streamKey`，在合并逻辑中被误判为同一条消息。

修复需要明确三类消息的身份边界：

1. 用户 prompt：使用用户消息自己的 `clientMsgNo/messageId`，刷新后能从 IM 历史或 Clowder bridge 历史恢复。
2. 智能体收到确认：作为用户消息上的 reaction/ack 状态，不应覆盖用户消息本体。
3. 智能体回复：使用独立 `streamKey` 合并 placeholder/chunk/final。

---

## 问题列表（Q&A 迭代）

### Q1: 如果后端历史暂时没有返回用户 prompt，前端能否保留本地成功消息？
**A1**: 可以。历史同步不能只因为远端列表存在就丢弃本地 success 用户消息，应按 ACK/echo 或稳定 identity 合并，直到后端有等价消息可替换。

### Q2: 智能体回复是否可以覆盖用户消息？
**A2**: 不可以。智能体回复必须有独立消息身份，最多通过 `replyRef/threadId/streamKey` 关联用户 prompt。

### Q3: 需要覆盖哪些场景？
**A3**: 至少覆盖智能体直聊、普通群聊中 @ 智能体、刷新恢复、切换会话恢复。

---

## 验收标准

- 用户向智能体发送的文本消息立即出现在聊天列表，并在发送成功后保持可见。
- 智能体回复完成后，用户消息仍在同一条时间线中，且顺序正确。
- 刷新浏览器、切换会话、重新进入会话后，用户消息不丢失、不重复。
- 历史同步不会用智能体回复覆盖用户 prompt。
- 会话列表摘要在最新消息为智能体回复时可显示智能体回复；但进入会话后必须能看到完整问答上下文。

---

## 建议测试

```bash
npm run test:native-im
npm run build:h5
npm run test:smoke
```

补充单测/集成测试：

1. `syncNativeMessages` 合并后保留本地 success 用户消息。
2. 用户 prompt 与智能体 stream reply 使用不同 identity key。
3. 刷新恢复后同一 prompt 不重复、reply 不覆盖 prompt。

---

## 修复记录

### 2026-06-08

已完成以下修复：

1. `sections/ui/services/native-im/message-state.js`
   - 新增 `mergeSyncedMessagesPreservingLocalContext`，历史同步时保留 Clowder 会话中尚未被后端 echo 覆盖的本地成功用户 prompt。
   - `mergeNativeMessageIntoList` 对 durable final stream 消息补充 phase 推断，避免历史合并时把已完成回复重新标成 streaming/sending。

2. `sections/ui/stores/message.js`
   - `syncNativeMessages` 改为使用保留本地上下文的合并策略，避免后端历史只返回智能体回复时丢失用户消息。

3. `sections/ui/tests/native-im.test.mjs`
   - 增加“后端历史只返回智能体回复时仍保留本地用户 prompt”的回归测试。
   - 增加 durable final stream 历史合并后保持 completed 的回归测试。

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
/tmp/issue-012-014-01-user-prompt.png
/tmp/issue-012-014-04-final-history-preserved.png
```

验证结果：用户消息和智能体 final 回复同时保留；模拟后端历史只返回智能体回复后，用户 prompt 仍保留。受限于本地未接真实 Clowder/TangSeng 后端，本次浏览器验证使用本地可控事件注入。

---

## 关闭备注

已通过浏览器可视化验证。真实后端环境上线前仍建议补一轮真实账号刷新/重连验收。
