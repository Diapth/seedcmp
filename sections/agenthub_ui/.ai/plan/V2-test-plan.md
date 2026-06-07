# V2 计划：agenthub_ui 功能完善 + 后端接口对齐 — 端到端测试与验收文档

> 范围：基于已落地 V1-1 / V1-2 / V1-3 后的 agenthub_ui，做"功能完善 + 后端接口对齐"阶段的全量端到端测试。
> 对照基线：sections/im_web（V3 已落地的真实多端聊天 + 猫猫协作）。
> 文档位置：sections/agenthub_ui/.ai/plan/V2-test-plan.md

## 0. 强制执行门禁

1. **三账号真实验证**：本计划必须使用三个真实账号同时在线验证：
 - 账号 A（好友/他人视角）：手机号 `13733632709`，密码 `123456`。
 - 账号 B（本机自建 1）：注册时填真实手机号 + 密码，**记下 uid / token / refresh token**。
 - 账号 C（本机自建 2）：同上。
2. **后端真服务**：所有 API 必须走 `seedcmp` 启动的 `im-web` + Clowder + TangSeng + OAuth，禁止 mock。
3. **本地服务启动**：每次回归前必须先在 `seedcmp` 根目录执行：

要求ip: 172.18.58.156 , 本次测试完全在172.18.58.156上跑通，禁止使用localhost本地回环ip

 ```bash
 bash scripts/start-im-clowder.sh start
 ```

4. **agenthub_ui 真 H5 启动**：

 ```bash
 cd sections/agenthub_ui
 pnpm dev:h5 # 默认 http://localhost:5173
 ```

5. **im_web 对照端**：在另一浏览器窗口打开 `http://localhost:3000`，用同一账号登录，做"同一会话/同一群/同一任务"的一致性核对。
6. **浏览器可视化截图**：每个功能步骤必须**用 Playwright/Chromium 自动化截图 + 录屏**，落盘到 `sections/agenthub_ui/.ai/tests-e2e/v2-<timestamp>/<case-id>/`；不允许"看了一下没截图"就过。
7. **人为逻辑判定**：每步要写明"该步骤在微信/飞书/Telegram/Claude Cowork 等同类产品中的预期行为"，再核对实际是否一致；不一致必须挂红。
8. **阶段提交**：每完成一个测试用例簇（cluster），中文 commit 一次，禁止堆到最后。
9. **平台优先级**：创建/选择猫猫运行时优先 `Claude Code`；不可用则降级 `Codex`，并在报告里写明原因。

## 1. im_web 已具备的能力盘点（参照基线）

来源：`sections/im_web/apps/chat/src/views/*` + `sections/im_web/apps/chat/src/components/*` + `sections/im_web/packages/datasource-vue/src/api/clowder.ts`。

### 1.1 IM 域

- **会话**：单聊（channelType=1）/ 群聊（channelType=2）/ 机器人（channelType>2）三种 channel；会话列表按 lastMsgSeq 倒序、置顶、免打扰、未读计数。
- **消息**：文本/图片/语音/视频/文件/位置/名片/合并转发/reply/撤回/编辑/reaction/typing，**流式输出**（placeholder → chunk → final → cleanup 状态机）。
- **联系人**：好友/黑名单/红点/好友请求（发出/收到/同意/拒绝/过期）。
- **群管理**：创建/解散/退群/转让/踢人/邀请/扫码/公告/群头像墙/成员列表/昵称备注。
- **设备管理**：多端登录、会话同步、被踢下线（kickout overlay）。
- **个人中心**：uid / 昵称 / 头像 / 性别 / 短号 / 二维码。

### 1.2 Clowder / 智能体域（im_web 独有）

- **Cat Directory**：浏览/筛选/创建/连接/断开 cat；platform 维度（Claude Code 优先 / Codex 降级 / iOS / Web）；access mode（API Key / OAuth）；model 选择；skill 标签。
- **Binding**：cat ↔ channel 的绑定状态（active / disabled / orphaned / failed），每个 channel 同一时刻只能 focus 一只 cat。
- **Coordination / 项目群**：用户对 PM/coordinator 发任务 → 创建 project group → 拉 worker cats 入群 → 群里流式产出 → Kanban / Artifacts / Deployment card 全部可见。
- **Kanban**：todo / doing / blocked / done 四态，每个 subtask 可分配给指定 worker cat。
- **Artifacts**：产物（图表 / 文档 / 报告 / 代码 / 视频）按 coordination 聚合，支持 markdown / html / pdf / office 预览。
- **Deployment**：部署请求（pending_confirmation → submitting → running → succeeded / failed / cancelled），有轮询。
- **OAuth 能力检查**：runtime 不可用 / 队列满 / 群被禁 / 未授权等失败态必须有 UI 显式提示，**不允许假装可用**。
- **markdown 流式响应**：智能体回复按 chunk 增量渲染 markdown（粗体/斜体/代码块/表格/列表/链接/图片），与文本混排不闪烁。

### 1.3 文件域

- 上传（图片/视频/音频/任意 binary）、下载、列表、预览（markdown / html / pdf / office / 图片 / 视频内嵌播放）。
- 智能体发送的产物以"消息附件"形式入栈，**预览面板**与原始消息 ID 关联。

### 1.4 工作流

```
启动 im-web + TangSeng + Clowder 后端
 ↓
账号 A/B/C 登录
 ↓
A 与 B 加好友；B 与 C 加好友
 ↓
B 拉 C 进群（B-C 项目群）
 ↓
B 创建智能体 cat-PM（Claude Code 平台）
 ↓
cat-PM 在项目群里 @ 协调者 cat-Worker
 ↓
cat-Worker 拉 sub-worker cats 入群
 ↓
sub-workers 流式输出 markdown 任务结果
 ↓
产物入 Artifacts；任务入 Kanban；deployment 入 deployment card
 ↓
A 在另一端看到同步消息、未读、撤回、reaction
```

## 2. agenthub_ui 当前能力 vs im_web 对照

来源：`sections/agenthub_ui/pages/*` + `components/*` + `stores/*`。

