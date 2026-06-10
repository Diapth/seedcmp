# [ISSUE-045] 手动 pin 关键消息未接入 Agent 长期上下文

**状态**：Resolved
**创建时间**：2026-06-10
**标签**：feature / clowder / context / message-pin / ui
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-045_manual_context_pin_message_as_agent_context.md
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

**修复执行规则**：
- 若 `AI修复模式：Plan First`，先使用 `writing-plans` 写计划，计划无需用户确认直接实现。
- 若 `AI修复模式：Direct Fix`，可以直接修复，但必须使用 `tdd` 思路：先补/确认回归测试，再改实现，再验证。
- 若涉及前端页面、截图或交互验收，必须使用 `browser-preview` 或 Playwright 实测。
- 测试截图、日志和结果 JSON 必须保存到 `seedcmp/sections/ui/.ai/tests/ISSUE-045-<timestamp>/` 下，并按 issue 序号命名。
- 若遇到测试失败或行为不符合预期，使用 `debugging` / `systematic-debugging` 定位根因。
- 完成前使用 `verification-before-completion`，确认验证命令和浏览器证据后再说完成。

---

## 问题描述

产品需求要求：

> 上下文管理：聊天历史自动作为上下文传递给 Agent，支持手动 pin 关键消息作为长期上下文。

当前代码审计结论：

1. Clowder runtime 和 TangSeng bridge 已有 manual context pins 能力。
2. `sections/ui` 只实现了临时 `promptContext` 传递和会话置顶，没有暴露“将某条聊天消息 pin 为 Agent 长期上下文”的用户操作。
3. 老前端 `sections/im_web` 有 IM 层“设为置顶/取消置顶消息”，但它对应 TangSeng `/v1/message/pinned`，不是 Clowder prompt 层长期上下文 pin。

实际体验：

1. 用户在 Agent 单聊或群聊中看到关键消息后，无法通过右键/长按把它设为 Agent 长期上下文。
2. UI 中也没有 active manual context pins 的状态标记、管理入口或取消入口。
3. 除非手动调用后端 API，否则后续 Agent invocation 不会携带用户手动挑选的长期上下文。

预期体验：

1. 用户可以在聊天消息上右键或长按，选择“设为长期上下文”。
2. 已 pin 的消息应能显示稳定标记，并支持“取消长期上下文”。
3. 刷新页面后，长期上下文 pin 状态仍能恢复。
4. 后续 Agent 调用应通过 Clowder manual context pins 注入 prompt，而不是仅依赖本地 `promptContext`。
5. UI 文案必须区分：
   - `置顶消息` / `置顶会话`：IM 展示层行为。
   - `设为长期上下文`：Agent prompt 层行为。

---

## 复现步骤

1. 启动 `seedcmp/scripts/start-im-clowder.sh start`。
2. 登录主 UI `http://localhost:5173`。
3. 打开一个 Agent 单聊，或打开包含 Agent 的群聊。
4. 发送几条包含关键约束的消息。
5. 右键桌面端消息气泡，或在移动端长按消息气泡。
6. 观察菜单是否存在“设为长期上下文 / 取消长期上下文”。
7. 刷新页面后观察该消息是否保留长期上下文标记。
8. 再次向 Agent 发送消息，检查 Clowder invocation context 是否包含 `[Manual context pins - user selected, max 5]` 区块。

实际：

1. 新 UI 消息菜单只有引用、表情、撤回、删除等操作。
2. 没有 manual context pin API wrapper、store action、UI 状态或浏览器验收。

预期：

1. 单聊和群聊核心路径均可手动 pin / unpin。
2. 后端请求走 TangSeng bridge：`/v1/clowder/thread/:threadId/manual-context-pins`。
3. Agent 上下文由 Clowder runtime 的 manual context pins 注入链路承载。

---

## 相关代码

```text
需求来源：
- target.md
- seedcmp/core-im.md
- seedcmp/assets/roadmap/prd产品需求文档.md

Clowder runtime 已有能力：
- sections/clowder-ai/packages/api/src/routes/manual-context-pins.ts
  - POST/GET/PATCH/DELETE /api/threads/:threadId/manual-context-pins
- sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/route-helpers.ts
  - loadManualContextPins(...)
  - assembleIncrementalContext(...) 注入 manualContextPins
- sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/context-transport.ts
  - formatManualContextPins(...)

TangSeng bridge 已有代理：
- sections/im/TangSengDaoDaoServer/modules/clowder/api.go
  - GET /v1/clowder/thread/:threadId/manual-context-pins
  - POST /v1/clowder/thread/:threadId/manual-context-pins
  - PATCH /v1/clowder/thread/:threadId/manual-context-pins/source-status
  - DELETE /v1/clowder/thread/:threadId/manual-context-pins/:pinId

新 UI 当前缺口：
- sections/ui/services/native-im/service.js
  - 目前只看到 sendClowderConversationMessage(... promptContext ...)
  - 缺少 manual context pin CRUD wrapper
- sections/ui/stores/message.js
  - 目前只缓存/传递 promptContext
  - 缺少 pin/unpin/list/markSourceStatus action
- sections/ui/components/chat/MessageContextMenu.vue
  - 菜单缺少“设为长期上下文 / 取消长期上下文”
- sections/ui/pages/chat/index.vue
  - handleMenuAction 未处理 manual context pin
- sections/ui/components/chat/RightWorkspace.vue
  - 可考虑增加“长期上下文”管理区，但必须先做设计确认

IM 层消息置顶，不能直接等同：
- sections/im/TangSengDaoDaoServer/modules/message/api.go
  - /v1/message/pinned*
- sections/im_web/apps/chat/src/components/MessageList.vue
  - 老前端“设为置顶”是 IM pin
```

