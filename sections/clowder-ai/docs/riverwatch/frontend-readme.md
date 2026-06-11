# RiverWatch 前端技术说明

> 本文档面向前端开发者，说明 RiverWatch 河流水质数据看板的技术栈、项目结构、本地运行方式及浏览器兼容要求。
>
> 对应产品文档：`riverwatch-prd.md`
> 对应入口文件：`riverwatch-dashboard.html`

---

## 1. 技术栈

本项目为**单 HTML 文件前端应用**，无构建步骤，所有依赖通过 CDN 引入。

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | Vue 3 (Global Build) | 3.4+ | 响应式 UI 与组件化逻辑 |
| API 风格 | Vue Composition API | - | `setup()` + `ref` / `computed` / `onMounted` |
| 路由 | Vue Router 4 | 4.x | hash 模式单页路由 |
| 样式 | Tailwind CSS (CDN) | 3.x | 原子化 CSS 样式 |
| 图表 | Chart.js | 4.x | 趋势图、雷达图 |
| 图标 | Heroicons (内联 SVG) | - | 页面图标 |
| 数据 | 静态 Mock JSON | - | 当前版本无后端，数据在脚本内生成 |

---

## 2. 项目结构

```
docs/
├── riverwatch-dashboard.html   # 唯一的前端入口文件（单页应用）
├── riverwatch-prd.md           # 产品需求文档
├── riverwatch-budget-schedule.md # 预算排期表
└── frontend-readme.md          # 本文件
```

当前前端实现为**单文件架构**：

- **HTML**：应用外壳与语义化结构
- **`<style>`**：内联关键 CSS + 状态色系统 + 骨架屏动画
- **`<script>`**：Vue 3 应用逻辑、Vue Router 路由、Mock 数据生成、Chart.js 图表初始化
- **CDN 资源**：Vue 3、Vue Router、Tailwind CSS、Chart.js 均通过 CDN 引入

### 页面路由

| 路由 | 页面组件 | 功能 |
|------|---------|------|
| `/` | DashboardPage | 站点总览卡片 + 状态筛选 |
| `/station/:id` | StationDetailPage | 站点详情 + 指标卡片 + 趋势图 |
| `/compare` | ComparePage | 多站点对比（雷达图 + 表格） |
| `/trends` | TrendsPage | 趋势分析（时间范围 + 多站点对比） |

### 关键模块说明

| 模块 | 位置/标识 | 说明 |
|------|-----------|------|
| 阈值配置 | `THRESHOLDS` | pH、溶解氧、浊度、氨氮的正常/警告/危险阈值 |
| 状态映射 | `STATUS_MAP` | 五级状态（优/良/轻度/中度/重度）的样式映射 |
| 状态计算 | `calculateOverallStatus()` | 根据四项指标综合计算站点状态 |
| Mock 数据生成 | `generateMockData()` | 生成 6 个武汉站点 + 每个站点 30 天历史数据 |
| 图表渲染 | `initChart()` / `initRadarChart()` / `initTrendChart()` | 使用 Chart.js 渲染各类图表 |
| 自动刷新 | `setInterval(refreshData, 300000)` | 每 5 分钟模拟刷新一次数据 |

---

## 3. 本地预览方式

### 方式一：直接打开 HTML 文件（最简单）

```bash
# macOS
open docs/riverwatch-dashboard.html

# Windows
start docs/riverwatch-dashboard.html

# Linux
xdg-open docs/riverwatch-dashboard.html
```

### 方式二：使用本地静态服务器（推荐）

由于 Vue Router hash 模式在 `file://` 协议下可能有限制，建议使用本地 HTTP 服务器：

```bash
# 使用 Python 3
cd docs
python -m http.server 8080

# 或使用 Node.js 的 npx serve
cd docs
npx serve -p 8080

# 或使用 VS Code 的 Live Server 插件
```

然后在浏览器中访问：

```
http://localhost:8080/riverwatch-dashboard.html
```

### 方式三：开发容器 / CI 中验证

```bash
# 无头模式检查页面可访问性（示例）
npx playwright-core open http://localhost:8080/riverwatch-dashboard.html
```

---

## 4. CDN 依赖清单

