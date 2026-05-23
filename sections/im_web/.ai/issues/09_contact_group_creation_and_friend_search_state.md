# [ISSUE-09] 联系人缺少新建群聊入口，添加好友状态判断不完整

**状态**：Resolved
**创建时间**：2026-05-23
**标签**：bug / feature / ux

---

## 问题描述

联系人模块存在两个会影响基础社交流程的问题：

1. 联系人页下方没有“新建群聊 / 发起群聊”功能入口。虽然路由里已有 `/chat/create-group` 和 `CreateGroupPage.vue`，但用户在联系人页只能看到“群聊”列表入口，无法从联系人区域自然创建群聊并进入群会话。
2. 添加好友搜索结果的关系状态判断不完整。已添加过的好友搜索后仍可能显示“发送好友申请”；搜索当前登录用户自己时，也显示“发送好友申请”，导致用户可以对自己发起好友申请的错误体验。

---

## 复现步骤

### 问题 1：联系人页无法新建群聊

1. 登录 IM Web 客户端。
2. 进入联系人页。
3. 查看“新的朋友 / 添加好友 / 群聊”等快捷入口。
4. 预期应有“新建群聊 / 发起群聊”入口；实际没有，用户无法从联系人页发起群聊创建流程。

### 问题 2：添加好友状态错误

1. 登录 IM Web 客户端。
2. 进入“添加好友”页面。
3. 搜索一个已经是好友的用户。
4. 实际仍可能出现“发送好友申请”按钮。
5. 搜索当前登录用户自己的手机号、用户名或 UID。
6. 实际也可能出现“发送好友申请”按钮。

---

## 相关代码

### 联系人快捷入口

```vue
<!-- sections/im_web/packages/contacts-vue/src/views/ContactList.vue -->
<div class="action-item" @click="handleAddFriend">
  <div class="action-label">添加好友</div>
</div>

<div class="action-item" @click="scrollToGroupList">
  <div class="action-label">群聊</div>
</div>
```

`ContactList.vue` 只有添加好友和跳转到群聊列表的入口，未调用已有的 `/chat/create-group`。

### 已存在的新建群聊路由

```ts
// sections/im_web/apps/chat/src/router/index.ts
{
  path: 'create-group',
  name: 'CreateGroup',
  component: () => import('../views/CreateGroupPage.vue')
}
```

### 添加好友搜索逻辑

```ts
// sections/im_web/packages/contacts-vue/src/views/AddFriendPage.vue
const res: any = await friendApi.searchUser(keyword.value);
if (res && res.exist === 1 && res.data) {
  const userData = res.data;
  if (userData.follow === 1) {
    Message.info('该用户已是你的好友');
    router.push(`/chat/conversation/${userData.uid}/1`);
    return;
  }
  result.value = userData;
}
```

当前只依赖接口返回的 `follow === 1` 判断是否已是好友，没有显式处理：

- 搜索结果是当前登录用户自己
- 后端未返回或错误返回 `follow` 时，本地联系人列表里已存在该用户
- 已发过申请但未处理的状态

---

## 根因分析

1. 群聊创建功能已存在页面和路由，但联系人页快捷入口遗漏了“发起群聊”操作。
2. 添加好友页把后端搜索结果当作唯一状态来源，缺少当前登录用户和本地好友列表的兜底判断。

---

## 问题列表（Q&A 迭代）

### Q1: 是否已经有创建群聊页面？
**A1**: 有。`sections/im_web/apps/chat/src/views/CreateGroupPage.vue` 已存在，路由为 `/chat/create-group`。

### Q2: 联系人页现在的“群聊”入口是什么？
**A2**: 只是滚动到已保存群聊列表 `saved-groups-section`，不是新建群聊入口。

### Q3: 添加好友为什么会对已添加好友仍显示申请？
**A3**: 当前前端只检查 `searchUser` 返回的 `follow === 1`。如果后端没有正确返回该字段，前端没有用本地联系人列表兜底。

### Q4: 搜索自己应该如何表现？
**A4**: 不应显示“发送好友申请”。可以显示“这是你自己”并禁用申请按钮，或直接隐藏申请表单。

---

## 修复记录

### 2026-05-23

已完成以下修复：

1. `sections/im_web/packages/contacts-vue/src/views/ContactList.vue`
   - 增加“发起群聊”快捷入口
   - 点击后跳转到已有路由 `/chat/create-group`

2. `sections/im_web/packages/contacts-vue/src/utils/friendSearchState.ts`
   - 新增好友搜索状态判断
   - 支持识别当前登录用户自己
   - 支持通过后端 `follow === 1` 或本地联系人列表判断“已是好友”

3. `sections/im_web/packages/contacts-vue/src/views/AddFriendPage.vue`
   - 搜索结果为自己时显示“这是你自己”，不展示申请按钮
   - 搜索结果为已有好友时显示“该用户已是你的好友”，提供“进入会话”按钮
   - 只有陌生用户才展示验证消息和“发送好友申请”

4. `sections/im_web/packages/datasource-vue/src/api/index.ts`
   - 合并重复的 `updateConversationExtra` 定义
   - 保留对象参数和三参数两种调用方式，避免类型检查失败

5. `sections/im_web/.ai/checks/verify-contact-friend-state.mjs`
   - 增加回归检查，覆盖自己、已是好友、可申请三类状态

---

## 测试结果

```bash
node sections/im_web/.ai/checks/verify-contact-friend-state.mjs
# contact friend state checks passed

node sections/im_web/.ai/checks/verify-websocket-route-address.mjs
# websocket route address checks passed

./sections/im_web/node_modules/.bin/vue-tsc --noEmit -p sections/im_web/tsconfig.json
# exit 0
```

---

## 关闭备注

联系人页现在可以直接发起群聊。添加好友页不会再对自己或已有好友显示“发送好友申请”，问题关闭。
