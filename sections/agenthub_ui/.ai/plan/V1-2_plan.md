# V1-2 计划：agenthub_ui IM 实时链路接入与 fixture 替换

## 0. 强制执行门禁

本计划执行时必须遵守以下硬性要求：

1. **阶段提交**：每完成一个阶段的实现、测试修复或文档补充，必须立即做一次中文 commit。不要把多个阶段堆到最后一起提交。
2. **本地服务启动**：最终验收前必须在 `seedcmp` 根目录执行：

 ```bash
 bash scripts/start-im-clowder.sh start
 ```

3. **真实 H5 验收**：必须打开 agenthub_ui 的 H5 dev server（`pnpm dev:h5`）做真实操作；不依赖 mock 数据、静态 fixture、纯截图。验收时同时跑 im_web `http://localhost:3000` 比对：同一组会话/消息/未读/撤回/reaction/typing 在两端必须一致。
4. **账号可自理**：可使用已有测试账号登录，也可主动创建新账号。
5. **真实多端**：开 agenthub_ui 浏览器窗口 + im_web `http://localhost:3000` 窗口（或同账号两端 agenthub_ui）做真实验证。
6. **真实猫猫调用**：在 Web 端真实创建或选择 Clowder cat，选择 OAuth 登录方式。
7. **运行平台优先级**：创建/选择猫猫时运行平台优先 `Claude Code`；如果本机能力或 OAuth 配置不可用，再降级为 `Codex`，并在验收记录中写明原因。
8. **证据留存**：浏览器验收要保存截图、关键 WS 帧日志、user/会话/消息 id、运行平台、OAuth 状态和失败诊断，建议放在 `sections/agenthub_ui/.ai/tests-e2e/v1-2-<timestamp>/`。

## 1. 现状盘点

`agenthub_ui` 当前的 IM 链路完全缺失：

- `stores/message.js` `state()` 硬编码 `messages: { '1': [..], '2': [..] }`；`stores/conversation.js` `state()` 硬编码 4 个会话；**无任何网络调用**。
- `components/chat/MessageList.vue` / `MessageInput.vue` 直接 `import { useMessageStore }` 读 fixture。
- 9 个 stores 之间的 schema 不统一：`message.js` 用 `senderId / senderName / content / type / time / status / reactions / replyRef / mentions`，im_web 用 `clientMsgNo / fromUID / messageSeq / content / timestamp / status / reactions / remoteExtra`，**字段名都不一样**——agenthub_ui 的 fixture 模型需要重做映射。
- 无 `WKSDK` 引用；无 ws 连接；无 typing/recall/reaction 的真实通道。
- `pages/chat/index.vue` / `pages/group/create.vue` / `pages/contacts/add.vue` / `components/contacts/ContactUtilityPanel.vue` / `pages/agents/new.vue` 都用了 `setTimeout` 模拟异步（已确认存在）。

V1-1 已搭好 `request.js` / `auth.js` / `user.js` / `im.js`（ws_addr 已能拉到）。本计划在此之上接入完整的 IM 实时链路。

## 2. 不足检查结论

agenthub_ui IM 实时链路需补齐：

1. **WKSDK 接入与 init**：`wukongimjssdk` 在 agenthub_ui 当前**不在 `package.json` 依赖里**（已确认 `package.json` 仅有 vue/pinia/uni-app 等）——需要新增依赖，并写 `utils/wk-sdk.js` 单例 + 跨运行时兼容性适配。
2. **消息 store 真实化**：`stores/message.js` 改造为 Pinia setup store，覆盖 `messagesByChannel`、`addRealtimeMessage`、`sendMessage`、`loadHistory`、`revokeMessage`、`editMessage`、`toggleReaction`、`loadEarlierMessages`、`dedup`。
3. **会话 store 真实化**：`stores/conversation.js` 改造为真实 `fetchConversations` / `addOrUpdateConversation` / `clearUnread` / `deleteConversation` / `markPinned` / `markMuted` / `setDraft`，草稿持久化到 `storage.js`。
4. **channel/group/user store**：新建 `stores/channel.js`（channel info 缓存）/ `stores/group.js`（群成员、群信息）/ 扩展 `stores/user.js`（userCache、mention 列表）。
5. **CMD 监听器**：`typing` / `messageRevoke` / `channelUpdate` / `groupAvatarUpdate` / `groupMemberAdd` / `onlineStatus` / `unreadClear` 等命令分发到对应 store。
6. **fixtures 替换**：原 `state()` 中的硬编码 `conversations` / `messages` / `agents` 改为**空** + `bootstrap()` 时从后端拉；fixture 保留在 `demo.*` 字段下供 `IS_DEMO=true` 时使用。
7. **setTimeout 伪造链路**：`components/chat/MessageList.vue` / `MessageInput.vue` / `pages/chat/index.vue` / `pages/group/create.vue` / `pages/contacts/add.vue` / `components/contacts/ContactUtilityPanel.vue` / `pages/agents/new.vue` 中所有模拟发送/进度/AI 回包/好友请求等待的 `setTimeout` **全部移除**，改为真实 store action。
8. **V3-41 实时同步经验复用**：im_web 已修过的"isRegistered 漂移"、"多设备实时同步"、"noPersist 早 return 日志"、"triggerRef 兜底"四条经验，**agenthub_ui 在首次接入时就要落**，不要重蹈覆辙。

