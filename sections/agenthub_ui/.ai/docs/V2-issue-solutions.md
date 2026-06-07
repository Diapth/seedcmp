# V2 Issue 解决方案

> 配套：[V2-acceptance-report.md](./plan/V2-acceptance-report.md) + [V2-test-plan.md](./plan/V2-test-plan.md)
> 服务运行地址（172.18.58.156）：H5 `http://172.18.58.156:5173/`、API `http://172.18.58.156:3000/`
> Run ID: `v2-full-20260607-041127`
> 状态：本文件只给"问题→修复方向→关联代码/接口→DoD"，不直接改业务代码；落地请走 worktree + PR 流程。

## 0. 红区总览与修复优先级

| 簇 | 严重度 | 主要症状 | 一句话根因 | 优先级 |
|---|---|---|---|---|
| V2-01 | P1 | 多端登录被踢无 UI overlay | `im_web` 对照端不可达（3000 端口实际是 im-web API，不是 im_web UI） | P1 |
| V2-02 | P1 | 注册页缺确认密码、密码 6 位即可，弱密码真实落库 | 前端注册表单契约未升级；后端 `registerReq.CheckRegister()` 仍用 `<6` | **P0（前置）** |
| V2-07 | P1 | 智能体创建未调 Clowder capabilities、模型列表硬编码 | 创建页表单只读 `constants/models`，未接 `clowderApi.getCatDirectory()` | P1 |
| V2-09/10/11 | P1 | PM+worker 协同、看板四态、Artifacts、Deployment 全部空 | Clowder 面板与项目群未对接；`useCoordinationStore` 仍 mock | P1 |
| V2-13 | P1 | 视频/音频/大文件/非法文件预览无真实资产 | `assets/` 缺测试素材 + 文件预览组件未做白名单 | P1 |
| V2-16 | P1 | 端到端一致性全失败 | 同 V2-01，需要可访问的 im_web UI | P1 |
| V2-03~06/08/12/14/15/17 | P2 | 路径已存在但告警/PASS_WITH_WARNING | 多为截图证据缺、UI 文案与 im_web 不一致、状态机不闭环 | P2 |

修复顺序建议：**P0（V2-02）→ P1（V2-01/16 → V2-07/09/10/11 → V2-13）→ P2 簇**。

---

## 1. V2-01 多端登录被踢（im_web 对照端不可达）

**问题**：用例 `V2-01-04` 访问 `http://172.18.58.156:3000` 期望拿到 im_web UI，runner 拿到的是 200 + API HTML，不是可识别的 im_web SPA；Kikcout overlay 永远不可见。

**根因**：
- 172.18.58.156:3000 是 `im-web` 后端 API（`TangSengDaoDaoServer`）。im_web 的 Vite dev server 默认 `http://localhost:5174` 或 `:3001`（请以 `seedcmp/scripts/start-im-clowder.sh` 实际启动参数为准）。
- V2 计划写的 "im_web 对照端 `http://localhost:3000`" 是过时的、与当前部署不符的占位。

**修复方向**：

1. 在 `seedcmp/scripts/start-im-clowder.sh` 中显式打印 im_web UI 的真实访问地址；CI 启动后写入 `tests-e2e/.im_web_url`，供 runner 读取。
2. 修复 `agenthub_ui/.ai/tests/v2-full-runner.mjs` 探活逻辑：先 HEAD 看返回 HTML 是否含 `id="app"` / `<div id="root">`；不是 UI 就 FAIL。
3. 前端加 `KickoutOverlay` 组件，订阅 ws `kickout` 事件（后端有 `pc/quit` / `quit` / 多设备登录踢出事件），收到立即清 storage 跳登录。
4. 关键接口：用户端调用 `POST /v1/user/quit`（自身退出）、`POST /v1/user/pc/quit`（PC 端退出）；踢出事件由 im 后端 ws 推送，前端 `wsClient.on('kickout', ..)` 监听。

