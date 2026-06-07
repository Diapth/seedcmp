# V1-1 计划：agenthub_ui 后端接入基础设施与数据层

## 0. 强制执行门禁

本计划执行时必须遵守以下硬性要求：

1. **阶段提交**：每完成一个阶段的实现、测试修复或文档补充，必须立即做一次中文 commit。不要把多个阶段堆到最后一起提交。
2. **本地服务启动**：最终验收前必须在 `seedcmp` 根目录执行：

 ```bash
 bash scripts/start-im-clowder.sh start
 ```

3. **真实 H5 验收**：必须打开 agenthub_ui 的 H5 dev server（`bash scripts/start-dev.ps1` 或 `pnpm dev:h5`）做真实操作；不依赖 mock 数据、静态 fixture、纯截图。验收时同时跑 im_web `http://localhost:3000` 比对：agenthub_ui 与 im_web 看到的同一组会话/消息必须一致。
4. **账号可自理**：可使用已有测试账号登录，也可主动创建新账号；验收记录写明 user id、token、refresh token、ws_addr。
5. **真实网络**：所有 API 走 `seedcmp` 启动的 `im-web` 后端（TangSeng + Clowder + OAuth），不接 mock server。
6. **真实多端**：开 agenthub_ui 浏览器窗口 + im_web `http://localhost:3000` 窗口做真实验证。
7. **真实猫猫调用**：在 Web 端真实创建或选择 Clowder cat，选择 OAuth 登录方式。
8. **运行平台优先级**：创建/选择猫猫时运行平台优先 `Claude Code`；如果本机能力或 OAuth 配置不可用，再降级为 `Codex`，并在验收记录中写明原因。
9. **证据留存**：浏览器验收要保存截图、关键 fetch/响应日志、user/会话/群 id、运行平台、OAuth 状态和失败诊断，建议放在 `sections/agenthub_ui/.ai/tests-e2e/v1-1-<timestamp>/`。

## 1. 现状盘点（agenthub_ui 当前能力 vs im_web 后端）

### 1.1 agenthub_ui 当前形态

- uni-app + Vue3 + Pinia + Sass 工程，入口 `main.js` + `pages.json` + `uni.*` API，运行时是 uni-app（不是纯 Web Vite）。
- **9 个 Pinia stores**：`agent.js` / `app.js` / `contact.js` / `conversation.js` / `file.js` / `group.js` / `message.js` / `navigation.js` / `settings.js`。
- **所有 store 都是 fixture**：硬编码会话、硬编码消息、硬编码智能体、硬编码 skill 模板；状态由 `state() { return { .. } }` 直接内置，无任何 `fetch` / `api` / `request` 调用。
- `app.js` 用 `uni.getStorageSync` / `uni.setStorageSync` 持久化 token/user，所有用户信息是 mock；`app.js` 的 `setCurrentUser(user, token = '')` 调用方在 login 页写入 `mock_token_abc123`（**已确认**：在 `pages/login/index.vue` 中真实存在）。
- **没有 `api/` 目录**、**没有 `services/` 目录**、**没有 `auth` 拦截器**、**没有 `WKSDK` 引用**、**没有 `clowderApi`**。
- composables 5 个全是 UI 类（`useConfirm` / `useContextMenu` / `useResponsiveLayout` / `useSafeArea` / `useSystemNotification`），无网络/数据 composable。
- utils 4 个全是格式化/manifest 统计（`avatarFallback.js` / `formatConversation.js` / `formatMessage.js` / `manifestCoverage.js`），无网络工具。

### 1.2 im_web 后端暴露面（可直接复用）

`packages/base-vue/src/service/` 与 `packages/base-vue/src/index.js` 暴露：

- `apiClient`（基于 axios，带 token 注入、kickout 拦截、refresh 流程、错误归一化）。
- `StorageService`（基于 `localStorage`，封装 token/uid/name/loginInfo 读写）。
- `KickoutOverlay`（UI 组件，多端登录被踢的提示）。