| 域 | 已有 UI | 是否接真实后端 | 与 im_web 差距 |
|---|---|---|---|
| 登录 / 注册 | `pages/login/index.vue` `register.vue` | V1-1 已接 | 二维码登录未接 |
| 联系人 | `pages/contacts/{index,add,friend-requests,blacklist}.vue` | 部分 | 好友请求/红点缺 |
| 群 | `pages/group/{create,index,info,members,qrcode}.vue` | 部分 | 群公告/转让/踢人缺 |
| 智能体 | `pages/agents/{index,new,board,log,skills}.vue` | 仍硬编码 7 个 | Clowder store 未接 |
| 聊天 | `pages/chat/{index,detail}.vue` | V1-2 已接 | 流式 markdown 渲染需验 |
| 文件 | `pages/files/{index,preview}.vue` | 部分 | 真实 upload/download 需验 |
| 设置 | `pages/settings/*` | UI-only | 二维码/通知/设备/skill 缺 |
| 个人 | `pages/profile/index.vue` | 部分 | 短号/二维码需验 |
| Clowder 面板 | `components/chat/ClowderPanel.vue` | 仍是 mock | binding/Kanban/Artifact 缺 |

## 3. 测试账号与初始态准备

### 3.1 账号 A — 好友/他人视角

- 手机号：`13733632709`
- 密码：`123456`
- 角色：在 B 与 C 完成"加好友"前保持 idle；A 不主动加 B/C。
- 验证点：A 是被加好友方，**只接收好友请求并通过**，不主动发起。

### 3.2 账号 B / C — 自建账号

- B 自建：用真实手机号（建议 `13800000001`，与已有测试账号不冲突），密码 `Test1234!`，昵称 `测试员B`。
- C 自建：用真实手机号（建议 `13800000002`），密码 `Test1234!`，昵称 `测试员C`。
- 验完即弃，不写入 fixture。
- 必须记下 B/C 的 uid / token / refresh token，写到 `tests-e2e/v2-<timestamp>/accounts.json`。

### 3.3 三窗口并行

| 窗口 | 端 | 账号 | 视角 |
|---|---|---|---|
| W1 | agenthub_ui H5 | B | 主操作 |
| W2 | agenthub_ui H5 | C | 协作者 |
| W3 | im_web `http://localhost:3000` | A | 旁观对照 |

## 4. 测试用例簇总览

每簇下挂若干 case，每个 case 单独编号 `V2-CC-NN`（CC 为簇编号，NN 为顺序），每步必有截图、关键请求/响应、人工逻辑判定与最终结论（通过/挂红）。

| 簇 | 编号 | 名称 | 重点验证 |
|---|---|---|---|
| 1 | V2-01 | 启动与登录 | 三账号登录、token 持久化、kickout |
| 2 | V2-02 | 注册新账号 | 真实注册链路、字段校验 |
| 3 | V2-03 | 好友关系 | A↔B、A↔C、B↔C 互加 |
| 4 | V2-04 | 删除好友 | 单向/双向、保留会话 |
| 5 | V2-05 | 单聊消息 | 文本/表情/reaction/撤回/编辑/typing |
| 6 | V2-06 | 群聊 | 创建/邀请/公告/踢人/退群/转让 |
| 7 | V2-07 | 智能体创建 | Claude Code 优先 / Codex 降级 / 模型选择 |
| 8 | V2-08 | 与单只智能体对话 | 流式 markdown / 文件预览 / 失败重试 |
| 9 | V2-09 | 多智能体项目群 | PM + Worker cats 协同 / 任务派发 |
| 10 | V2-10 | 任务看板 | Kanban 状态切换 / 拖拽 / 跨端同步 |
| 11 | V2-11 | 产物 & 部署 | Artifacts / Deployment card |
| 12 | V2-12 | 智能体流式输出 | chunk 增量 / markdown 语法支持 / 渲染闪烁 |
| 13 | V2-13 | 文件预览 | md / html / pdf / office / 图片 / 视频 |
| 14 | V2-14 | 设置与设备 | 通知 / 主题 / 多端 / 二维码 |
| 15 | V2-15 | 个人中心 | uid / 短号 / 头像 / 二维码 / 退出登录 |
| 16 | V2-16 | 端到端一致性 | agenthub_ui 三窗口 ↔ im_web 一窗口 |
| 17 | V2-17 | 回归与未覆盖项 | |

## 5. 通用测试规范

### 5.1 截图与证据

- 路径：`sections/agenthub_ui/.ai/tests-e2e/v2-<YYYYMMDD-HHMMSS>/<case-id>/<step-no>_<descr>.png`
- 每步至少一张截图；流式 / Kanban 拖拽 / 视频预览等动态场景连续截图 3+ 张或附 5~10s 录屏 `.webm`。
- 关键请求/响应（401 / kicked / 502 / streaming chunks）落地为 `*.har` 或纯文本 `request.log` / `response.log`。
- 截图内**禁止**出现明文密码 / token；`accounts.json` 中 token 用 `***` 部分脱敏。

### 5.2 浏览器自动化

- 使用 `sections/agenthub_ui/scripts/smoke-test.js` 同款 Chromium launch（无头可选 `--headless=new`）。
- 视口统一：`375x844`（移动）/ `1024x768`（桌面小）/ `1440x900`（桌面大）三档必跑；每个 case 至少跑一档。
- 控制台错误、requestfailed、HTTP ≥400、unhandledrejection **全部**记录到 `<case-id>/diagnostics.log`。
- 元素定位优先用 `data-testid`；缺失的 id 在测试期间向 `agenthub_ui` 提 issue 补齐。

### 5.3 人为逻辑判定模板

每步必须写一段"该步骤在人类视角的预期"，对照实际：

```
[Step V2-03-04] B 在好友申请列表看到 A 申请
- 人类预期：列表按时间倒序，A 的申请在最上，附带"同意 / 拒绝"按钮，且 A 头像 + 昵称 + 验证消息可见。
- 实际：[描述 UI]，[通过 / 挂红：xxx]
- im_web 对照：[截图对比描述]
```

判定不通过 → 立即挂红 + 写 issue 到 `sections/agenthub_ui/.ai/issue/V2-NN.md`，本簇不结案。

### 5.4 命名与提交

- 每簇完成后：`git add sections/agenthub_ui/.ai/tests-e2e/v2-*` + 中文 commit，例如：

 ```
 V2 簇 03：好友关系真实端到端验收
 ```

- issue 单独立文件，禁止与代码同 commit。

## 6. 簇 1：启动与登录（V2-01）

