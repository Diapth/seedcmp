# [ISSUE-12] 实时通知 (CMD) 触发时群详情与群成员 Store (groupStore) 未同步刷新

**状态**：Resolved
**创建时间**：2026-05-23
**标签**：bug / group-chat / store / sync

---

## 问题描述

在群聊基础组件重构后，前台将所有群聊管理功能（如群设置抽屉、群成员列表页、群 `@` 成员选择面板等）的底层数据源切换到了新增的 `groupStore`，而不再依赖原先设计较简陋的 `channelStore`。

然而，在处理实时推送指令（CMD）的中央消息解析模块中，群消息相关的实时事件（如群头像变更 `groupAvatarUpdate`，群成员更新 `memberUpdate`）却只清理并触发了 `channelStore` 里的成员/详情刷新，完全遗漏了对最新的 `groupStore` 触发同步拉取。这会导致前台在实时聊天、管理群成员时，无法实时响应后台推送的变更事件，产生界面状态滞后、@ 面板成员信息不同步等隐藏 Bug。

---

## 复现步骤

1. 两个用户 A 与 B 同时加入群聊 `g1`，用户 A 开启群成员列表页面。
2. 用户 B 在另一个客户端将用户 C 邀请入群。
3. 后台向用户 A 发送 `memberUpdate` 类型的 CMD 实时指令。
4. 预期：用户 A 的群成员列表页面实时刷新出用户 C，且成员人数更新。
5. 实际：用户 A 界面没有任何反应，只有退出重新进入该页面后，由于触发了重新挂载生命周期的 `fetchGroupMembers` 才能展示更新后的数据。

---

## 相关代码

### 问题发生时的 CMD 监听器

```ts
// sections/im_web/packages/datasource-vue/src/cmd/index.ts
// 仅从 channelStore 获取/清除了群组信息，未引入 useGroupStore
const messageStore = useMessageStore();
const channelStore = useChannelStore();
const conversationStore = useConversationStore();
const userStore = useUserStore();

switch (cmd) {
  case 'groupAvatarUpdate':
    if (channel) {
      const key = `${channel.channelID}-${channel.channelType}`;
      delete channelStore.channels[key];
      channelStore.getChannelInfo(channel.channelID, channel.channelType);
    }
    break;

  case 'memberUpdate':
    if (channel && channel.channelType === 2) {
      channelStore.fetchGroupMembers(channel.channelID);
    }
    break;
}
```

由于 `GroupMemberList.vue` 与 `GroupSettingsDrawer.vue` 均完全绑定 `groupStore` 中的 `groupMembers` 与 `groups`，以上清空仅能修改 `channelStore.members`，而无法刷新 `groupStore.groupMembers`，因此造成数据分裂和刷新丢失。

---

## 根因分析

群聊的 Store 与 Model 从 `channelStore` 解耦并重构至专属的 `groupStore` 时，实时事件派发机制（`cmd/index.ts`）未被同步改动，仍然遗留了旧的处理链路，导致底层状态变动事件无法传导至业务 UI 组件。

---

## 问题列表（Q&A 迭代）

### Q1: `channelStore` 里的 `fetchGroupMembers` 和 `groupStore` 里的有什么区别？
**A1**: 前者只负责通用会话管道的数据缓存，其将成员存放在 `channelStore.members` 中；而后者针对群聊的特定高级业务场景做了归一化处理（支持显示群主/管理员标签、禁言状态解析等），将其存储在 `groupStore.groupMembers` 中。

### Q2: 应该在 CMD 处理器中完全移去 `channelStore` 的更新吗？
**A2**: 不能。旧的会话列表及基础头像组件依然会依赖 `channelStore.channels` 做兜底展示，所以必须让两者同步更新，才能保证全站数据的一致性。

---

## 修复记录

### 2026-05-23

已完成以下修复：

1. `sections/im_web/packages/datasource-vue/src/cmd/index.ts`
   - 引入 `useGroupStore` 依赖。
   - 在 `groupAvatarUpdate` 事件到达时，在更新 `channelStore` 的同时，先清理 `groupStore.groups[channelID]` 缓存，再调用 `groupStore.getGroupInfo` 重新获取群信息，避免缓存命中导致头像 / 资料不刷新。
   - 在群频道 `channelUpdate` 事件到达时，同步清理并刷新 `groupStore` 群详情，覆盖群名 / 公告等通用资料更新。
   - 在 `memberUpdate` 事件到达时，在更新 `channelStore` 的同时，主动调用 `groupStore.fetchGroupMembers` 重新拉取归一化后的成员列表，打通实时通知至界面的闭环。
2. `sections/im_web/.ai/checks/verify-issue-12-cmd-group-store-sync.mjs`
   - 新增 ISSUE-12 专项回归检查，覆盖 `groupStore` 引入、头像 / 资料缓存失效、成员刷新链路。

---

## 测试结果

```bash
# 执行 issue 9-11 与当前全局一致性回归测试
node sections/im_web/.ai/checks/verify-issues-9-11.mjs
# exit 0 (All passed)

# 执行 issue 12 专项回归测试
node sections/im_web/.ai/checks/verify-issue-12-cmd-group-store-sync.mjs
# exit 0 (All passed)

# 静态类型检查
./node_modules/.bin/vue-tsc --noEmit -p tsconfig.json
# exit 0 (Passed with no errors)

# 构建验证
./node_modules/.bin/vite build apps/chat
# exit 0 (Passed with no errors)
```

---

## 关闭备注

问题已彻底修复，实时推送更新已和最新的 `groupStore` 数据链强绑定，群管理与聊天页面的成员、头像实时同步功能逻辑完美闭环。
