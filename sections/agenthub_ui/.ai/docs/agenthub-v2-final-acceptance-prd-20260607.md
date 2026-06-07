# AgentHub V2 Final Acceptance PRD

生成时间：2026-06-07  
适用范围：`sections/agenthub_ui` H5 / AgentHub IM / Clowder 工作区  
验收地址：`http://172.18.58.156:5173`  
API 地址：`http://172.18.58.156:3000`

## 1. 产品目标

AgentHub V2 需要提供一个可真实运行的企业 IM 与多智能体协作入口，用户可以在同一 H5 应用中完成登录、联系人、单聊、群聊、文件、智能体、看板、设置与个人中心等主流程。应用不得依赖业务 mock 假装成功；当后端能力缺失或状态未绑定时，必须以明确空态、warning 或 unavailable 文案呈现，不允许白屏、错位、控制台红错或会话身份错乱。

## 2. 本轮修复后的核心行为

### 2.1 会话身份一致

- 直接会话列表、聊天标题、右侧会话详情必须展示同一好友身份。
- 当 `conversation/sync` 省略 users 时，前端用 `friend/sync` 与 `/users/{uid}` 回填昵称和头像。
- 消息同步只更新 `lastMessage`、`lastTime`、`lastMessageSeq` 等消息字段，不覆盖既有 `name/avatar/isPinned/isMuted/draft`。

### 2.2 消息区首帧不空

- 打开会话后，消息区优先显示已同步消息。
- 如完整 `message/channel/sync` 尚未返回，使用 conversation recents 兜底。
- 如 recents 缺失但会话摘要存在，使用会话摘要生成首帧可见消息。
- 后续真实消息到达后按 `messageSeq` 去重并替换摘要兜底，不产生重复气泡。

### 2.3 刷新后历史可见

- 页面恢复或刷新后，主动根据 `lastMessageSeq` 拉取最新可见历史窗口。
- 进入会话后安排 2.5s / 10s / 30s 轻量刷新，吸收服务端会话同步与消息同步之间的延迟。
- 行为对齐 `sections/im_web` 的 `hydrateVisibleHistory` 模式。

### 2.4 普通会话无 Clowder active 404

- 普通单聊不请求 `clowder/conversation/deployment-request/active`。
- 普通非 Clowder 群不请求 Clowder deployment/project active 兜底接口。
- 只有带 `clowder:`、`clowder_cat:`、binding、project/thread 标识的会话进入 Clowder active 探测链路。

## 3. 验收结果

### 3.1 13733632709 单聊留痕

- 账号：`13733632709`
- 好友：`测试员B`
- 最终 trace：`AgentHub 13733632709 visible trace 2026-06-07T11-29-54-443Z`
- 报告：`sections/agenthub_ui/.ai/tests/trace-13733632709-20260607-112954/report.md`
- 结果：PASS

关键断言：
- API login / friend sync / message sync / conversation sync 均 PASS。
- H5 列表显示 trace。
- 选择测试员B后的首帧消息区显示 trace。
- 刷新后标题仍为 `测试员B`，消息区仍显示 trace。
- direct chat deployment active 404 为 0。

### 3.2 13733632709 多会话留痕

- 临时群：`AgentHub同步测试群-112924`
- 单聊 trace：`AgentHub 13733632709 multi direct trace 2026-06-07T11-29-24-487Z`
- 群聊 trace：`AgentHub 13733632709 multi group trace 2026-06-07T11-29-24-487Z`
- 报告：`sections/agenthub_ui/.ai/tests/trace-13733632709-multi-20260607-112924/report.md`
- 结果：PASS

关键断言：
- 临时群创建成功。
- 单聊与群聊 SDK 消息发送成功。
- 单聊与群聊 `message/channel/sync` 均包含 trace。
- H5 列表同时显示测试员B和临时群 trace。
- 群详情、单聊详情均显示对应 trace。
- 普通单聊/普通群 Clowder active 404 为 0。

### 3.3 V2 全量验证计划

- 运行：`H5_BASE_URL=http://172.18.58.156:5173 node .ai/tests/v2-full-runner.mjs`
- 报告：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-113409/full-report.md`
- 结果：141 cases，总计 PASS 36，PASS_WITH_WARNING 105，FAIL 0，BLOCKED 0。

PASS_WITH_WARNING 表示页面、接口或状态证据已采集且未阻塞，但仍有更深层一致性、真实 worker 产物质量、跨端字段级 diff 等问题留到下一阶段专用 E2E。

## 4. 证据索引

- 单聊汇总：`sections/agenthub_ui/.ai/tests/trace-13733632709-summary-20260607.md`
- 单聊最终截图：`sections/agenthub_ui/.ai/tests/trace-13733632709-20260607-112954/screenshots`
- 多会话最终截图：`sections/agenthub_ui/.ai/tests/trace-13733632709-multi-20260607-112924/screenshots`
- 全量 V2 截图：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-113409`
- 全量网络记录：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-113409/network.json`
- 全量诊断日志：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-113409/diagnostics.log`

## 5. 未关闭问题

详见：`sections/agenthub_ui/.ai/docs/questions/V2-open-questions.md`

新增可疑点：
- `Q10. 临时测试群成员数口径`：创建仅包含测试员B的临时群后，消息可同步展示，但群信息面板显示 `0 位成员`。需要确认后端 member_count / group members sync / 前端回填策略。
