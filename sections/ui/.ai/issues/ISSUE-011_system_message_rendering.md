# [ISSUE-011] 完善系统消息和静默时间标记显示

**状态**：Resolved
**创建时间**：2026-06-08
**标签**：bug, native-im, system-message, conversation
**AI修复模式**：Direct Fix
**计划路径**：N/A

---

## 问题描述

部分单聊消息列表和左侧会话摘要只显示 `[系统消息]`，无法区分是真实系统通知还是后端/SDK 传来的空系统标记。正常系统消息，例如进群通知、移除成员、退群、群资料或群公告修改，需要展示明确可读文案。

---

## 复现步骤

1. 登录 `sections/ui` H5。
2. 打开出现空系统消息的单聊或群聊会话。
3. 查看消息列表和左侧会话摘要。
4. 对比真实群系统事件，例如邀请成员入群或修改群公告。

---

## 根因分析

`normalizeContent()` 对 `contentType/type` 为 `99` 或 `1000` 的消息统一返回 `[系统消息]`。当 payload 是空系统标记或只包含时间字段时，它被错误展示为系统气泡和会话摘要；当 payload 包含 `event/action/cmd` 等系统事件字段时，代码没有生成具体文案。

---

## 修复记录

- `normalizers.js` 增加系统事件解析，支持群创建、邀请入群、移除成员、退群、解散群、群资料更新和群公告修改。
- 空系统消息或时间类系统标记会标记为 `isSilentSystem`，不再进入消息气泡和会话摘要。
- `message-state.js` 增加 `isVisibleChatMessage()`，统一控制静默系统消息可见性和摘要生成。
- 聊天桌面页与详情页过滤静默系统消息，真实系统通知仍按现有居中系统样式展示。

---

## 测试结果

- `npm run test:native-im`：通过，覆盖空系统标记隐藏、系统事件文案生成、摘要过滤。
- `npm run build:h5`：通过，仅有既有 uni-app 更新提示和 Sass deprecation warning。
- `npm run test:smoke`：通过。

---

## 关闭备注

后续若后端新增系统事件类型，应在 `resolveSystemMessageContent()` 中补充事件映射并追加 native-im 测试。
