# [ISSUE-022] 智能体返回 HTML 文件后点击预览未打开可识别预览

**状态**：Open
**创建时间**：2026-06-09
**标签**：bug / agent / file-preview / html
**AI修复模式**：Direct Fix
**计划路径**：N/A

---

## 问题描述

验收智能体返回 HTML 代码/文件时，聊天中能显示智能体发送的 HTML 文件卡片 `agent-preview-20260608161757.html`，但点击文件卡片的 `预览` 后，右侧没有切换到可识别的 HTML 预览状态，断言 `html code/file from agent can be previewed` 失败。

本次证据目录：

`seedcmp/sections/ui/.ai/tests/ui-agent-chain-20260608161757/`

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

---

## 关闭备注

待修复后复测：智能体返回 HTML 文件后，点击 `预览` 能打开右侧预览面板，并展示源码或安全渲染结果。
