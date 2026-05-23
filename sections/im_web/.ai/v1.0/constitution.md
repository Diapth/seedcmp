<!--
[SYNC IMPACT REPORT]
- Version Change: 1.1.0 -> 1.2.0
- Ratification Date: 2026-05-21
- Modified Principles:
  - 2. 界面美学与原生 CSS Module 限制 (从复杂的毛玻璃光晕 -> 升级为利落高雅的极简主义设计系统)
- Added Sections: None
- Removed Sections: None
- Templates requiring updates: None
- Follow-up TODOs: 无
-->

# TangSengDaoDaoWeb Vue 重构宪法 (Constitution)

> **版本**: 1.2.0  
> **Ratification Date**: 2026-05-21  
> **Last Amended Date**: 2026-05-21  
> **定位**: 基于 Vue 3 Monorepo 的前端极简重构与美学升级宪法

---

## 1. Monorepo 与多包模块化隔离原则

重构 Vue 3 版本时，必须严守原 React 版的 Monorepo 高度模块化包管理逻辑，严禁合并或打破依赖方向：

- **禁止架构杂糅**: 必须保持 `@tsdaodao/base-vue` (底座及消息注册)、`@tsdaodao/login-vue` (登录)、`@tsdaodao/contacts-vue` (联系人) 和 `@tsdaodao/datasource-vue` (数据源同步) 的多包隔离。
- **严格依赖方向**: `login-vue`、`contacts-vue`、`datasource-vue` 必须单向依赖 `base-vue`，绝不允许发生循环依赖。
- **状态总线规范**: 原 React 版由虚拟机（VM）手动触发 `notifyListener()` 触发重绘的方式，在 Vue 3 中统一以 **Pinia Store** 替代。数据源处理和 SDK 同步逻辑收拢在 `datasource-vue` 包下的 Store 中，页面组件仅负责数据消费与 UI 渲染。

---

## 2. 纯净高效的极简主义设计系统 (Minimalist Design System)

鉴于原版 UI 风格陈旧且视觉繁杂，重构版采用极致纯净、高效克制的极简主义（Minimalism）风格作为美学底座，去除一切视觉噪音：

- **极简双色色卡 (Minimalist Monochrome)**: 
  - **浅色模式**: 纯白底色 (`#FFFFFF`) 搭配极淡的灰色背景 (`#F7F7F9`) 作为内容区分。
  - **深色模式**: 高雅纯净的炭黑色 (`#121212`) 搭配轻灰底色 (`#1E1E1E`)。
- **极细 1px 描边 (Hairline Border)**: 去除所有复杂的毛玻璃、阴影与渐变晕光。面板及输入框仅通过一像素极细线条 (`#ECECEF` / `#2C2C2E`) 进行物理分割，极致扁平、克制。
- **高对比无衬线排版**: 引入 `Inter` 或系统默认无衬线字体。使用深邃黑 (`#111111` 或深色下的 `#F5F5F7`) 作为正文字体，搭配中灰色 (`#7A7A80`) 作为状态描述，以超高留白比（Negative Space）实现信息自然透气。
- **轻微即时动效 (Instant Transition)**: 移除复杂的弹性动画。所有悬停与切换采用极短的 `transition: all 0.15s ease`，追求无感开闭与极致效率，做到干脆利落。
- **严格样式隔离 (CSS Modules)**: 组件样式必须使用 `scoped` 样式或 CSS Modules 隔离，**不引入 TailwindCSS**，确保样式表绝对纯净。
- **无 placeholder 原则**: 对任何涉及个人、群组头像的图片资源，在加载失败或未设置时，必须通过 `ChannelAvatar` 动态绘制出精美的渐变色字符背板或专属 SVG 头像徽章，绝不允许使用普通的占位图。

---

## 3. wukongimjssdk 事件劫持与消息响应式规范

- **状态管理主权**: 所有的 `WKSDK.shared()` 的事件监听（包含 `addMessageListener`, `addCMDListener`, `channelInfoListener` 等）均必须且只能在 `datasource-vue` 的 Pinia Store 顶级周期中注册和劫持。严禁在具体的 Vue 3 组件页面中私自挂载 SDK 的全局监听器，防止多实例监听和连接状态漂移。
- **CMD 消息处理原子化**: 所有的控制命令消息（如 `messageRevoke`, `unreadClear`）捕获后必须在 Store 中完成对消息和会话链的增删改属性修改，UI 层必须基于 Vue 的 `ref` / `reactive` 进行自动化响应式渲染，保持数据流的唯一可信源。