`packages/datasource-vue/src/api/` 暴露：

- `authApi.login / quit`、`userApi.updateProfile / getReddot`、`syncApi.syncMessages / revokeMessage`、`groupApi.*`、`fileApi.*`、`clowderApi.*`。
- `useSdkStore`（WKSDK 初始化、connect、reconnect、recovery）。
- `useUserStore` / `useChannelStore` / `useGroupStore` / `useConversationStore` / `useMessageStore`（已修复 V3-41 实时同步缺陷）。

### 1.3 关键不兼容点

- **uni-app 运行时 vs Web Vite**：`base-vue` 与 `datasource-vue` 是 `@tsdaodao/*` 包，原本给 Web 消费，**不能在 uni-app runtime 直接 import**（没有 `window`、没有 axios 适配 uni 的网络 API、uni-app 不解析 `.ts`）。
- **uni-app 持久化 API**：`localStorage` 在 uni-app H5 下可用但其他端受限；`uni.getStorageSync` / `uni.setStorageSync` 是统一抽象。
- **axios 不可用**：uni-app 走 `uni.request` 走自己封装的网络层；需要写 `request` 适配层。
- **类型系统**：agenthub_ui 全部 JS，无 TS；im_web 的 `@tsdaodao/*` 包提供 `.d.ts`，但 agenthub_ui 不能直接 import（构建体系不同）。

## 2. 不足检查结论（要做哪些完善）

agenthub_ui 自身需要新增/完善 5 类基础设施：

1. **跨运行时网络层**：H5 走 fetch / 小程序走 `uni.request` / 未来移动端走原生；统一 `request<T>(url, options)` 形态，**必须**支持 token 注入、kickout 拦截、refresh token、错误归一化。
2. **真实 auth 域**：登录/注册/退出走 `authApi.login` / `authApi.quit`；登录态走 `StorageService` H5 兼容（`uni.setStorageSync` 优先，回落 `localStorage`）；踢下线检测、token 失效重登、refresh 流程。
3. **真实 user/me 域**：fetch 当前用户、写回 store、删除 mock user。
4. **真实 im token + ws_addr 域**：登录成功后从后端拉 `users/${uid}/im` 拿 `ws_addr`，喂给 WKSDK。
5. **环境变量/构建配置**：把后端 base URL、ws URL、OAuth client id 等抽到 `.env` / `manifest.json` / `env.js` 单点。

不重写所有 store，只先把"网络 + auth + user"基础设施接上，让 V1-2 能在此之上接入 IM 实时链路、让 V1-3 能接入 Clowder。

## 3. 影响模块

- `sections/agenthub_ui/main.js`（挂 `request` 拦截器、错误处理）
- `sections/agenthub_ui/App.vue`（启动时初始化 auth、theme 不变）
- `sections/agenthub_ui/manifest.json`（H5 router base、api base、ws base 配置）
- `sections/agenthub_ui/utils/`（新增 `request.js` / `env.js` / `storage.js`）
- `sections/agenthub_ui/stores/app.js`（替换 `uni.getStorageSync` → `storage.js` 抽象；新增 `bootstrapAuth()` / `kickout` 状态）
- `sections/agenthub_ui/stores/`（新增 `auth.js` / `user.js` 真实 store）
- `sections/agenthub_ui/pages/login/index.vue`（接入真实 login API；删除 `mock_token_abc123`）
- `sections/agenthub_ui/pages/login/register.vue`（接入真实 register API）
- 视觉来源：保持 agenthub_ui 自身 styles，不引入 im_web tokens（V1-1 阶段不动 V1-3 视觉细节）。
- 验证脚本：`sections/agenthub_ui/scripts/smoke-test.js`（已有）扩展。

## 4. 推荐设计

### 4.1 跨运行时网络层（`utils/request.js`）

