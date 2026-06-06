# V3-42 计划：用 agenthub_ui 新版视觉对齐并替换 IM Web 表层 UI

## 0. 强制执行门禁

本计划执行时必须遵守以下硬性要求：

1. **阶段提交**：每完成一个阶段的实现、测试修复或文档补充，必须立即做一次中文 commit。不要把多个阶段堆到最后一起提交。
2. **本地服务启动**：最终验收前必须在 `seedcmp` 根目录执行：

   ```bash
   bash scripts/start-im-clowder.sh start
   ```

3. **真实 Web 验收**：必须打开 `http://localhost:3000` 进入 IM Web 做真实操作，不允许只依赖单元测试、接口 mock 或静态截图。
4. **账号可自理**：可以使用已有测试用户登录，也可以主动创建新用户；验收记录中要写清楚使用的用户 id、会话 id、群 id。
5. **真实猫猫调用**：必须在 Web 端真实创建或选择 Clowder cat，选择 OAuth 登录方式。
6. **运行平台优先级**：创建/选择猫猫时运行平台优先 `Claude Code`；如果本机能力或 OAuth 配置不可用，再降级为 `Codex`，并在验收记录中写明原因。
7. **真实派发任务**：必须在 Web 端向 PM/coordinator 或猫猫真实派发任务，等待真实猫猫输出，并验证新版 UI 中的消息、成员、面板、文件/产物展示。
8. **证据留存**：浏览器验收要保存截图、关键日志、用户/会话/群/猫猫 id、任务文本、运行平台、OAuth 状态和失败诊断，建议放在 `sections/im_web/.ai/V3.0/tests-e2e/v3-42-<timestamp>/`。

## 1. 不足检查结论

`sections/agenthub_ui` 的优势是视觉与交互覆盖更完整：移动端/桌面布局、底部导航、右侧工作区、文件预览、智能体页、设置页、成员资料、输入区和大量视觉 QA 记录已经成型。但它不能直接替换 `sections/im_web` 的生产 UI，因为核心运行时仍未对齐：

- **工程栈不一致**：`agenthub_ui` 是 uni-app/Vue3/JS 工程，入口是 `main.js` + `pages.json` + `uni.*` API；`im_web` 是 pnpm workspace + Vue3/Vite/TS，依赖 `@tsdaodao/*` 包、Arco、Vue Router 和 `wukongimjssdk`。
- **数据源仍是 fixture/mock**：`agenthub_ui/stores/conversation.js`、`stores/message.js`、`stores/agent.js` 内置静态会话、静态消息、静态智能体；登录写入 `mock_token_abc123`；文件页、加好友、建群、Clowder 面板等存在模拟延迟或 UI-only 状态。
- **真实 IM 链路缺失**：新版 UI 没接 `WKSDK`、TangSeng sync APIs、远端会话恢复、历史分页、未读清理、踢下线、草稿跨设备同步、typing CMD、消息 ack/dedup/stream merge。
- **Clowder V3 能力缺失**：新版 `ClowderPanel.vue` 只模拟 active agents 和 progress；没有使用 `clowderApi` / `useClowderStore`，缺少真实 status、binding、agent directory、OAuth capabilities、group cats、focus、permissions、project group、coordination、Kanban、artifacts、deployment cards。
- **安全与权限边界未对齐**：新版智能体创建页展示 API Key/OAuth 表单，但没有后端 mediated OAuth、local CLI capability 检查、密钥隔离、群白名单/admin command 权限和失败态映射。
- **测试体系不兼容**：`agenthub_ui` 有 H5 smoke/截图脚本和大量视觉 QA 记录，但没有覆盖 `im_web` 的 V3 单元测试、Clowder contract tests、TangSeng bridge、真实 localhost:3000 Web 验收和 OAuth 猫猫输出。
- **可迁移资产明确**：可迁移的是布局结构、视觉 tokens、移动端输入/导航模式、文件预览实现思路、成员资料/智能体卡片/设置页 UI；不可迁移的是 mock stores、mock login、UI-only Clowder 状态和独立 uni-app 路由运行时。

结论：替换方向应是 **以 `im_web` 为真实运行时和数据源，分阶段迁入 `agenthub_ui` 的视觉与交互层**，而不是把 `agenthub_ui` 独立工程直接覆盖 `im_web`。

## 2. 根因假设

1. `agenthub_ui` 最初按 UI 优化/跨端样板推进，优先完成页面覆盖和视觉 QA，因此用 Pinia fixture 快速闭环。
2. `im_web` 同期推进 V3 Clowder 真链路，功能密度高但视觉仍是旧 workbench 风格，未吸收新版 UI 组件体系。
3. 两边没有共同的 UI adapter contract：新版组件依赖 `conversation.id/type/name` 等轻量模型，`im_web` 组件依赖 TangSeng/WuKongIM 的 `channel_id/channel_type/content` 与 Clowder V3 payload。
4. Clowder PM 项目群、artifact、deployment、OAuth cat 等能力在 `im_web` 中持续演进，`agenthub_ui` 未同步真实 API 类型和验收门禁。

