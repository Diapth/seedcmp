# [ISSUE-10] 群聊离线消息丢失、未读红点异常、刷新后群聊消失

**状态**：Resolved
**创建时间**：2026-05-23
**标签**：bug / investigation / group-chat

---

## 问题描述

群聊基础链路存在多处异常，影响离线消息、会话未读状态和联系人群聊列表的可靠性：

1. 未上线的成员无法收到群聊消息；或者成员重新登录 / 刷新后，群聊消息在会话中直接消失。
2. 当前正处于群聊会话时，群聊未读红点不会正确显示；但一旦切换到其他会话，原本已经读过的群聊消息又会出现红点。
3. 页面刷新后，联系人下方找不到已经创建过的群聊，导致用户无法从联系人列表重新进入已创建群。

---

## 复现步骤

### 问题 1：离线成员收不到群聊消息或刷新后消息消失

1. 使用账号 A 创建群聊，并邀请账号 B。
2. 账号 B 退出登录、关闭页面，或保持离线状态。
3. 账号 A 在群聊中发送多条消息。
4. 账号 B 重新登录或刷新页面后进入该群聊。
5. 预期：账号 B 能通过消息同步看到离线期间的群聊消息。
6. 实际：账号 B 收不到这些消息，或刷新后会话里的群聊消息消失。

### 问题 2：群聊未读红点状态异常

1. 账号 A 和账号 B 同时在线，并进入同一个群聊。
2. 账号 A 在群聊中发送消息。
3. 账号 B 正停留在该群聊会话时观察会话列表红点。
4. 再让账号 B 切换到其他会话。
5. 预期：当前正在查看的群聊应及时清除或保持正确未读状态；已读消息不应在切走后重新出现红点。
6. 实际：停留在群聊时红点不出现，但切换到其他会话后，已读群聊消息反而出现红点。

### 问题 3：刷新后联系人群聊列表丢失已创建群

1. 使用联系人页入口发起群聊并创建成功。
2. 确认创建后可以进入群会话。
3. 刷新页面或重新登录。
4. 打开联系人页并查看群聊列表。
5. 预期：已创建或已加入的群聊仍显示在联系人下方。
6. 实际：联系人下方找不到刚创建过的群聊。

---

## 相关代码

### 群聊列表与联系人展示

```ts
// sections/im_web/packages/datasource-vue/src/stores/groupStore.ts
async function fetchMyGroups() {
  const res: any = await groupApi.getMyGroups();
  const list = Array.isArray(res) ? res : (res?.list || res?.groups || []);
  list.forEach((item: any) => {
    const group = normalizeGroup(item);
    if (group) {
      groups.value[group.group_no] = group;
    }
  });
}
```

```vue
<!-- sections/im_web/packages/contacts-vue/src/views/ContactList.vue -->
<!-- 联系人页依赖 groupStore.savedGroups 展示已保存 / 已加入群聊 -->
```

### 会话同步与未读状态

```ts
// sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts
async function syncConversations() {
  const res: any = await syncApi.syncConversations({ msg_count: 1 });
  // 同步 conversations / users / groups，并写入 unreadMap
}

async function clearUnread(channelId: string, channelType: number) {
  unreadMap.value[key] = 0;
  const conv = findConversation(channelId, channelType);
  if (conv) {
    conv.unread = 0;
  }
  await syncApi.clearUnread(channelId, channelType);
}
```

```ts
// sections/im_web/packages/datasource-vue/src/cmd/index.ts
case 'unreadClear':
  conversationStore.unreadMap[key] = 0;
  const conv = conversationStore.conversations.find(c => c.channel_id === channel.channelID && c.channel_type === channel.channelType);
  if (conv) {
    conv.unread = 0;
  }
  break;
```

### 群聊消息同步

