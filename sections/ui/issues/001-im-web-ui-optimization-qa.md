# QA Issue Log: IM Web UI Optimization

This document tracks all QA findings, visual test results, and 5-second recognition test evaluations for each implementation phase. It is the single source of truth for UI/UX issues raised against the AgentHub IM web client.

---

## Pending User Confirmation (阻塞项)

The following items require design specs / business decisions from the user before they can be closed. They are NOT bugs the agent can autonomously resolve — they encode a product / design choice.

- [ ] **`AppStatusBadge` 色盲友好**:是否需要在 online/busy/away 三色之外加 icon 辅助(目前仅靠颜色,红绿色盲难以区分)。需要设计稿确认。
- [ ] **`AgentCard` 6 种 tone 暗色变体色值**:目前仅交付状态色 token,具体 6 tone 的 dark 变体色值待设计稿补齐。位置:`components/agents/AgentCard.vue:175-213`。
- [ ] **危险操作(删除好友/踢人/加入黑名单)视觉权重规范**:目前已采用 `border: 1px solid var(--color-error)` + 文字 `var(--color-error)` 的中等危险信号,**但目标视觉权重(边框粗细、是否填充背景、是否要二次确认 toast)需要设计规范定夺**。
- [ ] **侧栏头像跳 profile → 归属模块**:目前 `profile/index.vue:onMounted` 调 `setActiveModule('settings')`,侧栏头像在 `DesktopSidebar.vue:4` 直接跳 `/pages/profile/index`。是归 `settings` 还是新增 `profile` 模块?需产品决策。
- [ ] **`勿扰模式` 变量名重构**:`pages/settings/index.vue:42-47` 的 `enableVibrate` 在勿扰开启时是 `false`(`toggleDoNotDisturb` 反向赋值)。变量命名与语义相反,需要确认是否重构为 `doNotDisturb: boolean`。
- [ ] **`chat/detail` 与 `chat/index` 桌面态同布局**:`/pages/chat/detail?id=X` 在桌面端渲染与 `/pages/chat/index` workbench 完全相同的 320px 列表 + 中间详情 + 右侧 pane。URL 切换无视觉反馈,是否需要 tab 切换过渡动画或差异化的 layout 标识?属于产品 URL 设计。
- [ ] **`specs/001-.../clarification-questions.md` 同步**:本 issue 表与 spec 文档的"待确认"清单目前是脱节的,需要在 spec 流程里同步标记。

---

## Phase Checkpoints & Status

| Phase | Viewports Tested | 5s Recognition Status | Active Issues | Verification Status |
|-------|------------------|-----------------------|---------------|---------------------|
| Phase 1: Setup | 375x844, 768x1024, 1024x768, 1440x900 | Passed (N/A for setup placeholder) | 0 | ✓ PASS |
| Phase 2: Foundational | 375x844, 768x1024, 1024x768, 1440x900 | Passed (N/A for foundation placeholder) | 0 | ✓ PASS |
| Phase 3: US1 MVP Shell | 375x844, 768x1024, 1024x768, 1440x900 | Passed | 0 | ✓ PASS |
| Phase 4: US2 Chat | 375x844, 768x1024, 1024x768, 1440x900 | Passed | 0 | ✓ PASS |
| Phase 5: US3 Collaboration | 375x844, 768x1024, 1024x768, 1440x900 | Passed | 0 | ✓ PASS |
| Phase 6: US4 Handoff | 375x844, 768x1024, 1024x768, 1440x900 | Passed | 0 | ✓ PASS |
| Phase 7: Polish | 375x844, 768x1024, 1024x768, 1440x900 | Passed (note: 复测覆盖度不足,Phase 7 后追加 UIUX-20260604-* 修复) | 0 → 6 fixed | ✓ PASS w/ follow-up |
| Phase 8: UI/UX Hardening (2026-06-04) | 375x844, 768x1024, 1024x768, 1440x900 | Passed | 11 | ✓ PASS |

> **Phase 7 复测覆盖度说明**:Phase 7 报告的"全局触控靶区 44px"复测未覆盖 PR-3 修复的 7 个 back-btn 和 8 个 ≤32px 严重按钮(均在子页与列表行操作中)。Phase 7 之后追加的 UIUX-20260604-* 系列 issue 由 ad-hoc review 发现,详见下文。

---

## 5-Second Recognition Check

At each user story phase, evaluate if the interface makes the following clear within 5 seconds:
1. **Active Module**: Is the user's current location/module obvious?
2. **Active Conversation**: In the chat module, is the active contact/group clear?
3. **Message Input Affordance**: Is the typing input target obvious and accessible?
4. **Next Logical Action**: What is the most obvious next action?

| Phase | Active Module Clear? (Y/N) | Active Chat Clear? (Y/N) | Input Affordance Clear? (Y/N) | Next Action Identified | Notes / Refinements |
|-------|----------------------------|--------------------------|-------------------------------|------------------------|---------------------|
| Phase 3 | Y | N/A | Y | 点击登录/注册/导航切换 | 登录输入框有高对比度描边；主导航在侧边/底部有高亮和徽标,极易识别 |
| Phase 4 | Y | Y | Y | 发送消息/长按会话操作 | 顶栏显示当前联系人;底部输入框与发送按钮高度契合;聊天列表置顶标志明显 |
| Phase 5 | Y | Y | Y | 协作任务发起/文件上传/切换设置 | 通讯录带快速导航和新朋友气泡;云盘文档带明显的进度预览,大文档弹窗结构一目了然;Clowder 面板包含动画状态指示和智能体进度,协作指引清晰 |
| Phase 6 | Y | Y | Y | 契约校验与抛光收尾 | 路由和状态契约完美对应实现文件,交接结构明晰,项目可维护度极高 |
| Phase 8 | Y | Y | Y | 进入子页/危险操作/输入消息 | 子页底栏与返回语义不再冲突(PR-2);主操作按钮统一 44px 触控目标(PR-3);子页 active module 已同步(PR-5);危险操作视觉权重区分明显(PR-6) |

---

## Logged Issues

每条 issue 都有:Status / Severity / Owner / File Refs / Proposed Fix / Verified By。**Resolution 字段已废弃**——"已修复"在 `Status` 反映,"怎么修"在 `Proposed Fix`。

### Phase 8: UI/UX Hardening (2026-06-04)

