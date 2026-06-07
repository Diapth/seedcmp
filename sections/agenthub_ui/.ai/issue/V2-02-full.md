# [V2-02] Full-run acceptance status

**状态**：Closed
**创建时间**：2026-06-07
**标签**：acceptance / testing
**优先级**：P4

---

## 问题描述

完整 V2 run `v2-full-20260607-122547` 执行到 V2-02 簇时，阻塞项数量为 0。本簇没有 Fail / Blocked；如存在 PASS_WITH_WARNING，则代表自动化验收深度说明或需人工决策的边界，不作为当前阻塞缺陷。

截图：

- N/A

---

## 复现步骤

1. 运行 `node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`。
2. 查看 `sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-122547/full-results.json`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

```
Runtime route cluster: V2-02
Evidence root: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-122547
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
| V2-02-01 进入注册页 | PASS | confirmPasswordVisible=true; text=返回登录<br>加入 AgentHub<br>开启您的智能化工作协同体验<br>手机号<br>请输入手机号<br>验证码<br>短信验证码<br>获取验证码<br>昵称<br>请输入您的昵称<br>密码<br>至少 8 位，建议含字母+数字<br>确认密码<br>请再次输入密码<br>注册账号 |
| V2-02-02 字段校验 | PASS | emptyValidation=true; sevenCharSubmitted=false; url=http://172.18.58.156:5173/#/pages/login/register |
| V2-02-03 验证码获取 | PASS | smsCall=true; countdown=true |
| V2-02-04 B 注册成功 | PASS | B registration attempted. ok=true; url=http://172.18.58.156:5173/#/pages/chat/index; text=我<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-02-05 C 注册成功 | PASS | C registered/logged in. storage={"app_user":"{\"uid\":\"0347***5499\",\"app_id\":\"\",\"name\":\"测试员C-2547\",\"username\":\"0086***2547\",\"sex\":1,\"category\":\"\",\"short_no\":\"yfwnUsys\",\"zone\":\"0086\",\"phone\":\"13607122547\",\"token\":\"f0d4***2c4a\",\"chat_pwd\":\"\",\"lock***_pwd\":\"\",\"lock***nute\":0,\"setting\":{\"sear***hone\":1,\"sear***hort\":1,\"new_***tice\":1,\"msg_***tail\":1,\"voice_on\":1,\"shock_on\":1,\"offl***tion\":0,\"device_lock\":0,\"mute_of_app\":0},\"rsa_***_key\":\"LS0t***0tCg==\",\"shor***atus\":0,\"msg_***cond\":0,\"avatar\":\"\",\"refr***oken\":\"\",\"expiresAt\":0}","app_token":"f0d4***2c4a","auth.uid":"0347***5499","auth.accessToken":"f0d4***2c4a","auth.loginInfo":"{\"uid\":\"0347***5499\",\"app_id\":\"\",\"name\":\"测试员C-2547\",\"username\":\"0086***2547\",\"sex\":1,\"category\":\"\",\"short_no\":\"yfwnUsys\",\"zone\":\"0086\",\"phone\":\"13607122547\",\"token\":\"f0d4***2c4a\",\"chat_pwd\":\"\",\"lock***_pwd\":\"\",\"lock***nute\":0,\"setting\ |
| V2-02-06 重复手机号 | PASS | duplicateHandled=true; text=返回登录<br>加入 AgentHub<br>开启您的智能化工作协同体验<br>该用户已存在<br>手机号<br>验证码<br>57s<br>昵称<br>密码<br>确认密码<br>注册账号 |
| V2-02-7 注册后登录态 | PASS | C login after registration=true; storage={"app_user":"{\"uid\":\"0347***5499\",\"app_id\":\"\",\"name\":\"测试员C-2547\",\"username\":\"0086***2547\",\"sex\":1,\"category\":\"\",\"short_no\":\"yfwnUsys\",\"zone\":\"0086\",\"phone\":\"13607122547\",\"token\":\"236d***d092\",\"chat_pwd\":\"\",\"lock***_pwd\":\"\",\"lock***nute\":0,\"setting\":{\"sear***hone\":1,\"sear***hort\":1,\"new_***tice\":1,\"msg_***tail\":1,\"voice_on\":1,\"shock_on\":1,\"offl***tion\":0,\"device_lock\":0,\"mute_of_app\":0},\"rsa_***_key\":\"LS0t***0tCg==\",\"shor***atus\":0,\"msg_***cond\":0,\"avatar\":\"\",\"refr***oken\":\"\",\"expiresAt\":0,\"id\":\"0347***5499\",\"nickname\":\"测试员C-2547\"}","im.wsAddr":"ws://0.0.0.0:5200","app_token":"236d***d092","auth.uid":"0347***5499","im.token":"236d***d092","auth.accessToken":"236d***d092","auth.loginInfo":"{\"uid\":\"0347***5499\",\"app_id\":\"\",\"name\":\"测试员C-2547\",\"username\":\"0086***2547\",\"sex\":1,\"category\":\"\",\"short_no\":\"yfwnUsys\",\"zone\":\"0086\",\"p |

---

## 修复记录

### 2026-06-07

最新完整回归无阻塞项，本簇关闭。

---

## 测试结果

```bash
H5_BASE_URL=http://172.18.58.156:5173 node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs
# evidence: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-122547
```

---

## 关闭备注

Closed by `v2-full-20260607-122547`。