## 3. 影响模块

- `sections/im_web/apps/chat/src/layouts/MainLayout.vue`
- `sections/im_web/apps/chat/src/views/ChatView.vue`
- `sections/im_web/apps/chat/src/views/ConversationList.vue`
- `sections/im_web/apps/chat/src/components/MessageList.vue`
- `sections/im_web/apps/chat/src/components/MessageInput.vue`
- `sections/im_web/apps/chat/src/components/ChatSidePreview.vue`
- `sections/im_web/apps/chat/src/components/ClowderConversationPanel.vue`
- `sections/im_web/apps/chat/src/views/GroupMemberList.vue`
- `sections/im_web/packages/base-vue/src/components/messages/*`
- `sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue`
- `sections/im_web/packages/datasource-vue/src/stores/*`
- `sections/im_web/apps/chat/tests/` 和 `sections/im_web/apps/chat/tests-e2e/`
- 视觉参考源：`sections/agenthub_ui/components/`、`pages/`、`styles/`、`issues/001-im-web-ui-optimization-qa.md`

## 4. 推荐设计

### 4.1 保留真实运行时

`im_web` 继续作为唯一线上入口，保留：

- Vue Router 路由模型；
- `@tsdaodao/base-vue`、`@tsdaodao/datasource-vue`、`@tsdaodao/contacts-vue` 包边界；
- `WKSDK` 监听、消息发送、CMD、ack、history recovery、dedup；
- TangSeng API、Clowder API、OAuth cat、PM 项目群和 V3 E2E。

不把 `agenthub_ui` 的 `pages.json`、`uni-app` runtime、mock Pinia store、mock login 迁入 `im_web`。

### 4.2 新增 UI adapter 层

在 `im_web` 中新增轻量 adapter/composable，把真实 store 数据映射到新版 UI 所需的 view model：

- conversation view model：名称、头像、unread、pinned、muted、draft、last message、channel ref；
- message view model：sender、direction、content type、status、reply、reaction、file/image preview、Clowder metadata；
- member/agent view model：真实群成员 + Clowder cat members + PM/coordinator identity；
- workspace view model：preview / Clowder / Kanban / artifacts / deployment tab 状态。

adapter 只做字段归一化，不接管数据源、不写 mock。

### 4.3 分层替换 UI

按 blast radius 从外到内替换：

1. shell/tokens/navigation；
2. conversation list；
3. chat header/right workspace；
4. message list/message cells；
5. input/mention/attachments/voice；
6. contacts/groups/agents/settings 子页面；
7. Clowder panel/Kanban/artifacts/deployment cards；
8. 文件/图片/Office/HTML/Markdown preview。

每一层都必须保留现有真实行为测试，并补足视觉截图。

### 4.4 只迁移可验证组件

迁移 `agenthub_ui` 组件时必须满足：

- 组件输入来自 `im_web` adapter 或真实 store；
- 所有按钮有真实 action、禁用态或明确 unavailable state；
- 不允许 `setTimeout` 伪造发送/进度作为真实链路；
- 不允许 `mock_token`、静态 agents、静态 messages 流入 `im_web`；
- 文件预览可复用实现思路，但需要经过 `im_web` media URL、安全 sandbox、上传/下载边界，并在阶段 4 跑 V3-41 图片非空 preview/lightbox 回归。

## 5. 分阶段实施计划

### 阶段 1：建立替换基线和差异矩阵

目标：

- 对照 `agenthub_ui` 页面/组件/stores 与 `im_web` 当前路由/组件/stores，形成迁移矩阵。
- 标记每个新版 UI 模块为：直接迁移、改造迁移、仅参考、不迁移。
- 为 shell、chat、message、input、Clowder、files 六个核心区域补 characterization tests 或现有测试清单。

产出：

- `V3-42` 差异矩阵文档或本计划补充段落。
- `im_web` 当前视觉和功能基线截图。
- 当前可运行测试命令记录。

阶段完成后必须中文 commit，例如：

```text
梳理新版 UI 替换差异矩阵
```

### 阶段 2：迁入设计 tokens、shell 和响应式导航

目标：

- 将 `agenthub_ui/styles/tokens.scss`、`themes.scss`、`layout.scss` 中可用的视觉变量迁入 `im_web` base styles。
- 改造 `MainLayout.vue`，采用新版桌面 workbench 与移动 list/detail 导航，但继续使用 Vue Router 和真实登录态。
- 保留 connection banner、kickout overlay、recovery sync、搜索入口和现有聊天/联系人 tab。

