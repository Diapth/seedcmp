# V1-3 计划：agenthub_ui Clowder V3 接入与智能体/群/文件/设置功能完善

## 0. 强制执行门禁

本计划执行时必须遵守以下硬性要求：

1. **阶段提交**：每完成一个阶段的实现、测试修复或文档补充，必须立即做一次中文 commit。不要把多个阶段堆到最后一起提交。
2. **本地服务启动**：最终验收前必须在 `seedcmp` 根目录执行：

 ```bash
 bash scripts/start-im-clowder.sh start
 ```

3. **真实 H5 验收**：必须打开 agenthub_ui 的 H5 dev server（`pnpm dev:h5`）做真实操作；不依赖 mock 数据、静态 fixture、纯截图。验收时同时跑 im_web `http://localhost:3000` 比对：同一组 cat / 项目群 / artifact / deployment 在两端必须一致。
4. **账号可自理**：可使用已有测试账号登录，也可主动创建新账号。
5. **真实多端**：开 agenthub_ui 浏览器窗口 + im_web `http://localhost:3000` 窗口做真实验证。
6. **真实猫猫调用**：必须在 Web 端真实创建或选择 Clowder cat，选择 OAuth 登录方式。
7. **运行平台优先级**：创建/选择猫猫时运行平台优先 `Claude Code`；如果本机能力或 OAuth 配置不可用，再降级为 `Codex`，并在验收记录中写明原因。
8. **真实派发任务**：必须在 Web 端向 PM/coordinator 或猫猫真实派发项目任务，等待真实猫猫输出，验证 Clowder 面板、Kanban、artifacts、deployment cards。
9. **证据留存**：浏览器验收要保存截图、关键请求/响应日志、user/会话/群/cat/coordination/artifact id、任务文本、运行平台、OAuth 状态和失败诊断，建议放在 `sections/agenthub_ui/.ai/tests-e2e/v1-3-<timestamp>/`。

## 1. 现状盘点

`agenthub_ui` V1-2 已完成 IM 实时链路，但 Clowder V3 域与"功能完善"层仍有大量未接入：

- `components/chat/ClowderPanel.vue` 是 V1-2 阶段被清空 setTimeout 后的"占位实现"：硬编码 `activeAgents` 静态数组 + `progress: 60/100` 静态值 + `setTimeout` 累加，**完全是 mock**。
- `stores/agent.js` 仍硬编码 7 个智能体（pm-agent / codex / claude-code / ds / logic-weaver / creative-spark / clowder）和 5 个 skill 模板，**没有后端拉取**。
- `pages/agents/new.vue` 创建智能体的表单（API Key / OAuth / model / skill）无后端提交；只有 `setTimeout` 模拟成功。
- `components/agents/` 目录没列出来（需要阶段 1 盘点），可能仅有 `pages/agents/new.vue`。
- `components/chat/ClowderPanel.vue` 模拟的 active agents、progress、thread、task、artifacts 在 im_web 中全部由 `clowderApi` + `useClowderStore` + `clowderStore.startKickoffPolling()` 驱动，**agenthub_ui 一行都没接**。
- `pages/files/*` / `components/files/*` 文件列表只有 UI 没后端。
- `pages/contacts/add.vue` 加好友、`pages/group/create.vue` 建群 都还有 `setTimeout` 模拟（V1-2 删 setTimeout 时如果没覆盖到，Clowder 域里也可能有残留）。
- `pages/settings/*` 设置页（通知、主题、设备、二维码等）大量 UI-only 能力没有后端（如二维码登录、通知权限、skill 上传）。
- 视觉上 agenthub_ui 的智能体页、设置页、文件页、协作面板已经成型，但**功能层全是 mock 或缺位**。

## 2. 不足检查结论

agenthub_ui Clowder V3 + 功能完善需补齐：

