# V2-25 右侧文件预览与 AI 代码复制/HTML 预览

## Status

Resolved

## Reported At

2026-05-26 CST

## Labels

feature, ux, ai, file-preview

## Priority

P1

## User Request

实现文件的全右侧预览：文件预览展示在聊天窗口右侧，而不是弹窗；AI 回复中的 HTML 代码页面也可以在右侧预览；AI 回复中的 coding 类代码块增加复制按钮，让用户一键复制代码内容。

## Problem

当前文件消息预览由 `FileCell.vue` 内部弹窗承载。弹窗会遮挡聊天上下文，用户查看文件时无法继续阅读或对照会话内容，也不适合长文档、HTML 页面、PDF 这类需要持续浏览的内容。

AI 回复已支持 Markdown 渲染，但代码块只是静态文本。用户遇到代码回答时，需要手动选中复制；遇到 HTML 页面代码时，无法直接在聊天侧边预览运行结果，体验不完整。

## Expected Behavior

- 点击文件消息的“预览”后，聊天窗口右侧打开常驻预览面板，左侧消息列表和输入框仍可使用。
- 右侧预览面板支持当前已具备的文件类型：Markdown、文本、HTML、PDF，以及 Office 安全降级说明。
- 再次点击其他文件或 AI HTML 代码块预览时，右侧面板内容切换，不叠加多个弹窗。
- 右侧面板可关闭；切换会话时清空或重置当前预览，避免跨会话显示旧文件。
- AI 回复中的代码块展示复制按钮；点击后复制完整代码块内容，并给出轻量成功/失败反馈。
- AI 回复中的 HTML 代码块展示“预览”入口；点击后右侧面板用 sandbox iframe 预览该 HTML，不执行父页面权限。
- HTML 预览失败或内容为空时，在右侧面板展示明确的空态/错误态，不影响聊天。
- 窄屏或移动宽度下右侧面板降级为全屏抽屉/覆盖层，保证消息区和预览内容不挤压错位。

## Non-Goals

- 不在本 issue 内实现 Office 文档在线解析服务。
- 不把 AI 生成的 HTML 保存成文件，也不新增后端存储接口。
- 不让 HTML 预览获得脚本、弹窗、表单提交、同源访问等高权限。
- 不改动 AI 回复持久化和排序逻辑，继续沿用 V2-24 的去重、排序和历史恢复规则。

## Design Proposal

### 1. 会话级右侧预览面板

在 `ChatView.vue` 层维护当前预览状态，因为预览面板属于当前会话工作区，而不是单条消息气泡内部 UI。

建议新增 `ChatSidePreview.vue`：

- `type`: `file-markdown | file-text | file-html | file-pdf | file-office | ai-html`
- `title`: 面板标题
- `subtitle`: 文件名、代码语言、来源消息等辅助信息
- `sourceUrl`: 文件/PDF iframe URL
- `sourceText`: Markdown、文本或 HTML 字符串
- `loading`: 文本类文件 fetch 状态
- `error`: 预览失败说明

`ChatView.vue` 改为两列布局：

- 左侧：现有 header、message list、input。
- 右侧：仅当 `sidePreview.visible === true` 时显示预览面板。

桌面建议宽度：`clamp(360px, 36vw, 560px)`；聊天主列 `minmax(0, 1fr)`。窄屏下右侧面板改为覆盖式抽屉。

### 2. 文件预览事件上提

将 `FileCell.vue` 的弹窗预览职责迁移到会话级面板。

推荐方式：

- `FileCell.vue` 只负责展示文件卡片、判断可预览类型、触发 `preview` 事件。
- `MessageList.vue` 接收 `FileCell @preview`，继续向上 emit `open-preview`。
- `ChatView.vue` 统一处理 `open-preview`，对 Markdown/文本/HTML 文件执行 fetch，对 PDF/Office 直接构建面板状态。

这样文件气泡保持轻量，右侧面板的加载、关闭、切换、响应式规则集中维护。

### 3. AI 代码块复制与 HTML 预览

现有 `renderMarkdown()` 返回字符串，难以绑定 Vue 事件。建议将 Markdown 代码块渲染扩展为“带元数据的安全 HTML”，并用事件委托处理按钮点击。

建议改造点：