**DoD**：在 im_web UI 真实可达的环境下重跑 `V2-01-04`，出现 `KickoutOverlay` 文案 + 跳回登录页。

---

## 2. V2-02 注册门禁（P0，前置修复）

**问题**：
- 注册页无"确认密码"字段；密码提示"不少于 6 位"低于 V2 计划要求的 8 位。
- 7 位密码未在客户端拦截，并实际写库（`POST /v1/user/register` 返回 200，跳到聊天页）。
- 账号 B (`13800000001`) 被弱密码提前注册，污染了 V2-02-04 的计划注册态。

**当前代码契约**（运行态 + 当前 workspace 一致）：

```vue
<!-- sections/agenthub_ui/pages/login/register.vue:77 -->
<text class="input-label">密码</text>
<input type="password" v-model="password" placeholder="密码 (不少于6位)" />
```

```js
// sections/agenthub_ui/pages/login/register.vue:147
if (password.value.length < 6) {
 errorMessage.value = '密码长度不能少于6位';
 return;
}
```

后端契约（`TangSengDaoDaoServer/modules/user/api.go:2742-2747`）：

```go
if len(r.Password) < 6 {
 return errors.New("密码长度必须大于6位！")
}
```

**修复方向**：

1. **前端**（`pages/login/register.vue`）：
 - 新增 `confirmPassword` 字段与"显示密码/隐藏"切换。
 - 校验顺序：空 → 11 位手机 → 验证码非空 → 密码 ≥8 位且含数字+字母 → 两次密码一致。
 - placeholder 改"至少 8 位，建议含字母+数字"。
2. **后端**（`TangSengDaoDaoServer/modules/user/api.go:2742`）：把 `<6` 升级为 `<8`（或与 im_web 同步对齐为 8~20 位）。需要权衡 im_web 客户端兼容——查 im_web `pages/login/register.vue` 的现行规则，按 im_web 现行策略同步。
3. **测试账号清理**：让运维重置 `13800000001`（或临时换号到 `13900000001`）。具体清理路径：`TangSengDaoDaoServer` 直接连 MySQL/Redis 删 user + 删 short_no；或调用 `DELETE /v1/user/destroy/:code`（需先 `POST /v1/user/sms/destroy` 拿验证码）。
4. **建议新增 Playwright 用例**：`V2-02-02-扩展`: 7 位密码被前端 inline 拦截、不发任何网络请求；7 位密码直接发请求被后端 400 拒绝；不重复发请求被 400 "该用户已存在"。

**DoD**：
- 前端 7 位密码无法提交。
- 后端用 curl `POST /v1/user/register` 7 位密码返回 4xx。
- `13800000001` 重置后能用 `Test1234!` 干净注册。

---

## 3. V2-03 好友关系（PASS_WITH_WARNING）

**问题**：UI 路径可达，但每个 case 都只是"路径走完"，没有强断言；加好友红点/同意后单聊出现/双向同步等都没拿到证据。

**根因**：
- `pages/contacts/add` 搜出 A（"leng"）后能进入"发送申请"，但未验证 A 端是否真实收到；红点未断言。
- V2 计划要求的"好友请求页有验证消息+头像"对当前 UI 是部分满足。

**修复方向**：

1. 关键接口：
 - `POST /v1/friend/apply` 发起申请。
 - `GET /v1/friend/apply` 申请列表。
 - `POST /v1/friend/sure` 同意；`PUT /v1/friend/refuse/:to_uid` 拒绝。
 - `GET /v1/friend/sync` 增量同步。
 - `DELETE /v1/friends/:uid` 删除好友。
 - `POST /v1/user/blacklist/:uid` / `DELETE /v1/user/blacklist/:uid` 黑名单。
