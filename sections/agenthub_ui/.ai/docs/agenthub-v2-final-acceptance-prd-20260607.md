# AgentHub V2 Final Acceptance PRD

生成时间：2026-06-07 20:36  
适用范围：`sections/agenthub_ui` H5 / AgentHub IM / Clowder 工作区  
当前分支：`new_ui`  
验收地址：`http://172.18.58.156:5173`  
API 地址：`http://172.18.58.156:3000`

## 1. 产品目标

AgentHub V2 提供一个可真实运行的企业 IM 与多智能体协作入口。用户应能在同一 H5 应用内完成登录、联系人、单聊、群聊、文件、智能体、看板、设置与个人中心主流程。

应用不得依赖业务 mock 假装成功；当后端能力缺失或状态未绑定时，必须以明确空态、warning 或 unavailable 文案呈现，不允许白屏、错位、控制台红错、会话身份错乱、消息刷新后丢失。

## 2. 已验收核心行为

### 2.1 会话身份与头像一致

- 直接会话列表、聊天标题、右侧详情均展示同一好友身份。
- `conversation/sync` 省略 users 时，用 `friend/sync` 与 `/users/{uid}` 回填昵称和头像。
- 消息同步只更新消息字段，不覆盖既有 `name/avatar/isPinned/isMuted/draft`。
- 真实 UID 发出的自己的消息会标记为 `isMe`，头像/昵称使用当前登录用户资料，不再显示 UID 首字符 `4`。

### 2.2 消息区首帧与刷新可见

- 打开会话后优先显示已同步消息。
- `message/channel/sync` 尚未返回时，使用 conversation recents 兜底。
- recents 缺失但会话摘要存在时，生成首帧可见消息。
- 后续真实消息按 `messageSeq` 去重并替换摘要兜底，不产生重复气泡。
- 刷新后根据 `lastMessageSeq` 拉取最新可见历史窗口，并安排 2.5s / 10s / 30s 轻量刷新。

### 2.3 群聊展示一致

- 群聊会话列表摘要展示 `发送者昵称: 消息`。
- 群消息气泡展示真实成员昵称，不展示原始 UID。
- 右侧群信息打开时主动拉取 `groups/:group_no/members`，成员数和成员预览以真实成员列表回填。
- 本轮临时群验证中右侧显示 `2 位成员`，并展示 `leng`、`测试员B`。

### 2.4 普通会话无 Clowder active 404

- 普通单聊不请求 `clowder/conversation/deployment-request/active`。
- 普通非 Clowder 群不请求 Clowder deployment/project active 兜底接口。
- 只有带 `clowder:`、`clowder_cat:`、binding、project/thread 标识的会话进入 Clowder active 探测链路。

## 3. 验收结果

### 3.1 单元回归

命令：

```bash
npm run test:unit -- tests/unit/im-domain.spec.js
```

结果：8 个测试文件，80 个断言通过。

新增覆盖：

- 真实登录 UID 的自己消息被标记为 `isMe`，并使用当前用户昵称/头像。
- 群聊会话摘要带发送者昵称前缀。
- 群成员接口支持 `list/items/members/顶层数组` 等响应形态，并回写成员数。

### 3.2 13733632709 单聊留痕

- 账号：`13733632709`
- 好友：`测试员B`
- trace：`AgentHub 13733632709 visible trace 2026-06-07T12-13-04-976Z`
- 报告：`sections/agenthub_ui/.ai/tests/trace-13733632709-20260607-121304/report.md`
- 结果：PASS

关键断言：

- H5 列表显示 trace。
- 选择测试员B后的首帧消息区显示 trace。
- 刷新后标题仍为 `测试员B`，消息区仍显示 trace。
- 普通 direct chat deployment active 404 为 0。

### 3.3 13733632709 多会话留痕

- 临时群：`AgentHub同步测试群-121224`
- 单聊 trace：`AgentHub 13733632709 multi direct trace 2026-06-07T12-12-24-417Z`
- 群聊 trace：`AgentHub 13733632709 multi group trace 2026-06-07T12-12-24-417Z`
- 报告：`sections/agenthub_ui/.ai/tests/trace-13733632709-multi-20260607-121224/report.md`
- 结果：PASS

关键断言：

- 单聊与群聊 SDK 消息发送成功。
- 单聊与群聊 `message/channel/sync` 均包含 trace。
- H5 列表同时显示测试员B和临时群 trace。
- 群列表摘要为 `leng: AgentHub ... multi group trace ...`。
- 群详情显示群消息、`2 位成员`、成员 `leng` 与 `测试员B`。
- 单聊消息头像 fallback 全部为 `L`，不再出现 `4`。
- 普通单聊/普通群 Clowder active 404 为 0。

### 3.4 V2 全量验证计划

命令：

```bash
H5_BASE_URL=http://172.18.58.156:5173 node .ai/tests/v2-full-runner.mjs
```

报告：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-122547/full-report.md`

结果：

- Cases: 141
- PASS: 35
- PASS_WITH_WARNING: 106
- FAIL: 0
- BLOCKED: 0

说明：

- `PASS_WITH_WARNING` 表示页面、接口或状态证据已采集且无阻塞；深度一致性、真实 worker 产物质量、跨端字段级 diff 等需要下一阶段专用 E2E。
- V2-16 跨 `im_web` 一致性需要显式配置 `IM_WEB_BASE_URL`；未配置时本轮只记录 AgentHub 侧证据并降级为 warning。

## 4. 证据索引

- 单聊汇总：`sections/agenthub_ui/.ai/tests/trace-13733632709-summary-20260607.md`
- 单聊最终截图：`sections/agenthub_ui/.ai/tests/trace-13733632709-20260607-121304/screenshots`
- 多会话最终截图：`sections/agenthub_ui/.ai/tests/trace-13733632709-multi-20260607-121224/screenshots`
- 全量 V2 截图：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-122547`
- 全量网络记录：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-122547/network.json`
- 全量诊断日志：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-122547/diagnostics.log`

## 5. 分支收口

- 已合并到 `new_ui`：`feat/agenthub-ui-v1-exec`
- 已合并到 `new_ui`：`feat/agenthub-v2-issue-fix`
- 已删除分支：`feat/agenthub-ui-v1-exec`
- 已删除分支：`feat/agenthub-v2-issue-fix`
- 后续修复均在 `new_ui` 工作树完成。

## 6. 未关闭问题

详见：`sections/agenthub_ui/.ai/docs/questions/V2-open-questions.md`
