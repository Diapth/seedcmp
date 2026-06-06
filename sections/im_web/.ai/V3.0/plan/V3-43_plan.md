# V3-43 计划：IM Web 功能模块去重与 V3-42 新 UI 适配前置

## 0. 强制执行门禁

1. **阶段提交**：每个阶段完成立即中文 commit，不堆到最后。
2. **本地服务启动**：验收前 `bash scripts/start-im-clowder.sh start`。
3. **真实 Web 验收**：`http://localhost:3000` 真实双窗口/三窗口/群聊/撤回/typing。
4. **类型与单元**：`pnpm type-check` 与 `pnpm test:unit` 全绿。
5. **证据留存**：放 `sections/im_web/.ai/V3.0/tests-e2e/v3-43-<timestamp>/`。
6. **不回归 V3-41**：本计划所有改动不得回滚 V3-41 已落地的 listener 修复、computed 兜底、noPersist 日志、isRegistered 反注册；合并顺序先 V3-42 验收、再 V3-43 验收。
7. **不回归 V3-42 视觉替换范围**：本计划只调整数据/视图模型边界，不动 `agenthub_ui` 视觉迁移与 shell/会话列表/气泡/输入区/右侧工作区/联系人等子系统的替换面；只负责让替换"接得上"。

## 1. 现状盘点（按行数）

| 文件 | 行数 | 角色 | 风险 |
| --- | --- | --- | --- |
| `apps/chat/src/components/MessageList.vue` | 2082 | 消息列表 + deployment 轮询 + 项目群卡 + 协调者摘要 + 定位消息 + 上下文菜单 | 与 V3-42 新 `MessageList.vue`（130 行）规模差 16× |
| `apps/chat/src/components/MessageInput.vue` | 1943 | 输入框 + AI 流式 + 语音 + 部署意图 + 协调者命令 + mention 弹层 | 与 V3-42 新 `MessageInput.vue`（806 行）规模差 2.4× |
| `apps/chat/src/components/ClowderConversationPanel.vue` | 1049 | 协调者面板 + Kanban + Artifacts + 协调子任务 | V3-42 阶段 7 整体替换 |
| `packages/datasource-vue/src/stores/clowderStore.ts` | 1848 | Clowder 状态机 + 协调者 + 部署 + workspace + OAuth | V3-42 阶段 7 大量调用 |
| `packages/datasource-vue/src/stores/messageStore.ts` | 1849 | 消息存储 + dedup + 流式合并 + 同步 + 撤回 + 编辑 | 全部 V3 阶段共享 |
| `packages/datasource-vue/src/stores/conversationStore.ts` | 1138 | 会话存储 + 草稿 + 未读 + 删除/隐藏 + 同步 | V3-42 阶段 3 整体替换 |
| `apps/chat/src/views/MyProfileDrawer.vue` | 567 | 自身资料抽屉 | 与 `UserProfileDrawer.vue`（349）有 200+ 行共用脚手架 |
| `packages/base-vue/src/components/GroupSettingsDrawer.vue` | 1023 | 群设置抽屉 | V3-42 阶段 6 替换 |
| `packages/contacts-vue/src/views/ClowderCatConsolePage.vue` | 901 | 猫猫控制台 | V3-42 阶段 6 替换 |

`apps/chat` 视图/组件总 12525 行（不含 `<style>`），`datasource-vue` store 5960 行。**总量大、职责重叠多、视图与 store 互相渗透**，直接做 V3-42 视觉替换会出现"新组件接不上旧 store"的二次返工。

## 2. 发现的代码冗余

### 2.1 Channel key 工具重复 3 处

- `messageStore.ts:560` `getChannelKey`
- `conversationStore.ts:76` `getConversationKey`
- `clowderStore.ts:61` `conversationKey`

三者均实现 `${String(id)}-${Number(type)}`。**新增** `packages/datasource-vue/src/utils/channelKey.ts` 统一导出 `channelKey(channelId, channelType)`、`parseChannelKey(key)`、`isSameChannel(a, b)`，三处 store 切换为调用，**禁止** 在组件里再写 `${id}-${type}`。

### 2.2 Clowder 身份与 cat 查找 4+ 处重复

`base-vue/utils/clowderMessageIdentity.ts` 已实现 287 行的核心 helper，但 `MessageList.vue`、`MessageInput.vue`、`ClowderConversationPanel.vue` 中各自重复实现：

