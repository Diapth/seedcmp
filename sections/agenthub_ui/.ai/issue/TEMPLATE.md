# [V2-XX] 问题标题

**状态**：<!-- Open / In Progress / Resolved / Closed -->
**创建时间**：2026-05-23
**标签**：<!-- bug / feature / refactor / investigation / testing -->
**优先级**：<!-- P0 / P1 / P2 / P3 -->

---

## 问题描述

<!-- 用户遇到的具体问题，或测试中发现的具体缺陷。附截图路径：imgs/V2-XX_1.png -->

---

## 复现步骤

1.
2.
3.

---

## 相关代码

```
// 涉及的关键代码片段
```

---

## 根因分析

<!-- 经过分析后，找到的真正原因 -->

---

## 问题列表（Q&A 迭代）

### Q1: ...
**A1**: ...

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 1 Build Gate | `pnpm type-check && pnpm lint && pnpm test:unit` | Pass / Fail |
| Layer 2 Component | `pnpm test:unit --run` (组件测试) | Pass / Fail / N/A |
| Layer 3 Store | `pnpm test:unit --run` (Store 测试) | Pass / Fail / N/A |
| Layer 5 E2E | Playwright UC-X | Pass / Fail / N/A |

---

## 修复记录

### 2026-XX-XX

已完成以下修复：

1. `path/to/file.ts`
   - 具体改动说明

---

## 测试结果

```bash
# 类型检查
corepack pnpm -r exec vue-tsc --noEmit
# exit 0

# 构建验证
pnpm build
# exit 0
```

---

## 关闭备注

<!-- 问题已解决，关闭的原因或验证方式 -->
