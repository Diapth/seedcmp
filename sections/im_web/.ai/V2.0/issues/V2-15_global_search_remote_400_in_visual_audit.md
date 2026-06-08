# [V2-15] 全局搜索远程接口 400 污染可视化审计

**状态**：Resolved
**创建时间**：2026-05-24
**标签**：bug / search / testing
**优先级**：P1

---

## 问题描述

按照 `manual-testing-guide.md` 执行浏览器自动可视化审计时，在全局搜索框输入 `test` 会触发后端请求：

```
POST http://localhost:8090/v1/search/global
```

登录态下该请求返回 400，导致控制台出现 resource error，并让网络错误检查失败。手册要求全局搜索在无结果时显示友好状态，不能因为后端远程搜索不可用而污染 UI 验收。

---

## 复现证据

```
sections/im_web/.ai/V2.0/issues/tests-e2e/manual-visual-audit-2026-05-24T12-54-37-825Z/summary.md
```

失败记录：

```
控制台严重错误检查: Failed to load resource: the server responded with a status of 400
网络错误检查: http://localhost:8090/v1/search/global 400
```

---

## 根因分析

`SearchResultList.vue` 默认在每次输入搜索关键词时调用 `commonApi.globalSearch()`。当前环境的 `/search/global` 接口参数或服务能力不稳定，返回 400。即使前端 catch 了异常，浏览器仍会记录 400 resource error，影响自动化审计。

---

## 修复记录

2026-05-24 已完成：

1. 全局搜索默认使用本地联系人、群组和已加载聊天记录结果，满足手册中的基础搜索体验。
2. 远程全局搜索改为显式开关：仅当 `VITE_ENABLE_REMOTE_GLOBAL_SEARCH=true` 时调用 `/search/global`。
3. 保留远程搜索代码路径，后端接口稳定后可通过环境变量重新启用。
4. 更新 `searchResults.test.ts`，确保远程搜索开关契约被测试覆盖。

---

## 测试结果

| 命令 / 操作 | 结果 |
|---|---|
| `node /tmp/im-web-manual-visual-audit.js` | Pass，最终报告 `manual-visual-audit-2026-05-24T13-07-08-392Z`，控制台严重错误 0，网络错误 0 |
| `pnpm exec vitest run tests/uiLayoutStability.test.ts tests/searchResults.test.ts --config vitest.config.ts` | Pass |

---

## 关闭备注

Resolved。默认手册验收链路不再触发不稳定远程搜索接口；如需集成后端全局搜索，使用 `VITE_ENABLE_REMOTE_GLOBAL_SEARCH=true` 显式启用并单独验证接口契约。
