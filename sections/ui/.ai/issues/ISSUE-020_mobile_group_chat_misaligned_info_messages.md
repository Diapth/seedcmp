# [ISSUE-020] 移动端群聊消息区存在横向错位元素

**状态**：Open
**创建时间**：2026-06-09
**标签**：bug / mobile / layout / group-chat
**AI修复模式**：Direct Fix
**计划路径**：N/A

---

## 问题描述

使用移动端视口验收 `sections/ui` 群聊页面时，群聊详情页能打开且没有空白页，但页面内检测到横向错位/越界元素。用户要求查看移动端是否有错位的信息消息，本轮验收判定移动端群聊页存在错位风险。

本次证据目录：

`seedcmp/sections/ui/.ai/tests/ui-group-deep-20260608160100/`

关键截图：

1. `16-mobile-group-detail.png`
2. `17-mobile-group-info.png`

---

## 复现步骤

1. 打开 `http://100.79.157.76:5173/`。
2. 使用 `18337488675` 登录。
3. 将浏览器视口切换为移动端尺寸，例如 `390 x 844`。
4. 进入真实群 `UI深验群-160100` 的聊天详情。
5. 检查消息区布局和横向越界元素。

---

## 相关代码

```text
待修复时重点排查移动端聊天详情页布局、系统消息/信息消息样式、弹层遮罩或过渡节点。
```

验收脚本记录的越界元素示例：

```json
{
  "innerWidth": 390,
  "scrollWidth": 390,
  "offenders": [
    { "x": -233, "y": 722, "width": 520, "height": 42 },
    { "x": 0, "y": -200, "width": 400, "height": 400 }
  ]
}
```

---

## 根因分析

移动端群聊详情页存在若干脱离视口的 DOM 节点，其中一个可见区域附近的元素坐标为 `x=-233,width=520`，超过 `390px` 视口宽度。虽然 `scrollWidth` 没有大于 `innerWidth`，但元素本身横向偏移明显，容易造成信息消息或浮层在移动端错位。

当前证据还包含多个巨大隐藏层或过渡层坐标，如 `x=-99713,width=100000`，需要修复时区分正常隐藏节点与真实可见错位节点。

---

## 问题列表（Q&A 迭代）

### Q1: 移动端群信息页是否也越界？
**A1**: 本轮 `mobile group info page has no horizontal overflow` 通过，失败集中在群聊详情页。

### Q2: 页面是否打不开？
**A2**: 不是。`mobile group chat visible without obvious blank/error` 通过。

### Q3: 为什么 scrollWidth 没超也算失败？
**A3**: 验收目标包含“是否有错位的信息消息”。脚本捕获到可见区域附近的横向偏移元素，截图也记录了移动端详情页状态，应作为移动端布局问题跟进。

---

## 修复建议

1. 排查移动端群聊详情页中系统消息、引用消息、文件消息和底部输入区的宽度/定位样式。
2. 对消息气泡、系统提示、底部操作层设置移动端最大宽度和 `box-sizing: border-box`。
3. 避免用大尺寸隐藏层参与可见布局检测；若确为框架隐藏节点，应加可识别 class 或在测试中排除。
4. 增加移动端回归：群聊详情页在 `390 x 844` 下无可见横向错位元素，消息文字不溢出。

---

## 测试结果

```bash
cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://100.79.157.76:5173' \
     API_BASE='http://100.79.157.76:3000/v1' \
     REPO_ROOT='/media/leng/DiskB1/exp/seedcmp' \
     node run.js /tmp/playwright-test-sections-ui-group-deep.js

# exit 1
# PASS: mobile group chat visible without obvious blank/error
# FAIL: mobile group chat has no horizontal overflow/misaligned info messages
# PASS: mobile group info page opens for current group
# PASS: mobile group info page has no horizontal overflow
```

---

## 关闭备注

待修复后复测：移动端群聊详情页在常见手机视口下无信息消息错位、无可见横向越界元素，群信息页仍保持正常。