- `normalizeCatLookupToken`
- `findCatContactByDisplayName`
- `getClowderSenderName` / `getClowderSenderCatId` / `getClowderSenderAvatar`
- `getMessageSenderName` / `getMessageBodyText` / `getMessageVisibleText`
- `getReplyTargetCatId` / `isGroupCatMessage`
- `getCoordinationContext` / `getMessageSource` / `getProjectGroupHandoff` / `getProjectGroupConfirmation`

**新增** `packages/base-vue/src/utils/messageViewModel.ts`，集中上述 helper 单一实现；`MessageList.vue`/`MessageInput.vue` 改为引用 `base-vue/utils/messageViewModel`。

### 2.3 会话摘要/草稿/未读 3 处手写归一化

`ConversationList.vue` 自写 `parseDigestContent`/`resolveDigestText`/`getSenderName`/`getSenderUid`/`isSystemDigest`/`getMentionReminder`/`getDigestPresentation`；`messageStore.ts` 也有 `getLatestConversationDigestMessage`/`getLatestConversationMessage`；`conversationStore.ts` 也有 `isConversationDigestSource`/`isGroupJoinPlaceholder`/`needsClowderDigestIdentityRecovery`。三者输出字段不一致（`type` 取值、payload 解析顺序、mention 解析）。

**新增** `packages/datasource-vue/src/utils/conversationDigest.ts`，统一 `resolveConversationDigest(conv, options)` 输出 `{ text, senderName, mentionReminder, isSystem, isDraft, fallbackType }`；`ConversationList.vue`、`messageStore.ensureConversationFromMessages`、`conversationStore.normalizeLastMessage` 全部切换。

### 2.4 MyProfileDrawer / UserProfileDrawer 脚手架 200+ 行重复

两者都做：watch visible 同步表单、ChannelAvatar、Message.success/error、isNonBlockingCmdFailure 容错、StorageService.set/clear 联动。

**新增** `apps/chat/src/views/_shared/ProfileDrawerShell.vue`（组件 + 公共 composable `useProfileDrawerForm`），把"watch → 拉取 user → 渲染"放到 shell，两个 drawer 只写差异部分（My 写保存按钮，User 写加好友/拉黑/举报）。

### 2.5 本地存储 scope helper 4 套重复

`conversationStore.ts` 的 `LOCAL_ONLY_DRAFTS_STORAGE_PREFIX` / `CLEARED_UNREAD_STORAGE_PREFIX` / `HIDDEN_CONVERSATIONS_STORAGE_PREFIX` / `DELETED_CONVERSATIONS_STORAGE_PREFIX` + `readScopedRecord` / `writeScopedRecord` / `getScopedStorageKey` 7 个函数。`userStore.ts` 的 `StorageService` 用法不走 scope。

**新增** `packages/base-vue/src/utils/scopedLocalStorage.ts`，提供 `scopedRead(scope, prefix)`、`scopedWrite(scope, prefix, record)`，自动处理 try/catch + 空 record removeItem。

### 2.6 消息内容规范化 5+ 处重复

`messageStore.ts:212` `normalizeMessageContent`、`messageStore.ts:179` `normalizeSyncedPayload`、`conversationStore.ts:304` `normalizeMessagePayload`、`ConversationList.vue:233` `parseDigestContent`、`addRealtimeMessage` 与 `addMessage` 各自有 `String(..) || ''` 兜底。

**统一**：在 `messageStore.ts` 顶部新增 `normalizeIncomingMessageContent(raw, opts)`，所有外部输入（realtime、sync、editMessage、addClowderCommandResponse、addRealtimeMessage）都走这一入口，禁止 `msg.content || msg.payload` 散落。

### 2.7 ChannelAvatar 引用 11 处但底层 import 散乱

`ConversationList.vue` `import { ChannelAvatar } from '@tsdaodao/base-vue'`，`MessageInput.vue`、`UserProfileDrawer.vue`、`MyProfileDrawer.vue` 等都重复 import；可统一在 `apps/chat/src/main.ts` 或 `App.vue` 全局注册 `<ChannelAvatar>`，删掉 11 个独立 import。

### 2.8 `ArcoMessage` / `Message` 双名 import