1. **Clowder 域完整接入**：`clowderApi` / `useClowderStore`（agent directory、binding、status、focus、group cats、project group、coordination、Kanban、artifacts、deployment、OAuth capabilities、permissions、admin commands）。
2. **PM/项目群链路**：用户向 PM/coordinator 发项目任务 → PM 创建项目群 → 拉用户/worker cats 入群 → worker agent 输出进入项目群 → 群内 Kanban/artifacts/deployment cards 全部可见。
3. **OAuth cat 真实创建/连接**：走 `clowderApi` + `useClowderStore.createCat` / `connectCat`；platform = `Claude Code` 优先，本机 OAuth 不可用时降级 `Codex`；access mode / model / skill 全部走 `useClowderStore` 拉真实。
4. **智能体页改造**：`pages/agents/index.vue`（如有）/ `pages/agents/new.vue` / `components/agents/*` 切到真实 store。
5. **Clowder 面板重做**：`components/chat/ClowderPanel.vue` 完整接入 `useClowderStore` + 真实 status / binding / progress / tasks / artifacts / deployment / group cats。
6. **Kanban / Artifacts 组件**：新建 `components/chat/ProjectKanbanPanel.vue` / `ProjectArtifactsPanel.vue`（agenthub_ui 版本），走真实 store。
7. **Deployment cards**：`components/chat/DeploymentCard.vue`（agenthub_ui 版本），走真实 deployment store。
8. **文件/Preview**：`pages/files/*` 切到 `fileApi` + 真实 upload/download/list；文件预览保留现有 UI（markdown / html / pdf / office），但路径走真实 asset URL。
9. **设置页功能完善**：`pages/settings/*` 二维码登录、通知权限、skill 上传、设备管理 全部接后端；接不上就显示明确 unavailable / 跳 im_web。
10. **未接入的 UI-only 能力**：`pages/login` 二维码登录、`pages/agents` skill 上传/通知权限 等，**没有真实后端时显示明确 unavailable，不允许假装可用**（V3-42 阶段 6 同样门禁）。
11. **fixture 清废**：原 `stores/agent.js` 硬编码 7 个智能体 / 5 个 skill 模板，V1-3 阶段必须删除（IS_DEMO 模式除外），真实数据由 `useClowderStore.fetchAgentDirectory()` 拉。

## 3. 影响模块

- `sections/agenthub_ui/stores/clowder.js`（新）：完整 Clowder store，对齐 im_web `useClowderStore`。
- `sections/agenthub_ui/stores/agent.js`（重写）：从硬编码 fixture 改为拉真实 + 字段映射。
- `sections/agenthub_ui/stores/deployment.js`（新）：deployment 状态机 + 轮询。
- `sections/agenthub_ui/stores/projectGroup.js`（新）：project group binding + confirmation 状态。
- `sections/agenthub_ui/stores/file.js`（V1-2 阶段已最小接入，本阶段扩 upload/download/preview URL 解析）。
- `sections/agenthub_ui/stores/settings.js`（重写）：通知/主题/设备/二维码/上传 skill 全部接后端）。
- `sections/agenthub_ui/components/chat/ClowderPanel.vue`（重写）：真实 status/binding/progress/tasks/artifacts/deployment。
- `sections/agenthub_ui/components/chat/ProjectKanbanPanel.vue`（新）。
- `sections/agenthub_ui/components/chat/ProjectArtifactsPanel.vue`（新）。
- `sections/agenthub_ui/components/chat/DeploymentCard.vue`（新）。
- `sections/agenthub_ui/components/chat/CoordinatorKickoffCard.vue` / `CoordinatorSummaryCard.vue`（如有，新写）。
- `sections/agenthub_ui/pages/agents/index.vue` / `new.vue` / `pages/agents/detail.vue`（如有）：切到真实 store。
- `sections/agenthub_ui/pages/files/index.vue` / `pages/files/preview.vue`（如有）：切到真实 fileApi。
- `sections/agenthub_ui/pages/settings/*`（全部）：通知/主题/设备/二维码/上传 skill 接后端。
- `sections/agenthub_ui/pages/login/index.vue` 二维码登录：接后端（若后端无二维码能力，**显示 unavailable 并写注释**，不假装可用）。
- 验证脚本：`tests-e2e/smoke-clowder-onboarding.spec.ts` / `smoke-project-group.spec.ts` / `smoke-deployment-card.spec.ts` / `smoke-cat-realtime-sync.spec.ts`（V1-2 已建，本阶段扩展）。

## 4. 推荐设计

### 4.1 Clowder store（`stores/clowder.js`）

完全对齐 im_web `useClowderStore`（5960 行大文件，Clowder 部分约 1848 行），但 agenthub_ui 端实现要更紧凑：

