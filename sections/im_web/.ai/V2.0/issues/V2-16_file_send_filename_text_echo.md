# [V2-16] 发送文件后文件名被渲染成独立文本消息

**状态**：Resolved
**创建时间**：2026-05-25
**标签**：bug / media / message-store
**优先级**：P0

---

## 问题描述

用户反馈发送文件时，消息区域会出现文件卡片以外的文件名文本气泡，导致看起来像“每次发送文件都会单独发送一次文件名”。

---

## 复现步骤

1. 打开 `http://localhost:3000` 并登录。
2. 进入任意单聊或群聊。
3. 点击输入框工具栏中的“选择文件”，上传一个普通文件。
4. 实际表现：文件发送完成后，SDK 回包中的文件名摘要可能覆盖本地 pending 文件卡片，最终渲染为 `type=1` 文本气泡。
5. 预期表现：同一条媒体消息应保留 `type=8` 文件内容，只更新 messageID、messageSeq、状态等服务端字段。

---

## 相关代码

```
sections/im_web/packages/datasource-vue/src/stores/messageStore.ts
sections/im_web/apps/chat/tests/messageMediaSending.test.ts
```

---

## 根因分析

`sendMediaMessage()` 会先创建本地 pending 文件消息，再调用 `WKSDK.shared().chatManager.send()`。旧逻辑在 SDK 回包存在 `content` 时直接信任回包内容；当 SDK 或服务端回显的是文件名文本摘要（`type=1` / `content=文件名`）时，本地同 `clientMsgNo` 的文件卡片会被 `addRealtimeMessage()` 合并覆盖成文本消息。

媒体发送时，前端刚组装的 `MessageImage` / `MessageFile` 才是渲染所需的完整内容；SDK 回包只应补齐服务端消息元数据。

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 3 Store | `cd sections/im_web/apps/chat && pnpm exec vitest run tests/messageMediaSending.test.ts --config vitest.config.ts` | ✅ Pass，4 tests |

---

## 修复记录

### 2026-05-25

已完成以下修复：

1. `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
   - 媒体发送成功后，无条件使用本地 `MessageImage` / `MessageFile` 覆盖 `sentMessage.content`，保留正确的消息类型和媒体字段。
2. `sections/im_web/apps/chat/tests/messageMediaSending.test.ts`
   - 新增回归测试：当 SDK 回显 `type=1` 文件名文本 payload 时，最终 store 中仍只保留一条 `type=8` 文件卡片消息。
   - 补齐 `normalizeMediaUrl` mock，匹配当前媒体 URL 归一化依赖。

---

## 关闭备注

Resolved。文件发送链路现在不会把 SDK 的文件名文本摘要渲染为独立文本气泡；同 `clientMsgNo` 的 pending 文件消息会保持为文件卡片。
