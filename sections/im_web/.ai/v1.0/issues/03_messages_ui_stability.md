# [ISSUE-03] 消息气泡、会话列表及联系人稳定性问题

**状态**：Fixed
**创建时间**：2026-05-22
**标签**：bug

---

## 问题描述

描述用户遇到的具体问题或你发现的问题。

(注：图片应以该issue的序号+图的序号标注，如03_1.png)

---

## 问题列表

### 问题1：发送消息气泡时，气泡周围会莫名其妙出现系统通知

发送消息后，气泡本身显示正常，但在气泡周围（可能是气泡上方或下方）会突然出现一条系统通知，内容与发送的消息无关。

**可能方向**：
- 发送消息后 SDK 推送了某条 CMD 通知，当前处理逻辑误将其渲染到了消息列表里
- `messageStore` 的 `addRealtimeMessage` 或 `addMessage` 混入了非用户消息类型的记录
- 某条 CMD（如 `friendRequest`、ack 等）带了 `channelId`/`channelType` 被错误地当作聊天消息处理

---

### 问题2：根本没有已读功能，前端却显示了已读标签

消息气泡旁边出现了"已读"或"已读回执"相关 UI，但后端根本没有实现已读上报/同步接口。

**可能方向**：
- 老前端有 `message_extra` 里的已读标记字段，前端直接读取并渲染
- `messageStore` 或消息气泡组件里读取了 `message.message_extra.is_read` 并展示标签
- 需要确认后端 `message/send` 或 `message/read` 接口是否真实存在，如果不存在应移除相关 UI

---

### 问题3：联系人和会话切换不稳定，来回切换后联系人被清空

在联系人列表和会话列表之间来回快速切换几次后，联系人列表里的所有联系人都消失了，用户无法继续选择会话。

**可能方向**：
- `contactStore.syncContacts()` 或 `conversationStore.syncConversations()` 在快速调用时存在竞态条件（race condition）
- 某次切换时触发了 `is_deleted === 1` 的过滤，把所有联系人意外标记为已删除
- store 之间有依赖关系，切换时一个 store 的 reset/patch 操作影响了另一个 store 的数据
- 切换时 `pinia` 的响应式数据被意外覆盖或清空（例如 `contacts.value = []` 被意外触发）

---

### 问题4：聊天气泡的消息都是换行显示

所有消息内容都换行显示，即使是很短的文字也独占一行，气泡高度被撑得很高。

**可能方向**：
- CSS 样式问题：`white-space` 或 `word-break` 设置导致每条消息强制换行
- 消息气泡组件里的 `display: block` 或 `flex-direction: column` 误用，导致内容自动换行
- 文本容器宽度被限制在单字宽度，导致文字无法在一行内展示

---

## 根因分析

1. **气泡周围出现系统通知**
   - `MessageList.vue` 对未知消息类型使用了兜底 `<SystemCell v-else>`。
   - 当 SDK/CMD/未知类型消息进入 `messageStore` 后，即使不是用户可见聊天消息，也会被当成系统通知渲染。
   - WKSDK 的 CMD 类型是 `99`，未知类型是 `0`；这些不应该进入消息气泡 UI。

2. **没有已读功能却显示已读标签**
   - `MessageList.vue` 里硬编码显示了 `read-status-wrapper`，并读取 `remoteExtra.readed/readedCount`。
   - 当前后端没有完整已读上报/同步能力，所以该 UI 会给用户错误预期。

3. **联系人和会话切换后联系人被清空**
   - `ContactList.vue` 每次挂载都会触发 `contactStore.syncContacts()`。
   - `syncContacts()` 使用增量 `version`，当后端返回空增量数组时，旧逻辑会直接 `contacts.value = []`。
   - 快速切换联系人/会话时，多次同步请求可能交错返回，旧响应也可能覆盖新状态。

4. **聊天气泡消息换行显示**
   - `TextCell.vue` 内部 `.bubble` 设置了 `max-width: 60%`。
   - 外层 `msg-bubble-container` 又限制了 `max-width: 70%`，双层宽度限制让短文本也容易被压窄换行。

---

## 修复记录

### 2026-05-22

1. `apps/chat/src/components/MessageList.vue` 和同名 `.js`
   - 新增 `supportedMessageTypes` 与 `isRenderableMessage()`。
   - 消息列表改为渲染 `renderableMessages`，只展示文本、图片、语音、视频、位置、名片、文件、合并转发、贴图、撤回/系统类等明确支持的类型。
   - 移除未知消息类型 fallback 到 `SystemCell` 的逻辑，避免 CMD/未知消息误显示为系统通知。
   - 移除已读/未读 UI，避免在后端能力不完整时展示错误状态。

2. `packages/base-vue/src/components/messages/TextCell.vue` 和同名 `.js`
   - 文本气泡改为内容自适应宽度：
     ```css
     display: inline-block;
     width: fit-content;
     max-width: min(520px, 100%);
     ```
   - 保留长文本换行能力，短文本不再被单字宽度挤压。

