# [V2-19] 群二维码、Bot、好友资料、未读红点与 @ 功能回归合集

**状态**：Resolved
**创建时间**：2026-05-25
**标签**：bug / ux / group / bot / contacts / unread / mention / regression
**优先级**：P0

---

## 问题描述

用户反馈当前 IM Web 仍存在 5 个关键交互问题：

1. 群二维码区域显示的只是链接，而不是可扫码二维码。
2. Bot 入口不知道怎么使用，也不知道在哪里设置。
3. 点击朋友的个人信息，仍然显示“加为好友”。
4. 有新消息时不再有红点提示。
5. @ 功能失效。

其中未读红点和 @ 功能直接影响消息触达与群聊核心沟通，按 P0 跟踪；群二维码、Bot 使用入口、好友资料状态按 P1 跟踪，但纳入同一轮回归修复与验证。

---

## 复现步骤

### 子问题 1：群二维码只显示链接

1. 登录 Web IM。
2. 打开任意群聊。
3. 打开群设置 / 群资料中与二维码、邀请、分享相关的入口。
4. 观察二维码区域。

### 子问题 2：Bot 不知道怎么使用和设置

1. 登录 Web IM。
2. 进入任意会话。
3. 点击输入区工具栏中的 `Bot` 入口。
4. 观察是否有可理解的菜单、设置入口、不可用说明或后端能力缺失提示。

### 子问题 3：好友个人信息仍显示加为好友

1. 登录 Web IM。
2. 进入一个已是好友的单聊会话。
3. 点击顶部好友信息或头像打开个人资料。
4. 观察资料抽屉 / 弹窗中的主要操作按钮。

### 子问题 4：新消息没有红点提示

1. 使用两个账号登录，或让另一个客户端给当前账号发送消息。
2. 当前账号保持在其他会话或会话列表页。
3. 让对方发送单聊或群聊消息。
4. 观察左侧会话列表、总未读、群聊 @ 未读提示。

### 子问题 5：@ 功能失效

1. 登录 Web IM。
2. 进入群聊。
3. 在输入框输入 `@`，选择群成员或输入 `@所有人`。
4. 发送消息并观察发送内容、接收方提醒、会话列表摘要和未读提示。

---

## 预期表现

1. 群二维码应渲染为真实二维码图形，并能承载群号、邀请链接或后端支持的入群 payload；若后端暂不支持，应显示明确的不可用状态，而不是裸链接。
2. Bot 入口应有清晰可用的菜单、命令列表、设置入口或“当前会话未配置机器人”的组件化说明。
3. 已是好友的个人资料不应显示“加为好友”，应显示“发送消息”、备注 / 删除 / 拉黑等符合好友关系的操作。
4. 新消息到达时，会话列表应出现未读红点或数字；正在查看的会话可以清未读，非当前会话不能误清。
5. 群聊输入 `@` 应能唤起成员选择；发送后消息 payload 应带 mention 信息；接收方和会话列表应能识别 @ 提醒。

---

## 实际表现

1. 群二维码显示为链接文本，无法扫码。
2. Bot 只有入口但缺少可理解的使用 / 设置路径。
3. 已是好友资料仍显示“加为好友”，关系状态错误。
4. 有新消息时看不到红点提醒。
5. @ 功能无法正常使用或发送后无有效提醒。

---

## 相关代码

待排查重点：

```
sections/im_web/apps/chat/src/views/ChatView.vue
sections/im_web/apps/chat/src/views/UserProfileDrawer.vue
sections/im_web/apps/chat/src/views/ConversationList.vue
sections/im_web/apps/chat/src/components/MessageInput.vue
sections/im_web/packages/base-vue/src/components/GroupSettingsDrawer.vue
sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts
sections/im_web/packages/datasource-vue/src/stores/messageStore.ts
sections/im_web/packages/datasource-vue/src/cmd/index.ts
sections/im_web/packages/datasource-vue/src/api/index.ts
sections/im_web/packages/contacts-vue/src/stores/contactStore.ts
```

重点关注：

1. 群二维码：当前是否只是展示分享 URL；是否缺二维码组件 / canvas 渲染；后端是否有群邀请二维码接口。
2. Bot：`commonApi.getRobotMenus()`、`commonApi.sendRobotCommand()` 是否返回可用数据；UI 是否缺设置入口和 unavailable 状态文案。
3. 好友资料：好友关系判断是否使用 `contactStore.contacts`、`follow`、`is_deleted` 等字段；资料抽屉是否在打开时同步联系人状态。
4. 未读红点：`conversationStore.unreadMap`、realtime listener、`clearUnread()` 调用时机；是否在非当前会话误清；是否 V2-18 跳过自己消息时影响他人消息处理。
5. @ 功能：群成员字段 `member_uid` / `uid` 是否归一；`mentionedUids` 是否正确保存；message payload 的 `mention` 是否被 SDK / 后端保留；会话摘要是否识别 mention。

---

## 根因分析