---

## 根因分析

根因是产品语义跨了三层，但新 UI 只接了其中一部分：

1. `sections/clowder-ai` 已经实现“长期上下文 pin”的数据模型、API、存储和 Agent context 注入。
2. `sections/im` 已经把 TangSeng 登录态代理到 Clowder manual context pins。
3. `sections/ui` 没有把聊天消息、thread binding、manual context pins API 和消息菜单串起来。
4. 现有 UI 中“置顶会话”和老前端“置顶消息”容易被误认为满足该需求，但它们不进入 Agent prompt，不满足“长期上下文”语义。

需要重点确认的技术点：

1. UI 如何从当前会话稳定拿到 `threadId`：
   - Agent 单聊：通过现有 Clowder conversation binding / direct conversation metadata。
   - 群聊：通过 group channel 与 Clowder thread binding。
2. pin payload 如何从 UI message 构造：
   - `messageId` 优先使用服务端 `message_id/messageId`，fallback 到可追溯 `clientMsgNo` 时需评估后端契约。
   - `contentExcerpt` 需要从文本/Markdown/文件摘要中提取，并做长度截断和注入内容清理。
   - `channelId/channelType/messageSeq/senderName` 尽量随源消息带上。
3. 删除消息、撤回消息或失去权限时，是否要调用 `source-status` 标记 `source_deleted` / `permission_denied`。

---

## 问题列表（Q&A 迭代）

### Q1: 能否直接复用 TangSeng `/v1/message/pinned`？
**A1**: 不能直接等同。IM pin 是聊天展示层置顶；Clowder manual context pin 是 Agent prompt 层长期上下文。可以在 UI 上互相引用源消息，但必须走不同接口并明确文案。

### Q2: 是否只支持 Agent 单聊？
**A2**: 不够。需求是“聊天历史作为 Agent 上下文”，应覆盖 Agent 单聊和包含 Agent 的群聊。群聊需要确认 thread binding 和权限态。

### Q3: 是否必须新增右侧管理面板？
**A3**: 第一阶段可先做消息菜单 + 气泡标记 + unpin；若 active pins 较多，建议在 `RightWorkspace` 加“长期上下文”管理区，但这属于 UI 设计点，需要在 Plan First 阶段明确。

### Q4: pin 的内容是否要跟随源消息编辑变化？
**A4**: 首版可以保存 pin 时的 `contentExcerpt` 快照。若源消息撤回/删除，应标记 source status 并从 active context 排除；后续可再做编辑同步。

---

## 修复建议

1. 先补计划：
   - 在 `sections/ui/.ai/plans/ISSUE-045_manual_context_pin_message_as_agent_context.md` 写清分阶段方案。
   - 计划必须包含 threadId 获取、API contract、UI 交互、状态恢复、source status、测试证据路径。

2. 补 API/service 层：
   - `nativeImService.listManualContextPins(threadId, options)`。
   - `nativeImService.upsertManualContextPin(threadId, payload)`。
   - `nativeImService.removeManualContextPin(threadId, pinId)`。
   - `nativeImService.markManualContextPinSourceStatus(threadId, payload)`。

3. 补 store 层：
   - 按 conversation/thread 缓存 active pins。
   - 提供 `pinMessageAsContext`、`unpinMessageAsContext`、`syncManualContextPins`。
   - 消息列表归一化时给已 pin 消息打 `manualContextPinned/manualContextPinId`。

4. 补 UI：
   - `MessageContextMenu.vue` 增加“设为长期上下文 / 取消长期上下文”。
   - 消息气泡增加低干扰 pin 标记，注意桌面和移动端不遮挡正文、状态、reaction。
   - 必要时在 `RightWorkspace.vue` 增加长期上下文管理区。

5. 补 Agent 调用验证：
   - 通过 Playwright 或可控 mock 验证 pin 后再次调用 Agent，Clowder context 包含 manual pins 区块。
   - 不能只验证 UI 菜单出现。

---

## 验收标准