`MessageInput.vue` `import { Message as ArcoMessage }`，`ConversationList.vue`/`UserProfileDrawer.vue`/`MyProfileDrawer.vue` 写 `import { Message }`。同一组件库两种写法。

**统一**：在 `eslint.config.js` 加 `no-restricted-imports` 规则，只允许 `import { Message } from '@arco-design/web-vue'`。

## 3. 发现的功能问题

### 3.1 视图与 store 互相渗透，导致 V3-42 替换面爆炸

- `MessageList.vue:1319` 直接 `messageStore.addMessage` 注入 deployment 卡；
- `MessageList.vue:1350` 注入 deployment summary；
- `MessageInput.vue:838` 注入 project group 确认卡；
- `MessageInput.vue:769` 注入 deployment 确认卡；
- `MessageInput.vue:981` 注入 AI 流式占位。

5 个 store mutation 入口在 2 个组件里被 5+ 处调用。V3-42 阶段 4 用新 `MessageList.vue`（130 行）+ `MessageBubble.vue`（427 行）替换时，**这些 mutation 调用是缺失的**，新 UI 不会自动注入任何卡/气泡。**必须**先把 mutation 入口收拢到 `clowderStore`/`deploymentStore` 这类领域 store，再由 `composables/useClowderDeployment.ts` 等订阅式 hook 自动 inject，组件层不再直接调 `messageStore.addMessage`。

### 3.2 没有 view-model 适配层

V3-42 §4.2 提到"新增 UI adapter 层"，但目前 `datasource-vue` 没有 adapter；现成 store 的字段是 `channel_id / channel_type / unread / last_msg_seq / last_message`，`agenthub_ui` 期望 `id / name / type / unread / lastMessage / isPinned / isMuted / draft`。**目前**没有任何函数把前者映射成后者。

**新增** `packages/datasource-vue/src/adapters/conversationViewModel.ts` 与 `messageViewModel.ts`，定义：

```ts
export interface ConversationViewModel {
 id: string;
 name: string;
 avatar: string;
 isGroup: boolean;
 unread: number;
 isPinned: boolean;
 isMuted: boolean;
 draft: string;
 lastMessage: { text: string; senderName: string; mentionReminder: string; isSystem: boolean; fallbackType: number | null; at: number };
 at: number;
 channelRef: { channelId: string; channelType: number };
 category: 'human' | 'group' | 'clowder-ai' | 'clowder-cat' | 'system';
}
```

`useConversationViewModels()` composable 把 `sortedConversations` 全部转成 VM，**仅暴露 VM 字段**，不暴露 `Conversation`/`Message` 内部结构。V3-42 阶段 3 的新版 `ConversationList.vue` 只消费 VM。

### 3.3 V3-42 阶段 4 缺失"消息视图模型"

新版 `MessageBubble.vue` 期望 `message = { id, senderId, senderName, senderAvatar, type, content, time, status, reactions, replyRef, mentions }`，但 `im_web` 的 `Message` 是 `messageID / clientMsgNo / fromUID / content / timestamp / status / reactions / remoteExtra` 等。**缺 adapter 时 V3-42 阶段 4 必须重写一遍字段映射，组件越界**。

**新增** `packages/datasource-vue/src/adapters/messageViewModel.ts`，定义 `MessageViewModel`（与新版 `MessageBubble.vue` 输入形状一致）+ `useChannelMessageViewModels(channelId, channelType)`。V3-42 阶段 4 替换 `MessageList.vue` 时直接消费。

### 3.4 没有 UI 组件的"按 V3-42 阶段 4 视觉契约"

V3-42 §4.3 列出 8 个子系统（shell、list、chat header、message list、input、contacts、Clowder、files）。V3-42 阶段 4 阶段目标是"图片消息的非空 preview 与 lightbox 必须作为硬性回归"。目前 `MessageList.vue` 用 `ImageCell` 直接渲染，**没有 image lightbox 独立组件、没有 unavailable 占位、没有重试入口**。

**新增** `apps/chat/src/components/MessageImageLightbox.vue`（全局单例，从 EventBus 派发）+ `apps/chat/src/components/MessageImageCell.vue`（替代现有 `@tsdaodao/base-vue` 的 `ImageCell`，保证 V3-41 阶段的非空 preview 回归线）。

### 3.5 旧 V3 阶段遗留的"无外部影响的 HMR 漂移"