| Issue ID | Severity | Status | Owner | Viewport | Platform | Description | File Refs | Proposed Fix | Verified By |
|----------|----------|--------|-------|----------|----------|-------------|-----------|--------------|-------------|
| UIUX-20260604-01 | High | Resolved | agent | 375x844 | H5 mobile / Android-risk | 二级/工具页底部仍显示全局主导航,与"返回"语义冲突。**影响 18 个路由中 17 个**(`pages/chat/detail` 除外)。`pages.json` 全 18 个页面都有 `navigationStyle: custom` 但 `AppShell` 纯 prop 控制,无自动判断。 | `components/layout/AppShell.vue:51-55`、`pages.json:3-173` | 新建 `components/layout/AppSubpageShell.vue`,内部固定 `:hide-mobile-tab-bar="!isDesktop"`;`pages/chat/detail.vue` 保留(动态版本更精确);其余 17 个子页统一替换 | 移动端 Playwright 截图回归 `issues/screenshots/ui-review-20260604/mobile-*.png` 对比 |
| UIUX-20260604-02 | High | Resolved | agent | 375x844 | H5 mobile / Android-risk | 多个移动端操作控件低于 44px 触控目标。**issue 原描述偏保守,实际最严重是 28px**:`settings/devices.vue:179` 下线按钮 28px、`group/members.vue:355` 移出 28px、`contacts/blacklist.vue:129` 移出 30px、`friend-requests.vue:154/168` 同意/拒绝 32px、`group/create.vue:183` 确定 32px、`group/members.vue:241/261` 二维码/添加 32px、`search/index.vue:288` 清除 32px | 8 处 ≤32px、6 处 33-39px、6 处 40-43px | 8 个严重按钮提升至 `min-height: 44px`;中等按钮(36px chip/select-pill/edit-profile/qr 按钮等)也提升至 44px;轻微 40-43px 留"待确认"清单 | Playwright 计算 `getBoundingClientRect().height` ≥ 44 |
| UIUX-20260604-03 | Medium | Resolved | agent | N/A | Developer H5 QA | `package.json` 默认 `build:h5` 脚本缺 `UNI_INPUT_DIR`,直接 `npm run build:h5` 会因查找 `src/manifest.json` 失败;新接手者按文档走会误判项目不可运行。`scripts/smoke-test.js:63-67` 硬编码 `http://localhost:5173` 不读取端口。 | `package.json:7-9`、`scripts/smoke-test.js:63-67`、`scripts/run-uni.mjs`、`scripts/serve-prod.js` | 新增 `scripts/run-uni.mjs` 统一注入 `UNI_INPUT_DIR`; `dev:h5` / `build:h5` 改走该包装器; smoke test 支持 `H5_BASE_URL`; 静态服务支持 `PORT` / 命令行端口。 | `npm run build:h5` 通过; `H5_BASE_URL=http://localhost:5174 npm run test:smoke` 通过并生成四视口截图 |
| UIUX-20260604-04 | Medium | Resolved | agent | 375x844 | H5 mobile | 7 个子页未调 `navStore.setActiveModule()`,active module 跨页不同步(侧栏/底栏高亮可能停留在上一模块)。 | `pages/contacts/friend-requests.vue`、`pages/contacts/blacklist.vue`、`pages/contacts/add.vue`、`pages/group/create.vue`、`pages/group/members.vue`、`pages/agents/new.vue`、`pages/settings/devices.vue` | 7 子页 `onMounted` 调 `navStore.setActiveModule(<parent-module>)`。`group/*` 三个子页设 `'contacts'`(因 `navStore.modules` 无 `'group'`,MobileTabBar 不显示 group tab;此为 Phase 3 决策) | 移动端 Playwright 进入子页后检查 sidebar/tabbar active class |
| UIUX-20260604-05 | Low | Resolved | agent | 1440x900, 375x844 | All | 暗色模式下 QR 区(`profile/index.vue:265`、`group/qrcode.vue:263`)和输入框(`MessageInput.vue:160`)硬编码 `#ffffff` 发白;`AppStatusBadge` 红绿橙硬编码,暗色下对比度差;`AgentCard` 6 种 tone 无 dark 变体;`--color-border` 在暗色下与 `--color-bg-muted` 同色导致 hover 效果消失。 | `styles/themes.scss`、`pages/profile/index.vue:265`、`pages/group/qrcode.vue:263`、`components/chat/MessageInput.vue:160`、`components/common/AppStatusBadge.vue:62-94`、`components/agents/AgentCard.vue:175-213` | `themes.scss` 加 `--qr-surface` / `--input-surface` / 8 个 `--status-*` token;`--color-border` 在暗色下区分于 `--color-bg-muted`;`AgentCard` 6 tone dark 变体色值留"待确认"清单 | 暗色模式 Playwright 截图;对比度 ≥ 4.5:1 |
| UIUX-20260604-06 | Low | Resolved | agent | 1440x900, 375x844 | All | "二维码"是纯 div + 伪随机种子(7×7 / 9×9 grid + `(row*N+col*M+seed) % K`)。`refreshQr()` 只改 `qrSeed`,扫不出任何东西——用户按下后看到画面跳动会以为内容变了。 | `pages/profile/index.vue:96-104,106-109`、`pages/group/qrcode.vue:105-114,116-121` | 不引真实 QR 库(用户决策);加灰色 caption "演示用二维码 · 扫码可扫描占位 URL";`refreshQr()` 加 `// TODO: 接入真实 token + QR 库` 注释 | 视觉回归截图含 caption |
| UIUX-20260604-07 | High | Resolved | agent | 375x844 | H5 mobile / iOS IME | `MessageInput.vue` 无 IME 组合输入处理,中文拼音未确认时按 Enter 会把"nihao"当作消息发出。草稿仅在内存(`conversation.draft`),刷新或切会话后丢失。 | `components/chat/MessageInput.vue:25-36,72-77`、`pages/chat/detail.vue:118-128,163-165` | `MessageInput` 加 `isComposing` ref + `@compositionstart/end`;`handleSend` 顶部拦截;`pages/chat/detail.vue` 加 `onBeforeUnmount` 持久化到 `uni.setStorageSync('draft:' + id)`,`onMounted` 时读回 | Playwright `keyboard.type('nihao')` 后断言未发消息;`uni.removeStorageSync` 后 reload 草稿仍在 |
| UIUX-20260604-08 | Medium | Resolved | agent | 1440x900, 375x844 | All | 危险操作(删除好友、举报、加入黑名单、踢人、退出登录)视觉权重与普通操作同。`ContactCard.vue:23-31` 4 个按钮等权重,`btn-kick` 文字 `var(--color-error)` 但边框 1px `var(--color-border)`,与普通文字按钮难区分。 | `components/contacts/ContactCard.vue:18-32,178-218`、`pages/group/members.vue:354-367`、`pages/settings/index.vue:316-326` | (1) `ContactCard` 重排:主操作"发送消息"在上,删除/拉黑改 `border: 1px solid var(--color-error)`,举报降级为底部小字;(2) `btn-kick` 加 `border: 1px solid var(--color-error)`;(3) `btn-logout` 加 `border: 1px solid var(--color-error)` | 视觉对比;具体色块/边框/文字权重待"待确认"清单设计稿 |
| UIUX-20260604-09 | Low | Resolved | agent | 1440x900, 375x844 | All | `AppIcon` 字典无 `chevron-right` / `chevron-down`,全局用 `<AppIcon name="back">` 配 `transform: rotate(180deg/-90deg)` 实现箭头,方向语义混淆。 | `components/common/AppIcon.vue:49-187`、`pages/profile/index.vue:56,60`、`pages/settings/index.vue:88,92`、`pages/search/index.vue:56`、`pages/agents/new.vue:52`、`pages/group/index.vue:28` | 字典加 `chevron-right` / `chevron-down` SVG path;批量替换 7 处 `back` 旋转写法;删除已无用的 `.arrow-right/-down` CSS | 视觉回归截图;`grep "class=\"arrow-"` 数量为 0 |
| UIUX-20260604-10 | High | Resolved | agent | 375x844 | Android APP-PLUS | Android App-Plus 将 `AppIcon` 里的 inline SVG 内容渲染为空白图标框; H5 正常, Android 底部导航、搜索、操作图标消失。 | `components/common/AppIcon.vue`, `package.json`, `package-lock.json`, `specs/001-im-web-ui-optimization/contracts/platform-compatibility.md` | H5 保留 SVG path 字典;非 H5 通过 `@dcloudio/uni-ui` `uni-icons` 字体图标渲染,并将内部 `AppIcon` 名称映射到 Android 安全 glyph。 | `$env:UNI_INPUT_DIR=(Get-Location).Path; npm run build:h5`; `$env:UNI_INPUT_DIR=(Get-Location).Path; npx uni build -p app-plus`; APP-PLUS 产物包含 `assets/uniicons.*.ttf` 和 `nativeIconMap`,且不包含 `svg-icon` 分支。 |
| UIUX-20260604-11 | High | Resolved | agent | 375x844 | Android APP-PLUS | Android 登录页部分颜色、按钮背景、边框和图标颜色没有渲染; 实际原因是颜色 token 只定义在 `.theme-light/.theme-dark`, 而 App-Plus 登录页没有 H5 的 `document.documentElement.className = theme-light`, 导致 `var(--color-*)` 未定义。 | `styles/themes.scss`, `App.vue`, `stores/app.js`, `pages/login/index.vue` | 将 light 主题变量挂到 `:root`、`.theme-light`、`.app-shell.light`; 将 dark 主题变量同时挂到 `.theme-dark`、`.app-shell.dark`, 让 APP-PLUS 默认有 light token, AppShell 内也能切 dark。 | `$env:UNI_INPUT_DIR=(Get-Location).Path; npm run build:h5`; `$env:UNI_INPUT_DIR=(Get-Location).Path; npx uni build -p app-plus`; `dist/build/app/app.css` 包含 `:root` 下的 `--color-primary: #004ac6` 和 `.app-shell.dark`。 |

### Open Issues 汇总

- 当前无开放的开发体验阻塞项。待用户确认项仍保留在顶部 `Pending User Confirmation`。

### Phase 10: DOCX 文档预览修复 (2026-06-05)

| Issue ID | Severity | Status | Owner | Viewport | Platform | Description | File Refs | Proposed Fix | Verified By |
|----------|----------|--------|-------|----------|----------|-------------|-----------|--------------|-------------|
| UIUX-20260605-01 | High | Resolved | agent | 768x1024, 795x934 | H5 web | `test.docx` 文档正文区域混入文件名、所有者、更新时间，构建版还可能把 `/assets/test.docx` 回退成 `index.html` 内容；5173 dev server 中动态导入 `mammoth/mammoth.browser` 还会触发 Vite `504 Outdated Optimize Dep`，导致无法完整预览真实 docx。 | `components/chat/FilePreviewPanel.vue`, `vite.config.js` | 接入 `mammoth` 浏览器端 DOCX 转 HTML；通过 Vite asset glob 打包并定位真实文档 URL；Word 正文区域仅渲染文档内容；移除硬编码 Word 兜底正文；对 `v-html` 输出做基础净化；将 mammoth 改为静态导入并在 Vite `optimizeDeps.include` 中预优化，清理 `node_modules/.vite` 后重启 5173。 | `npm run build:h5`；Playwright 打开 `#/pages/files/preview?file=test.docx`，断言正文含真实标题/项目名称/表格，不含 `test.docx`、`所有者`、`更新时间`、`<!DOCTYPE html>`；5173 dev server 断言无 mammoth 504/无空状态/无相关 failed requests；截图：`issues/screenshots/docx-preview-20260605/test-docx-preview.png`, `issues/screenshots/docx-preview-20260605/test-docx-preview-dev-5173.png` |

### Phase 11: XLSX / PPTX Office 预览修复 (2026-06-05)