- state：`agentDirectory: Record<catId, Cat>`、`bindings: Record<channelKey, { catId, status, focus, . }>`、`threads: Record<threadId, Thread>`、`tasks: Record<taskId, Task>`、`artifacts: Record<artifactId, Artifact>`、`deployments: Record<requestId, Deployment>`、`projectGroups: Record<projectGroupId, ProjectGroup>`、`capabilities: { oauthEnabled, runtimeAvailable, queueFull, . }`、`kickoffPollings: Record<coordId, IntervalHandle>`。
- action：`fetchAgentDirectory` / `createCat` / `connectCat` / `disconnectCat` / `fetchBinding(channelKey)` / `setFocus` / `listGroupCats(groupId)` / `addGroupCat` / `removeGroupCat` / `startKickoffPolling(coordId)` / `stopKickoffPolling(coordId)` / `fetchThreadTasks(threadId)` / `fetchArtifacts(coordId)` / `confirmProjectGroup` / `cancelProjectGroup` / `bindProjectGroup` / `submitDeployment` / `cancelDeployment`。
- **OAuth 能力检查**：用 im_web `clowderApi.capabilities()`，不通过就 `setCapability('oauthEnabled', false)`，UI 显式提示并降级 Codex。
- **runtime unavailable / queue full / group denied 等失败态**全量映射到 capabilities，UI 必须可见（与 im_web V3-42 §4.4 一致）。
- **kickoff polling**：与 im_web 一样用 HMR-safe `useIntervalFn`（V1-2 阶段已经引入 `composables/` 的 timer 工具，可复用）。
- 单元测试：覆盖 create/connect cat、binding 状态机、kickoff polling 启停、project group confirm/cancel、deployment submit/cancel、capabilities 失败态。

### 4.2 智能体 store（`stores/agent.js`）

完全重写：

- 删除 7 个硬编码 agent + 5 个 skill 模板。
- `fetchAgentDirectory()` 调 `clowderApi.listAgents`。
- `fetchSkills()` 调 `clowderApi.listSkills`。
- `createCat(payload)` / `connectCat(catId)` / `disconnectCat(catId)` 调 `clowderApi.createCat` / `connectCat` / `disconnectCat`。
- 字段映射：im_web `cat_id / name / alias / desc / avatar / status / platform / access_mode / model / account_ref / capability_tags` → agenthub_ui 现有 `id / name / alias / desc / avatar / status / creator / platform / accessMode / model / accountRef / apiKey / apiUrl / customModel / systemPrompt / roleTemplate / templateId / capabilityTags`：
 - `id = cat_id`；`status` 由 `clowderStore.fetchCatStatus(catId)` 实时拉，不写死。
 - `apiKey` / `apiUrl` / `customModel` / `systemPrompt` 等"私密配置"**不再从后端拉**（im_web 也是后端不返回），仅在创建/连接时使用。
- 单元测试：覆盖 fetchAgentDirectory / createCat / connectCat / disconnectCat / 字段映射。

### 4.3 Deployment / ProjectGroup store

- `stores/deployment.js`：deployment request 状态机（pending_confirmation / submitting / running / succeeded / failed / cancelled）、轮询 status、cancel。
- `stores/projectGroup.js`：project group binding + confirmation 状态机（pending_confirmation / creating / created / failed / cancelled）、confirm/cancel、bind/unbind。
- 单元测试：覆盖状态机、轮询、confirm/cancel。

### 4.4 File / Settings store

- `stores/file.js`（V1-2 阶段已最小接入）：本阶段扩 upload（multipart 上传到后端 asset service）、download（带权限校验的 URL）、list（`fileApi.list`）、preview URL 解析（office / pdf / html 走不同 endpoint，sandbox 走 `<iframe sandbox="">`）。
- `stores/settings.js`：重写为 setup store：
 - `notificationPermission`：调 `userApi.notificationPermission`。
 - `theme`：保持现有本地持久化。
 - `devices`：调 `userApi.listDevices` / `kickoutDevice`。
 - `qrLoginToken`：调 `authApi.generateQrToken` + 轮询（若后端无此能力，**显示 unavailable**）。
 - `uploadSkill`：multipart 上传到 `clowderApi.uploadSkill`，返回 skill id。

### 4.5 ClowderPanel / Kanban / Artifacts / DeploymentCard 组件

