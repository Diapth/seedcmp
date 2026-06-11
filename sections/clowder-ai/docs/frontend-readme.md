# RiverWatch 前端技术 README

> 项目：RiverWatch 河流水质数据看板
> 技术方案：Vue 3 CDN 单页面应用
> 最后更新：2025-06-11

---

## 1. 技术栈

| 技术 | 版本 | 用途 | 引入方式 |
|-----|------|------|---------|
| Vue | 3.x | 前端框架 | CDN (`unpkg.com/vue@3`) |
| Tailwind CSS | 3.x | 样式框架 | CDN (`cdn.tailwindcss.com`) |
| Fetch API | 原生 | 数据获取 | 浏览器内置 |

**无构建工具、无打包、无 Node.js 依赖** —— 单个 HTML 文件可直接在浏览器中打开运行。

---

## 2. 项目结构

```
riverwatch/
├── riverwatch-dashboard.html    # 主应用（单页面）
├── riverwatch-prd.md            # 产品需求文档
├── riverwatch-budget.md         # 预算与排期表
└── riverwatch-frontend-readme.md # 本文档
```

---

## 3. 快速开始

### 3.1 本地运行

**方式一：直接打开**
```bash
# 用浏览器直接打开 HTML 文件
open riverwatch-dashboard.html        # macOS
xdg-open riverwatch-dashboard.html    # Linux
start riverwatch-dashboard.html       # Windows
```

**方式二：本地服务器（推荐，避免 CORS 限制）**
```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .

# 然后访问 http://localhost:8080/riverwatch-dashboard.html
```

### 3.2 在线预览

- **GitHub Pages**: `https://<username>.github.io/riverwatch/riverwatch-dashboard.html`
- **Vercel**: 导入 GitHub 仓库自动部署

---

## 4. 数据规范

### 4.1 数据源
- **来源**: USGS National Water Information System (NWIS)
- **API**: Instantaneous Values Service
- **站点**: 01304562 (PECONIC RIVER at COUNTY HWY 105 at RIVERHEAD, NY)

### 4.2 API 端点
```
GET https://waterservices.usgs.gov/nwis/iv/
  ?format=json
  &sites=01304562
  &parameterCd=00010,00095,00300,00400,63680,00608,00610
  &siteStatus=all
```

### 4.3 参数码对照

| 参数码 | 名称 | 单位 | 类型 |
|-------|------|------|------|
| 00400 | pH 值 | — | 主要指标 |
| 00300 | 溶解氧 | mg/L | 主要指标 |
| 63680 | 浊度 | NTU | 主要指标 |
| 00608 | 氨氮 | mg/L | 主要指标（优先） |
| 00610 | 氨氮 (alt) | mg/L | 主要指标（备用） |
| 00010 | 水温 | °C | 辅助指标 |
| 00095 | 比电导率 | μS/cm | 辅助指标 |

### 4.4 数据真实性约束 ⚠️

**硬性规则**（不可违反）：
1. ✅ 所有展示数据必须来自 USGS NWIS API 实时响应
2. ✅ API 返回 null / 缺失时显示 "N/A"
3. ✅ API 未返回某参数时显示 "未返回" + 解释原因
4. ✅ 页面必须标注 "数据来源：USGS NWIS" 及最后更新时间
5. ❌ **禁止**使用 mock 数据、随机数、估算值、占位符
6. ❌ **禁止**在 API 失败时显示虚假数据
7. ❌ **禁止**对未返回的指标编造数值

---

## 5. 核心功能

### 5.1 实时数据展示
- 自动加载 USGS 站点最新监测数据
- 6 项水质指标卡片展示（4 主要 + 2 辅助）
- 数据更新时间戳

### 5.2 状态评估
| 指标 | 正常 | 预警 | 异常 |
|-----|------|------|------|
| pH | 6.5 - 8.5 | 6.0 - 6.5 或 8.5 - 9.0 | < 6.0 或 > 9.0 |
| 溶解氧 | ≥ 5.0 mg/L | 3.0 - 5.0 mg/L | < 3.0 mg/L |
| 浊度 | ≤ 5 NTU | 5 - 50 NTU | > 50 NTU |
| 氨氮 | ≤ 0.5 mg/L | 0.5 - 2.0 mg/L | > 2.0 mg/L |

### 5.3 错误处理
- **加载状态**: Shimmer 骨架屏
- **网络错误**: 友好提示 + 重试按钮
- **API 错误**: 显示 HTTP 状态码
- **超时**: 15 秒超时提示
- **缺失数据**: "N/A" 或 "未返回" + Tooltip 解释