### V2-01-01 H5 启动可达
- 步骤：执行 `pnpm dev:h5`，浏览器打开 `http://localhost:5173/`。
- 预期：自动重定向到 `#/pages/login/index`；无白屏 / 无资源 404 / 控制台 0 报错。
- 截图：`01_login_initial.png`。
- 判定：人工/自动均通过。

### V2-01-02 账号 A 登录（13733632709 / 123456）
- 步骤：填入手机号、密码、点登录。
- 预期：1s 内跳转主页，token 写入 storage；未读 / 会话 / 联系人 正常显示。
- 截图：`02_after_login_A.png`。
- 关键检查：devtools → Application → localStorage 有 `accessToken` / `refreshToken` / `uid`。

### V2-01-03 token 持久化
- 步骤：刷新 H5。
- 预期：仍在主页；不重新跳登录。
- 判定：token 持久化通过 = V1-1 阶段 5 验收项延续。

### V2-01-04 多端登录被踢
- 步骤：A 在 im_web `localhost:3000` 再登一次。
- 预期：H5 端弹出 `KickoutOverlay`，跳回登录页。
- im_web 对照：行为一致。

### V2-01-05 密码错误提示
- 步骤：A 故意输错密码登录。
- 预期：toast / inline 错误信息（**来自后端**），不暴露栈、不留空。

### V2-01-06 账号 B / C 登录
- 同 01-02 流程，分别登录到 W1 / W2。
- 关键检查：B/C 在 im_web 端也能登录同一 uid。


## 7. 簇 2：注册新账号（V2-02）

> 目的：确认注册链路是真实后端（不再有 V1-1 之前的 `mock_token_abc123`）；并把 B/C 两个自建账号准备好。

### V2-02-01 进入注册页
- 步骤：登录页点"注册"按钮。
- 预期：跳 `#/pages/login/register`；字段包含手机号 / 验证码 / 密码 / 确认密码 / 昵称（im_web 必有）。
- 截图：`01_register_page.png`。

### V2-02-02 字段校验
- 步骤：故意留空 / 手机号非 11 位 / 密码 < 8 位 / 两次密码不一致。
- 预期：inline 错误提示；不弹原生 alert。
- 人类逻辑：注册时客户端校验要"先于"网络请求；不能出现"服务端 422 后 UI 才有反应"。

### V2-02-03 验证码获取
- 步骤：填入手机号，点"获取验证码"。
- 预期：倒计时 60s；按钮禁用；后端真实发出短信或 dev 模式回显到 console。
- 关键检查：抓包确认有调用 `/users/sms` 或同类接口。

### V2-02-04 B 注册成功
- 步骤：填入 `13800000001` / 验证码 / 密码 `Test1234!` / 昵称 `测试员B` / 提交。
- 预期：自动登录、跳主页、user 头像/昵称真实。
- 截图：`02_B_registered.png`。
- 证据：把 `uid / accessToken / refreshToken` 写入 `accounts.json`（脱敏）。

### V2-02-05 C 注册成功
- 同 02-04 流程；手机号 `13800000002`，昵称 `测试员C`。
- 截图：`03_C_registered.png`。

### V2-02-06 重复手机号
- 步骤：再注册 `13800000001`。
- 预期：后端报错"手机号已注册"；UI 明确提示。
- 人类逻辑：注册失败的提示语应比登录失败更具体，但**不泄露**对方账号信息。

### V2-02-7 注册后登录态
- 步骤：注册成功后立即刷新。
- 预期：仍是登录态。
- 关键检查：注册成功后写入了 token，但**不能**同时存在两份 token（防注册时"清不掉"上一个账号的 token）。

## 8. 簇 3：好友关系（V2-03）

> 目的：验证 B↔A、C↔A、B↔C 互加好友；A 只接收、不主动。

### V2-03-01 B 通过手机号搜 A
- 步骤：W1（B 登录）→ 联系人 → 添加 → 输入 `13733632709`。
- 预期：命中"测试员 A"（im_web 真实昵称）；点击"添加"。
- 人类逻辑：搜索结果应显示头像 + 昵称 + 短号（如有），不能仅显示手机号。

### V2-03-02 发送好友请求
- 步骤：填写验证消息"我是 B，需要加你为好友" → 发送。
- 预期：toast "已发送"；联系人页 A 的状态显示"待验证"。
- 截图：`01_B_send_request.png`。

### V2-03-03 A 收到好友请求
- 步骤：W3（im_web，A 登录）→ 好友请求页。
- 预期：看到 B 的请求在最上，验证消息完整。
- im_web 对照：保持一致。
- 截图：`02_A_received_request.png`。

### V2-03-04 A 在 agenthub_ui 同意请求
- 步骤：A 切到 agenthub_ui（额外开 W4，账号 A 登录）→ 好友请求 → 同意。
- 预期：状态变为"已添加"；A 与 B 之间出现一个单聊会话（即使无消息也应可见）。
- 人类逻辑：好友添加成功后，**两个端**（agenthub_ui B 端 + im_web A 端）的联系人列表都应立即同步变化，**不需要**手动刷新。

### V2-03-05 红点清除
- 步骤：A 同意后看 agenthub_ui 顶部"好友请求"图标红点。
- 预期：红点消失；总未读数 = 0。
- 人类逻辑：未读 / 红点是用户最敏感信号，**0 → 1 → 0** 必须可见。

### V2-03-06 B 端同步
- 步骤：W1 B 端看联系人。
- 预期：A 已出现在好友列表，状态 active。
- 截图：`03_B_friend_list.png`。

### V2-03-07 重复发请求
- 步骤：B 再发一次好友请求给 A。
- 预期：toast"已是好友"或"请求待处理"，**不**创建重复会话。
- 关键检查：后端去重。

### V2-03-08 跨账号重复
- 步骤：C 同样向 A 发请求 → A 同意。
- 预期：A 联系人列表同时存在 B 和 C；会话列表至少 2 个单聊。

### V2-03-09 B ↔ C 互加
- 步骤：B 搜 C 手机号 → 发请求 → C 同意。
- 预期：B ↔ C 好友关系建立；C 在 A 联系人列表中显示"通过 B 添加"或类似。
- 人类逻辑：不应让 A 看到 B 与 C 的好友关系（隐私边界）。

