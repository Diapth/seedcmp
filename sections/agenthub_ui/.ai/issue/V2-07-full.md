# [V2-07] Full-run failures / warnings

**状态**：Open
**创建时间**：2026-06-07
**标签**：bug / investigation / testing
**优先级**：P1

---

## 问题描述

完整 V2 run `v2-full-20260607-075820` 执行到 V2-07 簇时发现以下 Fail / Warning。测试未因这些问题暂停，后续簇已继续执行。

截图：

- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-07-05/01_result.png`

---

## 复现步骤

1. 运行 `node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`。
2. 查看 `sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-075820/full-results.json`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

```
Runtime route cluster: V2-07
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
| V2-07-05 API Key 创建 | FAIL | Runner exception: locator.click: Timeout 2500ms exceeded.<br>Call log:<br>[2m  - waiting for locator('.segmented-item').filter({ hasText: 'API Key' }).first()[22m<br><br>    at clickSegment (/home/yunyi/Desktop/Bytedance_cmp/cat-cafe-agenthub-v2-issue-fix/sections/agenthub_ui/.ai/tests/v2-full-runner.mjs:191:17)<br>    at runCaseAction (/home/yunyi/Desktop/Bytedance_cmp/cat-cafe-agenthub-v2-issue-fix/sections/agenthub_ui/.ai/tests/v2-full-runner.mjs:545:13)<br>    at async file:///home/yunyi/Desktop/Bytedance_cmp/cat-cafe-agenthub-v2-issue-fix/sections/agenthub_ui/.ai/tests/v2-full-runner.mjs:814:22 |

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