1. 群二维码 UI 只把后端返回的邀请 payload 当文本插值展示，没有生成可扫码二维码。
2. Bot 面板只有 loading / unavailable 的简略状态，缺少菜单标题、使用方式和未配置说明。
3. 好友资料抽屉只在 mounted 时拉用户资料，未在打开资料时同步联系人；好友判断也使用严格类型比较，uid 字符串 / 数字不一致时误判。
4. 会话列表点击时在路由真正进入会话前调用 `clearUnread()`，存在非当前会话未读被过早清除的风险。
5. @ 功能依赖 `member_uid` 单一字段，遇到成员对象只有 `uid` 时丢失 mention；工具栏 `@` 按钮插入字符后没有稳定打开成员选择；弹窗层级也可能被消息列表拦截点击。

---

## 问题列表（Q&A 迭代）

### Q1: 这 5 个问题是否应拆成多个 issue？
**A1**: 后续实现时可以拆成子任务，但当前来自同一轮用户反馈，且都属于聊天关键交互回归，先合并到 V2-19 统一跟踪，修复时按子问题逐项关闭验收。

### Q2: 为什么优先级是 P0？
**A2**: 新消息红点和 @ 失效会直接导致用户漏消息；好友资料关系错误会导致错误操作入口；因此本 issue 整体按 P0 处理。

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 1 Build Gate | `cd sections/im_web && pnpm type-check` | Pass |
| Layer 1 Build Gate | `cd sections/im_web && pnpm build` | Pass，存在既有 chunk size warning |
| Layer 2 Component / Contract | `cd sections/im_web/apps/chat && pnpm exec vitest run tests/v2Issue19Contracts.test.ts tests/groupJoinFlows.test.ts tests/robotReportFlows.test.ts tests/notificationUnread.test.ts tests/messageActions.test.ts tests/uiLayoutStability.test.ts --config vitest.config.ts` | Pass，6 files / 20 tests |
| Layer 5 E2E | `TARGET_URL=http://localhost:3000 node run.js /tmp/playwright-v2-19-visual.js` | Pass |

---

## 修复验收标准

1. 群二维码区域显示真实二维码或明确不可用状态，不再只显示裸链接。
2. Bot 入口能展示菜单 / 设置 / 不可用说明之一，用户能理解下一步。
3. 已是好友的个人资料不显示“加为好友”，关系状态与联系人列表一致。
4. 非当前会话收到新消息后出现红点或未读数字；进入会话后红点正确清除。
5. 群聊输入 `@` 能选择成员并发送 mention payload；接收方能看到 @ 提醒或对应未读标识。
6. Playwright 截图覆盖以上 5 个场景，并无严重 console error / 5xx network error。

---

## 修复记录

1. `GroupSettingsDrawer.vue`
   - 引入 `qrcode`，将群二维码 payload 渲染为真实二维码图片。
   - 保留链接作为辅助文本，不再把裸链接作为二维码主体。
   - 后端返回图片 URL / data URL 时直接展示图片。
2. `MessageInput.vue`
   - Bot 面板增加“机器人菜单”、可用时“点击菜单即可发送指令”、不可用时“机器人未配置 / 请在服务端机器人管理中配置后使用”。
   - 增加 `getMemberUid()` / `getMemberDisplayName()`，统一 `member_uid` / `uid` 字段。
   - 工具栏 `@` 按钮稳定打开成员选择，并在进入群聊时补拉群成员。
   - mention payload 同时识别 `@昵称` 与 `@uid`。
   - 提升 mention 弹窗层级，避免被消息列表拦截点击。
3. `UserProfileDrawer.vue`
   - 打开资料时同步联系人和用户资料。
   - 好友关系使用 `String(c.uid) === String(props.uid)` 比较。
4. `ConversationList.vue` / `ChatView.vue`
   - 移除列表点击时的提前清未读。
   - 只在当前会话路由真正激活后由聊天页清未读。
5. `packages/base-vue/package.json` / `pnpm-lock.yaml`
   - 增加 `qrcode` 与类型声明依赖。

---

## 测试结果

自动化：

```
cd sections/im_web/apps/chat
pnpm exec vitest run tests/v2Issue19Contracts.test.ts tests/groupJoinFlows.test.ts tests/robotReportFlows.test.ts tests/notificationUnread.test.ts tests/messageActions.test.ts tests/uiLayoutStability.test.ts --config vitest.config.ts
```

结果：Pass，6 个测试文件、20 个测试全部通过。

```
cd sections/im_web && pnpm type-check
```

结果：Pass。

```
cd sections/im_web && pnpm build
```

结果：Pass；Vite 输出既有 chunk size warning。

可视化：

```
TARGET_URL=http://localhost:3000 node run.js /tmp/playwright-v2-19-visual.js
```

结果：Pass。截图证据：

- `/tmp/v2-19-visual/00-chat-home.png`
- `/tmp/v2-19-visual/01-bot-panel.png`
- `/tmp/v2-19-visual/02-group-qr.png`
- `/tmp/v2-19-visual/03-mention-popup.png`
- `/tmp/v2-19-visual/04-friend-profile.png`
- `/tmp/v2-19-visual/05-unread-route-click.png`

---

## 关闭备注

Resolved。5 个用户反馈点均已修复并完成自动化与浏览器可视化验证。