## 3. 影响模块

- `sections/agenthub_ui/package.json`（新增 `wukongimjssdk`）
- `sections/agenthub_ui/utils/wk-sdk.js`（新）
- `sections/agenthub_ui/utils/listeners.js`（新：registerMessageListeners / registerCMDListeners，与 im_web `cmd/index.ts` 行为对齐）
- `sections/agenthub_ui/stores/message.js`（重写为 setup store）
- `sections/agenthub_ui/stores/conversation.js`（重写为 setup store + 持久化草稿/未读/隐藏/已删）
- `sections/agenthub_ui/stores/contact.js`（部分重写：好友/黑名单/红点）
- `sections/agenthub_ui/stores/group.js`（部分重写：群成员/公告/创建）
- `sections/agenthub_ui/stores/file.js`（最小接入：上传/下载/列表）
- `sections/agenthub_ui/stores/agent.js`（V1-2 阶段只删 `setTimeout` 模拟 + 真实拉智能体列表；OAuth/create/connect 留给 V1-3）
- `sections/agenthub_ui/stores/navigation.js` / `stores/settings.js` / `stores/app.js`（小改：kickout / theme / 持久化）
- `sections/agenthub_ui/components/chat/MessageList.vue` / `MessageInput.vue` / `MessageBubble.vue` / `ConversationItem.vue` / `MessageContextMenu.vue` / `MessageReactions.vue` / `MentionPicker.vue`（切到真实 store，删除 `setTimeout` 伪造）
- `sections/agenthub_ui/components/chat/ClowderPanel.vue`（V1-2 阶段只删除 `setTimeout` 模拟进度，**真实 Clowder 数据由 V1-3 接入**）
- `sections/agenthub_ui/pages/chat/index.vue` / `pages/group/create.vue` / `pages/contacts/add.vue` / `pages/agents/new.vue`（删除 `setTimeout`）
- 验证脚本：`sections/agenthub_ui/scripts/smoke-test.js` 扩展 + 新增 Playwright 实时同步 spec。

## 4. 推荐设计

### 4.1 WKSDK 接入（`utils/wk-sdk.js`）

新增 `wukongimjssdk@^1.3.5` 到 `package.json`，写 `utils/wk-sdk.js`：

- `getWKSdk()`：返回 `WKSDK.shared()` 单例，**第一次访问**才 `new WKSDK()`，避免 HMR 反复 init。
- `initSdk({ uid, token, wsAddr })`：配置 + 注册 listener + connect；与 im_web `useSdkStore.initializeSDK` 行为对齐（uid/token 已注册过则跳过）。
- `disconnectSdk()`：logout 时调用。
- `registerMessageListeners()`：与 im_web `cmd/index.ts:171` 行为一致——`addMessageListener` 收到消息 → 调 `useMessageStore().addRealtimeMessage`；区分本端/他端，**不再无脑跳过 fromUID === currentUid**（V3-41 经验）；noPersist / channel 缺失路径加 `[MSG_DROP]` 结构化日志（仅 dev / `?diag=1`）。
- `registerCMDListeners()`：分发 `typing` / `messageRevoke` / `channelUpdate` / `groupAvatarUpdate` / `groupMemberAdd` / `onlineStatus` / `unreadClear` / `friendRequest` / `memberUpdate`。
- `isRegistered` 用 `WKSDK.shared()` 内部 Symbol 属性，不放模块闭包（V3-41 经验）。
- HMR 漂移：监听 `import.meta.hot?.dispose(() => disconnectSdk())`，强制重连。

### 4.2 消息 store（`stores/message.js`）

完全重写为 Pinia setup store，对齐 im_web `useMessageStore`：

