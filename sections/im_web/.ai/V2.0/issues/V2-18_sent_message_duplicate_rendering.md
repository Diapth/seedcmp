# [V2-18] 发送任意消息后发送方 UI 显示两条内容

**状态**：Resolved
**创建时间**：2026-05-25
**标签**：bug / message-store / message-ui / media / regression
**优先级**：P0

---

## 问题描述

用户反馈：不论发送文本、图片还是文件，消息发送出去后都会在当前聊天 UI 上显示两条内容。截图中右侧发送方连续出现两条相同文本气泡，说明至少文本发送链路存在重复渲染；用户说明图片和文件发送也有同类问题。

该问题会直接破坏聊天记录可信度，并且容易与 V2-16“文件名被渲染成独立文本消息”混淆。V2-18 关注的是同一次发送在 UI 中出现两条消息内容，覆盖所有消息类型。

截图证据：用户于 2026-05-25 在本对话中提供浏览器截图，页面地址为 `http://100.79.157.76:3000/chat/conversation/989ec1fc79664ede9ff9008831d76337/1`，底部可见连续两条相同蓝色发送方文本气泡。

---

## 复现步骤

1. 打开 `http://100.79.157.76:3000` 并登录。
2. 进入任意单聊或群聊会话。
3. 发送一条普通文本消息。
4. 观察当前发送方聊天区域。
5. 继续分别发送一张图片和一个普通文件。
6. 观察图片和文件消息在当前发送方聊天区域的展示数量。

---

## 预期表现

1. 每次用户触发发送后，当前发送方 UI 只出现一条对应消息。
2. 本地 pending 消息和 SDK / 服务端回显消息应按 `clientMsgNo`、`messageID`、`messageSeq` 或稳定本地 ID 合并为同一条。
3. 图片和文件消息发送完成后只更新状态、服务端 ID、URL 等元数据，不应额外生成第二条消息卡片或文本气泡。
4. 刷新会话或重新进入会话后，历史消息中也不应持久化重复内容。

---

## 实际表现

1. 文本消息发送后，当前发送方 UI 出现两条相同或近似相同的蓝色消息气泡。
2. 用户反馈图片、文本、文件三类消息均会重复显示。
3. 截图中最新两条右侧文本气泡内容相同，表现为同一次发送被渲染成两条聊天内容。

---

## 相关代码

待排查重点：

```
sections/im_web/apps/chat/src/components/MessageInput.vue
sections/im_web/apps/chat/src/components/MessageList.vue
sections/im_web/packages/datasource-vue/src/stores/messageStore.ts
sections/im_web/packages/datasource-vue/src/sdk/
sections/im_web/packages/base-vue/src/components/messages/
```

重点关注：

1. `MessageInput.vue` 中 Enter、点击发送按钮、组合输入法、上传回调是否重复触发发送。
2. `messageStore` 中本地乐观消息、`sendTextMessage()` / `sendMediaMessage()` 成功回包、`addRealtimeMessage()` 是否写入同一数组两次。
3. SDK 回显消息与本地 pending 消息是否缺少稳定去重键，尤其是 `clientMsgNo` 为空、变化或类型不一致时。
4. `MessageList.vue` 渲染 key 是否稳定，是否因为 key 冲突或 key 变化导致同一消息被重复保留。
5. 会话历史同步、实时监听、发送成功回调是否同时把发送方自己的消息追加到 store。

---

## 根因分析

根因为发送方本地 pending 消息、SDK send 成功回包、SDK realtime listener 回显之间没有形成稳定的单条消息合并链路：

1. 发送文本、图片、文件时，store 会先追加一条本地 pending 消息。
2. SDK `chatManager.send()` 成功后，旧运行时逻辑把 SDK 返回的消息再交给 `addRealtimeMessage()`，形成第二次追加。
3. SDK listener 还可能再次收到同一条自己发出的消息；如果 `currentUser.uid` 与 `message.fromUID` 一个是数字、一个是字符串，旧逻辑严格相等判断失败，会把自己的回显当成新消息加入。
4. 同目录存在 `.ts` 与 `.js` 运行时文件，Vite 当前通过 extensionless export 加载 `.js`，所以只修 TS 会导致单元测试通过但浏览器仍重复。

修复后，发送成功只更新本地 pending 消息的 `messageID`、`messageSeq`、状态和媒体 URL；自己发出的 realtime 回显在 listener 层跳过；同步历史时再按 `messageID` 合并服务端 `clientMsgNo` 与本地 `clientMsgNo` 不一致的同一条消息。

---

## 问题列表（Q&A 迭代）

### Q1: 这个问题是否等同于 V2-16？
**A1**: 不是。V2-16 是文件消息被 SDK 文件名文本摘要覆盖，表现为文件卡片之外出现文件名文本。本问题是所有发送类型都可能出现两条内容，重点是发送链路和回显合并去重。

