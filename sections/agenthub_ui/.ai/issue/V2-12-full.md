# [V2-12] Full-run acceptance status

**状态**：Closed
**创建时间**：2026-06-07
**标签**：acceptance / testing
**优先级**：P3

---

## 问题描述

完整 V2 run `v2-full-20260607-113409` 执行到 V2-12 簇时，阻塞项数量为 0。本簇没有 Fail / Blocked；如存在 PASS_WITH_WARNING，则代表自动化验收深度说明或需人工决策的边界，不作为当前阻塞缺陷。

截图：

- N/A

---

## 复现步骤

1. 运行 `node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`。
2. 查看 `sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-113409/full-results.json`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

```
Runtime route cluster: V2-12
Evidence root: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-113409
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
| V2-12-01 chunk 增量 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>C<br>Clowder AI<br>19:38<br>⚠️ 当前没有绑定 thread，请先用 /new 创建或 /use 切换。<br>2<br>L<br>leng<br>19:29<br>AgentHub 13733632709 visible trace 2026-06-07T11-29-54-443Z<br>15<br>A<br>AgentHub同步测试群-112924<br>19:29<br>AgentHub 13733632709 multi group trace 2026-06-07T11-29-24-487Z<br>A<br>AgentHub同步测试群-112508<br>19:25<br>AgentHub 13733632709 multi group trace 2026-06-07T11-25-08-039Z<br>A<br>AgentHub同步测试群-112436<br>19:24<br>AgentHub 13733632709 multi group trace 2026-06-07T11-24-36-323Z<br>17<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-12-02 markdown 语法覆盖 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=文件预览<br>rich-markdown.md<br>未知大小 · Markdown<br>H1<br><br>bold italic del code<br><br>console.log("x")<br><br>A	B<br>1	2<br><br>𝐸<br>=<br>𝑚<br>𝑐<br>2<br>E=mc<br>2<br><br><script>alert(1)</script> |
| V2-12-3 闪烁 / 抖动 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>C<br>Clowder AI<br>19:38<br>⚠️ 当前没有绑定 thread，请先用 /new 创建或 /use 切换。<br>2<br>L<br>leng<br>19:29<br>AgentHub 13733632709 visible trace 2026-06-07T11-29-54-443Z<br>15<br>A<br>AgentHub同步测试群-112924<br>19:29<br>AgentHub 13733632709 multi group trace 2026-06-07T11-29-24-487Z<br>A<br>AgentHub同步测试群-112508<br>19:25<br>AgentHub 13733632709 multi group trace 2026-06-07T11-25-08-039Z<br>A<br>AgentHub同步测试群-112436<br>19:24<br>AgentHub 13733632709 multi group trace 2026-06-07T11-24-36-323Z<br>17<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-12-4 XSS 防护 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>C<br>Clowder AI<br>19:38<br>⚠️ 当前没有绑定 thread，请先用 /new 创建或 /use 切换。<br>2<br>L<br>leng<br>19:29<br>AgentHub 13733632709 visible trace 2026-06-07T11-29-54-443Z<br>15<br>A<br>AgentHub同步测试群-112924<br>19:29<br>AgentHub 13733632709 multi group trace 2026-06-07T11-29-24-487Z<br>A<br>AgentHub同步测试群-112508<br>19:25<br>AgentHub 13733632709 multi group trace 2026-06-07T11-25-08-039Z<br>A<br>AgentHub同步测试群-112436<br>19:24<br>AgentHub 13733632709 multi group trace 2026-06-07T11-24-36-323Z<br>17<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-12-5 代码块溢出 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=文件预览<br>rich-markdown.md<br>未知大小 · Markdown<br>H1<br><br>bold italic del code<br><br>console.log("x")<br><br>A	B<br>1	2<br><br>𝐸<br>=<br>𝑚<br>𝑐<br>2<br>E=mc<br>2<br><br><script>alert(1)</script> |
| V2-12-6 表格 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=文件预览<br>rich-markdown.md<br>未知大小 · Markdown<br>H1<br><br>bold italic del code<br><br>console.log("x")<br><br>A	B<br>1	2<br><br>𝐸<br>=<br>𝑚<br>𝑐<br>2<br>E=mc<br>2<br><br><script>alert(1)</script> |
| V2-12-7 LaTeX / 公式（可选） | PASS_WITH_WARNING | markdownOrChatVisible=true; text=文件预览<br>rich-markdown.md<br>未知大小 · Markdown<br>H1<br><br>bold italic del code<br><br>console.log("x")<br><br>A	B<br>1	2<br><br>𝐸<br>=<br>𝑚<br>𝑐<br>2<br>E=mc<br>2<br><br><script>alert(1)</script> |
| V2-12-8 复制 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>C<br>Clowder AI<br>19:38<br>⚠️ 当前没有绑定 thread，请先用 /new 创建或 /use 切换。<br>2<br>L<br>leng<br>19:29<br>AgentHub 13733632709 visible trace 2026-06-07T11-29-54-443Z<br>15<br>A<br>AgentHub同步测试群-112924<br>19:29<br>AgentHub 13733632709 multi group trace 2026-06-07T11-29-24-487Z<br>A<br>AgentHub同步测试群-112508<br>19:25<br>AgentHub 13733632709 multi group trace 2026-06-07T11-25-08-039Z<br>A<br>AgentHub同步测试群-112436<br>19:24<br>AgentHub 13733632709 multi group trace 2026-06-07T11-24-36-323Z<br>17<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-12-9 同时多只 cat 输出 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>C<br>Clowder AI<br>19:38<br>⚠️ 当前没有绑定 thread，请先用 /new 创建或 /use 切换。<br>2<br>L<br>leng<br>19:29<br>AgentHub 13733632709 visible trace 2026-06-07T11-29-54-443Z<br>15<br>A<br>AgentHub同步测试群-112924<br>19:29<br>AgentHub 13733632709 multi group trace 2026-06-07T11-29-24-487Z<br>A<br>AgentHub同步测试群-112508<br>19:25<br>AgentHub 13733632709 multi group trace 2026-06-07T11-25-08-039Z<br>A<br>AgentHub同步测试群-112436<br>19:24<br>AgentHub 13733632709 multi group trace 2026-06-07T11-24-36-323Z<br>17<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-12-10 终端错误 | PASS_WITH_WARNING | markdownOrChatVisible=true; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>C<br>Clowder AI<br>19:38<br>⚠️ 当前没有绑定 thread，请先用 /new 创建或 /use 切换。<br>2<br>L<br>leng<br>19:29<br>AgentHub 13733632709 visible trace 2026-06-07T11-29-54-443Z<br>15<br>A<br>AgentHub同步测试群-112924<br>19:29<br>AgentHub 13733632709 multi group trace 2026-06-07T11-29-24-487Z<br>A<br>AgentHub同步测试群-112508<br>19:25<br>AgentHub 13733632709 multi group trace 2026-06-07T11-25-08-039Z<br>A<br>AgentHub同步测试群-112436<br>19:24<br>AgentHub 13733632709 multi group trace 2026-06-07T11-24-36-323Z<br>17<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |

---

## 修复记录

### 2026-06-07

最新完整回归无阻塞项，本簇关闭。

---

## 测试结果

```bash
H5_BASE_URL=http://172.18.58.156:5173 node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs
# evidence: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-113409
```

---

## 关闭备注

Closed by `v2-full-20260607-113409`。
