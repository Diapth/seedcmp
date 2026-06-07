# [V2-12] Full-run failures / warnings

**状态**：Open
**创建时间**：2026-06-07
**标签**：bug / investigation / testing
**优先级**：P2

---

## 问题描述

完整 V2 run `v2-full-20260607-075820` 执行到 V2-12 簇时发现以下 Fail / Warning。测试未因这些问题暂停，后续簇已继续执行。

截图：

- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-12-01/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-12-02/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-12-3/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-12-4/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-12-5/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-12-6/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-12-7/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-12-8/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-12-9/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-075820/V2-12-10/01_result.png`

---

## 复现步骤

1. 运行 `node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`。
2. 查看 `sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-075820/full-results.json`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

```
Runtime route cluster: V2-12
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
| V2-12-01 chunk 增量 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-12-02 markdown 语法覆盖 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=文件预览<br>rich-markdown.md<br>未知大小 · Markdown<br>H1<br><br>bold italic del code<br><br>console.log("x")<br><br>A	B<br>1	2<br><br>𝐸<br>=<br>𝑚<br>𝑐<br>2<br>E=mc<br>2<br><br><script>alert(1)</script> |
| V2-12-3 闪烁 / 抖动 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-12-4 XSS 防护 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-12-5 代码块溢出 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=文件预览<br>rich-markdown.md<br>未知大小 · Markdown<br>H1<br><br>bold italic del code<br><br>console.log("x")<br><br>A	B<br>1	2<br><br>𝐸<br>=<br>𝑚<br>𝑐<br>2<br>E=mc<br>2<br><br><script>alert(1)</script> |
| V2-12-6 表格 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=文件预览<br>rich-markdown.md<br>未知大小 · Markdown<br>H1<br><br>bold italic del code<br><br>console.log("x")<br><br>A	B<br>1	2<br><br>𝐸<br>=<br>𝑚<br>𝑐<br>2<br>E=mc<br>2<br><br><script>alert(1)</script> |
| V2-12-7 LaTeX / 公式（可选） | PASS_WITH_WARNING | markdownOrChatVisible=true; text=文件预览<br>rich-markdown.md<br>未知大小 · Markdown<br>H1<br><br>bold italic del code<br><br>console.log("x")<br><br>A	B<br>1	2<br><br>𝐸<br>=<br>𝑚<br>𝑐<br>2<br>E=mc<br>2<br><br><script>alert(1)</script> |
| V2-12-8 复制 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-12-9 同时多只 cat 输出 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-12-10 终端错误 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |

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