2. 前端 `pages/contacts/friend-requests.vue`：空态显示"没有新的好友申请"是符合预期的（无新请求时），但需要在收到新请求时立刻刷新列表（订阅 ws 事件 `friend.apply`）。
3. runner 增强：截 "申请前 vs 申请后" 两次好友请求页，比对"未读条数 / 红点"。
4. 隐私边界：V2-03-09 要求 A 看不到 B↔C 好友关系——后端 `friend/sync` 自身实现是 OK 的，但前端要确保不会把 B 的好友列表当成全量数据展示。

**DoD**：在两个真实账号之间完成 A→B 加好友，三端（agenthub_ui B、im_web A、im_web B）的联系人列表在 1s 内同步。

---

## 4. V2-04 删除好友

**问题**：UI 进入 contacts 主页后没看到删除按钮被触发，5 个 case 全部停留在首页。

**根因**：
- 当前 `pages/contacts/index.vue` 联系人页没有"长按/详情/删除好友"入口；A 账号资料卡片只显示"测/通讯录/管理好友/联系人/群聊.."，无删除操作。
- 需要在 `pages/contacts/detail.vue`（如不存在则新建）实现"删除好友 + 二次确认"。

**修复方向**：

1. 新建/补全 `pages/contacts/detail.vue`：
 - 顶部：头像、昵称、uid、短号、地区。
 - 按钮区：发消息、备注、删除好友（红色，二次确认弹窗）。
2. 关键接口：`DELETE /v1/friends/:uid`。
3. 行为契约：删好友后**不**级联退群（飞书/微信行为）；与群中对方的好友关系独立。
4. 移除黑名单与删好友的差别要明确：黑名单是"拒绝对方消息"，删好友是"解除好友关系但保留会话"。

**DoD**：B 删 A 后，A 端给 B 发消息 B 不收；B-A 单聊仍可见；A 还在原群中。

---

## 5. V2-05 单聊消息

**问题**：用例全部停留在 `pages/chat/index` 列表页（"未找到匹配会话"），未进入单聊。

**根因**：
- 列表为空 → 用例没法点进会话；可推断账号 B/C 在 im 后端的会话表里没数据。
- 需先在 `V2-01/02/03` 完成后才能跑 V2-05。

**修复方向**：

1. 前端 `pages/chat/index.vue`：空态文案保留，但加"加好友后自动出现会话"提示。
2. 关键接口（与 im 后端一致）：
 - `POST /v1/message/send` 代发（系统/机器人）。
 - `POST /v1/message/revoke` 撤回。
 - `PUT /v1/messages/:id` 编辑。
 - `POST /v1/reactions` 添加/取消 emoji。
 - `POST /v1/message/typing` typing 提示。
 - `POST /v1/message/readed` 已读。
 - `POST /v1/message/sync` / `POST /v1/message/channel/sync` 同步。
3. 撤回时间窗：im 后端默认 120s（im_web 默认值一致），按钮置灰。
4. 流式 markdown：与 V2-12 联动，确认 chunk 由 ws 推送（`event.typing` + `event.message`），前端 `useStreamMessage` 按 chunk 增量渲染。

**DoD**：B 给 A 发 "hello" 1s 内 A 端出现；A 撤回后 B 端看到"对方撤回了一条消息"。

---

## 6. V2-06 群聊

**问题**：创建群缺好友（`暂无可选择的好友`）；群信息、踢人、退群、转让等都未真实跑过。

**根因**：V2-06 依赖 V2-03 真实加好友；现 V2-03 没真实通过，V2-06 自然空跑。

**修复方向**：

