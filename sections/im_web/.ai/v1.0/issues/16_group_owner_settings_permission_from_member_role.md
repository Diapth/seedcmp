# [ISSUE-16] 群主权限未使用成员角色导致公告和头像入口缺失

**状态**：Resolved
**创建时间**：2026-05-23
**标签**：bug / group-chat / permission / real-env

---

## 问题描述

在真实前后端环境 `http://localhost:3000` 使用测试账号 `18337488675` 登录后，打开群聊 `TestGroup1` 的群设置，成员列表中当前用户 `leng_test_updated` 明确显示为“群主”，但群设置顶部没有群头像编辑入口，群公告没有“修改”按钮，底部也显示“退出群聊”而不是“解散群组”。

这会导致群主仍无法设置或编辑群公告、群头像。

### 参考截图

![真实环境修复后群主设置入口恢复](./imgs/real_16_02_after_owner_permission.png)

---

## 复现步骤

1. 打开 `http://localhost:3000`。
2. 使用账号 `18337488675`、密码 `123456` 登录。
3. 进入群聊 `TestGroup1`。
4. 点击右上角群设置按钮。
5. 观察成员列表和群资料编辑入口。

预期：当前用户为群主时，应展示群头像编辑、群公告修改、群名修改和解散群组入口。

实际：成员列表显示当前用户为群主，但群资料编辑入口缺失，底部显示退出群聊。

---

## 相关代码

```vue
<!-- sections/im_web/packages/base-vue/src/components/GroupSettingsDrawer.vue -->
<!-- isOwner / canManageGroup 权限判断 -->
```

```ts
// sections/im_web/packages/datasource-vue/src/stores/groupChatUtils.ts
// getMyGroupRole(group, uid)
```

---

## 根因分析

真实 API 返回字段存在差异：

1. `/v1/group/my` 中 `TestGroup1.role = 0`。
2. `/v1/groups/{group_no}` 中 `role = 1`。
3. `/v1/groups/{group_no}/members` 中当前用户成员记录 `role = 1`。

群设置抽屉使用 `groupStore.groups[groupNo]` 的概要缓存判断权限，而该缓存最初来自 `/group/my`，因此误把当前用户当作普通成员。虽然成员列表已经加载出当前用户是群主，但权限判断没有回退读取成员列表中的当前用户角色。

---

## 问题列表（Q&A 迭代）

### Q1: 为什么成员列表显示群主，但编辑入口不显示？
**A1**: 成员列表来自成员接口，权限入口来自群概要缓存。两个来源的 `role` 不一致，入口没有使用成员接口中的当前用户角色。

### Q2: 应该以哪个字段判断当前用户是否群主？
**A2**: 优先兼容 `owner / creator`，其次使用群详情 `role`，再回退到成员列表里当前用户的 `role`。

---

## 修复记录

### 2026-05-23

已完成以下修复：

1. `sections/im_web/packages/base-vue/src/components/GroupSettingsDrawer.vue`
   - 新增 `currentMember` 和 `currentMemberRole`，从已加载成员列表中定位当前用户成员记录。
   - `isCurrentUserOwner` 除兼容 `owner / creator` 外，也会在当前成员 `role = 1` 时判定为群主。
   - `canManageGroup` 在当前成员 `role = 2` 时判定为管理员可管理，避免群概要缓存 `role` 错误导致入口缺失。

2. `sections/im_web/.ai/checks/verify-issue-15-group-chat-regressions.mjs`
   - 增加成员角色回退权限判断检查，防止后续回归。

3. 真实环境验证
   - 使用账号 `18337488675` 登录真实前后端。
   - 打开 `TestGroup1` 群设置后，已显示群头像“编辑 / 更换头像”、群名称“修改”、群公告“修改”和“解散群组”入口。
   - 实测保存群公告，请求 `PUT /v1/groups/311e44befed248d7ac4357b1527dacd2` 返回 `200`。

---

## 测试结果

```bash
node sections/im_web/.ai/checks/verify-issue-15-group-chat-regressions.mjs
# issue 15 group chat regression checks passed

node sections/im_web/.ai/checks/verify-all-issues.mjs
# Total Tests Run: 16
# Passed: 16
# Failed: 0

./node_modules/.bin/vue-tsc --noEmit && ./node_modules/.bin/vite build apps/chat
# exit 0

git diff --check
# exit 0
```

可视化自动化测试：

```bash
TARGET_URL=http://localhost:3015 TRY_SAVE_NOTICE=1 node run.js /tmp/playwright-issue16-owner-permission.js
# hasAvatarEdit: true
# noticeEditCount: 1
# hasDisband: true
# PUT /v1/groups/311e44befed248d7ac4357b1527dacd2 status: 200
```

---

## 关闭备注

真实环境中已确认问题根因来自 `/group/my` 与成员接口角色不一致。前端已改为在群设置抽屉中使用成员列表当前用户角色作为权限回退，避免群主公告、头像入口缺失。
