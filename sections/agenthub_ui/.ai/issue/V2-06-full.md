# [V2-06] Full-run failures / warnings

**状态**：Open
**创建时间**：2026-06-07
**标签**：bug / investigation / testing
**优先级**：P2

---

## 问题描述

完整 V2 run `v2-full-20260607-041127` 执行到 V2-06 簇时发现以下 Fail / Warning。测试未因这些问题暂停，后续簇已继续执行。

截图：

- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-06-01/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-06-02/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-06-03/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-06-04/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-06-05/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-06-06/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-06-07/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-06-08/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-06-09/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-06-10/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-06-11/01_result.png`
- `sections/agenthub_ui/.ai/issue/screenshots/v2-full-20260607-041127/V2-06-12/01_result.png`

---

## 复现步骤

1. 运行 `node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs`。
2. 查看 `sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127/full-results.json`。
3. 打开本 issue 中列出的截图逐项复核。

---

## 相关代码

```
Runtime route cluster: V2-06
Evidence root: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127
```

---

## 根因分析

待修复 owner 结合运行态源码与后端接口进一步定位。本轮只做 E2E 验收，不修改业务代码。

---

## 问题列表（Q&A 迭代）

### Q1: 是否因为前一个失败而停止后续测试？
**A1**: 否。本轮 runner 对全部 141 个 case 都执行了尝试并保存截图。

---

## 测试发现记录

| Case | Status | Finding |
|---|---|---|
| V2-06-01 创建群 | PASS_WITH_WARNING | route=pages/group/create; text=发起群聊<br>确定(0)<br>群聊名称<br>选择联系人<br>暂无可选择的好友 |
| V2-06-02 群信息 | PASS_WITH_WARNING | route=pages/group/info; text=群聊信息<br>未找到群聊<br>请返回聊天列表重新进入 |
| V2-06-03 邀请 | PASS_WITH_WARNING | route=pages/group/members; text=群成员 (4)<br>二维码<br>添加<br>搜索群成员...<br>我<br>我<br>群主<br>张<br>张伟<br>管理员<br>移出<br>李<br>李四<br>成员<br>移出<br>王<br>王五<br>成员<br>移出 |
| V2-06-04 踢人 | PASS_WITH_WARNING | route=pages/group/members; text=群成员 (4)<br>二维码<br>添加<br>搜索群成员...<br>我<br>我<br>群主<br>张<br>张伟<br>管理员<br>移出<br>李<br>李四<br>成员<br>移出<br>王<br>王五<br>成员<br>移出 |
| V2-06-05 主动退群 | PASS_WITH_WARNING | route=pages/group/members; text=群成员 (4)<br>二维码<br>添加<br>搜索群成员...<br>我<br>我<br>群主<br>张<br>张伟<br>管理员<br>移出<br>李<br>李四<br>成员<br>移出<br>王<br>王五<br>成员<br>移出 |
| V2-06-06 转让群主 | PASS_WITH_WARNING | route=pages/group/members; text=群成员 (4)<br>二维码<br>添加<br>搜索群成员...<br>我<br>我<br>群主<br>张<br>张伟<br>管理员<br>移出<br>李<br>李四<br>成员<br>移出<br>王<br>王五<br>成员<br>移出 |
| V2-06-07 群公告 | PASS_WITH_WARNING | route=pages/group/info; text=群聊信息<br>4 位成员<br>A<br>AgentHub 产品研发群<br>4 位成员 · 我是群主<br>群成员<br>查看全部 (4)<br>我<br>我<br>群主<br>张<br>张伟<br>管理<br>李<br>李四<br>王<br>王五<br>群二维码<br>成员管理<br>共享文件<br>群公告<br>编辑<br>欢迎来到 AgentHub 产品研发群<br>退出群聊<br>解散群聊 |
| V2-06-08 @全员 | PASS_WITH_WARNING | route=pages/group/members; text=群成员 (4)<br>二维码<br>添加<br>搜索群成员...<br>我<br>我<br>群主<br>张<br>张伟<br>管理员<br>移出<br>李<br>李四<br>成员<br>移出<br>王<br>王五<br>成员<br>移出 |
| V2-06-09 群禁言 | PASS_WITH_WARNING | route=pages/group/members; text=群成员 (4)<br>二维码<br>添加<br>搜索群成员...<br>我<br>我<br>群主<br>张<br>张伟<br>管理员<br>移出<br>李<br>李四<br>成员<br>移出<br>王<br>王五<br>成员<br>移出 |
| V2-06-10 群消息跨端 | PASS_WITH_WARNING | route=pages/chat/index; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-06-11 群文件 | PASS_WITH_WARNING | route=pages/chat/index; text=测<br>聊天<br>消息、群聊与智能体<br>开启新消息通知，不再遗漏任何消息<br>开启<br>未找到匹配会话<br>尝试输入其他关键字重新搜索<br>聊天<br>通讯录<br>智能体<br>文件<br>设置 |
| V2-06-12 大群 | PASS_WITH_WARNING | route=pages/group/create; text=发起群聊<br>确定(0)<br>群聊名称<br>选择联系人<br>暂无可选择的好友 |

---

## 修复记录

### 2026-06-07

尚未修复。

---

## 测试结果

```bash
H5_BASE_URL=http://172.18.58.156:5173 node sections/agenthub_ui/.ai/tests/v2-full-runner.mjs
# evidence: sections/agenthub_ui/.ai/tests/screenshots/v2-full-20260607-041127
```

---

## 关闭备注

待对应 case 修复后重跑完整 V2 或至少重跑本簇，并更新该 issue。