1. 关键接口（已在 im 后端实现）：
 - `POST /v1/group/create` 创建群。
 - `POST /v1/groups/:group_no/members` 添加成员。
 - `DELETE /v1/groups/:group_no/members` 移除。
 - `GET /v1/groups/:group_no` 群信息。
 - `PUT /v1/groups/:group_no/setting` 修改设置。
 - `PUT /v1/groups/:group_no` 改群信息。
 - `POST /v1/groups/:group_no/exit` 退群。
 - `POST /v1/groups/:group_no/managers` / `DELETE` 管理员。
 - `POST /v1/groups/:group_no/forbidden/:on` 全员禁言。
 - `POST /v1/groups/:group_no/forbidden_with_member` 禁言某人。
 - `GET /v1/groups/:group_no/qrcode` 群二维码。
 - `POST /v1/groups/:group_no/transfer/:to_uid` 群主转让。
 - `POST /v1/groups/:group_no/disband`（`DELETE`） 解散群。
2. 前端补全 `pages/group/info.vue`：群公告编辑按钮目前是"编辑"，但没有 `bind` 到 `PUT /v1/groups/:group_no/setting`。
3. 公告折叠：>200 字应折叠。
4. 大群（50 人）：确认 `pages/group/members.vue` 走虚拟滚动，不一次性渲染 50 个头像。

**DoD**：B 创建群 → 拉 A、C 入群 → B 转让给 A → A 踢 C → C 收到系统消息 → 再加回 → 主动退群。

---

## 7. V2-07 智能体创建（全簇 FAIL，P1）

**问题**：
- 智能体创建页能进（"新建智能体" 4 段表单都在），但用例全部判定 FAIL：`expectedFormVisible=true; realModelListOrCapabilities=false`。
- 表单硬编码了 `Codex / Claude Code / 自定义` 与"自定义" 模型，没有调 `clowderApi.getCatDirectory()` / `clowderApi.getLocalAuthCapabilities()` 拿真实数据。
- `api.new.vue` 文案"创建并部署"按了直接进入 `智能体` 主页（`pages/agents/index.vue` 的"我的技能"），没有走 Clowder 真实创建。

**当前代码**（`pages/agents/new.vue`）：表单含运行平台（Codex/Claude Code）、接入方式（API Key/OAuth）、模型下拉、提示词模板、@ 别名、头像、标签。**未**调任何 clowderApi。

**根因**：
- `useClowderStore` 没有真正接 clowder 域；模型列表 / 角色模板 / 本地 OAuth capabilities 都是写死的常量。
- 提交后没有调 `POST /v1/clowder/cats`，而是用前端 store 模拟。

**修复方向**：

1. 前端 `pages/agents/new.vue`：
 - `onMounted` 调 `clowderApi.getLocalAuthCapabilities()` → 决定 Claude Code / Codex 哪个可登录，**禁用并显式提示**不可用项。
 - 模型下拉用 `clowderApi.getCatDirectory()` 返回的 `clientDefaults.<provider>.models`，不再用写死常量。
 - 提交时调 `clowderApi.createCatAndConnect(..)`，成功后调 `clowderApi.connectCatContact({ catId })`。
 - 失败态必须 UI 显式提示（"API Key 非法"、"OAuth 未授权"），不静默。
2. 后端 `clowder/cats` 接受 `createCatRequest`（`name/alias/roleTemplateId/clientId/authType/accountRef/defaultModel/personality/capabilities`）并落 Clowder 3004。
3. mention patterns：后端去重 + 不区分大小写；前端允许 `@pm / @pm-bot` 都填。
4. 角色模板来源：后端 `GET /v1/clowder/cats` 的 `templates[]` 字段，UI 直接渲染。

**关键接口**：

- `GET /v1/clowder/local-auth/capabilities` — 本地 OAuth 能力。
- `GET /v1/clowder/cats` — Cat 目录（含 templates / clientDefaults / skillCatalog）。
- `POST /v1/clowder/cats` — 创建 Cat。
- `POST /v1/clowder/cats/connect` — 启用/连接 Cat。
- `DELETE /v1/clowder/cats/:catId` — 删除。

**DoD**：在创建页选 Claude Code，UI 正确反映"已登录/未登录/降级 Codex"；用 API Key 创建一只 cat "cat-PM"，3s 内跳转 cat 详情；列表新增一项。