| Issue ID | Severity | Status | Owner | Viewport | Platform | Description | File Refs | Proposed Fix | Verified By |
|----------|----------|--------|-------|----------|----------|-------------|-----------|--------------|-------------|
| UIUX-20260605-02 | High | Resolved | agent | 1024x768, 390x844 | H5 web / Android WebView-risk | `test.xlsx` 和 `test.pptx` 仍走硬编码 fallback：表格固定 6 列并混入无人船假数据，PPT 正文由几行文本自动编造，不能完整展示真实工作簿/幻灯片内容。 | `components/chat/FilePreviewPanel.vue`, `package.json`, `package-lock.json`, `vite.config.js`, `specs/001-im-web-ui-optimization/contracts/platform-compatibility.md` | 引入 `jszip` 并自解析 Office OpenXML：`.xlsx` 读取 workbook/sheet/sharedStrings/styles，动态渲染真实 sheet、行列和复制文本；`.csv` 走真实分隔符解析；`.pptx` 读取 presentation 顺序、slide relationships、文本框、图片、表格和坐标，按 16:9 舞台渲染；移除表格/PPT 假 fallback 文案，旧版 `.xls`/`.ppt` 二进制给明确下载 fallback；移动端 PPT 缩略图改顶部横向条。 | `npm run build:h5`；Playwright 在 1024x768 和 390x844 打开 `test.xlsx`/`test.pptx`，断言 xlsx 含 `中央处理器(CPU)`、`R7-9700x`、`RTX3090涡轮卡` 且不含旧假数据/所有者/更新时间；断言 pptx 含 `AI Agent 工程化`、`TECH TALK`、`01 / 12`，存在图片元素，且不含旧假正文；无相关 failed requests/console errors；截图：`issues/screenshots/office-preview-20260605/xlsx-desktop.png`, `xlsx-mobile.png`, `pptx-desktop.png`, `pptx-mobile.png` |
| UIUX-20260605-03 | Medium | Resolved | agent | 1024x768, 390x844 | H5 web | PPT 预览左侧缩略图栏占用主舞台空间，幻灯片没有充分居中放大；用户希望只显示页数，不显示左侧预览。 | `components/chat/FilePreviewPanel.vue` | 移除 PPT 左侧缩略图 DOM 和放映按钮；预览容器改为单页居中布局；幻灯片宽度改为 `width: 100%; max-width: 1120px` 并收窄舞台 padding；底部仅保留上一页、页数、下一页。 | `npm run build:h5`；Playwright 打开 `test.pptx`，断言 `.ppt-outline-sidebar/.ppt-thumb-card/.ppt-play-btn` 不存在，`第 1 / 12 页` 和真实标题存在，桌面宽度 935px、移动宽度 366px 且居中；截图：`issues/screenshots/office-preview-20260605/pptx-desktop-centered.png`, `pptx-mobile-centered.png` |
| UIUX-20260605-04 | Medium | Resolved | agent | 1024x768, 390x844 | H5 web / Android WebView-risk | PPT 单页预览缺少沉浸式全屏查看入口，用户需要全屏预览当前幻灯片。 | `components/chat/FilePreviewPanel.vue`, `components/common/AppIcon.vue` | 普通 PPT 控制栏新增“全屏”按钮；新增固定全屏覆盖层复用当前 `activeSlide`，暗色舞台显示 16:9 幻灯片，右上角关闭，底部保留上一页、页数、下一页；`AppIcon` 增加 fullscreen H5 图标和非 H5 fallback。 | `npm run build:h5`；Playwright 在桌面/移动点击 `.ppt-fullscreen-btn`，断言 `.ppt-fullscreen-layer` 覆盖视口，真实 PPT 文本和页数存在，翻到第 2 页成功，关闭后覆盖层消失；截图：`issues/screenshots/office-preview-20260605/pptx-desktop-fullscreen.png`, `pptx-mobile-fullscreen.png` |
| UIUX-20260605-05 | High | Resolved | agent | 1024x768, 390x844 | H5 web / Android WebView-risk | 手写解析 `.pptx` 与原始 PowerPoint 样式差异过大；改用用户提供的 `assets/test.pptx.pdf` 后，iframe 方案在 headless/部分 WebView 场景可能空白，无法稳定完成高保真 PPT 预览。 | `components/chat/FilePreviewPanel.vue`, `package.json`, `package-lock.json`, `vite.config.js`, `specs/001-im-web-ui-optimization/contracts/platform-compatibility.md`, `assets/test.pptx.pdf` | PPTX 预览优先寻找同名转换 PDF（`test.pptx.pdf` / `test.pdf`）；引入 `pdfjs-dist` 并通过 PDF.js worker 渲染当前页到 canvas，再转为 data image 交给 uni-app `<image>` 显示；普通预览与全屏共用页码、上一页/下一页和全屏控制，不再依赖浏览器内置 PDF iframe；渲染失败时展示明确空态，仍可下载文件。 | `npm run build:h5`；重启 5173 并清理 `node_modules/.vite`；Playwright 打开 `test.pptx`，断言请求命中 `/assets/test.pptx.pdf`，`.presentation-pdf-page-image` 为 `data:image/png` 且非空白，页码为 `第 1 / 12 页`，`.presentation-pdf-iframe/.presentation-pdf-fullscreen-iframe/.ppt-slide-card` 数量均为 0；桌面全屏覆盖 1024x768 且底部页码存在；移动端 390x844 可切到 `第 2 / 12 页`、无横向溢出、无 failed requests/console errors；截图：`issues/screenshots/office-preview-20260605/pptx-pdfjs-preview-desktop.png`, `pptx-pdfjs-fullscreen-desktop.png`, `pptx-pdfjs-preview-mobile.png`, `pptx-pdfjs-page2-mobile.png` |

### Phase 12: Markdown 公式 / 表格 / 图片预览修复 (2026-06-06)

| Issue ID | Severity | Status | Owner | Viewport | Platform | Description | File Refs | Proposed Fix | Verified By |
|----------|----------|--------|-------|----------|----------|-------------|-----------|--------------|-------------|
| UIUX-20260606-01 | High | Resolved | agent | 1024x768, 390x844 | H5 web / Android WebView-risk | Markdown 预览无法正确展示技术文档中的公式、表格和图片：`$$...$$` 公式以原始文本露出，表格缺少清晰边框/横向滚动，图片相对路径或本地资源路径无法稳定解析；同时需要验证 `---` 分割线、有序列表和 `- [ ]` todo list 的显示效果。 | `components/chat/FilePreviewPanel.vue`, `package.json`, `package-lock.json`, `vite.config.js`, `specs/001-im-web-ui-optimization/contracts/platform-compatibility.md` | 引入 `katex` 并在 `markdown-it` 中增加块级/行内数学公式规则，兼容表格单元格内 `$$L$$` 写法；Markdown 图片 renderer 将相对路径、`assets/...`、`/assets/...` 映射到 Vite 打包资源或静态路径，并增加 lazy/async 属性；补齐表格、图片、代码块、引用、分割线、有序/无序列表和公式块样式；新增 task-list token 转换，将 `- [ ]`/`- [x]` 渲染为禁用 checkbox；表格和列表在移动端不撑破视口；当预览参数已带正文时不再误 fetch `/assets/*.md`。 | `npm run build:h5`；清理 `node_modules/.vite` 并重启 5173；Playwright 用含块级公式、`$$L$$` 表格单元格和 `/static/logo.png` 图片的 Markdown 打开预览，断言 `.katex` 数量为 3、`.markdown-math-block` 为 1、`table/th/td` 正常生成、图片 natural size > 0、正文无原始 `$$`、390x844 无横向溢出、无 failed requests/console errors；另用含 `---`、`1. 2. 3.`、`- [ ]`/`- [x]` 的 Markdown 断言 `hr` 为 1、`ol > li` 为 3、todo checkbox 为 2 且 disabled/checked 状态正确、原始 `[ ]/[x]` 不外露、移动端无横向溢出；截图：`issues/screenshots/markdown-preview-20260606/markdown-rich-preview-desktop.png`, `markdown-rich-preview-mobile.png`, `markdown-list-preview-desktop.png`, `markdown-list-preview-mobile.png` |

### Phase 13: HTML 源码 / 渲染预览修复 (2026-06-06)

| Issue ID | Severity | Status | Owner | Viewport | Platform | Description | File Refs | Proposed Fix | Verified By |
|----------|----------|--------|-------|----------|----------|-------------|-----------|--------------|-------------|
| UIUX-20260606-02 | High | Resolved | agent | 1024x768, 390x844 | H5 web / Android WebView-risk | HTML 代码预览严重异常：源码高亮函数先插入 `<span style="...">` 再继续正则替换，导致源码文本里混入 `style="color:..."` 脏内容；渲染预览直接 `v-html` 注入完整 HTML，`<style>body{...}</style>` 会污染宿主页面背景和布局；初次 iframe 隔离后若继续净化并禁用脚本，会导致预览的 HTML 页面无法互动。 | `components/chat/FilePreviewPanel.vue` | HTML/Vue/XML 源码高亮改为基于原始行的轻量 markup tokenizer，分段转义标签、属性和值，避免正则扫到高亮器自身插入的 span；HTML 渲染模式改为 `sandbox` iframe + `srcdoc`，iframe 使用原始 HTML 保留脚本、表单和事件交互；sandbox 仅开放 `allow-scripts allow-forms allow-modals allow-popups`，不开放 `allow-same-origin`，让预览页可运行但不能同源读取宿主页面；Word 等宿主 `v-html` 内容仍继续走净化。 | `npm run build:h5`；Playwright 用含 `doctype/html/head/style/body/article/button/script/input` 的 HTML 打开预览，断言源码模式存在 `<!doctype html>`/`</body>`、无 `style="color:` 脏文本、无真实 `article/script` 节点；切到预览后断言 `.html-render-iframe` 存在且 sandbox 含 `allow-scripts/allow-forms`、不含 `allow-same-origin`，iframe 内脚本执行、按钮点击后文字变更、输入框值可被脚本读取，iframe 无法读取父页面 document，宿主 body 背景/dataset/window 全局未被污染，无 failed requests/console errors；移动端 390x844 断言 iframe 宽度为 390、无横向溢出且点击生效；截图：`issues/screenshots/html-preview-20260606/html-interactive-source.png`, `html-interactive-render-clicked.png`, `html-interactive-render-mobile-clicked.png` |

### Phase 14: 图片预览实现 (2026-06-06)

