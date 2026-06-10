---
feature_ids: [F214]
related_features: [F063, F131, F190]
topics: [maomi, workspace, 项目群, frontend, navigation, ui]
doc_kind: spec
created: 2026-06-02
---

# F214: 项目群管理前端页面 — Maomi Workspace UI

> **Status**: spec | **Owner**: 波斯猫 (@bobo, 前端) | **Priority**: P1 | **PM**: 暹罗猫 (@luoluo)

## Why

### 用户痛点

铲屎官在 IM 里说"随便创建一个项目群，名字叫测试群"——PM 通过 `POST /api/maomi-workspaces` 两秒就建好了。但铲屎官接着问："我看不到入口"。

**真相**：maomi workspace 后端 API（`POST/GET /api/maomi-workspaces`）早已可运行，但**前端没有任何页面、导航入口或管理界面**。用户只能通过 curl/API 创建和查看，Console 里完全不可见。

### 终态愿景

铲屎官在 Console 左侧 ActivityBar 点「项目群」图标 → 看到所有 workspace 列表 → 可以直接创建、查看、管理项目群。不需要 PM 代劳建群，不需要 curl。

## What

### 范围

**最小可交付（MVP）**：一个可用的项目群列表页 + 侧边栏入口 + 创建表单。

### 子模块

#### M1: 导航入口

- 在 ActivityBar 的 `NAV_ITEMS` 中增加 `{ id: 'workspaces', path: '/workspaces', label: '项目群', match: (p) => p.startsWith('/workspaces') }`
- 新增图标组件 `WorkspacesIcon`（可用文件夹/群组风格的 SVG 图标）
- 图标加入 `ICON_MAP`

#### M2: 项目群列表页

- 路由：`/workspaces`
- 页面位置：`packages/web/src/app/workspaces/page.tsx`
- 调用 `GET /api/maomi-workspaces` 获取当前用户的所有 workspace
- 展示字段：
  - `displayName`（显示名称，如"测试群"）
  - `slug`（唯一标识）
  - `createdAt`（创建时间，格式化为可读日期）
  - `status`（状态标记，如 `active` 显示绿色圆点）
  - `linkedThreadIds.length`（关联 thread 数）
- 列表项可点击，跳转到详情页
- 空态：尚无项目群时，显示引导文案 + 「创建项目群」按钮

#### M3: 创建项目群

- 入口：列表页顶部「+ 新建项目群」按钮
- 表单：
  - `displayName`（必填，中文名，如"测试群"）— 输入框
  - `slug`（必填，自动从 displayName 生成拼音建议或用户手动输入，校验规则 `[a-z0-9][a-z0-9._-]{0,62}`）
  - 提交调 `POST /api/maomi-workspaces`
- 成功 → 刷新列表，新 workspace 出现在列表顶部
- 失败 → 显示错误提示（如 slug 重复）

#### M4: 项目群详情页（可选 / 后续迭代）

- 路由：`/workspaces/[slug]`
- 显示 workspace 基本信息 + linked threads 列表
- 可以绑定/解绑 thread

### 不做（非 MVP）

- 项目群内文件浏览器（可复用 F131 Workspace Panel 组件，后续迭代）
- 项目群归档/删除
- 项目群成员管理
- 项目群设置

### Architecture cell

- Frontend cell: `packages/web/src/app/workspaces/`（新目录）
- Navigation: `packages/web/src/components/ActivityBar.tsx`（NAV_ITEMS 追加）
- API 已就绪：`GET/POST /api/maomi-workspaces`（无需后端改动）

## Acceptance Criteria

| # | 验收标准 |
|---|---------|
| AC1 | Console 左侧 ActivityBar 出现「项目群」图标，点击跳转 `/workspaces` |
| AC2 | 列表页正确展示所有已创建的 workspace（含已存在的"测试群"和"2号群"） |
| AC3 | 可以通过「新建项目群」按钮打开创建表单，填写 displayName + slug 后成功创建 |
| AC4 | slug 校验：输入非法字符时给出明确提示（只允许 `[a-z0-9._-]`，首字符必须字母或数字） |
| AC5 | 空态：无 workspace 时显示引导提示而非空白页 |
| AC6 | 响应式：在手机/窄屏下页面可用（列表不溢出，表单布局合理） |
| AC7 | 加载态和错误态：API 加载中显示 loading，API 失败显示错误信息 + 重试按钮 |

## Risks & Dependencies

| 风险 | 缓解 |
|------|------|
| 前端不熟悉 maomi workspace API | API 已完整可用，文档见 `packages/api/src/routes/maomi-workspaces.ts` |
| slug 拼音自动生成可能不准确 | MVP 阶段让用户手动输入 slug，拼音生成作为后续优化 |
| 项目群详情页 scope 不明确 | M4 标记为可选，先做列表+创建打通闭环 |

## Deliverables

- [ ] M1: ActivityBar 导航入口 + WorkspacesIcon
- [ ] M2: `/workspaces` 列表页（含空态、加载态、错误态）
- [ ] M3: 创建项目群表单
- [ ] M4: 项目群详情页（可选）
