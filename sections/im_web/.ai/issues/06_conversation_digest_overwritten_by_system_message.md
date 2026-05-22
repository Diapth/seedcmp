# [ISSUE-06] 会话列表最新消息摘要被控制/系统消息错误覆盖问题

**状态**：Resolved
**创建时间**：2026-05-22
**标签**：bug / visual-defect / conversation-digest

---

## 问题描述

在自动化测试 `localhost:3000` (即 Vue 3 极简重构前端 `im_web`) 期间，发现一个严重的会话列表摘要更新缺陷：

* 当在一个活跃的聊天会话（如群聊或单聊）中发送或接收最新消息时，左侧会话列表中该会话的最新消息摘要会显示为正常的消息内容（如 `你好`）。
* 但当系统在后台接收到控制/系统命令消息（如类型为 `99` 的 CMD 消息：打字中状态、会话扩展同步、草稿同步等）时，左侧会话列表中该会话的摘要会**立即被错误地覆盖为 `[系统消息]`**。
* 刷新页面重新初始化加载后，由于初始化同步机制过滤了非正文消息，摘要会重新恢复为正确的 `你好`。

---

## 复现步骤

1. 打开并登录 `im_web` 聊天系统。
2. 发送一条正常的文本消息（如 "你好"），观察左侧会话列表，最新消息摘要显示为 "你好"。
3. 触发系统后台指令（例如切换会话导致发送会话扩展同步，或对方开始输入触发 typing CMD 消息，消息 `type` 为 99 或 1000 级系统指令）。
4. 观察左侧会话列表，发现该会话的消息摘要瞬间变成 `[系统消息]`，严重干扰了用户的正常阅读。
5. 刷新网页，会话列表摘要重新恢复正常。

---

## 相关代码

在 `packages/datasource-vue/src/stores/conversationStore.ts` 中，虽然 `getLastMessageSource` 中对列表初始化进行了 Digest 过滤：

```typescript
function isConversationDigestSource(raw: any) {
  return raw && ![99, 1000].includes(getMessageType(raw));
}
```

但在动态收到新消息或通知更新时，`addOrUpdateConversation` 和 `ensureConversation` 未作过滤，直接更新了 `conv.last_message`：

```typescript
// 修复前的代码
if (conv) {
  conv.last_msg_seq = message.messageSeq || conv.last_msg_seq;
  conv.last_msg_time = message.timestamp || Math.floor(Date.now() / 1000);
  conv.last_message = message; // 无条件覆盖了 last_message
  if (!isOwnMessage && !message.isUnreadCleared) {
    conv.unread++;
    unreadMap.value[key] = conv.unread;
  }
}
```

---

## 根因分析

当接收到非用户可见的控制类消息（如 CMD 消息）时，SDK 也会通过消息通道进行分发。
由于 `addOrUpdateConversation` 与 `ensureConversation` 在增量更新会话最新状态时，**没有判断消息是否属于正文摘要来源** (`isConversationDigestSource`)，直接无条件将 `conv.last_message` 替换为新接收到的控制消息。
这导致非用户正文（如 type 99）被当成了正常的最新消息进行渲染，进而被系统消息格式化工具错误地转义为了 `[系统消息]` 并覆盖在列表最上层。

---

## 修复方案

在 `conversationStore.ts` 的 `addOrUpdateConversation` 与 `ensureConversation` 方法中加入安全防卫，仅当消息是合法的正文摘要源 (`isConversationDigestSource`) 时，才动态更新会话最新消息摘要及递增未读数：

```typescript
const isDigest = isConversationDigestSource(message);
const normalizedMsg = normalizeLastMessage({ last_message: message });

if (conv) {
  conv.last_msg_seq = message.messageSeq || conv.last_msg_seq;
  conv.last_msg_time = message.timestamp || Math.floor(Date.now() / 1000);
  if (isDigest) {
    conv.last_message = normalizedMsg;
  }
  if (!isOwnMessage && !message.isUnreadCleared && isDigest) {
    conv.unread++;
    unreadMap.value[key] = conv.unread;
  }
}
```

---

## 修复记录与测试

该问题已在 `conversationStore.ts` 中成功被修复。
重新运行所有的自动化校验脚本：

```bash
node sections/im_web/.ai/checks/verify-base-issues.mjs
node sections/im_web/.ai/checks/verify-no-messages-issues.mjs
node sections/im_web/.ai/checks/verify-message-ui-stability.mjs
node sections/im_web/.ai/checks/verify-conversation-retention.mjs
node sections/im_web/.ai/checks/verify-backend-im-heartbeat.mjs
node sections/im_web/.ai/checks/verify-exploratory-test-findings.mjs
# 验证通过，所有脚本输出 PASS 且编译/打包成功！
```

本 Issue 正式变更为 **Resolved** 并关闭。
