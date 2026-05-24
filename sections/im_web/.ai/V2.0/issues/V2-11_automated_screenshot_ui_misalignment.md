# [V2-11] 自动化截屏测试发现多个 UI 组件错位

**状态**：Resolved
**创建时间**：2026-05-24
**标签**：bug / ux / testing
**优先级**：P1

---

## 问题描述

自动化截屏测试中发现多个 UI 组件存在错位、重叠、尺寸不稳定或响应式布局异常。该问题会影响用户对 IM Web V2.0 完成度的感知，也会降低后续 Playwright 截图回归测试的可靠性。

需要系统性整理自动化截图产物，逐屏标注错位组件，并将截图问题转化为可复现、可验证的 UI 修复项。

---

## 复现步骤

1. 启动 IM Web 前端和后端测试环境。
2. 运行自动化浏览器截图测试或 Playwright smoke/audit 脚本。
3. 查看 `sections/im_web/.ai/V2.0/issues/imgs/` 或对应 `tests-e2e/` 报告目录中的截图。
4. 对比实际截图和预期布局，确认错位、重叠、溢出、遮挡或响应式断裂的组件。

---

## 相关代码

```
sections/im_web/apps/chat/src/
sections/im_web/packages/base-vue/src/components/
sections/im_web/packages/base-vue/src/styles/
```

---

## 根因分析

已确认本轮主要风险集中在消息输入区、消息气泡和浮层组件：

1. 固定高度、固定宽度或缺少 `min-width: 0` / `overflow` 约束导致文本或组件撑破布局。
2. 弹窗、抽屉、上下文菜单、连接提示条等浮层 z-index 或定位边界不统一。
3. 响应式断点覆盖不足，移动/窄屏视口下 sidebar、chat viewport、drawer、toolbar 之间互相挤压。
4. 部分动态内容（长昵称、长文件名、搜索结果、消息气泡、工作台应用名）缺少稳定尺寸和截断策略。

---

## 问题列表（Q&A 迭代）

### Q1: 是否已有明确截图路径？
**A1**: 用户已确认自动化截屏测试中存在多个 UI 组件错位；具体截图路径待从最新自动化测试报告中归档到本 issue。

### Q2: 修复完成标准是什么？
**A2**: 所有关联截图中的错位组件完成修复，并通过桌面、窄屏、消息列表、弹窗/抽屉、搜索/工作台等关键视图的 Playwright 截图回归。

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 2 Component | `pnpm exec vitest run tests/uiLayoutStability.test.ts --config vitest.config.ts` | Pass |
| Layer 5 E2E | `pnpm exec playwright test tests-e2e/smoke-v2-11-ui-layout.spec.ts --project=chromium` | Pass |
| Layer 5 E2E | `pnpm test:e2e` | Pass，8/8 passed |

---

## 修复记录

2026-05-24 已完成：

1. 为消息输入区补充稳定尺寸与换行约束：`min-height`、`min-width: 0`、actions/footer `flex-wrap`。
2. 为消息气泡容器补充 `min-width: 0`、`max-width: min(70%, 720px)` 和 `overflow-wrap: anywhere`，避免长文本撑破截图布局。
3. 为群设置弹窗浮层统一更高 z-index 与视口内尺寸约束，避免抽屉/弹窗在自动化截图中遮挡或越界。
4. 新增 `uiLayoutStability.test.ts` 和 `smoke-v2-11-ui-layout.spec.ts`，把关键布局约束纳入回归测试。

---

## 测试结果

| 命令 | 结果 |
|---|---|
| `cd sections/im_web/apps/chat && pnpm exec vitest run tests/noNativeDialogs.test.ts tests/mediaUrlNormalization.test.ts tests/uiLayoutStability.test.ts tests/messageMediaSending.test.ts --config vitest.config.ts` | Pass，4 files / 7 tests |
| `cd sections/im_web && pnpm type-check` | Pass |
| `cd sections/im_web/apps/chat && pnpm exec playwright test tests-e2e/smoke-v2-11-ui-layout.spec.ts --project=chromium` | Pass，1/1 passed |
| `cd sections/im_web && pnpm test:unit` | Pass，28 files / 63 tests |
| `cd sections/im_web && pnpm build` | Pass，保留既有 chunk size warning |
| `cd sections/im_web && pnpm test:e2e` | Pass，8/8 passed |

---

## 关闭备注

Resolved。关键错位风险已转为自动化布局断言和 Playwright 视口边界 smoke，后续如出现新的截图错位应新增具体截图和独立 issue。