关键点：

- 不引入 uni-app API；安全区和移动布局用 Web CSS + viewport 处理。
- mobile bottom nav 只暴露真实可达模块；暂未接好的模块显示明确 disabled/unavailable。

阶段完成后必须中文 commit，例如：

```text
迁入新版 IM 外壳与响应式导航
```

### 阶段 3：替换会话列表与聊天头部

目标：

- 用新版 `ConversationItem` 视觉替换 `ConversationList.vue` 的行展示。
- 保留真实会话排序、置顶、免打扰、未读、草稿、@、隐藏/删除、远端 sync、clear unread。
- 聊天头部采用新版密度和移动返回模式，群聊可进入成员/设置，直聊可打开资料，Clowder 可打开真实面板。

关键点：

- conversation adapter 必须覆盖 TangSeng 字段，不让新版 fixture 的 `type: 'robot' | 'group'` 简化模型丢失 `channel_type`。
- 列表摘要必须兼容 Clowder cat identity、file/image/system/revoked/deployment/project-group handoff。

阶段完成后必须中文 commit，例如：

```text
替换真实会话列表和聊天头部视觉
```

### 阶段 4：替换消息列表、消息气泡和右侧工作区

目标：

- 将新版消息气泡、时间分割、上下文菜单、头像菜单、reaction、reply 视觉迁入真实 `MessageList.vue` / base message cells。
- 保留 `im_web` 的历史窗口、load earlier、streaming merge、Clowder payload、deployment card、project group handoff、coordinator summary。
- 右侧工作区采用新版 profile/file/agent pane 结构，但数据来自真实 `ChatSidePreview`、`ClowderConversationPanel`、member/cat stores。

关键点：

- 不回退到 `scroll-view`/uni 组件；使用 Web DOM 保留 Playwright 和现有虚拟滚动/滚动恢复能力。
- 图片消息的非空 preview 与 lightbox 在本阶段必须作为硬性回归：消息气泡在图片消息未加载完成、加载失败或后端返回无图时必须显式可见占位/重试入口，避免空泡或占位错乱（与 V3-41 image messages blank 互锁）。

阶段完成后必须中文 commit，例如：

```text
替换真实消息列表与右侧工作区视觉
```

### 阶段 5：替换输入区、@、附件和语音交互

目标：

- 迁入新版桌面 toolbar + 移动双行输入布局。
- 保留真实文本发送、reply、edit/revoke、typing CMD、机器人菜单、AI draft、Clowder route、PM project-group confirmation、deployment intent。
- 图片/文件选择接 `im_web` 真实上传和 content type，不使用 mock image/file。
- 语音能力保留当前 Web 可用 MediaRecorder，不支持时给明确 unavailable state。

关键点：

- 中文 IME composition、草稿跨设备同步、发送失败重试、空发送禁用必须保留测试。
- @ 提及必须合并真实 group members 与 Clowder cat members，不能只按 nickname 文本替换。

阶段完成后必须中文 commit，例如：

```text
替换真实消息输入与附件交互
```

### 阶段 6：迁移联系人、群、智能体、设置和文件页面

目标：

- 将 `agenthub_ui` 的联系人卡、成员资料、智能体卡、设置分组、文件列表视觉迁入 `contacts-vue`、`apps/chat` 对应页面。
- 真实接入 friend requests、add friend、blacklist、group create/member list、device management。
- 智能体创建页以 `ClowderCatConsolePage.vue` 为真实行为源，吸收新版 UI 的 platform/access mode/model/skill 展示，但 OAuth capability 和 create/connect 走 `useClowderStore`。
- 文件/preview 迁移时保留 sandbox、安全净化、下载/外部打开、真实 asset URL 解析。

关键点：

- 二维码、上传 skill、通知权限等原 `agenthub_ui` UI-only 能力不得假装可用；没有真实后端时标为 unavailable。

阶段完成后必须中文 commit，例如：

```text
迁移联系人智能体设置和文件页面视觉
```

### 阶段 7：真实 Clowder 面板和项目工作区视觉替换

目标：

- 用新版协作网络视觉重做 `ClowderConversationPanel.vue`，但保留真实 status、binding、agent directory、focus、group auto reply、project group binding、coordination、Kanban、artifacts、deployment。
- PM direct chat 中的项目群 handoff/link、项目群成员、worker agent 输出、Kanban/artifacts 必须在新版 UI 中可见。
- 新版 agent board/log 视觉可以迁入，但必须绑定真实 thread/workspace/task/artifact 数据。

关键点：