### V2-03-10 黑名单
- 步骤：B 把 A 加入黑名单。
- 预期：A 发的消息 B 不收（"已拒收"提示在 A 端可见）。
- im_web 对照：行为一致。

## 9. 簇 4：删除好友（V2-04）

### V2-04-01 单向删除（B 删 A）
- 步骤：W1 B → 联系人 → A → 长按 / 详情 → 删除好友 → 二次确认。
- 预期：
 - B 端：A 从好友列表消失；B 与 A 的单聊**仍存在**（微信行为）。
 - A 端：发消息给 B 提示"对方已将你删除"或"消息已发出但被拒收"。
- 截图：`01_after_delete_BA.png`。
- 人类逻辑：删除好友≠删除会话；与微信一致。

### V2-04-02 双向删除
- 步骤：A 端也删除 B。
- 预期：两端都从好友列表消失；单聊会话两端独立保留（消息不丢）。

### V2-04-03 再加回
- 步骤：B 重新加 A。
- 预期：发请求走完流程；A 同意后单聊里**历史消息应保留**（微信行为）。
- 关键检查：保留会话通道 id，但 new friendship 重新计 0。

### V2-04-4 删除好友时关联群
- 步骤：A 与 B 都在群"测试群"中；B 删 A。
- 预期：
 - A 仍在群中（不退出）。
 - 群成员列表同步更新。
 - 人类逻辑：删除好友不应级联退群（飞书/微信行为）。

### V2-04-5 删除被拒
- 步骤：B 已删 A，A 再发好友请求给 B。
- 预期：B 端可再次收到（除非 A 也在 B 黑名单）。

## 10. 簇 5：单聊消息（V2-05）

### V2-05-01 文本消息
- 步骤：B → A 发送"hello"。
- 预期：A 端 1s 内收到；未读 +1；消息状态在 B 端从"已发送"→"已送达"→"已读"（A 端打开会话后触发已读）。
- 截图：`01_text_message.png`。

### V2-05-02 表情 / emoji
- 步骤：B 发送 🎉 / 😀。
- 预期：两端正确渲染 unicode emoji；不出现方块或乱码。

### V2-05-03 消息撤回
- 步骤：B 长按自己刚发的消息 → 撤回。
- 预期：A 端提示"对方撤回了一条消息"；B 端消息消失。
- 关键检查：2 分钟限制（im_web 默认 120s）；超时按钮置灰。

### V2-05-04 消息编辑
- 步骤：B 长按 → 编辑 → 改成 "hello v2" → 发送。
- 预期：A 端看到"hello v2（已编辑）"。

### V2-05-05 reaction
- 步骤：A 在 B 的消息上点 👍。
- 预期：B 端看到 reaction；列表显示"👍 A"。

### V2-05-06 typing
- 步骤：A 在 im_web 输入但未发送。
- 预期：B 端 1~2s 内看到"对方正在输入…"。
- 人类逻辑：5s 不输入应消失。

### V2-05-07 回复 / Reply
- 步骤：B 长按 A 的某条消息 → 回复，发新文本。
- 预期：新消息卡片上引用被回复的消息原文（缩略）。

### V2-05-08 @ 提及
- 步骤：B 发"@A 在吗"。
- 预期：A 端高亮 @；未读 +1 且角标红。

### V2-05-9 跨端已读一致性
- 步骤：A 在 im_web 读消息 → B 在 agenthub_ui 端应看到"已读"。
- 关键检查：im_web 与 agenthub_ui 的已读回执**跨端同步**。

### V2-05-10 长消息 / 折叠
- 步骤：B 发 1000 字以上消息。
- 预期：默认折叠前 3 行 + "展开"按钮；不撑破布局。

### V2-05-11 离线消息
- 步骤：A 退出登录 → B 发 5 条消息 → A 重新登录。
- 预期：A 收到 5 条未读（按发送顺序）。

## 11. 簇 6：群聊（V2-06）

### V2-06-01 创建群
- 步骤：B → 群聊 → 创建 → 群名"测试项目群" → 至少选 2 人（A、C）。
- 预期：创建成功；B 自动为群主；A、C 各收到入群通知。
- 截图：`01_create_group.png`。

### V2-06-02 群信息
- 步骤：进入群 → 群信息。
- 预期：群名 / 群主 / 成员数 / 创建时间 / 群公告 / 二维码。
- 人类逻辑：群主标志（👑）可见；二维码可刷新（防泄漏）。

### V2-06-03 邀请
- 步骤：群主 B 邀请一个未在群的人 D（注册 D：13800000003 / Test1234! / 测试员D）。
- 预期：D 收到邀请通知（im_web/agenthub_ui 都要测）；D 同意后入群。

### V2-06-04 踢人
- 步骤：群主 B 踢 C。
- 预期：C 收到"你被移出群聊"系统消息；C 端会话从列表消失；B/A 端 C 不在成员列表。
- 关键检查：被踢者能否再发消息（应被服务端拒）。

### V2-06-05 主动退群
- 步骤：C 重新被加回 → C 主动退群。
- 预期：C 端会话消失；B 端收到"X 退出群聊"系统消息。

### V2-06-06 转让群主
- 步骤：B 把群主转给 A。
- 预期：A 获得管理权；B 不再是群主。
- 人类逻辑：原群主退群后新群主接管；不能出现"无主"。

### V2-06-07 群公告
- 步骤：A 发群公告。
- 预期：所有成员收到系统消息 + 公告条；公告内容 > 200 字应折叠。
- 关键检查：im_web 端能看到同一公告。

### V2-06-08 @全员
- 步骤：B 发 "@所有人 开会"。
- 预期：所有成员高亮 @；只有群主 / 管理员有 @全员 权限。

### V2-06-09 群禁言
- 步骤：A 禁言 C。
- 预期：C 输入框置灰 / 提示"全员禁言"或"你已被禁言"。

### V2-06-10 群消息跨端
- 步骤：在 agenthub_ui W1 发的消息应在 im_web W3 端 1s 内同步；反之亦然。
- 截图：`02_cross_end.png`。

### V2-06-11 群文件
- 步骤：B 上传 `README.md`。
- 预期：所有成员可在"群文件"tab 看到、下载、预览。

### V2-06-12 大群
- 步骤：建一个 50 人群（注册 E1.E50）。
- 预期：消息不丢；未读计算正确；成员列表可滚动加载（不要一次性渲染 50 个头像）。

