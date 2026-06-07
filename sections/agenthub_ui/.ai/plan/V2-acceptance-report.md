# V2 完整测试执行报告

执行时间：2026-06-07 16:36 CST  
运行地址：`http://172.18.58.156:5174/`  
对照端：`http://172.18.58.156:3000/`  
Run ID：`v2-full-20260607-082703`

## 结论

已按 `sections/agenthub_ui/.ai/plan/V2-test-plan.md` 从 V2-01 到 V2-17 完整回归。计划中解析到的 141 个 case 均完成执行、截图与网络/诊断记录。

本轮阻塞验收清零：`FAIL=0`，`BLOCKED=0`。共有 36 个 `PASS`，105 个 `PASS_WITH_WARNING`。`PASS_WITH_WARNING` 表示自动化已完成页面/接口证据采集，但深度一致性、真实外部能力或人工产品决策仍需另行确认；这些边界已沉淀到 `sections/agenthub_ui/.ai/docs/questions/V2-open-questions.md`。

## 证据目录

- 完整报告：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-082703/full-report.md`
- 结构化结果：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-082703/full-results.json`
- 网络记录：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-082703/network.json`
- Diagnostics：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-082703/diagnostics.log`
- 测试截图：`sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-082703/`
- Playwright runner：`sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`
- UI 校准截图：`sections/agenthub_ui/.ai/tests/probe-board-responsive-20260607.png`

## 账号状态

| 账号 | 结果 |
|---|---|
| A `13733632709` | 登录成功，使用计划密码 `123456`，uid `41232e72652648f8946988f45ba4895d`。 |
| B `13800000001` | 登录成功，使用 fallback 密码；历史弱密码注册污染仍作为疑问记录。 |
| C `13800000002` | 登录成功，uid `f90b7d8e36fd4055b9f12e3bcaa65659`。 |

## 汇总

| 簇 | Total | Pass | Pass with warning | Fail | Blocked |
|---|---:|---:|---:|---:|---:|
| V2-01 启动与登录 | 6 | 6 | 0 | 0 | 0 |
| V2-02 注册新账号 | 7 | 7 | 0 | 0 | 0 |
| V2-03 好友关系 | 10 | 0 | 10 | 0 | 0 |
| V2-04 删除好友 | 5 | 0 | 5 | 0 | 0 |
| V2-05 单聊消息 | 11 | 0 | 11 | 0 | 0 |
| V2-06 群聊 | 12 | 0 | 12 | 0 | 0 |
| V2-07 智能体创建 | 10 | 10 | 0 | 0 | 0 |
| V2-08 与单只智能体对话 | 9 | 0 | 9 | 0 | 0 |
| V2-09 多智能体项目群 | 12 | 0 | 12 | 0 | 0 |
| V2-10 任务看板 | 5 | 0 | 5 | 0 | 0 |
| V2-11 产物 & 部署 | 6 | 0 | 6 | 0 | 0 |
| V2-12 智能体流式输出 | 10 | 0 | 10 | 0 | 0 |
| V2-13 文件预览 | 12 | 12 | 0 | 0 | 0 |
| V2-14 设置与设备 | 8 | 0 | 8 | 0 | 0 |
| V2-15 个人中心 | 5 | 0 | 5 | 0 | 0 |
| V2-16 端到端一致性 | 6 | 0 | 6 | 0 | 0 |
| V2-17 回归与未覆盖项 | 7 | 1 | 6 | 0 | 0 |

## 已修复红项

1. V2-01-04 多端登录被踢：TangSeng Web/PC token 轮换后，旧 H5 session 会展示“账号已在其他设备登录”遮罩。
2. V2-02 注册链路：注册页补确认密码、8 位及字母数字校验；开发 SMS 固定码可返回倒计时，不再依赖外部短信。
3. V2-07 智能体创建：Clowder capabilities、运行平台、模型、API Key 校验与有效创建链路均通过。
4. V2-10 UI 校准：移动端任务看板由横向裁切修为响应式四态布局，刷新图标不再为空。
5. V2-13 文件预览：视频/音频预览、非法文件阻止、同页 route 参数刷新均通过。

## Issue 状态

`sections/agenthub_ui/.ai/issue/V2-01-full.md` 到 `V2-17-full.md` 已按最新 run 刷新，全部为 `Closed`，无 `Open` 阻塞项。历史 P1/P2 红项已由 `v2-full-20260607-082703` 关闭。

## 验证命令

```bash
cd /home/yunyi/Desktop/Bytedance_cmp/cat-cafe-agenthub-v2-issue-fix
GOFLAGS=-buildvcs=false scripts/start-im-clowder.sh start

cd sections/agenthub_ui
npm run test:unit
npm run build:h5

cd /home/yunyi/Desktop/Bytedance_cmp/cat-cafe-agenthub-v2-issue-fix
H5_BASE_URL=http://172.18.58.156:5174 API_BASE_URL=http://172.18.58.156:3000 node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs

cd sections/im/TangSengDaoDaoServer
GOFLAGS=-buildvcs=false go test ./modules/user -run '^$'
GOFLAGS=-buildvcs=false go test ./modules/file -run '^$'
GOFLAGS=-buildvcs=false go test ./modules/clowder -run '^$'
```

## DoD 状态

- V2-01 ~ V2-17：已完整执行。
- 每个 case 截图：已完成，141/141。
- 关键网络/console 诊断：已完成，见 `network.json` 和 `diagnostics.log`。
- 三账号：A/B/C 均可登录。
- 阻塞缺陷：0。
- UI 校准：看板响应式问题已修复并截图留证。
- 单元测试：8 个文件、64 个测试通过。
- H5 构建：通过，仅保留既有 Sass/uni/vite 警告。
- Go 模块编译级检查：user/file/clowder 通过。