```ts
// sections/im_web/packages/datasource-vue/src/stores/messageStore.ts
async function syncMessages(channelId: string, channelType: number) {
  await syncApi.syncMessages({
    channel_id: channelId,
    channel_type: channelType,
    limit: 30,
    start_message_seq: startSeq,
    end_message_seq: 0,
    pull_mode: 1
  });
}
```

### 群聊创建与接口

```ts
// sections/im_web/apps/chat/src/views/CreateGroupPage.vue
// 创建群聊后应确认群关系、会话、联系人群列表都能同步刷新
```

```ts
// sections/im_web/packages/datasource-vue/src/api/index.ts
// groupApi / syncApi 中的群信息、会话同步、消息同步、未读清除接口
```

---

## 根因分析

已确认主要根因如下：

1. `/group/my` 后端接口只按 `group_setting.save=1` 返回“已保存群”，没有返回当前用户已加入但未显式保存的普通群。新建群默认没有个人保存设置，因此刷新后联系人页无法从接口拿回刚创建的群。
2. 前端 `syncConversations()` 只把会话同步返回的 `groups` 写入 `channelStore`，没有同步写入联系人页使用的 `groupStore`，导致会话列表和联系人群聊列表状态分裂。
3. 群聊实时消息到达当前正在查看的会话时，`clearUnread()` 和异步 `addOrUpdateConversation()` 存在时序竞争。后者可能在清零之后把同一条已读消息重新计入 unread，于是切换会话后红点重新出现。
4. `/coversation/clearUnread` 在 IM 已经执行清未读后，还会发送 `unreadClear` CMD 通知；如果 CMD 通知发送失败，接口直接返回 400，前端只能保留本地状态，远端未读状态容易在后续同步时回灌。
5. 旧群的历史消息已存在于 WuKongIM，并且 `/v1/message/channel/sync` 能返回；但 `/v1/conversation/sync` 不一定返回这些旧群会话，所以刷新后用户停留在“会话”页时看不到旧群入口。需要在应用启动时同时拉取 `/v1/group/my`，保证联系人群聊列表不依赖最近会话同步。

---

## 问题列表（Q&A 迭代）

### Q1: 这是前端问题还是后端 / WuKongIM 问题？
**A1**: 暂不能定论。离线消息和群成员持久化需要检查 TangSengDaoDaoServer 与 WuKongIM 的群成员、订阅、消息同步链路；未读红点和联系人群聊丢失也需要检查前端 store 同步。

### Q2: 为什么刷新后群聊会从联系人下方消失？
**A2**: 当前联系人群聊列表依赖 `groupStore.fetchMyGroups()` / `savedGroups`。如果后端接口没有返回刚创建的群，或前端没有把会话同步得到的群信息写入 `groupStore`，刷新后联系人页就会找不到该群。

### Q3: 群聊红点为什么会在切换会话后才出现？
**A3**: 可能是当前会话的本地已读清除和远端未读状态更新时序不一致。切换会话触发列表刷新或重新渲染后，旧的 `unread` 值又覆盖了本地清零状态。

### Q4: 修复时需要验证哪些场景？
**A4**: 至少需要覆盖在线群消息、离线群消息、刷新后历史消息、当前群会话已读清除、切换会话后红点状态、刷新后联系人群聊列表保留这六类场景。

---

## 修复记录

### 2026-05-23

已完成以下修复：

1. `sections/im/TangSengDaoDaoServer/modules/group/db.go`
   - `/group/my` 改为基于 `group_member` 返回当前用户已加入且未退出的正常群。
   - 保留 `group_setting` 的置顶、免打扰、备注等个人设置；没有保存设置的已加入群默认 `save=1`，保证联系人页可见。

2. `sections/im/TangSengDaoDaoServer/modules/message/api_conversation.go`
   - `/coversation/clearUnread` 在 `IMClearConversationUnread` 成功后不再因为 `unreadClear` CMD 通知失败而返回 400。
   - CMD 失败只记录日志，避免远端清未读状态被通知失败误判为整体失败。