## 12. 簇 7：智能体创建（V2-07）

> 目的：覆盖 `pages/agents/new.vue` 真实创建 cat 的链路。

### V2-07-01 进入创建页
- 步骤：B → 智能体 → 创建。
- 预期：表单分 4 段：基础（昵称/头像/简介/mention patterns） / 平台（Claude Code / Codex / iOS / Web） / 模型（claude-opus-4-7[1m] / claude-sonnet-4-6 / gpt-5.2-codex / 自定义） / 访问（API Key / OAuth）。

### V2-07-02 平台选择 - Claude Code
- 步骤：选"Claude Code"。
- 预期：自动检测本机是否登录（`claude` CLI）；已登录则高亮显示账号；未登录则提示"去 claude.ai 登录"或降级到"API Key"模式。
- 关键检查：调用 `clowderApi.capabilities()`，记录 `runtimeAvailable` / `oauthEnabled`。

### V2-07-03 OAuth 失败降级
- 步骤：模拟 Claude Code OAuth 不可用（断网 / 改 env）。
- 预期：UI 显式提示"Claude Code 不可用，已为你降级到 Codex"，**不**静默。
- 人类逻辑：降级必须有明确 UI 反馈，与 im_web V3-42 §4.4 一致。

### V2-07-04 模型下拉
- 步骤：模型选 `claude-opus-4-7[1m]`。
- 预期：列表里只显示 `clowderApi` 返回的可用模型；自定义模型要勾选"自定义"才出现 input。

### V2-07-05 API Key 创建
- 步骤：填 API Key / 模型 / 昵称"cat-PM" / 提交。
- 预期：3s 内创建成功；跳转到 cat 详情页；cat 列表新增一项。
- 截图：`01_create_cat_pm.png`。
- 证据：保存 catId 到 `accounts.json`。

### V2-07-06 OAuth 创建
- 步骤：选 OAuth + Claude Code → 触发 OAuth 流程 → 浏览器跳 oauth provider → 回调。
- 预期：回调后 cat 状态 = `ready`。
- 关键检查：刷新 token 是否被后端持久化（im_web 行为）。

### V2-07-07 mention patterns
- 步骤：填 @pm / @pm-bot / @项目经理。
- 预期：群消息触发 mention 时，cat 自动响应。
- 人类逻辑：mention 模式应去重；不区分大小写。

### V2-07-08 失败态
- 步骤：故意填非法 API Key → 提交。
- 预期：后端拒绝；UI 显式提示；不写入数据库。

### V2-07-09 skill 模板
- 步骤：选"code-review" skill 模板。
- 预期：system prompt 自动填充；用户可改；改后提交保留用户版本。

### V2-07-10 avatar 上传
- 步骤：上传 2MB jpg。
- 预期：上传成功；进度条；最大 5MB 限制；超过提示。


## 13. 簇 8：与单只智能体对话（V2-08）

### V2-08-01 与 cat-PM 单聊
- 步骤：B 在联系人 → 智能体 → cat-PM → 发起聊天。
- 预期：进入单聊；右侧出现 Clowder 面板（focus = cat-PM）。
- 截图：`01_pm_chat.png`。

### V2-08-02 流式首字延迟
- 步骤：B 发"用 markdown 写一个 hello world 教程"。
- 预期：
 - 0~2s：出现 placeholder "正在思考…"
 - 2~5s：首字到达（chunk 1）
 - 持续 chunk 增量渲染
 - 最终 token = final
- 录屏：`02_streaming.webm`，截 3+ 张过程图。
- 人类逻辑：占位符在 chunk 到达瞬间被替换，**不能**整段闪烁或重排。

### V2-08-03 markdown 渲染
- 步骤：cat-PM 输出含 # 标题 / **粗体** / `代码` / 三引号代码块 / 列表 / 表格 / 链接 / 图片的回复。
- 预期：所有语法正确渲染；代码块带语言高亮（如果有高亮器）；不出现 XSS（`<script>` 应被转义）。
- 截图：`03_markdown_render.png`。

### V2-08-04 消息内文件
- 步骤：cat-PM 在回复里发一张 PNG / 一个 PDF / 一个 csv。
- 预期：消息卡片内嵌文件预览（与簇 13 联动）；消息状态正确流转。

### V2-08-05 中断与续传
- 步骤：流式输出中途断网（关闭 wifi 3s 再开）。
- 预期：
 - UI 显示"网络中断"提示；
 - 重连后 cat-PM 续传剩余 chunk（或重新从断点开始）；
 - 不出现重复内容。
- 关键检查：messageSeq 不能错位。

### V2-08-06 失败重试
- 步骤：故意调 `clowderApi` 返回 5xx。
- 预期：消息卡片显示"智能体响应失败" + "重试"按钮；点击重试从断点续传。

### V2-08-07 长上下文
- 步骤：连续对话 30 轮，每轮 ≥ 500 字。
- 预期：响应延迟不指数级增长；UI 滚动顺畅；不丢消息。

### V2-08-08 token 计数
- 步骤：cat-PM 自己的 UI（如果有）显示当前会话的 input/output tokens。
- 预期：与 im_web 显示一致（±5% 误差）。

### V2-08-09 取消生成
- 步骤：流式输出中点"停止生成"。
- 预期：UI 立即停止渲染后续 chunk；消息状态变 `cancelled`；可以追问"继续"。

## 14. 簇 9：多智能体项目群（V2-09）

> 目的：验证用户在群中发任务 → PM cat 拉 worker cats → 协同完成任务。

### V2-09-01 准备多只 cat
- 步骤：除 cat-PM 外，再创建 cat-Worker-A / cat-Worker-B / cat-Summarizer 三只 cat（API Key 模式即可）。
- 截图：`01_cats.png`。
- 证据：catIds 写入 `accounts.json`。

### V2-09-02 PM 绑定频道
- 步骤：在测试项目群中 @cat-PM，确认 binding = active。
- 预期：群成员里 cat-PM 出现（机器人图标）；右侧 Clowder 面板显示 focus = cat-PM。

### V2-09-03 派发任务
- 步骤：B 在群里发"@cat-PM 请写一个简单的 todolist 静态页，要求 30 分钟内完成"。
- 预期：
 - cat-PM 立即回复"任务已收到，开始拆解"。
 - 数秒后 cat-PM 发出 coordination 卡片：拆出 3 个 subtask，分配给 cat-Worker-A / B / Summarizer。
 - 各 subtask 状态 `todo`。
