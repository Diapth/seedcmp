# IM 后端接口参考 — 索引与速查

> 主文档：
> - [§0-§1 用户域 + 通用配置](./im-api-reference.md)
> - [§2-§7 群/消息/最近会话/搜索/频道/文件/前端依赖补充](./im-api-reference-part2.md)
> - [§5-§7 Clowder 域 + 状态机 + 事件表](./im-api-reference-part3.md)
>
> 配套：
> - [V2-issue-solutions.md](./V2-issue-solutions.md) — 问题→修复方向→接口映射
> - [im-api-coverage-and-network-report.md](./im-api-coverage-and-network-report.md) — TangSengDaoDaoWeb 覆盖对比 + 网络探测最终报告
> - [V2-test-plan.md](././plan/V2-test-plan.md) — 测试用例
> - [V2-acceptance-report.md](././plan/V2-acceptance-report.md) — 本轮验收

## 按 V2 簇速查

| 簇 | 涉及接口域 | 主文档 |
|---|---|---|
| V2-01 启动与登录 | `/v1/user/login` `/v1/user/quit` `/v1/user/devices` ws `kickout` | part1 §1.1 / §1.3 |
| V2-02 注册 | `/v1/user/register` `/v1/user/sms/registercode` | part1 §1.1 |
| V2-03 好友 | `/v1/friend/apply` `/v1/friend/sure` `/v1/friend/sync` | part1 §1.6 |
| V2-04 删除好友 | `DELETE /v1/friends/:uid` `/v1/user/blacklist` | part1 §1.5 / §1.6 |
| V2-05 单聊消息 | `/v1/message/send` `/v1/message/revoke` `/v1/reactions` `/v1/message/readed` | part2 §3 |
| V2-06 群聊 | `/v1/group/create` `/v1/groups/:no/members` `/forbidden` `/transfer` | part2 §2 |
| V2-07 智能体创建 | `/v1/clowder/cats` `/v1/clowder/local-auth/capabilities` `/v1/clowder/cats/connect` | part3 §5.1 / §5.2 |
| V2-08 与 cat 对话 | `/v1/clowder/conversation/bind` `/v1/clowder/conversation/focus` `/v1/clowder/conversation/message` | part3 §5.3 |
| V2-09 多 cat 协同 | `/v1/clowder/project-groups/ensure` `/v1/clowder/coordinator/coordination` `/v1/clowder/group/cats/sync` | part3 §5.4 / §5.5 / §5.6 |
| V2-10 任务看板 | `GET /v1/clowder/thread/:threadId/tasks` `PATCH /v1/clowder/coordinator/coordination/:id` | part3 §5.6 / §5.7 |
| V2-11 产物 & 部署 | `/v1/clowder/thread/:threadId/artifacts` `/v1/clowder/conversation/deployment-*` | part3 §5.7 / §5.8 |
| V2-12 流式 | `/v1/clowder/conversation/message` + ws `clowder.outbound` | part3 §5.3 / §7 |
| V2-13 文件预览 | `/v1/file/upload` `/v1/file/preview/*path` | part2 §5 |
| V2-14 设置与设备 | `/v1/user/devices` `/v1/user/my/setting` `/v1/user/quit` `/v1/user/qrcode` | part1 §1.2 / §1.3 |
| V2-15 个人中心 | `/v1/user/qrcode` `/v1/user/current` `/v1/user/search` | part1 §1.2 |
| V2-16 端到端一致性 | 跨域 ws 事件表 | part3 §7 |
| V2-17 回归 | — | — |

## TangSengDaoDaoWeb 对比结论

- 对比时间：2026-06-07。
- 对比对象：`TangSengDaoDao/TangSengDaoDaoWeb` 当前 GitHub 默认分支源码（只读克隆到 `/tmp/TangSengDaoDaoWeb-codex-api-audit`）。
- 静态抽取范围：`WKApp.apiClient.*`、`APIClient.shared.*`、直接 `axios.*` 调用。
- 结果：Web 源码共抽取 67 个唯一静态 IM API 调用；补文档前缺 15 个，现已补入 part1 §1.9 与 part2 §3.1 / §3.2 / §7。

| 状态 | 接口域 | 说明 |
|---|---|---|
| 已由本地后端确认 | `/v1/common/*` `/v1/conversation/*` `/v1/conversations/*` `/v1/coversation/clearUnread` `/v1/search/global` | 对应 Go route / Swagger 已找到 |
| 前端依赖，本地模块未确认 | `/v1/favorite/my` `/v1/favorites` `/v1/sticker/user/*` `/v1/organization*` | TangSengDaoDaoWeb 仍会调用；当前 `sections/im/TangSengDaoDaoServer/modules/` 未发现实现模块目录 |
| 历史兼容路径 | `/v1/coversation/clearUnread` | `coversation` 是后端保留的历史拼写，前端仍需照此调用 |

复跑命令：

```bash
node sections/agenthub_ui/.ai/tests/im-api-network-runner.mjs coverage \
  --source /tmp/TangSengDaoDaoWeb-codex-api-audit \
  --docs sections/agenthub_ui/.ai/docs

node sections/agenthub_ui/.ai/tests/im-api-network-runner.mjs network \
  --api-base http://172.18.58.156:3000/v1 \
  --username 13733632709 \
  --password 123456
```

## 修复优先级（与 V2-issue-solutions.md 同步）

| 优先级 | 簇 | 关键修复 |
|---|---|---|
| P0 | V2-02 | 注册页 8 位 + 确认密码 + 后端 8 位策略 |
| P1 | V2-01/16 | 找到 im_web 真实 UI URL；`KickoutOverlay` 订阅 ws `kickout` |
| P1 | V2-07 | `useClowderStore` 接 `getLocalAuthCapabilities` / `getCatDirectory` / `createCatAndConnect` |
| P1 | V2-09/10/11 | `pages/agents/board` 接 `thread/:threadId/tasks`、`project-groups/ensure`、`coordination` |
| P1 | V2-13 | `pages/files/preview` 按 ext 分发 + 后端白名单 + 测试资产 |
| P2 | V2-03~06/08/12/14/15/17 | 补 UI 行为与 im_web 同步；订阅 ws 事件；补充截图与断言 |

## 文档元信息

- **生成时间**：2026-06-07
- **数据源**：
 - `TangSengDaoDao/TangSengDaoDaoWeb`（Web 前端真实调用面）
 - `sections/im/TangSengDaoDaoServer/modules/*/api*.go`（用户、好友、群、消息、频道、文件、clowder）
 - `sections/im/TangSengDaoDaoServer/modules/*/swagger/*.yaml`（common / conversation / search 等补充字段）
 - `sections/im_web/packages/datasource-vue/src/api/clowder.ts`（im_web V3 clowder API 类型）
 - `sections/clowder-ai/packages/api/src/routes/*`（上游 clowder-ai API 实现）
- **服务栈**：
 - im-web（TangSeng）：`:3000`
 - WuKongIM（ws）：`:5100`（tcp）/ `:5200`（ws）
 - clowder-ai API：`:3004`
- **版本**：v3.x（与 V2 计划对齐）