3. `sections/im_web/packages/datasource-vue/src/stores/groupStore.ts`
   - 新增 `upsertGroup()`，统一群信息本地写入。
   - 群信息归一化时兼容 `group_no / groupNo / channel_id`，并让已加入群默认进入联系人群聊列表。

4. `sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts`
   - 会话同步返回的 `groups` 同步写入 `groupStore`，修复会话列表有群但联系人页没有群的问题。
   - 增加 `clearedUnreadSeqs` 和 `getEffectiveUnread()`，避免已清未读被旧的会话同步 unread 覆盖回来。
   - 当前会话实时消息标记为已读时，`addOrUpdateConversation()` 不再递增 unread。

5. `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
   - 为本地消息增加 `isUnreadCleared` 标记，并传递给会话更新逻辑。

6. `sections/im_web/packages/datasource-vue/src/cmd/index.ts`
   - 实时收到当前正在查看的会话消息时，写入消息前即标记 `isUnreadCleared`，修复清零和异步会话更新的竞态。

7. `sections/im_web/apps/chat/src/views/CreateGroupPage.vue`
   - 建群成功后立即 `groupStore.upsertGroup()`，无需等待刷新或下一轮会话同步。

8. `sections/im_web/.ai/checks/verify-group-chat-retention-state.mjs`
   - 新增回归检查，覆盖群列表保留、应用启动拉取我的群聊、会话同步补群、未读清零防回灌、实时消息已读竞态、后端清未读 CMD 失败不阻断响应。

9. `sections/im_web/apps/chat/src/layouts/MainLayout.vue`
   - 应用启动时同时执行 `conversationStore.syncConversations()` 和 `groupStore.fetchMyGroups()`。
   - 修复旧群不在最近会话同步结果中时，刷新后必须先挂载联系人组件才会加载群聊的问题。

### 2026-05-23 追加验证

- 运行库 MySQL 账号确认使用 `tsdd_user:tsdd_password@tcp(127.0.0.1:3306)/im`，不是测试工具里的 `root` 账号。
- `/v1/group/my` 使用真实登录 token 返回 4 个旧群：`1231313131`、`TestGroup`、`TestGroup1`、`你好`。
- `/v1/message/channel/sync` 对群 `5c9870c2956b40b0b5fe74c1e843efb4` 返回 9 条历史消息。
- Playwright 验证新前端：登录后切到联系人能看到 4 个旧群；点击“你好”后能看到历史消息 `132123`、`456354` 等。

---

## 测试结果

已执行：

```bash
node sections/im_web/.ai/checks/verify-group-chat-retention-state.mjs
# group chat retention state checks passed

./sections/im_web/node_modules/.bin/vue-tsc --noEmit -p sections/im_web/tsconfig.json
# exit 0

cd sections/im_web && ./node_modules/.bin/vite build apps/chat
# exit 0

cd sections/im/TangSengDaoDaoServer && go test ./modules/message -run '^$'
# exit 0

cd sections/im/TangSengDaoDaoServer && go test ./modules/group -run '^$'
# exit 0

curl /v1/group/my
# 真实 token 下返回 4 个旧群

curl /v1/message/channel/sync
# 群 5c9870c2956b40b0b5fe74c1e843efb4 返回 9 条历史消息
```

完整后端测试暂未通过环境验证，原因是本机测试环境连接 MySQL `root@localhost` 报 `Access denied for user 'root'@'localhost'`。已用 `go test -run '^$'` 完成后端编译验证。

运行服务已重启：

```bash
WuKongIM: 3761610, listening on 5001 / 5100 / 5200
TangSengDaoDaoServer: 3807995, listening on 8090
IM Web Vite: 3816655, listening on 3000
```

---

## 关闭备注

已修复群聊联系人保留、会话同步补群、当前会话已读红点回灌、清未读接口 400 等问题。仍建议用双账号再做一次在线、离线、刷新后的端到端手工确认。