- 截图：`02_kickoff_card.png`。

### V2-09-04 自动加 worker
- 步骤：等待 3~5s。
- 预期：cat-Worker-A/B/Summarizer 出现在群成员（机器人图标）；它们开始流式输出。

### V2-09-05 流式并行
- 步骤：观察 3 只 cat 是否并行输出。
- 预期：3 个消息流交错出现，每只 cat 的占位/正文清晰区分（avatar / 名称）。
- 关键检查：流式不串行阻塞（dispatchMode=parallel）。

### V2-09-06 任务看板
- 步骤：右侧 Clowder 面板 → 切到 Kanban tab。
- 预期：3 个 subtask 卡片在 todo 列；worker 推进时实时移动到 doing → done。
- 截图：`03_kanban.png`。

### V2-09-07 产物
- 步骤：等待 Summarizer 收口，输出最终 `index.html`。
- 预期：产物以"消息附件"形式出现在群里；Art 标签汇总所有中间产物。
- 截图：`04_artifacts.png`。

### V2-09-08 跨端同步
- 步骤：C（账号）在 im_web 端进入同群。
- 预期：C 看到所有猫猫的消息、Kanban、Artifacts。
- 关键检查：im_web Kanban 操作（移动卡片）应在 agenthub_ui 端 1s 内同步。

### V2-09-09 取消
- 步骤：B 在 agenthub_ui 端点"取消 coordination"。
- 预期：所有 cat 收到 cancel 信号；doing 卡变 cancelled；不会再产生新 chunk。

### V2-09-10 串行模式
- 步骤：再发一个任务，明确要求"按顺序做：先 A 后 B 再 Summarizer"。
- 预期：dispatchMode 切到 serial；只有上一只 cat done 后下一只才开始。

### V2-09-11 失败重试
- 步骤：把 cat-Worker-A 的 API Key 改成非法 → 重新派发。
- 预期：cat-Worker-A 状态 `failed`；其他 cat 不受影响；Kanban 显示失败原因 + 重试按钮。

### V2-09-12 权限
- 步骤：非项目成员 D（账号 13800000003）想 @cat-PM。
- 预期：被服务端拒（im_web 与 agenthub_ui 行为一致）。

## 15. 簇 10：任务看板（V2-10）

### V2-10-01 四态
- 步骤：K 上 todo 卡 → 拖到 doing → 再到 done。
- 预期：状态正确切换；后端持久化。

### V2-10-02 blocked
- 步骤：在 doing 卡上点"标记阻塞"→ 填写原因"等 A 提供 API Key"。
- 预期：卡移到 blocked 列；reason 可见；PM cat 收到通知。

### V2-10-3 跨人指派
- 步骤：B 把某卡从 cat-Worker-A 转给 cat-Worker-B。
- 预期：B 端状态变更；A 收到"任务已被转移"。

### V2-10-04 多人同改
- 步骤：B 在 agenthub_ui 拖卡、C 在 im_web 同时拖卡。
- 预期：服务端 last-write-wins；不会两人都改成功（race condition 需写 issue 报告）。

### V2-10-05 看板刷新
- 步骤：手动刷新 / 收到推送。
- 预期：状态与服务端一致；无明显 flash。

## 16. 簇 11：产物 & 部署（V2-11）

### V2-11-01 Artifacts 列表
- 步骤：进 Artifacts tab。
- 预期：列出 coordination 内所有产物（截图/代码/报告/视频）；按类型分组；支持搜索。

### V2-11-02 单产物预览
- 步骤：点 `index.html`。
- 预期：内置预览面板（沙箱，不允许外部 script 越权）；可下载。

### V2-11-03 跨群产物
- 步骤：另一群的产物是否可见（应**不**可见，im_web 行为）。

### V2-11-04 Deployment card
- 步骤：触发一个"部署到 dev 环境"任务。
- 预期：出现 deployment card：
 1. `pending_confirmation`（点确认）
 2. `submitting`（自动转）
 3. `running`（轮询）
 4. `succeeded` 或 `failed`（终态）
- 截图：`01_deployment.png`。
- 人类逻辑：用户**必须**先确认才能进入 submitting；不绕过确认直接部署。

### V2-11-05 取消部署
- 步骤：在 `running` 状态点"取消"。
- 预期：状态 → `cancelled`；服务端停止轮询；UI 不再轮询。

### V2-11-06 部署失败
- 步骤：模拟 5xx。
- 预期：状态 → `failed`；reason 可见；可重试。

## 17. 簇 12：智能体流式输出（V2-12）

> 与 V2-08 联动，本簇专注"流式响应 + markdown"的渲染细节。

### V2-12-01 chunk 增量
- 步骤：让 cat 输出一段长 markdown（≥ 2000 字）。
- 预期：每到达一个 chunk，DOM 立即增量更新；不出现"先空 → 一秒后整段"。

### V2-12-02 markdown 语法覆盖
- 步骤：让 cat 输出涵盖以下语法：标题（H1~H4）/ 粗体 / 斜体 / 删除线 / 行内代码 / 代码块（多语言）/ 列表（有序/无序/嵌套）/ 任务列表 / 表格 / 引用块 / 链接 / 图片 / 水平线。
- 预期：全部正确；与 im_web 渲染一致。
- 截图：`01_markdown_full.png`。

### V2-12-3 闪烁 / 抖动
- 步骤：录屏观察流式过程。
- 预期：滚动条不抖；高度逐行增加；不重排已渲染部分。

### V2-12-4 XSS 防护
- 步骤：让 cat 输出 `<script>alert(1)</script>` / `<img onerror=..>`。
- 预期：脚本不执行；标签转义为文本或安全属性剥离。

### V2-12-5 代码块溢出
- 步骤：让 cat 输出 1000 字符的代码块。
- 预期：横向滚动；不高亮失败。

### V2-12-6 表格
- 步骤：让 cat 输出 5x10 表格。
- 预期：所有列对齐；首行粗体；单元格换行不破坏布局。

### V2-12-7 LaTeX / 公式（可选）
- 步骤：让 cat 输出 `$E=mc^2$` / `$$\int_0^1 x dx$$`。
- 预期：如果 im_web 渲染 KaTeX，agenthub_ui 也应一致；否则显示纯文本（**不假装渲染**）。