- 不允许模拟 progress；progress/status 只能来自真实 coordination/task state。
- Clowder unavailable、group denied、queue full、OAuth missing、runtime unavailable 等失败态必须可见。

阶段完成后必须中文 commit，例如：

```text
替换真实 Clowder 协作面板视觉
```

### 阶段 8：自动化回归与真实 Web 验收

目标：

- 更新/新增 unit tests 覆盖 adapter、conversation rows、message cells、input behavior、Clowder panel、file preview。
- 更新 Playwright 覆盖桌面 1440x900、1024x768、移动 390x844/375x844。
- 执行真实 Web Clowder 验收。

建议命令：

```bash
cd sections/im_web
pnpm test:unit
pnpm type-check
pnpm build
pnpm test:e2e
```

最终必须从 `seedcmp` 根目录执行：

```bash
bash scripts/start-im-clowder.sh start
```

然后打开 `http://localhost:3000` 完成以下真实验收：

1. 登录或创建测试用户，记录 user id。
2. 创建/选择 OAuth 猫猫，优先 `Claude Code`，不可用再用 `Codex` 并记录原因。
3. 打开 direct cat chat，发送文本、图片/文件、长任务，确认消息/preview/streaming 非空且刷新后保留。
4. 打开 PM/coordinator，发起项目任务，确认 PM 创建项目群、用户在群内、猫猫在群内、worker 输出进入项目群。
5. 在项目群查看新版 Clowder 面板、Kanban、artifacts、成员资料和右侧 workspace。
6. 验证移动视口下列表/详情/输入/右侧面板没有遮挡或横向溢出。
7. 保存截图、日志和 ids 到 `sections/im_web/.ai/V3.0/tests-e2e/v3-42-<timestamp>/`。

阶段完成后必须中文 commit，例如：

```text
完成新版 UI 真实 Web 验收
```

## 6. 测试与验收清单

- Unit/component：
  - adapter 把真实 TangSeng conversation/message 转成新版 UI view model；
  - 会话行覆盖 unread/pinned/muted/draft/@/Clowder/file/image/system；
  - 消息气泡覆盖 text/image/file/voice/video/card/system/revoked/Clowder/deployment/project handoff；
  - 输入区覆盖 IME、草稿同步、reply、mention、attachment unavailable、send failure；
  - Clowder panel 覆盖 status/binding/focus/group cats/project group/coordination/Kanban/artifacts。
- E2E：
  - 登录、会话同步、历史分页、刷新恢复；
  - direct cat chat、group cat chat、PM project group；
  - OAuth cat create/connect，Claude Code 优先；
  - file/image preview 和 V3-41 图片非空 preview/lightbox 回归；
  - desktop/mobile responsive screenshots。
- Live：
  - `bash scripts/start-im-clowder.sh start`；
  - `http://localhost:3000` 真实 UI 操作；
  - 保存 evidence、ids、runtime choice、OAuth status。

## 7. 风险与回滚

- **风险：视觉替换破坏真实消息链路。** 回滚方式：每阶段小步提交；保留旧组件入口或 feature flag，失败时回退当阶段 commit。
- **风险：uni-app 组件/样式无法直接进入 Web Vite。** 处理：只迁移设计和结构，不迁移 `view/scroll-view/text` runtime；用 Web DOM/Vue SFC 重写。
- **风险：新版 UI 简化模型导致 Clowder payload 丢字段。** 处理：adapter tests 锁定 channel/message/content metadata，不允许组件直接消费 mock shape。
- **风险：视觉 QA 通过但真实 Clowder 不通。** 处理：最终验收必须真实 OAuth cat + PM 项目群输出，API-only/mock/static screenshot 不算通过。
- **风险：替换范围过大导致长时间不可用。** 处理：按 shell/list/message/input/Clowder 子系统分阶段，每阶段都能独立回归和提交。

## 8. 完成定义

V3-42 只有同时满足以下条件才算完成：

- `im_web` 仍是唯一真实入口，`agenthub_ui` 不再作为替代运行时依赖。
- 主要视觉体验已采用新版 UI：shell、会话列表、聊天详情、消息气泡、输入区、右侧工作区、Clowder 面板、联系人/群/智能体/设置/文件页面。
- 所有迁入组件都接真实 store/API，没有 mock token、静态会话、静态智能体或模拟 Clowder progress 流入生产路径。
- `pnpm test:unit`、`pnpm type-check`、`pnpm build` 通过，相关 Playwright smoke 通过或阻塞原因明确。
- localhost:3000 真实 Web 验收通过：真实用户、真实 OAuth 猫猫、Claude Code 优先、真实 PM/cat 输出、项目群链路、刷新恢复和截图/日志/ids 证据完整。
- 每个阶段都有对应中文 commit。
