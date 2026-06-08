# [V2-10] 单聊及群聊图片与文件发送功能未完全打通

**状态**：Resolved
**创建时间**：2026-05-24
**标签**：bug / ux / message-ui
**优先级**：P1

---

## 问题描述

在进行双账号浏览器可视化自动测试时，发现单聊和群聊的消息输入框虽然提供了精致的“选择图片”和“选择文件”按钮，且点击后可以唤起系统的文件管理器，甚至包含了文件大小、格式等检测前置逻辑，但是：
在选中文件并点击发送后，发送操作被静态逻辑拦截，弹出 ArcoMessage 提示：
- 发送图片时提示：`“图片发送能力正在完善，当前先保留显式入口与文件检测”`
- 发送文件时提示：`“文件发送能力正在完善，当前先保留显式入口与文件检测”`

这属于不完整的功能交付，在 UI 逻辑和交互常理上存在瑕疵，会令终端用户在使用多媒体消息时产生极大的挫败感。

### 关联截图
- `sections/im_web/.ai/V2.0/issues/imgs/two-account-audit-2026-05-24/15-B-chat-A-send-image-file.png`

---

## 复现步骤

1. 打开并登录 IM Web 系统（如 `http://localhost:3000`）。
2. 进入任意单聊或群聊聊天室。
3. 在底部输入框的工具栏中，点击“选择图片”或“选择文件”图标。
4. 在弹出的系统文件管理器中选中一张图片或一个普通文件。
5. **实际表现**：界面没有真正将图片或文件上传至服务器或发送出去，而是直接弹出了能力正在完善的提示，并且中断了流程。
6. **预期表现**：应通过文件上传接口将文件上传至存储服务器，获得 URL 后，通过 WuKongIM SDK 组装 `ImageContent` 或 `FileContent`，并调用 SDK 接口发送消息。或在未打通时，对两个按钮做置灰禁用处理并悬浮 Tooltip 解释说明。

---

## 相关代码

在 `apps/chat/src/components/MessageInput.vue` 中（第 134-146 行）：

```typescript
async function sendSelectedFile(file: File) {
  if (!file) return;
  try {
    uploadHint.value = file.type.startsWith('image/') ? `正在发送图片: ${file.name}` : `正在发送文件: ${file.name}`;
    if (file.type.startsWith('image/')) {
      ArcoMessage.info('图片发送能力正在完善，当前先保留显式入口与文件检测');
      return;
    }
    ArcoMessage.info('文件发送能力正在完善，当前先保留显式入口与文件检测');
  } finally {
    uploadHint.value = '';
  }
}
```

---

## 根因分析

1. **多媒体发送功能未对接**：目前前端只实现了触发文件选择和设置 hint 提示的逻辑，尚未集成底层的文件上传协议，也没有与后端的附件存储（如 minio 或 oss）对接，因此无法生成多媒体消息体所必须的 `url`。
2. **SDK 发送消息体组装缺失**：尚无对 `WKSDK.shared().chatManager.send` 发送 `ImageContent` / `FileContent` 的实际逻辑封装。

---

## 问题列表（Q&A 迭代）

### Q1: 当前后端 TangSengDaoDaoServer 是否提供了文件上传 API？
**A1**: 是。`TangSengDaoDaoServer/modules/file/api.go` 提供 `GET /v1/file/upload` 获取上传 URL，`POST /v1/file/upload` 接收 multipart `file` 与 `contenttype`，返回 `file/preview/...` 路径。既有 React 版本 `TangSengDaoDaoWeb/packages/tsdaodaodatasource/src/task.ts` 也使用 `type=chat` 上传聊天附件。

### Q2: 在打通之前，应该如何优化 UI 表现以符合交互常理？
**A2**: 本轮已选择直接打通发送能力，不再需要临时置灰。若后端上传失败，输入框会显示失败提示并保留入口。

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 1 Build Gate | `pnpm type-check && pnpm lint && pnpm test:unit && pnpm build && pnpm test:e2e` | ✅ Pass |
| Layer 3 Store | `messageMediaSending.test.ts` 覆盖图片 type=2、文件 type=8、multipart 上传、SDK send | ✅ Pass |
| Layer 5 E2E | 双账号图片/文件发送，检测不再出现“能力正在完善”拦截提示 | ✅ Pass，见 `tests-e2e/two-account-audit-2026-05-24T05-09-53-941Z/summary.md` |

---

## 修复记录

### 2026-05-24
- 在 `packages/datasource-vue/src/stores/messageStore.ts` 新增 `sendMediaMessage()`：先通过 `commonApi.getUploadUrl()` 获取聊天附件上传 URL，再用 multipart `file` + `contenttype` 上传，最后组装 `MessageImage` 或 `MessageFile` 并调用 `WKSDK.shared().chatManager.send()`。
- 在 `packages/datasource-vue/src/contentTypes/index.ts` 为 `MessageFile` 补齐 `contentType=8` 与 `encodeJSON()`，保证发送与同步归一化一致。
- 在 `packages/datasource-vue/src/api/index.ts` 新增 `resolveApiAssetUrl()`，把后端返回的 `file/preview/...` 转成可渲染 URL。
- 在 `apps/chat/src/components/MessageInput.vue` 移除“能力正在完善”占位提示，改为真实发送成功/失败提示。
- 同步维护现有 `.js` 运行副本，避免 dev server 解析到旧逻辑。

---

## 关闭备注

已由单元测试、构建门禁、Playwright smoke 和双账号浏览器截图审计验证，标记为 Resolved。