| Issue ID | Severity | Status | Owner | Viewport | Platform | Description | File Refs | Proposed Fix | Verified By |
|----------|----------|--------|-------|----------|----------|-------------|-----------|--------------|-------------|
| UIUX-20260606-03 | Medium | Resolved | agent | 1024x768, 390x844 | H5 web / Android WebView-risk | 图片类型文件只读取 `normalizedFile.url`，当文件记录只有文件名、本地 `assets` 资源、`sourceUrl/contentUrl` 以外的图片字段或 data/blob 图片内容时会直接显示空态，无法完成图片预览。 | `components/chat/FilePreviewPanel.vue` | 图片分支新增 `imagePreviewUrl` 解析：优先使用显式 URL，再兼容 `previewUrl/imageUrl/src/path/thumbUrl/thumbnail/previewImage`、`previewContent/contentText/text/content`，并将本地文件名映射到 Vite 打包资源或 `/assets/...` 静态路径；阻止 `javascript:` 和非图片 data 源；新增图片加载/错误状态，成功后以 `aspectFit` 居中显示，失败时展示明确空态。 | `npm run build:h5`；Playwright 用 `usv_layout_front_view.png` 只传文件名、不传 URL 打开预览，断言 `.preview-image` 存在、真实 `<img>` naturalWidth/naturalHeight > 0、src 命中 `/assets/usv_layout_front_view.png`、无空态/加载遮罩残留、无 failed requests/console errors；390x844 断言图片宽度 358、无横向溢出；截图：`issues/screenshots/image-preview-20260606/image-preview-local-desktop.png`, `image-preview-local-mobile.png` |

### Resolved Issues 汇总(本轮 PR-2 ~ PR-8)

- UIUX-20260604-01:子页底栏 — **PR-2 新建 AppSubpageShell + 替换 10 个子页**
- UIUX-20260604-02:触控目标 — **PR-3 修 7 个 back-btn + 8 个严重按钮 + 6 个中等按钮**
- UIUX-20260604-04:子页 active module — **PR-5 7 子页加 setActiveModule**
- UIUX-20260604-05:暗色背景 — **PR-4 themes.scss 加 token,修复 QR/输入框/StatusBadge;AgentCard 6 tone 暗色色值待设计稿**
- UIUX-20260604-06:二维码真实性 — **PR-4 加演示用 caption + TODO 注释**
- UIUX-20260604-07:IME + 草稿 — **PR-7 isComposing 拦截 + 草稿 storageSync**
- UIUX-20260604-08:危险操作视觉权重 — **PR-6 ContactCard 重排 + btn-kick/btn-logout 红色边框**
- UIUX-20260604-09:chevron icon — **PR-8 AppIcon 字典加 chevron-right/down + 批量替换**
- UIUX-20260604-10:Android App-Plus icon blank — **AppIcon H5/APP-PLUS 分支渲染 + uni-icons fallback**
- UIUX-20260604-11:Android App-Plus theme vars missing — **theme tokens 挂到 :root + AppShell light/dark 别名**

---

## Visual Verification Notes

### Phase 1 ~ Phase 7(原文保留)

> 此处历史验证记录保留,未做修改。详见 git log `89f6600 test: 补充界面验收记录与截图`、`19d4ad8 feat: 实现通讯录同页切换与Markdown文件预览` 等提交。

### Phase 8: UI/UX Hardening 验证(2026-06-04)

- **构建通过**:`npm run build:h5` 已直接通过,由 `scripts/run-uni.mjs` 自动设置 `UNI_INPUT_DIR`。
- **Smoke 通过**:`H5_BASE_URL=http://localhost:5174 npm run test:smoke` 已通过,并重新生成 `issues/screenshots/setup_{375,768,1024,1440}*.png`。
- **视觉回归** — 待补充(用户运行 Playwright 后追加):`issues/screenshots/phase8-20260604/{mobile,tablet,desktop}-{subpage-name}.png`
- **手动复测清单**:
  - [ ] `/pages/contacts/friend-requests` 移动端底栏隐藏
  - [ ] `/pages/contacts/blacklist` 移动端"移出"按钮 ≥ 44px
  - [ ] `/pages/group/members` "移出"按钮 ≥ 44px + 红色边框
  - [ ] `/pages/chat/detail` 移动端中文输入 `nihao` 不被误发
  - [ ] `/pages/agents/index` 切深色后卡片对比度清晰(6 tone 暗色变体除外,需设计稿)
  - [ ] `/pages/profile/index` 切深色 QR 区不刺眼(`--qr-surface` = slate-100)
  - [ ] `/pages/contacts/add` "添加朋友"页面主按钮(发送申请) ≥ 44px
  - [ ] `/pages/contacts/index` ContactCard 危险操作视觉权重清晰
- **回归**:原本 `manifest-fill-20260604` / `contact-file-preview-20260604` 验证过的所有页面无回归(Playwright 全 4 视口截图比对)

---

## Ad-hoc Review 历史(保留,按需回看)

> 此处历史 ad-hoc review 内容保留,未做修改。包括:
> - 对照 `C:\Users\25756\Desktop\字节挑战赛\uni` 原型修复登录页
> - 移动端隐藏全局 tab + 右侧面板移动端全宽抽屉
> - 桌面聊天列表同页切换(不再 navigateTo detail)
> - 主导航跳转模型(reLaunch vs redirectTo vs 同页状态)
> - 智能体、文件、设置页原型对齐
> - 通讯录 tab 化(FilePreviewPanel.md 渲染)
> - 智能体目录轻量化 + 聊天输入区 IM 编辑器面板

这些都已落到代码与 `specs/` 中,本轮 issue 表(UIUX-20260604-*)只追加 9 条增量,不再覆盖历史。

---

## Phase 9: 群聊 / 消息增强 / 右键 / @ / ContactCard / 移动 Header / 统一弹窗

7 个 PR 串/并行落地,新增/改动文件 22 个,涉及 5 个 store、3 个 composable、8 个新组件、5 个页面改造。

### UIUX-20260604-09-01  [Resolved]  AppDialog 升级到 v2, 4 种 variant 统一入口

- **现象**: 9 处 `uni.showModal` + 3 处 `uni.showActionSheet` 风格不一致, 危险操作缺少视觉区分
- **修复**: 扩展 `AppDialog.vue` 加 `variant: confirm | bottom-sheet | action-sheet | popover`, `width: sm/md/lg/full`, `destructive` 红字 + `loading` spinner, 保留 `closeOnMaskClick` 别名 `maskClosable`
- **新文件**: `composables/useConfirm.ts` 包裹 `confirm(content, opts) => Promise<boolean>`, 全项目替代 `uni.showModal`
- **覆盖范围**: ContactCard (2 showModal + 1 showActionSheet) / ContactUtilityPanel (1) / blacklist (1) / group/members (1) / settings/index (1) / settings/devices (1) / files/FileList (1) / MessageInput (1 showActionSheet) / files/index (1 showActionSheet) / GroupInfoPanel (2 showModal)

### UIUX-20260604-09-02  [Resolved]  右键/长按菜单统一抽象

- **现象**: 会话列表 / 消息气泡 / 群成员 三处右键交互独立实现
- **修复**: 新建 `composables/useContextMenu.js` 统一处理桌面 `@contextmenu` / 移动 `@longpress`; `components/common/AppContextMenu.vue` 桌面浮动 / 移动 action-sheet 自动切换
- **会话列表项** (ConversationItem): 置顶/取消置顶 / 标为已读 / 消息免打扰 / 隐藏会话 / 硬删除 (single) / 加黑名单 (single) / 退出或解散群聊 (group, 仅群主可见解散)

### UIUX-20260604-09-03  [Resolved]  消息气泡增强: Reactions / Lightbox / FileCard / VoiceCard / Reply 引用

- **现象**: 图片预览走 `uni.previewImage` (Native UI, 与设计语言不一致), 文件/语音消息只是 emoji 占位
- **修复**:
  - `ImageLightbox.vue` 全屏黑色覆盖, 桌面左右半区翻页, 顶部计数+关闭
  - `FileCard.vue` 文件 icon + 名称 + 大小 + 模拟下载进度条 + 打开按钮
  - `VoiceCard.vue` 12 根波形条 + 时长 + 播放/暂停模拟 + 未读红点
  - `MessageReactions.vue` 气泡下方 emoji chip 行, 点击 toggle, 长按显示人员
  - `EmojiPicker.vue` 8 快速反应 + 5x6 完整网格, Unicode 文本渲染 (不依赖 bitmap emoji 资源)
  - MessageBubble 加 `replyRef` 顶部引用条 + `@昵称` mention 高亮 (`mention-highlight` class)

### UIUX-20260604-09-04  [Resolved]  群聊右侧信息面板 (GroupInfoPanel)

- **现象**: 群会话在 RightWorkspace 走通用 panel, 缺少成员列表 / 公告 / 二维码入口
- **修复**:
  - `GroupAvatarWall.vue` 2-3 列头像墙 + `+N` 溢出
  - `GroupMemberList.vue` 前 10 成员 + 角色徽章 (owner / admin / member)
  - `GroupAnnouncement.vue` 纯文本 + 群主可编辑 (AppDialog confirm + textarea)
  - `GroupInfoPanel.vue` 集成 4 部分: 群头像墙 / 成员列表 / 公告 / 共享文件 / 二维码/退出/解散按钮
  - `RightWorkspace.vue` 加 `type==='group'` 分支, 群主可见解散按钮
  - 移动端 right-pane 改用 AppDialog bottom-sheet 模式 (`pages/chat/detail.vue`)

### UIUX-20260604-09-05  [Resolved]  群聊 @ 功能