---

## 8. V2-08 与单只智能体对话

**问题**：进入聊天页后停在 `未命名会话 / 12:15 / ⚠️ 当前没有绑定 thread`，说明 `clowderApi.bindConversation()` / `setFocus()` 没被调用。

**根因**：
- 当前聊天页 (`pages/chat/detail.vue` 或类似) 没有进入"已绑定 thread 的智能体会话"模式。
- `pages/chat/index.vue` 列出的"未命名会话"是没有 `channelType=2` (群) 或 `channelType=1` (单聊) 的占位会话。

**修复方向**：

1. 进入"智能体"页 → 选 cat-PM → "发起聊天"应调：
 - `POST /v1/clowder/conversation/bind` (channelId, channelType, threadId, title)
 - `POST /v1/clowder/conversation/focus` (catId)
2. 关键接口：
 - `POST /v1/clowder/conversation/message` — 发消息（带 `directCatId` / `targetCatIds`）。
 - 流式响应：ws 推送 `event.typing` → `event.message` (chunked) → `event.message` (final)。
3. 中断续传：网络断开后重连，streamId + lastSeq 由后端持久化，前端按 lastSeq 续拉。
4. 失败重试：UI 卡片显示"智能体响应失败" + "重试"按钮，调用相同 message 接口并带 `retryOfMessageId`。

**DoD**：B 对 cat-PM 发"写一个 hello world 教程"，5s 内出现流式 markdown，状态机 placeholder → chunk → final。

---

## 9. V2-09 多智能体项目群（全簇 FAIL，P1）

**问题**：智能体看板显示"暂无智能体看板 / 当前还没有按群聊归类的智能体任务"，说明从未发起过 `coordination`。

**根因**：
- `pages/agents/board.vue` 没有调 `clowderApi.listThreadCoordinations(threadId)`。
- 项目群从未被 ensure 过（没调 `POST /v1/clowder/project-groups/ensure`）。

**修复方向**：

1. 在群里 `@cat-PM` 派任务时，前端 `pages/chat/detail.vue` 检测 mention 模式 → 调：
 - `POST /v1/clowder/project-groups/ensure` — 创建/复用项目群。
 - `POST /v1/clowder/coordinator/coordination` — 创建 coordination（goal + subtasks + targetCatIds）。
2. 协调者 cat-PM 拉 worker cat 进入项目群（`clowderApi.syncGroupCats`）。
3. 关键接口：
 - `POST /v1/clowder/project-groups/ensure` — 复用/创建项目群。
 - `GET /v1/clowder/project-groups/active` — 查 active。
 - `POST /v1/clowder/coordinator/coordination` — 创建 coordination。
 - `GET /v1/clowder/coordinator/coordination/:id` — 查 coordination。
 - `PATCH /v1/clowder/coordinator/coordination/:id` — 更新（subtasks / status）。
 - `POST /v1/clowder/coordinator/coordination/:id/cancel` — 取消。
 - `GET /v1/clowder/thread/:threadId/tasks` — 任务列表。
 - `GET /v1/clowder/thread/:threadId/coordinations` — coordination 列表。
 - `GET /v1/clowder/thread/:threadId/artifacts` — 产物。
4. 取消：UI 点"取消" → `POST /v1/clowder/coordinator/coordination/:id/cancel`，所有 cat 收到 cancel 信号，doing 卡变 cancelled。
5. 权限：非项目成员 @cat-PM → 后端拒（permission 校验在 `clowder/permissions.go`）。

**DoD**：在项目群发"@cat-PM 写 todolist" → 3 只 worker cat 入群 → 4 态 Kanban 实时推进 → 产物汇总到 Artifacts。

---

## 10. V2-10 任务看板

**问题**：四态列（todo/doing/blocked/done）从未渲染。

