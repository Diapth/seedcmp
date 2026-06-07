# [V2-02] Full-run failures / warnings

**状态**：Open
**创建时间**：2026-06-07
**标签**：bug / investigation / testing
**优先级**：P1

---

## 问题描述

完整 V2 run `v2-full-20260607-041127` 执行到 V2-02 簇时发现以下 Fail / Warning。测试未因这些问题暂停，后续簇已继续执行。

截图：

- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-02-01/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-02-02/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-02-04/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-02-05/01_result.png`

---

## 复现步骤

1. 运行 `node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`。
2. 查看 `sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127/full-results.json`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

```
Runtime route cluster: V2-02
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
| V2-02-01 进入注册页 | FAIL | confirmPasswordVisible=false; text=返回登录<br>加入 AgentHub<br>开启您的智能化工作协同体验<br>手机号<br>请输入手机号<br>验证码<br>短信验证码<br>获取验证码<br>昵称<br>请输入您的昵称<br>密码<br>密码 (不少于6位)<br>注册账号 |
| V2-02-02 字段校验 | FAIL | emptyValidation=true; sevenCharSubmitted=true; url=http://172.18.58.156:5173/#/pages/chat/index |
| V2-02-04 B 注册成功 | FAIL | B registration attempted. ok=false; url=http://172.18.58.156:5173/#/pages/login/register; text=返回登录<br>加入 AgentHub<br>开启您的智能化工作协同体验<br>该用户已存在<br>手机号<br>验证码<br>55s<br>昵称<br>密码<br>注册账号 |
| V2-02-05 C 注册成功 | PASS_WITH_WARNING | C registration attempted. registerOk=false; fallbackLogin=true; text=返回登录<br>加入 AgentHub<br>开启您的智能化工作协同体验<br>该用户已存在<br>手机号<br>验证码<br>57s<br>昵称<br>密码<br>注册账号 |

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
