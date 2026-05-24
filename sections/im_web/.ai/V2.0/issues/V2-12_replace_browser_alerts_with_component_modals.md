# [V2-12] 所有弹窗必须使用组件弹窗而不是浏览器 alert

**状态**：Resolved
**创建时间**：2026-05-24
**标签**：bug / ux / refactor
**优先级**：P1

---

## 问题描述

当前 IM Web V2.0 中仍可能存在浏览器原生 `alert`、`confirm` 或 `prompt` 弹窗。原生弹窗会阻塞页面线程、样式不可控、无法保持产品一致性，也不利于自动化测试稳定定位。

要求：所有用户可见弹窗、确认框、输入框和提示都必须使用项目组件弹窗或 UI 组件库能力，不再直接调用浏览器原生弹窗。

---

## 复现步骤

1. 在 `sections/im_web` 中搜索浏览器原生弹窗调用：
   ```bash
   rg -n "window\\.(alert|confirm|prompt)|\\b(alert|confirm|prompt)\\(" sections/im_web
   ```
2. 触发消息操作、删除确认、编辑消息、群管理、设备退出、举报、机器人等流程。
3. 若出现浏览器原生弹窗，则该流程不符合 V2.0 UI 规范。

---

## 相关代码

```
sections/im_web/apps/chat/src/components/
sections/im_web/apps/chat/src/views/
sections/im_web/packages/base-vue/src/components/
```

已知高风险位置：

```
sections/im_web/apps/chat/src/components/MessageList.vue
```

消息编辑当前可能使用 `window.prompt`，需要替换为组件弹窗输入。

---

## 根因分析

已确认部分早期实现为了快速完成编辑、删除或确认交互，直接使用了浏览器原生弹窗：

1. 消息编辑使用 `window.prompt`。
2. 群成员移除、转让群主、拉黑使用 `window.confirm`。
3. 群设置中的解散群聊、退出群聊使用 `window.confirm`。

这些交互样式不可控，也会影响自动化测试稳定性。

---

## 问题列表（Q&A 迭代）

### Q1: 哪些原生弹窗需要替换？
**A1**: 所有用户可见的 `alert`、`confirm`、`prompt`，包括直接调用和 `window.*` 调用。

### Q2: 替换后的交互要求是什么？
**A2**: 使用项目组件弹窗或 Arco/Vue 组件弹窗，支持一致样式、取消/确认状态、异步 loading、错误提示和自动化测试定位。

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 1 Static Check | `rg -n "window\\.(alert|confirm|prompt)|\\b(alert|confirm|prompt)\\(" sections/im_web -g '!node_modules' -g '!dist'` | Pass，无匹配 |
| Layer 2 Component | `pnpm exec vitest run tests/noNativeDialogs.test.ts --config vitest.config.ts` | Pass |
| Layer 5 E2E | `pnpm test:e2e` | Pass，8/8 passed |

---

## 修复记录

2026-05-24 已完成：

1. 新增共享组件弹窗 `AppDialog.vue`，支持确认、取消、输入内容、危险操作样式和稳定测试定位。
2. 将消息编辑从 `window.prompt` 迁移为 `AppDialog` 输入弹窗。
3. 将群成员移除、转让群主、拉黑从 `window.confirm` 迁移为 `AppDialog` 确认弹窗。
4. 将群设置中的解散群聊、退出群聊确认迁移为 `AppDialog`。
5. 新增 `noNativeDialogs.test.ts`，防止 `alert`、`confirm`、`prompt` 回归。

---

## 测试结果

| 命令 | 结果 |
|---|---|
| `rg -n "window\\.(alert|confirm|prompt)|\\b(alert|confirm|prompt)\\(" sections/im_web -g '!node_modules' -g '!dist'` | Pass，无匹配 |
| `cd sections/im_web/apps/chat && pnpm exec vitest run tests/noNativeDialogs.test.ts tests/mediaUrlNormalization.test.ts tests/uiLayoutStability.test.ts tests/messageMediaSending.test.ts --config vitest.config.ts` | Pass，4 files / 7 tests |
| `cd sections/im_web && pnpm type-check` | Pass |
| `cd sections/im_web && pnpm test:unit` | Pass，28 files / 63 tests |
| `cd sections/im_web && pnpm build` | Pass，保留既有 chunk size warning |
| `cd sections/im_web && pnpm test:e2e` | Pass，8/8 passed |

---

## 关闭备注

Resolved。源码静态检查和回归测试均确认不再存在用户可见原生弹窗调用。
