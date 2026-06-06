# Issue 001：agenthub_ui 仍使用 mock 登录、fixture store 与 setTimeout 模拟链路

- 状态：Resolved
- 严重级别：High
- 发现时间：2026-06-07
- 影响平台：H5/Web、移动浏览器、Android APP-PLUS
- 关联计划：V1-1、V1-2、V1-3

## 现象

`pages/login/index.vue` 登录成功后写入 `mock_token_abc123`，`pages/login/register.vue`、`stores/message.js`、`pages/group/create.vue`、`pages/contacts/add.vue`、`pages/agents/new.vue` 等处仍使用 `setTimeout` 模拟后端成功或消息状态变化。`stores/conversation.js`、`stores/message.js`、`stores/agent.js`、`stores/file.js`、`stores/settings.js` 等核心域仍以 fixture 初始化。

## 期望

登录、注册、用户资料、IM 凭证、会话、消息、群组、联系人、文件、Clowder 与设置能力应通过 agenthub_ui 自己的 uni-app 安全网络层访问 seedcmp/im_web 后端；无法接入的后端能力必须展示 unavailable/TBD，不允许假装成功。

## 修复计划

1. 新增 `utils/env.js`、`utils/storage.js`、`utils/request.js` 和 `api/*`，统一真实后端接入。
2. 新增/改造 `auth`、`user`、`im`、`conversation`、`message`、`agent`、`clowder` 等 Pinia store。
3. 删除业务链路里的模拟 `setTimeout`，改为真实 action 或 unavailable 状态。
4. 补充单元测试、H5 构建、浏览器截图与验收报告。

## 验证

- `npm run test:unit`：17 passed
- `npm run build:h5`：Build complete
- 真实 H5 登录：`008618337488675` 登录 agenthub_ui 成功，WebSocket connected
- agenthub_ui 与 im_web 对照：项目群、PM、Clowder AI 等关键会话一致；无 `未命名会话` / `1970`
- H5 浏览器截图：`issues/screenshots/v1-final-agenthub-1440.png`、`issues/screenshots/v1-final-agenthub-375.png`、`issues/screenshots/v1-final-imweb-1440.png`
