# V2 完整测试执行报告

执行时间：2026-06-07 12:11:27  
运行地址：`http://172.18.58.156:5173/`  
Run ID：`v2-full-20260607-041127`

## 结论

已按 `sections/agenthub_ui/.ai/plan/V2-test-plan.md` 从 V2-01 到 V2-17 完整执行一轮，未因单个问题暂停。计划中解析到的 141 个 case 均有执行记录与截图。

本轮不是通过态验收：共有 47 个 Fail，77 个 Pass with warning，17 个 Pass。`PASS_WITH_WARNING` 表示页面/操作已执行并保留截图，但仍缺少计划要求的真实跨端、真实后端状态变化、录屏或强断言证据，不能等同于最终通过。

## 证据目录

- 完整报告：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127/full-report.md`
- 结构化结果：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127/full-results.json`
- 网络记录：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127/network.json`
- Diagnostics：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127/diagnostics.log`
- 测试截图：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127/`
- issue 截图：`sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/`
- Playwright runner：`sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`

## 账号状态

| 账号 | 结果 |
|---|---|
| A `13733632709` | 登录成功，使用计划密码 `123456`，uid `41232e72652648f8946988f45ba4895d`。 |
| B `13800000001` | 登录成功，但使用 fallback 密码；该账号此前因 V2-02 弱密码校验问题被 7 位密码提前注册，计划密码 `Test1234!` 不再是干净注册态。 |
| C `13800000002` | 本轮注册成功并登录成功，uid `f90b7d8e36fd4055b9f12e3bcaa65659`，token 已在 JSON 中脱敏。 |

## 汇总

| 簇 | Total | Pass | Pass with warning | Fail |
|---|---:|---:|---:|---:|
| V2-01 启动与登录 | 6 | 5 | 0 | 1 |
| V2-02 注册新账号 | 7 | 3 | 1 | 3 |
| V2-03 好友关系 | 10 | 0 | 10 | 0 |
| V2-04 删除好友 | 5 | 0 | 5 | 0 |
| V2-05 单聊消息 | 11 | 0 | 11 | 0 |
| V2-06 群聊 | 12 | 0 | 12 | 0 |
| V2-07 智能体创建 | 10 | 0 | 0 | 10 |
| V2-08 与单只智能体对话 | 9 | 0 | 9 | 0 |
| V2-09 多智能体项目群 | 12 | 0 | 0 | 12 |
| V2-10 任务看板 | 5 | 0 | 0 | 5 |
| V2-11 产物 & 部署 | 6 | 0 | 0 | 6 |
| V2-12 智能体流式输出 | 10 | 0 | 10 | 0 |
| V2-13 文件预览 | 12 | 8 | 0 | 4 |
| V2-14 设置与设备 | 8 | 0 | 8 | 0 |
| V2-15 个人中心 | 5 | 0 | 5 | 0 |
| V2-16 端到端一致性 | 6 | 0 | 0 | 6 |
| V2-17 回归与未覆盖项 | 7 | 1 | 6 | 0 |

## 主要红区

1. V2-01-04 多端登录被踢失败：`172.18.58.156:3000` 是 API 服务，不是可确认的 im_web UI，对照端/kickout overlay 未完成。
2. V2-02 注册契约失败：注册页缺确认密码，仍允许 7 位密码注册；B 账号已被弱密码流程污染。
3. V2-07 智能体创建全簇失败：页面有创建表单，但未体现 Clowder capabilities、计划模型列表、Claude Code / Codex 真实降级链路。
4. V2-09 / V2-10 / V2-11 全部失败：智能体看板为空，未出现 PM + worker 协同、四态 Kanban、Artifacts 或 Deployment card。
5. V2-13 视频、音频、大文件、非法文件失败：无对应真实资产/上传链路，预览页还出现保留上一份 markdown 内容的迹象。
6. V2-16 全部失败：没有可确认 im_web UI 对照端，因此同一会话、群、未读、Clowder、设备、时间戳一致性均无法通过。

## 已生成 issue

- `sections/agenthub_ui/.ai/issue/V2-01-full.md`
- `sections/agenthub_ui/.ai/issue/V2-02.md`
- `sections/agenthub_ui/.ai/issue/V2-02-full.md`
- `sections/agenthub_ui/.ai/issue/V2-03-full.md`
- `sections/agenthub_ui/.ai/issue/V2-04-full.md`
- `sections/agenthub_ui/.ai/issue/V2-05-full.md`
- `sections/agenthub_ui/.ai/issue/V2-06-full.md`
- `sections/agenthub_ui/.ai/issue/V2-07-full.md`
- `sections/agenthub_ui/.ai/issue/V2-08-full.md`
- `sections/agenthub_ui/.ai/issue/V2-09-full.md`
- `sections/agenthub_ui/.ai/issue/V2-10-full.md`
- `sections/agenthub_ui/.ai/issue/V2-11-full.md`
- `sections/agenthub_ui/.ai/issue/V2-12-full.md`
- `sections/agenthub_ui/.ai/issue/V2-13-full.md`
- `sections/agenthub_ui/.ai/issue/V2-14-full.md`
- `sections/agenthub_ui/.ai/issue/V2-15-full.md`
- `sections/agenthub_ui/.ai/issue/V2-16-full.md`
- `sections/agenthub_ui/.ai/issue/V2-17-full.md`

## DoD 状态

- V2-01 ~ V2-17：已完整执行一轮。
- 每个 case 截图：已完成，141/141。
- 关键网络/console 诊断：已完成，见 `network.json` 和 `diagnostics.log`。
- 三账号：A/B/C 均可登录；B 账号不再是干净计划态。
- 全部用例 100% 通过：未达成。
- im_web 对照端一致性：未达成，缺可确认 UI 对照端。
- `pnpm test:unit` / `pnpm build:h5`：本轮未执行。
- 每簇中文 commit：本轮未执行，当前任务只落测试证据与 issue。

## 下一步建议

1. 先处理 V2-02 注册门禁，并清理/重置 B 测试账号。
2. 明确 im_web 对照端的可访问 UI 地址，不能用 API 端口替代。
3. 修复/接通 Clowder capabilities、Kanban、Artifacts、Deployment 后，优先重跑 V2-07 ~ V2-11。
4. 为 V2-13 补齐真实视频、音频、大文件、非法文件上传/预览资产，并重跑文件簇。