V3-41 修 `isRegistered`，但 `MessageInput.vue:60`、`MessageList.vue:86`、`ClowderConversationPanel.vue:49` 各自维护 `typingTimeout / deploymentPollTimer / kickoffRefreshTimer` 等 `setInterval`/`setTimeout` 资源——**组件卸载时清理，但 HMR 重载不清理**。Vite HMR 把 `onBeforeUnmount` 解绑后，新组件重新 `onMounted` 时旧 timer 还在跑，会出现"打开群聊 → HMR 编辑 → 旧轮询仍在调 `clowderStore.fetchThreadTasks`"。

**修复**：在 V3-43 阶段 2 抽出 `useInterval`/`useTimeoutFn` composable（来自 `composables/useTimer.ts`），所有 setInterval 改为 `useInterval`，自动 HMR-safe（`import.meta.hot?.dispose`）。

### 3.6 `dummyChat`/`dummyLogin` 占位文件未清理

`apps/chat/src/views/DummyChat.vue`（14 行）、`DummyLogin.vue`（14 行）只有 `<template><router-view /></template>`，搜索 `DummyChat`/`DummyLogin` 无引用，疑似早期脚手架残留。

**修复**：在 V3-43 阶段 1 直接 `git rm` 删掉，并更新 `apps/chat/src/router/index.ts`（如有引用）。

### 3.7 `apps/chat/src/components/ChatSidePreview.vue.js` 等编译产物泄漏

`apps/chat/src/components/ChatSidePreview.vue.js`、`MyProfileDrawer.vue.js`、`MainLayout.vue.js` 等 `.vue.js` 出现——大概率是 Vite 早期调试产物。检查 `.gitignore` 与 `pnpm clean`，确保不再提交。

### 3.8 `isGroupCatMessage` 误判通道 cat 直聊

`MessageInput.vue:523-527` 把"connectorId === 'im-web' OR catId/catDisplayName 非空" 都判为 group cat。但 **PM 直聊（`channelType === 1`）的猫猫消息也走 'im-web' connector**，被误判为 group cat，影响 `getReplyTargetType` 决定 `targetType` 的准确性。

**修复**：在 `getReplyTargetType` 顶部加 `if (targetType && targetCatId) return targetType;`，并以 `props.channelType === 2` 作为 group cat 的硬性前置。

### 3.9 消息合并 dedup 在 `MessageList.vue` 与 `messageStore.ts` 两处

`MessageList.vue:608-661` `updateProjectGroupConfirmationMessage` 通过 `messageStore.updateMessageStatus` 修改消息内容；`messageStore.ts:1082` 的 `updateMessageStatus` 又做 `for (const key of Object.keys(messages.value)) { .. findIndex by clientMsgNo }`——**O(n×k)**。当存在 50+ 会话、每个会话 100+ 消息时（典型 worker agent 群），每次单条 ack 都全表扫描。V3-42 阶段 4 跑 `npm run build` 与生产 IM 流量下会成为热点。

**修复**：在 `messageStore.ts` 维护 `clientMsgNoIndex: Map<string, {key, index}>`，写消息时更新，`updateMessageStatus` 直接命中。

### 3.10 `isDeploymentCardMessage` / `getProjectGroupConfirmation` 散在 3 处

`MessageList.vue:1307` 判 deployment 卡；`MessageList.vue:537` 解析 project group confirmation；`MessageList.vue:819` 解析 coordination ID。同一元数据 schema 在 3 个函数里重复 `content.metadata || content`。

**修复**：在 V3-43 阶段 4 抽出 `packages/datasource-vue/src/utils/clowderMessageMetadata.ts`，提供 `isDeploymentCardMessage`/`getProjectGroupConfirmation`/`getCoordinationId`/`getProjectGroupHandoff` 单点实现，组件只 import。

## 4. 推荐设计

### 4.1 划分 4 层