### Q2: 是否只影响发送方 UI？
**A2**: 当前截图证据显示发送方 UI 重复；接收方是否也重复、刷新后是否仍重复、后端是否持久化两条消息，需要后续验证。

### Q3: 优先级为什么是 P0？
**A3**: 文本、图片、文件发送都是 IM 核心链路。任意发送都会重复显示会破坏消息历史可信度，并可能掩盖真实的消息持久化或 SDK 回显问题。

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 1 Build Gate | `cd sections/im_web && pnpm type-check` | Pass |
| Layer 1 Build Gate | `cd sections/im_web && pnpm build` | Pass |
| Layer 3 Store | `cd sections/im_web/apps/chat && pnpm exec vitest run tests/messageListenerOwnEcho.test.ts tests/messageActions.test.ts tests/messageMediaSending.test.ts tests/messageStoreDailyMessaging.test.ts --config vitest.config.ts` | Pass，4 files / 14 tests |
| Layer 5 E2E | Playwright 可视化脚本 `/tmp/playwright-v2-18-visual.js`，目标 `http://localhost:3000` | Pass，文本 1 条、图片新增 1 条、文件新增 1 条，consoleErrors 0，networkErrors 0 |

---

## 修复验收标准

1. 发送文本后，发送方 UI 只新增一条文本气泡。
2. 发送图片后，发送方 UI 只新增一条图片消息。
3. 发送文件后，发送方 UI 只新增一条文件卡片，且不会出现文件名文本气泡。
4. 同一消息的 pending、sent、realtime 回显能合并为一条 store 记录。
5. 接收方只收到一条对应消息。
6. 刷新页面或重新进入会话后，历史消息不出现重复内容。
7. 自动化测试覆盖文本、图片、文件三种发送类型的去重场景。

---

## 修复记录

### 2026-05-25

已完成以下修复：

1. `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
   - 文本发送成功后不再把 SDK 返回消息作为 realtime 消息追加，而是使用本地 `clientMsgNo` 原地更新 pending 消息。
   - 图片 / 文件发送成功后原地更新 pending 媒体消息，保留正确的 `type=2` / `type=8` 内容和媒体 URL。
   - `addMessage()` 同时按 `clientMsgNo` 和 `messageID` 去重，避免 realtime / sync 使用不同 `clientMsgNo` 时重复。
   - `syncMessages()` 对已有 `messageID` 的本地消息进行原地合并，避免刷新或重进会话后重复。
2. `sections/im_web/packages/datasource-vue/src/cmd/index.ts`
   - realtime listener 用字符串归一化比较 `currentUser.uid` 和 `message.fromUID`。
   - 当前用户自己发出的 SDK 回显不再进入 `addRealtimeMessage()`，防止发送方 UI 二次追加。
3. `sections/im_web/packages/datasource-vue/src/stores/messageStore.js` 与 `sections/im_web/packages/datasource-vue/src/cmd/index.js`
   - 同步上述运行时修复。当前 Vite 开发服务实际加载 `.js` 文件，必须与 TS 保持一致。
4. `sections/im_web/apps/chat/vite.config.ts`
   - 将 Vite extension 解析顺序调整为优先 `.ts`，确保浏览器开发与构建链路加载受版本管理的 TypeScript 源文件，而不是被 git 忽略的同名 `.js` 产物。
5. `sections/im_web/apps/chat/tests/messageListenerOwnEcho.test.ts`
   - 新增回归测试：当 `currentUser.uid` 是数字、SDK `fromUID` 是字符串时，自己的 realtime 回显必须被跳过，不应进入消息列表。

---

## 测试结果

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/messageListenerOwnEcho.test.ts tests/messageActions.test.ts tests/messageMediaSending.test.ts tests/messageStoreDailyMessaging.test.ts --config vitest.config.ts
# 4 files passed, 14 tests passed

cd sections/im_web
pnpm type-check
# exit 0

cd sections/im_web
pnpm build
# exit 0
```

Playwright 可视化验证：

```text
targetUrl: http://localhost:3000
textCount: 1
imageRowsAdded: 1
fileRowsAdded: 1
loadedSources:
- /packages/datasource-vue/src/cmd/index.ts
- /packages/datasource-vue/src/stores/messageStore.ts
consoleErrors: []
networkErrors: []
screenshots:
- /tmp/v2-18-visual/01-after-text.png
- /tmp/v2-18-visual/02-after-image.png
- /tmp/v2-18-visual/03-after-file.png
```

---

## 关闭备注

Resolved。文本、图片、文件发送后发送方 UI 均只新增一条对应消息；浏览器可视化验证通过。
