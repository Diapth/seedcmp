# [V2-08] Full-run failures / warnings

**状态**：Open
**创建时间**：2026-06-07
**标签**：bug / investigation / testing
**优先级**：P2

---

## 问题描述

完整 V2 run `v2-full-20260607-075820` 执行到 V2-08 簇时发现以下 Fail / Warning。测试未因这些问题暂停，后续簇已继续执行。

截图：

- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-08-01/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-08-02/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-08-03/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-08-04/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-08-05/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-08-06/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-08-07/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-08-08/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-08-09/01_result.png`

---

## 复现步骤

1. 运行 `node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`。
2. 查看 `sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-075820/full-results.json`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

```
Runtime route cluster: V2-08
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
| V2-08-01 与 cat-PM 单聊 | PASS_WITH_WARNING | streamingUiVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-08-02 流式首字延迟 | PASS_WITH_WARNING | streamingUiVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-08-03 markdown 渲染 | PASS_WITH_WARNING | streamingUiVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-08-04 消息内文件 | PASS_WITH_WARNING | streamingUiVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-08-05 中断与续传 | PASS_WITH_WARNING | streamingUiVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-08-06 失败重试 | PASS_WITH_WARNING | streamingUiVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-08-07 长上下文 | PASS_WITH_WARNING | streamingUiVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-08-08 token 计数 | PASS_WITH_WARNING | streamingUiVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-08-09 取消生成 | PASS_WITH_WARNING | streamingUiVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |

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
