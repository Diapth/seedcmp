# [ISSUE-023] 注册页显示成功但未创建真实可登录账号

**状态**：Open
**创建时间**：2026-06-09
**标签**：bug / auth / register / h5
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-023_register_flow_mock_success_not_real_account.md

---

## 问题描述

验收 `sections/ui` 注册链路时，注册页能完成必填校验、验证码倒计时、密码长度校验，并显示 `注册成功`；但该账号随后无法登录，页面仍停留在注册页/登录失败状态。

本次证据目录：

`seedcmp/sections/ui/.ai/tests/ui-user-settings-20260608162821/`

关键截图：

1. `01-register-empty.png`
2. `02-register-filled.png`
3. `03-register-login-attempt.png`

测试注册账号：

`19608162821`

---

## 复现步骤

1. 打开 `http://100.79.157.76:5173/#/pages/login/register`。
2. 不填表单点击 `注册账号`，确认出现 `请填写完整的注册信息`。
3. 填写手机号、点击 `获取验证码`，确认倒计时启动。
4. 填写短密码，确认出现 `密码长度不能少于6位`。
5. 填写验证码、昵称、合法密码，点击 `注册账号`。
6. 页面显示 `注册成功`。
7. 使用刚注册的手机号和密码登录。

---

## 相关代码

```js
// sections/ui/pages/login/register.vue
function sendCode() {
  codeCountdown.value = 60;
  uni.showToast({
    title: '验证码发送成功',
    icon: 'success'
  });
}

function handleRegister() {
  setTimeout(() => {
    isLoading.value = false;
    uni.showToast({
      title: '注册成功',
      icon: 'success'
    });
    setTimeout(() => {
      goBack();
    }, 1000);
  }, 1200);
}
```

---

## 根因分析

注册页当前是前端模拟流程：验证码发送和注册成功都只通过 `setTimeout` 与 toast 展示，没有调用真实注册 API，也没有创建后端用户。因此注册成功后，使用该手机号/密码无法登录。

---

## 问题列表（Q&A 迭代）

### Q1: 注册表单校验是否可用？
**A1**: 可用。必填校验、验证码倒计时、密码长度校验均通过。

### Q2: 是否可能只是没有自动跳回登录页？
**A2**: 即使手动进入登录页并尝试登录，刚注册账号也不能进入聊天页，说明不是单纯跳转问题。

### Q3: 期望行为是什么？
**A3**: 注册成功应创建真实用户，随后可用该手机号和密码登录；如果当前环境不支持注册，应明确展示“注册暂未接入”，不能显示成功。

---

## 修复建议

1. 接入真实注册/验证码 API，成功后创建后端用户。
2. 注册成功后跳转登录页并预填手机号，或直接完成登录。
3. 若注册服务不可用，应显示不可用状态而不是 `注册成功`。
4. 增加回归：注册新手机号 -> 登录 -> 进入聊天页。

---

## 测试结果

```bash
cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://100.79.157.76:5173' \
     API_BASE='http://100.79.157.76:3000/v1' \
     REPO_ROOT='/media/leng/DiskB1/exp/seedcmp' \
     node run.js /tmp/playwright-test-sections-ui-user-settings.js

# exit 1
# PASS: register validates required fields
# PASS: register code button starts local countdown
# PASS: register validates password length
# PASS: register flow shows success and returns toward login
# FAIL: newly registered account can log in
```

---

## 关闭备注

待修复后复测：新手机号注册成功后可真实登录，并进入 `#/pages/chat/index`。
