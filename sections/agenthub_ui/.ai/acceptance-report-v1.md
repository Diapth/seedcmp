# AgentHub UI V1 验收报告

- 验收日期：2026-06-07
- 验收分支：`feat/agenthub-ui-v1-exec`
- 验收 worktree：`/home/yunyi/Desktop/Bytedance_cmp/seedcmp-wt-agenthub-ui-v1-exec`
- 应用目录：`sections/agenthub_ui`
- 对照端：`im_web` at `http://localhost:3000`
- agenthub_ui H5：`http://localhost:5173`
- API base：`http://localhost:3000/v1/`

## 1. 结论

AgentHub UI V1 的 V1-1/V1-2 主链路已完成真实后端接入、IM 会话/消息/群列表同步、业务 mock 与伪造成功路径清理，并通过单元测试、H5 构建和 agenthub_ui -> im_web 真实双端实时验收。

V1-3 的 Clowder/Agent/File/Settings API 化与 unavailable 兜底已有代码与单测覆盖；本轮新增真实 live 证据覆盖 OAuth cat 创建、PM 项目群创建、真实 active deployment request 同步、AgentHub/IM Web 双端 deployment card hydration、AgentHub 确认部署动作和移动端项目群可见性。随后补齐 Kanban/artifacts 工作台代码门禁与浏览器证据：项目群右侧栏不再走 `agentStore.boards`，而是从真实 Clowder binding 解析 thread id 并挂载 `ProjectKanbanPanel` / `ProjectArtifactsPanel`；刷新后的项目群也能通过 `projectGroupNo` 重新取回 active binding 并恢复工作台入口。

本轮验收重点确认：

1. agenthub_ui 登录不再写入 mock token，真实调用 `user/login`。
2. 登录后能拉取真实 user、IM 凭证与 WebSocket 地址。
3. 会话列表来自真实 `conversation/sync`、`group/my`、`message/channel/sync`，与 im_web 关键会话对齐。
4. 不再出现“未命名会话”和 1970 时间。
5. H5 桌面与移动端截图无白屏、无明显遮挡、无主要文本溢出。
6. agenthub_ui 发送真实文本消息后，im_web 无刷新收到同一消息。
7. AgentHub 创建 OAuth cat（Claude Code / Claude OAuth）后，cat directory 真实显示。
8. 真实创建 PM 项目群并拉入新 cat，AgentHub 与 im_web 会话列表均可见。
9. 真实 deployment request 由 active-request API hydrate 成双端 deployment card。
10. AgentHub 点击确认后，`clowder/conversation/deployment-action` 返回 200 且 deployment request 进入 `queued`。
11. 项目群右侧栏从真实 Clowder thread id 加载 Kanban 与 artifacts，不再依赖本地 `agentStore.boards`。
12. 刷新项目群聊天页后，AgentHub 能通过 `projectGroupNo` fallback 恢复项目工作台入口、Kanban 和 artifacts。

## 2. 真实账号与运行环境

- 验证账号：`008618337488675`
- 用户 uid：`edbb4e4566f840f4a6f14b9f9cf01c22`
- 用户名：`V3-37 Smoke`
- token：`ce80e5...6c6e33`（脱敏）
- ws_addr：`ws://0.0.0.0:5200`
- 登录平台：agenthub_ui H5 / im_web Web
- WebSocket：agenthub_ui 与 im_web 均显示 connected

## 3. 已覆盖需求

### V1-1 后端接入基础设施

- `utils/env.js`：API base / WS base / OAuth / 平台环境集中读取。
- `utils/storage.js`：uni storage、localStorage、memory fallback 统一抽象。
- `utils/request.js`：fetch / uni.request 适配、token 注入、401 refresh/kickout、错误归一化、超时。
- `api/*`：auth/user/sync/group/friend/file/clowder 真实接口封装。
- `stores/auth.js` / `stores/user.js` / `stores/im.js`：真实登录、用户资料、IM 凭证与登录态恢复。
- `pages/login/index.vue` / `register.vue`：真实 API 登录/注册，不再使用 `mock_token_abc123`。

### V1-2 IM 链路与 fixture 替换

- `utils/wk-sdk.js`：接入 `wukongimjssdk@1.3.5`，登录后初始化 WebSocket。
- `stores/conversation.js`：真实 `conversation/sync`、群会话合并、草稿/隐藏持久化、置顶/免打扰/清未读接口。
- `stores/message.js`：真实消息同步、发送、去重、撤回、编辑、reaction 基础能力。
- `stores/message.js`：补齐非文本发送 unavailable、typing CMD、revoke by client msg no、reaction channel type。
- `stores/group.js`：真实 `group/my`、群资料、群成员接口。
- `stores/contact.js` / `stores/file.js`：真实好友/文件 API，后端不可用时不伪造成功。
- `pages/contacts/add.vue` / `ContactUtilityPanel.vue`：添加好友搜索走真实 `user/search`，保留 `vercode` 并传给 `friend/apply`。
- `MessageInput.vue` / `pages/files/index.vue` / QR 与下载入口：未接真实上传、下载、二维码能力时显式 unavailable。
- `utils/im-mappers.js`：兼容真实 sync shape、秒级 timestamp、users/groups channel cache、群最新摘要。