- `components/chat/ClowderPanel.vue`：完全重写为真实 store 消费方，**删除所有 activeAgents/progress/setTimeout**。展示 status / binding / focus / group cats / tasks / artifacts / deployment 真实数据；capability 失败态显式可见。
- `components/chat/ProjectKanbanPanel.vue`（新）：拉 `clowderStore.fetchThreadTasks(coordId)`，按 status 列展示；点击 task 展开 message 详情。
- `components/chat/ProjectArtifactsPanel.vue`（新）：拉 `clowderStore.fetchArtifacts(coordId)`，列表 + 下载按钮。
- `components/chat/DeploymentCard.vue`（新）：消费 deployment store 状态机；confirm/cancel 按钮调 `deploymentStore.submit` / `cancel`。
- `components/chat/CoordinatorKickoffCard.vue` / `CoordinatorSummaryCard.vue`（新）：PM 项目群 kickoff 与 summary 卡片。
- 单元测试：组件 mount 真实 store，断言渲染 status/binding/tasks/artifacts/deployment。

### 4.6 pages 改造

- `pages/agents/index.vue` / `new.vue` / `detail.vue`：切到 `useAgentStore`。
- `pages/files/index.vue` / `preview.vue`：切到 `useFileStore`。
- `pages/settings/index.vue` / `notification.vue` / `devices.vue` / `theme.vue` / `about.vue`：全部切到 `useSettingsStore`；接不上后端的能力显示 unavailable + 写注释 + 跳 im_web 链接（V3-42 §4.4 同样门禁）。
- `pages/login/index.vue` 二维码登录：接后端；后端无能力时显示 unavailable。
- 验证：每页 mount 真实 store 后渲染空态 / 正常态。

### 4.7 UI-only 能力兜底

`agenthub_ui` 现有大量 UI-only 能力**没有后端**：

- 二维码登录：若后端无 `authApi.generateQrToken` / `authApi.pollQrStatus`，**显式 unavailable**（写注释 "TBD: 后端尚未提供二维码登录 API"），不假装可用。
- 通知权限：浏览器 `Notification.requestPermission()` + `useSystemNotification` 真实可用，但要校准前后端权限映射。
- skill 上传：multipart 上传到 `clowderApi.uploadSkill`，没有则 unavailable。
- 设备管理：若后端无 `userApi.listDevices` / `kickoutDevice`，**显式 unavailable**。
- 主题：保持本地持久化即可（不需要后端）。

兜底原则：所有"接不上"的按钮显示 unavailable tooltip + 点击不响应 + 写注释 "TBD"。**不允许**用 `setTimeout` 假装成功。

### 4.8 fixture 清废

- `stores/agent.js` 删除 7 个硬编码 agent + 5 个 skill 模板。
- `stores/clowder.js` 启动时为空，靠 `fetchAgentDirectory` / `bootstrap` 拉真实。
- `IS_DEMO=true` 时（开发态）保留 fixture 在 `demo.*` 字段；`IS_DEMO=false`（生产）完全无 mock。
- 任何 `state()` 内的硬编码 active agents / progress / tasks 全部清空（V1-2 阶段 ClowderPanel 已显示 unavailable / loading，V1-3 阶段接真实数据）。

## 5. 分阶段实施计划

### 阶段 1：Clowder store 落地

目标：

- `stores/clowder.js` 完整实现：state + action 全套对齐 im_web `useClowderStore`。
- `clowderApi` 封装：`request` 走 V1-1 阶段落的 `utils/request.js`，URL 拼 `IM_WEB_API_BASE`。
- `capabilities` 失败态映射完整：oauthEnabled / runtimeAvailable / queueFull / groupDenied。
- `kickoffPolling` 用 V1-2 引入的 HMR-safe timer composable。
- 单元测试：create/connect cat、binding 状态机、kickoff polling 启停、capabilities 失败态。

阶段完成必须中文 commit，例如：

```text
V1-3 阶段1：agenthub_ui Clowder store 完整接入
```

### 阶段 2：智能体 store 真实化

目标：

- `stores/agent.js` 重写：删 7 个硬编码 agent + 5 个 skill 模板；加 `fetchAgentDirectory` / `fetchSkills` / `createCat` / `connectCat` / `disconnectCat` / 字段映射。
- `pages/agents/index.vue` / `new.vue` / `detail.vue` 切到真实 store。
- 单元测试：覆盖 fetchAgentDirectory / createCat / connectCat / disconnectCat / 字段映射 / 删 fixture。

