# V3-41 计划：修复 IM Web 实时消息同步——新消息到达时 UI 不刷新，必须手动刷新页面才能看到

## 0. 强制执行门禁

本计划执行时必须遵守以下硬性要求：

1. **阶段提交**：每完成一个阶段的实现、测试修复或文档补充，必须立即做一次中文 commit。不要把多个阶段堆到最后一起提交。
2. **本地服务启动**：最终验收前必须在 `seedcmp` 根目录执行：

 ```bash
 bash scripts/start-im-clowder.sh start
 ```

3. **真实 Web 验收**：必须打开 `http://localhost:3000` 进入 IM Web 做真实操作，不允许只依赖单元测试、接口 mock 或脚本伪造。
4. **账号可自理**：可以使用已有测试用户登录，也可以主动创建新用户；验收记录中要写清楚使用的用户 id、发送方/接收方 uid、会话 channel_id/channel_type、消息 client_msg_no、message_seq。
5. **真实多端/多窗口**：为复现"实时同步"必须开两个浏览器窗口（同一账号两端 + 不同账号一端）并真实发送消息。
6. **真实猫猫调用**：必须在 Web 端真实创建或选择 Clowder cat，选择 OAuth 登录方式。
7. **运行平台优先级**：创建/选择猫猫时运行平台优先 `Claude Code`；如果本机能力或 OAuth 配置不可用，再降级为 `Codex`，并在验收记录中写明原因。
8. **证据留存**：浏览器验收要保存截图、关键 WS 帧日志、用户/会话/消息 id、运行平台、OAuth 状态和失败诊断，建议放在 `sections/im_web/.ai/V3.0/tests-e2e/v3-41-<timestamp>/`。

## 1. 问题现象

在 IM Web V3.0 部署（`bash scripts/start-im-clowder.sh start` + `http://localhost:3000`）下出现以下用户可观察现象：

- 用户 A 与用户 B/C/D 或 Clowder cat 在某会话中聊天，A 当前停在 `ChatView`（消息详情页）。
- B/C/D 或 cat 真实发出新消息（不是 A 自己发的——A 自己的消息正常显示）。
- **A 视图里的 `MessageList` 不刷新、不滚动、不出红点、不更新 conversation 摘要**——看起来这条消息没到。
- A 离开再回到该会话（路由重进），或在浏览器里手动 F5 刷新——**新消息立刻出现**。
- 这意味着：**WKSDK 真实收到了消息，store 真实落到了 `messages.value[key]`，但 UI 没有 reactive 更新**；或者**WS 根本没收到消息，需要 syncMessages 主动拉取**。

当前用户报告的影响面：

- 群聊、Clowder 项目群、PM 协调群的实时协同断裂——worker agent 的输出看不到，必须手动刷新。
- 群成员输入状态（typing）、撤回、reaction、unread clear 等依赖 listener 的能力都不可信。
- 单元测试和 mock 都不能复现，**必须真实双窗口/双设备联调**才能验证。

## 2. 根因假设（按可疑度排序）

下列假设是结合 `packages/datasource-vue/src/stores/sdk.ts`、`cmd/index.ts`、`messageStore.ts` 与 `apps/chat/src/views/ChatView.vue` 的真实代码读出来的，需要在阶段 1 用真实流量验证：

1. **H-1 怀疑度 高：`isRegistered` 模块级闭包 + WKSDK 单例导致 listener 漂移**。
 - `sdk.ts` 中 `let isRegistered = false` 是模块闭包变量（line 87），Vite HMR 重载 `sdk.ts` 后这个变量重置为 false，但 `WKSDK.shared()` 是 SDK 内部单例，**旧 listener 仍注册在 chatManager 上**。
 - 后果：HMR 后新 `initializeSDK` 又注册一份 listener，新旧并存；旧 listener 闭包里的 `useMessageStore` 拿的是**旧 store 实例**（HMR 后 Pinia store 也会重建），写入的消息进旧 store，UI 用的是新 store，**看起来消息"消失了"**——但 F5 后单实例重新加载，listener 重新注册一份，链路正常。
 - 这也解释了为什么"刷新就好了"。

2. **H-2 怀疑度 高：`runRecoverySync` 在 connect 成功时同步重置 `recoveryState`，但 listener 写入早于或绕开它**。
 - `runRecoverySync` 只在 `ConnectStatus.Connected` 时调一次（line 137）。如果 listener 在 Connected 之前已经被某次 `reconnect` 提前注册（例如断线重连中收到消息），recovery state 是 `idle`，但消息仍会走 `addRealtimeMessage`——这条不是 bug，但说明状态机和 listener 时序不严密。

