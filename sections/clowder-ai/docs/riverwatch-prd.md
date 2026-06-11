# RiverWatch 河流水质数据看板 — 产品需求文档 (PRD)

> **版本**: v1.0
> **日期**: 2025-01-09
> **状态**: 初稿
> **作者**: RiverWatch PM 769358/罗罗

---

## 1. 项目概述

### 1.1 背景
RiverWatch 是一个面向环保监测人员、政府水务部门及公众的河流水质数据可视化看板项目。通过直观的图表和实时状态展示，帮助用户快速掌握各监测站点的水质状况，及时发现异常并做出响应。

### 1.2 目标
- 提供清晰、直观的水质数据可视化界面
- 支持多站点对比和趋势分析
- 优先保证移动端可读性，同时适配桌面端
- 零后端依赖，纯前端静态部署

### 1.3 用户画像
| 用户类型 | 需求 | 使用场景 |
|---------|------|---------|
| 环保监测员 | 查看实时数据、发现异常站点 | 日常巡检、应急响应 |
| 水务管理人员 | 整体概览、趋势分析 | 汇报、决策支持 |
| 公众用户 | 了解附近河流水质 | 随手查询、环保意识 |

---

## 2. 功能需求

### 2.1 核心功能模块

#### 2.1.1 站点总览卡片 (Dashboard Cards)
- 展示所有监测站点的缩略信息
- 每个卡片显示：站点名称、综合状态（优/良/差/危险）、最后更新时间
- 支持按状态筛选（全部/正常/警告/危险）
- 点击卡片进入站点详情

#### 2.1.2 站点详情页 (Station Detail)
- **当前数值面板**：pH、溶解氧(DO)、浊度、氨氮 四项指标的当前值
- **状态指示灯**：每项指标用颜色标识（绿/黄/橙/红）
- **24小时趋势图**：折线图展示各项指标过去24小时变化
- **指标说明**：每项指标的国标参考范围和当前评级

#### 2.1.3 数据对比页 (Comparison)
- 多站点指标对比（最多4个站点）
- 雷达图展示各站点综合水质评分
- 表格形式对比具体数值

#### 2.1.4 趋势分析页 (Trends)
- 时间范围选择：24小时 / 7天 / 30天
- 单指标多站点趋势对比
- 支持导出图表（PNG）

### 2.2 水质指标定义

| 指标 | 单位 | 国标范围 | 数据来源 |
|------|------|---------|---------|
| pH | 无量纲 | 6.5 - 8.5 | 模拟数据 |
| 溶解氧 (DO) | mg/L | ≥ 5.0 | 模拟数据 |
| 浊度 | NTU | ≤ 10 | 模拟数据 |
| 氨氮 | mg/L | ≤ 0.5 (Ⅰ类) / ≤ 1.0 (Ⅱ类) | 模拟数据 |
| 站点状态 | 枚举 | 优/良/轻度污染/中度污染/重度污染 | 综合计算 |

### 2.3 状态评级规则

```
综合状态计算逻辑：
- 所有指标正常 → 优 (绿色)
- 1项指标警告 → 良 (蓝色)
- 2项指标警告 或 1项危险 → 轻度污染 (黄色)
- 3项指标警告 或 2项危险 → 中度污染 (橙色)
- ≥3项危险 或 pH<5 或 pH>9.5 → 重度污染 (红色)
```

---

## 3. 数据需求

### 3.1 模拟数据规范

#### 站点列表 (6个站点)
```javascript
const stations = [
  { id: 'st-001', name: '长江大桥监测点', lat: 30.59, lng: 114.30, region: '武昌区',
    status: 'excellent',
    metrics: { ph: 7.4, dissolvedOxygen: 8.2, turbidity: 4, ammoniaNitrogen: 0.12 } },
  { id: 'st-002', name: '汉江入江口', lat: 30.57, lng: 114.27, region: '汉阳区',
    status: 'good',
    metrics: { ph: 7.1, dissolvedOxygen: 6.8, turbidity: 8, ammoniaNitrogen: 0.35 } },
  { id: 'st-003', name: '东湖出口', lat: 30.55, lng: 114.37, region: '洪山区',
    status: 'mild',
    metrics: { ph: 6.3, dissolvedOxygen: 4.5, turbidity: 15, ammoniaNitrogen: 0.65 } },
  { id: 'st-004', name: '府河上游', lat: 30.72, lng: 114.22, region: '黄陂区',
    status: 'moderate',
    metrics: { ph: 5.8, dissolvedOxygen: 3.2, turbidity: 35, ammoniaNitrogen: 1.2 } },
  { id: 'st-005', name: '南湖中心', lat: 30.50, lng: 114.35, region: '洪山区',
    status: 'mild',
    metrics: { ph: 7.8, dissolvedOxygen: 5.2, turbidity: 12, ammoniaNitrogen: 0.55 } },
  { id: 'st-006', name: '汤逊湖入口', lat: 30.45, lng: 114.40, region: '江夏区',
    status: 'severe',
    metrics: { ph: 4.2, dissolvedOxygen: 1.5, turbidity: 65, ammoniaNitrogen: 3.8 } }
];
```

