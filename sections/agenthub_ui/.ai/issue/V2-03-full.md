# [V2-03] Full-run failures / warnings

**状态**：Open
**创建时间**：2026-06-07
**标签**：bug / investigation / testing
**优先级**：P2

---

## 问题描述

完整 V2 run `v2-full-20260607-041127` 执行到 V2-03 簇时发现以下 Fail / Warning。测试未因这些问题暂停，后续簇已继续执行。

截图：

- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-03-01/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-03-02/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-03-03/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-03-04/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-03-05/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-03-06/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-03-07/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-03-08/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-03-09/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-03-10/01_result.png`

---

## 复现步骤

1. 运行 `node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`。
2. 查看 `sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127/full-results.json`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

```
Runtime route cluster: V2-03
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
| V2-03-01 B 通过手机号搜 A | PASS_WITH_WARNING | route=pages/contacts/add; text=添加朋友<br>搜索<br>L<br>leng<br>填写验证消息<br>发送申请 |
| V2-03-02 发送好友请求 | PASS_WITH_WARNING | route=pages/contacts/add; text=添加朋友<br>搜索<br>L<br>leng<br>填写验证消息<br>发送申请 |
| V2-03-03 A 收到好友请求 | PASS_WITH_WARNING | route=pages/contacts/friend-requests; text=新的朋友<br>没有新的好友申请 |
| V2-03-04 A 在 agenthub_ui 同意请求 | PASS_WITH_WARNING | route=pages/contacts/friend-requests; text=新的朋友<br>没有新的好友申请 |
| V2-03-05 红点清除 | PASS_WITH_WARNING | route=pages/contacts/friend-requests; text=新的朋友<br>没有新的好友申请 |
| V2-03-06 B 端同步 | PASS_WITH_WARNING | route=pages/contacts/add; text=添加朋友<br>搜索<br>L<br>leng<br>填写验证消息<br>发送申请 |
| V2-03-07 重复发请求 | PASS_WITH_WARNING | route=pages/contacts/add; text=添加朋友<br>搜索<br>L<br>leng<br>填写验证消息<br>发送申请 |
| V2-03-08 跨账号重复 | PASS_WITH_WARNING | route=pages/contacts/add; text=添加朋友<br>搜索<br>L<br>leng<br>填写验证消息<br>发送申请 |
| V2-03-09 B ↔ C 互加 | PASS_WITH_WARNING | route=pages/contacts/add; text=添加朋友<br>搜索<br>测<br>测试员C<br>填写验证消息<br>发送申请 |
| V2-03-10 黑名单 | PASS_WITH_WARNING | route=pages/contacts/blacklist; text=黑名单管理<br>黑名单为空<br>您目前没有屏蔽任何联系人 |

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