### V1-3 Clowder 与功能完善

- `api/clowder.js`：Clowder status、cat directory、capabilities、binding、group cats、project groups、deployment 等接口。
- `stores/clowder.js`：真实 Clowder 状态、能力失败态、binding、thread tasks、thread artifacts、deployments、projectGroups。
- `stores/agent.js`：智能体目录、创建/连接/断开走真实 Clowder API；不再内置 7 个硬编码 agent。
- `stores/projectGroup.js` / `stores/deployment.js`：项目群与部署状态机接入真实 API。
- `stores/settings.js`：设备、二维码登录、skill 上传等能力接后端；接不上时显式 unavailable。

## 4. 回归测试

```bash
node scripts/run-vitest.mjs
```

结果：

- Test Files：7 passed
- Tests：51 passed

```bash
node scripts/run-uni.mjs build -p h5
```

结果：

- `DONE Build complete.`

```bash
TEST_CONVERSATION='Clowder AI' node tests-e2e/agenthub-imweb-realtime.mjs
```

结果：

- Passed
- Evidence：`.ai/tests-e2e/v1-2-20260606T210801/`
- Message：`agenthub-imweb-live-20260606T210801`
- Conversation：`Clowder AI` / `clowder_ai`
- Browser diagnostics：pageerror 0、requestfailed 0；`deployment-request/active` 对该 direct chat 返回 404，属于无 active deployment 的非阻断 hydration 探测。

```bash
TEST_PASSWORD=<redacted> node tests-e2e/agenthub-v1-3-clowder.mjs
```

结果：

- Passed
- Evidence：`.ai/tests-e2e/v1-3-20260606T210434/`
- OAuth cat：`v13210434` / `V13验收猫210434`
- Project group：`a8156f762c7c4707acc614df08a8f07e` / `V13验收项目210434`
- Deployment request：`deploy_e49199b3-dc74-4b70-838c-2c2597d5f68b`
- Deployment action：`confirm` -> 200，status `queued`
- Browser diagnostics：pageerror 0、requestfailed 0；`coversation/clearUnread` 对新项目群返回 400 并被前端作为非阻断本地清零处理，im_web 也有相同既有行为。

```bash
GOFLAGS=-buildvcs=false go test ./modules/clowder
```

结果：

- Passed
- `ok github.com/TangSengDaoDao/TangSengDaoDaoServer/modules/clowder`

```bash
GOFLAGS=-buildvcs=false go test ./...
```

结果：

- 环境受限，未通过全仓：多个既有测试依赖本机 `test` MySQL 数据库、缺失 `assets/assets/*.png|jpeg` 测试资源或外部 push 厂商权限；`modules/clowder` 目标测试已单独通过。

非阻断告警：

- uni-app alpha 版本更新提示。
- Sass `@import` / legacy JS API deprecation。
- `utils/wk-sdk.js` 同时被动态/静态 import，Vite 提示无法拆 chunk。

## 5. 浏览器真实验收

### agenthub_ui 桌面

- URL：`http://localhost:5173/#/pages/chat/index`
- 截图：`issues/screenshots/v1-final-agenthub-1440.png`
- 顶部会话：
  1. `V340项目群06101256` / `[文件] acceptance-result.json`
  2. `PM` / `我已创建项目群「V340项目群06101256」...`
  3. `Clowder AI` / `当前没有绑定 thread...`

### agenthub_ui 移动端

- Viewport：375x844
- 截图：`issues/screenshots/v1-final-agenthub-375.png`
- 结果：项目群、PM、Clowder AI 等会话可见；底部 tab、列表、通知条无遮挡。

### im_web 对照

- URL：`http://localhost:3000/chat`
- 截图：`issues/screenshots/v1-final-imweb-1440.png`
- 对照结果：关键会话与 agenthub_ui 一致，项目群最新摘要一致。

### 浏览器 diagnostics

三端截图验证期间：

- pageerror：0
- requestfailed：0
- HTTP 4xx/5xx：0
- agenthub_ui console：WebSocket 打开并连接成功
- im_web console：WebSocket 打开并连接成功

### V1-2 双端实时消息

