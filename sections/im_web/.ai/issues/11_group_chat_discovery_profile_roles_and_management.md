# [ISSUE-11] 群聊会话可发现性、资料栏、角色权限与管理能力缺失

**状态**：Open
**创建时间**：2026-05-23
**标签**：bug / feature / group-chat / ux

---

## 问题描述

群聊已具备基础创建、进入和消息同步能力，但群聊在会话可发现性、群资料维护、成员角色展示、邀请提示、群内 @ 交互和群管理权限方面仍不完整，导致用户进入群后很难理解群状态，也缺少群主 / 管理员应有的管理能力。

当前需要跟踪以下问题：

1. 有历史记录的群聊不会自动显示在会话列表里，用户需要从联系人群聊列表手动寻找并进入。
2. 群聊没有上传或更换群头像的选项。
3. 群聊信息栏无法看到群主、管理员、普通成员等群角色。
4. 被拉入群聊时没有预先的群聊提示，也不会在会话中直观提示“你已被某某某拉入群聊”，用户只能手动在会话中寻找新群。
5. 群聊中无法 @ 其他成员。
6. 群管理无法设置群公告，也无法管理其他成员，例如踢出、禁言等。
7. 群主和管理员的管理权限边界不完整，缺少基于角色的可见操作和权限控制。

---

## 复现步骤

### 问题 1：有历史记录的群聊不显示在会话列表

1. 登录一个已加入多个群聊、且这些群聊存在历史消息的账号。
2. 刷新页面或重新登录。
3. 停留在“会话”列表。
4. 预期：存在历史记录或最近活跃消息的群聊应出现在会话列表中。
5. 实际：部分群聊不会出现在会话列表，只能切换到“联系人 -> 群聊”手动查找。

### 问题 2：群聊无法上传头像

1. 进入任意群聊。
2. 打开群聊信息 / 设置面板。
3. 预期：群主或有权限的管理员可以上传、修改群头像。
4. 实际：没有群头像上传或更换入口。

### 问题 3：群角色不可见

1. 进入群聊信息栏或群成员列表。
2. 查看群成员。
3. 预期：能看到群主、管理员、普通成员等角色标识。
4. 实际：无法直观看到群角色。

### 问题 4：被拉入群聊缺少入群提示

1. 账号 A 创建群聊或邀请账号 B 入群。
2. 账号 B 登录或刷新页面。
3. 预期：会话列表或群内系统消息提示“你已被 A 拉入群聊”，并能直接发现新群。
4. 实际：没有明显提示，用户需要手动到会话或联系人中寻找。

### 问题 5：群聊无法 @ 成员

1. 进入群聊。
2. 在输入框输入 `@`。
3. 预期：弹出群成员选择面板，可插入 @ 成员并发送含 mention 信息的消息。
4. 实际：没有 @ 成员能力。

### 问题 6：群管理能力不足

1. 使用群主或管理员账号进入群聊设置。
2. 尝试设置群公告、踢出成员、禁言成员。
3. 预期：有权限的角色可以执行对应管理操作。
4. 实际：入口缺失或能力不完整。

### 问题 7：群主 / 管理员权限不完整

1. 分别用群主、管理员、普通成员进入同一群聊。
2. 查看群设置和成员操作。
3. 预期：不同角色看到的操作应与权限匹配；后端也应校验权限。
4. 实际：权限边界和 UI 可见操作尚未完整定义。

---

## 相关代码

### 会话列表与群聊发现

```ts
// sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts
async function syncConversations() {
  const res: any = await syncApi.syncConversations({ msg_count: 1 });
  // 当前依赖后端最近会话返回；旧群可能只在 groupStore.fetchMyGroups() 中可见
}
```

```vue
<!-- sections/im_web/apps/chat/src/layouts/MainLayout.vue -->
<!-- 当前启动时已拉取 conversationStore.syncConversations() 与 groupStore.fetchMyGroups()，
     但有历史记录的群聊是否应自动补成会话仍需设计和实现。 -->
```