### V2-12-8 复制
- 步骤：选中 cat 回复的部分文本 → 复制。
- 预期：复制到剪贴板为纯文本 markdown 源码（不包含 UI 装饰）。

### V2-12-9 同时多只 cat 输出
- 步骤：3 只 cat 同时流式。
- 预期：UI 不会因并发更新而崩溃；每只 cat 独立状态机。

### V2-12-10 终端错误
- 步骤：故意触发 ws 断连。
- 预期：占位文案"连接已断开，正在重连…"；重连后 cat 自动续传。


## 18. 簇 13：文件预览（V2-13）

> 覆盖智能体/用户发送的所有文件类型预览。

### V2-13-01 markdown
- 步骤：B 上传 `test.md`（含标题/代码/表格）。
- 预期：与簇 12 一致渲染；可切换"源码" / "预览"。

### V2-13-02 HTML
- 步骤：上传 `test.html`。
- 预期：iframe 沙箱预览；不跳出导航；按钮不被劫持。

### V2-13-03 PDF
- 步骤：上传多页 PDF。
- 预期：内置 PDF viewer；分页、缩放正常；不下载也能翻页。

### V2-13-04 Office（docx/xlsx/pptx）
- 步骤：上传 `test.docx` / `test.xlsx` / `test.pptx`。
- 预期：服务端有 office 转换（im_web 行为）→ 在线预览；不支持则提示"请下载后查看"，**不假装渲染**。

### V2-13-05 图片（jpg/png/gif/webp/svg）
- 步骤：上传 10MB jpg / 1MB svg。
- 预期：原图预览；SVG 渲染但**禁用**外链 script；可缩放。

### V2-13-06 视频（mp4/webm）
- 步骤：上传 50MB mp4。
- 预期：内置播放器；进度条；倍速；不下载完整文件也能播。

### V2-13-07 音频（mp3/wav/ogg）
- 步骤：上传 5MB mp3。
- 预期：内置播放器；可后台继续播放（切换 tab 不停）。

### V2-13-08 大文件
- 步骤：上传 200MB zip。
- 预期：进度条 + 速度；断点续传；上传中可取消。

### V2-13-09 非法文件
- 步骤：上传 .exe / .bat。
- 预期：服务端拒；提示"不支持的文件类型"。

### V2-13-10 预览中 @ cat
- 步骤：预览中点"@cat-PM 看这份文档"。
- 预期：自动发文件 + mention 到当前会话；cat 收到文件并入栈分析。

### V2-13-11 智能体产物的预览
- 步骤：cat-PM 输出一张 PNG（matplotlib 之类）。
- 预期：消息卡片直接渲染图片，不要求用户点开"预览"。

### V2-13-12 跨端预览一致性
- 步骤：A 在 im_web 看同一文件。
- 预期：UI 行为一致；如有差异（im_web 用 PDF.js 而 agenthub_ui 用 pdfjs-dist），写 issue。

## 19. 簇 14：设置与设备（V2-14）

### V2-14-01 通知
- 步骤：设置 → 通知 → 关"新消息通知"。
- 预期：客户端不再弹通知 / 不响；H5 切到后台时无 toast。
- 人类逻辑：仅客户端通知；服务端不区分。

### V2-14-02 主题
- 步骤：设置 → 主题 → 切深色。
- 预期：所有页面立即生效；刷新后保留。

### V2-14-03 多端
- 步骤：设置 → 设备管理。
- 预期：列出本账号所有活跃端（im_web 桌面 / im_web 移动 / agenthub_ui H5 / app）；可踢出指定端。
- 关键检查：agenthub_ui 端被踢出后回到登录页。

### V2-14-04 二维码登录
- 步骤：登录页点"扫码登录"（如有）。
- 预期：弹二维码；用 im_web 端"扫一扫"扫 → 自动登录。
- 人类逻辑：二维码 60s 过期；过期刷新。

### V2-14-05 skill 上传
- 步骤：设置 → 我的 skill → 上传 zip。
- 预期：上传后出现在 `pages/agents/skills.vue`；可启用 / 禁用 / 删除。

### V2-14-06 通知权限
- 步骤：首次进入 agenthub_ui 时申请浏览器通知权限。
- 预期：弹原生请求；拒绝后给出"如何开启"说明。

### V2-14-07 账号安全
- 步骤：改密码 / 改手机号。
- 预期：旧密码校验；改完后其他端（im_web）需重新登录。

### V2-14-08 关于 / 退出
- 步骤：点"退出登录"。
- 预期：清 storage；跳登录页；不再有任何"幽灵"会话。

## 20. 簇 15：个人中心（V2-15）

### V2-15-01 资料
- 步骤：点自己头像 → 个人中心。
- 预期：uid / 短号 / 昵称 / 头像 / 性别 / 地区 / 签名；均可编辑。
- 截图：`01_profile.png`。

### V2-15-02 头像
- 步骤：上传 5MB jpg 作头像。
- 预期：裁剪界面（圆/方）；提交后所有会话头像同步更新。

### V2-15-03 二维码
- 步骤：点"我的二维码"。
- 预期：生成 QR（内含 uid + 加好友链接）；可保存到相册。

### V2-15-04 短号搜索
- 步骤：A 用 B 的短号搜。
- 预期：能搜到；短号唯一不重复。

### V2-15-5 隐私
- 步骤：设置"不让我被搜索"。
- 预期：其他用户通过手机号/uid 搜不到；二维码仍可加。

## 21. 簇 16：端到端一致性（V2-16）

> 目的：与 im_web 真实对照，验证同一组数据/操作在两端完全一致。

### V2-16-01 同一会话一致性
- 步骤：B 在 agenthub_ui 发的消息，A 在 im_web 1s 内看到。
- 步骤：A 在 im_web 撤回，B 端同步撤回。
- 步骤：A 在 im_web 编辑，B 端同步编辑。
- 步骤：reaction 同步。
- 截图：`01_cross_end.png`。

### V2-16-02 同一群一致性
- 步骤：在 agenthub_ui 邀请 D → im_web 端 D 收到邀请。
- 步骤：im_web 群公告 → agenthub_ui 同步公告。
- 步骤：im_web 踢人 → agenthub_ui 同步成员列表。

