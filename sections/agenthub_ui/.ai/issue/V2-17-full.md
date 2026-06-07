# [V2-17] Full-run acceptance status

**状态**：Closed
**创建时间**：2026-06-07
**标签**：acceptance / testing
**优先级**：P3

---

## 问题描述

完整 V2 run `v2-full-20260607-122547` 执行到 V2-17 簇时，阻塞项数量为 0。本簇没有 Fail / Blocked；如存在 PASS_WITH_WARNING，则代表自动化验收深度说明或需人工决策的边界，不作为当前阻塞缺陷。

截图：

- N/A

---

## 复现步骤

1. 运行 `node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`。
2. 查看 `sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-122547/full-results.json`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

```
Runtime route cluster: V2-17
Evidence root: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-122547
```

---

## 根因分析

最新回归无阻塞缺陷。历史红项已按本轮证据关闭；仍需产品/环境确认的边界统一沉淀到 .ai/questions。

---

## 问题列表（Q&A 迭代）

### Q1: 是否因为前一个失败而停止后续测试？
**A1**: 否。本轮 runner 对全部 141 个 case 都执行了尝试并保存截图。

### Q2: PASS_WITH_WARNING 是否等价于未修复 bug？
**A2**: 否。它表示脚本已完成页面/接口证据采集，但深度一致性、真实外部能力或人工产品决策仍需另行确认；当前阻塞判断只看 FAIL / BLOCKED。

---

## 测试验收记录

| Case | Status | Finding |
|---|---|---|
| V2-17-01 全量回归 | PASS_WITH_WARNING | regression/weak/offline/perf/security case attempted. text=设置与安全<br>测<br>测试员B<br>13800000001<br>编辑资料<br>通知设置<br>系统通知<br>已拒绝<br>浏览器或手机后台收到新消息时显示系统通知。<br>声音提醒<br>系统通知允许声音时，播放默认提示音。<br>移动端振动<br>App 端收到本地通知时短振动提醒。<br>勿扰模式<br>在专注时段静音通知和声音。<br>通知显示消息预览<br>通知中展示发送人和消息摘要。<br>语言和外观<br>系统语言<br>选择界面的显示语言。<br>简体中文<br>深色模式<br>调整界面的主题配色。<br>隐私与安全<br>设备与登录管理<br>黑名单管理<br>退出登录<br>20<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-17-02 弱网 | PASS_WITH_WARNING | regression/weak/offline/perf/security case attempted. text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>L<br>leng<br>20:13<br>AgentHub 13733632709 visible trace 2026-06-07T12-13-04-976Z<br>17<br>A<br>AgentHub同步测试群-121224<br>20:12<br>leng: AgentHub 13733632709 multi group trace 2026-06-07T12-12-24-417Z<br>C<br>Clowder AI<br>19:38<br>⚠️ 当前没有绑定 thread，请先用 /new 创建或 /use 切换。<br>3<br>A<br>AgentHub同步测试群-112924<br>19:29<br>leng: AgentHub 13733632709 multi group trace 2026-06-07T11-29-24-487Z<br>A<br>AgentHub同步测试群-112508<br>19:25<br>leng: AgentHub 13733632709 multi group trace 2026-06-07T11-25-08-039Z<br>A<br>AgentHub同步测试群-112436<br>19:24<br>leng: AgentHub 13733632709 multi group trace 2026-06-07T11-24-36-323Z<br>20<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-17-3 离线 | PASS_WITH_WARNING | regression/weak/offline/perf/security case attempted. text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>L<br>leng<br>20:13<br>AgentHub 13733632709 visible trace 2026-06-07T12-13-04-976Z<br>17<br>A<br>AgentHub同步测试群-121224<br>20:12<br>leng: AgentHub 13733632709 multi group trace 2026-06-07T12-12-24-417Z<br>C<br>Clowder AI<br>19:38<br>⚠️ 当前没有绑定 thread，请先用 /new 创建或 /use 切换。<br>3<br>A<br>AgentHub同步测试群-112924<br>19:29<br>leng: AgentHub 13733632709 multi group trace 2026-06-07T11-29-24-487Z<br>A<br>AgentHub同步测试群-112508<br>19:25<br>leng: AgentHub 13733632709 multi group trace 2026-06-07T11-25-08-039Z<br>A<br>AgentHub同步测试群-112436<br>19:24<br>leng: AgentHub 13733632709 multi group trace 2026-06-07T11-24-36-323Z<br>20<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-17-4 i18n（可选） | PASS_WITH_WARNING | regression/weak/offline/perf/security case attempted. text=设置与安全<br>测<br>测试员B<br>13800000001<br>编辑资料<br>通知设置<br>系统通知<br>已拒绝<br>浏览器或手机后台收到新消息时显示系统通知。<br>声音提醒<br>系统通知允许声音时，播放默认提示音。<br>移动端振动<br>App 端收到本地通知时短振动提醒。<br>勿扰模式<br>在专注时段静音通知和声音。<br>通知显示消息预览<br>通知中展示发送人和消息摘要。<br>语言和外观<br>系统语言<br>选择界面的显示语言。<br>简体中文<br>深色模式<br>调整界面的主题配色。<br>隐私与安全<br>设备与登录管理<br>黑名单管理<br>退出登录<br>20<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-17-5 性能 | PASS_WITH_WARNING | regression/weak/offline/perf/security case attempted. text=设置与安全<br>测<br>测试员B<br>13800000001<br>编辑资料<br>通知设置<br>系统通知<br>已拒绝<br>浏览器或手机后台收到新消息时显示系统通知。<br>声音提醒<br>系统通知允许声音时，播放默认提示音。<br>移动端振动<br>App 端收到本地通知时短振动提醒。<br>勿扰模式<br>在专注时段静音通知和声音。<br>通知显示消息预览<br>通知中展示发送人和消息摘要。<br>语言和外观<br>系统语言<br>选择界面的显示语言。<br>简体中文<br>深色模式<br>调整界面的主题配色。<br>隐私与安全<br>设备与登录管理<br>黑名单管理<br>退出登录<br>20<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-17-6 安全 | PASS | forged token status=401 |
| V2-17-7 未覆盖项 | PASS_WITH_WARNING | regression/weak/offline/perf/security case attempted. text=设置与安全<br>测<br>测试员B<br>13800000001<br>编辑资料<br>通知设置<br>系统通知<br>已拒绝<br>浏览器或手机后台收到新消息时显示系统通知。<br>声音提醒<br>系统通知允许声音时，播放默认提示音。<br>移动端振动<br>App 端收到本地通知时短振动提醒。<br>勿扰模式<br>在专注时段静音通知和声音。<br>通知显示消息预览<br>通知中展示发送人和消息摘要。<br>语言和外观<br>系统语言<br>选择界面的显示语言。<br>简体中文<br>深色模式<br>调整界面的主题配色。<br>隐私与安全<br>设备与登录管理<br>黑名单管理<br>退出登录<br>20<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |

---

## 修复记录

### 2026-06-07

最新完整回归无阻塞项，本簇关闭。

---

## 测试结果

```bash
H5_BASE_URL=http://172.18.58.156:5173 node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs
# evidence: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-122547
```

---

## 关闭备注

Closed by `v2-full-20260607-122547`。
