# AgentHub UI V2 Acceptance PRD

## 1. 背景

AgentHub UI V2 的目标是将 H5 端能力对齐 `sections/im_web` 的真实 IM + Clowder 协作基线，并基于 `.ai/docs` 的后端 API 参考完成阻塞 issue 修复、UI 校准和全量验收。

本 PRD 记录 2026-06-07 完成修复后的产品验收口径。最终验证 run 为 `v2-full-20260607-082703`。

## 2. 产品目标

1. 用户可以在 AgentHub H5 完成真实登录、注册、token 持久化和多端踢下线感知。
2. 用户可以创建/配置 Clowder 智能体，看到真实 capabilities、模型选项、平台降级和 API Key 校验。
3. 用户可以在 H5 访问 IM、联系人、群聊、文件、设置、个人中心、看板等主要页面，页面不因未绑定外部能力而崩溃或假装成功。
4. 文件预览必须具备安全边界：常见媒体可预览，危险可执行文件必须被明确阻止。
5. V2 验收必须有自动化 runner、截图、网络记录、诊断日志和 issue 状态闭环。

## 3. 范围

已纳入：

- 登录/注册：确认密码、强密码校验、验证码倒计时、真实登录、token refresh、kickout overlay。
- Clowder 创建：capabilities、Claude Code/Codex 平台、OAuth/API Key 接入方式、模型选项、有效/无效 API Key 状态。
- Kanban：todo/doing/blocked/done 四态、未绑定 thread 时的明确等待态、移动端响应式布局。
- 文件：markdown/html/pdf/office/image/video/audio/zip/exe 等预览与阻止策略。
- 测试：V2 full runner、单测、H5 build、Go 相关模块编译级检查。

不在本轮直接承诺：

- 外部 OAuth 真实授权成功率。
- 真实项目 thread 下的完整 worker 协同产物质量。
- 所有 im_web 深度状态逐字段一致性。

这些边界记录在 `questions/V2-open-questions.md`。

## 4. 核心用户故事

| 用户故事 | 验收标准 |
|---|---|
| 作为新用户，我要注册账号并确认密码 | 7 位弱密码、缺字段、两次密码不一致均被前端阻止；8 位且含字母数字的密码可注册。 |
| 作为已登录用户，我要知道账号被另一端登录顶掉 | im_web 登录同一账号后，旧 H5 session 显示“账号已在其他设备登录”和重新登录按钮。 |
| 作为智能体使用者，我要选择平台和接入方式 | 创建页展示 Claude Code/Codex、OAuth/API Key、capabilities 和模型列表。 |
| 作为 API Key 用户，我要在提交前看到格式错误 | 无效 key 不调用创建接口；有效 key 调用 `/v1/clowder/cats` 并离开创建表单。 |
| 作为协作用户，我要看到任务四态 | 看板始终展示 todo/doing/blocked/done，未绑定 thread 时显示等待同步，不横向裁切。 |
| 作为文件查看者，我要安全预览附件 | 支持常见文件预览；`.exe/.bat/.cmd/.sh/.msi/.dll` 被阻止上传/预览并给出明确文案。 |

## 5. 功能需求

### 5.1 登录与注册

- 注册表单必须包含确认密码字段。
- 密码规则：不少于 8 位，至少包含字母和数字。
- TangSeng 后端注册校验必须与前端一致。
- 开发环境配置固定 SMS code 时，注册验证码接口不得依赖外部短信服务。
- 同账号 Web/PC 再登录必须使旧 token 失效，并由 H5 展示全局 kickout overlay。

### 5.2 Clowder 智能体创建

- 创建页加载 `useClowderStore.fetchCapabilities()`。
- 平台优先展示 Claude Code，并允许 Codex 降级。
- 模型选项来自 Clowder capabilities/目录元数据；没有真实数据时只显示明确 fallback。
- API Key 模式必须验证格式并阻止无效提交。
- 有效创建请求必须走 `/v1/clowder/cats`。

### 5.3 任务看板

- 看板列固定为 todo、doing、blocked、done。
- 未绑定 thread 时，四态列保持可见并显示等待同步。
- 移动端 375px 宽度不得出现横向裁切、空白按钮或文字重叠。
- 刷新按钮必须有可见图标。

### 5.4 文件预览与安全

- 预览页必须响应同页面 hash 参数变化，不能残留上一份文件内容。
- 音频/视频使用文件 URL 渲染预览。
- 危险扩展名必须在前后端双层阻止。
- 非法文件空态必须保留下载入口和安全解释。

## 6. 非功能需求

- H5 构建通过。
- 单元测试通过。
- 全量 V2 runner 必须保存 141 个 case 的截图、结构化 JSON、网络日志和 diagnostics。
- 测试不得使用 localhost，本轮统一使用 `172.18.58.156`。
- 明文 token/password 不得写入报告。

## 7. 验收证据

- 最终 run：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-082703/`
- 完整 JSON：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-082703/full-results.json`
- 完整报告：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-082703/full-report.md`
- UI 校准截图：`sections/agenthub_ui/.ai/tests/probe-board-responsive-20260607.png`
- 验收报告：`sections/agenthub_ui/.ai/plan/V2-acceptance-report.md`

## 8. 验收结论

V2 自动化阻塞验收通过：141 个 case 中 `FAIL=0`，`BLOCKED=0`。所有 V2 full issue 文件已按最新 run 关闭。