- agenthub_ui：`http://localhost:5173`
- im_web：`http://localhost:3000`
- 目标会话：`Clowder AI`
- 发送端：agenthub_ui
- 接收端：im_web
- 结果：im_web 不刷新收到 `agenthub-imweb-live-20260606T210801`
- 证据：
  - `.ai/tests-e2e/v1-2-20260606T210801/events.json`
  - `.ai/tests-e2e/v1-2-20260606T210801/ws-frames.json`
  - `.ai/tests-e2e/v1-2-20260606T210801/01-agenthub-before-send.png`
  - `.ai/tests-e2e/v1-2-20260606T210801/04-imweb-received-without-refresh.png`

### V1-3 Clowder Live

- agenthub_ui：`http://localhost:5173`
- im_web：`http://localhost:3000`
- 结果：OAuth cat 创建、项目群创建、active deployment request 同步、AgentHub/IM Web deployment card hydration、AgentHub confirm action、移动端项目群列表均通过。
- 证据：
  - `.ai/tests-e2e/v1-3-20260606T210434/events.json`
  - `.ai/tests-e2e/v1-3-20260606T210434/api-evidence.json`
  - `.ai/tests-e2e/v1-3-20260606T210434/01-agenthub-agent-directory-oauth-cat.png`
  - `.ai/tests-e2e/v1-3-20260606T210434/03-agenthub-deployment-card-before-confirm.png`
  - `.ai/tests-e2e/v1-3-20260606T210434/04-agenthub-deployment-card-after-confirm.png`
  - `.ai/tests-e2e/v1-3-20260606T210434/05-imweb-project-group-deployment-card.png`
  - `.ai/tests-e2e/v1-3-20260606T210434/06-agenthub-mobile-project-group.png`

### V1-3 Project Workspace Live

- agenthub_ui：`http://localhost:5173`
- 项目群：`V13工作台终验T215418`
- Project group no：`347dfdbc00004d22868a87e5b4f0b02c`
- Thread：`v1-3-workspace-final-20260606T215418Z`
- 结果：真实项目群右侧栏显示 `Clowder 项目工作台`；点击后显示真实 thread Kanban；切到 artifacts 后显示真实 declared artifact；刷新页面后通过 `projectGroupNo` fallback 恢复入口并再次显示 Kanban。
- 证据：
  - `.ai/tests-e2e/v1-3-workspace-final-20260606T215418Z/events.json`
  - `.ai/tests-e2e/v1-3-workspace-final-20260606T215418Z/api-evidence.json`
  - `.ai/tests-e2e/v1-3-workspace-final-20260606T215418Z/02-workspace-entry-visible.png`
  - `.ai/tests-e2e/v1-3-workspace-final-20260606T215418Z/03-kanban-visible.png`
  - `.ai/tests-e2e/v1-3-workspace-final-20260606T215418Z/04-artifacts-visible.png`
  - `.ai/tests-e2e/v1-3-workspace-final-20260606T215418Z/05-refresh-entry-visible.png`
  - `.ai/tests-e2e/v1-3-workspace-final-20260606T215418Z/06-refresh-kanban-visible.png`
- Browser diagnostics：project workspace 相关 `project-groups/active?projectGroupNo=...`、`thread/.../tasks`、`thread/.../artifacts` 均为 200；同轮仍可见既有非阻断 `coversation/clearUnread` 400 与无 active deployment 时的 `deployment-request/active` 404。

## 6. 问题单状态

- `001-real-backend-integration-gap.md`：Resolved
- `002-uni-build-watcher-enospc.md`：Resolved
- `003-wukongim-build-vcs-status.md`：Resolved
- `004-conversation-sync-shape-and-group-gap.md`：Resolved
- `005-wksdk-send-payload-and-clowder-draft-sync.md`：Resolved
- `006-v1-2-business-mock-cleanup-and-im-actions.md`：Resolved for V1-2/unit/E2E scope
- `007-v1-3-deployment-skill-catalog-rendering.md`：Resolved with live OAuth cat / project group / deployment evidence
- `008-v1-3-project-workspace-kanban-artifacts-wiring.md`：Resolved with unit/build and live browser evidence

## 7. 残余风险

1. Android APP-PLUS 未在真机/模拟器中安装验收；当前实现按 uni 抽象保持兼容，已用 H5 覆盖主要逻辑。
2. 二维码登录、skill 上传等能力依赖后端能力，接不上时已显式 unavailable，没有伪造成功。
3. Sass `@import` 与 uni alpha 告警不影响本轮构建，但后续升级 uni/Sass 时建议清理。
4. Go VCS stamping 在本地 worktree 启动后端时需要 `GOFLAGS=-buildvcs=false`，已记录 issue。
5. 新项目群点击时 `coversation/clearUnread` 可能返回 `stale metadata` 400；AgentHub 与 im_web 均保留本地清零且不阻断 UI，后续若要满足“全零 HTTP 4xx”验收口径，需要单独治理该后端/IM 元数据时序。
