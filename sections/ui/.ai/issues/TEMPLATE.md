# [ISSUE-XXX] 问题标题

**状态**：<!-- Open / In Progress / Resolved / Closed -->
**创建时间**：
**标签**：<!-- bug / feature / refactor / investigation -->
**AI修复模式**：<!-- Direct Fix / Plan First -->
**计划路径**：<!-- Direct Fix 写 N/A；Plan First 写 sections/ui/.ai/plans/ISSUE-XXX_xxx.md -->
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

**修复执行规则**：
- 若 `AI修复模式：Plan First`，先使用 `writing-plans` 写计划，计划无需用户确认直接实现。
- 若 `AI修复模式：Direct Fix`，可以直接修复，但必须使用 `tdd` 思路：先补/确认回归测试，再改实现，再验证。
- 若涉及前端页面、截图或交互验收，必须使用 `browser-preview` 或 Playwright 实测。
- 测试截图必须保存到 `seedcmp/sections/ui/.ai/tests-e2e/` 下，并按 issue 序号命名。
- 若遇到测试失败或行为不符合预期，使用 `debugging` / `systematic-debugging` 定位根因。
- 完成前使用 `verification-before-completion`，确认验证结果后再说完成。

---

## 问题描述

描述用户遇到的具体问题或你发现的问题。

(注：图片应以该issue的序号+图的序号标注，如02_1.png)
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

### Q2: ...
**A2**: ...

### Q3: ...
**A3**: ...

---

## 修复记录

### 2026-XX-XX

已完成以下修复：

1. `path/to/file.ts`
   - 具体改动说明

2. `path/to/another.ts`
   - 具体改动说明

---

## 测试结果

```bash
# 类型检查
corepack pnpm -r exec vue-tsc --noEmit
# exit 0

# 构建验证
./node_modules/.bin/vue-tsc --noEmit && ./node_modules/.bin/vite build apps/chat
# exit 0
```

---

## 关闭备注

<!-- 问题已解决，关闭的原因或验证方式 -->