```
┌──────────────────────────────────────────┐
│ V3-42 视觉层 (agenthub_ui 样式 + SFC) │
└──────────────────────────────────────────┘
 │ consumes
┌──────────────────────────────────────────┐
│ V3-43 适配层: adapters/*ViewModel.ts │ ← V3-43 阶段 1-2
│ useConversationViewModels │
│ useChannelMessageViewModels │
└──────────────────────────────────────────┘
 │ maps
┌──────────────────────────────────────────┐
│ V3-43 composables: │
│ useClowderDeployment.ts │ ← V3-43 阶段 2-3
│ useProjectGroupConfirm.ts │
│ useCoordinationSummary.ts │
│ useReplyTarget.ts │
│ useImageLightbox.ts │
│ useMentionPicker.ts │
└──────────────────────────────────────────┘
 │ composes
┌──────────────────────────────────────────┐
│ 领域 stores (V3-41 修复后保留): │
│ conversationStore / messageStore │
│ clowderStore / deploymentStore(新) │ ← V3-43 阶段 3
│ channelStore / groupStore / userStore │
└──────────────────────────────────────────┘
```

### 4.2 新建/调整文件

**新建**：
- `packages/datasource-vue/src/utils/channelKey.ts`
- `packages/base-vue/src/utils/messageViewModel.ts`
- `packages/base-vue/src/utils/messageMetadata.ts`
- `packages/datasource-vue/src/utils/conversationDigest.ts`
- `packages/base-vue/src/utils/scopedLocalStorage.ts`
- `packages/datasource-vue/src/composables/useInterval.ts`
- `packages/datasource-vue/src/composables/useTimeoutFn.ts`
- `packages/datasource-vue/src/stores/deploymentStore.ts`（从 `MessageList.vue` / `MessageInput.vue` 抽出）
- `packages/datasource-vue/src/stores/projectGroupStore.ts`（同上）
- `packages/datasource-vue/src/adapters/conversationViewModel.ts`
- `packages/datasource-vue/src/adapters/messageViewModel.ts`
- `apps/chat/src/components/MessageImageLightbox.vue`
- `apps/chat/src/components/MessageImageCell.vue`（替代 base-vue 旧 ImageCell）
- `apps/chat/src/views/_shared/ProfileDrawerShell.vue`
- `apps/chat/src/composables/useProfileDrawerForm.ts`

**调整**：
- `messageStore.ts` 拆 5 个 mutation 到 `deploymentStore`/`projectGroupStore`/`clowderStore`
- `MessageList.vue` 218 → 期望 < 800 行（去 deployment 轮询 + project group + coordinator + 定位）
- `MessageInput.vue` 1943 → 期望 < 1100 行（去 deployment 卡注入 + project group 卡注入 + AI 流式占位 + 协调者命令面板）
- `ClowderConversationPanel.vue` 1049 → 期望 < 700 行（去 kickoff polling，提到 `clowderStore.startKickoffPolling()`）
- `MyProfileDrawer.vue` 567 → 期望 < 250 行
- `UserProfileDrawer.vue` 349 → 期望 < 250 行
- `ConversationList.vue` 701 → 期望 < 350 行（去 digest helper）
- 删 `DummyChat.vue`、`DummyLogin.vue`、所有 `.vue.js` 泄漏

### 4.3 不动 V3-42 阶段 1-8 视觉替换面

仅做：① 数据/视图模型边界 ② composable 化 ③ 领域 store 拆分 ④ 重复 helper 合并。**不**重写 `agenthub_ui` 视觉迁移计划。V3-42 阶段 4 在本计划 V3-43-2 之后才进，能直接消费 `MessageViewModel` 与 `MessageImageCell`/`MessageImageLightbox`。

## 5. 分阶段实施计划

### 阶段 1：清废与基础设施

目标：

- `git rm` 掉 `DummyChat.vue`/`DummyLogin.vue` 与所有 `*.vue.js` 编译产物，更新 `.gitignore`。
- 新建 `channelKey.ts`、`scopedLocalStorage.ts`、`messageViewModel.ts`、`messageMetadata.ts`、`conversationDigest.ts` 单一实现。
- `messageStore` / `conversationStore` / `clowderStore` 切到统一 `channelKey`，`ConversationList.vue`/`MessageList.vue`/`MessageInput.vue` 切到统一 helper。
- 加 `useInterval` / `useTimeoutFn` composable，`MessageList.vue`/`MessageInput.vue`/`ClowderConversationPanel.vue` 全部 setInterval/setTimeout 改用 composable。
- 加 ESLint `no-restricted-imports` 收敛 `Message as ArcoMessage` 双名 import。
- 跑 `pnpm type-check` / `pnpm test:unit` 全绿。

阶段完成必须中文 commit，例如：

