# [ISSUE-044] 智能体产物预览使用错误文件路径

**状态**：Resolved
**创建时间**：2026-06-10
**标签**：bug, regression, clowder, file-preview, workspace
**AI修复模式**：Direct Fix
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

**修复执行规则**：
- Direct Fix 必须使用 TDD：先补/确认失败回归测试，再改实现，再验证。
- 若涉及前端页面、截图或交互验收，必须使用 Playwright 实测。
- 测试截图和日志保存到 `.ai/tests/<issue-id>-<timestamp>/`。
- 完成前使用 `verification-before-completion`，确认验证结果后再说完成。

---

## 问题描述

用户在智能体会话中看到右侧预览文件和智能体回复里声明的文件不一致；例如智能体回复说生成了 `slides/presentation.pptx`，但右侧仍预览旧的 Markdown 文件，或点击产物文件后没有渲染真实内容。

截图现象：
- 右侧文件预览标题仍是 `快慢指针-数据结构课汇报.md`。
- 后续智能体回复声明实际交付 `slides/presentation.pptx`，但没有对应真实 PPTX 预览。

## 期望行为

1. 智能体给出的 workspace 相对路径（例如 `slides/presentation.pptx`）必须被当作 Clowder workspace 文件路径，不得当作前端 `/assets` 静态资源或 `localhost:5173/slides/...`。
2. 文件卡片和右侧预览必须使用同一份文件 metadata；用户点击“预览”后，右侧标题、类型、内容都对应被点击的产物。
3. Markdown/文本走 workspace text API；PPTX/DOCX/XLSX/PDF 等二进制预览/下载走 workspace raw/download API。
4. 桌面和移动端都能预览真实智能体产物，不出现旧文件残留或空白。

## 根因分析

1. 前端智能体文件归一化曾把 `slides/presentation.pptx` 这类 workspace 相对路径当成可直接访问 URL，导致 H5 侧请求 `localhost:5173/slides/...` 或回退到 `/assets/<name>`，预览内容可能命中旧静态资源。
2. `FilePreviewPanel` 在没有真实 URL 时会继续拼 `/assets/<name>`，对 Clowder 产物缺少“workspace 文件必须走 workspace API”的保护。
3. 移动端跳转预览时只传了部分文件字段，并且把文件消息的 `content` 当作 `previewContent` 兜底；智能体文件的 `content` 通常只是文件名，导致移动端直接渲染文件名而不再请求真实文件。
4. TangSeng Clowder bridge 缺少 workspace file/raw 透传路由；Clowder raw endpoint 也只允许媒体类型，PPTX/Markdown/源码等智能体产物无法通过统一 raw 入口预览。

## 修复记录

1. `message-state.js` 归一化智能体产物时区分可访问 URL 和 workspace 相对路径；带 `worktreeId + path` 的产物统一生成 `/v1/clowder/workspace/file/raw?...`，并保留 `path/workspacePath/worktreeId/generatedByAgent`。
2. `FilePreviewPanel.vue` 增加 workspace raw URL 解析；workspace-backed 文件没有有效 URL 时不再回退 `/assets`，避免旧文件/硬编码资源污染预览。
3. `pages/chat/index.vue` 与 `pages/chat/detail.vue` 共用 `services/native-im/file-preview.js` 的预览参数编码，移动端继续携带 workspace metadata，且不把文件名当作 inline preview content。
4. TangSeng 增加 `/v1/clowder/workspace/file` 与 `/v1/clowder/workspace/file/raw` 代理；raw 代理保留上游 `Content-Type/Cache-Control/Content-Disposition` 与原始字节。
5. Clowder workspace raw endpoint 放开 Markdown、源码、PDF、Office 文档等受控预览类型，继续保留 path traversal 与 denylist 防护。

## 测试结果

证据目录：`sections/ui/.ai/tests/ISSUE-044-20260610204601/`

Red：
- `npm-test-native-im-red.log`：前端归一化未保留 workspace path/raw URL。
- `clowder-workspace-raw-red.log`：Clowder raw endpoint 拒绝 Markdown/PPTX 产物。
- `go-test-workspace-raw-proxy-red.log`：TangSeng workspace raw proxy 路由缺失。
- `npm-test-preview-payload-red.log`：移动端预览参数 helper 缺失前的回归单测红灯。
- `mobile-error-state.json` / `mobile-error-preview-timeout.png`：移动端曾把文件名渲染为正文、未命中 raw API。

Green：
- `cd sections/ui && npm run test:native-im`
  - 日志：`npm-test-native-im-full.log`
  - 结果：100/100 pass。
- `cd sections/ui && node .ai/tests/ISSUE-044-20260610204601/verify-workspace-artifact-preview.mjs`
  - 日志：`playwright-verify.log`
  - 结果：desktop 1440x900 与 mobile 390x844 均通过；raw URL 命中 `worktreeId=seedcmp&path=slides/lesson.md`；无 `/assets` 或 `/slides` 静态回退请求。
  - 截图：`desktop-01-workspace-artifact-preview.png`、`mobile-01-workspace-artifact-preview.png`。
- `cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder -count=1`
  - 日志：`go-test-clowder-full.log`
  - 结果：pass。
- `cd sections/clowder-ai/packages/api && node --test test/workspace-raw-endpoint.test.js`
  - 日志：`clowder-workspace-raw-full.log`
  - 结果：14/14 pass。
- `cd sections/clowder-ai/packages/api && pnpm run build`
  - 日志：`pnpm-build-clowder-api-full.log`
  - 结果：pass。
- `cd sections/ui && npm run build:h5`
  - 日志：`npm-build-h5.log`
  - 结果：pass；仅有既有 Sass/uni-app 构建警告。

---

## 关闭备注

已验证智能体产物预览不再使用前端硬编码路径；桌面右侧预览与移动端文件预览页都会渲染点击文件对应的 workspace raw 内容。
