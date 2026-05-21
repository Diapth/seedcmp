---
description: "TangSengDaoDaoWeb Vue 3 极简重构 — 依赖有序的任务拆分"
---

# Tasks: TangSengDaoDaoWeb Vue 3 极简重构

**Input**: sections/im_web/.agent/ 下的设计文档
**Prerequisites**: plan.md, spec.md, features.md, api.md, constitution.md, questions.md
**Feature Branch**: `vue3-im-refactor`

**Organization**: 任务按用户故事组织，每个阶段可独立实现和测试。Phase 1/2 为共享基础设施，Phase 3+ 按用户故事优先级（P1→P2→P3）排列。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件、无依赖）
- **[Story]**: 归属的用户故事（如 US1、US2、US3）
- 描述中必须包含精确文件路径

---

## Phase 1: Setup（项目初始化）

**Purpose**: Monorepo 结构、依赖配置、设计系统变量、APIClient 骨架

- [X] T001 创建 pnpm workspaces Monorepo 骨架，packages/ 下建立 base-vue、login-vue、contacts-vue、datasource-vue 四个包，apps/ 下建立 chat 应用，根目录配置 pnpm-workspace.yaml 和 tsconfig.json 跨包引用路径
- [X] T002 [P] 在 base-vue 中创建 `src/styles/variables.css`，实现 constitution.md 极简配色体系（Light: #FFFFFF bg / #F7F7F9 secondary；Dark: #121212 / #1E1E1E；1px hairline #ECECEF / #2C2C2E），并导出 CSS 变量
- [X] T003 [P] 在 base-vue 中创建 `src/styles/base.css`，重置 Arco Design Vue 全局样式：移除 box-shadow、border-radius 统一 2px、全局 transition: all 0.15s ease
- [X] T004 [P] 在 base-vue 中创建 `src/api/client.ts`，封装 axios 实例：baseURL `http://127.0.0.1:8090/v1/`、所有请求自动注入 `token` header（自定义字段，非 Bearer）、DELETE 请求 body 处理、401 响应触发 kickout 流程
- [X] T005 [P] 在 datasource-vue 中创建 `src/stores/sdk.ts`，初始化 WKSDK.shared() 配置（WS Gateway `ws://127.0.0.1:5200`、IM Token 获取路径 `/users/{uid}/im`），**包含心跳保活（30s 间隔 + 3次 Pong 未应答指数退避重连，FR-003）**，导出 SDK 实例供其他包使用
- [X] T006 [P] 在 datasource-vue 中创建 `src/stores/kickout.ts`，实现 isKickedOut Pinia Store 和 KickoutOverlay.vue 组件（不使用 location.reload()），状态变更触发全屏遮罩
- [X] T007 [P] 在 datasource-vue 中创建 `src/composables/useRemoteConfig.ts`，封装 `useRemoteConfig()` composable，获取并缓存 remoteConfig（含 revoke_second=120）
- [X] T008 创建 `apps/chat/src/main.ts` 和 `apps/chat/vite.config.ts`，接入 Arco Design Vue、按 constitution 导入 base-vue styles/index.css、挂载 KickoutOverlay.vue

---

## Phase 2: Foundational（阻塞性基础设施）

**Purpose**: SDK CMD 监听器注册、Sync Engine 集成、消息内容类型注册——在所有用户故事开始前必须完成

**⚠️ CRITICAL**: 在 Phase 2 完成前，任何用户故事均不得开始