### V2-16-03 未读一致性
- 步骤：A 在 im_web 读 5 条 → B 在 agenthub_ui 看到"已读"全部。

### V2-16-04 Clowder 一致性
- 步骤：agenthub_ui 创建 cat → im_web 端 cat 列表立即出现。
- 步骤：im_web 触发 coordination → agenthub_ui 端看到同 Kanban。
- 步骤：im_web 部署 → agenthub_ui 端 deployment card 状态一致。

### V2-16-05 设备管理一致性
- 步骤：im_web 端踢 agenthub_ui → agenthub_ui 端立刻跳登录页（与 V2-01-04 联动）。

### V2-16-06 时间戳一致
- 步骤：同一消息在两端显示时间**完全一致**（同源时间戳）。
- 关键检查：本地化时区与 im_web 一致（UTC + 用户时区）。

## 22. 簇 17：回归与未覆盖项（V2-17）

### V2-17-01 全量回归
- 步骤：重跑 V2-01 ~ V2-16 全部 case。
- 预期：与首跑结果一致；无新增挂红。

### V2-17-02 弱网
- 步骤：Chrome DevTools → Network → Slow 3G。
- 预期：UI 不卡死；loading 占位正确；不丢请求。

### V2-17-3 离线
- 步骤：完全断网。
- 预期：消息发送按钮置灰 + "网络已断开"提示；恢复后自动重连 + 重发（带幂等 clientMsgNo）。

### V2-17-4 i18n（可选）
- 步骤：切换到 en-US。
- 预期：所有文案翻译到位；不出现中文硬编码。

### V2-17-5 性能
- 步骤：1000 条消息的会话、50 人群、30 只 cat。
- 预期：滚动 FPS ≥ 50；首屏 < 2s；内存 < 300MB。

### V2-17-6 安全
- 步骤：尝试在 agenthub_ui 端伪造 admin token。
- 预期：被服务端拒；UI 显示 401。
- 步骤：尝试 CSRF 跨站调用。
- 预期：被 CORS 拦截。

### V2-17-7 未覆盖项
- 步骤：列出本计划未覆盖的功能（语音/视频通话、消息合并转发、阅后即焚等）。
- 预期：写入 `tests-e2e/v2-*/uncovered.md`，待后续 plan 覆盖。

## 23. 完成定义（DoD）

V2 计划只在以下**全部**满足时结案：

- V2-01 ~ V2-17 全部用例 100% 通过；无挂红。
- 三账号（13733632709、13800000001、13800000002）的会话/群/任务在 agenthub_ui 与 im_web 端完全一致。
- 每个 case 都有：截图、关键请求/响应、`accounts.json`（脱敏）、`diagnostics.log`、人为逻辑判定。
- `pnpm test:unit` / `pnpm build:h5` 全绿。
- 每簇有中文 commit。
- `sections/agenthub_ui/.ai/plan/V2-acceptance-report.md` 写明：覆盖度 / 已知 issue / 与 im_web 差距清单 / 下一步建议。
- 已知 issue 已写入 `sections/agenthub_ui/.ai/issue/V2-*.md`，每条有 owner 与时间线。

## 24. 风险与回滚

| 风险 | 触发条件 | 缓解 |
|---|---|---|
| im-web 后端 OAuth 不可用 | V2-07-03 必现 | 降级 Codex；记录在案 |
| `seedcmp` 启动脚本扩展未带 agenthub_ui 入口 | V2-01 启动失败 | 单独 `pnpm dev:h5` 与 im_web 共存 |
| 三账号同时在线 ws 抖动 | 簇 5/6/9 高频 case | 退到 2 账号；记录在案 |
| im_web 与 agenthub_ui 字段不一致 | 簇 16 | 写 issue；本簇不结案 |
| 流式 markdown 渲染崩溃 | 簇 12 | 录屏 + 控制台错误 + 服务端 chunk 校验 |
| 设备被踢 overlay 不可见 | V2-01-04 / V2-14-03 | 强校验 overlay 文案与跳转 |

## 25. 时间盒（参考）

- 簇 1 / 2 / 4 / 14 / 15：每簇 0.5d（基础 UI）
- 簇 3 / 5 / 6：每簇 1d（IM 主链路）
- 簇 7 / 8：每簇 1d（Clowder 接入 + 流式）
- 簇 9 / 10 / 11：每簇 1d（多 cat 协同 + Kanban + 部署）
- 簇 12 / 13：每簇 1d（渲染 + 预览）
- 簇 16：1d（端到端一致性）
- 簇 17：0.5d（回归）
- 合计：约 8.5d 真实跑测 + 1d 报告。

## 26. 联系 im_web 的关键端点（cheat sheet）

供测试期间抓包参考（来源：`sections/im_web/packages/datasource-vue/src/api/clowder.ts` + im_web 已落地的 V3 域）：

- `POST /auth/login` — 登录
- `POST /auth/register` — 注册
- `POST /auth/quit` — 退出
- `GET /users/me` — 拉自己
- `GET /users/{uid}/im` — 拿 ws_addr
- `POST /users/sms` — 验证码
- `POST /friends/request` / `POST /friends/accept` / `POST /friends/reject` / `POST /friends/{uid}`（删除）
- `POST /groups` / `POST /groups/{id}/members` / `DELETE /groups/{id}/members/{uid}` / `POST /groups/{id}/transfer` / `POST /groups/{id}/announce`
- `GET /messages/sync` / `POST /messages/{id}/revoke` / `POST /messages/{id}/edit` / `POST /messages/{id}/reactions`
- `POST /clowder/cats` / `GET /clowder/cats` / `POST /clowder/cats/{id}/connect` / `POST /clowder/cats/{id}/disconnect`
- `GET /clowder/capabilities`
- `POST /clowder/coordinations` / `POST /clowder/coordinations/{id}/cancel` / `GET /clowder/coordinations/{id}/tasks`
- `POST /clowder/tasks/{id}/transition` / `POST /clowder/tasks/{id}/assign`
- `GET /clowder/coordinations/{id}/artifacts`
- `POST /clowder/deployments` / `POST /clowder/deployments/{id}/confirm` / `POST /clowder/deployments/{id}/cancel` / `GET /clowder/deployments/{id}`
- `POST /files/upload` / `GET /files/{id}/url`

如发现 agenthub_ui 调用了不同的路径，记录在 `tests-e2e/v2-*/api-divergence.md`。