3. **H-3 怀疑度 中：`if (message.header?.noPersist) return;` 静默丢弃**。
 - `cmd/index.ts:174`。如果 Clowder cat 走 cat-direct 通道的消息被某种 sync 链路打了 `noPersist=true`，listener 直接 return，**store 完全不知道消息来过**——必须靠 `syncMessages` 在下次进入会话时拉到历史。
 - 这和"刷新后才看到"现象高度一致，但需要阶段 1 用真实流量验证 header 是否被设置。

4. **H-4 怀疑度 中：`if (isOwnMessage) return;` 在多设备场景误伤**。
 - `cmd/index.ts:199`。同一账号在 A 端登录，B 端发的消息到达 A 端时 `fromUID === currentUid`，**listener 跳过**——靠 `syncMessages` on reconnect 拉取多端消息（line 198 注释明确说"Multi-device sync is handled by syncMessages on reconnect"）。
 - **如果 A 端一直没断线**，B 端发的消息永远走不到 A 端的 `MessageList`——只能等 A 切会话/收 push/触发 reconnect 才会 sync。
 - 这是真实的协议设计 gap：单端长连时多设备消息不能实时同步。

5. **H-5 怀疑度 中：`addRealtimeMessage` → `addMessage` 内部 dedup/merge 命中了错误的 idx**。
 - `messageStore.ts:1012-1036` 的 dedup 逻辑按 `clientMsgNo` 优先、`messageID` 次之。`addRealtimeMessage` 把 `rawMessage.clientMsgNo` 强制 `String(..)`，**但若后端发来的 `clientMsgNo` 为空串**（注释里说"Backend robot messages may have an empty client_msg_no"），且空串在前一轮 cat 推送中已经被 dedup 注册过，新消息会被错误合并到历史项上，**视觉上没新增**。
 - 阶段 1 需验证 cat 消息的 `clientMsgNo` 实际值。

6. **H-6 怀疑度 中：`MessageList.vue` 的 `messages` computed 在 `channelKey` 切换/初次访问时拿到 stale 引用**。
 - `MessageList.vue:141-143` 的 `computed(() => messageStore.messages[channelKey.value] || [])`。
 - Vue 3 ref deep reactive 理论上是 OK 的（`ref<Record>` push 会触发 trigger）。**但**：`ChatView.vue:104` 的 `onMounted → loadChannelDetails → syncMessages` 链路里，`syncMessages` 走 `messages.value[key] = nextList`（messageStore.ts:842）**整体替换** array 引用——若 `addRealtimeMessage` 在 syncMessages 完成前已经 push 到了**新 list 之外的旧 list 引用**，会出现"消息到了但 UI 不显示"——阶段 1 需用 console trace 确认 listener 调用时 `messages.value[key]` 的引用。
 - 实际上 line 999 `const list = messages.value[key]` 是从 reactive 对象上**重新读**的，所以这个怀疑被代码本身化解了——保留为低优先级。

7. **H-7 怀疑度 低：WS 协议/订阅协议（topic / channel）不正确**。
 - WKSDK 内部 `WKWebsocket.onmessage` 收到帧后 decode → 派发到 `chatManager.addMessageListener`（cjs.js:1065-1083, 3239）。如果某条消息因为 `channelId` 在 SDK 内部 map 里查不到对应 channel 对象、decode 抛出被 try/catch 吞掉，listener 永远不触发。
 - 阶段 1 需在浏览器打开 `localStorage` 的 `wukongimjssdk` 内部状态或加 WS 帧日志验证。

8. **H-8 怀疑度 低：竞态——`addMessage` 内部 `applyClowderHistoryRecovery` 修改 list 后 sort 顺序变化**。
 - `messageStore.ts:1040` 的 `applyClowderHistoryRecovery` + line 1039 的 `sortMessagesForChannel` 会原地修改 list。
 - 排序后 push 的新消息如果 messageSeq 异常小/大，可能被 sort 推到顶部并触发 UI 抖动，**用户感觉"消息没刷新"是因为滚到了不可见位置**。需要 stage 1 排查。

## 3. 影响模块