**根因**：`pages/agents/board.vue` 没渲染 task 列表，没接 `clowder/thread/:threadId/tasks`。

**修复方向**：

1. 关键接口（与 V2-09 共享）：
 - `GET /v1/clowder/thread/:threadId/tasks` — 任务列表。
 - `POST /v1/clowder/tasks/:id/transition` — 状态切换（todo/doing/blocked/done）。
 - `POST /v1/clowder/tasks/:id/assign` — 跨人指派。
2. 拖拽：前端用 `vuedraggable` 或类似，按列索引调 transition。
3. 多人同改：后端 last-write-wins（建议带 `version` 字段乐观锁）。
4. blocked：卡上点"标记阻塞" → 弹原因输入 → 写 `task.blockedReason` + 推 `task.blocked` 事件给 PM cat。

**DoD**：B 拖卡 todo→doing→done，C 端 1s 内同步。

---

## 11. V2-11 产物 & 部署

**问题**：Artifacts / Deployment card 全部空。

**修复方向**：

1. Artifacts：
 - `GET /v1/clowder/thread/:threadId/artifacts` — 产物列表。
 - `POST /v1/clowder/thread/:threadId/artifacts` — 上传产物（multipart）。
 - 跨群隔离：后端按 threadId 隔离（`clowder_artifacts WHERE thread_id=?`）。
2. Deployment：
 - `POST /v1/clowder/conversation/deployment-request` — 创建部署请求。
 - `PATCH /v1/clowder/conversation/deployment-request/:id` — 补字段。
 - `POST /v1/clowder/conversation/deployment-action` — confirm / cancel。
 - `GET /v1/clowder/conversation/deployment-request/active` — 当前 active。
 - `GET /v1/clowder/conversation/deployment-request/:id` — 详情。
 - `GET /v1/clowder/deployments/:id` — 状态。
 - `GET /v1/clowder/deployments/:id/logs` — 日志。
3. 状态机：`needs_fields → pending_confirmation → confirmed → queued → running → succeeded | failed | cancelled`。
4. 强约束：必须经 `pending_confirmation` 用户点确认才能进 `submitting`，**不能**绕过。

**DoD**：触发部署 → 出现 card → 用户确认 → running → succeeded / failed，reason 可见。

---

## 12. V2-12 智能体流式输出

**问题**：用例停留在"未命名会话"，没看到 chunk 增量。

**修复方向**：

1. 流式状态机：`placeholder → chunk → final → cleanup`。
2. markdown 渲染：用 `markdown-it` + `highlight.js`，XSS 防护：白名单 + `rel="noopener noreferrer"` + `target="_blank"`。
3. LaTeX：与 im_web 对齐——支持 KaTeX，否则显示纯文本（不假装渲染）。
4. 代码块溢出：`overflow-x: auto`。
5. 表格：`overflow-x: auto` + 列对齐。
6. 同时多 cat 输出：每只 cat 独立 streamId，独立状态机。
7. ws 断连：占位"连接已断开，正在重连…"，重连后按 lastSeq 续传。

**DoD**：让 cat 输出涵盖 H1~H4 / 列表 / 任务列表 / 表格 / 引用 / 链接 / 图片 / `<script>alert(1)</script>` 的 2000 字 markdown，全部正确渲染且脚本不执行。

---

## 13. V2-13 文件预览（4 个 FAIL）

**问题**：
- 视频 / 音频 / 大文件 / 非法文件预览都 FAIL。
- 关键现象：preview 路由 url 携带 `content: "test.md"`，即使 file 已是 `missing-test.mp4`，UI 仍渲染前一份 markdown。说明 `pages/files/preview.vue` 用 query 里的 `content` 字段当主内容，没用 `file.url` 实际拉取。

**根因**：
- 测试用的资产 `assets/missing-test.mp4` / `missing-test.mp3` / `missing-large.zip` / `blocked.exe` 都不存在。
- `pages/files/preview.vue` 没有按 ext 分发渲染器（md/html/pdf/office/img/video/audio/zip），只走 markdown 兜底。
- 缺服务端白名单（`.exe` / `.bat` 应被拒）。

