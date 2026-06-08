# [ISSUE-010] 修复匿名/未登录视觉验收下 MessageBubble 读取 currentUser.raw 崩溃

**状态**：Resolved
**创建时间**：2026-06-08
**标签**：bug, visual-smoke, message, anonymous
**AI修复模式**：Direct Fix
**计划路径**：N/A

---

## 问题描述

按 `sections/ui/.ai/tests/test-plan.md` 执行 Playwright 四视口验收时，未登录演示环境下 `appStore.currentUser` 可能为 `null`。`MessageBubble.vue` 调用 `isSelfSender(props.data.senderId, appStore.currentUser)` 后进入 `collectSelfIds(null)`，直接读取 `currentUser.raw` 导致运行时 TypeError。

---

## 复现步骤

1. 启动 `npm run dev:h5 -- --host 0.0.0.0 --port 5173`。
2. 用浏览器打开 `http://localhost:5173/#/pages/chat/detail?id=2`。
3. 在未登录/空 currentUser 状态渲染消息列表。

预期：演示消息正常渲染。  
实际：控制台出现 `Cannot read properties of null (reading 'raw')`。

---

## 根因分析

`collectSelfIds`、`isSelfSender`、`resolveSelfId`、`resolveSelfName`、`resolveSelfAvatar` 只为参数缺省提供 `{}`，没有处理显式传入 `null` 的情况。

---

## 修复记录

在 `services/native-im/message-state.js` 中对上述 helper 入口统一做 `currentUser = currentUser || {}` 归一化；新增回归测试覆盖匿名 visual smoke 下的空用户。

---

## 测试结果

已通过：

```bash
npm run test:native-im
npm run build:h5
npm run test:smoke
```

Playwright 四视口验收通过：375x844、768x1024、1024x768、1440x900，且无未过滤 JS 运行时错误。