- `sections/im_web/packages/datasource-vue/src/stores/sdk.ts`（listener 注册、isRegistered flag、reconnect 流程）
- `sections/im_web/packages/datasource-vue/src/cmd/index.ts`（`registerMessageListeners` 内部 isOwnMessage 跳过、noPersist 跳过）
- `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`（`addMessage` dedup、`addRealtimeMessage`、`applyClowderHistoryRecovery`、`sortMessagesForChannel`）
- `sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts`（conversation 摘要更新、unread clear）
- `sections/im_web/apps/chat/src/views/ChatView.vue`（`loadChannelDetails`、`scheduleVisibleHistoryRefresh`、`watch(messages.length)`）
- `sections/im_web/apps/chat/src/components/MessageList.vue`（`messages` computed、`renderableMessages` 过滤）
- `sections/im_web/apps/chat/src/components/MessageInput.vue`（typing、mention、reply 联动）
- 视觉参考源：`sections/agenthub_ui/components/chat/MessageList.vue`、`MessageBubble.vue`（迁移 V3-42 期间不修改本计划根因）
- 验证脚本：`sections/im_web/apps/chat/tests-e2e/smoke-*.spec.ts`

## 4. 推荐设计

### 4.1 不重写，定位 + 最小化修复

本计划的根因是 listener → store → computed 链路在特定时序下断链。**不**做大规模重构，**不**改 V3-42 的视觉替换范围，**不**动 WKSDK 单例协议。目标是：

- 把 listener 注册和 store 生命周期解耦到 **HMR-safe** 状态。
- 让 `addRealtimeMessage` 的所有早 return 路径（noPersist、isOwnMessage、channel 缺失）都有**结构化日志**，能真实看到丢弃原因。
- 让多设备消息（`fromUID === currentUid`）在**单端长连场景**也能实时到达（不是只靠 reconnect 拉取）。
- 在 `MessageList` 的 `messages` computed 上加一道 `triggerRef` 兜底，确保极端时序下也能重渲染。

### 4.2 增加 WS/Listener 观测

在 `registerMessageListeners` 与 `addRealtimeMessage` 之间加一层观测中间件：

- 收到 message → 记录：原始 `clientMsgNo`、`messageID`、`fromUID`、`channel`、`header.noPersist`、`header.redot`、`isOwnMessage` 计算结果、被哪个分支 return、最终是否调用 `addMessage`。
- 这些日志**只在 dev / `?diag=1` 开关打开时输出**，避免污染生产。
- 配合 `tests-e2e/smoke-real-time-sync.spec.ts`（新写）跑真实双窗口，断言"接收窗口在 X 秒内出现新消息"。

### 4.3 修复 isRegistered 漂移（H-1）

把 `isRegistered` 从模块级闭包变量改为 `WKSDK.shared()` 单例上的属性（或者一个 module-level WeakRef / Symbol-keyed map），并在 listener 注册时**先反注册**同标识的旧 listener，HMR 后保证单实例最多一份。

同时给 `initializeSDK` 加上"已注册过同 (uid, token) 仍然强制重注册"的可选参数，用于登录态切换场景（避免 H-2 早 return 路径吞掉新连接）。

### 4.4 修复多设备实时同步（H-4）

在 `addRealtimeMessage` 之前的 listener 里：

- `isOwnMessage` 不直接 return，而是走"自己别的设备发的消息"分支——把它当作普通消息 push 到 store，**只是不重复触发 `clearUnread`**（当前 clearUnread 已经按 `isViewingChannel` 守卫）。
- 区分"自己当前 tab 刚发出去的"和"自己别的设备发的"——前者靠 `pendingQueue` 的 `clientMsgNo` 命中（已经有机制），后者按 `isOwnMessage` 但 `!pendingClientMsgNo.has(..)` 处理。
- 这条改动需要在 stage 1 验证 cat 消息 / 同步消息的 fromUID 实际值。

### 4.5 修复 noPersist 静默丢弃（H-3）

- 不去掉 noPersist 早 return，但把所有早 return 路径加上 `[MSG_DROP]` 结构化日志，包含 `reason` 字段。
- 排查 Clowder cat 通道是否真的被打 noPersist：写一个临时 instrumentation 计数过去 5 分钟的 `[MSG_DROP]` 比例。
- 若确认 cat 消息被错误打 noPersist，定位到上游发送链路修复；否则只保留日志。

### 4.6 computed 兜底

- `MessageList.vue` 的 `messages` computed 改为：

 ```ts
 const messagesRef = computed({
 get: () => messageStore.messages[channelKey.value] || [],
 set: (next) => { messageStore.messages[channelKey.value] = next; }
 });
 ```

 实质上加 `triggerRef` fallback：当外部代码 `messageStore.replaceChannelMessages(key, list)` 整体替换时，显式触发 trigger——避免深嵌套 array 在边缘场景不触发。