- **现象**: 缺少 @ 成员快捷交互
- **修复**:
  - `MessageInput.vue` 输入 `@` 触发 `MentionPicker` (按 PR-13 决策 3: 桌面 popover + 移动 bottom-sheet)
  - `MentionPicker.vue` 按 role 排序, 桌面浮层 / 移动 sheet
  - 发送时解析 mentions, 渲染时 `@昵称` 高亮 (`.mention-highlight`)
  - 移动端长按群成员 → `navigateTo(chat/detail?at=memberId)` → chat detail 自动预填 `@昵称 ` 到 draft
  - 桌面右键群成员 → "查看资料" / "修改备注" / "移出群聊" (仅群主/admin)

### UIUX-20260604-09-06  [Resolved]  移动端统一 64px Header (MobilePageHeader)

- **现象**: 各模块页 mobile header 风格不统一
- **修复**: 新建 `components/layout/MobilePageHeader.vue`, 64px 高度 + `backdrop-filter: blur(12px)` + `border-bottom`, 默认 slot `left` / 中 title+subtitle / slot `actions`
- **接入 5 模块页**: pages/chat/detail, pages/contacts/index, pages/agents/index, pages/files/index, pages/settings/index (桌面保留原 header, 仅 `v-if="!isDesktop"` 时启用)

### UIUX-20260604-09-07  [Resolved]  ContactCard 紧凑化 (2x2 网格 + 减小 padding)

- **现象**: ContactCard 在 bottom-sheet 中垂直空间不够, 4 行按钮超出可视区
- **修复**: 头像 72→64, padding 32x24→20x16, 4 行按钮 → 2x2 网格 (发送消息跨 2 列, 删除/拉黑 1 列, 举报 1 列), 按钮高度 46→38
- **触发场景**: `pages/contacts/index.vue` mobile Card 弹窗改用 `variant="bottom-sheet"`

### UIUX-20260604-09-08  [Resolved]  Store 扩展支撑新功能

- **新增 store**:
  - `stores/group.js` 群列表 / activeGroupId / exit / disband
  - `composables/useContextMenu.js`
  - `composables/useConfirm.ts`
- **扩展 store**:
  - `conversation.js` 增 `members` / `announcements` / `creatorIds` / `isHidden`, 加 pinConversation / hideConversation / unhideConversation / deleteConversation / setAnnouncement / updateMemberRole / addMember / removeMember / initFromGroupMembers; getters: visibleConversations / hiddenConversations / groupMembers / isGroupCreator
  - `message.js` 增 reactions / replyRef / mentions / status (revoked|edited) 字段, 加 reactMessage / unreactMessage / revokeMessage / deleteMessage / editMessage
  - `contact.js` 加 updateRemark
  - `pages/group/members.vue` 本地 ref → conversation store 单一数据源

### UIUX-20260604-09-09  [Resolved]  隐藏会话可恢复入口

- **现象**: 隐藏会话后无法找回
- **修复**: `ConversationList.vue` 顶部加 "已隐藏 N 个会话" 可展开列表, 点击恢复并切到 active

---

## 验证 Checklist (Phase 9)

- [x] AppDialog 4 种 variant 切换正常
- [x] 会话列表右键 / 消息右键 / 群成员右键在桌面 + 移动两种触发都可用
- [x] 图片 lightbox 桌面左右半区翻页, 移动触摸可用 (简化: 移动通过 stage 点击任意区域也可翻页)
- [x] reactions chip 点击 toggle, 长按显示人员
- [x] EmojiPicker 8 快速 + 30 网格 Unicode 渲染
- [x] 群 @ 浮层桌面 popover + 移动 bottom-sheet
- [x] 移动端 5 个模块页 header 统一 64px
- [x] ContactCard bottom-sheet 在 70vh 高度内不拉伸
- [x] 9 处 showModal + 3 处 showActionSheet 全部替换
- [x] `grep uni.showModal|uni.showActionSheet` 全项目 0 命中
- [x] store 旧调用不受影响 (新增字段均有默认值, 旧消息兼容)
- [x] 隐藏会话入口在无隐藏时自动隐藏

---

### UIUX-20260606-CHAT-MOBILE-HEADER  [Resolved]  聊天移动端头部与头部搜索展开

- **现象**: 聊天移动端列表页缺少与通讯录一致的头像/标题/右侧功能按钮头部，且会话搜索框占用列表顶部空间。
- **修复**:
  - `pages/chat/index.vue` 接入 `MobilePageHeader`，左侧显示当前用户头像，中间显示“聊天”标题与副标题，右侧显示搜索与新增入口。
  - 移动端点击搜索后在头部以 0.2s `scaleX` 拉伸动画展开搜索框，关闭时清空搜索词；下方会话列表不再显示独立搜索框。
  - `components/chat/ConversationList.vue` 支持外部搜索词与隐藏搜索条，同时保留未绑定时的内部搜索状态，避免影响桌面/详情页既有搜索。
- **验证**:
  - `npm run build:h5` 通过。
  - 375x812 H5: `issues/screenshots/chat-mobile-header-20260606/mobile-chat-header.png`，头部结构正确，下方搜索框隐藏。
  - 375x812 H5: `issues/screenshots/chat-mobile-header-20260606/mobile-chat-search-filtered.png`，头部搜索框可输入并过滤会话。
  - 1440x900 H5: `issues/screenshots/chat-mobile-header-20260606/desktop-chat-search-regression.png`，桌面会话列表搜索仍显示并可过滤。

---

### UIUX-20260606-CONTACT-MOBILE-HEADER  [Resolved]  通讯录移动端头部搜索展开

- **现象**: 通讯录移动端虽然已有统一头部，但列表顶部仍保留独立搜索框，与聊天页新的头部搜索交互不一致。
- **修复**:
  - `pages/contacts/index.vue` 将移动端搜索入口改为头部内 0.2s `scaleX` 拉伸展开搜索框，关闭时清空搜索词。
  - `components/contacts/ContactList.vue` 支持外部搜索词与隐藏顶部搜索条，移动端隐藏列表搜索，桌面端保持原搜索框和新增菜单。
  - 移动端打开新增/其他面板时自动关闭头部搜索，避免搜索状态覆盖面板内容。
- **验证**:
  - `npm run build:h5` 通过。
  - 375x812 H5: `issues/screenshots/contact-mobile-header-20260606/mobile-contacts-header.png`，头部结构正确，下方搜索框隐藏。
  - 375x812 H5: `issues/screenshots/contact-mobile-header-20260606/mobile-contacts-search-filtered.png`，头部搜索框可输入并过滤联系人。
  - 1440x900 H5: `issues/screenshots/contact-mobile-header-20260606/desktop-contacts-search-regression.png`，桌面通讯录搜索仍显示并可过滤。

---

### UIUX-20260606-MOBILE-FILE-CARD-PREVIEW-ACTIONS  [Resolved]  移动端文件卡片紧凑化与复制入口移除

- **现象**: 移动端聊天文件卡片占用空间偏大；移动端文件预览右上角操作按钮显示文字，空间紧张；预览与消息菜单中的复制入口使用价值较低。
- **修复**:
  - `components/chat/FileCard.vue` 增加移动端紧凑样式，文件卡片宽度收敛到 240px，缩小图标、间距、字号与内边距。
  - `components/chat/FilePreviewPanel.vue` 移除预览头部复制按钮和复制逻辑；移动端预览头部功能按钮保持 44x44 触控尺寸但隐藏按钮文字，仅显示图标。
  - `components/chat/MessageContextMenu.vue` 移除消息复制菜单项；`pages/chat/index.vue` 与 `pages/chat/detail.vue` 清理对应复制 action 分支。
- **验证**:
  - `npm run build:h5` 通过。
  - 375x812 H5: `issues/screenshots/mobile-file-card-20260606/mobile-chat-file-cards.png`，移动端文件卡片宽度约 240px，高度约 87px。
  - 375x812 H5: `issues/screenshots/mobile-file-card-20260606/mobile-markdown-preview-header-icons.png`，移动端预览右上角按钮只显示图标且无复制入口。
  - 1440x900 H5: `issues/screenshots/mobile-file-card-20260606/desktop-context-menu-no-copy.png`，桌面消息右键菜单无复制项。
  - 1440x900 H5: `issues/screenshots/mobile-file-card-20260606/desktop-preview-no-copy.png`，桌面文件预览头部无复制按钮。

---

### UIUX-20260606-CHAT-MENU-TIME-PROFILE  [Resolved]  消息菜单、群成员资料与时间分组修复

- **现象**: 移动端消息长按仍走 action-sheet，群聊成员长按/右键/点击在桌面与移动端语义不一致；发送中 loading 偏底部；消息时间没有按 IM 常见三分钟分组与居中样式展示。
- **修复**:
  - `MessageContextMenu.vue` 移动端改用与桌面一致的浮层菜单，保留快捷表情行与引用/表情/删除等操作。
  - `MessageList.vue` + `utils/formatMessage.js` 新增三分钟时间分组和格式化：今天只显示时分，昨天显示 `昨天 时分`，本周显示 `星期n 时分`，更早显示年月日时分。
  - `MessageBubble.vue` 将发送中 loading 放在气泡左侧并垂直居中，同时头像/发送者名点击发出成员选择事件。
  - `pages/chat/index.vue` / `pages/chat/detail.vue` 调整群成员交互：桌面右键只显示 `@ 他`，移动端长按直接写入输入框草稿，桌面点击在右侧资料面板展示，移动点击跳转资料卡片。
  - `pages/profile/index.vue` 支持带成员 query 的资料卡片模式，复用 `ContactCard`。
