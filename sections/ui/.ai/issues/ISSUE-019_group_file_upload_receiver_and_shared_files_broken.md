# [ISSUE-019] 群聊文件上传接收方不可见且共享文件入口未切换右侧文件功能

**状态**：Open
**创建时间**：2026-06-09
**标签**：bug / group-chat / file / h5

---

## 问题描述

验收群聊文件上传和共享文件入口时，发送方能通过文件选择器发送 `upload-20260608160100.md`，且发送方聊天区显示文件卡片；但接收方未看到该上传文件。随后点击右侧群信息中的 `共享文件`，也没有按预期切换右侧内容为当前群聊的文件功能。

本次证据目录：

`sections/ui/.ai/tests-e2e/ui-group-deep-20260608160100/`

关键截图：

1. `13-b-file-upload.png`
2. `14-a-file-received.png`
3. `15-b-shared-files-click.png`

---

## 复现步骤

1. 打开 `http://100.79.157.76:5173/`。
2. 使用 `13733632709` 和 `18337488675` 分别登录。
3. 进入真实群 `UI深验群-160100`。
4. 由 `13733632709` 上传 `upload-20260608160100.md`。
5. 在发送方确认文件卡片可见。
6. 在 `18337488675` 端查看同一群聊消息。
7. 在发送方右侧群信息点击 `共享文件`。

---

## 相关代码

```js
// sections/ui/services/native-im/service.js
const contentType = mediaType === 'image' ? 2 : 8;
content = shared.getMessageContent(contentType);
content.url = url;
content.name = fileName;
content.size = fileSize;
content.content = mediaType === 'image' ? '[图片]' : `[文件] ${fileName || ''}`.trim();
```

```js
// sections/ui/components/chat/GroupInfoPanel.vue
function handleSharedFilesClick() {
  if (sharedFiles.value.length > 0) {
    emit('preview-file', sharedFiles.value[0]);
    return;
  }
  uni.showToast({ title: '暂无共享文件', icon: 'none' });
}
```

```vue
<!-- sections/ui/components/chat/RightWorkspace.vue -->
<button
  :class="['workspace-tab', groupWorkspaceMode === 'files' ? 'active' : '']"
  @click="groupWorkspaceMode = 'files'"
>
  <AppIcon name="files" :size="14" color="var(--color-text-secondary)" />
  <text>文件</text>
</button>
```

---

## 根因分析

文件发送当前能在发送方形成本地文件卡片，但接收方没有同步显示，说明真实 IM 文件消息的发送、同步、归一化或会话消息插入链路至少有一处不完整。

共享文件入口也存在交互不一致：右侧工作区已有 `groupWorkspaceMode = 'files'` 的文件 tab，但 `GroupInfoPanel.vue` 中点击 `共享文件` 只会预览第一条文件或提示 `暂无共享文件`，没有发出切换到当前群文件功能的事件。因此即使右侧存在文件 tab，群信息里的 `共享文件` 行也不能按用户预期切换过去。

---

## 问题列表（Q&A 迭代）

### Q1: 文件选择器是否不可用？
**A1**: 不是。`file upload picker can send file` 和 `uploaded file card visible in sender chat` 均通过。

### Q2: 接收方是否只是不刷新？
**A2**: 本轮等待和重新查看后仍未看到 `upload-20260608160100.md`，验收断言失败。

### Q3: 点击共享文件的期望是什么？
**A3**: 用户明确要求点击共享文件后，右侧显示内容应切换为当前群聊的文件功能，而不是直接预览第一条文件或 toast。

---

## 修复建议

1. 检查 WKSDK content type 8 文件消息的真实 payload，确保接收方同步后能被 `normalizeMessage` 识别为文件消息。
2. 接收方收到文件消息后，应插入当前群消息列表并出现在共享文件集合中。
3. `GroupInfoPanel.vue` 的 `共享文件` 点击应 emit 一个切换文件工作区事件，由 `RightWorkspace.vue` 设置 `groupWorkspaceMode = 'files'`。
4. 增加双账号回归：B 上传文件后 A 可见文件卡片；点击共享文件后右侧进入当前群文件列表。

---

## 测试结果

```bash
cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://100.79.157.76:5173' \
     API_BASE='http://100.79.157.76:3000/v1' \
     REPO_ROOT='/media/leng/DiskB1/exp/seedcmp' \
     node run.js /tmp/playwright-test-sections-ui-group-deep.js

# exit 1
# PASS: file upload picker can send file
# PASS: uploaded file card visible in sender chat
# FAIL: uploaded file visible to receiver
# FAIL: click shared files action is available
```

---

## 关闭备注

待修复后复测：群聊文件发送后双账号都可见文件卡片，共享文件入口切换到当前群的右侧文件列表，并能看到刚上传的文件。
