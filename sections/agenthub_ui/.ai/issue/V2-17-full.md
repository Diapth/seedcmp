# [V2-17] Full-run failures / warnings

**状态**：Open
**创建时间**：2026-06-07
**标签**：bug / investigation / testing
**优先级**：P2

---

## 问题描述

完整 V2 run `v2-full-20260607-041127` 执行到 V2-17 簇时发现以下 Fail / Warning。测试未因这些问题暂停，后续簇已继续执行。

截图：

- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-17-01/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-17-02/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-17-3/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-17-4/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-17-5/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-17-7/01_result.png`

---

## 复现步骤

1. 运行 `node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`。
2. 查看 `sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127/full-results.json`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

```
Runtime route cluster: V2-17
Evidence root: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127
```

---

## 根因分析

待修复 owner 结合运行态源码与后端接口进一步定位。本轮只做 E2E 验收，不修改业务代码。

---

## 问题列表（Q&A 迭代）

### Q1: 是否因为前一个失败而停止后续测试？
**A1**: 否。本轮 runner 对全部 141 个 case 都执行了尝试并保存截图。

---

## 测试发现记录

| Case | Status | Finding |
|---|---|---|
| V2-17-01 全量回归 | PASS_WITH_WARNING | regression/weak/offline/perf/security case attempted. text=设置与安全<br>测<br>测试员B<br>13800000001<br>编辑资料<br>通知设置<br>系统通知<br>已拒绝<br>浏览器或手机后台收到新消息时显示系统通知。<br>声音提醒<br>系统通知允许声音时，播放默认提示音。<br>移动端振动<br>App 端收到本地通知时短振动提醒。<br>勿扰模式<br>在专注时段静音通知和声音。<br>通知显示消息预览<br>通知中展示发送人和消息摘要。<br>语言和外观<br>系统语言<br>选择界面的显示语言。<br>简体中文<br>深色模式<br>调整界面的主题配色。<br>隐私与安全<br>设备与登录管理<br>黑名单管理<br>退出登录<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-17-02 弱网 | PASS_WITH_WARNING | regression/weak/offline/perf/security case attempted. text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-17-3 离线 | PASS_WITH_WARNING | regression/weak/offline/perf/security case attempted. text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-17-4 i18n（可选） | PASS_WITH_WARNING | regression/weak/offline/perf/security case attempted. text=设置与安全<br>测<br>测试员B<br>13800000001<br>编辑资料<br>通知设置<br>系统通知<br>已拒绝<br>浏览器或手机后台收到新消息时显示系统通知。<br>声音提醒<br>系统通知允许声音时，播放默认提示音。<br>移动端振动<br>App 端收到本地通知时短振动提醒。<br>勿扰模式<br>在专注时段静音通知和声音。<br>通知显示消息预览<br>通知中展示发送人和消息摘要。<br>语言和外观<br>系统语言<br>选择界面的显示语言。<br>简体中文<br>深色模式<br>调整界面的主题配色。<br>隐私与安全<br>设备与登录管理<br>黑名单管理<br>退出登录<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-17-5 性能 | PASS_WITH_WARNING | regression/weak/offline/perf/security case attempted. text=设置与安全<br>测<br>测试员B<br>13800000001<br>编辑资料<br>通知设置<br>系统通知<br>已拒绝<br>浏览器或手机后台收到新消息时显示系统通知。<br>声音提醒<br>系统通知允许声音时，播放默认提示音。<br>移动端振动<br>App 端收到本地通知时短振动提醒。<br>勿扰模式<br>在专注时段静音通知和声音。<br>通知显示消息预览<br>通知中展示发送人和消息摘要。<br>语言和外观<br>系统语言<br>选择界面的显示语言。<br>简体中文<br>深色模式<br>调整界面的主题配色。<br>隐私与安全<br>设备与登录管理<br>黑名单管理<br>退出登录<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-17-7 未覆盖项 | PASS_WITH_WARNING | regression/weak/offline/perf/security case attempted. text=设置与安全<br>测<br>测试员B<br>13800000001<br>编辑资料<br>通知设置<br>系统通知<br>已拒绝<br>浏览器或手机后台收到新消息时显示系统通知。<br>声音提醒<br>系统通知允许声音时，播放默认提示音。<br>移动端振动<br>App 端收到本地通知时短振动提醒。<br>勿扰模式<br>在专注时段静音通知和声音。<br>通知显示消息预览<br>通知中展示发送人和消息摘要。<br>语言和外观<br>系统语言<br>选择界面的显示语言。<br>简体中文<br>深色模式<br>调整界面的主题配色。<br>隐私与安全<br>设备与登录管理<br>黑名单管理<br>退出登录<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |

---

## 修复记录

### 2026-06-07

尚未修复。

---

## 测试结果

```bash
H5_BASE_URL=http://172.18.58.156:5173 node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs
# evidence: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127
```

---

## 关闭备注

待对应 case 修复后重跑完整 V2 或至少重跑本簇，并更新该 issue。