**修复方向**：

1. **资产侧**：
 - 准备 50MB mp4、5MB mp3、200MB zip、`.exe` 各一份放 `sections/agenthub_ui/public/assets/test-fixtures/`。
 - 注意 200MB zip 不进 git，用 `git lfs` 或在测试启动时下载。
2. **前端 `pages/files/preview.vue`**：
 - 按 ext 分发：md→markdown 组件，html→iframe sandbox，pdf→pdfjs-dist，office→提示"请下载"，img→`<img>`，video→`<video controls>`，audio→`<audio controls>`，zip→列表 + 下载。
 - 优先用 `file.url` 拉取，不要用 query.content。
3. **后端白名单**（`TangSengDaoDaoServer/modules/file/api.go`）：
 - 扩展名校验：`uploadFile` 时拒绝 `.exe/.bat/.sh/.msi/.dll`。
 - 响应 400 + "不支持的文件类型"。
4. 关键接口（`modules/file/api.go`）：
 - `GET /v1/file/upload` — 拿上传地址。
 - `POST /v1/file/upload` — 上传（multipart）。
 - `GET /v1/file/preview/*path` — 拉取文件。
5. 大文件：前端走分片上传 + 进度条 + 取消；后端走流式响应（`f.getFile`）。

**DoD**：上传并预览 mp4 / mp3 / 200MB zip 全部走对应渲染器；上传 `.exe` 被拒并提示。

---

## 14. V2-14 设置与设备

**问题**：所有 8 个用例都是 PASS_WITH_WARNING——UI 走完但没强断言。

**修复方向**：

1. 关键接口（`modules/user/api.go`）：
 - `GET /v1/user/devices` 设备列表。
 - `DELETE /v1/user/devices/:device_id` 删除设备。
 - `GET /v1/user/devices/:device_id` 设备详情。
 - `PUT /v1/user/my/setting` 改通知/主题/语言设置。
 - `POST /v1/user/quit` / `POST /v1/user/pc/quit` 退出。
 - `GET /v1/user/qrcode` 我的二维码。
 - `PUT /v1/user/updatepassword` 改密码。
2. 前端 `pages/settings/index.vue` 已有"通知/语言/隐私"项，但：
 - "已拒绝"系统通知（缺 `Notification.requestPermission()` 引导）。
 - 主题切换没真生效（确认 CSS variable 已绑 `theme` store）。
3. 设备管理页 `pages/settings/devices.vue`：列出活跃端并支持踢出。踢出后调用 `DELETE /v1/user/devices/:device_id`，被踢的端收到 ws `kickout` 事件。
4. 二维码登录：登录页"扫码登录" → `GET /v1/user/loginuuid` → 轮询 `GET /v1/user/loginstatus`。

**DoD**：A 端踢 B 端，B 端跳登录页；主题切换刷新后保留。

---

## 15. V2-15 个人中心

**问题**：UI 走完但 "二维码后端能力待接入" 卡片仍显示。

**修复方向**：

1. 关键接口（`modules/user/api.go`）：
 - `GET /v1/user/qrcode` — 我的二维码（PNG/SVG）。
 - `GET /v1/users/:uid` — 用户资料。
 - `PUT /v1/user/current` — 改昵称/头像/签名/性别。
 - `PUT /v1/user/my/setting` — 改隐私（search_by_phone / search_by_short / new_msg_notice）。
2. 前端 `pages/profile/index.vue`：用 `qrcode` 库渲染 QR 码（内含 uid + 加好友 URL）。
3. 短号搜索：后端 `GET /v1/user/search?keyword=<short_no>` 命中。

**DoD**：B 在 A 的"我的二维码"页保存到相册；A 在 B 的添加好友页用扫一扫加 B 成功。

