# Implementation Plan: TangSengDaoDaoWeb Vue 3 极简重构计划

**Status**: Ready  
**Created**: 2026-05-21  
**Target Branch**: `vue3-im-refactor`  
**Spec Document**: [specify.md](file:///media/leng/DiskB1/exp/seedcmp/sections/im_web/.agent/specify.md)  
**Constitution**: [constitution.md](file:///media/leng/DiskB1/exp/seedcmp/sections/im_web/.agent/constitution.md)

---

## 1. 技术上下文与架构设计 (Technical Context)

### 1.1 核心技术栈 (Technology Stack)
- **底层框架**: Vue 3.x (SFC `<script setup>`, Composition API)
- **工程构建**: Vite 5.x (ESBuild 预构建 + Rollup 生产打包)
- **状态总线**: Pinia (接管 `wukongimjssdk` 内部状态，形成全响应式数据总线)
- **UI 组件**: Arco Design Vue (仅用于 Modal、Drawer、Popover 等骨架，全局覆写清除阴影)
- **美学样式**: 原生 Vanilla CSS + CSS 自定义属性 (Hairline 发丝分割线，Light/Dark 极简双色模式)
- **核心依赖**:
  - `wukongimjssdk@^1.2.11` (WuKongIM 二进制通信 SDK，ESM 兼容)
  - `axios` (RESTful API 契约拦截器，Token 通过 Header `token` 字段注入)
  - `pinyin-pro` (通讯录 A-Z 拼音首字母自动计算)
  - `howler` (消息到达提示音播放，对齐原版 `Howl` 音效机制)
  - `mitt` (轻量事件总线，替代原版的 `WKApp.mittBus = mitt()`)

### 1.2 环境确认 (已验证)
- **CORS**: 后端 `main.go` 已全局注册 `Access-Control-Allow-Origin: *`，前端可直连 `http://127.0.0.1:8090/v1/` 无需 Vite proxy。
- **验证码**: 后端 `configs/tsdd.yaml` 配置 `smsCode: "123456"`，任意手机号 + `123456` 均可登录。
- **WS 网关**: `ws://127.0.0.1:5200`，通过 `GET /v1/users/:uid/im` 获取连接凭证。

### 1.3 Monorepo 物理依赖模型

```text
seedcmp/sections/im_web/
├── pnpm-workspace.yaml
├── package.json                  # 根工程（Vite 入口 + App.vue）
├── vite.config.ts
├── src/
│   ├── App.vue                   # 顶层路由守卫 + KickoutOverlay 条件渲染
│   ├── main.ts                   # Pinia 安装 + Arco 按需引入 + 模块注册
│   └── router/index.ts           # vue-router: /login, /chat
└── packages/
    ├── base-vue/                  # @tsdaodao/base-vue
    │   ├── package.json
    │   └── src/
    │       ├── styles/
    │       │   ├── variables.css  # 极简 CSS 变量系统 (双色+发丝描边)
    │       │   ├── arco-reset.css # Arco 阴影/圆角全局覆写
    │       │   └── skeleton.css   # 骨架屏动画
    │       ├── components/
    │       │   ├── ChannelAvatar.vue   # 统一头像（URL 或字符渐变 fallback）
    │       │   ├── SkeletonList.vue    # 通用骨架屏列表
    │       │   ├── EmptyState.vue      # 线稿空状态占位
    │       │   └── KickoutOverlay.vue  # 被踢下线遮罩浮窗
    │       ├── service/
    │       │   ├── APIClient.ts        # Axios 封装 (Token 拦截 + 401 回调)
    │       │   ├── Const.ts            # 消息类型码枚举 (对齐原版 MessageContentTypeConst)
    │       │   └── StorageService.ts   # LocalStorage 带 SID 前缀的存取
    │       └── composables/
    │           └── useRemoteConfig.ts  # GET /common/appconfig 拉取 revokeSecond 等
    ├── datasource-vue/            # @tsdaodao/datasource-vue
    │   ├── package.json
    │   └── src/
    │       └── stores/
    │           ├── sdk.ts              # WKSDK 全局初始化 + 连接状态机 + Kickout 检测
    │           ├── conversation.ts     # 会话列表 + 草稿 extra 同步 + 未读清算
    │           ├── message.ts          # 消息收发 + CMD 分发中枢
    │           └── contacts.ts         # 好友名册增量同步 + 申请 token 确认
    ├── login-vue/                 # @tsdaodao/login-vue
    │   ├── package.json
    │   └── src/
    │       ├── views/LoginPage.vue
    │       └── stores/login.ts         # 扫码轮询 + 手机号验证码双轨状态机
    └── contacts-vue/              # @tsdaodao/contacts-vue
        ├── package.json
        └── src/
            ├── views/ContactsPage.vue
            └── components/
                ├── FriendList.vue       # A-Z 拼音锚点列表
                └── FriendApplyList.vue   # 新朋友申请列表
```

依赖方向（严格单向）：
- `login-vue` → `base-vue`
- `contacts-vue` → `base-vue`
- `datasource-vue` → `base-vue`
- 根工程 → `login-vue` + `contacts-vue` + `datasource-vue`

---

## 2. 宪法符合度审查 (Constitution Check)

| 宪法条款 | 审查 | 实施策略 |
| :--- | :--- | :--- |
| **Monorepo 多包物理隔离** | 🟢 | 四个独立包，`pnpm-workspace.yaml` 严格单向依赖。 |
| **极简主义双色与发丝描边** | 🟢 | `variables.css` 定义双色底盘 + 1px `#ECECEF`/`#2C2C2E` 发丝线。`arco-reset.css` 将 Arco 所有 `box-shadow` 覆写为 `none`，`border-radius` 硬化为 `2px`。 |
| **SDK 全局事件拦截主权** | 🟢 | 所有 `addMessageListener` 与 `addCMDListener` 仅在 `datasource-vue/stores/message.ts` 的 `initListeners()` 中注册。 |
| **骨架屏首屏加载** | 🟢 | `SkeletonList.vue` 组件渲染 8 行扁平纯灰底骨架条（渐隐渐现 CSS 动画，无闪烁），`EmptyState.vue` 展示线稿图标。 |
| **Kickout 置灰遮罩** | 🟢 | `KickoutOverlay.vue` 通过 Pinia `isKickedOut` 状态条件渲染，取代原版的 `window.location.reload()` 硬刷新。 |

---

## 3. 原版核心架构解剖与 Vue 3 映射 (Source Analysis)

### 3.1 原版 APIClient 模式 → Vue 3 Axios 封装

原版 `APIClient.ts` 核心特征（需 100% 对齐）：
- Token 注入方式：Axios 请求拦截器中通过 `config.headers["token"] = token` 注入（**不是** Authorization Bearer，而是自定义 `token` Header）。
- 401 响应处理：响应拦截器中 `status === 401` 时触发 `logoutCallback()`。
- DELETE 请求：通过 `axios.delete(path, { params: config?.param, data: config?.data })` 传递，即 DELETE 请求可携带 body（群成员移除等场景）。

Vue 3 封装要点：
```typescript
// base-vue/src/service/APIClient.ts
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token' + getSID())
  if (token) config.headers['token'] = token
  return config
})
axios.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      const sdkStore = useSdkStore()
      sdkStore.handleKickout() // 触发 Kickout 遮罩，不硬刷新
    }
    return Promise.reject({
      error, msg: error.response?.data?.msg || '未知错误',
      status: error.response?.status
    })
  }
)
```

### 3.2 原版 CMD 监听器完整映射表

原版 `module.tsx` 第 217-356 行中注册的 `addCMDListener` 完整 CMD 指令集，Vue 3 必须在 `datasource-vue/stores/message.ts` 中 1:1 对齐实现：

| CMD 指令 | 原版处理逻辑 | Vue 3 Store 映射 |
| :--- | :--- | :--- |
| `channelUpdate` | 调用 `channelManager.fetchChannelInfo(channel)` 拉取最新频道信息 | `message.ts` → 触发 channelInfo 缓存刷新 |
| `typing` | `TypingManager.shared.addTyping(channel, from_uid, from_name)`，4 秒后自动销毁 | `message.ts` → 写入 `typingMap` reactive，4s setTimeout 清除 |
| `groupAvatarUpdate` | 更新群头像缓存 tag + fetchChannelInfo | `message.ts` → 更新 avatarTag + 重新拉取群信息 |
| `unreadClear` | 取 `param.unread`，设置 `conversation.unread` 并触发更新通知 | `conversation.ts` → 直接修改 reactive 未读数 |
| `conversationDeleted` | `conversationManager.removeConversation(channel)` | `conversation.ts` → 从列表中移除该会话 |
| `friendRequest` | 创建 `FriendApply` 对象（含 `token` 字段），存入 Storage，调用 `setFriendApplysUnreadCount()` 请求红点 API | `contacts.ts` → 追加到 applyList，请求 `GET /user/reddot/friendApply` |
| `friendAccept` | 拉取对方 channelInfo + `contactsSync()` + 更新 apply 状态为 accepted | `contacts.ts` → 同步好友名册 + 更新申请状态 |
| `friendDeleted` | `contactsSync()` | `contacts.ts` → 增量同步名册 |
| `memberUpdate` | `channelManager.syncSubscribes(channel)` | `message.ts` → 同步群成员列表 |
| `onlineStatus` | 更新 channelInfo.online 字段，触发 UI 刷新 | `contacts.ts` → 更新在线状态 reactive |
| `syncConversationExtra` | `conversationManager.syncExtra()` | `conversation.ts` → 拉取 extra（草稿等） |
| `syncReminders` | `reminderManager.sync()` | `conversation.ts` → 同步提醒项 |
| `messageRevoke` | 查找 conversation.lastMessage，设置 `revoke = true` + `revoker` | `message.ts` → 标记消息为已撤回，触发气泡 UI 替换 |
| `userAvatarUpdate` | 更新用户头像缓存 tag + 通知通讯录刷新 | `contacts.ts` → 更新 avatarTag |

### 3.3 原版消息 Cell 注册表 → Vue 3 动态组件映射

原版 `module.tsx` 第 105-148 行中 `registerMessageFactor` 的完整消息类型对照：

| contentType 值 | 原版组件 | Vue 3 SFC 组件 | 说明 |
| :--- | :--- | :--- | :--- |
| `1` (text) | `TextCell` | `TextCell.vue` | 文本消息 |
| `2` (image) | `ImageCell` | `ImageCell.vue` | 图片消息 |
| `3` (gif) | `GifCell` | `GifCell.vue` | GIF 动图 |
| `4` (voice) | `VoiceCell` | `VoiceCell.vue` | 语音（仅播放，不录制） |
| `5` (smallVideo) | `VideoCell` | `VideoCell.vue` | 小视频 |
| `6` (location) | `LocationCell` | `LocationCell.vue` | 位置 |
| `7` (card) | `CardCell` | `CardCell.vue` | 名片 |
| `8` (file) | — | `FileCell.vue` | 文件消息 |
| `11` (mergeForward) | `MergeforwardCell` | `MergeforwardCell.vue` | 合并转发 |
| `12/13` (lottieSticker) | `LottieStickerCell` | `StickerCell.vue` | Lottie 贴图 |
| `20` (screenshot) | `ScreenshotCell` | `ScreenshotCell.vue` | 截屏消息 |
| `1000-2000` (system) | `SystemCell` | `SystemCell.vue` | 系统提示（统一兜底） |
| `-1` (time) | `TimeCell` | `TimeCell.vue` | 时间分割线 |
| `-2` (typing) | `TypingCell` | — | 输入中（Vue 版用 typing overlay 替代 Cell） |
| `unknown` | `UnknownCell` | `UnknownCell.vue` | 未知消息兜底 |

Vue 3 动态加载方式：
```vue
<component :is="getCellComponent(msg.contentType)" :message="msg" />
```

### 3.4 原版 WKConfig / WKRemoteConfig → Vue 3 Store

| 原版字段 | 默认值 | Vue 3 存放位置 |
| :--- | :--- | :--- |
| `appName` | `"唐僧叨叨"` | `base-vue/Const.ts` 常量 |
| `themeColor` | `"#E46342"` | 极简重构中不使用，替换为 CSS 变量 `--color-accent` |
| `pageSize` | `15` | `base-vue/Const.ts` |
| `pageSizeOfMessage` | `30` | `base-vue/Const.ts` |
| `fileHelperUID` | `"fileHelper"` | `base-vue/Const.ts` |
| `systemUID` | `"u_10000"` | `base-vue/Const.ts` |
| `revokeSecond` | `120` (远程拉取) | `base-vue/composables/useRemoteConfig.ts` → Pinia |
| `themeMode` | `light/dark` | `base-vue` Pinia Store，`body[theme-mode="dark"]` 属性切换 |

### 3.5 原版 LoginInfo 存储机制 → Vue 3 对齐

原版 `LoginInfo` 使用 `localStorage` 存储，所有 key 拼接了 `SID` 后缀（URL query 参数 `?sid=xxx`），支持同一浏览器多会话窗口隔离：
```
key格式: "token" + sid, "uid" + sid, "name" + sid, ...
```
Vue 3 中需在 `base-vue/service/StorageService.ts` 中完整保留此 SID 机制。

---

## 4. 分阶段实施路线图 (Phased Roadmap)

### 4.1 Phase 1: 极简主题、底座与 SDK 劫持主权搭建

#### T1.1: Monorepo 骨架与极简 CSS 变量系统
- 创建 `pnpm-workspace.yaml`，初始化四大子包。
- `base-vue/src/styles/variables.css`：
  ```css
  :root {
    --bg-primary: #FFFFFF;
    --bg-secondary: #F7F7F9;
    --bg-hover: #F2F2F4;
    --border-color: #ECECEF;
    --border-hairline: 1px solid var(--border-color);
    --text-main: #111111;
    --text-secondary: #555555;
    --text-muted: #7A7A80;
    --color-accent: #2D7FF9;
    --color-danger: #E53935;
    --transition-fast: 0.15s ease;
    --radius-sm: 2px;
  }
  [theme-mode="dark"] {
    --bg-primary: #121212;
    --bg-secondary: #1E1E1E;
    --bg-hover: #2A2A2A;
    --border-color: #2C2C2E;
    --text-main: #F5F5F7;
    --text-secondary: #B0B0B0;
    --text-muted: #8E8E93;
  }
  ```
- `base-vue/src/styles/arco-reset.css`：全局消灭 Arco 阴影：
  ```css
  .arco-modal, .arco-drawer-content, .arco-popover-content,
  .arco-dropdown-list-wrapper, .arco-tooltip-content {
    box-shadow: none !important;
    border: var(--border-hairline) !important;
    border-radius: var(--radius-sm) !important;
  }
  ```

#### T1.2: APIClient 封装（严格对齐原版 Token Header 机制）
- Token 注入 Header 字段名为 `token`（非 `Authorization`）。
- DELETE 请求支持 body（`axios.delete` 的 `data` 选项）。
- 401 响应触发 Pinia `isKickedOut = true`，不直接 `location.reload()`。

#### T1.3: SDK Store 全局劫持 (`datasource-vue/stores/sdk.ts`)
```typescript
export const useSdkStore = defineStore('sdk', () => {
  const isConnected = ref(false)
  const isKickedOut = ref(false)

  function initializeSDK(uid: string, token: string) {
    WKSDK.shared().config.uid = uid
    WKSDK.shared().config.token = token
    // 连接地址回调
    WKSDK.shared().config.provider.connectAddrCallback = async (cb) => {
      const res = await apiClient.get(`/users/${uid}/im`)
      cb(res.ws_addr)
    }
    // 连接状态监听（对齐原版 App.tsx#L304-L322）
    WKSDK.shared().connectManager.addConnectStatusListener((status, reasonCode) => {
      if (status === ConnectStatus.Connected) isConnected.value = true
      else if (status === ConnectStatus.ConnectKick || reasonCode === 2) {
        isKickedOut.value = true // 触发 KickoutOverlay
      }
    })
    WKSDK.shared().connect()
  }
  return { isConnected, isKickedOut, initializeSDK }
})
```

#### T1.4: CMD 消息分发中枢 (`datasource-vue/stores/message.ts`)
- 在 `initListeners()` 中注册 `addCMDListener`，覆盖上述 3.2 节全部 14 种 CMD 指令。
- 在 `initListeners()` 中注册 `addMessageListener`：
  - 收到消息时，若 `TypingManager` 中有该 channel 的 typing 状态则清除。
  - 根据 `contentType` 判断：`channelUpdate(1005)` → 刷新频道信息；`addMembers(1002)/removeMembers(1003)` → 同步群成员。
  - 调用 `howler` 播放提示音（对齐原版 `tipsAudio()`）。

#### T1.5: 会话扩展同步 (`datasource-vue/stores/conversation.ts`)
- 登录后调用 `POST /v1/conversation/sync` + `POST /v1/conversation/syncack`。
- 草稿持久化：组件 `onBeforeUnmount` 时调用 `POST /v1/conversations/:cid/:ct/extra` 写入 `draft` 字段。
- 增量拉回：`POST /v1/conversation/extra/sync` 同步草稿等扩展属性。
- 未读清除：`PUT /v1/coversation/clearUnread`（注意 typo 路径兼容）。

### 4.2 Phase 2: 登录与拼音通讯录重构

#### T2.1: 极简登录状态机 (`login-vue/stores/login.ts`)
- 手机号登录：`POST /v1/user/login`，body 含 `{ username, password: "123456", flag: 1, device: { device_id, device_name, device_model } }`。
- 扫码登录三阶段：
  1. `GET /v1/user/loginuuid` → 获取 uuid + 二维码 URL
  2. `GET /v1/user/loginstatus?uuid=xxx` → 轮询状态机 `waitScan → scanned → authed`
  3. `POST /v1/user/login_authcode/:auth_code` → 换取 Token
- 设备信息采集：对齐原版 `App.tsx#L339-L397`，从 `navigator.userAgent` 提取 OS 版本和浏览器品牌。

#### T2.2: 通讯录 A-Z 分类 (`contacts-vue`)
- `GET /v1/friend/sync?version=0&limit=1000&api_version=1` 增量拉取。
- `pinyin-pro` 计算每个好友昵称的拼音首字母，分组为 `{ A: [...], B: [...], ... }` reactive Map。
- 右侧极细 A-Z 锚点导航条，点击快速滚动定位。

#### T2.3: 好友申请 Token 握手 (`datasource-vue/stores/contacts.ts`)
- CMD `friendRequest` 到达时，从 `param.token` 提取 apply token 存入 applyList。
- 用户点击"同意"→ `POST /v1/friend/sure { "token": "..." }`。
- 同意后触发 `GET /v1/friend/sync?api_version=1` 增量刷新。
- 红点计数：`GET /v1/user/reddot/friendApply`，已读后 `DELETE /v1/user/reddot/friendApply`。

### 4.3 Phase 3: 极简会话列表与消息气泡流

#### T3.1: 骨架屏与空状态
- `SkeletonList.vue`：8 行灰底条，CSS `@keyframes shimmer` 渐隐渐现（无闪烁式 pulse）。
- `EmptyState.vue`：单色线稿 SVG 图标 + 灰色文字，纯 CSS 实现无外部图片依赖。

#### T3.2: 消息 Cell 动态注册系统
- 在 `base-vue` 中封装 `MessageManager`，维护 `contentType → Component` 映射表。
- 主工程 `main.ts` 中按 3.3 节注册表调用 `messageManager.register(type, component)`。
- 聊天面板中使用 `<component :is="messageManager.resolve(msg.contentType)" />` 动态渲染。

#### T3.3: 消息交互
- **撤回**：右键菜单中检查 `Date.now() - msg.timestamp < revokeSecond * 1000`，超时则不显示"撤回"选项。
- **引用回复**：点击引用内容自动滚动到原消息并高亮闪烁。
- **弱网状态**：消息发送后 10 秒未收到 ACK，气泡旁渲染红色感叹号，点击一键重发。

### 4.4 Phase 4: 极简群设置抽屉与管辖功能

#### T4.1: 群聊发起与设置抽屉
- 发起群聊：`POST /v1/group/create { "name": "...", "members": ["uid1", "uid2"] }`。
- `GroupSettingDrawer.vue`：右侧 360px 宽抽屉，1px 发丝左描边，高留白克制排版。
- 群信息拉取：`GET /v1/groups/:group_no` + `GET /v1/groups/:group_no/membersync?version=0&limit=1000`。

#### T4.2: 群成员管理（严格对齐 API 传参）
- 移除成员：`DELETE /v1/groups/:group_no/members`，body `{ "members": ["uid"] }`
- 任免管理员：`POST/DELETE /v1/groups/:group_no/managers`，body `["uid1", "uid2"]`（纯字符串数组）
- 单兵禁言：`POST /v1/groups/:group_no/forbidden_with_member`，body `{ "member_uid": "uid", "action": 1, "key": 3 }`
- 全员禁言：`POST /v1/groups/:group_no/forbidden/1` (开启) / `forbidden/0` (解除)

#### T4.3: 群设置开关适配
- `PUT /v1/groups/:group_no/setting`，可选字段：`mute`, `top`, `save`, `show_nick`, `invite`, `screenshot`, `revoke_remind`, `receipt`, `flame`, `flame_second`, `forbidden`, `forbidden_add_friend`

#### T4.4: Kickout 遮罩组件
- `KickoutOverlay.vue`：`position: fixed` 全屏覆盖，`background: rgba(0,0,0,0.4)`
- 中心白色极简卡片：1px 发丝描边，无阴影，`border-radius: 2px`
- 提示文案 + 单键"重新登录"按钮 → 清除 localStorage → `router.push('/login')`

---

## 5. 消息类型 SDK 注册表 (Content Type Registry)

原版在 `module.tsx` 第 150-193 行中向 `WKSDK.shared().register()` 注册自定义消息解码器，Vue 3 必须在模块初始化时 1:1 对齐：

```typescript
// main.ts 或 datasource-vue 初始化
WKSDK.shared().register(2, () => new ImageContent())
WKSDK.shared().register(3, () => new GifContent())
WKSDK.shared().register(4, () => new VoiceContent())
WKSDK.shared().register(5, () => new VideoContent())
WKSDK.shared().register(6, () => new LocationContent())
WKSDK.shared().register(7, () => new CardContent())
WKSDK.shared().register(11, () => new MergeforwardContent())
WKSDK.shared().register(12, () => new LottieStickerContent())
WKSDK.shared().register(13, () => new LottieStickerContent())
WKSDK.shared().register(20, () => new ScreenshotContent())
```

---

## 6. 验证与门禁检查 (Verification Gates)

1. **Monorepo 循环依赖审查**: `base-vue` 不得导入 `login` / `contacts` / `datasource` 中的任何模块。CI 中使用 `pnpm why` 或 `madge` 检测。
2. **CSS 零阴影校验**: 全局 CSS 中不得出现 `box-shadow` 值超过 `0 0 0 1px` 的声明（发丝描边除外）。
3. **Token Header 校验**: 所有 API 请求 Header 中必须使用自定义字段名 `token`（非 `Authorization: Bearer`），与后端 `AuthMiddleware` 中 `c.GetHeader("token")` 严格对齐。
4. **DELETE body 传参校验**: Axios DELETE 请求必须通过 `{ data: ... }` 选项传递 body，确保群成员移除等接口参数正确到达后端。
5. **Typo 路径兼容校验**: 未读清除接口路径必须为 `/v1/coversation/clearUnread`（少一个 `n`），旧版会话列表路径为 `/v1/coversations`。在 APIClient 中建议封装为命名常量避免拼写错误。
6. **CMD 完整性审计**: `datasource-vue/stores/message.ts` 中的 `addCMDListener` 必须覆盖全部 14 种 CMD 指令（见 3.2 节映射表），缺失任何一项将导致好友申请、撤回、在线状态等功能静默失效。
7. **SDK 消息解码器注册审计**: `WKSDK.shared().register()` 必须覆盖全部 10 种自定义 contentType（见第 5 节注册表），缺失将导致对应消息类型在聊天面板中显示为 UnknownCell。

---

## 7. Out of Scope (排除范围)

以下模块明确排除在本阶段 Vue 3 重构之外，前端隐藏所有对应 UI 入口：
- **WebRTC 音视频通话**: 不实现实时音视频单聊/群聊通话模块（contentType `9900-9999` 的 RTC 消息仅渲染为系统提示文本）。
- **朋友圈 (Moments)**: 不重构动态发布、评论、点赞等 UI。
- **钱包与红包**: 彻底移除红包收发、零钱充值提现等支付及金融类交互。
- **组织架构**: 不实现 `organizational` 相关的部门树和组织头像功能。
- **收藏/贴图商店**: `GET /v1/favorite/my`、`GET /v1/sticker/user/category` 等接口暂不对接。