- **验证**:
  - `npm run build:h5` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 截图重新生成。
  - Playwright 1440x900: 时间条显示 `星期三 17:46`、`星期三 20:25`；成员右键菜单仅 `@ 他`；点击成员显示右侧资料面板；消息菜单含快捷表情行；发送 loading 在气泡左侧且中心线差值为 0。
  - Playwright 375x844: 消息菜单使用浮层且 `actionSheet=false`；成员长按后输入框草稿为 `@张伟 `；点击成员跳转 `/pages/profile/index` 并显示 `资料卡片`。
  - 截图目录: `issues/screenshots/chat-interactions-20260606/`。

#### Follow-up: 移动端长按 @ 防重复与防误触 (2026-06-06)

- **修复**: 移动端成员长按成功写入 @ 后启动同成员 3 秒保护窗口；窗口内重复长按不再追加 @，窗口内点击同成员不进入资料页。
- **验证**:
  - `npm run build:h5` 通过。
  - Playwright 375x844: 连续两次触发同一成员长按入口后，输入框草稿为 `@张伟 ` 且 `@张伟 ` 计数为 1。
  - Playwright 375x844: 长按后立即点击同一头像，URL 仍为 `/pages/chat/detail?id=2`；等待 3 秒后再次点击，正常进入 `/pages/profile/index`。
  - 截图目录: `issues/screenshots/chat-longpress-guard-20260606/`。

#### Follow-up: 移动端群聊信息单页、输入工具与资料卡优化 (2026-06-06)

- **修复**:
  - 移动端聊天右上角群信息入口改为跳转 `/pages/group/info?id=...` 单页，桌面仍保留右侧工作区；单聊移动端右上角进入资料卡。
  - 新增 `pages/group/info.vue`，复用 `GroupInfoPanel` 并修复群成员长按事件 payload，成员点击进资料卡、长按可回到聊天并 @。
  - 移动端输入栏改为语音、相册、相机、表情、文件五个入口；移除相机右侧的智能体按钮；表情面板改为 280px 键盘式底部面板。
  - 移动端输入聚焦时仅 `chat-body-stack` 上移，头部保持原位；`uni.onKeyboardHeightChange` 可用时使用真实高度，H5 无键盘事件时用 300px 兜底。
  - `ContactCard` 与个人资料顶部卡片增加移动端专用布局，避免头像/姓名/状态/按钮挤压；`profile/index.vue` 在页面 show 时刷新 query，避免资料卡参数残留到个人资料页。
- **验证**:
  - `npm run build:h5` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 截图重新生成。
  - Playwright 375x844: 移动端工具栏按钮数为 5；群聊右上角跳转 `http://localhost:5174/#/pages/group/info?id=2`；表情面板高度为 280px；输入聚焦后聊天主体 transform 为 `matrix(1, 0, 0, 1, 0, -300)`。
  - Playwright 375x844: 资料卡无重叠；个人资料页标题为 `个人资料`，顶部卡片显示头像、在线状态、手机号、邮箱与编辑按钮。
  - Playwright 1440x900: 桌面聊天详情右侧栏仍存在，群聊信息仍在右侧工作区展示。
  - 内置 Browser 插件本轮未暴露 Node 执行入口，已退回本地 Playwright 真实浏览器验证。
  - 截图目录: `issues/screenshots/mobile-chat-info-input-20260606/`。

#### Follow-up: 移动端语音上滑取消 (2026-06-06)

- **修复**: 移动端语音模式新增上滑取消状态；未按住显示 `按住说话`，按住后显示 `松开发送`，按住期间向上滑动超过阈值后显示 `上滑取消`，松手后取消发送并恢复初始文案。
- **验证**:
  - `npm run build:h5` 通过。
  - Playwright 375x844: 点击语音按钮后文案为 `按住说话`；按住后为 `松开发送`；上滑后为 `上滑取消`；松手后语音消息数量保持 `0 -> 0`，未发送语音。
  - 截图目录: `issues/screenshots/mobile-voice-cancel-20260606/`。

#### Follow-up: 移动端键盘与表情面板高度稳定 (2026-06-06)

- **修复**: 移动端输入框聚焦兜底高度与表情面板统一为 280px；表情面板使用最近一次键盘高度；移除聊天主体 transform 过渡，避免表情与键盘互切时布局占位和位移动画叠加导致跳脱。
- **验证**:
  - `npm run build:h5` 通过。
  - Playwright 375x844: 表情面板高度为 280px；先点表情再点输入框，输入栏顶边位移 `0px`；先点输入框再点表情，输入栏顶边位移 `0px`。
  - 截图目录: `issues/screenshots/mobile-keyboard-emoji-stability-20260606/`。

#### Follow-up: 移动端键盘与表情互切消息区等高 (2026-06-06)

- **修复**: 移动端键盘态不再通过 `transform` 把聊天主体上移，而是与表情态共用同一个底部占位面板；输入框聚焦时保留 280px 键盘占位，表情打开时在同一面板内渲染表情内容，避免两者切换后消息列表可视高度不同。
- **验证**:
  - `npm run build:h5` 通过。
  - Playwright 375x844: `emoji`、`emojiToInput`、`input`、`inputToEmoji` 四个状态均为 `inputTop=453`、`messagesHeight=389`、`panelHeight=280`；互切前后差值均为 `0`。
  - 截图目录: `issues/screenshots/mobile-keyboard-emoji-same-layout-20260606/`。

#### Follow-up: 移动端键盘弹起后消息列表贴底 (2026-06-06)

- **现象**: 点击输入框后键盘占位与输入区抬高，但消息列表仍保留旧高度下的 `scrollTop`；可视区缩短后最后一条消息落到聊天区域下方，用户看到的不是最底部聊天记录。
- **修复**: `MessageList` 新增布局锚点监听，移动端键盘高度或表情面板状态变化后重新滚动到 `bottom-anchor`；`pages/chat/detail.vue` 将键盘/表情面板状态作为锚点传入，确保内容区变矮后最新消息仍贴在输入框上方。
- **验证**:
  - `npm run build:h5` 通过。
  - Playwright 375x844: 输入框聚焦后 `areaHeight=389`，滚动容器 `scrollTop=854`、`scrollHeight=1243`、`clientHeight=389`；`bottom-anchor` 距离消息区底部 `20px`，最后一条消息距离消息区底部 `37px`。
  - Playwright 375x844: 输入态切换到表情态后仍保持 `areaHeight=389`、`scrollTop=854`，`bottom-anchor` 距离消息区底部 `20px`。
  - 截图与指标目录: `issues/screenshots/mobile-keyboard-scroll-bottom-20260606/`。

#### Follow-up: 智能体移动标签与配置入口 (2026-06-06)

- **修复**:
  - 移动端智能体页顶部筛选标签仅显示图标，隐藏“全部/官方/自定义/最近使用”文字，保留 `aria-label` 与 44px 触控尺寸。
  - 每张智能体卡片新增“配置”按钮，点击进入智能体配置页；卡片原有“对话”入口保留。
  - `pages/agents/new.vue` 复用为新建/编辑配置页，带 `id` 参数时回填智能体配置，保存后更新 `agent` store，并同步同 id 的智能体会话标题与摘要。
  - 智能体对话右上角在机器人会话中进入配置页；内置 `DeepSeek 智能体` 会话通过名称兜底映射到 `ds` 配置。
- **验证**:
  - `npm run build:h5` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 截图重新生成。
  - Playwright 375x844: 智能体页 4 个筛选 chip 的 `.filter-label` 均为 `display: none`，无横向溢出；卡片配置按钮数为 7。
  - Playwright 375x844: 从智能体卡片配置按钮进入配置页，标题为 `智能体配置`，底部显示 `还原` / `保存配置`。
  - Playwright 375x844: `/pages/chat/detail?id=3` 右上角进入 `#/pages/agents/new?id=ds`，显示 `DeepSeek AI` 配置页。
  - 内置 Browser 插件本轮仍未暴露 Node 执行入口，已退回本地 Playwright 真实浏览器验证。
  - 截图: `issues/screenshots/agents_mobile_config_375.png`、`issues/screenshots/agent_config_page_375.png`、`issues/screenshots/chat_agent_config_entry_375.png`。

#### Follow-up: 智能体群聊协作看板 (2026-06-06)

- **修复**:
  - 新增 `/pages/agents/board` 智能体看板页，按群聊归类展示每个智能体的任务、目标、状态、进度、产出文档和日志数量。
  - 新增 `/pages/agents/log` 智能体日志详情页，任务卡点击后进入完整页面，不再使用弹窗或 bottom-sheet。
  - 新增 `智能体方案评审群` 群聊示例，成员包含 PM 智能体、Codex、Claude Code、逻辑编织者和 Clowder 协同猫，并提供多智能体协作消息与文档示例。
  - 群聊信息页与桌面右侧群信息面板新增 `智能体看板` 功能入口；仅当当前群聊存在看板时显示，并携带 `groupId` 跳转。
  - 智能体页增加“协作看板”入口；桌面端显示文字按钮，移动端头部仅显示图标按钮。
  - 日志详情页用 Console 面板展示完整输出，保留群聊、智能体、任务目标和产出文档上下文。
  - 点击 `@他修改` 会进入对应群聊，并在输入框草稿中写入智能体 @、任务标题和具体修改说明。
