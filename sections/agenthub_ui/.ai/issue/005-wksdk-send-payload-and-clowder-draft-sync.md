# Issue 005：WKSDK 发送参数形状错误与 Clowder 草稿远端同步 400

- 状态：Resolved
- 严重级别：High
- 发现时间：2026-06-07
- 影响平台：H5/Web、移动浏览器、Android APP-PLUS
- 关联计划：V1-2

## 现象

新增真实双端 E2E 后，agenthub_ui 在 `qwq` 直聊里发送文本时，本端出现乐观消息气泡，但 im_web 已打开的同一会话 10 秒内收不到消息。浏览器日志显示：

```text
Cannot read properties of undefined (reading 'channelID')
```

修复发送参数后，E2E 可以通过，但仍发现 agenthub_ui 在发送后清空一个本来为空的草稿时，请求 `conversations/clowder_cat%3Acodex/1/extra` 返回 400，污染真实验收日志。

## 根因

1. `utils/wk-sdk.js` 把 `{ channel, content, clientMsgNo }` 作为单个对象传给 `chatManager.send()`；真实 WKSDK API 需要 `chatManager.send(content, channel)`，否则 SDK 读取第二个参数的 `channelID` 时崩溃，消息不会发到 TangSeng WS。
2. `stores/message.js` 在 SDK send resolve 后没有把 SDK 返回的 `clientSeq/messageSeq/messageID` 合并回乐观消息，也没有清理 `pendingQueue`。
3. `stores/conversation.js` 每次 draft-change 都远端同步，包括“空草稿清空为空草稿”的 no-op；Clowder cat 直聊与 im_web 一致应为本地草稿，不应调用 TangSeng conversation extra。

## 修复

1. `utils/wk-sdk.js` 改为优先使用 `shared.newMessageText()` 与 `shared.newChannel()`，并按 `chatManager.send(content, channel)` 发送。
2. `stores/message.js` 在 SDK send 成功后合并 `clientSeq/messageSeq/messageID`，将乐观消息标记为 `success`，并删除 pending 项。
3. `stores/conversation.js` 增加 local-only direct 判断：`clowder_ai`、`clowder:*`、`clowder_cat:*`、`deepseek_ai_robot` 草稿仅本地持久化；未变化的空草稿不再触发远端请求。
4. 新增 `tests/unit/wk-sdk.spec.js` 与 `tests-e2e/agenthub-imweb-realtime.mjs`；扩展 `tests/unit/im-domain.spec.js` 覆盖发送成功合并、no-op 草稿、Clowder cat 本地草稿。

## 验证

- RED E2E：`.ai/tests-e2e/v1-2-20260606T190620/`
  - agenthub_ui 本地显示 `agenthub-imweb-live-20260606T190620`
  - im_web 未收到
  - events 记录 SDK `channelID` pageerror
- GREEN E2E：`.ai/tests-e2e/v1-2-20260606T191349/`
  - agenthub_ui 发送 `agenthub-imweb-live-20260606T191349`
  - im_web 同会话无需刷新收到消息
  - events 无 `pageerror` / `requestfailed` / `http-error`
  - `ws-frames.json` 记录 agenthub_ui send frame 与 im_web receive frame
- `npm run test:unit`：21 passed
- `npm run build:h5`：Build complete