- 配合 `messageStore.ts` 的 `mergeSyncedMessages`、`addMessage` 内部所有"替换"路径，加 `triggerRef(messages)` 兜底。

### 4.7 测试与可观测产物

- 新增 `sections/im_web/apps/chat/tests-e2e/smoke-real-time-sync.spec.ts`：双 context（两个独立 browser context 登录同一账号），A 端发消息，断言 B 端在 3 秒内 MessageList 出现新条目。
- 新增 `tests-e2e/smoke-cat-realtime-sync.spec.ts`：登录用户 + 创建 Clowder cat（Claude Code 优先），向 cat 发文本，cat 真实回包，断言用户端不刷新也能看到 cat 回复。
- 单元测试覆盖 `addMessage` 的所有早 return / dedup 分支、`applyClowderHistoryRecovery` 的 sort 行为。

## 5. 分阶段实施计划

### 阶段 1：可观测与根因定位

目标：

- 在 listener、addRealtimeMessage、addMessage、mergeSyncedMessages 全链路加 `[MSG_DROP]` / `[MSG_ARRIVE]` 结构化日志，**仅 dev 或 `?diag=1` 时输出**。
- 在 `addRealtimeMessage` 与 `addMessage` 之间加一个 probe：记录每次调用前后的 `messages.value[key]?.length`、`lastMessage.clientMsgNo`。
- 跑真实双窗口流量：开两个浏览器 context，登录同一账号，A 端发，B 端监听 60 秒；记录每条新消息的：是否到达 listener、是否进 addRealtimeMessage、是否进 addMessage、最终 MessageList 是否更新。
- 跑真实 cat 流量：开一个用户 context、一个 Clowder cat context（Claude Code 优先），用户向 cat 发消息，cat 真实回包，统计"用户看到 cat 回复"的时延与是否需要刷新。
- 输出一份 `V3-41-rootcause.md`，从 H-1 ~ H-8 中圈定真实命中项。

阶段完成后必须中文 commit，例如：

```text
V3-41 阶段1：消息实时同步可观测与根因定位
```

### 阶段 2：修复 listener 漂移与生命周期（H-1, H-2）

目标：

- 把 `isRegistered` 从模块闭包变量迁到 `WKSDK.shared()` 内部属性或 module Symbol-keyed map。
- 在 `registerCMDListeners`、`registerMessageListeners` 内部**先反注册同标识 listener** 再注册新 listener（HMR-safe）。
- 给 `initializeSDK` 增加 `force: boolean` 选项，登录态切换场景强制重连。
- 给 `runRecoverySync` 加上幂等保护（`recoveryState === 'syncing'` 时不重复执行）。
- 单元测试覆盖：重复 `initializeSDK` 不会留下多份 listener；HMR-like 重新 import 不会导致重复触发。

阶段完成后必须中文 commit，例如：

```text
V3-41 阶段2：listener HMR 漂移与重连幂等修复
```

### 阶段 3：修复多端实时同步与早 return 日志（H-3, H-4）

目标：

- `registerMessageListeners` 中 `isOwnMessage` 分支改为"区分本端/他端"，他端消息走正常 addRealtimeMessage，仅本端消息跳过（避免重复）。
- 保留 `pendingQueue` 命中机制：本端刚发的消息由 sendMessage 自己在 ack 路径合并。
- 给所有早 return 路径（noPersist、isOwnMessage、channel 缺失）加 `[MSG_DROP]` 日志。
- 单元测试覆盖：他端消息会进 store；本端消息不进 listener；noPersist 消息被记录但被丢弃。

阶段完成后必须中文 commit，例如：

```text
V3-41 阶段3：多端实时同步与早 return 观测
```

### 阶段 4：computed 兜底与 dedup 强化（H-5, H-6）

目标：

- `MessageList.vue` 的 `messages` computed 增加 `triggerRef` 兜底。
- `messageStore.ts` 的 `mergeSyncedMessages`、`addMessage` 内部所有"替换 list 引用"路径加 `triggerRef(messages)`。
- `addMessage` dedup 增加"空 clientMsgNo 强制走 push"分支（不参与去重），并对 cat 消息的 `clientMsgNo` 来源做规范化（`String(rawMessage.clientMsgNo || '')` 在 cat 消息的源里要稳定）。
- 单元测试覆盖：list 整体替换触发 computed 重算；空 clientMsgNo 消息不被错误合并。