### 5.4 移动端适配
- 响应式网格：单列（竖屏）→ 双列（横屏/平板）
- 触控友好：最小点击区域 44×44px
- 字体：基础 ≥ 14px
- 横竖屏切换支持

---

## 6. 浏览器兼容性

| 浏览器 | 最低版本 | 状态 |
|-------|---------|------|
| Chrome | 90+ | ✅ 支持 |
| Safari | 14+ | ✅ 支持 |
| Firefox | 88+ | ✅ 支持 |
| Edge | 90+ | ✅ 支持 |
| IE | — | ❌ 不支持 |

---

## 7. 性能指标

| 指标 | 目标 | 实际 |
|-----|------|------|
| 首屏加载 | ≤ 3 秒 | ~1.5 秒 (CDN 缓存) |
| API 响应 | ≤ 5 秒 | ~2-3 秒 (USGS) |
| 页面大小 | ≤ 500KB | ~15KB (HTML) |
| 无 JS 依赖大小 | — | Vue + Tailwind CDN |

---

## 8. 开发指南

### 8.1 添加新指标

在 `PARAMS` 对象中添加参数定义：

```javascript
const PARAMS = {
  // ... 现有参数
  'NEWCD': {
    name: '新指标',
    nameEn: 'New Indicator',
    unit: 'mg/L',
    icon: 'newicon',
    type: 'newtype'
  }
};
```

在 `buildIndicators()` 中添加到对应数组：

```javascript
const main = [
  // ... 现有指标
  makeInd('NEWCD'),
];
```

在 `evaluateStatus()` 中添加评估逻辑：

```javascript
case 'newtype':
  return value <= 10 ? 'normal' : value <= 50 ? 'warning' : 'danger';
```

### 8.2 修改站点

修改 `fetchData()` 中的 URL：

```javascript
const url = 'https://waterservices.usgs.gov/nwis/iv/?format=json'
  + '&sites=新站点编号'
  + '&parameterCd=参数码列表'
  + '&siteStatus=all';
```

同时更新页面中的站点名称显示。

### 8.3 自定义样式

Tailwind CSS 通过 CDN 引入，可直接在 HTML 中使用任意 Tailwind 类名。如需自定义配置，可添加 `<script>` 配置 Tailwind：

```javascript
tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary: '#2196F3',
      }
    }
  }
}
```

---

## 9. 部署

### 9.1 GitHub Pages

1. 将 `riverwatch-dashboard.html` 推送到 GitHub 仓库
2. 进入 Settings → Pages
3. Source 选择 Deploy from a branch → main / root
4. 访问 `https://<username>.github.io/<repo>/riverwatch-dashboard.html`

### 9.2 Vercel

1. 导入 GitHub 仓库到 Vercel
2. Framework Preset 选择 "Other"
3. 自动部署，访问 Vercel 提供的域名

### 9.3 本地文件

直接双击 HTML 文件即可在浏览器中打开（部分浏览器可能需要允许跨域）。

---

## 10. 常见问题

**Q: 为什么某些指标显示 "N/A" 或 "未返回"？**
A: USGS 站点并非始终提供所有参数。"N/A" 表示 API 返回了参数但值为空（传感器可能离线）；"未返回" 表示该站点根本不监测此项指标。这是真实数据限制，非 bug。

**Q: 数据更新频率是多少？**
A: USGS 即时值数据通常每 15-60 分钟更新一次，具体取决于站点配置。页面显示的是 API 返回的最新可用数据。

**Q: 可以切换其他 USGS 站点吗？**
A: 可以，修改 `fetchData()` 中的 `sites` 参数即可。需在 USGS 网站查询目标站点的编号和可用参数。

**Q: 为什么页面加载后数据为空？**
A: 可能是网络问题或 USGS API 暂时不可用。页面会显示错误提示，点击"重试"按钮即可重新获取。

---

## 11. 参考链接

- [USGS NWIS 即时值服务文档](https://waterservices.usgs.gov/rest/IV-Service.html)
- [USGS 参数码查询](https://help.waterdata.usgs.gov/parameter_cd?group_cd=%)
- [站点 01304562 信息页](https://waterdata.usgs.gov/nwis/inventory?site_no=01304562)
- [Vue 3 文档](https://vuejs.org/)
- [Tailwind CSS 文档](https://tailwindcss.com/)

---

*本文档由 RiverWatch PM 805883/罗罗 编制*
*最后更新：2025-06-11*