3. `packages/contacts-vue/src/stores/contactStore.ts` 和同名 `.js`
   - 新增 `contactSyncRequestId`，只允许最后一次联系人同步请求写入 store，避免竞态覆盖。
   - 当增量同步返回空列表时保留已有联系人，不再把联系人列表清空。

4. 新增验证脚本：
   - `sections/im_web/.ai/checks/verify-message-ui-stability.mjs`

---

## 测试结果

已运行并通过：

```bash
node sections/im_web/.ai/checks/verify-message-ui-stability.mjs
# message UI stability checks passed
```

```bash
corepack pnpm -r exec vue-tsc --noEmit
# exit 0
```

```bash
./node_modules/.bin/vue-tsc --noEmit && ./node_modules/.bin/vite build apps/chat
# exit 0
```

备注：Vite 构建仍有 CJS API deprecation 提示和 chunk size warning，但构建通过。

---

## 关闭备注

已通过代码对齐检查、类型检查和生产构建验证。实际 UI 侧应重点回归：

- 发送普通文本消息后，消息周围不再出现无关系统通知。
- 消息旁不再显示“已读/未读”。
- 联系人/会话快速切换后，已有联系人不被空增量同步清空。
- 短文本气泡按内容宽度显示，长文本在合理最大宽度内换行。




# 问题：为什么点击会话后，存在历史记录的仍然会消失，不会一直显示在会话下方栏，按道理来说会一直显示，如果用户有关闭需求则应该右键手动删除

## 追加问题根因分析

点击会话后虽然能拉到历史消息，但历史消息只写入 `messageStore.messages`，没有确保 `conversationStore.conversations` 中一定存在对应会话。

同时 `conversationStore.syncConversations()` 原逻辑会把同步结果整体替换成新的 `list`。如果后端最近会话同步没有返回当前会话，即使本地已经有历史记录，这个会话仍会从下方会话列表消失。

这与预期行为不一致：只要会话存在历史记录，就应该保留在会话列表中；用户需要隐藏时，应通过右键菜单手动删除。

## 追加修复记录

### 2026-05-22

1. `packages/datasource-vue/src/stores/conversationStore.ts` 和同名 `.js`
   - 新增 `upsertConversation()`，会话同步改为合并/更新现有会话，不再用 `conversations.value = list` 整体替换本地列表。
   - 新增 `ensureConversation()`，允许消息同步完成后根据最后一条历史消息补齐会话列表项。
   - 新增 `manuallyDeletedConversationKeys`，右键删除后的会话不会被后续普通会话同步或历史消息同步立即补回。
   - 当有实时新消息或主动发送消息进入 `addOrUpdateConversation()` 时，会清除本地删除标记，让真正的新活动可以重新出现在会话列表中。

2. `packages/datasource-vue/src/stores/messageStore.ts` 和同名 `.js`
   - 新增 `ensureConversationFromMessages()`。
   - `syncMessages()` 合并历史消息后，会调用 `conversationStore.ensureConversation()`，保证有历史记录的会话能够持续显示在会话列表中。

3. `apps/chat/src/views/ConversationList.vue` 和同名 `.js`
   - 接入 `ContextMenu`。
   - 会话项新增右键菜单，提供“删除会话”操作。
   - 删除当前正在查看的会话后跳回 `/chat`，避免路由还停留在已隐藏会话上。

4. 新增验证脚本：
   - `sections/im_web/.ai/checks/verify-conversation-retention.mjs`

## 追加测试结果

已重新运行并通过：

```bash
node sections/im_web/.ai/checks/verify-conversation-retention.mjs
# conversation retention checks passed
```

```bash
node sections/im_web/.ai/checks/verify-message-ui-stability.mjs
# message UI stability checks passed
```

```bash
corepack pnpm -r exec vue-tsc --noEmit
# exit 0
```

```bash
./node_modules/.bin/vue-tsc --noEmit && ./node_modules/.bin/vite build apps/chat
# exit 0
```

备注：Vite 构建仍有 CJS API deprecation 提示和 chunk size warning，但构建通过。




# 问题：每次发送消息会在聊天框显示两个一样的消息，再次发送消息后，就又变成了四个消息，分别还是成对的

## 第二次追加问题根因分析

发送文本消息时，`messageStore.sendMessage()` 先用 `Math.random()` 自造 `clientMsgNo` 并本地插入一条临时消息。

但 WKSDK 的 `chatManager.send()` 内部会生成自己的 `clientMsgNo`，并立即通过 `notifyMessageListeners()` 推送同一条发送消息。前端的实时监听又会调用 `addRealtimeMessage()` 写入消息列表。

因为两条消息的 `clientMsgNo` 不同，`addMessage()` 的去重逻辑无法把它们合并，于是一次发送显示两条。后续如果 SDK/页面监听或历史同步再次触发，就会继续把成对重复消息放大。

## 第二次追加修复记录

### 2026-05-22