阶段完成必须中文 commit，例如：

```text
V1-3 阶段2：智能体 store 真实化与 pages 改造
```

### 阶段 3：Deployment / ProjectGroup / File / Settings store

目标：

- `stores/deployment.js` / `stores/projectGroup.js` 状态机 + 轮询 + confirm/cancel。
- `stores/file.js` 扩 upload/download/list/preview URL 解析。
- `stores/settings.js` 重写：notificationPermission / devices / qrLoginToken / uploadSkill / theme。
- `pages/files/*` / `pages/settings/*` 切到真实 store；接不上的能力显示 unavailable + 写注释。
- 单元测试：覆盖 deployment / projectGroup / file / settings 全部 CRUD + 失败态。

阶段完成必须中文 commit，例如：

```text
V1-3 阶段3：Deployment ProjectGroup File Settings store 接入
```

### 阶段 4：ClowderPanel / Kanban / Artifacts / DeploymentCard 组件

目标：

- `components/chat/ClowderPanel.vue` 完整重写为真实 store 消费方；删除 activeAgents/progress/setTimeout mock。
- 新建 `components/chat/ProjectKanbanPanel.vue` / `ProjectArtifactsPanel.vue` / `DeploymentCard.vue` / `CoordinatorKickoffCard.vue` / `CoordinatorSummaryCard.vue`。
- 单元测试：组件 mount 真实 store，断言渲染 status / binding / tasks / artifacts / deployment / capability 失败态。

阶段完成必须中文 commit，例如：

```text
V1-3 阶段4：Clowder Kanban Artifacts Deployment 组件化
```

### 阶段 5：UI-only 能力兜底与 fixture 清废

目标：

- 盘点所有 UI-only 按钮（扫码登录、通知权限、skill 上传、设备管理、API Key 提交等），逐个标注"已接后端"或"unavailable TBD"。
- 删除 `stores/agent.js` / `stores/clowder.js` 等所有 fixture（IS_DEMO=false 时）。
- `pages/login/index.vue` 二维码登录：接后端或显式 unavailable。
- 跑 `grep -r "setTimeout" sections/agenthub_ui --include="*.vue" --include="*.js"` 确认 V1-2 阶段漏掉的 setTimeout 都已清（ClowderPanel 的 setTimeout 已在阶段 1 删）。
- 单元测试：unavailable 状态断言；fixture 删除后 `IS_DEMO=false` 时 store 启动为空。

阶段完成必须中文 commit，例如：

```text
V1-3 阶段5：UI-only 能力兜底与 fixture 清废
```

### 阶段 6：自动化回归与真实 H5 验收

目标：

- `pnpm test:unit` / `pnpm build:h5` 全绿。
- 现有 Playwright `smoke-*.spec.ts` 全部通过；V1-3 新增：
 - `smoke-clowder-onboarding.spec.ts`：注册/登录 → 创建 cat（Claude Code 优先）→ 拉 agent directory 真实 → 列出 status。
 - `smoke-project-group.spec.ts`：用户向 PM 发项目任务 → PM 创建项目群 → 拉用户 + worker cats → 群内 Kanban/artifacts 真实可见。
 - `smoke-deployment-card.spec.ts`：用户触发 deployment → deployment card 状态机推进 → 终态 success/fail。
- 真实 H5：从 `seedcmp` 根 `bash scripts/start-im-clowder.sh start`，`pnpm dev:h5` 起 agenthub_ui；完成以下真实验收：
 1. 注册/登录（V1-1）→ 主页。
 2. 创建/选择 OAuth cat（Claude Code 优先）→ agent directory 真实显示。
 3. 打开 direct cat chat，发任务 → cat 真实回包（V1-2 已建，本阶段跑一遍）。
 4. 打开 PM/coordinator，发项目任务 → PM 创建项目群 → 拉用户 + worker cats → worker 输出进入项目群 → Clowder 面板 / Kanban / artifacts / deployment 全部可见。
 5. 设备管理 / 通知权限 / 二维码登录 / skill 上传逐个验证：接得上跑通，接不上显式 unavailable。
 6. 与 im_web `http://localhost:3000` 同账号两端比对，cat 列表 / 项目群 / Kanban / artifacts 一致。
 7. 保存截图、请求/响应日志、user/会话/群/cat/coordination/artifact id 到 `sections/agenthub_ui/.ai/tests-e2e/v1-3-<timestamp>/`。