### 群资料与成员

```vue
<!-- sections/im_web/packages/base-vue/src/components/GroupSettingsDrawer.vue -->
<!-- 群设置面板应承载群头像、公告、成员管理、权限相关入口。 -->
```

```vue
<!-- sections/im_web/apps/chat/src/views/GroupMemberList.vue -->
<!-- 群成员列表应展示角色，并根据角色开放踢出、禁言、设管理员等操作。 -->
```

```ts
// sections/im_web/packages/datasource-vue/src/api/index.ts
export const groupApi = {
  getGroupInfo(groupNo: string) {},
  getGroupMembers(groupNo: string, params: { keyword?: string; page: number; limit: number }) {},
  inviteMembers(groupNo: string, members: string[]) {},
  removeMembers(groupNo: string, members: string[]) {},
  updateGroupInfo(groupNo: string, data: { name?: string; notice?: string }) {},
  appointManager(groupNo: string, uids: string[]) {},
  removeManager(groupNo: string, uids: string[]) {},
  muteMember(groupNo: string, data: { member_uid: string; action: number; key: number }) {}
};
```

### 消息输入与 @ 成员

```vue
<!-- sections/im_web/apps/chat/src/components/MessageInput.vue -->
<!-- 输入框需要支持 @ 触发成员选择，并发送 mention 元数据。 -->
```

### 后端群聊能力

```go
// sections/im/TangSengDaoDaoServer/modules/group/
// 需要确认群头像、群公告、成员角色、管理员、踢人、禁言等接口和权限校验是否完整。
```

---

## 根因分析

待调查。初步判断这是群聊基础链路修复后暴露出的产品能力缺口，涉及前端 UI、前端 store、消息 payload 结构、群成员角色模型、后端接口和权限校验多个层面。

需要重点确认：

1. “有历史记录的群聊是否应自动出现在会话列表”的业务规则，以及应由后端 `/conversation/sync` 返回还是前端基于 `/group/my` 与历史消息同步补会话。
2. 后端是否已经支持群头像上传 / 群公告更新 / 成员角色 / 管理员任免 / 踢人 / 禁言，并确认权限校验是否可靠。
3. @ 消息的 payload 结构、推送提醒、渲染样式、搜索和历史同步兼容性。
4. 邀请入群系统消息是否已经存在于后端事件链路，只是前端未渲染，还是需要补事件发送。

---

## 问题列表（Q&A 迭代）

### Q1: 有历史记录的群聊为什么现在不一定显示在会话列表？
**A1**: `/v1/conversation/sync` 只返回最近会话，不一定包含旧群；`/v1/group/my` 可以返回已加入群，但它目前主要用于联系人群聊列表。需要决定是否把有历史消息的群也补成会话。

### Q2: 群头像、公告、成员管理是前端缺入口还是后端缺能力？
**A2**: 待查。`groupApi` 中已有部分群信息、成员、管理员、禁言相关接口封装，但需要确认后端真实可用性、参数、权限和前端接入完整度。

### Q3: @ 成员需要哪些能力？
**A3**: 至少需要群成员搜索 / 选择、输入框 mention 插入、消息 payload 中保存 mention 信息、消息渲染高亮，以及被 @ 用户的提醒规则。

### Q4: 被拉入群聊提示应该在哪里出现？
**A4**: 需要同时考虑会话列表入口和群内系统消息。理想行为是用户被邀请后能看到一个群会话入口，并在消息流中看到“你已被某某某拉入群聊”的系统提示。

### Q5: 群主和管理员权限怎么划分？
**A5**: 待产品和后端规则确认。常见规则是群主拥有所有管理能力，管理员可管理普通成员和公告等部分设置，普通成员只能查看信息和退出群。

---

## 修复记录

暂无。

---

## 测试结果

暂无。

---

## 关闭备注

待修复。
