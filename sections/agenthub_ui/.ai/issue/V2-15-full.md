# [V2-15] Full-run failures / warnings

**状态**：Open
**创建时间**：2026-06-07
**标签**：bug / investigation / testing
**优先级**：P2

---

## 问题描述

完整 V2 run `v2-full-20260607-041127` 执行到 V2-15 簇时发现以下 Fail / Warning。测试未因这些问题暂停，后续簇已继续执行。

截图：

- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-15-01/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-15-02/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-15-03/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-15-04/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-15-5/01_result.png`

---

## 复现步骤

1. 运行 `node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`。
2. 查看 `sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127/full-results.json`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

```
Runtime route cluster: V2-15
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
| V2-15-01 资料 | PASS_WITH_WARNING | profileVisible=true; text=个人资料<br>测<br>测试员B<br>在线<br>手机号 13800000001<br>编辑资料<br>我的二维码<br>二维码后端能力待接入<br>接入真实 token 与二维码生成接口后可用于面对面添加好友。<br>暂不可用<br>账号状态<br>消息通知<br>已开启<br>登录设备<br>2 台在线<br>隐私保护<br>标准<br>设备与登录管理<br>黑名单管理 |
| V2-15-02 头像 | PASS_WITH_WARNING | profileVisible=true; text=个人资料<br>测<br>测试员B<br>在线<br>手机号 13800000001<br>编辑资料<br>我的二维码<br>二维码后端能力待接入<br>接入真实 token 与二维码生成接口后可用于面对面添加好友。<br>暂不可用<br>账号状态<br>消息通知<br>已开启<br>登录设备<br>2 台在线<br>隐私保护<br>标准<br>设备与登录管理<br>黑名单管理 |
| V2-15-03 二维码 | PASS_WITH_WARNING | profileVisible=true; text=个人资料<br>测<br>测试员B<br>在线<br>手机号 13800000001<br>编辑资料<br>我的二维码<br>二维码后端能力待接入<br>接入真实 token 与二维码生成接口后可用于面对面添加好友。<br>暂不可用<br>账号状态<br>消息通知<br>已开启<br>登录设备<br>2 台在线<br>隐私保护<br>标准<br>设备与登录管理<br>黑名单管理 |
| V2-15-04 短号搜索 | PASS_WITH_WARNING | profileVisible=true; text=个人资料<br>测<br>测试员B<br>在线<br>手机号 13800000001<br>编辑资料<br>我的二维码<br>二维码后端能力待接入<br>接入真实 token 与二维码生成接口后可用于面对面添加好友。<br>暂不可用<br>账号状态<br>消息通知<br>已开启<br>登录设备<br>2 台在线<br>隐私保护<br>标准<br>设备与登录管理<br>黑名单管理 |
| V2-15-5 隐私 | PASS_WITH_WARNING | profileVisible=true; text=个人资料<br>测<br>测试员B<br>在线<br>手机号 13800000001<br>编辑资料<br>我的二维码<br>二维码后端能力待接入<br>接入真实 token 与二维码生成接口后可用于面对面添加好友。<br>暂不可用<br>账号状态<br>消息通知<br>已开启<br>登录设备<br>2 台在线<br>隐私保护<br>标准<br>设备与登录管理<br>黑名单管理 |

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