新增 `request<T>(url, options)`，**优先**走 `uni.request`（覆盖所有端），H5 端可走原生 `fetch`（更现代）。统一返回 `Promise<{ data: T; status: number; headers: any }>`，错误抛归一化的 `AppError`。

拦截器链（按顺序）：

1. **auth 注入**：从 `auth.js` store 读 accessToken，写入 `Authorization: Bearer <token>`。
2. **kickout 拦截**：响应 `401` 且 `code === 'kicked'` → 触发 `appStore.triggerKickout()`，跳登录页；响应 `401` 且是 token 失效 → 尝试 refresh（一次），失败再登出。
3. **错误归一化**：`err.message || err.msg || fallback`，按 im_web 的 `formatApiError` 风格一致化。
4. **超时**：默认 15 秒，token refresh 单独 30 秒。
5. **baseURL 注入**：从 `env.js` 读 `IM_WEB_API_BASE`（H5 下 = `http://localhost:3000`）。

**测试约束**：`pnpm test:unit` 加 `request.spec.js`：
- mock fetch / `uni.request`，断言 header 注入正确。
- 401 kicked 不重试，触发 `appStore.triggerKickout()`。
- 401 普通 token 失效走 refresh，refresh 失败再登出。
- 业务错误 `code !== 0` 抛 `AppError`。

### 4.2 真实 auth 域（`stores/auth.js` + `pages/login/*`）

新增 `useAuthStore`（Pinia setup store）：

```js
state:
 - accessToken, refreshToken, expiresAt
 - loginStatus: 'idle' | 'submitting' | 'success' | 'failed'
 - lastError
actions:
 - login(credentials): 走 authApi.login
 - register(payload): 走 authApi.register
 - logout(skipRemote): 走 authApi.quit + 清 local state
 - refreshAccessToken(): 走 authApi.refresh（一次）
 - bootstrap(): 从 storage 恢复 token，校验有效性
```

- `pages/login/index.vue` 删除 `mock_token_abc123`、删除 mock `setCurrentUser`，改调 `authStore.login(creds)`。
- `pages/login/register.vue` 同样。
- 启动时 `App.vue.onLaunch` 调 `authStore.bootstrap()`：有 token → 静默校验 + 拉 user；没 token → 进 login 页。

### 4.3 真实 user/me 域（`stores/user.js`）

新增 `useUserStore`：

```js
state:
 - currentUser: null | { uid, name, short_no, sex, avatar, .. }
 - userCache: Record<uid, User>
actions:
 - fetchMe(): 走 userApi.getMe
 - updateProfile(patch)
 - getUsersByIds(uids): 走 userApi.batch
```

登录成功后 `userStore.fetchMe()` 拉真实用户并写入 `appStore.currentUser`（**逐步替换** mock 部分，V1-1 阶段不强删 app.js 现有字段，避免破坏未接入的页面）。

### 4.4 真实 im 域（`stores/im.js`，为 V1-2 准备骨架）

V1-1 阶段只搭骨架：

- 拉 `users/${uid}/im` → 拿 `ws_addr`、im token；缓存到 `authStore.imToken` 与 `im.js.ws_addr`。
- 不在 V1-1 阶段初始化 WKSDK（V1-2 阶段才接 SDK）——V1-1 只验证"登录后能拉 ws 地址"。

### 4.5 存储抽象（`utils/storage.js`）

```js
storage.get(key) → 优先 uni.getStorageSync，H5 回落 localStorage
storage.set(key, value) → 同上，自动 JSON.stringify
storage.remove(key) → 同上
storage.clear() → 全部清除（用于 logout）
```

- `app.js` 全部 `uni.getStorageSync` / `uni.setStorageSync` / `uni.removeStorageSync` 改走 `storage.*`。
- 这是迁移 IM 数据持久化的前置（V1-2 的消息草稿、未读、消息历史缓存都要用）。

### 4.6 兼容策略