- state：`messages = ref<Record<string, Message[]>>({})`、`pendingQueue`、`typingState`、`reminders`、`pinnedMessages` 等。
- action：`addRealtimeMessage` / `addMessage` / `sendMessage`（含 pendingQueue + ack 合并）/ `sendMediaMessage` / `revokeMessage` / `editMessage` / `toggleReaction` / `loadEarlierMessages` / `syncMessages`（含 backfill）/ `mergeSyncedMessages`。
- **字段映射**：`agenthub_ui` 现有 `id / senderId / senderName / content / type / time / status / reactions / replyRef / mentions` 映射到 im_web `messageID / clientMsgNo / fromUID / messageSeq / content / timestamp / status / reactions / remoteExtra`：
 - 入站（realtime / sync）：im_web Message → agenthub_ui Message（补 `senderId / senderName` 从 userCache）。
 - 出站（send）：agenthub_ui 写 → 用 `clientMsgNo` 命中 im_web `addMessage` 流程。
 - 现有组件消费 `msg.id / msg.senderId / msg.content`，**字段名保留**（不破坏现有视觉），但 store 内部多保留一份 im_web 字段用于 SDK 对齐。

### 4.3 会话 store（`stores/conversation.js`）

完全重写：

- `fetchConversations()` → 调 `conversationApi.list`。
- `addOrUpdateConversation(channelId, channelType, patch)`：sdk realtime / sync 入口统一调用。
- `clearUnread` / `markPinned` / `markMuted` / `setDraft`（草稿持久化到 `storage.js`）。
- `deleteConversation` / `hideConversation`。
- 字段映射：im_web `channel_id / channel_type / unread / last_msg_seq / last_message / last_client_msg_no / channel_logo / channel_name` → agenthub_ui `id / type / name / avatar / unread / lastMessage / lastTime / isPinned / isMuted / draft / memberCount`：
 - `id = channel_id`；`type = channelType === 2 ? 'group' : (channelType === 1 ? 'single' : 'robot')`。
 - `name` / `avatar` 从 `useChannelStore().channels[key]` 缓存。
 - `lastMessage` 由 `messageStore.messageSummary(conv.last_message)` 生成。
- **persisted 草稿/未读/隐藏/已删**走 `storage.js`，scope key 为 `conversationDrafts:<uid>` 等。

### 4.4 channel / group / user store

- `stores/channel.js`（新）：`channels: Record<key, { name, avatar, topMembers, . }>`，realtime CMD `channelUpdate` / `groupAvatarUpdate` 触发刷新。
- `stores/group.js`（重写）：`groups: Record<groupId, GroupMeta>` + `members: Record<groupId, Member[]>`；CMD `memberUpdate` / `groupMemberAdd` / `groupTransferOwner` 触发刷新。
- `stores/user.js`（扩展 V1-1）：`userCache` 已有，加 `fetchUser(uid)` / `getUsersByIds`；mention 列表复用。

### 4.5 fixtures 替换

- 原 `state()` 中的硬编码 `conversations` / `messages` / `agents` **整体删除**，替换为**空数组 + `bootstrap()` 异步拉取**。
- fixture 移到 `utils/demoData.js`，仅 `IS_DEMO=true` 时（开发态）注入到 store 初始化。
- 现有页面在 V1-2 阶段如果读 fixture 字段（`state.conversations[0]`），会**自然得到空数组**——由调用方改判空渲染空态，不在 V1-2 阶段做"假数据兜底"。

### 4.6 删 setTimeout 伪造

明确删除以下文件中的 `setTimeout`（已确认 grep 命中）：

- `pages/login/index.vue` / `register.vue`（V1-1 已处理）
- `pages/group/create.vue`：建群"提交中"模拟
- `pages/contacts/add.vue`：加好友"等待同意"模拟
- `components/contacts/ContactUtilityPanel.vue`：UI 延迟
- `components/chat/MessageList.vue`：滚动/未读模拟
- `components/chat/MessageInput.vue`：发送延迟、AI 回包
- `pages/agents/new.vue`：智能体创建"提交中"模拟
- `components/chat/ClowderPanel.vue`：`setTimeout` 推 `progress += 30`（V1-2 阶段只删，V1-3 阶段接真实 Clowder）
- `components/chat/ClowderPanel.vue` 静态 `activeAgents` 数组（V1-2 阶段只删，V1-3 阶段接真实）

### 4.7 V3-41 经验在 V1-2 一次性落

- `isRegistered` 放 WKSDK 单例 Symbol 属性，不放模块闭包。
- 重复 `initializeSDK` 先反注册同标识 listener 再注册。
- `isOwnMessage` 区分本端/他端，他端消息照常 push；本端消息靠 pendingQueue 命中合并。
- 所有早 return 路径加 `[MSG_DROP]` 日志（dev / `?diag=1`）。
- `messages` computed 配合 `triggerRef` 兜底。

