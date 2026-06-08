# [ISSUE-026] 会话时间缺失与引用状态未按会话隔离

**状态**：Open
**创建时间**：2026-06-09
**标签**：bug / chat / conversation-list / reply / file-quote
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-026_conversation_time_and_reply_quote_state_not_isolated.md

---

## 问题描述

补充验收会话列表和引用功能时，发现三个相关问题：

1. 群聊会话列表中存在“有最后一条消息但没有显示最后时间”的行；这会影响会话排序，真实场景中可能在点击会话、同步消息后才补上时间并重新排序。
2. 在一个会话中引用消息后，切换到另一个会话，输入框上方仍显示上一个会话的引用条，引用状态没有按会话清理或隔离。
3. 测试文件引用功能时，文件卡片出现，但文件预览/选中文本引用链路被阻断：自动化没有找到可点击的文件预览入口，预览正文中也没有加载到可选择的 `previewContent`。同时文件引用成功后也会写入同一个页面级 `replyTarget`，存在与普通消息相同的跨会话泄漏风险。

本次证据目录：

`seedcmp/sections/ui/.ai/tests/ui-reply-time-bugs-20260608163629/`

关键截图：

1. `01-seeded-conversation-list.png`
2. `02-after-click-no-time-conversation.png`
3. `03-reply-bar-before-switch.png`
4. `04-reply-bar-after-switch.png`
5. `05-file-quote-before-switch.png`
6. `06-file-quote-after-switch.png`

---

## 复现步骤

### 会话时间缺失

1. 打开 `http://100.79.157.76:5173/#/pages/chat/index`。
2. 准备一个群聊会话：`lastMessage` 有值，但 `lastTime` 为 `0` 或后端未返回最后消息时间。
3. 查看会话列表。
4. 观察该会话右侧时间为空，排序也不会按最后消息时间进入正确位置。

### 普通消息引用跨会话泄漏

1. 打开会话 A。
2. 右键一条消息，选择 `引用消息`。
3. 确认输入框上方出现引用条。
4. 切换到会话 B。
5. 观察会话 B 中仍显示会话 A 的引用条。

### 文件引用功能

1. 打开包含文件消息的群聊。
2. 点击文件卡片的 `预览`，尝试在文件预览中选中文本并点击 `引用选中文本`。
3. 本轮验收中，文件预览入口/正文加载不稳定，无法完成选中文本引用。
4. 从代码看，即便文件引用成功，也会写入同一个页面级 `replyTarget`，切换会话后存在同样泄漏风险。

---

## 相关代码

```js
// sections/ui/services/native-im/normalizers.js
const lastTime = toTimestampMs(lastMessageTimeFromInput(input), 0);

return {
  lastMessage: messageDigestFromInput(input),
  lastTime
};
```

```js
// sections/ui/services/native-im/conversation-state.js
const lastTime = toTimestampMs(groupLastMessageTime(input), 0);

return {
  lastMessage: digest && digest !== '收到一条新消息' ? digest : '',
  lastTime
};
```

```js
// sections/ui/pages/chat/index.vue
function handleSelectConversation(id) {
  uni.setStorageSync('active_conversation_id', id);
  convStore.setActiveId(id);
  convStore.markConversationRead(id, { silent: true });
  syncActiveMessages({ silent: true });
  closeFilePreview();
  closeMemberProfile();
}
```

```js
// sections/ui/pages/chat/index.vue
if (action === 'reply') {
  replyTarget.value = {
    id: msg.id,
    senderName: msg.senderName,
    contentPreview: (msg.content || '').slice(0, 60)
  };
}

function handleFilePreviewQuote(payload) {
  replyTarget.value = {
    id: payload?.id || `file-selection-${Date.now()}`,
    senderName: payload?.senderName || payload?.fileName || '文件片段',
    contentPreview: payload?.contentPreview || ''
  };
}
```

```js
// sections/ui/pages/chat/detail.vue
function handleSelectConversation(id) {
  convStore.setActiveId(id);
  convStore.markConversationRead(id, { silent: true });
  syncActiveMessages({ silent: true });
  closeFilePreview();
  closeMemberProfile();
}
```