```text
V3-43 阶段1：清废 + 通用 helper 单一化 + composable 化
```

### 阶段 2：抽 composable + 领域 store 拆分

目标：

- `MessageList.vue` 内的 deployment polling/project group card/coordinator summary/locate message/digest 等"业务级"逻辑全部抽到 `packages/datasource-vue/src/composables/`：
 - `useClowderDeployment.ts`
 - `useProjectGroupConfirm.ts`
 - `useCoordinationSummary.ts`
- `MessageInput.vue` 内的 deployment card inject / project group card inject / AI streaming placeholder / mention picker 抽到 composable + `deploymentStore` / `projectGroupStore`。
- 新建 `packages/datasource-vue/src/stores/deploymentStore.ts`（从 `clowderStore` 拆出 deploymentRequest 状态 + 轮询）。
- 新建 `packages/datasource-vue/src/stores/projectGroupStore.ts`（拆 project group binding + confirmation 状态）。
- 目标行数：`MessageList.vue` ≤ 800，`MessageInput.vue` ≤ 1100，`ClowderConversationPanel.vue` ≤ 700。
- 单测覆盖 `deploymentStore` 早 return / dedup / lifecycle。

阶段完成必须中文 commit，例如：

```text
V3-43 阶段2：composable 化 + deploymentStore / projectGroupStore 拆分
```

### 阶段 3：view-model 适配层

目标：

- 新建 `packages/datasource-vue/src/adapters/conversationViewModel.ts`（`ConversationViewModel` + `useConversationViewModels`）。
- 新建 `packages/datasource-vue/src/adapters/messageViewModel.ts`（`MessageViewModel` + `useChannelMessageViewModels`）。
- 新建 `apps/chat/src/components/MessageImageCell.vue`（独立组件，承接 V3-41 image 非空 preview 回归）。
- 新建 `apps/chat/src/components/MessageImageLightbox.vue`（EventBus 派发，全局单例）。
- `ConversationList.vue` 切到 `useConversationViewModels`，组件内不再读 `conversationStore` 的 `Conversation` 字段。
- `MessageList.vue` 切到 `useChannelMessageViewModels`，组件内不再读 `messageStore` 的 `Message` 字段。
- 加 adapter 单测：把 fixture conversation/message 转 VM，断言字段映射正确（含 clowder-ai、clowder-cat、revoked、project group confirmation、deployment card）。

阶段完成必须中文 commit，例如：

```text
V3-43 阶段3：view-model 适配层与图片组件化
```

### 阶段 4：ProfileDrawer 合并 + 修复功能问题

目标：

- 新建 `apps/chat/src/views/_shared/ProfileDrawerShell.vue` 与 `useProfileDrawerForm.ts`。
- `MyProfileDrawer.vue` ≤ 250 行，只保留：保存头像/昵称、通知设置、二维码。
- `UserProfileDrawer.vue` ≤ 250 行，只保留：发消息、加好友、拉黑、举报、共享资料。
- 修 3.8：`getReplyTargetType` 加 `channelType === 2` 前置。
- 修 3.9：`messageStore.updateMessageStatus` 加 `clientMsgNoIndex`。
- 修 3.10：`isDeploymentCardMessage`/`getProjectGroupConfirmation` 移到 `messageMetadata.ts`。
- 跑 `pnpm test:unit` + `pnpm type-check`。

阶段完成必须中文 commit，例如：

```text
V3-43 阶段4：ProfileDrawer shell 化与功能问题修复
```

### 阶段 5：自动化回归与真实 Web 验收

目标：

- `pnpm test:unit` / `pnpm type-check` / `pnpm build` 全绿。
- 现有 Playwright `smoke-*.spec.ts` 通过。
- 新增 `tests-e2e/smoke-v3-43-adapters.spec.ts`：登录 → 打开 P2P 与群 → 断言新版 VM 字段都被填值（unread/draft/pinned/muted/last message）→ 切到 Clowder cat 直聊 → 断言 category 字段为 'clowder-cat'。
- 真实 Web：从 `seedcmp` 根 `bash scripts/start-im-clowder.sh start`，双窗口/三窗口/群聊/撤回/typing/unread clear/项目群卡/部署卡/AI 流式 全部即时生效；保存截图、ids、WS 帧日志到 `sections/im_web/.ai/V3.0/tests-e2e/v3-43-<timestamp>/`。
- V3-41 验收脚本（实时同步 3 秒内）继续通过。
- V3-42 阶段 1-3 已经验收过的视觉/动线不被本计划破坏（比对 git diff base 与 head 的 `apps/chat/src/views/ConversationList.vue` 等的视觉/行为）。