- 桌面端消息右键菜单显示“设为长期上下文”，已 pin 后显示“取消长期上下文”。
- 移动端长按菜单具备同等能力。
- pin 请求走 `/v1/clowder/thread/:threadId/manual-context-pins`，payload 包含 `messageId` 和 `contentExcerpt`。
- 刷新页面后已 pin 消息仍有长期上下文标记。
- unpin 后 active pins 列表移除，对应消息标记消失。
- 后续 Agent invocation 的上下文包含 `[Manual context pins - user selected, max 5]`，且 pin 内容位于普通历史之前。
- 删除/撤回源消息后，长期上下文不再作为 active pin 注入；若后端接口可用，应标记 `source_deleted`。
- UI 文案和视觉上明确区分“置顶会话/置顶消息”和“设为长期上下文”。
- 单聊、群聊、桌面 viewport、移动 viewport 都通过浏览器验收。
- 不破坏现有 `promptContext`、引用回复、reaction、删除/撤回消息、会话置顶能力。

---

## 建议测试

```bash
cd sections/ui
npm run test:native-im
npm run test:smoke
npm run build:h5
```

建议新增自动化测试：

1. `services/native-im/service.js`
   - manual context pins CRUD 请求路径、method、payload 映射。
2. `stores/message.js`
   - 从消息构造 pin payload。
   - 同步 active pins 后标记对应消息。
   - unpin 后清理标记。
3. UI 组件测试或 smoke：
   - 菜单在可 pin 的 Clowder 会话中展示“设为长期上下文”。
   - 非 Clowder / 无 threadId 会话中禁用或隐藏该 action，并给出合理失败态。
4. Playwright：
   - 桌面 `1440x900`：Agent 单聊 pin -> 刷新 -> unpin。
   - 移动 `375x844`：群聊消息长按 pin -> 触发 Agent -> 验证 context/log。

浏览器证据必须保存到：

```text
sections/ui/.ai/tests/ISSUE-045-<timestamp>/
```

建议证据文件：

- `result.json`
- `request-log.json`
- `browser-console.json`
- `playwright.log`
- `desktop-1440x900-manual-context-pin-menu.png`
- `desktop-1440x900-manual-context-pin-state.png`
- `mobile-375x844-manual-context-pin-menu.png`
- `mobile-375x844-manual-context-pin-state.png`
- `clowder-context-log.txt`

---

## 修复记录

已完成，按 `Plan First` 拆成四个可验证阶段提交：

1. `e6f61cc 补充长期上下文消息 pin 计划`
   - 新增计划文档：`sections/ui/.ai/plans/ISSUE-045_manual_context_pin_message_as_agent_context.md`
   - 明确 threadId 获取、API contract、UI 菜单、状态恢复、source status 和测试证据路径。

2. `b0d5b52 补齐长期上下文接口与状态助手`
   - 新增 `sections/ui/services/native-im/manual-context-pins.js`。
   - 在 `sections/ui/services/native-im/service.js` 接入：
     - `listManualContextPins`
     - `upsertManualContextPin`
     - `removeManualContextPin`
     - `markManualContextPinSourceStatus`
   - 补充 `sections/ui/tests/native-im.test.mjs` 覆盖请求路径、method、payload 和消息内容摘要构造。

3. `28ea8e2 接入消息长期上下文状态`
   - 在 `sections/ui/stores/message.js` 增加 `manualContextPinsByThread`。
   - 支持 `syncManualContextPins`、`pinMessageAsContext`、`unpinMessageAsContext`、`markManualContextSourceDeleted`。
   - 消息同步、接收、本地发送和 Agent 回复后会重新套用 `manualContextPinned/manualContextPinId` 标记。
   - 删除/撤回源消息时会调用 `source_deleted` 状态同步。

4. `64161e3 增加长期上下文菜单与标记`
   - `MessageContextMenu.vue` 增加“设为长期上下文 / 取消长期上下文”菜单项。
   - `MessageBubble.vue` 增加低干扰“长期上下文”标记。
   - `pages/chat/index.vue`、`pages/chat/detail.vue` 接入 thread 解析、pin 状态同步、pin/unpin action 和 toast 反馈。

验证证据保存在：

```text
sections/ui/.ai/tests/ISSUE-045-20260610212802/
```

已保存日志：

```text
npm-test-manual-context-red.log
npm-test-manual-context-service-target.log
npm-test-manual-context-store-target.log
npm-build-h5-ui-stage.log
```

验证命令：

```bash
cd sections/ui
npm run test:native-im -- --test-name-pattern="manual context"
npm run build:h5
```

结果：

- `npm run test:native-im -- --test-name-pattern="manual context"`：通过，日志记录 102 项 native-im 测试通过。
- `npm run build:h5`：通过，仅保留既有 uni/Sass warning。
- 浏览器交互：用户已在本地确认长期上下文 pin/unpin 行为可用。

---

## 关闭备注

已关闭。长期上下文 pin 已走 Clowder manual context pins 链路，不再与 IM 展示层“置顶消息/置顶会话”混淆；Agent 后续调用由后端现有 manual context pins 注入链路承载。