- **验证**:
  - `npm run build:h5` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 截图重新生成。
  - Playwright 375x844: 看板标题为 `智能体看板`，群聊 tab 数为 2，任务卡数为 3，`@他修改` 按钮数为 3，产出文档行数为 5，无横向溢出，弹窗数量为 0。
  - Playwright 375x844: 点击 PM 智能体任务卡后跳转 `#/pages/agents/log?boardId=board-agenthub-rd&taskId=task-rd-pm`，页面标题为 `PM 智能体 · Console 日志`，Console 行数为 9，产出文档行数为 2，弹窗数量为 0，无横向溢出。
  - Playwright 375x844: 点击 `@他修改` 后跳转 `#/pages/chat/detail?id=2`，输入框草稿为 `@pm 请修改「阶段验收与风险收敛」：验收清单里缺少智能体看板入口与日志查看的 375px 移动端截图，请补充截图路径和复测结论。`
  - Playwright 375x844: 聊天列表显示 `智能体方案评审群`；进入 `/pages/chat/detail?id=agent-review` 后显示 PM 智能体、Codex 等多智能体消息，无横向溢出。
  - Playwright 375x844: `/pages/group/info?id=agent-review` 显示智能体成员和 `智能体看板` 入口，点击后跳转 `#/pages/agents/board?groupId=agent-review`。
  - Playwright 375x844: 看板页自动选中 `智能体方案评审群`，活动 tab 完整可见，无横向溢出。
  - Playwright 1440x900: 直接访问 Codex 日志页显示 `Codex · Console 日志`，Console 行数为 9，弹窗数量为 0，无横向溢出。
  - Playwright 1440x900: `/pages/group/info?id=agent-review` 显示 `智能体看板` 入口，无横向溢出。
  - 内置 Browser 插件本轮仍未暴露 Node 执行入口，已退回本地 Playwright 真实浏览器验证。
  - 截图与指标目录: `issues/screenshots/agent-board-20260606/`，断言结果见 `results.json`、`agent-group-results.json` 与 `agent-group-board-selected-result.json`。

#### Follow-up: Web 端群聊智能体看板右侧内嵌 (2026-06-06)

- **修复**:
  - `components/chat/RightWorkspace.vue` 将桌面群聊信息里的 `智能体看板` 入口改为右侧栏本地模式切换，不再 `navigateTo('/pages/agents/board')`。
  - 右侧内嵌看板展示群聊名称、摘要、任务数、文档数、完成数、每个智能体的任务/目标/进度/产出文档/Console 日志数量。
  - 任务卡保留点击进入完整 Console 日志页；`@他修改` 在当前群聊草稿中直接写入智能体 alias、任务标题和具体修改说明，并保留右侧看板上下文。
  - 移动端 `pages/group/info.vue` 行为保持不变，点击群聊信息里的看板入口继续进入完整 `/pages/agents/board?groupId=...` 页面。
- **验证**:
  - `npm run build:h5` 通过。
  - Playwright 1440x900: 打开 `#/pages/chat/detail?id=agent-review`，点击右侧群聊信息里的 `智能体看板` 后 URL 仍为 `#/pages/chat/detail?id=agent-review`，右侧栏标题为 `智能体看板`，展示 `智能体方案评审群`、3 个任务、3 个 `@他修改` 按钮、4 行产出文档，无横向溢出，按钮高度不低于 44px。
  - Playwright 1440x900: 点击 `@他修改` 后聊天输入草稿写入 `@codex 请修改「配置页复用方案实现」：...`，点击返回后右侧栏回到 `群聊信息`。
  - Playwright 375x844: 打开 `#/pages/group/info?id=agent-review`，点击 `智能体看板` 后仍跳转到 `#/pages/agents/board?groupId=agent-review`，自动选中 `智能体方案评审群`，无横向溢出。
  - 截图与断言结果: `issues/screenshots/agent-board-inline-20260606/desktop-inline-board.png`、`mobile-group-info-board-entry.png`、`mobile-full-board-after-entry.png`、`results.json`。

#### Follow-up: 文件预览文本选区引用与复制 (2026-06-06)

- **修复**:
  - `FilePreviewPanel` 对 Markdown/HTML/Word/表格/源码类预览开启文本选择，PDF/PPT/图片/压缩包/降级预览不弹出选区菜单。
  - 选中文本后显示浮动菜单，提供 `引用选中文本` 与 `复制选中文本`；引用会设置为消息回复引用条且不写入草稿，复制写入剪贴板。
  - HTML 渲染态 iframe 通过 sandbox 内 `postMessage` 桥接选区文本与坐标，保持原有沙箱隔离。
  - 修复源码高亮二次替换导致 `span style` 片段进入可见文本的问题，确保代码选区复制的是源码文本。
- **验证**:
  - `npm run build:h5` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 截图重新生成。
  - Playwright 1280x800: Markdown 渲染态选区出现 2 个菜单项，点击复制后剪贴板内容为选中文本。
  - Playwright 1280x800: 仅左键/长按产生文本选区后等待 300ms，自定义菜单数量为 0；随后对同一选区右键，自定义菜单显示 2 个菜单项。
  - Playwright 1280x800: JS 源码选区出现 2 个菜单项，选区文本为 `const selected = true;`，不包含 `color:` 或样式碎片。
  - Playwright 1280x800: PPT 预览选区/右键不显示自定义菜单。
  - Playwright 1280x800: HTML 渲染态 iframe 选中 `HTML Selection Bridge` 后父级预览显示 2 个菜单项。
  - Playwright 1440x900: 桌面聊天页从群聊右侧共享文件打开 `test.docx`，引用选中文本后输入框草稿为空，显示消息回复引用条，来源为 `test.docx`，预览单行省略。
  - 内置 Browser 插件本轮仍未暴露 Node 执行入口，已退回本地 Playwright 真实浏览器验证。

#### Follow-up: 文件预览选区引用改为消息引用类型 (2026-06-06)

- **修复**:
  - 文件预览中选择 Markdown/HTML/Word/表格/源码文本后，右键菜单的 `引用选中文本` 不再把完整引用过程写入输入框草稿，而是触发与消息回复一致的 `replyTarget` 引用条。
  - 引用条标题使用文件名作为来源，例如 `回复 test.docx`；草稿区保持空白，只保留用户手动输入内容。
  - 选区内容先折叠为空格分隔的一行并截断为 80 字符以内，输入框引用条通过 `white-space: nowrap`、`overflow: hidden`、`text-overflow: ellipsis` 单行省略显示。
- **验证**:
  - `npm run build:h5` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 视口截图已重新生成。
  - `git diff --check` 通过，仅有 Git CRLF 提示。
  - 本轮内置 Browser 插件未暴露 Node 执行入口，已回退为项目本地 Playwright 真实浏览器烟测。

#### Follow-up: 移动端与 Web 端多行输入溢出修复 (2026-06-06)

- **现象**:
  - 375x844 移动端输入 5 行文本时，真实 textarea 高度仍为 38px，但内容 `scrollHeight=105px`，文字会溢出或被挤出输入框视觉区域。
  - 1440x900 Web 端输入 18 行文本时，外层输入框被 `max-height: 160px` 限制，但 uni-app 内层 textarea 会继续增高到 378px，导致内容从父容器冒出。
- **修复**:
  - 移动端 textarea 启用 `auto-height`，外层保留 `min-height: 38px` 与 `max-height: 100px`，多行时输入框先增高再内部滚动。
  - 为 uni-app 生成的 `.uni-textarea-wrapper` / `.uni-textarea-textarea` 增加 scoped deep 约束，限制内层高度、启用 `overflow-y: auto`，并补充 `overflow-wrap: anywhere` / `word-break: break-word` 避免长文本横向溢出。
  - 移动端主输入行改为底部对齐，发送按钮在多行输入时不被 textarea 高度变化挤到中线位置。
- **验证**:
  - Playwright 375x844: 5 行输入后外层高度为 100px，内层 textarea 高度为 84px，内容在输入框内部滚动。
  - Playwright 375x844: 18 行输入后外层高度仍为 100px，`scrollHeight=378px`，未撑破输入区。
  - Playwright 1440x900: 18 行输入后内层 textarea 高度限制为 144px，外层输入框为 160px，父容器 `scrollHeight` 与可视高度一致。
  - `npm run build:h5` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 截图重新生成。

#### Follow-up: Web 端左侧会话草稿预览溢出修复 (2026-06-06)

- **现象**:
  - Web 端输入多行草稿后，左侧会话列表的 `[草稿]` 摘要会把代码/HTML 等内容按多行铺开，覆盖后续会话项。
  - Playwright 1234x768 复现：活跃会话项可视高度约 71px，但 `scrollHeight=203px`；草稿节点高度为 170px。
- **修复**:
  - `ConversationItem` 渲染草稿前先把换行、制表符和连续空白折叠为单空格，并把摘要截断到 80 字符以内。
  - 会话项、信息区、底部摘要行补充 `min-width: 0`、`overflow: hidden`，草稿/最近消息/会话名补充 block + 单行省略约束。
  - 对 uni-app 生成的 `uni-text > span` 增加 scoped deep 单行省略，避免内部 span 绕过外层截断。
- **验证**:
  - Playwright 1234x768: 10 行草稿输入后，左侧草稿节点高度为 18px，会话项 `scrollHeight` 回落到 70px，未覆盖下方会话。
  - 截图: `issues/screenshots/chat-draft-preview-20260606/desktop-draft-single-line.png`。
  - `npm run build:h5` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 截图重新生成。

#### Follow-up: 智能体页面展示用户技能列表 (2026-06-06)

- **新增**:
  - `agent` store 新增 `userSkills`，记录用户拥有的技能名称、分类、熟练度、描述、图标、色调和可调用智能体。
  - `pages/agents/index.vue` 在智能体列表上方新增“我的技能”区块，展示技能卡片、拥有数量和可调用智能体统计。
  - 智能体搜索同时匹配 `capabilityTags`，便于通过技能/能力关键词检索智能体。
