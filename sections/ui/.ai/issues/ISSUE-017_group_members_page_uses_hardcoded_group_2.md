# [ISSUE-017] 群成员页未打开当前群且成员管理仍硬编码 group 2

**状态**：Resolved
**创建时间**：2026-06-09
**标签**：bug / group-chat / members / h5

---

## 问题描述

使用 `sections/ui` 验收真实群聊 `UI深验群-160100` 时，右侧群信息能展示当前群和两个目标账号，但点击 `查看全部` 或 `成员管理` 后未进入当前群的成员管理页，页面仍停留在 `#/pages/chat/index`。

本次验收还通过 API 添加了新成员 `逐味魔`，`membersync` 和入群系统消息均通过；但 H5 的成员管理页面本身不能针对当前真实群工作，因此无法完整验收查看成员、管理成员、添加成员、移除成员、@ 成员等页面能力。

本次证据目录：

`sections/ui/.ai/tests-e2e/ui-group-deep-20260608160100/`

关键截图：

1. `09-b-group-info.png`
2. `10-b-members-page.png`
3. `11-a-after-new-member.png`

---

## 复现步骤

1. 打开 `http://100.79.157.76:5173/`。
2. 使用 `13733632709` 登录并进入真实群 `UI深验群-160100`。
3. 打开右侧群信息。
4. 点击 `查看全部` 或 `成员管理`。
5. 观察路由和页面内容。

---

## 相关代码

```js
// sections/ui/components/chat/RightWorkspace.vue
function openGroupMembers() {
  uni.navigateTo({ url: '/pages/group/members' });
}
```

```js
// sections/ui/pages/group/members.vue
onMounted(() => {
  if (!convStore.members['2'] || convStore.members['2'].length === 0) {
    convStore.initFromGroupMembers('2', [/* mock members */], 'me');
  }
});

const members = computed(() => convStore.groupMembers('2'));
```

```js
// sections/ui/pages/group/members.vue
convStore.removeMember('2', item.id);
convStore.addAgentMember('2', agent);
convStore.addMember('2', { /* contact */ });
```

---

## 根因分析

群信息右侧工作区跳转成员页时没有把当前 `conversation.id` 带到路由中；成员页也没有从路由读取真实 group id，而是初始化并操作硬编码的 mock 群 `2`。

因此真实群 `bdf86561b2474bc182af597fe77442d3` 的查看成员、管理成员、添加成员、移出成员和 @ 成员能力都无法通过该页面完成。

---

## 问题列表（Q&A 迭代）

### Q1: 右侧群信息是否完全没有成员？
**A1**: 不是。右侧群信息能显示当前群信息和目标账号成员，失败点是进入完整成员管理页。

### Q2: 新成员入群系统消息是否失败？
**A2**: 没有失败。API 添加新成员成功，`membersync` 包含新成员，H5 显示了入群系统消息。

### Q3: 为什么这是高优先级？
**A3**: 用户明确要求验收查看群成员、管理群成员、添加新的群成员；当前页面硬编码 group `2`，会导致真实群管理不可用。

---

## 修复建议

1. `RightWorkspace.vue` 跳转时传入当前群 id，例如 `/pages/group/members?id=${props.conversation.id}`。
2. `pages/group/members.vue` 从路由读取 group id，并基于真实群成员数据渲染和操作。
3. 添加、移除、@ 成员等操作全部使用当前 group id，避免写死 `2`。
4. 增加回归：真实 API 群点击成员管理后路由进入当前群，成员列表包含 `18337488675`、`13733632709` 和新加成员。

---

## 修复记录

### 2026-06-09

1. 新增 `resolveGroupPageId()` / `buildGroupScopedRoute()`，统一从 `id/groupId/group_id` 和当前 active state 解析群页 group id。
2. `RightWorkspace.vue`、`pages/group/info.vue` 跳转群成员和群二维码时携带当前 `conversation.id`，不再打开裸路由。
3. `pages/group/members.vue` 与 `pages/group/qrcode.vue` 改为基于当前 group id 渲染、同步成员、添加/移除成员、@ 成员和回退路由。
4. 增加 `native-im` 回归测试，覆盖非 `2` 群的路由解析和 query 编码。

---

## 测试结果

### 修复后

```bash
cd /tmp/seedcmp-new-ui-issuefix/sections/ui
npm run test:native-im

# exit 0
# pass 1, fail 0
```

```bash
cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://127.0.0.1:5173' \
     OUT_DIR='/tmp/seedcmp-new-ui-issuefix/sections/ui/.ai/tests-e2e/ISSUE-017-group-members-current-group' \
     node run.js /tmp/playwright-issue-017-visual.js

# exit 0
# PASS: desktop current group is visible before navigation
# PASS: desktop member management action is visible
# PASS: desktop members page count belongs to agent-review
# PASS: desktop members page shows agent-review member PM
# PASS: desktop members page shows agent-review member Claude Code
# PASS: desktop route scoped to agent-review
# PASS: mobile members page count belongs to agent-review
# PASS: mobile members page shows agent-review member Codex
# PASS: mobile members page shows agent-review member Clowder
# PASS: mobile members page has no horizontal overflow
```

截图：

1. `sections/ui/.ai/tests-e2e/ISSUE-017-group-members-current-group/01-desktop-current-group-info.png`
2. `sections/ui/.ai/tests-e2e/ISSUE-017-group-members-current-group/02-desktop-members-page-agent-review.png`
3. `sections/ui/.ai/tests-e2e/ISSUE-017-group-members-current-group/03-mobile-members-page-agent-review.png`

### 修复前

```bash
cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://100.79.157.76:5173' \
     API_BASE='http://100.79.157.76:3000/v1' \
     REPO_ROOT='/media/leng/DiskB1/exp/seedcmp' \
     node run.js /tmp/playwright-test-sections-ui-group-deep.js

# exit 1
# PASS: group info panel shows current group info
# PASS: group info panel shows both target members
# FAIL: open group members page from current group
# PASS: API add new member succeeds
# PASS: API membersync includes new member
# PASS: new member join system message displays in H5
```

---

## 关闭备注

已复测：从当前非 `2` 群的右侧信息进入成员页，路由携带当前群 id，成员页显示当前群成员；移动端直接打开当前群成员页无横向溢出。真实后端群的成员同步仍依赖 `/groups/:groupNo/membersync` 可用性，但前端不再把成员管理写死到 mock group `2`。
