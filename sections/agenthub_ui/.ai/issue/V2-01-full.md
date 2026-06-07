# [V2-01] Full-run acceptance status

**状态**：Closed
**创建时间**：2026-06-07
**标签**：acceptance / testing
**优先级**：P4

---

## 问题描述

完整 V2 run `v2-full-20260607-113409` 执行到 V2-01 簇时，阻塞项数量为 0。本簇没有 Fail / Blocked；如存在 PASS_WITH_WARNING，则代表自动化验收深度说明或需人工决策的边界，不作为当前阻塞缺陷。

截图：

- N/A

---

## 复现步骤

1. 运行 `node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`。
2. 查看 `sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-113409/full-results.json`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

```
Runtime route cluster: V2-01
Evidence root: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-113409
```

---

## 根因分析

最新回归无阻塞缺陷。历史红项已按本轮证据关闭；仍需产品/环境确认的边界统一沉淀到 .ai/questions。

---

## 问题列表（Q&A 迭代）

### Q1: 是否因为前一个失败而停止后续测试？
**A1**: 否。本轮 runner 对全部 141 个 case 都执行了尝试并保存截图。

### Q2: PASS_WITH_WARNING 是否等价于未修复 bug？
**A2**: 否。它表示脚本已完成页面/接口证据采集，但深度一致性、真实外部能力或人工产品决策仍需另行确认；当前阻塞判断只看 FAIL / BLOCKED。

---

## 测试验收记录

| Case | Status | Finding |
|---|---|---|
| V2-01-01 H5 启动可达 | PASS | Login page reachable. |
| V2-01-02 账号 A 登录（13733632709 / 123456） | PASS | A login=true; uid=41232e72652648f8946988f45ba4895d |
| V2-01-03 token 持久化 | PASS | url=http://172.18.58.156:5173/#/pages/chat/index; storage={"im.wsAddr":"ws://0.0.0.0:5200","auth.uid":"4123***895d","auth.accessToken":"8e30***a01b","app_user":"{\"uid\":\"4123***895d\",\"app_id\":\"\",\"name\":\"leng\",\"username\":\"0086***2709\",\"sex\":1,\"category\":\"\",\"short_no\":\"ywwM9Vjs\",\"zone\":\"0086\",\"phone\":\"13733632709\",\"token\":\"8e30***a01b\",\"chat_pwd\":\"\",\"lock***_pwd\":\"\",\"lock***nute\":0,\"setting\":{\"sear***hone\":1,\"sear***hort\":1,\"new_***tice\":1,\"msg_***tail\":1,\"voice_on\":1,\"shock_on\":1,\"offl***tion\":0,\"device_lock\":0,\"mute_of_app\":0},\"rsa_***_key\":\"LS0t***0tCg==\",\"shor***atus\":0,\"msg_***cond\":0,\"avatar\":\"\",\"refr***oken\":\"\",\"expiresAt\":0,\"id\":\"4123***895d\",\"nickname\":\"leng\"}","im.token":"8e30***a01b","app_token":"8e30***a01b","__DC_STAT_UUID":"1780***1753","auth.loginInfo":"{\"uid\":\"4123***895d\",\"app_id\":\"\",\"name\":\"leng\",\"username\":\"0086***2709\",\"sex\":1,\"category\":\"\",\"short_no\":\ |
| V2-01-04 多端登录被踢 | PASS | imWebLogin=true; overlayVisible=true; imWebUrl=http://172.18.58.156:3000/chat; agenthubUrl=http://172.18.58.156:5173/#/pages/chat/index; text=我<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置<br>账号已在其他设备登录<br>缺少 refresh token<br>重新登录 |
| V2-01-05 密码错误提示 | PASS | login400=true; url=http://172.18.58.156:5173/#/pages/login/index; text=AgentHub 通讯<br>连接团队与多智能体的协作门户<br>账号登录<br>二维码登录<br>密码不正确！<br>手机号 / 用户名<br>密码<br>自动登录<br>忘记密码？<br>安全登录<br>还没有账号？<br>注册账号 |
| V2-01-06 账号 B / C 登录 | PASS | B login=true(fallback); C login=true; |

---

## 修复记录

### 2026-06-07

最新完整回归无阻塞项，本簇关闭。

---

## 测试结果

```bash
H5_BASE_URL=http://172.18.58.156:5173 node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs
# evidence: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-113409
```

---

## 关闭备注

Closed by `v2-full-20260607-113409`。