- [X] T009 [P] 在 datasource-vue 中创建 `src/stores/conversationStore.ts`，实现会话列表 Pinia Store：字段（conversations[]、pinList[]、drafts{}、unreadMap{}）、addConversation/updateConversation/deleteConversation/movePinned 操作、GET /conversation/sync 增量同步（api_version=1, version=0）、POST /conversation/sync 全量同步
- [X] T010 [P] 在 datasource-vue 中创建 `src/stores/channelStore.ts`，实现 channel Pinia Store：字段（channels{}、members{}）、GET /channel/state 和 GET /channels/:id/:type 封装、成员缓存
- [X] T011 [P] 在 datasource-vue 中创建 `src/stores/messageStore.ts`，实现消息 Pinia Store：字段（messages{} 键为 channelId）、addMessage/updateMessage/deleteMessage/revokeMessage 操作、GET /message/channel/sync 消息同步、POST /message/revoke 撤销（携带本地 timestamp）
- [X] T012 [P] 在 datasource-vue 中创建 `src/cmd/index.ts`，注册全部 14 个 WKSDK CMD 监听器（addCMDListener），分发至对应 Store：
  - `channelUpdate` → channelStore
  - `typing` → messageStore（设置 typing 状态）
  - `groupAvatarUpdate` → channelStore
  - `unreadClear` → conversationStore（PUT /coversation/clearUnread 注意路径 typo）
  - `conversationDeleted` → conversationStore
  - `friendRequest` → 路由跳转或未读红点
  - `friendAccept` → contactStore
  - `friendDeleted` → contactStore
  - `memberUpdate` → channelStore
  - `onlineStatus` → userStore
  - `syncConversationExtra` → conversationStore（同步草稿/置顶等扩展字段）
  - `syncReminders` → 消息提醒
  - `messageRevoke` → messageStore（执行撤销）
  - `userAvatarUpdate` → userStore
- [X] T013 [P] 在 datasource-vue 中创建 `src/contentTypes/index.ts`，调用 `WKSDK.shared().register()` 注册消息内容类型（对齐 plan.md §5 SDK 注册表）：
  - type=1 (text) → TextCell
  - type=2 (image) → ImageCell
  - type=3 (gif) → GifCell
  - type=4 (voice) → VoiceCell（使用 howler.js 播放）
  - type=5 (smallVideo) → VideoCell
  - type=6 (location) → LocationCell
  - type=7 (card) → CardCell
  - type=8 (file) → FileCell
  - type=11 (mergeForward) → MergeCell
  - type=12/13 (lottieSticker) → StickerCell
  - type=1000-2000 (system) → SystemCell（plan.md §3.3 系统消息兜底）
  - type=-1 (time) → TimeCell（时间分割线，plan.md §3.3）
- [X] T014 [P] 在 datasource-vue 中创建 `src/stores/userStore.ts`，实现用户 Pinia Store：字段（currentUser、token、loginInfo）、login()/logout()、isLoggedIn、getUsersByIds() 批量缓存
- [X] T015 [P] 在 datasource-vue 中创建 `src/api/index.ts`，封装全部 API 调用函数：auth.*、user.*、friend.*、group.*、conversation.*、message.*、channel.*、file.*（上传 GET/POST 二步、multipart）、search.*、report.*、workplace.*、robot.*、settings.*（每个函数对应 api.md 中一个 endpoint）
- [X] T016 [P] 在 base-vue 中创建 `src/components/ChannelAvatar.vue`，根据 constitution.md 实现：无占位图片时绘制渐变字母背景（A-Z/a-z/汉字拼音首字母），支持 size prop、group 模式
- [X] T017 [P] 在 base-vue 中创建 `src/components/SkeletonScreen.vue`，骨架屏组件，支持 conversation-item / message-bubble / contact-list 三种预设布局，匹配极简设计

**Checkpoint**: Phase 2 完成——所有 Store、CMD 监听、API 层就绪，用户故事可开始

---

## Phase 3: User Story 1 - IM 聊天核心（Priority: P1）🎯 MVP

**Goal**: 用户可登录、查看会话列表、收发文本消息、查看历史记录

**Independent Test**: 启动 chat 应用 → 登录 → 能看到会话列表 → 发送文本消息 → 对方收到 → 刷新页面消息保留

### Implementation for User Story 1

