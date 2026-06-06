# AgentHub UI V1 PRD

## 1. 产品定位

AgentHub UI V1 是一个基于 uni-app + Vue3 + Pinia 的多端协同通讯客户端，面向 Web/H5 与未来 Android APP-PLUS。它承接 im_web/TangSeng 的真实 IM 能力，并把 Clowder 多智能体协作、项目群、文件、部署与设置能力纳入同一套移动友好的 AgentHub 工作台。

V1 的核心目标不是做演示壳，而是把已经成型的 UI 接到真实 seedcmp 后端：用户登录后看到真实会话、真实群、真实消息、真实智能体能力边界；后端没有提供的功能必须显示 unavailable，不允许用 mock 或延迟动画假装成功。

## 2. 用户与场景

目标用户：

- 需要在移动端或轻量 Web 端跟进团队/智能体协作的用户。
- 使用 im_web 的现有用户，希望在 AgentHub UI 中看到一致的会话、群聊、项目群和文件信息。
- 需要和 Clowder cat、PM/coordinator、项目群协作的用户。

核心场景：

1. 用户用真实账号登录 AgentHub UI。
2. 用户进入聊天工作台，看到与 im_web 一致的会话列表。
3. 用户打开 direct cat、PM 或项目群，继续真实 IM/Clowder 协作。
4. 用户查看智能体目录、文件、设置、设备等能力；未接通后端的能力被明确标识。
5. 移动端用户在 375px 宽度下仍能顺畅浏览会话和进入详情。

## 3. V1 范围

### In Scope

- 真实 auth：登录、注册、token 持久化、登出、refresh/kickout 基础处理。
- 真实 user：当前用户资料、用户缓存、登录态恢复 fallback。
- 真实 IM credential：拉取 `users/{uid}/im`，初始化 WKSDK/WebSocket。
- 真实会话：`conversation/sync` + `group/my` + `message/channel/sync` 合并。
- 真实消息：消息同步、发送入口、实时入库、去重、撤回/编辑/reaction 基础接口。
- IM 动作：typing、撤回、reaction、清未读必须走真实 SDK/API 或真实本地状态合并，不允许只改 UI。
- 真实群：我的群、群资料、成员、建群/退出/解散接口。
- 真实 Clowder：cat directory、capabilities、conversation binding、group cats、project group、deployment API。
- 真实文件：文件列表、预览入口、不可用状态；未接入真实上传/下载时必须 explicit unavailable。
- 设置：设备、二维码登录、skill 上传、通知状态；不可用时显式 unavailable。
- 多端适配：H5 已验收；代码层使用 uni storage/request 抽象兼容 APP-PLUS。

### Out Of Scope / 明确边界

- Android 真机安装包验收不属于本轮已完成证据。
- 后端未提供或本机不可用的 OAuth/二维码/skill 能力不做本地 mock。
- 未接入真实上传、下载、二维码生成、联系人分组等能力时不展示伪造成功、伪造进度或可扫描占位码。
- 本轮不重写视觉系统；保持现有 AgentHub UI 风格与 responsive layout。

## 4. 功能需求

### FR-1 登录与登录态

- 用户可以用手机号/用户名 + 密码登录。
- 登录请求必须走 `user/login`。
- 登录成功后保存 token、uid、loginInfo，并拉取 user/me 与 IM ws 地址。
- 刷新 H5 后可恢复登录态。
- 登录失败显示真实错误。
- 不允许写入 mock token。

验收：

- 真实账号登录成功，进入聊天页。
- local storage/uni storage 中存在真实 token。
- WebSocket 连接成功。

### FR-2 会话列表

- 会话列表必须来自真实后端。
- `conversation/sync` 返回的 `users/groups` 必须用于名称、头像、置顶、免打扰映射。
- 秒级 timestamp 必须归一化到毫秒，不能显示 1970。
- `group/my` 返回的群必须补入会话列表。
- 群会话应通过 `message/channel/sync` 获取最新摘要。

验收：