- `packages/base-vue/src/utils/markdown.ts`
  - 解析 fenced code 语言标记，例如 ```html、```vue、```ts。
  - 为代码块输出稳定结构：
    - `.markdown-code-block`
    - `.markdown-code-header`
    - `.markdown-code-lang`
    - `button[data-code-action="copy"]`
    - `button[data-code-action="preview-html"]`，仅 HTML 类语言显示
    - `code[data-code-index="N"]`
  - 代码文本继续 HTML escape，避免 XSS。
- `TextCell.vue`
  - 对 Markdown 容器监听点击事件。
  - 点击复制按钮时，从代码块元数据或 DOM textContent 获取完整代码，并调用 `navigator.clipboard.writeText()`。
  - 点击 HTML 预览按钮时 emit `preview-code`，payload 包含 `language`、`code`、`messageId/clientMsgNo`。
- `MessageList.vue`
  - 接收 `TextCell @preview-code` 并向上 emit `open-preview`。
- `ChatView.vue`
  - 将 AI HTML 代码构造成 `ai-html` 类型预览，使用 sandbox iframe `srcdoc` 渲染。

### 4. 安全与降级

- 文件 URL 继续通过 `normalizeMediaUrl()` 处理，沿用 V2-13 的 LAN 可访问策略。
- Markdown 渲染必须默认转义 HTML；不要因为 HTML 代码块预览而让普通 Markdown 直接执行 HTML。
- AI HTML 预览使用 `<iframe sandbox="">`，默认不授予脚本执行权限。
- 复制 API 不可用或被浏览器拒绝时，显示失败提示；不弹原生 alert。
- 文件 fetch 失败时，右侧面板显示错误并保留“打开/下载”动作。

## Related Code

- `sections/im_web/apps/chat/src/views/ChatView.vue`
  - 持有右侧预览状态，布局改为聊天区 + 预览区。
- `sections/im_web/apps/chat/src/components/MessageList.vue`
  - 转发文件预览和 AI 代码预览事件。
- `sections/im_web/packages/base-vue/src/components/messages/FileCell.vue`
  - 移除内部弹窗职责，改为 emit 文件预览请求。
- `sections/im_web/packages/base-vue/src/components/messages/TextCell.vue`
  - 支持 Markdown 代码块复制和 HTML 代码块预览事件。
- `sections/im_web/packages/base-vue/src/utils/markdown.ts`
  - 输出带代码块操作按钮的安全 Markdown HTML。
- 建议新增：`sections/im_web/apps/chat/src/components/ChatSidePreview.vue`
  - 统一渲染文件、PDF、Office 降级、AI HTML 预览。

## Acceptance Criteria

- [x] 文件消息点击“预览”后不再打开弹窗，而是在聊天窗口右侧打开预览面板。
- [x] Markdown、文本、HTML、PDF 文件在右侧面板中可预览；Office 文件展示安全降级说明和打开/下载入口。
- [x] 右侧预览面板打开时，消息列表仍可滚动，输入框仍可发送消息。
- [x] 切换预览目标时右侧面板内容正确替换，无残留 loading/error 状态。
- [x] 关闭右侧面板后，聊天主区域恢复完整宽度。
- [x] 切换会话后不会保留上一会话的文件或 AI HTML 预览。
- [x] AI 回复的 fenced code block 显示复制按钮，点击后复制完整代码内容。
- [x] 复制成功/失败使用组件级轻提示，不使用浏览器原生 alert。
- [x] AI 回复中的 HTML 代码块显示预览按钮，点击后在右侧面板展示 HTML 页面效果。
- [x] HTML 预览 iframe 使用 sandbox，普通 Markdown 渲染仍然默认转义 HTML。
- [x] 680px 左右窄屏下预览面板不挤压消息气泡，不产生文本重叠或横向错位。
- [x] 浏览器可视化测试覆盖文件右侧预览、AI 代码复制、AI HTML 预览和响应式状态，console/network 无新增错误。

## Verification Plan

### Unit / Contract Tests

- `apps/chat/tests/filePreviewVoiceAiContracts.test.ts`
  - 覆盖 `FileCell` 不再含弹窗结构，改为暴露/触发预览事件。
  - 覆盖 `ChatSidePreview` 对 Markdown、文本、HTML、PDF、Office 类型的渲染分支。
  - 覆盖 AI HTML 代码块可生成 preview action。
- `apps/chat/tests/messageActions.test.ts`
  - 覆盖 AI Markdown 代码块复制按钮不会影响消息排序、去重、历史恢复。
- `packages/base-vue` 相关测试
  - 覆盖 `renderMarkdown()` 对 fenced code 语言、复制按钮、HTML 预览按钮、HTML escape 的输出契约。

### Build Gates

```bash
cd sections/im_web && pnpm type-check
cd sections/im_web && pnpm build
cd sections/im_web && pnpm --filter chat exec vitest run tests/filePreviewVoiceAiContracts.test.ts tests/messageActions.test.ts --pool=threads --poolOptions.threads.singleThread=true
```

### Browser Smoke

1. 登录 Web IM。
2. 打开任意会话。
3. 发送或选择 Markdown/HTML/PDF 文件消息，点击“预览”。
4. 确认右侧面板打开，聊天区仍可滚动和发送消息。
5. 打开 DeepSeek AI 会话，让 AI 回复包含 HTML 代码块。
6. 点击代码块复制按钮，确认剪贴板内容等于代码块文本。
7. 点击 HTML 预览按钮，确认右侧面板显示 HTML 页面效果。
8. 切换会话后确认右侧预览被清空。
9. 以 680px 视口复查预览面板响应式表现。

## Implementation Notes

- 优先保持 `apps/chat` 为预览编排层，`packages/base-vue` 只提供消息单元格和 Markdown 渲染能力。
- 不建议把右侧预览状态放进 datasource store；它是当前页面临时 UI 状态，不需要持久化。
- 如果仍保留 `FileCell.vue` 的内部预览逻辑作为兼容路径，需要确保新路径默认使用右侧面板，且测试明确弹窗不会在 chat 内触发。
- 注意同名 `.js/.ts` 运行时差异：如果修改了 workspace 包源码，需要确认浏览器实际加载的是 `.ts` 源或同步旧 `.js`，避免重现 V2-24 的测试通过但页面走旧代码问题。

## Open Questions

- HTML 预览是否允许执行 `<script>`？当前建议为不允许，使用空 sandbox，优先保证安全。
- 复制按钮是否只对 AI 回复显示，还是所有 Markdown 代码块显示？当前建议先对所有 Markdown 代码块显示，AI 回复是主验收路径。
- 窄屏下右侧预览是覆盖整个聊天区，还是从右侧抽屉覆盖 90% 宽度？当前建议覆盖式抽屉，顶部保留关闭按钮。

## Fix Record

### 2026-05-26

已完成以下修复：

1. `sections/im_web/apps/chat/src/components/ChatSidePreview.vue`
   - 新增会话级右侧预览面板，支持 Markdown、文本、HTML、PDF、Office 降级和 AI HTML 预览。
   - HTML 与 AI HTML 均通过 `iframe sandbox=""` 渲染，默认不授予脚本权限。
   - 桌面侧栏宽度为 `clamp(360px, 36vw, 560px)`，680px 左右窄屏下覆盖式展示。
2. `sections/im_web/apps/chat/src/views/ChatView.vue`
   - 新增 `sidePreview` 页面状态和文件/AI 代码预览编排。
   - 聊天页改为主聊天列 + 右侧预览列布局。
   - 切换会话或关闭面板时清空预览状态；文件文本类预览加入 request id，避免快速切换时旧 fetch 覆盖新预览。
3. `sections/im_web/apps/chat/src/components/MessageList.vue`
   - 接收 `FileCell @preview` 和 `TextCell @preview-code`，统一向 `ChatView` 转发 `open-preview`。
4. `sections/im_web/packages/base-vue/src/components/messages/FileCell.vue`
   - 移除内部弹窗预览职责。
   - 保留文件类型识别与“预览/打开”动作，预览改为 emit 会话级事件。
5. `sections/im_web/packages/base-vue/src/components/messages/TextCell.vue`
   - Markdown 区域通过事件委托处理代码块复制与 HTML 预览。
   - 复制成功/失败在按钮文本内给出轻反馈，不使用原生 alert。
6. `sections/im_web/packages/base-vue/src/utils/markdown.ts`
   - fenced code block 输出带语言、复制按钮和 HTML 预览按钮的安全结构。
   - 代码文本继续 HTML escape，普通 Markdown 不执行原始 HTML。
7. `sections/im_web/packages/base-vue/src/index.ts`
   - 导出 Markdown 工具，供聊天侧边预览复用。
8. `sections/im_web/apps/chat/tests/filePreviewVoiceAiContracts.test.ts`
   - 更新 V2-25 契约测试，覆盖右侧面板、文件预览事件上提、代码块复制、HTML 预览和 HTML escape。

## Verification Evidence

- `cd sections/im_web && pnpm --filter chat exec vitest run tests/filePreviewVoiceAiContracts.test.ts tests/messageActions.test.ts --pool=threads --poolOptions.threads.singleThread=true`
  - Passed: 2 files, 27 tests.
- `cd sections/im_web && pnpm type-check`
  - Passed.
- `cd sections/im_web && pnpm build`
  - Passed; Vite produced `apps/chat/dist`.
  - Note: build still reports the existing large chunk warning for `index-*.js`.
- Browser visual audit:
  - Script: `/tmp/v2-25-audit.cjs`
  - Target: `http://localhost:3000`
  - Summary: `sections/im_web/.ai/V2.0/issues/tests-e2e/v2-25-right-side-preview-20260526/summary.md`
  - Screenshots:
    - `sections/im_web/.ai/V2.0/issues/imgs/v2-25-right-side-preview-20260526/01-desktop-side-preview.png`
    - `sections/im_web/.ai/V2.0/issues/imgs/v2-25-right-side-preview-20260526/02-responsive-680-side-preview.png`
  - Result: desktop preview width 518.39px, chat composer remains visible, copy and HTML preview buttons exist, iframe sandbox is empty, 680px preview covers width without horizontal overflow, no console warnings/errors, no failed requests/responses.

## Close Note

V2-25 已完成。文件预览迁移为聊天右侧常驻面板；AI Markdown 代码块支持一键复制，HTML 代码块可在同一右侧面板中安全预览。