- [X] T018 [P] [US1] 在 login-vue 中创建 `src/views/LoginPage.vue`，实现登录页：手机号+密码输入、登录按钮、加载态；调用 userStore.login()，成功跳转 /chat
- [X] T019 [P] [US1] 在 login-vue 中创建 `src/stores/loginStore.ts`，实现登录状态机：idle → loading → sms_sent / qr_waiting → logged_in，支持 POST /user/login（username+password）和 POST /user/sms/* 获取验证码（测试码 123456）
- [X] T020 [P] [US1] 在 apps/chat 中创建 `src/router/index.ts`，配置路由：/login → LoginPage.vue，/chat → MainLayout.vue（未登录重定向 /login），/chat/conversation/:channelId
- [X] T021 [P] [US1] 在 apps/chat 中创建 `src/layouts/MainLayout.vue`，主布局：左侧会话列表 + 右侧聊天区域，集成 KickoutOverlay.vue 全局遮罩
- [X] T022 [US1] 在 apps/chat 中创建 `src/views/ConversationList.vue`，会话列表组件：从 conversationStore 读取会话，支持置顶/取消置顶（conversationStore.movePinned）、草稿预览（drafts{}）、未读红点（unreadMap{}）、弱网下显示 skeleton 骨架屏，POST /conversation/sync 刷新
- [X] T023 [US1] 在 apps/chat 中创建 `src/views/ChatView.vue`，聊天主视图：Header 显示频道名（channelStore）、MessageList + MessageInput，监听 messageStore 变化触发滚动
- [X] T024 [P] [US1] 在 base-vue 中创建 `src/components/messages/TextCell.vue`，文本消息气泡（type=1）：文字+emoji 渲染、极简气泡样式（1px hairline border）、长按/右键弹出 ContextMenu.vue
- [X] T025 [P] [US1] 在 base-vue 中创建 `src/components/messages/ImageCell.vue`，图片消息气泡（type=2）：缩略图点击查看大图、加载占位
- [X] T026 [P] [US1] 在 base-vue 中创建 `src/components/messages/SystemCell.vue`，系统消息气泡（type=1000-2000）：居中灰色小字（revoke/revoked/joined_group 等），由 T013 SDK 注册表映射
- [X] T027 [P] [US1] 在 base-vue 中创建 `src/components/messages/TimeCell.vue`，时间分割线气泡（type=-1）：显示消息组时间戳（"今天"、"昨天"、"2024/01/01"），居中灰色小字，用于 MessageList 中按时间分组消息列表（plan.md §3.3；SC-003 58 FPS 长列表场景必需）
- [X] T028 在 apps/chat 中创建 `src/components/MessageList.vue`，消息列表组件：从 messageStore 读取 messages[channelId]，支持按 timestamp 分页加载（触底加载更多）、滚动到底部（新消息）、revoke 消息灰显处理，渲染 TimeCell 时间分割线分组消息
- [X] T029 在 apps/chat 中创建 `src/components/MessageInput.vue`，消息输入框：文本输入（支持 emoji 面板切换）、发送按钮、Enter 发送 Ctrl+Enter 换行，弱网重试逻辑（messageStore.retry）
- [X] T030 [US1] 在 base-vue 中创建 `src/components/ContextMenu.vue`，右键菜单组件：复制文字、回复（引用消息）、撤回（revoke_second 内可见）、多选模式触发，支持 DND 拖拽排序会话列表
- [X] T031 [US1] 实现消息发送流程（在 `apps/chat/src/components/MessageInput.vue` 和 `datasource-vue/src/stores/messageStore.ts` 中）：MessageInput → messageStore.addMessage（本地先展示）→ SDK sendTextMessage → 失败时 retry 逻辑 → revoke_second 内显示撤回按钮

**Checkpoint**: Phase 3 完成——用户可完成登录→会话列表→发送接收文本消息的完整 IM 核心流程

---

## Phase 4: User Story 2 - 联系人与好友（Priority: P2）

**Goal**: 用户可管理联系人、收发好友请求、查看好友列表

**Independent Test**: 登录 → 进入联系人页 → 发送好友请求 → 对方接受 → 双方均可在会话列表看到对方

### Implementation for User Story 2

- [X] T031 [P] [US2] 在 contacts-vue 中创建 `src/stores/contactStore.ts`，实现联系人 Pinia Store：字段（contacts[]、friendRequests[]、blacklist[]）、按 A-Z 分组的 computed 列表、GET /friend/sync（api_version=1, version=0）增量同步
- [X] T032 [P] [US2] 在 contacts-vue 中创建 `src/views/ContactList.vue`，A-Z 拼音联系人列表（使用 pinyin-pro）：按字母分组、快速导航条（A-Z 侧边栏），点击跳转 /chat/conversation/:uid
- [X] T033 [P] [US2] 在 base-vue 中创建 `src/components/FriendRequestItem.vue`，好友请求项：用户头像（ChannelAvatar）、昵称、来源、同意/拒绝按钮，POST /friend/sure（token 字段）
- [X] T034 [US2] 在 contacts-vue 中创建 `src/views/FriendRequestsPage.vue`，好友请求页面：从 contactStore 读取未处理请求，遍历展示 FriendRequestItem 列表
- [X] T035 [US2] 在 contacts-vue 中创建 `src/views/AddFriendPage.vue`，添加好友页：手机号/ID 搜索框，POST /user/search 或 GET /friend/sync，展示搜索结果，发送 POST /friend/apply
- [X] T036 [US2] 在 contacts-vue 中创建 `src/views/BlacklistPage.vue`，黑名单页面：列出已拉黑用户，支持移除（DELETE /friends/:uid，逆向操作）
- [X] T037 [US2] 在 apps/chat 中创建 `src/views/UserProfileDrawer.vue`，用户资料抽屉：从 userStore 查找用户信息、发起聊天、查看朋友圈（占位）

**Checkpoint**: Phase 4 完成——好友请求、A-Z 联系人列表、黑名单功能可用

---

## Phase 5: User Story 3 - 群组管理（Priority: P2）

**Goal**: 用户可创建群聊、管理群成员、设置群信息

**Independent Test**: 登录 → 创建群组 → 添加成员 → 修改群名 → 成员列表显示 → 解散群组

### Implementation for User Story 3

- [X] T038 [P] [US3] 在 datasource-vue 中创建 `src/stores/groupStore.ts`，群组 Pinia Store：字段（groups{}、groupMembers{}）、GET /group/my、GET /groups/:group_no、member 增量同步
- [X] T039 [P] [US3] 在 base-vue 中创建 `src/components/GroupSettingsDrawer.vue`，群设置抽屉：群名/公告编辑、群二维码（GET /group/qrcode）、免打扰/置顶/保存到通讯录/允许邀请等开关（PUT /groups/:group_no/setting）
- [X] T040 [US3] 在 apps/chat 中创建 `src/views/CreateGroupPage.vue`，创建群聊页：多选联系人 → 确认 → POST /group/create（返回 group_no）→ 跳转 /chat/conversation/:group_no
- [X] T041 [US3] 在 apps/chat 中创建 `src/views/GroupMemberList.vue`，群成员列表页：GET /groups/:group_no/members、删除成员（DELETE body: {members: [uid]}）、PUT /groups/:group_no/members/:uid 修改成员昵称、PUT /groups/:group_no/members/:uid（操作：setAdmin/removeAdmin）
- [X] T042 [US3] 实现群管理功能（在 `apps/chat/src/views/GroupMemberList.vue` 和 `datasource-vue/src/stores/groupStore.ts` 中）：转让群主（PUT /groups/:group_no/owner_uid）、解散群组（DELETE /group/disband）、退出群组（POST /group/exit）、禁言成员（PUT /group/mute/:group_no/members，POST body: {member_uid, action, key: forbidden_with_member}）
- [X] T043 [US3] 实现群成员邀请（在 `base-vue/src/components/GroupSettingsDrawer.vue` 中）：GET /group/invite/qrcode → 群二维码；POST /group/invite/confirm（扫码入群确认页面）；邀请链接有效期 5 分钟（UUID 机制）

**Checkpoint**: Phase 5 完成——群创建、成员管理、群设置、邀请入群功能可用

---

## Phase 6: 消息功能增强（Priority: P3）

**Purpose**: 在 IM 核心基础上扩展消息类型和交互能力

- [ ] T044 [P] [US1-ext] 在 base-vue 中创建 `src/components/messages/VoiceCell.vue`，语音消息气泡（type=4）：使用 howler.js 播放音频，显示时长，集成 MediaMessageContent 解析（SDK 已有）
- [ ] T045 [P] [US1-ext] 在 base-vue 中创建 `src/components/messages/FileCell.vue`，文件消息气泡（type=8）：文件名+大小+下载按钮，POST /file/upload（GET ?path=...&type=... 获取上传路径后再 POST multipart）
- [ ] T046 [P] [US1-ext] 在 base-vue 中创建 `src/components/messages/VideoCell.vue`，视频消息气泡（type=5）：缩略图+时长，点击播放
- [ ] T047 [P] [US1-ext] 在 base-vue 中创建 `src/components/messages/GifCell.vue`，GIF 消息气泡（type=3）：直接渲染动态图
- [ ] T048 [P] [US1-ext] 在 base-vue 中创建 `src/components/messages/StickerCell.vue`，表情贴纸消息（type=12/13, lottieSticker）：Lottie 动画渲染（@lottiefiles/lottie-vue）
- [ ] T049 [P] [US1-ext] 在 base-vue 中创建 `src/components/messages/LocationCell.vue`，位置消息气泡（type=6）：显示位置名称和地图占位（实际地图 SDK 暂不接入）
- [ ] T050 [P] [US1-ext] 在 base-vue 中创建 `src/components/messages/CardCell.vue`，名片消息气泡（type=7）：用户/群组名片卡片
- [ ] T051 [P] [US1-ext] 在 base-vue 中创建 `src/components/messages/MergeCell.vue`，合并转发消息气泡（type=11）：显示"N条合并消息"标题，点击展开转发详情
- [ ] T052 [US1-ext] 实现 @提及功能（在 `apps/chat/src/components/MessageInput.vue` 和 `apps/chat/src/components/MessageList.vue` 中）：MessageInput 支持 @ 触发成员选择列表，消息内容携带 mentionUids 字段，MessageList 渲染时高亮 @到的用户
- [ ] T053 [US1-ext] 实现消息回应（Reaction）（在 `apps/chat/src/components/MessageList.vue` 和 `datasource-vue/src/api/index.ts` 中）：在 TextCell 等气泡下方渲染 emoji 反应数。**✅ endpoint 已确认**（TangSengDaoDaoServer modules/message/api.go:116-124）：`POST /v1/reactions`（添加/取消）、`POST /v1/reaction/sync`（增量同步）
- [ ] T054 [US1-ext] 实现已读回执（在 `datasource-vue/src/stores/messageStore.ts` 中）：追踪已读状态，PUT /message/readed 发送已读，MessageList 中消息气泡显示"已读/未读"标记
- [ ] T055 [US1-ext] 实现消息引用（回复）（在 `apps/chat/src/components/MessageInput.vue` 和 `apps/chat/src/components/MessageList.vue` 中）：MessageInput 显示回复预览条（回复的用户名+内容），消息内容携带 quote 字段，MessageList 渲染时显示引用块并支持点击跳转
- [ ] T056 [US1-ext] 实现全局搜索（在 `apps/chat/src/views/SearchResultPage.vue` 和 `datasource-vue/src/api/index.ts` 中）：POST /search/global（body: {keyword, content_type: 1|2|3|4 区分消息/联系人/群组/聊天记录}），搜索结果页展示分类列表

**Checkpoint**: Phase 6 完成——所有消息类型和交互功能就绪

---

## Phase 7: 设置与个人中心（Priority: P3）

**Purpose**: 用户资料设置、通知偏好、设备管理

- [ ] T057 [P] [US1-ext] 在 apps/chat 中创建 `src/views/MePage.vue`，个人中心主页：头像（ChannelAvatar）、昵称、ID 号、二维码（GET /user/qrcode）
- [ ] T058 [P] [US1-ext] 在 apps/chat 中创建 `src/views/EditProfilePage.vue`，编辑资料页：PUT /user/current 修改昵称，POST /users/:uid/avatar 上传头像
- [ ] T059 [P] [US1-ext] 在 apps/chat 中创建 `src/views/SettingsPage.vue`，设置页：通过 `document.body.setAttribute('data-theme', 'dark')` 切换深色模式（plan.md §1.4 规范），通知设置、语言设置、关于
- [ ] T060 [P] [US1-ext] 在 apps/chat 中创建 `src/views/DeviceManagementPage.vue`，设备管理页：GET /user/devices 列出登录设备，DELETE /user/devices/:deviceId 移除设备，POST /user/quit 退出其他设备
- [ ] T061 [US1-ext] 实现通知功能（在 `datasource-vue/src/api/index.ts` 和 `apps/chat/src/stores/settingsStore.ts` 中）：PUT /v1/user/device_token 注册推送 token（TangSengDaoDaoServer modules/user/api.go）；**badge** `POST /v1/user/device_badge`（写入，无 GET 读取端，badge 由 WebSocket 推送更新）；**无独立隐身开关**，WebSocket 连接状态隐式表达用户在线状态

**Checkpoint**: Phase 7 完成——个人中心、设置、设备管理完成

---

## Phase 8: 扫码登录与扩展功能（Priority: P3）

**Purpose**: PC/Electron 扫码登录、机器人、工作台

- [ ] T062 [P] [US1-ext] 在 login-vue 中创建 `src/views/QRLoginPage.vue`，PC 扫码登录页：显示二维码，GET /v1/user/loginuuid（获取 UUID + 二维码内容），UUID 轮询 5 分钟过期，实现 QR 登录状态机（waitScan → scanned → authed → expired），轮询 GET /v1/user/loginstatus?uuid=...（TangSengDaoDaoServer modules/user/api.go:186）
- [ ] T063 [P] [US1-ext] 在 login-vue 中创建 `src/stores/qrLoginStore.ts`，扫码登录状态机 Store：调用 GET /v1/user/loginuuid 获取 UUID → 二维码展示 → 轮询 GET /v1/user/loginstatus?uuid=... 状态切换，登录成功后存储 loginInfo（包含 SID）；状态机定义：ScanLoginStatusExpired / Scanned / Authed
- [ ] T064 [P] [US1-ext] 在 contacts-vue 中创建 `src/views/WorkplacePage.vue`，工作台页：GET /banner 获取横幅、GET /app（或 /organization/selector 带 feature-flag fallback）展示应用列表，支持应用增删改（POST /app）
- [ ] T065 [P] [US1-ext] 在 contacts-vue 中创建 `src/views/RobotMenuPage.vue`，机器人菜单页：GET /robot/menu、POST /robot/inline_query，接收 robot 事件（CMD: robot_menu_click）分发显示

**Checkpoint**: Phase 8 完成——扫码登录、工作台、机器人菜单完成

---

## Phase 9: Polish & Cross-Cutting Concerns（收尾与优化）

**Purpose**: 跨用户故事体验优化、性能调优、一致性检查

- [ ] T066 [P] [all] 在 apps/chat 中实现 Dark Mode：通过 `document.body.setAttribute('data-theme', 'dark')` 切换 CSS 变量（plan.md §1.4 规范），constitution.md 规定深色色板（#121212 / #1E1E1E），Arco Design Vue dark 主题覆盖
- [ ] T067 [P] [all] 性能优化 MessageList：实现虚拟滚动（vue-virtual-scroller），确保 5000 条历史消息保持 58 FPS（SC-003 验收标准），messageStore 分页加载（每次加载 20 条）
- [ ] T068 [P] [all] 实现弱网体验：SDK 连接状态监听（onConnect / onDisconnect / onRetry），离线时显示网络状态栏，messageStore 离线队列（联网后自动重发 pending 消息）
- [ ] T069 [P] [all] 在 apps/chat 中实现表情包面板：集成 @emoji-mart/data 表情选择器（支持搜索），选择后插入 Unicode emoji 字符，以 **type=1 文本消息**发送，由 TextCell 正常渲染（emoji-mart 仅作为输入增强工具，不改变消息 contentType；type=7 在 plan.md §5 定义为名片 card）
- [ ] T070 [P] [all] 实现 PC/Electron 特性：electron 主进程注册 Tray 托盘图标和未读角标、autoUpdater 自动更新、开发者工具快捷键、桌面通知（Notification API）
- [ ] T071 [P] [all] 全局红点/未读系统：GET /reddot 和 PUT /reddot 清除红点。**⚠️ 注意**：红点逻辑已由 T012 friendRequest CMD handler（→ 红点 API）和 T032 contactStore（→ friendRequests 红点计数）完整覆盖，本任务为补充集成验证，确保 ConversationList / FriendRequests / ContactList 均接入红点状态。
- [ ] T072 [all] 验收标准核对：SC-001 WebSocket 握手 < 1.5s（performance.mark 测量）、SC-002 离线消息同步 < 2s、SC-003 5000 条历史 58 FPS；**FR-003 心跳重连验收：T005 sdk.ts 中心跳每 30s 发送一次，连续 3 次未收到 Pong 回执触发指数退避重连**，在 apps/chat 中添加性能日志
- [ ] T074 [US1] 实现图片拖拽粘贴上传（在 `apps/chat/src/components/MessageInput.vue` 中）：FR-005 要求的拖拽/粘贴发送图片，支持 `dragover`/`drop`/`paste` 事件拦截，调用 T015 的 file upload API 发送图片后生成 type=2 ImageCell 消息

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1（Setup）**: 无依赖，可立即开始
- **Phase 2（Foundational）**: 依赖 Phase 1 完成——**阻塞所有用户故事**
- **Phase 3（US1 - IM 核心）**: 依赖 Phase 2 完成——🎯 MVP 核心
- **Phase 4（US2 - 联系人）**: 依赖 Phase 2 完成——可与 Phase 3 并行
- **Phase 5（US3 - 群组）**: 依赖 Phase 2 完成——可与 Phase 3/4 并行
- **Phase 6-8（增强功能）**: 依赖 Phase 3 完成——增量叠加
- **Phase 9（Polish）**: 依赖 Phase 3-8 全部完成

### User Story Dependencies

- **US1（P1）**: Phase 2 完成后即可开始——核心 IM 流程
- **US2（P2）**: Phase 2 完成后即可开始——与 US1 并行
- **US3（P2）**: Phase 2 完成后即可开始——与 US1/US2 并行

### Within Each User Story

- 基础 Store（Phase 2）先于所有页面组件
- 组件按 UI 层级（layout → list → item → input）顺序实现
- API 调用通过 api/index.ts 代理，不在组件内直接调用 axios
- SDK 监听器只注册在 datasource-vue 的 Store 中（constitution 强制要求）

### Parallel Opportunities

- Phase 1 中 T002/T003/T004/T005/T006/T007/T008 可全部并行（不同包/文件）
- Phase 2 中 T009/T010/T011/T012/T013/T014/T015/T016/T017 可全部并行（不同 Store/组件）
- Phase 3-5 用户故事之间可完全并行（不同视图/功能）
- Phase 6 中 T044-T052 可全部并行（不同 Cell 组件及 @ 提及功能）
- Phase 7 中 T057/T058/T059/T060 可全部并行
- Phase 8 中 T062/T063/T064/T065 可全部并行

---

## Parallel Example: Phase 2（Foundational）

```bash
# 三个 Store 可并行实现：
T009: conversationStore.ts — 会话同步
T010: channelStore.ts     — 频道管理
T011: messageStore.ts    — 消息管理

# 四个 API/SDK 相关任务可并行：
T012: CMD 分发器          — 14 个 CMD 监听
T013: 内容类型注册         — 12 种消息类型（type=1~8、11、12/13、1000-2000、-1）
T014: userStore          — 用户状态
T015: API 封装           — 全部 endpoint 函数
```

---

## Implementation Strategy

### MVP First（Phase 1-3，仅 US1）

1. 完成 Phase 1：Monorepo + CSS 设计系统 + APIClient + SDK Store
2. 完成 Phase 2：14 个 CMD + Sync Engine + 内容类型注册
3. 完成 Phase 3：登录 → 会话列表 → 文本消息收发
4. **STOP 并验收**：WebSocket 握手 < 1.5s（SC-001）、离线同步 < 2s（SC-002）
5. 部署/演示 MVP

### Incremental Delivery

1. Phase 1-2（Foundation）→ 验收基础设施完整性
2. Phase 3（US1）→ IM 核心 → 部署 MVP
3. Phase 4（US2）→ 联系人管理 → 独立验收
4. Phase 5（US3）→ 群组管理 → 独立验收
5. Phase 6-8 → 消息增强 + 设置 → 增量叠加
6. Phase 9 → 性能调优 + 验收标准核对

### Constitution Verification Gates

- **Gate 1**: 无循环依赖（monorepo 包之间单向依赖 base-vue）
- **Gate 2**: 零 box-shadow（CSS 审查）、border-radius 统一 2px
- **Gate 3**: `token` header 名称正确（非 Authorization: Bearer）
- **Gate 4**: DELETE body 格式正确（`{members: [uid]}` 数组）
- **Gate 5**: 路径 typo 已记录（`/coversation/clearUnread` 非 `/conversation/...`）
- **Gate 6**: 14 个 CMD 全部注册（T012 验收）
- **Gate 7**: 12 种内容类型全部注册（T013 验收，含 type=1~8、11、12/13、1000-2000、-1）

---

## Notes

- **[P]** 任务 = 不同文件、无依赖，可并行执行
- **[Story]** 标签用于追溯任务归属的用户故事
- Constitution 约束：SDK 监听器只注册在 datasource-vue Store 中，禁止在组件内注册
- API 层统一在 datasource-vue/src/api/index.ts，其他包通过 Pinia Store 或 composable 间接调用
- 登录信息持久化：loginInfo（含 SID）存储在 localStorage，跨刷新保持登录态