## 5. 分阶段实施计划

### 阶段 1：WKSDK 接入与 init

目标：

- `package.json` 新增 `wukongimjssdk@^1.3.5`。
- `utils/wk-sdk.js` 落地：`getWKSdk` / `initSdk` / `disconnectSdk` / `registerMessageListeners` / `registerCMDListeners` / `isRegistered` 放单例 Symbol。
- `App.vue.onLaunch` 在 `imStore.fetchImAddress` 成功后调 `initSdk`。
- HMR：`import.meta.hot?.dispose(() => disconnectSdk())`。
- 单元测试：`utils/wk-sdk.spec.js` mock `WKSDK.shared()`，断言 init 注册一次 listener，重复 init 反注册再注册。

阶段完成必须中文 commit，例如：

```text
V1-2 阶段1：agenthub_ui 接入 wukongimjssdk
```

### 阶段 2：消息 store 真实化

目标：

- `stores/message.js` 重写为 Pinia setup store：state + action 全套对齐 im_web `useMessageStore`。
- 保留 agenthub_ui 字段命名（`id / senderId / senderName / content / type / time / status / reactions / replyRef / mentions`），内部多保留一份 im_web 字段用于 SDK 对齐。
- `addRealtimeMessage` / `sendMessage` / `loadEarlierMessages` / `syncMessages` / `revokeMessage` / `editMessage` / `toggleReaction` 全部真实接 `messageApi` + SDK。
- 删原 fixture `state.messages`。
- 单元测试：mock `WKSDK.chatManager` / `messageApi`，断言 realtime 入库 / send pending + ack 合并 / revoke 改写。

阶段完成必须中文 commit，例如：

```text
V1-2 阶段2：消息 store 真实化与字段映射
```

### 阶段 3：会话 store 真实化

目标：

- `stores/conversation.js` 重写：`fetchConversations` / `addOrUpdateConversation` / `clearUnread` / `markPinned` / `markMuted` / `setDraft` / `deleteConversation` / `hideConversation`。
- `messagesByChannel` 消息 store key 与 conversation key 一致（`${id}-${type}`）。
- 草稿 / 未读 / 隐藏 / 已删 持久化到 `storage.js`，scope key 前缀。
- 删原 fixture `state.conversations`。
- 单元测试：覆盖草稿持久化、clearUnread、markPinned/muted、delete/hide。

阶段完成必须中文 commit，例如：

```text
V1-2 阶段3：会话 store 真实化与持久化
```

### 阶段 4：channel / group / contact / file 接入

目标：

- 新建 `stores/channel.js`，realtime CMD 触发刷新。
- 重写 `stores/group.js`：群成员、群信息、群公告，CMD 触发刷新。
- 部分重写 `stores/contact.js`：好友 / 黑名单 / 红点走 `userApi`。
- `stores/file.js` 最小接入：上传 / 下载 / 列表走 `fileApi`。
- 删 setTimeout 伪造链路（已确认 grep 命中的 7 个文件）。
- 单元测试：channel / group / contact / file 的 CRUD 与 CMD 触发。

阶段完成必须中文 commit，例如：

```text
V1-2 阶段4：channel group contact file 接入与删 setTimeout
```

### 阶段 5：components/pages 切到真实 store

目标：

- `components/chat/MessageList.vue` / `MessageInput.vue` / `MessageBubble.vue` / `ConversationItem.vue` / `MessageContextMenu.vue` / `MessageReactions.vue` / `MentionPicker.vue` 切到真实 store。
- 字段名保留（`id / senderId / senderName / content / type / time`），不破坏视觉契约。
- `pages/chat/index.vue` / `pages/group/create.vue` / `pages/contacts/add.vue` / `pages/agents/new.vue` 全部走真实 action。
- `components/chat/ClowderPanel.vue`：删除 `setTimeout` 模拟进度，**真实数据由 V1-3 接入**（本阶段显示明确 unavailable / loading）。
- 单元测试：组件 mount 真实 store，断言渲染空态/正常态。

阶段完成必须中文 commit，例如：

```text
V1-2 阶段5：components/pages 切到真实 store
```

### 阶段 6：自动化回归与真实 H5 验收

目标：

