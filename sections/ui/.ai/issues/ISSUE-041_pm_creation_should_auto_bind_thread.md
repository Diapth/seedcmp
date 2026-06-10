# [ISSUE-041] 创建 PM 后未自动绑定 Clowder thread

**状态**：Resolved
**创建时间**：2026-06-10
**标签**：bug
**AI修复模式**：Direct Fix
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

**修复执行规则**：
- Direct Fix 必须使用 TDD：先补/确认失败回归测试，再改实现，再验证。
- 若涉及前端页面、截图或交互验收，必须使用 Playwright 实测。
- 测试截图和日志保存到 `.ai/tests/<issue-id>-<timestamp>/`。
- 完成前使用 `verification-before-completion`，确认验证结果后再说完成。

---

## 问题描述

用户创建 PM/协调者智能体后，进入该智能体直聊会看到 Clowder 返回：

> 当前没有绑定 thread，请先用 /new 创建或 /use 切换。

这不符合创建体验。`POST /v1/clowder/cats` 的语义已经是“创建并连接智能体”，创建完成后应该自动为 `clowder_cat:<catId>` 直聊建立 Clowder thread binding，并把 `threadId` 返回给前端。用户不应该再进聊天手动发 `/new`。

另一个相关问题是：直聊中输入 `/new` 时，后端会把 direct cat mention 自动加到消息前面，变成 `@cat /new`，导致 Clowder 命令层无法识别 `/new`，旧会话也不能自救。

---

## 期望行为

1. 创建 PM/协调者或其他自定义 Clowder 猫猫成功后，后端立即对对应 direct channel 执行 `/new <name>`。
2. 创建响应包含 `threadId` 和 `binding`，前端创建的 agent/conversation 保留 `threadId`。
3. 直聊普通文本仍自动加 direct cat mention；slash 命令（如 `/new`、`/use`）保持原文，不加 mention。
4. 新创建 PM 进入聊天后不再出现“当前没有绑定 thread”的提示。

---

## 根因分析

`createCatAndConnect` 创建猫猫后只返回 contact，没有调用 `bindConversation`/`/new` 为 `clowder_cat:<catId>` direct channel 建立 binding。前端随后基于 contact 创建直聊，但服务端 Clowder connector 侧没有该 externalChatId 对应的 thread。

同时 `routeTextForCatRequest` 对 direct cat 所有消息都加 mention，包括 slash 命令，导致用户手动输入 `/new` 时也不会进入命令分支。

---

## 修复记录

- 后端 `POST /v1/clowder/cats` 不再向 `clowder_ai` 会话发送 `/cats new`，改为调用 Clowder REST `POST /api/cats` 创建运行时猫猫，避免多出需要用户手动处理的 Clowder AI 会话。
- 创建成功后立即对 `clowder_cat:<catId>` 直聊执行 `/new <name>`，生成 thread binding，并在响应中返回 `threadId` 与 `binding`。
- 抽出 `ensureConversationBinding` 复用绑定逻辑，让手动绑定接口和创建后自动绑定使用同一套 thread lookup / error handling。
- 直聊智能体发送 slash 命令时保持原文，不再自动加 `@cat` 前缀；普通文本仍自动补 direct cat mention。
- 前端创建智能体和会话时保留 `threadId` / `directThreadId` / `binding`，新 PM 进入聊天后直接携带绑定状态。

## 测试结果

- `cd sections/ui && npm run test:native-im`：通过，日志见 `.ai/tests/ISSUE-041-20260610192141/npm-test-native-im.log`。
- `cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder -count=1`：通过，日志见 `.ai/tests/ISSUE-041-20260610192141/go-test-clowder.log`。
- `cd sections/ui && npm run build:h5`：通过，日志见 `.ai/tests/ISSUE-041-20260610192141/npm-build-h5.log`。
- `scripts/start-im-clowder.sh restart`：通过，日志见 `.ai/tests/ISSUE-041-20260610192141/start-im-clowder-restart.log`。
- `node sections/ui/.ai/tests/ISSUE-041-20260610192141/verify-pm-autobind.mjs`：通过；桌面 Web viewport 与移动端 viewport 均验证新建 PM 具备 `threadId`、会话具备 `threadId`、发送后没有“当前没有绑定 thread”提示，截图和结果见 `.ai/tests/ISSUE-041-20260610192141/`。
- 证据文件：
  - `.ai/tests/ISSUE-041-20260610192141/result.json`
  - `.ai/tests/ISSUE-041-20260610192141/browser-console.json`
  - `.ai/tests/ISSUE-041-20260610192141/desktop-01-new-agent.png`
  - `.ai/tests/ISSUE-041-20260610192141/desktop-02-chat-open.png`
  - `.ai/tests/ISSUE-041-20260610192141/desktop-03-after-send.png`
  - `.ai/tests/ISSUE-041-20260610192141/mobile-01-new-agent.png`
  - `.ai/tests/ISSUE-041-20260610192141/mobile-02-chat-open.png`
  - `.ai/tests/ISSUE-041-20260610192141/mobile-03-after-send.png`

---

## 关闭备注

已验证新建 PM/自定义 Clowder 猫猫会自动绑定直聊 thread，用户不再需要进入 Clowder AI 会话手动 `/new`。
