# [ISSUE-XXX] 问题标题

**状态**：<!-- Open / In Progress / Resolved / Closed -->
**创建时间**：
**标签**：<!-- bug / feature / refactor / investigation -->

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
