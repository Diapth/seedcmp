# [ISSUE-07] 会话列表 UI 清理与摘要显示问题

**状态**：Resolved
**创建时间**：2026-05-22
**标签**：bug / feature

---

## 问题描述

描述用户遇到的具体问题或你发现的问题。

(注：图片应以该issue的序号+图的序号标注，如07_1.png)

---

## 问题1：会话中取消新建群聊的按钮

在会话列表（ConversationList）的 UI 里有"新建群聊"按钮，但当前产品设计里群聊应通过联系人页入口或其他方式发起，而不是在会话列表直接提供按钮。

**可能方向**：
- `ConversationList.vue` 里有"新建群聊"按钮或加号菜单，当前不需要此入口
- 需要移除相关按钮或菜单项，避免误导用户

---

## 问题2：部分会话的最后一条消息显示为"[消息]"

在群聊消息、文件助手等系统用户会话里，会话列表摘要显示的是 `[消息]` 这种占位符文字，而不是实际的聊天内容。

**可能方向**：
- `getDigest()` 解析 `last_message` / `last_msg` 时，对于系统消息类型（如 CMD 类型 99、图片/文件等非文本类型）没有做友好降级
- 系统消息或多媒体消息的 payload 结构与普通文本不同，摘要解析失败后 fallback 为 `[消息]`
- 群聊里的某些消息类型（如群通知、系统消息）内部字段名与普通消息不同，摘要提取逻辑无法识别

---

## 问题3：已进入会话仍显示未读红点

用户已经打开了某个会话，消息气泡已经能看到，但会话列表里该会话项仍显示未读红点/数字，新消息似乎没有清除红点状态。

**可能方向**：
- `conversationStore` 里未读数没有在 `MessageList` 滚动到底部或消息已读时同步清除
- 后端没有实现已读回执（read receipt）上报，前端不知道何时该消除红点
- 消息进入 store 时只写了消息内容，没有同步更新会话的 `unread` / `extra.unreadCount` 字段
- 红点 UI 读取的字段和实际更新的字段不一致（例如读 `unread` 但更新的是 `extra.unreadCount`）

---

## 问题4：群聊最后一条消息不应显示为系统消息

群聊会话里的最后一条消息又被显示成“系统消息”。正确展示应为“最后一个人的名字：他的消息”，例如 `张三：你好`。

截图：
![群聊摘要误显示系统消息](./imgs/07_1.png)

**可能方向**：
- `ConversationList.vue` 只根据消息类型 fallback 摘要，没有对群聊摘要加发送者前缀
- `last_message.fromUID` 没有映射到 `userStore.userCache` 中的用户昵称
- type 1000 或嵌套 payload 文本解析失败时，过早回落为 `[系统消息]`
- `messageStore.ensureConversationFromMessages()` 直接取消息数组最后一条，若最后一条是系统类消息，会覆盖前一条真实用户消息摘要

---

## 根因分析

1. 会话列表所在左侧栏曾在 `MainLayout.vue` 的 tab 下方直接暴露“发起群聊”入口；但 06 已将保存群聊入口收敛到联系人页，“发起群聊”不应继续占据会话列表区域。
2. `ConversationList.vue` 的 `getDigest()` 只读取 `payload.text` / `payload.content`，解析不到多媒体、系统消息、嵌套 `contentObj` / `payload` 时统一回落为 `[消息]`，导致用户看到无意义摘要。
3. 会话详情页已经会调用 `conversationStore.clearUnread()`，但会话列表仍直接按 `conv.unread` 渲染徽标；点击会话后路由切换与清除未读存在短暂状态差，当前打开会话也可能继续显示未读数字。
4. 群聊摘要缺少发送者上下文。`last_message` 已有 `fromUID`，但 `ConversationList.vue` 没有加载 `userStore` 或预取发送者资料，因此无法把群聊最后一条消息格式化为“发送者：内容”。同时对嵌套 `content.content` 对象的递归解析不足，可能过早落到 `[系统消息]` fallback。
5. 续查截图后确认，仅在 UI 层加发送者前缀不够。`messageStore.ensureConversationFromMessages()` 会用消息数组最后一条更新会话摘要，而群聊里可能混入 type `99/1000` 的系统类消息；这些消息不应覆盖上一条真实聊天消息。`conversationStore.getLastMessageSource()` 同样需要在同步 `recents/messages` 时优先选非系统消息。

---

## 修复记录

### 2026-05-22

已完成以下修复：

1. `apps/chat/src/layouts/MainLayout.vue`
   - 移除左侧栏“发起群聊”按钮、`goToCreateGroup()` 和对应样式。
   - 保留 `/chat/create-group` 路由本身，不影响后续从其他入口接入。