阶段完成必须中文 commit，例如：

```text
V1-3 阶段6：Clowder V3 与功能完善真实 H5 验收完成
```

## 6. 测试与验收清单

- Unit：
 - `clowder` store：create/connect cat、binding 状态机、kickoff polling 启停、capabilities 失败态、project group confirm/cancel、deployment submit/cancel。
 - `agent` store：fetchAgentDirectory / createCat / connectCat / disconnectCat / 字段映射 / 删 fixture。
 - `deployment` / `projectGroup` / `file` / `settings` 全部 CRUD + 失败态。
 - 组件：ClowderPanel / KanbanPanel / ArtifactsPanel / DeploymentCard mount 真实 store 后渲染。
 - unavailable 状态：UI-only 能力接不上时显式 unavailable，fixture 删除后 IS_DEMO=false 启动为空。
- E2E：
 - clowder onboarding（注册/登录/创建 cat/拉 agent directory）；
 - project group（PM 创建项目群 + worker cat 入群 + Kanban/artifacts 真实可见）；
 - deployment card（状态机推进 + 终态）；
 - agenthub_ui ↔ im_web 双端 cat / 项目群 / Kanban / artifacts 一致。
- Live：
 - `bash scripts/start-im-clowder.sh start` + `pnpm dev:h5`；
 - 真实用户、真实 OAuth 猫猫、Claude Code 优先；
 - 保存 evidence、ids、runtime choice、OAuth status、capability failures。

## 7. 风险与回滚

- **风险：Clowder store 庞大，初期 bug 多。** 处理：阶段 1 单元测试覆盖所有 action；阶段 6 跑完整 E2E 兜底；保留 feature flag。
- **风险：kickoff polling 资源泄露。** 处理：用 V1-2 引入的 HMR-safe timer composable；HMR dispose 强制 stop。
- **风险：UI-only 能力大量 unavailable 影响体验。** 处理：在每页加"TODO: 后端待提供"提示，引导跳 im_web；不要假装可用。
- **风险：fixture 删除后未迁移页面读不到数据。** 处理：所有 store 初始化空 + bootstrap 拉；调用方判空渲染空态。
- **风险：capabilities 失败态映射不全，UI 假装可用。** 处理：capabilities 状态机 + 单元测试覆盖 oauthEnabled / runtimeAvailable / queueFull / groupDenied；UI 必须显式提示。
- **风险：与 im_web 端 cat / 项目群状态不一致。** 处理：所有 cat 拉取走 clowderApi，不维护本地副本；`addOrUpdate` 由 realtime CMD 触发。

## 8. 完成定义

V1-3 只有同时满足以下条件才算完成：

- `clowder` / `agent` / `deployment` / `projectGroup` / `file` / `settings` store 全部真实化；`agent` 原 7 个硬编码 agent + 5 个 skill 模板已删（IS_DEMO=false 时）。
- ClowderPanel / KanbanPanel / ArtifactsPanel / DeploymentCard / CoordinatorKickoffCard / CoordinatorSummaryCard 组件全部接真实 store。
- 真实 H5 验收：用户向 PM 发项目任务 → PM 创建项目群 → 拉用户 + worker cats → worker 输出进入项目群 → Clowder 面板 / Kanban / artifacts / deployment 全部可见且与 im_web `http://localhost:3000` 一致。
- OAuth cat 真实创建/连接，Claude Code 优先。
- capabilities 失败态（oauthEnabled / runtimeAvailable / queueFull / groupDenied）映射完整且 UI 显式可见。
- UI-only 能力（二维码登录 / 通知权限 / skill 上传 / 设备管理 / API Key 提交）接得上跑通，接不上显式 unavailable + 写注释。
- 草稿 / 未读 / 隐藏 / 已删持久化生效。
- V1-1 / V1-2 验收脚本继续通过。
- `pnpm test:unit` / `pnpm build:h5` 通过；Playwright 全部 spec 通过。
- 截图、请求/响应日志、user/会话/群/cat/coordination/artifact id 证据完整。
- 每个阶段都有对应中文 commit。