#### 数据生成规则
- 当前数据：基于基准值 ± 随机波动
- 历史数据：30天 × 6站点 × 4指标 = 720个数据点
- 更新频率：模拟每5分钟刷新一次
- 异常注入：各站点预设不同状态（excellent/good/mild/moderate/severe），覆盖所有场景

### 3.2 数据结构

```typescript
interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  status: 'excellent' | 'good' | 'mild' | 'moderate' | 'severe';
  lastUpdate: string;
  metrics: Metrics;
}

interface Metrics {
  ph: number;        // 6.5 - 8.5
  dissolvedOxygen: number;  // mg/L
  turbidity: number; // NTU
  ammonia: number;   // mg/L
}

interface HistoricalData {
  stationId: string;
  timestamp: string;
  metrics: Metrics;
}
```

---

## 4. 界面需求

### 4.1 页面结构

```
/                    → 站点总览 (首页)
/station/:id         → 站点详情
/compare             → 数据对比
/trends              → 趋势分析
/about               → 关于/指标说明
```

### 4.2 响应式断点

| 断点 | 宽度 | 布局 |
|------|------|------|
| Mobile | < 640px | 单列卡片，底部导航 |
| Tablet | 640-1024px | 双列卡片，侧边导航 |
| Desktop | > 1024px | 三列卡片，顶部导航 |

### 4.3 设计规范

#### 色彩系统
```
主色：#0EA5E9 (sky-500) — 水主题
辅色：#0284C7 (sky-600)
背景：#F0F9FF (sky-50) / #FFFFFF
文字：#0F172A (slate-900) / #64748B (slate-500)

状态色：
- 优/正常：#10B981 (emerald-500)
- 良/警告：#F59E0B (amber-500)
- 轻度污染：#F97316 (orange-500)
- 中度污染：#EF4444 (red-500)
- 重度污染：#7F1D1D (red-900)
```

#### 字体
- 中文：系统默认 (PingFang SC, Microsoft YaHei)
- 数字：等宽字体 (ui-monospace, SFMono-Regular)
- 标题：18-24px / 正文：14-16px / 辅助：12px

---

## 5. 技术需求

### 5.1 技术栈
- **框架**: Vue 3 (Composition API)
- **构建**: 无构建步骤，CDN 引入
- **样式**: Tailwind CSS (CDN)
- **图表**: Chart.js (CDN)
- **图标**: Heroicons / 内联 SVG
- **路由**: Vue Router (CDN, hash 模式)

### 5.2 CDN 依赖
```html
<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
<script src="https://unpkg.com/vue-router@4/dist/vue-router.global.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

### 5.3 性能要求
- 首屏加载 < 3秒 (3G网络)
- 图表渲染 < 1秒
- 支持离线缓存 (Service Worker 可选)

---

## 6. 项目交付物

| # | 交付物 | 格式 | 负责人 |
|---|--------|------|--------|
| 1 | 产品需求文档 (PRD) | Markdown | PM |
| 2 | 预算与排期表 | Markdown/表格 | PM |
| 3 | 项目汇报 PPT | SVG/HTML | 蓝蓝→安安→森森 |
| 4 | Vue 前端技术 README | Markdown | 波波 |
| 5 | 可预览 Vue CDN 单页面 | HTML | 波波 |
| 6 | Preview 部署链接 | URL | 波波 |

---

## 7. 验收标准

### 7.1 功能验收
- [ ] 6个站点数据正常显示
- [ ] 各项指标数值和状态正确计算
- [ ] 24小时趋势图正常渲染
- [ ] 站点筛选功能正常
- [ ] 多站点对比功能正常
- [ ] 移动端触摸操作流畅

### 7.2 视觉验收
- [ ] 符合设计规范色彩系统
- [ ] 移动端优先，各断点布局正确
- [ ] 图表清晰可读，数据标签完整
- [ ] 加载状态和空状态处理

### 7.3 技术验收
- [ ] 纯 CDN 引入，无构建依赖
- [ ] 单 HTML 文件可直接打开
- [ ] 无控制台报错
- [ ] 模拟数据完整覆盖所有场景

---

## 8. 风险与假设

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 模拟数据不够真实 | 中 | 基于真实国标范围生成，注入合理波动 |
| 移动端图表可读性 | 中 | 优先设计移动端，Chart.js 响应式配置 |
| CDN 可用性 | 低 | 使用 unpkg/jsdelivr 双 CDN |
| PPT 制作周期长 | 中 | 提前启动，并行执行 |

---

## 9. 附录

### 9.1 参考标准
- GB 3838-2002 《地表水环境质量标准》
- HJ/T 96-2003 《pH 水质自动分析仪技术要求》

### 9.2 术语表
- **DO**: Dissolved Oxygen，溶解氧
- **NTU**: Nephelometric Turbidity Unit，浊度单位
- **氨氮**: 水中以游离氨(NH3)和铵离子(NH4+)形式存在的氮

---

> 本文档为 RiverWatch 项目的单一真相源 (Single Source of Truth)。所有设计、开发和交付工作应以此文档为准。