- `pnpm test:unit` / `pnpm build:h5` 全绿。
- 现有 `scripts/smoke-test.js` 扩展实时同步断言。
- 新增 `tests-e2e/smoke-real-time-sync.spec.ts`（Playwright）：双 context 登录同一账号，A 端发，B 端 ≤3 秒内 MessageList 出现新条目。
- 新增 `tests-e2e/smoke-realtime-vs-imweb.spec.ts`：agenthub_ui 与 im_web `localhost:3000` 同时在线，A 端在 agenthub_ui 发，B 端在 im_web 不刷新也能看到。
- 真实 H5：从 `seedcmp` 根 `bash scripts/start-im-clowder.sh start`，`pnpm dev:h5` 起 agenthub_ui；完成以下真实验收：
 1. 注册/登录（V1-1）→ 进主页。
 2. P2P 实时互发文本 / 图片 / 文件，agenthub_ui ≤3 秒内可见。
 3. 群聊：建群（真实 `groupApi.create`）→ 邀请 → 群消息实时同步。
 4. 撤回、reaction、typing、unread clear 即时生效。
 5. 草稿跨刷新保留：草稿输入 → 刷新 H5 → 草稿还在。
 6. 持久化：登出再登录，会话/未读/草稿恢复。
 7. 与 im_web `http://localhost:3000` 同账号两端比对，消息/未读一致。
 8. 保存截图、WS 帧日志、user/会话/消息 id 到 `sections/agenthub_ui/.ai/tests-e2e/v1-2-<timestamp>/`。

阶段完成必须中文 commit，例如：

```text
V1-2 阶段6：IM 实时链路真实 H5 验收完成
```

## 6. 测试与验收清单

- Unit：
 - `wk-sdk` init / dispose / 重复 init 反注册。
 - `message` store realtime / send / pendingQueue / revoke / edit / reaction / loadEarlier / syncMessages。
 - `conversation` store fetchConversations / clearUnread / markPinned / markMuted / setDraft / delete / hide / 持久化。
 - `channel` / `group` / `contact` / `file` CRUD + CMD 触发。
 - 组件：mount 真实 store 后渲染空态 / 正常态。
- E2E：
 - 双 context 实时同步（≤3 秒）；
 - 撤回 / reaction / typing / unread clear 即时；
 - 草稿跨刷新保留；
 - agenthub_ui ↔ im_web 双端一致。
- Live：
 - `bash scripts/start-im-clowder.sh start` + `pnpm dev:h5`；
 - 真实用户、真实 OAuth 猫猫（V1-3 接入，但 V1-2 阶段也能用 im_web 创建的 cat 互发消息）；
 - 保存 evidence、ids、runtime choice、OAuth status、WS 帧日志。

## 7. 风险与回滚

- **风险：uni-app runtime 与 wukongimjssdk 兼容性。** 处理：H5 端先落地；小程序端 V1-2 不验收；保留 wukongimjssdk 加载失败兜底（显示 unavailable，不崩）。
- **风险：agenthub_ui 字段命名（`id / senderId / senderName`）与 im_web 不一致，组件重写量大。** 处理：保留 agenthub_ui 字段名，store 内部多保留一份 im_web 字段；视觉契约不变。
- **风险：删 fixture 后未迁移页面崩空。** 处理：所有 store 初始化空 + bootstrap 拉；调用方判空渲染空态；fixture 仅在 `IS_DEMO=true` 注入。
- **风险：删 setTimeout 暴露已有 bug（如未读清不掉、草稿不同步）。** 处理：阶段 4/5 跑 unit + smoke 兜底；如真有问题，回滚到 setTimeout 但打 TODO。
- **风险：与 V1-3 进度冲突。** 处理：V1-2 阶段 `ClowderPanel.vue` 显示 unavailable / loading，不接真实 Clowder；V1-3 阶段接管。

## 8. 完成定义

V1-2 只有同时满足以下条件才算完成：

- `wukongimjssdk` 已加为依赖；`utils/wk-sdk.js` 已落地。
- `message` / `conversation` / `channel` / `group` / `contact` / `file` store 全部真实化，原 fixture 已清空（IS_DEMO=false 时）。
- 所有已 grep 命中的 `setTimeout` 伪造链路已删除（ClowderPanel 的 mock 进度由 V1-3 接管）。
- 真实 H5 双 context 实时同步 ≤3 秒；agenthub_ui ↔ im_web `localhost:3000` 双端消息/未读一致。
- 草稿 / 未读 / 隐藏 / 已删 持久化生效。
- 撤回 / reaction / typing / unread clear 即时。
- V3-41 经验（isRegistered 单例 Symbol / isOwnMessage 区分本端他端 / noPersist 日志 / triggerRef 兜底）在 agenthub_ui 一次性落地。
- `pnpm test:unit` / `pnpm build:h5` 通过；Playwright 全部 spec 通过。
- 截图、WS 帧日志、user/会话/消息 id 证据完整。
- 每个阶段都有对应中文 commit。
