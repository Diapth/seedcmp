# [V2-14] 文件消息卡片视觉错位与宽度不稳定

**状态**：Resolved
**创建时间**：2026-05-24
**标签**：bug / ux / media / testing
**优先级**：P1

---

## 问题描述

用户反馈文件消息在聊天区仍存在 UI 错位：文件卡片宽度和外层消息气泡不一致，右侧发送消息时看起来像卡片被嵌在另一层气泡中，左侧文件消息也容易出现宽度撑开或对齐不稳。

---

## 复现证据

手动测试手册链路的浏览器自动可视化审计复现了该问题：

```
sections/im_web/.ai/V2.0/issues/tests-e2e/manual-visual-audit-2026-05-24T12-54-37-825Z/summary.md
sections/im_web/.ai/V2.0/issues/imgs/manual-visual-audit-2026-05-24T12-54-37-825Z/05-file-message-sent.png
```

失败记录：

```
V2-14 文件消息卡片布局越界或尺寸异常
```

DOM 边界显示 `.file-cell` 宽度约 324px，但内部 `.bubble` 因 `max-width: 60%` 只有约 195px，导致文件卡片内部视觉宽度与外层容器不一致。

---

## 根因分析

`FileCell.vue` 中根节点 `.file-cell` 使用 `width: 100%`，而内部 `.bubble` 又设置 `max-width: 60%`。在 `MessageList.vue` 的 `.msg-bubble-container` 已经限制最大宽度后，文件卡片内部再次按百分比收缩，形成嵌套宽度错位。

---

## 修复记录

2026-05-24 已完成：

1. 将 `.file-cell` 改为稳定卡片宽度：`width: clamp(240px, 34vw, 320px)`，并保留 `max-width: 100%`。
2. 将 `.bubble` 改为 `width: 100%`、`min-width: 0`，移除 `max-width: 60%`。
3. 为 `.file-details` 补充 `min-width: 0`，确保长文件名在卡片内省略，不撑破布局。
4. 在 `uiLayoutStability.test.ts` 中新增文件消息卡片布局契约测试。

---

## 测试结果

| 命令 / 操作 | 结果 |
|---|---|
| `node /tmp/im-web-manual-visual-audit.js` | Pass，最终报告 `manual-visual-audit-2026-05-24T13-07-08-392Z`，12 checks / 0 failed |
| `pnpm exec vitest run tests/uiLayoutStability.test.ts tests/searchResults.test.ts --config vitest.config.ts` | Pass |

---

## 关闭备注

Resolved。文件消息卡片已统一为单一稳定卡片宽度，最终可视化审计确认不再出现文件卡片布局异常。