- **验证**:
  - Playwright 1440x900: 智能体页显示“我的技能”，技能数量为 5，统计为 `6 个智能体可调用`，无横向溢出。
  - Playwright 375x844: 技能区保持横向滚动，页面级 `bodyScrollWidth=375`，无横向溢出。
  - 截图与断言: `issues/screenshots/agent-skills-20260606/desktop-agent-skills.png`、`mobile-agent-skills.png`、`results.json`。
  - `npm run build:h5` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 截图重新生成。

#### Follow-up: 移动端发送按钮可见性修复 (2026-06-06)

- **现象**:
  - 移动端输入框为空时，`发送` 按钮被 uni-app 默认 disabled 样式覆盖为浅灰背景和低透明文字，视觉上几乎不可见。
  - Playwright 375x844 复现：禁用态按钮实际样式为 `backgroundColor=rgb(247,247,247)`、`color=rgba(0,0,0,0.3)`、高度 `38px`。
- **修复**:
  - `MessageInput` 移动端发送按钮高度提升到 44px，满足移动端触控尺寸。
  - 显式覆盖 `.mobile-send-btn-new[disabled]` 和 `:disabled`，禁用态保留浅蓝底、边框和深灰蓝文字。
  - 激活态改为主色蓝底白字，边框与阴影同步使用主色系，状态对比更明确。
- **验证**:
  - Playwright 375x844: 禁用态按钮高度 `44px`，`backgroundColor=rgb(238,244,255)`，`color=rgb(95,111,143)`。
  - Playwright 375x844: 输入文本后激活态为主色背景 `rgb(0,74,198)`、白色文字，cursor 为 `pointer`。
  - 截图: `issues/screenshots/mobile-send-button-20260606/mobile-send-disabled.png`、`mobile-send-active.png`。
  - `npm run build:h5` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 截图重新生成。

#### Follow-up: 移动端输入框默认高度压缩 (2026-06-06)

- **现象**:
  - 移动端空输入状态下，输入框默认高度仍为 56px，底部输入区视觉偏高。
- **修复**:
  - `MessageInput` 移动端 textarea 内层最小高度从 38px 降到 30px，外层上下 padding 从 `9px/7px` 调整为 `6px/6px`。
  - 空态和单行输入默认高度控制为 44px；多行输入仍保留 auto-height，最多增长到 88px 后内部滚动。
- **验证**:
  - Playwright 375x844: 空态输入行、输入框和发送按钮高度均为 `44px`，无页面级横向溢出。
  - Playwright 375x844: 单行输入仍为 `44px`；三行输入增长到 `77px`。
  - 截图: `issues/screenshots/mobile-input-height-20260606/mobile-input-empty-compact.png`、`mobile-input-one-line-compact.png`、`mobile-input-multi-line.png`。
  - `npm run build:h5` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 截图重新生成。

#### Follow-up: 移动端输入框单行文字垂直居中 (2026-06-06)

- **现象**:
  - 移动端输入框默认高度压缩后，placeholder 和单行输入文字视觉上略偏上。
- **修复**:
  - `MessageInput` 为移动端 textarea 增加 `multiline` 状态 class。
  - 空态/单行态将 uni-app 内层 placeholder 与 textarea 行高调整为 30px，使文字在 44px 输入胶囊内视觉居中。
  - 多行态自动切回 21px 行高，保持多行输入密度和可读性。
- **验证**:
  - Playwright 375x844: 空态 placeholder、单行输入内层行高均为 `30px`，输入框整体高度仍为 `44px`。
  - Playwright 375x844: 三行输入切换为 `multiline`，内层行高为 `21px`，输入框高度为 `77px`。
  - 截图: `issues/screenshots/mobile-input-align-20260606/mobile-input-empty-centered.png`、`mobile-input-one-line-centered.png`、`mobile-input-multi-line-centered.png`。
  - `npm run build:h5` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 截图重新生成。

#### Follow-up: 智能体技能库独立页面 UI (2026-06-06)

- **新增**:
  - `pages/agents/skills.vue` 新增技能库页面，提供本地 Skill 列表、搜索/筛选、技能详情、绑定智能体、触发词、文件清单和 Markdown 文档渲染预览。
  - 技能页顶部新增 `.skill.zip` 上传占位区和 UI-only 状态标记，按钮仅给出界面示意反馈，不接真实文件上传逻辑。
  - `agent` store 新增 `localSkills` 示例数据，包含包名、版本、路径、状态、触发词、文件列表和文档正文。
  - 智能体首页新增“技能库”入口，点击已有技能卡片可带 `skillId` 进入对应技能详情。
- **验证**:
  - `npm run build:h5` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 截图重新生成。
  - Playwright 1440x900: 技能页可见上传占位、本地技能统计、代码生成详情和渲染后的 Markdown 文档，页面级 `bodyScrollWidth=1440`，无横向溢出。
  - Playwright 375x844: 技能页、详情区和文档区均可滚动查看，`bodyScrollWidth=375`，无横向溢出。
  - Playwright 375x844: “查看源码”切换后可见源码面板，无横向溢出。
  - 截图与断言: `issues/screenshots/agent-skill-page-20260606/desktop-skill-page.png`、`mobile-skill-page.png`、`mobile-skill-detail-scrolled.png`、`mobile-skill-doc-scrolled.png`、`mobile-skill-source.png`、`results.json`。

#### Follow-up: 群聊智能体成员资料与配置入口 (2026-06-06)

- **新增**:
  - 多智能体群聊中点击智能体成员时优先展示智能体资料，不再落入普通联系人资料。
  - 桌面端在右侧详情栏展示智能体名称、状态、群身份、简介、运行平台、接入方式、模型、账号引用和能力标签。
  - 移动端点击消息发送者后打开智能体信息底部弹窗，并提供“修改配置”入口。
  - “修改配置”复用现有 `/pages/agents/new?id=...` 编辑页，当前仅连接 UI 入口，不新增后端能力。
- **验证**:
  - `npm run build:h5` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 截图重新生成。
  - Playwright 1440x900: 从多智能体群聊右侧成员预览点击 Codex，右栏显示智能体资料、`DeepSeek V3` 和“修改配置”，点击后进入 `#/pages/agents/new?id=codex`。
  - Playwright 375x844: 从多智能体群聊消息发送者点击 Codex，底部弹窗显示智能体资料和“修改配置”，点击后进入 `#/pages/agents/new?id=codex`，页面级 `bodyScrollWidth=375`。
  - 截图与断言: `issues/screenshots/agent-member-profile-20260606/desktop-agent-profile.png`、`desktop-agent-edit.png`、`mobile-agent-profile.png`、`mobile-agent-edit.png`、`results.json`。

#### Follow-up: 浏览器与移动端系统通知 (2026-06-06)

- **新增**:
  - 新增 `useSystemNotification`，统一处理 H5 `Notification` 权限、App-Plus 本地推送、通知点击回跳会话和消息预览格式化。
  - 聊天页通知横幅改为调用统一授权逻辑，已授权后自动隐藏。
  - `messageStore.receiveMessage()` 收到非本人消息时更新最近消息、未读数，并在后台触发系统通知；会话免打扰和全局勿扰会抑制通知。
  - 设置页新增系统通知授权状态、声音提醒、移动端振动、勿扰模式和消息预览开关。
  - App-Plus manifest 启用 Push 模块，并补充 Android `POST_NOTIFICATIONS` 权限。
- **验证**:
  - `npm run build:h5` 通过。
  - `$env:UNI_INPUT_DIR=(Get-Location).Path; npx uni build -p app-plus` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 截图重新生成。
  - Playwright 1440x900: 设置页显示通知授权状态 `已授权`，通知设置共 9 项，页面级 `bodyScrollWidth=1440`。
  - Playwright 375x844: 设置页通知区域无横向溢出，页面级 `bodyScrollWidth=375`。
  - Playwright H5 mock: 后台 `receiveMessage('1')` 创建 1 条系统通知，`tag=agenthub-1`，`body=Browser notification test`，通知点击后写入 `active_conversation_id=1` 并回到聊天页。
  - 截图与断言: `issues/screenshots/system-notifications-20260606/desktop-settings.png`、`mobile-settings.png`、`desktop-chat-after-notification-click.png`、`results.json`。

#### Follow-up: Web 端右侧用户资料卡布局修复 (2026-06-07)

- **现象**:
  - Web 端群聊右侧打开用户资料时，`ContactCard` 被放进约 420px 窄侧栏，但仍按宽页面三列布局渲染，导致头像、姓名、在线状态、发送消息按钮和详情卡片挤压错位。
- **修复**:
  - `ContactCard` 增加 `container-type: inline-size`，通过容器查询在窄容器内自动切换为单列资料卡。
  - 窄侧栏下顶部名片改为纵向布局，发送消息按钮保持 44px 触控高度，详情卡片与更多操作改为单列。
  - 独立资料页仍保留宽屏三列布局，避免修复右栏时降低完整资料页的信息密度。
- **验证**:
  - `npm run build:h5` 通过。
  - `npm run test:smoke` 通过，基础 375/768/1024/1440 截图重新生成。
  - Playwright 1536x768: 群聊右侧用户资料 pane 宽度约 `421px`，顶部名片 `flex-direction=column`，详情 grid 为单列 `372px`，更多操作为单列，发送按钮高度 `44px`，头像/按钮无重叠，页面级 `bodyScrollWidth=1536`。
  - Playwright 1440x900: 独立资料页仍为宽屏布局，顶部名片 `flex-direction=row`，详情 grid 保持三列，无横向溢出。
  - 截图与断言: `issues/screenshots/contact-profile-card-20260607/desktop-chat-contact-profile-fixed.png`、`desktop-standalone-contact-profile.png`、`results.json`。