---

## 16. V2-16 端到端一致性

**问题**：同 V2-01，im_web 对照端不可达导致 6 个 case 全 FAIL。

**修复方向**：

1. 先解决 V2-01（找到 im_web 真实 UI URL）。
2. 关键一致性点（依赖的后端事件）：
 - 消息撤回：im 后端推 `event.revoke`，im_web / agenthub_ui 都要订阅。
 - 群公告：推 `event.group.update`，订阅后刷新群信息。
 - 未读：推 `event.message.readed`，订阅后清红点。
 - Clowder 一致性：协调事件走 `clowder/conversation/bind` + `coordination` 推 ws。
3. 时间戳一致：后端用 UTC 毫秒，前端按用户时区显示。

**DoD**：在 agenthub_ui B 端发消息，im_web A 端 1s 内看到；A 端撤回，B 端同步。

---

## 17. V2-17 回归与未覆盖项

**修复方向**：

1. 弱网 / 离线：UI 不卡死；消息发送按钮置灰 + "网络已断开" 提示；恢复后用 `clientMsgNo` 幂等重发。
2. i18n：所有文案走 i18n key，**不允许**中文硬编码。
3. 性能：1000 条消息 / 50 人群 / 30 只 cat 时滚动 FPS ≥ 50，首屏 < 2s，内存 < 300MB。
4. 安全：伪造 admin token 被 401；CSRF 被 CORS 拦截。
5. 未覆盖项：写 `tests-e2e/v2-*/uncovered.md`：语音/视频通话、合并转发、阅后即焚、消息引用回复、reaction 表情包市场等。

**DoD**：V2-17-01 全量回归无新增挂红；V2-17-7 uncovered.md 列出 ≥5 项。

---

## 18. 总体落地建议

1. **严格走 worktree**：所有修改在 `worktree/` 下进行，禁止直接在主仓库 new_ui 分支改代码；每簇独立 PR。
2. **每修一个簇就跑一遍 V2 验收**，不要堆到最后。
3. **接口一致性是核心**——文档 [`im-api-reference.md`](./im-api-reference.md) 给出所有后端 endpoint 的请求/响应字段，前端 store / api 模块与之一一对应。
4. **Clowder 域**是这次最大缺口：智能体创建、流式、Kanban、Artifacts、Deployment 都依赖 `clowderApi.*`；需要单独 PR 接入 `useClowderStore`。
5. **im_web 对照端 URL**必须先固化：见 `im-api-reference.md` §0 的"服务发现"段。
6. **测试账号**：V2-02 修复后必须先重置 `13800000001` / `13800000002`，再重跑 V2-01/02。

---

## 19. 相关 issue 链接

| Issue | 严重度 | 状态 |
|---|---|---|
| V2-01 多端登录被踢无 UI | P1 | Open |
| V2-02 注册契约失败（**P0**） | P1 | Open |
| V2-02 注册弱密码落库 | P1 | Open |
| V2-03 好友关系 warning | P2 | Open |
| V2-04 删除好友 warning | P2 | Open |
| V2-05 单聊消息 warning | P2 | Open |
| V2-06 群聊 warning | P2 | Open |
| V2-07 智能体创建全 FAIL | P1 | Open |
| V2-08 智能体对话 warning | P2 | Open |
| V2-09 多智能体项目群全 FAIL | P1 | Open |
| V2-10 任务看板全 FAIL | P1 | Open |
| V2-11 产物 & 部署全 FAIL | P1 | Open |
| V2-12 流式输出 warning | P2 | Open |
| V2-13 文件预览 4 个 FAIL | P1 | Open |
| V2-14 设置与设备 warning | P2 | Open |
| V2-15 个人中心 warning | P2 | Open |
| V2-16 端到端一致性全 FAIL | P1 | Open |
| V2-17 回归与未覆盖 | P2 | Open |
