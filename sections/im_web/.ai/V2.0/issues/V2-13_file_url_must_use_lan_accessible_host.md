# [V2-13] 文件访问地址不能使用 127.0.0.1:8090，必须使用局域网可访问地址

**状态**：Resolved
**创建时间**：2026-05-24
**标签**：bug / media / backend-alignment
**优先级**：P0

---

## 问题描述

文件、图片、视频等媒体资源的访问地址不能是 `127.0.0.1:8090`。该地址只对服务器本机有效，浏览器用户在外网或局域网其他设备访问时无法加载资源。

当前测试/部署要求媒体文件必须可以通过局域网可访问地址访问：

```
http://localhost:8090
```

本质要求是：前端最终渲染、下载、预览所使用的文件 URL 必须对访问 IM Web 的用户设备可达，而不是服务端本机 loopback 地址。

---

## 复现步骤

1. 使用局域网设备打开 IM Web，例如访问 `http://localhost:3000`。
2. 发送图片或文件消息。
3. 查看消息中的媒体 URL、预览图、下载链接或网络请求。
4. 若 URL 为 `http://127.0.0.1:8090/...`，则其他设备无法访问该资源。
5. 预期 URL 应使用 `http://localhost:8090/...` 或其他可由客户端访问的公开/局域网资源域名。

---

## 相关代码

```
sections/im_web/packages/datasource-vue/src/api/index.ts
sections/im_web/packages/datasource-vue/src/stores/messageStore.ts
sections/im_web/packages/base-vue/src/components/messages/
```

重点检查：

```
resolveApiAssetUrl()
commonApi.getUploadUrl()
commonApi.uploadFile()
sendMediaMessage()
```

---

## 根因分析

已确认前端资源 URL 归一化逻辑会直接信任后端返回的绝对 URL。如果后端返回 `127.0.0.1:8090` 或 `localhost:8090`，浏览器会把该地址解析到用户自己的设备，导致局域网其他设备无法加载媒体。

2026-05-24 回归发现：点击文件消息时，前端传给 `window.open()` 的 URL 已经是 `http://localhost:8090/v1/file/preview/...`，但后端预览接口会重定向到 MinIO 直链 `http://127.0.0.1:9000/...`。浏览器会跟随该 Location，导致局域网设备仍然无法下载文件。

修复需要支持：

1. 从环境变量或远程配置读取媒体资源 host。
2. 在 `resolveApiAssetUrl()` 中将 loopback host 替换为可访问 host。
3. 后端返回上传/预览地址时直接使用正确的外部访问地址。
4. 对 `/file/preview/...` 地址进行前端兜底，直接映射到局域网可访问的对象存储地址，避免浏览器跟随后端返回的 loopback Location。

---

## 问题列表（Q&A 迭代）

### Q1: 为什么不能使用 `127.0.0.1:8090`？
**A1**: 浏览器运行在用户设备上，`127.0.0.1` 指向用户自己的设备，而不是文件服务所在机器，因此无法加载服务端文件。

### Q2: 当前明确要求使用哪个地址？
**A2**: 当前环境要求使用 `http://localhost:8090` 作为局域网可访问文件服务地址。

### Q3: 修复完成标准是什么？
**A3**: 发送图片/文件后，消息预览和下载链接均不包含 `127.0.0.1:8090`，并能从局域网访问设备正常加载。

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 3 Store | `pnpm exec vitest run tests/mediaUrlNormalization.test.ts --config vitest.config.ts` | Pass |
| Layer 5 E2E | `pnpm test:e2e` | Pass，8/8 passed |
| Manual Review | 静态检查 `resolveApiAssetUrl()` loopback rewrite | Pass |
| Browser Audit | 文件卡片点击 URL 拦截审计 | Pass，打开 `http://localhost:9000/...`，不含 `127.0.0.1` |

---

## 修复记录

2026-05-24 已完成：

1. 在 `resolveApiAssetUrl()` 中识别 `127.0.0.1:8090` 和 `localhost:8090`，并改写为 `http://localhost:8090`。
2. 支持通过 `VITE_MEDIA_BASE_URL` 或 `VITE_FILE_BASE_URL` 覆盖媒体资源地址。
3. 当 API base origin 是 loopback 8090 时，默认回退到局域网可访问地址。
4. 新增 `mediaUrlNormalization.test.ts` 覆盖 loopback URL 改写，确保预览和下载链接不会回退到 `127.0.0.1:8090`。

2026-05-24 回归修复：

5. 新增 `base-vue/src/service/mediaUrl.ts`，让 base 消息组件和 datasource API 共用同一 URL 归一化规则，避免包循环。
6. `FileCell`、`ImageCell`、`VoiceCell`、`VideoCell` 在展示和点击前兜底归一化媒体 URL。
7. `messageStore.normalizeMessageContent()` 在同步消息、实时消息、编辑内容进入 Store 时统一归一化 `content.url`。
8. `/file/preview/...` 链接直接映射为对象存储直链 `http://localhost:9000/...`，并支持 `VITE_OBJECT_STORAGE_BASE_URL` / `VITE_MINIO_BASE_URL` 覆盖。

---

## 测试结果

| 命令 | 结果 |
|---|---|
| `cd sections/im_web/apps/chat && pnpm exec vitest run tests/noNativeDialogs.test.ts tests/mediaUrlNormalization.test.ts tests/uiLayoutStability.test.ts tests/messageMediaSending.test.ts --config vitest.config.ts` | Pass，4 files / 7 tests |
| `cd sections/im_web && pnpm type-check` | Pass |
| `cd sections/im_web && pnpm test:unit` | Pass，28 files / 63 tests |
| `cd sections/im_web && pnpm build` | Pass，保留既有 chunk size warning |
| `cd sections/im_web && pnpm test:e2e` | Pass，8/8 passed |
| 文件卡片点击 URL 拦截审计 | Pass，`window.open()` 入参为 `http://localhost:9000/...` |

---

## 关闭备注

Resolved。前端渲染和点击媒体 URL 时会把 loopback API / MinIO 地址改写为局域网可访问地址；如部署环境变更，可通过 `VITE_MEDIA_BASE_URL`、`VITE_FILE_BASE_URL`、`VITE_OBJECT_STORAGE_BASE_URL` 或 `VITE_MINIO_BASE_URL` 配置。
