# AgentHub UI V1 验收报告

- 验收日期：2026-06-07
- 验收分支：`feat/agenthub-ui-v1-exec`
- 验收 worktree：`/home/yunyi/Desktop/Bytedance_cmp/seedcmp-wt-agenthub-ui-v1-exec`
- 应用目录：`sections/agenthub_ui`
- 对照端：`im_web` at `http://localhost:3000`
- agenthub_ui H5：`http://localhost:5173`
- API base：`http://localhost:3000/v1/`

## 1. 结论

AgentHub UI V1 已完成真实后端接入、IM 会话/消息/群列表同步、Clowder/Agent/File/Settings 真实 API 化与 unavailable 兜底、业务 mock 与伪造成功路径清理，并通过单元测试、H5 构建和真实浏览器对照验收。

本轮验收重点确认：

1. agenthub_ui 登录不再写入 mock token，真实调用 `user/login`。
2. 登录后能拉取真实 user、IM 凭证与 WebSocket 地址。
3. 会话列表来自真实 `conversation/sync`、`group/my`、`message/channel/sync`，与 im_web 关键会话对齐。
4. 不再出现“未命名会话”和 1970 时间。
5. H5 桌面与移动端截图无白屏、无明显遮挡、无主要文本溢出。

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
- `stores/group.js`：真实 `group/my`、群资料、群成员接口。
- `stores/contact.js` / `stores/file.js`：真实好友/文件 API，后端不可用时不伪造成功。
- `utils/im-mappers.js`：兼容真实 sync shape、秒级 timestamp、users/groups channel cache、群最新摘要。

### V1-3 Clowder 与功能完善

- `api/clowder.js`：Clowder status、cat directory、capabilities、binding、group cats、project groups、deployment 等接口。
- `stores/clowder.js`：真实 Clowder 状态、能力失败态、binding、tasks/artifacts/deployments/projectGroups。
- `stores/agent.js`：智能体目录、创建/连接/断开走真实 Clowder API；不再内置 7 个硬编码 agent。
- `stores/projectGroup.js` / `stores/deployment.js`：项目群与部署状态机接入真实 API。
- `stores/settings.js`：设备、二维码登录、skill 上传等能力接后端；接不上时显式 unavailable。

## 4. 回归测试

```bash
npm run test:unit
```

结果：

- Test Files：4 passed
- Tests：17 passed

```bash
npm run build:h5
```

结果：

- `DONE Build complete.`

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

## 6. 问题单状态

- `001-real-backend-integration-gap.md`：Resolved
- `002-uni-build-watcher-enospc.md`：Resolved
- `003-wukongim-build-vcs-status.md`：Resolved
- `004-conversation-sync-shape-and-group-gap.md`：Resolved

## 7. 残余风险

1. Android APP-PLUS 未在真机/模拟器中安装验收；当前实现按 uni 抽象保持兼容，已用 H5 覆盖主要逻辑。
2. 二维码登录、skill 上传等能力依赖后端能力，接不上时已显式 unavailable，没有伪造成功。
3. Sass `@import` 与 uni alpha 告警不影响本轮构建，但后续升级 uni/Sass 时建议清理。
4. Go VCS stamping 在本地 worktree 启动后端时需要 `GOFLAGS=-buildvcs=false`，已记录 issue。