- agenthub_ui 与 im_web 均显示 `V340项目群06101256`。
- 最新摘要为 `[文件] acceptance-result.json`。
- 页面无“未命名会话”和 1970。

### FR-3 消息与实时链路

- 登录后初始化 WKSDK。
- 入站消息映射为 AgentHub UI 既有 `MessageBubble` 字段。
- pending 消息通过 client msg no 去重/合并。
- direct/group channel key 必须稳定。
- 消息时间使用毫秒时间。
- typing 使用 WKSDK CMD。
- 撤回必须支持服务端 message id 与 client msg no 匹配。
- reaction 必须使用消息真实 channel type。
- 清未读必须本地清零并向后端提交 read cursor。

验收：

- WebSocket console 显示成功连接。
- 真实历史消息可作为会话摘要显示。
- 单测覆盖实时入库去重与字段稳定性。
- E2E 覆盖 agenthub_ui 发消息后 im_web 无刷新收到。

### FR-4 Clowder 与智能体

- Agent directory 从 Clowder 后端读取。
- 创建/连接/断开 cat 走真实 API。
- OAuth/runtime/queue/groupDenied 等能力失败态必须在 store/UI 可见。
- 项目群、deployment、artifacts/tasks 走 Clowder API。

验收：

- `stores/agent.js` 默认无硬编码 agent fixture。
- `stores/clowder.js` 能拉 capabilities 并暴露 disabledReason。
- 后端不可用时显示 unavailable，不伪造成功。

### FR-5 文件与设置

- 文件列表、预览走真实 file API。
- 上传、下载未接入真实选择/下载能力时必须 explicit unavailable。
- 设备列表/删除走真实 auth API。
- 二维码登录与 skill 上传能接则接；接不上必须 unavailable。
- 个人二维码、群二维码未接真实 token/二维码生成接口时必须 unavailable，不允许绘制占位二维码并提示成功。
- 通知设置保留本地持久化。

验收：

- store 启动不含伪造业务数据。
- unavailable 状态有明确 reason/message。

### FR-6 多端 UI

- 桌面 1440x900：左侧工作台 + 会话列表 + 右侧空态/详情稳定。
- 移动 375x844：顶部导航、通知条、列表、底部 tab 无遮挡。
- 文本长摘要必须省略，不能撑破列表。

验收：

- 桌面/移动截图无白屏、无明显重叠、无关键文本溢出。

## 5. 非功能需求

- 真实网络：不接 mock server。
- 错误可见：后端失败显示真实错误或 unavailable。
- 测试保护：核心 mapper/request/auth/user/im/conversation/clowder 逻辑有单测。
- 构建可靠：`npm run build:h5` 必须成功。
- 安全：验收文档不记录完整 token/密码。
- 可移植：H5 使用 fetch，非 H5 可走 `uni.request`；storage 走 uni/localStorage fallback。

## 6. 验收标准

必须通过：

1. `npm run test:unit` 通过。
2. `npm run build:h5` 通过。
3. `npm run test:e2e:realtime` 通过并保存截图、events、WS frames。
4. 真实 H5 登录成功。
5. agenthub_ui 与 im_web 对照关键会话一致。
6. 项目群、PM、Clowder AI 会话可见。
7. 无 `未命名会话` / `1970`。
8. 浏览器无 pageerror、requestfailed、HTTP 4xx/5xx。
9. 截图证据保存到 `issues/screenshots/` 或 `.ai/tests-e2e/`。
10. V1-3 完成判定还必须提供 OAuth cat、PM 项目群、Kanban/artifacts/deployment card 的真实 live 证据；当前 `.ai/tests-e2e/v1-3-20260606T210434/` 已覆盖 OAuth cat、PM 项目群和 deployment card，Kanban/artifacts 仍需专项 live proof。

## 7. 风险与后续

- Android 真机仍需独立验收。
- Sass/uni alpha 告警需后续依赖升级时处理。
- 二维码、skill 上传等能力要跟后端能力表继续对齐。
- 若 `group/my` 或 `message/channel/sync` 量级扩大，后续需要为群摘要同步加并发限制和缓存。
