# [ISSUE-018] 群聊置顶/公告内容修改后未在当前群信息中显示

**状态**：Open
**创建时间**：2026-06-09
**标签**：bug / group-chat / announcement / pinned
**AI修复模式**：Direct Fix
**计划路径**：N/A
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

---

## 问题描述

验收 `18337488675` 与 `13733632709` 的群聊置顶内容修改时，尝试把当前群的置顶/公告内容更新为 `置顶内容验收 20260608160100`，但右侧群信息仍显示 `暂无公告`，修改后的内容没有出现在当前群信息中。

本次证据目录：

`seedcmp/sections/ui/.ai/tests/ui-group-deep-20260608160100/`

关键截图：

1. `12-b-announcement-edited.png`

---

## 复现步骤

1. 打开 `http://100.79.157.76:5173/`。
2. 使用 `13733632709` 登录并进入真实群 `UI深验群-160100`。
3. 打开右侧群信息。
4. 修改群置顶/公告内容为 `置顶内容验收 20260608160100`。
5. 重新查看右侧群信息中的置顶/公告区域。

---

## 相关代码

```vue
<!-- sections/ui/components/chat/GroupInfoPanel.vue -->
<GroupAnnouncement
  :text="announcementText"
  :can-edit="isCreator"
  @update="handleAnnouncementUpdate"
/>
```

```js
// sections/ui/components/chat/GroupInfoPanel.vue
const isCreator = computed(() => convStore.isGroupCreator(props.group.id, 'me'));

function handleAnnouncementUpdate(text) {
  convStore.setAnnouncement(props.group.id, text);
  uni.showToast({ title: '已更新群公告', icon: 'success' });
}
```

---

## 根因分析

当前群公告更新只写入前端 `convStore.setAnnouncement`，没有看到与真实后端群公告或消息置顶接口的同步逻辑。真实群中当前用户身份也仍用硬编码 `'me'` 判断，可能导致真实 uid 群主权限和可编辑状态不一致。

验收页面文本显示当前群公告区域为：

```text
群公告
暂无公告
```

说明修改后的 `置顶内容验收 20260608160100` 没有在当前真实群信息中生效。

---

## 问题列表（Q&A 迭代）

### Q1: 这里的“置顶内容”是否一定等于群公告？
**A1**: 当前 `sections/ui` 右侧群信息中可编辑的对应区域是 `群公告`；代码中没有找到可操作的消息置顶 UI，所以本轮按群公告/置顶内容入口验收。

### Q2: 是否可能只是权限不足？
**A2**: 可能。`isCreator` 使用 `'me'` 判断真实群主身份，真实 uid 场景可能不准确。即便权限正确，更新也只落在本地 store，缺少后端持久化。

### Q3: 是否影响接收方？
**A3**: 当前验收先在修改方右侧群信息中失败；跨账号同步也需要在修复后一起补测。

---

## 修复建议

1. 明确 `sections/ui` 中“置顶内容”的产品入口：群公告或消息置顶。
2. 若为群公告，应接入真实后端更新/同步接口，并使用真实当前用户 uid 判断群主/管理员权限。
3. 若为消息置顶，应在消息操作或右侧工作区提供置顶列表/编辑入口，并接入后端 pinned message APIs。
4. 增加双账号回归：A 修改后 A/B 两端重新打开群信息均显示新内容。

---

## 测试结果

```bash
cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://100.79.157.76:5173' \
     API_BASE='http://100.79.157.76:3000/v1' \
     REPO_ROOT='/media/leng/DiskB1/exp/seedcmp' \
     node run.js /tmp/playwright-test-sections-ui-group-deep.js

# exit 1
# FAIL: modify pinned/announcement content visible in group info
```

---

## 关闭备注

待修复后复测：当前群修改置顶/公告内容后，右侧群信息立即显示新内容，刷新或另一账号打开后仍保持一致。