阶段完成必须中文 commit，例如：

```text
V3-43 阶段5：view-model 与 composable 真实 Web 验收完成
```

## 6. 测试与验收清单

- Unit/component：
 - `channelKey.ts` 单测：`getChannelKey`/`parseChannelKey` 边界
 - `messageViewModel.ts` 单测：payload 解析顺序、catId/cat_id 双名归一化
 - `messageMetadata.ts` 单测：deployment card / project group confirmation / coordination
 - `deploymentStore` 单测：polling 启停、lifecycle、cancel idempotent
 - `projectGroupStore` 单测：confirm/cancel 状态机
 - `useConversationViewModels` 单测：unread/pinned/muted/draft/category
 - `useChannelMessageViewModels` 单测：type/revoked/Clowder/AI 流式
 - `MessageImageCell` 单测：unavailable 占位/重试入口
- E2E：
 - 双窗口实时同步（V3-41 已建，V3-43 跑一遍不回归）
 - cat 实时回包（V3-41 已建）
 - V3-43 新增：adapter 字段断言、image non-empty preview
- Live：
 - `bash scripts/start-im-clowder.sh start`
 - 双窗口/三窗口/群聊/撤回/typing/unread clear
 - 真实 OAuth 猫猫，Claude Code 优先
 - 保存 evidence、ids、runtime choice、OAuth status

## 7. 风险与回滚

- **风险：composable 抽离打破 MessageList 现有行为。** 回滚：每阶段小步提交；保留旧组件入口或 feature flag。
- **风险：adapter 字段映射漏字段，V3-42 视觉替换后丢 unread/last message。** 处理：单测用真实 fixture 跑全字段；V3-42 阶段 1-3 已落地的视觉特性继续回归。
- **风险：deploymentStore/projectGroupStore 拆分破坏 V3-41 实时同步根因。** 处理：保持 `addMessage`/`addRealtimeMessage` 行为不变；新 store 内部仍走原 `messageStore.addMessage`，不在 V3-43 阶段 2 改 dedup。
- **风险：HMR 漂移修复与 V3-41 阶段 2 重叠。** 处理：V3-43 仅改 setInterval 资源清理，不动 `isRegistered`；与 V3-41 阶段 2 不冲突。
- **风险：组件行数压缩后新功能失去位置。** 处理：目标行数是软约束（"期望 ≤ X"），不强制；只强制"原 store mutation 调用不再出现在组件内"。

## 8. 完成定义

V3-43 只有同时满足以下条件才算完成：

- 重复 helper（channelKey、messageViewModel、messageMetadata、conversationDigest、scopedLocalStorage、profile drawer shell）有单一实现 + 单测 + 所有调用点切换。
- 5 个 store mutation 入口（deployment / project group / AI streaming / coordinator / kickoff）从组件中抽出，组件不再直接调 `messageStore.addMessage` 注入业务卡。
- 新增 `ConversationViewModel` / `MessageViewModel` adapter + composable + 单测；V3-42 阶段 3、4、5、7 的视觉替换可直接消费。
- `MessageList.vue` / `MessageInput.vue` / `ClowderConversationPanel.vue` / `ConversationList.vue` / `MyProfileDrawer.vue` / `UserProfileDrawer.vue` 全部达到目标行数（软约束）。
- 3.8/3.9/3.10 三个功能问题已修。
- `DummyChat.vue` / `DummyLogin.vue` / `*.vue.js` 编译产物已删。
- `pnpm test:unit` / `pnpm type-check` / `pnpm build` 通过；现有 Playwright 全部 spec 通过。
- 真实 Web（localhost:3000）双窗口/三窗口/群聊/撤回/typing/unread clear/项目群卡/部署卡/AI 流式 全部即时生效；截图/WS 帧/ids 证据完整。
- 每个阶段都有对应中文 commit。
- V3-41 / V3-42 已验收过的行为不被本计划破坏（git diff 跑 V3-41/V3-42 验收脚本全部通过）。
