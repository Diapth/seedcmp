# [ISSUE-022] 智能体返回 HTML 文件后点击预览未打开可识别预览

**状态**：Resolved
**创建时间**：2026-06-09
**标签**：bug / agent / file-preview / html

---

## 问题描述

验收智能体返回 HTML 代码/文件时，聊天中能显示智能体发送的 HTML 文件卡片 `agent-preview-20260608161757.html`，但点击文件卡片的 `预览` 后，右侧没有切换到可识别的 HTML 预览状态，断言 `html code/file from agent can be previewed` 失败。

本次证据目录：

`sections/ui/.ai/tests-e2e/ui-agent-chain-20260608161757/`

关键截图：

1. `04-agent-html-preview.png`

---

## 复现步骤

1. 打开 `http://100.79.157.76:5173/` 并登录。
2. 创建自定义智能体 `测试名称161757`。
3. 打开该智能体单聊。
4. 让智能体返回 HTML 文件，例如 `agent-preview-20260608161757.html`。
5. 点击文件卡片中的 `预览`。
6. 观察右侧预览区域是否打开并展示 HTML 源码或渲染预览。

---

## 相关代码

```vue
<!-- sections/ui/components/chat/FileCard.vue -->
<button
  class="file-action-btn btn-preview"
  :disabled="!canPreview"
  @click.stop="previewFile"
>
  <text class="btn-text">预览</text>
</button>
```

```js
// sections/ui/components/chat/FileCard.vue
const previewExtensions = [
  'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv',
  'md', 'markdown', 'html', 'htm', 'txt', 'json',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'pdf',
  'js', 'ts', 'jsx', 'tsx', 'css', 'less', 'scss', 'vue',
  'py', 'java', 'cpp', 'c', 'go', 'sql', 'sh', 'xml', 'yaml', 'yml'
];
```

```js
// sections/ui/components/chat/FilePreviewPanel.vue
watch(() => props.file, (newFile) => {
  if (newFile) {
    const rawType = newFile.fileType || newFile.ext || newFile.type || getTypeFromName(newFile.name || newFile.fileName || '');
    const detectedType = String(rawType || 'file').toLowerCase();
    showRender.value = !['html', 'htm'].includes(detectedType);
    loadSourceFileContent();
  }
}, { immediate: true });
```

---

## 根因分析

`FileCard.vue` 已允许 `html/htm` 预览，但本轮点击后页面仍停留在聊天详情 URL，未出现可识别的右侧 HTML 预览内容。可能原因包括：

1. HTML 文件消息来自智能体产物时只有 `previewContent`，没有浏览器可 fetch 的 `url/sourceUrl/contentUrl`，`FilePreviewPanel` 的内容加载路径未正确使用内联 `previewContent`。
2. 预览事件未稳定打开右侧 `FilePreviewPanel`，或打开后内容为空/状态文案不含 HTML 文件名。
3. HTML 默认 `showRender=false`，但源码视图在无远程 URL 时没有渲染内联内容。

---

## 问题列表（Q&A 迭代）

### Q1: HTML 文件卡片是否出现？
**A1**: 出现。`created agent can send html file content` 断言通过。

### Q2: 是否所有文件预览都失败？
**A2**: 本 issue 只覆盖本轮发现的智能体 HTML 文件预览失败。Markdown/普通文件预览需要单独回归确认。

### Q3: 是否和 ISSUE-008 重复？
**A3**: 不完全重复。ISSUE-008 已解决“智能体文件回复可作为文件卡片出现”；本 issue 是文件卡片出现后，HTML 预览交互仍失败。

---

## 修复建议

1. `FilePreviewPanel` 对智能体生成文件优先支持 `previewContent/contentText/markdown/text` 内联内容，不要求必须有可 fetch URL。
2. HTML 文件进入预览后应显示文件名、源码视图，并可切换安全渲染预览。
3. 点击文件卡片 `预览` 后应稳定打开右侧预览面板或移动端预览页。
4. 增加回归：智能体返回 `.html` 文件卡片，点击 `预览` 后出现 HTML 源码或渲染结果。

---

## 修复记录

1. `sections/ui/services/native-im/message-state.js`
   - `normalizeAgentFile()` 对 `html/htm/md/txt/json/js/css/vue/py/...` 等文本类智能体产物，将 `file.content` 作为内联 `previewContent` 兜底保留。
   - 继续保持文件卡片 `content` 为文件名，避免消息气泡把 HTML 正文误当作文件名显示。
2. `sections/ui/pages/chat/index.vue`
   - 移动端文件预览跳转参数的 `previewContent` 增加 `file.content` 兜底。
3. `sections/ui/pages/chat/detail.vue`
   - 同步移动端详情页文件预览参数兜底。
4. `sections/ui/pages/group/info.vue`
   - 群信息共享文件预览跳转参数同步保留内联正文。
5. `sections/ui/tests/native-im.test.mjs`
   - 增加智能体 HTML 文件 final 事件回归，断言 `previewContent` 保留 HTML 正文且 `fileType=html`。

---

## 测试结果

```bash
cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://100.79.157.76:5173' \
     API_BASE='http://100.79.157.76:3000/v1' \
     REPO_ROOT='/media/leng/DiskB1/exp/seedcmp' \
     DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
     node run.js /tmp/playwright-test-sections-ui-agent-chain.js

# exit 1
# PASS: created agent can send html file content
# FAIL: html code/file from agent can be previewed
```

修复后验证：

```bash
cd sections/ui && node --test tests/native-im.test.mjs
# exit 0
```

```bash
cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://127.0.0.1:5173' \
     OUT_DIR='/tmp/seedcmp-new-ui-issuefix/sections/ui/.ai/tests-e2e/ISSUE-022-agent-html-preview' \
     node run.js /tmp/playwright-issue-022-visual.js
# exit 0
# PASS desktop html source preview opens from generated agent file
# PASS desktop html render preview opens from inline srcdoc
# PASS mobile html source preview keeps inline content through route params
```

截图证据：

1. `sections/ui/.ai/tests-e2e/ISSUE-022-agent-html-preview/01-desktop-html-source-preview.png`
2. `sections/ui/.ai/tests-e2e/ISSUE-022-agent-html-preview/02-desktop-html-render-preview.png`
3. `sections/ui/.ai/tests-e2e/ISSUE-022-agent-html-preview/03-mobile-html-source-preview.png`

---

## 关闭备注

已复测：智能体返回 HTML 文件后，桌面端点击 `预览` 可打开右侧源码视图并切换安全渲染预览；移动端跳转文件预览页后仍保留内联 HTML 正文。