- **不删除** agenthub_ui 现有 9 个 fixture store，但把 `state()` 中的 fixture 数据**全部标记为 "demo"**，开发期可见，生产期 `env.js.IS_DEMO = false` 时**自动清空** fixture。
- 迁移期间允许 store 既有 `demoConversations` 又有 `realConversations`，由 `appStore.mode` 决定走哪一组；V1-2 阶段统一收敛到 `realConversations`，V1-3 阶段彻底删除 fixture。
- `pages.json` H5 路由结构保留不变；不在 V1-1 阶段改路由。

## 5. 分阶段实施计划

### 阶段 1：环境与网络层骨架

目标：

- 新建 `utils/env.js`：从 `manifest.json` / `process.env` 读 `IM_WEB_API_BASE`、`IM_WEB_WS_BASE`、`OAUTH_CLIENT_ID`、`IS_DEMO`。
- 新建 `utils/storage.js`：抽象 `uni.getStorageSync` + `localStorage` 双后端。
- 新建 `utils/request.js`：实现 `request<T>` 跨运行时网络层（`uni.request` + H5 fetch），含 auth 注入、kickout 拦截、refresh、错误归一化、超时。
- 单元测试 `tests/unit/request.spec.js` 覆盖：header 注入、401 kicked 触发、401 普通 refresh、business error 抛 `AppError`、timeout。

阶段完成必须中文 commit，例如：

```text
V1-1 阶段1：agenthub_ui 跨运行时网络层与存储抽象
```

### 阶段 2：auth + user 真实 store

目标：

- 新建 `stores/auth.js`（Pinia setup store）：`accessToken` / `refreshToken` / `loginStatus` / `bootstrap` / `login` / `register` / `logout` / `refreshAccessToken`。
- 新建 `stores/user.js`：`currentUser` / `userCache` / `fetchMe` / `updateProfile` / `getUsersByIds`。
- `stores/app.js` 把所有 `uni.getStorageSync` / `uni.setStorageSync` / `uni.removeStorageSync` 切到 `storage.*`。
- 单元测试 `tests/unit/auth.spec.js` / `tests/unit/user.spec.js`：mock request 走通 login、logout、refresh、fetchMe。

阶段完成必须中文 commit，例如：

```text
V1-1 阶段2：agenthub_ui 真实 auth + user store
```

### 阶段 3：登录/注册页面接入真实 API

目标：

- `pages/login/index.vue` 删除 `mock_token_abc123` 写入；调用 `authStore.login(creds)`；成功后 `userStore.fetchMe()`，跳主页。
- `pages/login/register.vue` 同上走 `authStore.register`。
- 登录失败显示真实后端错误（不再用 fake "密码错误" 文案）。
- 验收：H5 跑 `pnpm dev:h5`，真实登录 seedcmp 测试账号成功，跳到主页拿到真实 user.uid/name/avatar。

阶段完成必须中文 commit，例如：

```text
V1-1 阶段3：登录注册接入真实 API
```

### 阶段 4：im 域骨架（ws_addr 拉取）

目标：

- 新建 `stores/im.js`：`wsAddr` / `imToken` / `fetchImAddress()`：登录后调 `GET users/${uid}/im`，写入并缓存。
- `App.vue.onLaunch` 在 `authStore.bootstrap` 成功后调 `imStore.fetchImAddress()`。
- 单元测试：mock request 返回 `{ ws_addr: 'ws://..' }`，断言 `imStore.wsAddr` 被写入。
- 不在 V1-1 阶段初始化 WKSDK（V1-2 阶段负责）。

阶段完成必须中文 commit，例如：

```text
V1-1 阶段4：im 域 ws_addr 拉取骨架
```

### 阶段 5：自动化回归与真实 H5 验收

目标：