---

## 根因分析

1. 会话归一化依赖后端 conversation/group 数据中的 `last_msg_time`、`last_message_time`、`lastMessage.time`、`recents[0].time` 等字段。如果后端只给最后消息摘要而没有时间，前端会把 `lastTime` 置为 `0`，导致 `ConversationItem` 的 `formatTime(data.lastTime)` 返回空字符串。
2. 会话排序使用 `b.lastTime - a.lastTime`。`lastTime=0` 的会话即使有最后消息，也会排到旧位置；后续点击会话或同步消息如果补写 `lastTime`，会话才可能重新排序，形成“点击后才显示时间并排序”的体验。
3. `replyTarget` 是 `pages/chat/index.vue` / `pages/chat/detail.vue` 的页面级单一状态，`handleSelectConversation` 切换会话时没有清空它。普通消息引用和文件预览引用都写入同一个 `replyTarget`，因此引用状态会跨会话泄漏。
4. 文件引用依赖 `FileCard -> openFilePreview -> FilePreviewPanel -> quote-selection`。本轮验收中文件卡片能显示，但文件预览入口/正文加载未稳定可用，导致无法完成选中文本引用；即便完成，也会复用未隔离的 `replyTarget`。

---

## 问题列表（Q&A 迭代）

### Q1: 普通消息引用是否能创建引用条？
**A1**: 能。`normal message quote action opens reply bar` 通过。

### Q2: 普通消息引用切换会话后是否清理？
**A2**: 不会。`normal message reply bar should clear after switching conversation` 失败，切到目标会话后仍能看到源会话引用。

### Q3: 文件引用具体失败在哪里？
**A3**: 本轮文件消息卡片出现，但自动化未找到稳定的 `预览` 入口，预览正文中也没有找到用于选中的 `previewContent`，所以 `file selected text quote creates reply bar` 失败。该问题应在 issue 中明确为“文件引用入口/正文加载阻断”，不是只归因于跨会话泄漏。

### Q4: 是否只影响桌面？
**A4**: 本轮在桌面 H5 验收中复现。移动端 `pages/chat/detail.vue` 也有同样的页面级 `replyTarget` 和切换不清理逻辑，建议一并修复和复测。

---

## 修复建议

1. 会话归一化时，如果 `lastMessage` 有值但 `lastTime` 缺失，应尝试从最近消息同步结果补齐，或保留后端真实最后消息时间字段；不要让有消息的会话长期保持 `lastTime=0`。
2. `handleSelectConversation` 中切换会话时清空 `replyTarget`，或将引用草稿设计成按 `conversationId` 隔离的状态。
3. 发送消息时校验 `replyTarget` 归属的 conversationId，避免把 A 会话引用发到 B 会话。
4. 文件预览引用应保证文件卡片预览入口稳定可点击；`FilePreviewPanel` 对 `previewContent/contentText/markdown/text` 这类内联内容应能直接显示并支持选择引用。
5. 文件引用 payload 应包含 `conversationId` / `sourceMessageId` / `fileName`，切换会话后清理或隔离。
6. 增加回归：普通消息引用切换会话清空；文件选中文本引用切换会话清空；有最后消息的群聊会话列表显示时间且排序稳定。

---

## 测试结果

```bash
cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://100.79.157.76:5173' \
     REPO_ROOT='/media/leng/DiskB1/exp/seedcmp' \
     node run.js /tmp/playwright-test-sections-ui-reply-time-bugs.js

# exit 1
# PASS: group conversation with last message lacks list time before click
# PASS: normal message quote action opens reply bar
# FAIL: normal message reply bar should clear after switching conversation
# FAIL: test file preview opens before file quote
# FAIL: file selected text quote creates reply bar
# FAIL: file quote reply bar should clear after switching conversation
```

---

## 关闭备注

待修复后复测：会话列表中有最后消息的群聊应始终显示最后时间并按时间排序；普通消息引用和文件引用切换会话后不再泄漏；文件预览可选中文本并成功加入当前会话引用。
