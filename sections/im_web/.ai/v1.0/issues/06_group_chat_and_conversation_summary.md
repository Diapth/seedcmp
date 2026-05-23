# [ISSUE-06] 群聊会话不显示 / 会话摘要无历史消息

**状态**：Resolved
**创建时间**：2026-05-22
**标签**：bug

---

## 问题描述

描述用户遇到的具体问题或你发现的问题。

(注：图片应以该issue的序号+图的序号标注，如06_1.png)

---

## 问题1：会话中不显示群聊会话，联系人中也没有群聊选项

在会话列表里只能看到单聊会话，看不到任何群聊会话入口。在联系人页面也找不到群聊或加入群组的入口。

**可能方向**：
- `conversationStore.syncConversations()` 只同步了 `channel_type === 1`（单聊），没有包含 `channel_type === 2`（群聊）
- 后端 `channels/sync` 或 `conversation/sync` 接口的 channel_type 过滤条件有问题
- 前端 UI 没有渲染 channel_type === 2 的会话项
- 联系人模块根本没有群聊列表页面或入口

---

## 问题2：刷新后每个会话都只显示"暂无消息"，不显示历史上一条消息

页面刷新或切换会话后，会话列表里的每个会话项都显示"暂无消息"或空摘要，但这些会话明明有历史聊天记录。

**可能方向**：
- `conversationStore` 同步最近会话时，`last_message` / `last_msg` 字段解析失败（字段名/结构不匹配）
- `conversationStore` 同步结果整体替换旧列表时，`normalizeLastMessage()` 没有成功提取文本内容
- 刷新页面后 `syncConversations()` 先执行，返回的会话对象里缺少 `last_message`，此时 `messageStore` 还没来得及补全
- CSS/UI 把空摘要或解析失败 fallback 显示为"暂无消息"

---

## 根因分析

1. 会话同步接口 `conversation/sync` 的服务端返回结构以 `recents[0]` 表示最近消息，且会话时间字段是 `timestamp`，置顶字段是 `stick`。Vue 版 `conversationStore.normalizeLastMessage()` 只读取 `last_message` / `last_msg`，`last_msg_time` 也没有回退到 `timestamp`，所以刷新后最后一条历史消息没有进入会话摘要。
2. 会话同步本身没有过滤掉 `channel_type === 2`，但群聊资料只作为 `res.groups` 写入频道缓存；联系人页没有消费 `group/my`，因此用户在联系人模块看不到保存的群聊入口。

---

## 修复记录

### 2026-05-22

已完成以下修复：

1. `packages/datasource-vue/src/stores/conversationStore.ts`
   - 新增 `getLastMessageSource()`，兼容 `last_message`、`last_msg`、`message`、`recents[0]`、`messages[0]`。
   - 会话排序时间兼容 `timestamp`，最后消息序号兼容 `message_seq/messageSeq`。
   - 会话置顶/免打扰/草稿兼容 `stick`、`mute`、`extra` 字段。
   - 群聊频道缓存兼容 `logo/avatar` 与 `stick/top`。
2. `packages/datasource-vue/src/stores/groupStore.ts`
   - 规范化 `group/my` 响应，兼容数组、`{ list }`、`{ groups }` 三种结构。
   - 新增 `savedGroups` 计算属性，按置顶和名称排序。
3. `packages/contacts-vue/src/views/ContactList.vue`
   - 联系人页启动时同步保存群聊。
   - 新增“群聊”快捷入口和保存群聊列表，点击群聊进入 `/chat/conversation/:groupNo/2`。
4. `.ai/checks/verify-group-chat-and-summary.mjs`
   - 新增 issue 专项校验，覆盖 `recents` 摘要解析、群聊列表数据源和联系人页入口。

续修补充：

5. `packages/datasource-vue/src/stores/conversationStore.js`
   - 同步 `.ts` 源中的 `recents[0]` / `messages[0]` 最近消息兼容逻辑。
   - 同步 `timestamp`、`stick`、`mute`、`extra`、群头像 `logo/avatar` 等服务端字段兼容逻辑。
6. `packages/datasource-vue/src/stores/groupStore.js`
   - 同步保存群聊列表归一化逻辑，兼容数组、`{ list }`、`{ groups }` 响应。
   - 同步 `savedGroups` 计算属性，避免 TS/JS store 行为分叉。
7. `.ai/checks/verify-group-chat-and-summary.mjs`
   - 扩展专项校验，额外覆盖同名 JS store，防止后续只修 TS、不修 JS 的回归。

---

## 测试结果

```bash
node .ai/checks/verify-group-chat-and-summary.mjs
# group chat and conversation summary checks passed

for check in .ai/checks/*.mjs; do node "$check"; done
# backend IM integration and heartbeat checks passed
# base issue alignment checks passed
# conversation retention checks passed
# exploratory test findings checks passed
# group chat and conversation summary checks passed
# message UI stability checks passed
# no-messages issue checks passed

# 类型检查
corepack pnpm -r exec vue-tsc --noEmit
# passed

# 构建验证
./node_modules/.bin/vue-tsc --noEmit && ./node_modules/.bin/vite build apps/chat
# passed

# 续修验证
node .ai/checks/verify-group-chat-and-summary.mjs
# group chat and conversation summary checks passed

for check in .ai/checks/*.mjs; do node "$check"; done
# backend IM integration and heartbeat checks passed
# base issue alignment checks passed
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

已按服务端真实会话结构补齐最近消息摘要解析，并在联系人页补齐保存群聊入口。当前专项校验、全量 `.ai/checks`、类型检查和构建均通过。构建过程仍存在 Vite CJS Node API deprecated 与大 chunk 既有提示，不影响本 issue 修复结论。