- `pnpm test:unit` 全绿。
- `pnpm build:h5` 通过。
- 真实 H5：从 `seedcmp` 根 `bash scripts/start-im-clowder.sh start`，`pnpm dev:h5` 起 agenthub_ui；完成以下真实验收：
 1. 注册新账号 → 自动登录 → 进主页，user 头像/昵称真实。
 2. 已有账号登录 → 进主页，token 持久化（刷新 H5 不丢登录）。
 3. 登出 → 跳回 login 页，token 清空。
 4. 同时打开 im_web `http://localhost:3000` 用同账号登录，对比 user 资料一致。
 5. 后端返回 401 kicked（用另一端同账号登录踢这一端），agenthub_ui 触发 kickout overlay 跳回 login。
 6. 保存截图、关键请求/响应、user id、token（脱敏）到 `sections/agenthub_ui/.ai/tests-e2e/v1-1-<timestamp>/`。

阶段完成必须中文 commit，例如：

```text
V1-1 阶段5：基础设施真实 H5 验收完成
```

## 6. 测试与验收清单

- Unit：
 - `request` 跨运行时层：header 注入、kickout、refresh、business error、timeout。
 - `auth` 域：login、register、logout、refresh、bootstrap、token 持久化。
 - `user` 域：fetchMe、updateProfile、batch users。
 - `im` 域：fetchImAddress、ws_addr 缓存。
- E2E：
 - 注册→登录→主页；登出→login；token 持久化；401 kicked。
- Live：
 - `bash scripts/start-im-clowder.sh start` + `pnpm dev:h5`；
 - H5 与 im_web `http://localhost:3000` 双端同账号比对 user 资料一致；
 - 保存 evidence、ids、runtime choice、OAuth status。

## 7. 风险与回滚

- **风险：跨运行时 request 适配在 H5 / 小程序 / App 行为不一致。** 处理：阶段 1 单元测试覆盖三种入口；H5 验收必须真实跑 `pnpm dev:h5`；小程序端 V1-1 不验收，留 V1-3 后做。
- **风险：删 `mock_token_abc123` 后未接入的页面（personal center / settings）读不到 user。** 处理：V1-1 阶段**保留** `app.js.currentUser` 字段，agenthub_ui 现有未迁移页面继续用；V1-3 阶段统一收敛。
- **风险：refresh token 流程与 im_web `apiClient` 不完全一致。** 处理：V1-1 阶段以 im_web `apiClient` 行为为参照，但 V1-1 不直接 import im_web 包（构建体系不兼容），写独立但行为兼容的 `request.js`；V1-2 阶段再决定是否抽出共享。
- **风险：uni-app 端 `localStorage` 行为差异。** 处理：`storage.js` 优先 `uni.*`，H5 才用 `localStorage`，并对所有调用 try/catch。
- **风险：阶段 5 真实 H5 验收发现 `seedcmp` 启动脚本未带 agenthub_ui 入口。** 处理：阶段 5 前先确认 `start-im-clowder.sh` 是否需要扩展；若不需要，agenthub_ui 自起 `pnpm dev:h5` 与 im_web `localhost:3000` 并存即可。

## 8. 完成定义

V1-1 只有同时满足以下条件才算完成：

- `utils/request.js` 跨运行时网络层已落地，单元测试覆盖 header 注入、kickout、refresh、business error、timeout。
- `stores/auth.js` / `stores/user.js` / `stores/im.js` 真实 store 已落地，单元测试覆盖 login/register/logout/refresh/bootstrap/fetchMe/fetchImAddress。
- `pages/login/index.vue` 与 `pages/login/register.vue` 已接入真实 API，**`mock_token_abc123` 字符串不再出现在 agenthub_ui 源码中**（grep 验证）。
- `storage.js` 抽象层已替换 `app.js` 中所有 `uni.getStorageSync` / `uni.setStorageSync` / `uni.removeStorageSync`。
- 真实 H5 验收：注册/登录/持久化/登出/kickout 全部真实走 im_web 后端；H5 端与 im_web `http://localhost:3000` 端同账号 user 资料一致；截图、日志、user id 证据完整。
- `pnpm test:unit` / `pnpm build:h5` 通过。
- 每个阶段都有对应中文 commit。
