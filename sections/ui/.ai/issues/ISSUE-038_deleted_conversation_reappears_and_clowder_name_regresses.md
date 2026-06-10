# [ISSUE-038] 删除会话刷新复活、智能体直聊名称退化与删除智能体后会话残留

**状态**：Resolved

**AI修复模式**：Direct Fix

## 现象

用户报告：

1. 删除过的会话刷新页面后又出现在聊天列表。
2. 和智能体对话的名称刷新后会从原始名称变成 `clowder_cat:*`。
3. 删除智能体后，预期会同步删除相关直聊会话和聊天记录，但聊天会话仍然存在。

## 诊断胶囊

- 现象：会话右键“硬删除”只移除前端数组；下一次 `/conversation/sync` 返回同一 channel 后又被合并回来。Clowder 直聊远端 channelInfo 可能只包含 `channel_id=clowder_cat:*`，同步合并时覆盖了本地智能体展示名。删除智能体只做本地 cleanup，缺少远端最近会话 delete 命令和持久 tombstone，刷新后直聊会话仍可由后端同步回灌。
- 证据：
  - 当前 `stores/conversation.js::deleteConversation(id)` 只过滤 `this.conversations`，没有调用后端 `/conversations/delete`，也没有删除屏蔽记录。
  - `applyNativeConversations` 只在已有本地会话且 `shouldPreserveClowderAgentDisplayName` 命中时保留展示名；新同步进来的 `clowder_cat:*` 会话缺少目录映射时会直接展示 channel id。
  - 老前端 `sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts` 通过 `deletedConversationRecords` 记录 delete barrier，并在同步时只允许更新消息重新激活。
  - 后端 `sections/im/WuKongIM/internal/access/api/routes.go` 注册了 `POST /conversations/delete`，`handleConversationDelete` 读取 `uid/channel_id/channel_type/message_seq`。
- 根因假设：
  - 最近会话删除语义没有从老前端迁移到当前 UI，导致远端同步和本地删除没有一致性边界。
  - Clowder 直聊身份映射只在本地创建/已有会话合并路径处理，缺少对“远端裸 channelId”的展示名恢复。
  - 删除智能体后没有对其 `clowder_cat:<catId>` 直聊调用会话删除命令，也没有持久过滤该直聊同步结果。
- 诊断策略：先补原生 IM 单测覆盖删除命令、删除屏蔽、Clowder 名称保留和智能体删除 cleanup；再实现最小修复；最后用 Playwright 桌面/移动端验证刷新后不复活、名称不退化、删除智能体后直聊消失。
- 超时策略：真实后端登录态不可控时，使用 Playwright route mock 固定 `/conversation/sync` 与 `/conversations/delete` 契约。
- 预警策略：删除会话不应永久隐藏新消息；当同步返回更新的 `lastSeq/lastTime` 大于删除记录时，应允许重新出现。
- 验收：
  - 删除会话后，刷新/再次同步同一旧 seq/time 不会复活。
  - 同一会话出现新消息后可以重新出现。
  - 智能体直聊刷新后仍显示原始名称，不显示 `clowder_cat:*`。
  - 删除智能体后，其直聊会话和本地消息缓存被清理，并发起会话删除命令。

## 验收要求

1. `npm run test:native-im` 通过，且包含 Direct Fix 红灯回归。
2. `npm run test:smoke`、`npm run build:h5` 通过。
3. Playwright 或 browser-preview 覆盖桌面 Web viewport 与移动端 viewport。
4. 证据保存到 `.ai/tests/ISSUE-038-<timestamp>/`。

## 修复摘要

- 最近会话删除改为“本地 tombstone + 远端最近会话删除”双路径：删除后持久记录 `channelId/channelType/lastSeq/lastTime`，刷新或再次同步同一旧会话不会复活；当后端同步返回更新的 seq/time 时允许新消息重新激活。
- `nativeImService.deleteConversation` 对接 TangSeng 最近会话 API：`DELETE /v1/conversations/:channelId/:channelType`，删除智能体时同步删除 `clowder_cat:<catId>` 与裸 `catId` 直聊入口。
- Clowder 智能体目录规范化补充 `catId/directCatId`，会话列表在拿到目录后会把裸 `clowder_cat:*` channel 恢复成原智能体名称、头像和 robot 类型。
- 删除智能体新增用户级 deleted-agent tombstone，旧目录同步不会把已删除智能体重新插回面板；同时清理直聊会话、本地直聊消息缓存、群成员候选和 @ 候选。
- `syncNativeBootData` 在启动同步会话后同步刷新智能体目录，避免刷新后只拿到裸 channel id 而缺少名称映射。

## 验证命令

```bash
cd sections/ui
npm run test:native-im
npm run test:smoke
npm run build:h5
node .ai/tests/ISSUE-037-20260610123517/verify-issue-037.mjs
node .ai/tests/ISSUE-038-20260610132635/verify-issue-038.mjs
```

## 证据

- 证据目录：`sections/ui/.ai/tests/ISSUE-038-20260610132635/`
- 单测日志：`sections/ui/.ai/tests/ISSUE-038-20260610132635/native-im.log`（91 pass）
- smoke 日志：`sections/ui/.ai/tests/ISSUE-038-20260610132635/smoke.log`
- 构建日志：`sections/ui/.ai/tests/ISSUE-038-20260610132635/build-h5.log`
- Playwright 结果：`sections/ui/.ai/tests/ISSUE-038-20260610132635/result.json`
- 请求日志：`sections/ui/.ai/tests/ISSUE-038-20260610132635/request-log.json`
- 控制台日志：`sections/ui/.ai/tests/ISSUE-038-20260610132635/console-log.json`
- 桌面截图：
  - `desktop-1440x900-chat-agent-name-restored.png`
  - `desktop-1440x900-chat-agent-conversation-deleted.png`
  - `desktop-1440x900-chat-agent-conversation-not-revived-after-refresh.png`
  - `desktop-1440x900-agent-card-deleted.png`
  - `desktop-1440x900-chat-clean-after-agent-delete.png`
- 移动端截图：
  - `mobile-390x844-chat-agent-name-restored.png`
  - `mobile-390x844-chat-agent-conversation-deleted.png`
  - `mobile-390x844-chat-agent-conversation-not-revived-after-refresh.png`
  - `mobile-390x844-agent-card-deleted.png`
  - `mobile-390x844-chat-clean-after-agent-delete.png`
