# TangSengDaoDaoWeb Vue 3 重构攻坚备忘录 (Questions & Risk Register)

本文件作为重构开发过程中的技术备忘与潜在阻碍排查指南。

---

## 1. 工程与打包适配 (Vite & SDK)

### Q1.1: `wukongimjssdk` 的 ESM (Vite) 模块化打包兼容性
- **问题描述**: WuKongIM 官方 JS-SDK 的旧版本在发布到 NPM 时，可能存在 CommonJS 与 ESM 混合导出的现象。在 Vite 执行依赖预构建 (Dependency Pre-Bundling) 时可能会因为 `require` 语法发生报错。
- **已确认结论**: 原 React 项目使用的 SDK 版本为 `wukongimjssdk@^1.2.11`，采用标准 ES Module `import { WKSDK, Channel, Message } from "wukongimjssdk"` 导入方式，与 Vite 的 ESM 原生支持兼容。但仍需在初始化脚手架后实测 `vite dev` 热更新是否正常。
- **应对**: 若出现问题，在 `vite.config.ts` 中配置 `optimizeDeps.include: ['wukongimjssdk']`。

---

## 2. API 与环境联调 (API & Local Server)

### ~~Q2.1: 后端本地接口的跨域 (CORS) 与代理配置~~ ✅ 已解决
- **已确认结论**: 后端 `main.go` 第 92-103 行已**全局注册** CORS 中间件，设置了 `Access-Control-Allow-Origin: *`，允许所有域名跨域请求。允许的 Header 包含 `token`。**前端无需配置 Vite proxy 代理**，可直接在 Axios 中请求 `http://127.0.0.1:8090/v1/`。
- **源码出处**: [main.go#L92-L103](file:///media/leng/DiskB1/exp/seedcmp/sections/im/TangSengDaoDaoServer/main.go#L92-L103)

### ~~Q2.2: 测试账号与短信网关验证码的全局硬编码~~ ✅ 已解决
- **已确认结论**: 后端配置文件 `configs/tsdd.yaml` 第 9 行写死 `smsCode: "123456"`。当该配置值不为空时，Go 服务端对**所有手机号**统一校验该固定验证码，不走线上短信网关。**任意手机号 + `123456` 均可登录**，无需绑定特定测试账号。
- **源码出处**: [user/api.go#L1248-L1252](file:///media/leng/DiskB1/exp/seedcmp/sections/im/TangSengDaoDaoServer/modules/user/api.go#L1248-L1252)，[configs/tsdd.yaml#L9](file:///media/leng/DiskB1/exp/seedcmp/sections/im/TangSengDaoDaoServer/configs/tsdd.yaml#L9)

---

## 3. UI 规范与视觉覆写 (UI Override)

### Q3.1: Arco Design Vue 的极简主义美学全局覆写
- **问题描述**: 为了实现极简主义（一像素描边、无阴影、大留白），我们需要引入 `Arco Design Vue` 作为模态框和抽屉的骨架，但 Arco 默认带有较大的渐变阴影和阴影层级。
- **已确认结论**: 这不是一个"不确定问题"，而是一项确定性的实施工作。需要在全局 `index.css` 中使用 Arco 的 CSS 变量进行深度覆写清洗。
- **应对** (确定性实施方案):
  ```css
  body {
    --color-bg-1: var(--bg-primary);
    --color-bg-2: var(--bg-secondary);
    --color-border: var(--border-color);
    --shadow-none: none;
    --border-radius-medium: 2px;
  }
  .arco-modal, .arco-drawer, .arco-popover-content {
    box-shadow: none;
    border: var(--border-hairline);
  }
  ```

---

## 4. 业务边界与特殊格式 (Media & Voice)

### Q4.1: 语音消息格式与 HTML5 Audio 编码适配
- **问题描述**: 尽管排除音视频实时呼叫，但"收发语音消息"属于基础聊天 FR-005 的气泡逻辑。
- **已确认结论**: 原 React 项目中 `Messages/Voice/index.tsx` 从 `wukongimjssdk` 导入 `MediaMessageContent` 进行语音消息解析和播放，语音文件通过后端 `/v1/file/upload` 上传、`/v1/file/preview/*` 下载。浏览器端 `<audio>` 元素播放服务端返回的音频流即可，格式由移动端录制决定（通常为 `.amr` 或 `.mp3`），Web 端仅做"播放"不做"录制"。
- **应对**: Web 端仅需实现语音消息的播放 UI（进度条+时长标签），不实现浏览器端录音功能。若将来需要录音，再引入 `MediaRecorder` API。

---

## 5. 原版架构特征观察 (Kickout 与连接状态机)

### Q5.1: 原版 Kickout 处理方式确认 ✅ 已确认
- **已确认结论**: 原 React 版 `App.tsx` 第 304-322 行中，通过 `WKSDK.shared().connectManager.addConnectStatusListener` 监听连接状态，当状态为 `ConnectStatus.ConnectKick` 或 `reasonCode == 2`（认证失败）时，直接调用 `WKApp.shared.logout()` → 清除本地 token → `window.location.reload()` 强制刷新。
- **Vue 3 改造**: 我们在 `specify.md` 中已约定不采用硬刷新，而是使用**半透明灰色遮罩 + 极简浮窗**的温和方式。在 `datasource-vue` 的 SDK 连接状态监听回调中，将 Kickout 事件映射为 Pinia 全局状态 `isKickedOut: true`，由 `App.vue` 的顶层条件渲染 `<KickoutOverlay />` 组件。

### Q5.2: 原版远程配置（撤回时间等）的拉取机制 ✅ 已确认
- **已确认结论**: 原 React 版 `WKRemoteConfig` 类（App.tsx 第 70-95 行）在启动时请求 `GET /v1/common/appconfig` 获取 `revoke_second`（默认 120 秒），并采用指数退避（3s, 6s, 12s...）重试策略。
- **Vue 3 实施**: 在 `base-vue` 中封装 `useRemoteConfig()` composable，登录后立即拉取，将 `revokeSecond` 存入 Pinia Store 供消息撤回 UI 判断（超时自动隐藏右键菜单选项）。