| 资源 | URL | 加载方式 | 用途 |
|------|-----|----------|------|
| Vue 3 Global | `https://unpkg.com/vue@3/dist/vue.global.js` | 同步 `<script>` | 核心框架 |
| Vue Router 4 | `https://unpkg.com/vue-router@4/dist/vue-router.global.js` | 同步 `<script>` | 路由管理 |
| Tailwind CSS | `https://cdn.tailwindcss.com` | 同步 `<script>` | 样式框架 |
| Chart.js | `https://cdn.jsdelivr.net/npm/chart.js` | 同步 `<script>` | 图表库 |

### 性能说明

- **关键 CSS 内联**：首屏样式直接写在 `<style>` 中，避免渲染阻塞
- **骨架屏**：`#skeleton-screen` 在 Vue 挂载前显示，提升 perceived performance
- **单文件架构**：零构建步骤，无打包产物，适合静态部署

### CDN 可用性建议

生产环境部署时，建议配置**本地 fallback**或备用 CDN，以应对 CDN 不可用的风险。参考 `riverwatch-prd.md` 风险缓解措施：

> CDN 资源加载失败 → 使用多个 CDN 源，添加本地 fallback

---

## 5. 浏览器兼容说明

### 支持范围

根据 `riverwatch-prd.md` 第 6.3 节：

| 浏览器 | 最低版本 |
|--------|----------|
| Chrome | 90+ |
| Safari | 14+ |
| Firefox | 88+ |
| Edge | 90+ |

### 兼容性要点

- **Vue 3**：要求支持 ES2015+ 的浏览器；Vue 3.4 兼容 Chrome 60+、Firefox 60+、Safari 12+
- **Vue Router 4**：依赖 History API，hash 模式兼容性更好
- **Chart.js 4**：依赖 `requestAnimationFrame` 和 CSS3 transform；兼容 IE11+（本项目无需支持 IE）
- **Tailwind CSS**：依赖 CSS 自定义属性（`var(--xxx)`）和 Flexbox/Grid
- **CSS 特性使用**：
  - CSS Grid（`grid-template-columns`）
  - Flexbox
  - CSS 自定义属性（`var(--xxx)`）
  - `env(safe-area-inset-bottom)`（适配刘海屏）
- **移动端适配**：
  - viewport 设置为 `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`
  - 使用 `-webkit-tap-highlight-color: transparent` 移除点击高亮
  - 触摸目标最小尺寸符合 44×44pt 要求

### 不推荐使用的浏览器

- Internet Explorer（任何版本）
- Chrome < 90 / Safari < 14 / Firefox < 88 / Edge < 90

---

## 6. 开发注意事项

1. **不要引入构建工具**：当前架构 intentionally 保持零构建，新增依赖请优先使用 CDN 版本
2. **保持单文件**：新增功能应尽量在 `riverwatch-dashboard.html` 内完成；若文件超过 350 行，考虑按功能拆分，但需经 PM 确认
3. **颜色统一**：状态色必须使用 `STATUS_MAP` 中定义的值，确保与 PRD 验收标准一致
4. **Mock 数据修改**：调整 `generateMockData()` 即可；注意保持五种状态（优/良/轻度/中度/重度）均有覆盖
5. **图表销毁**：页面切换时 Chart.js 实例会自动销毁，避免内存泄漏
6. **路由使用 hash 模式**：确保在静态文件服务器上正常工作

---

## 7. 常见问题

### Q: 页面打开后白屏？

1. 检查网络是否能访问 `unpkg.com` 和 `cdn.jsdelivr.net`
2. 确认不是通过 `file://` 协议直接打开（某些浏览器会拦截 CDN 脚本）；改用本地 HTTP 服务器
3. 打开浏览器 DevTools → Console 查看 Vue 或 Chart.js 加载错误

### Q: 图表不显示？

- 检查 Chart.js 是否成功加载（Network 面板）
- 确认 canvas 元素有明确的宽高设置
- 若长时间无图表，检查 Console 是否有 Chart.js 相关错误

### Q: 路由切换不工作？

- 确保使用本地 HTTP 服务器（非 `file://` 协议）
- Vue Router hash 模式需要在服务器环境下才能正常工作

### Q: 如何修改刷新频率？

- 在 `onMounted` 中修改 `setInterval(refreshData, 300000)` 的第二个参数（单位：毫秒）

---

*文档版本: v2.0 | 维护者: 波波（前端工程师）*