1. `packages/datasource-vue/src/stores/messageStore.ts` 和同名 `.js`
   - 移除 `sendMessage()` 中自造 `clientMsgNo` 与发送前本地插入临时消息的逻辑。
   - 发送消息统一使用 WKSDK 返回/监听中的消息对象，并通过 `addRealtimeMessage()` 写入 store。
   - 保留 `addMessage()` 按 `clientMsgNo` upsert 的路径，让 SDK 发送回显、发送返回值和后续同步都合并到同一条消息。
   - 新增 `updateMessageStatus()`，用于把服务端发送 ACK 的 `messageID`、`messageSeq`、`status` 合并回同一条消息。

2. `packages/datasource-vue/src/cmd/index.ts` 和同名 `.js`
   - 在消息监听中记录 `clientSeq -> clientMsgNo`。
   - 新增 `addMessageStatusListener()`，收到 WKSDK 发送 ACK 后按 `clientMsgNo` 更新对应消息状态，不再新增第二条消息。

3. `sections/im_web/.ai/checks/verify-message-ui-stability.mjs`
   - 新增检查，禁止恢复发送前自造 `clientMsgNo`/本地临时插入。
   - 新增检查，要求发送结果走 `addRealtimeMessage()` upsert，并要求 ACK 状态更新路径存在。

## 第二次追加测试结果

已重新运行并通过：

```bash
node sections/im_web/.ai/checks/verify-message-ui-stability.mjs
# message UI stability checks passed
```

```bash
node sections/im_web/.ai/checks/verify-conversation-retention.mjs
# conversation retention checks passed
```

```bash
corepack pnpm -r exec vue-tsc --noEmit
# exit 0
```

```bash
./node_modules/.bin/vue-tsc --noEmit && ./node_modules/.bin/vite build apps/chat
# exit 0
```

备注：Vite 构建仍有 CJS API deprecation 提示和 chunk size warning，但构建通过。


# 问题：当会话选中某个聊天后，某个会话就会突然跳到最顶部，然后复制出来一个新的，且其他对话不会显示历史最后一条消息

![](./imgs/03_1.png)

## 第三次追加问题根因分析

会话同步、历史消息补会话、路由选中态使用的 `channel_type` 类型不统一：后端同步数据里可能是字符串 `"1"`/`"2"`，而点击会话、历史消息同步和路由参数会转成数字 `1`/`2`。

旧逻辑用严格比较查找会话：

```ts
c.channel_id === channelId && c.channel_type === channelType
```

当同一个会话一边是字符串 channel type、一边是数字 channel type 时，前端会认为它们是两个不同会话，于是点击后历史消息同步会补出一个新的会话项；新项因为 `last_msg_time` 是当前/历史消息时间，会被排序到顶部，看起来像“跳到顶部并复制了一份”。

另外，会话列表摘要只读取 `conv.last_message.payload || conv.last_message.content`。后端同步最近会话时可能返回 `last_msg`、字符串 payload、或文本字段在 `content` 里，旧逻辑没有统一解析，所以其他会话容易显示“暂无消息”。

## 第三次追加修复记录

### 2026-05-22

1. `packages/datasource-vue/src/stores/conversationStore.ts` 和同名 `.js`
   - 新增 `getConversationKey()`，统一使用 `String(channel_id)-Number(channel_type)` 作为会话唯一 key。
   - 新增 `findConversation()`，所有会话查找都按归一化后的 channel id/type 比较，避免 `"1"` 和 `1` 生成重复会话。
   - 新增 `normalizeConversationInput()`，把后端同步回来的会话统一规范为 `channel_id: string`、`channel_type: number`。
   - 新增 `normalizeLastMessage()`，兼容 `last_message`、`last_msg`、字符串 payload、`content -> text` 等不同历史最后消息结构。
   - 新增 `compactConversations()` 与 `uniqueConversations`，即使内存中已经出现重复会话，也会按规范 key 合并，列表渲染只显示一条。

2. `apps/chat/src/views/ConversationList.vue` 和同名 `.js`
   - `getDigest()` 兼容 `last_message` 和 `last_msg`。
   - 摘要解析支持 JSON 字符串 payload、`text`、`content`，减少历史最后一条消息显示成“暂无消息”的情况。

3. `sections/im_web/.ai/checks/verify-conversation-retention.mjs`
   - 新增检查，确保会话 key 归一化、重复会话合并、唯一会话列表渲染和最后消息归一化路径存在。

## 第三次追加测试结果

已重新运行并通过：

```bash
node sections/im_web/.ai/checks/verify-conversation-retention.mjs
# conversation retention checks passed
```

```bash
node sections/im_web/.ai/checks/verify-message-ui-stability.mjs
# message UI stability checks passed
```

```bash
corepack pnpm -r exec vue-tsc --noEmit
# exit 0
```

```bash
./node_modules/.bin/vue-tsc --noEmit && ./node_modules/.bin/vite build apps/chat
# exit 0
```

备注：Vite 构建仍有 CJS API deprecation 提示和 chunk size warning，但构建通过。
