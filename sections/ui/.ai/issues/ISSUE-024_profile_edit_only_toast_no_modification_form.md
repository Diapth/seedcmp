# [ISSUE-024] 个人资料编辑入口只显示提示，无法修改资料

**状态**：Open
**创建时间**：2026-06-09
**标签**：bug / profile / settings / h5
**AI修复模式**：Direct Fix
**计划路径**：N/A

---

## 问题描述

验收个人资料设置时，`个人资料` 页面能显示当前用户昵称和手机号，但点击 `编辑资料` 后只出现 `资料编辑面板已打开` 的 toast，没有真实编辑面板、输入框或保存动作，因此无法修改昵称、头像、邮箱等个人资料。

本次证据目录：

`seedcmp/sections/ui/.ai/tests/ui-user-settings-20260608162821/`

关键截图：

1. `06-profile.png`
2. `07-profile-edit-click.png`

验收账号：

`13733632709`

---

## 复现步骤

1. 登录 `13733632709`。
2. 打开 `http://100.79.157.76:5173/#/pages/profile/index`。
3. 确认页面显示当前用户信息。
4. 点击 `编辑资料`。
5. 观察是否出现可编辑表单并能保存。

---

## 相关代码

```js
// sections/ui/pages/profile/index.vue
function editProfile() {
  uni.showToast({ title: '资料编辑面板已打开', icon: 'none' });
}
```

---

## 根因分析

`profile/index.vue` 的 `editProfile` 只显示 toast，没有打开弹窗、跳转编辑页、更新 Pinia 当前用户，也没有调用后端用户资料更新接口。

---

## 问题列表（Q&A 迭代）

### Q1: 个人资料页是否打不开？
**A1**: 能打开。当前用户昵称、手机号、二维码占位、账号状态都能展示。

### Q2: 设置页中的 `编辑资料` 是否不同？
**A2**: 设置页会跳转到 `/pages/profile/index`，最终仍落到同一个只 toast 的编辑入口。

### Q3: 期望支持哪些修改？
**A3**: 至少应支持修改昵称/头像等基础个人资料，并在保存后更新当前用户展示；具体字段可按后端用户资料接口能力确定。

---

## 修复建议

1. 提供真实个人资料编辑表单或独立编辑页。
2. 保存时调用后端用户资料更新接口，并更新 `appStore.currentUser` 与本地 storage。
3. 保存失败时展示明确错误；成功后资料页和设置页同步展示新值。
4. 增加回归：修改昵称 -> 保存 -> 刷新页面仍显示新昵称。

---

## 测试结果

```bash
cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://100.79.157.76:5173' \
     API_BASE='http://100.79.157.76:3000/v1' \
     REPO_ROOT='/media/leng/DiskB1/exp/seedcmp' \
     node run.js /tmp/playwright-test-sections-ui-user-settings.js

# exit 1
# PASS: profile page shows current user info
# FAIL: profile edit supports actual modification form
```

---

## 关闭备注

待修复后复测：个人资料页点击 `编辑资料` 后可修改并保存资料，设置页同步显示修改后的用户信息。
