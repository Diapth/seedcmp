# [V2-04] Full-run failures / warnings

**状态**：Open
**创建时间**：2026-06-07
**标签**：bug / investigation / testing
**优先级**：P2

---

## 问题描述

完整 V2 run `v2-full-20260607-075820` 执行到 V2-04 簇时发现以下 Fail / Warning。测试未因这些问题暂停，后续簇已继续执行。

截图：

- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-04-01/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-04-02/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-04-03/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-04-4/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-04-5/01_result.png`

---

## 复现步骤

1. 运行 `node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`。
2. 查看 `sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-075820/full-results.json`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

```
Runtime route cluster: V2-04
Evidence root: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-075820
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
| V2-04-01 单向删除（B 删 A） | PASS_WITH_WARNING | route=pages/contacts/index; text=测<br>通讯录<br>管理好友、群组与申请<br>联系人<br>群聊<br>最近联系人<br>无匹配的联系人<br>分组<br>同事<br>24<br>朋友<br>15<br>家人<br>6<br>聊天<br>通讯录<br>智能体<br>文件<br>设置<br>账号已在其他设备登录<br>缺少 refresh token<br>重新登录 |
| V2-04-02 双向删除 | PASS_WITH_WARNING | route=pages/contacts/index; text=测<br>通讯录<br>管理好友、群组与申请<br>联系人<br>群聊<br>最近联系人<br>无匹配的联系人<br>分组<br>同事<br>24<br>朋友<br>15<br>家人<br>6<br>聊天<br>通讯录<br>智能体<br>文件<br>设置<br>账号已在其他设备登录<br>缺少 refresh token<br>重新登录 |
| V2-04-03 再加回 | PASS_WITH_WARNING | route=pages/contacts/index; text=测<br>通讯录<br>管理好友、群组与申请<br>联系人<br>群聊<br>最近联系人<br>无匹配的联系人<br>分组<br>同事<br>24<br>朋友<br>15<br>家人<br>6<br>聊天<br>通讯录<br>智能体<br>文件<br>设置<br>账号已在其他设备登录<br>缺少 refresh token<br>重新登录 |
| V2-04-4 删除好友时关联群 | PASS_WITH_WARNING | route=pages/contacts/index; text=测<br>通讯录<br>管理好友、群组与申请<br>联系人<br>群聊<br>最近联系人<br>无匹配的联系人<br>分组<br>同事<br>24<br>朋友<br>15<br>家人<br>6<br>聊天<br>通讯录<br>智能体<br>文件<br>设置<br>账号已在其他设备登录<br>缺少 refresh token<br>重新登录 |
| V2-04-5 删除被拒 | PASS_WITH_WARNING | route=pages/contacts/index; text=测<br>通讯录<br>管理好友、群组与申请<br>联系人<br>群聊<br>最近联系人<br>无匹配的联系人<br>分组<br>同事<br>24<br>朋友<br>15<br>家人<br>6<br>聊天<br>通讯录<br>智能体<br>文件<br>设置<br>账号已在其他设备登录<br>缺少 refresh token<br>重新登录 |

---

## 修复记录

### 2026-06-07

尚未修复。

---

## 测试结果

```bash
H5_BASE_URL=http://172.18.58.156:5174 node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs
# evidence: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-075820
```

---

## 关闭备注

待对应 case 修复后重跑完整 V2 或至少重跑本簇，并更新该 issue。