2. `apps/chat/src/views/ConversationList.vue`
   - 新增摘要类型 fallback：图片、动图、语音、视频、位置、名片、文件、聊天记录、贴图、系统消息。
   - 新增嵌套摘要解析，兼容 `contentObj`、`payload`、`text`、`content`、`title`、`name`、`file_name`、`filename`。
   - 移除会话列表摘要中的通用 `[消息]` fallback，未知类型显示为 `[未知类型]`。
   - 点击会话时立即调用 `conversationStore.clearUnread()`。
   - 当前打开会话的未读数通过 `getUnreadCount()` 归零，不再显示红点/数字。
3. `.ai/checks/verify-conversation-list-ui-cleanup.mjs`
   - 新增 issue 专项校验，覆盖入口移除、摘要 fallback、嵌套摘要解析和当前会话未读隐藏。
4. `.ai/checks/verify-exploratory-test-findings.mjs`
   - 调整历史探索性检查：群聊入口改为校验联系人页群聊入口，不再要求 MainLayout 暴露 `/chat/create-group`。
5. `apps/chat/src/views/ConversationList.vue` 续修
   - 引入 `useUserStore()`，根据群聊最后一条消息的 `fromUID` 预取发送者资料。
   - 新增 `getSenderUid()`、`getSenderName()`、`syncGroupDigestSenders()` 和 `formatGroupDigest()`。
   - 群聊摘要统一格式化为 `发送者：摘要`，包括文本、文件、位置、名片和类型 fallback。
   - 增强嵌套摘要解析，递归处理对象形式的 `content.content`，减少误落到 `[系统消息]` 的情况。
6. `.ai/checks/verify-conversation-list-ui-cleanup.mjs` 续修
   - 扩展专项校验，覆盖群聊发送者名字前缀和群聊文件摘要前缀。
7. `packages/datasource-vue/src/stores/messageStore.ts` 和同名 `.js` 续修
   - 新增 `isConversationDigestMessage()`，将 type `99/1000` 的系统类消息排除在会话摘要更新之外。
   - 新增 `getLatestConversationDigestMessage()`，历史消息同步后选择最后一条非系统消息作为会话摘要。
   - 实时消息进入 store 时，系统类消息不再调用 `conversationStore.addOrUpdateConversation()` 覆盖摘要。
8. `packages/datasource-vue/src/stores/conversationStore.ts` 和同名 `.js` 续修
   - `getLastMessageSource()` 在 `last_message`、`last_msg`、`message`、`recents`、`messages` 中优先选择非系统消息。
   - `normalizeLastMessage()` 改为统一使用 `getLastMessageSource()`，避免先读到系统消息。
9. `.ai/checks/verify-conversation-list-ui-cleanup.mjs` / `.ai/checks/verify-conversation-retention.mjs` 续修
   - 增加系统消息不覆盖会话摘要的源码校验。
   - 更新历史保留检查以匹配新的最后消息选择逻辑。

---

## 测试结果

```bash
node .ai/checks/verify-conversation-list-ui-cleanup.mjs
# conversation list UI cleanup checks passed

for check in .ai/checks/*.mjs; do node "$check"; done
# backend IM integration and heartbeat checks passed
# base issue alignment checks passed
# conversation list UI cleanup checks passed
# conversation retention checks passed
# exploratory test findings checks passed
# group chat and conversation summary checks passed
# message UI stability checks passed
# no-messages issue checks passed

# 类型检查
corepack pnpm -r exec vue-tsc --noEmit
# passed

# 构建验证
corepack pnpm --filter chat build
# passed

# 续修验证
node .ai/checks/verify-conversation-list-ui-cleanup.mjs
# conversation list UI cleanup checks passed

for check in .ai/checks/*.mjs; do node "$check"; done
# backend IM integration and heartbeat checks passed
# base issue alignment checks passed
# conversation list UI cleanup checks passed
# conversation retention checks passed
# exploratory test findings checks passed
# group chat and conversation summary checks passed
# message UI stability checks passed
# no-messages issue checks passed

corepack pnpm -r exec vue-tsc --noEmit
# passed

corepack pnpm --filter chat build
# passed

# 截图问题续修验证
node .ai/checks/verify-conversation-list-ui-cleanup.mjs
# conversation list UI cleanup checks passed

for check in .ai/checks/*.mjs; do node "$check"; done
# backend IM integration and heartbeat checks passed
# base issue alignment checks passed
# conversation list UI cleanup checks passed
# conversation retention checks passed
# exploratory test findings checks passed
# group chat and conversation summary checks passed
# message UI stability checks passed
# no-messages issue checks passed

corepack pnpm -r exec vue-tsc --noEmit
# passed

corepack pnpm --filter chat build
# passed
```

---

## 关闭备注

已清理会话列表区域的群聊创建入口，摘要展示改为按消息类型友好降级，并消除当前打开会话仍显示未读徽标的问题。续修后，群聊最后一条消息会优先展示为“发送者：摘要”，并且系统类消息不会再覆盖上一条真实用户消息摘要。专项校验、全量 `.ai/checks`、类型检查和构建均通过。构建过程仍有 Vite CJS Node API deprecated 与大 chunk 既有提示，不影响本 issue 修复结论。