阶段完成后必须中文 commit，例如：

```text
V3-41 阶段4：computed 兜底与 dedup 强化
```

### 阶段 5：自动化回归与真实 Web 验收

目标：

- 单元测试全部通过：`pnpm test:unit`。
- 类型检查通过：`pnpm type-check`。
- 构建通过：`pnpm build`。
- Playwright 通过：双 context 实时同步、cat 实时回包、刷新后无新消息、UI 滚动与红点联动。
- 真实 Web 验收：从 `seedcmp` 根目录执行 `bash scripts/start-im-clowder.sh start`，打开 `http://localhost:3000` 做以下真实验收：
 1. 登录或创建测试用户 A、B、Clowder cat（Claude Code 优先）。
 2. 双窗口：A 与 B 互发文本/图片/文件，A 端不刷新，B 发的内容在 ≤3 秒内出现在 A 端 MessageList 与 conversation 摘要。
 3. Cat 实时回包：用户向 cat 发任务，cat 真实回包，用户端不刷新即可看到。
 4. 群聊实时同步：三人以上群聊，任一成员发消息，其他成员 ≤3 秒内可见。
 5. 撤回、reaction、typing、unread clear 在不刷新场景下即时生效。
 6. 保存截图、WS 帧日志、用户/消息 id 到 `sections/im_web/.ai/V3.0/tests-e2e/v3-41-<timestamp>/`。

阶段完成后必须中文 commit，例如：

```text
V3-41 阶段5：实时同步真实 Web 验收完成
```

## 6. 测试与验收清单

- Unit/component：
 - listener 注册幂等（重复调用不留下多份回调）；
 - `addMessage` 早 return 与 dedup 命中（clientMsgNo、messageID、空串）分支；
 - `applyClowderHistoryRecovery` + `sortMessagesForChannel` 排序后消息可见性；
 - computed `triggerRef` 兜底（list 整体替换触发重算）；
 - `runRecoverySync` 幂等。
- E2E：
 - 双 context 实时同步（≤3 秒）；
 - cat 实时回包不依赖刷新；
 - 群聊多端实时同步；
 - 撤回/reaction/typing/unread clear 即时生效；
 - V3-42 阶段 4 视觉替换后的图片非空 preview 不退化。
- Live：
 - `bash scripts/start-im-clowder.sh start` + `http://localhost:3000`；
 - 真实用户、真实 OAuth 猫猫、Claude Code 优先；
 - 保存 evidence、ids、runtime choice、OAuth status、WS 帧日志。

## 7. 风险与回滚

- **风险：listener 反注册改动导致现网消息丢失。** 回滚：每阶段小步提交；保留旧注册路径 feature flag。
- **风险：多端实时同步打破本端去重，可能短暂出现重复气泡。** 处理：保留 `pendingQueue` 命中合并 + ack 路径合并；E2E 验证两窗口会话中本端连发 5 条无重复。
- **风险：computed 兜底引入性能回归。** 处理：`triggerRef` 仅在 list 整体替换时调用，不影响常规 push。
- **风险：阶段 1 根因命中多条互相干扰。** 处理：阶段 1 必须输出可观测报告，圈定优先级后再进阶段 2/3/4；不并行改动。
- **风险：V3-42 视觉替换与 V3-41 修复并行，互相污染。** 处理：V3-41 不动 V3-42 阶段范围；V3-42 阶段 4 跑完后，V3-41 验收再合入。

## 8. 完成定义

V3-41 只有同时满足以下条件才算完成：

- `tests-e2e/smoke-real-time-sync.spec.ts` 与 `tests-e2e/smoke-cat-realtime-sync.spec.ts` 通过，断言"接收端 ≤3 秒内 MessageList 出现新消息"。
- 真实 Web 双窗口/三窗口/群聊场景下，新消息到达时 `MessageList` 与 conversation 摘要即时刷新，**不依赖 F5 刷新**。
- 所有 listener 早 return 路径都有结构化日志，dev/`?diag=1` 下可观测。
- H-1 ~ H-8 中由阶段 1 圈定的真实命中项已被对应阶段修复。
- `pnpm test:unit`、`pnpm type-check`、`pnpm build` 通过，Playwright 全部 spec 通过。
- localhost:3000 真实 Web 验收通过：真实用户、真实 OAuth 猫猫、Claude Code 优先、双窗口/群聊/撤回/reaction/typing/unread clear 全部即时生效；截图、WS 帧日志、用户/消息 id 证据完整。
- 每个阶段都有对应中文 commit。
